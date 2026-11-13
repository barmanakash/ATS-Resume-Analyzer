"""Builds a factual profile of a resume from its text (no AI). Nothing here is guessed: if a fact cannot be read
from the text it is left as None, and the report says so."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from typing import Dict, List, Optional, Set, Tuple

from app.scoring.jd_parser import EDUCATION_LABELS, education_levels
from app.scoring.skills import certifications_in, find_skill_mentions
from app.scoring.text_utils import clip, content_stems, normalize_text, tokens

_SECTION_PHRASES: Dict[str, Tuple[str, ...]] = {
    "summary": (
        "summary", "professional summary", "profile", "professional profile", "objective", "career objective",
        "about me", "career summary", "executive summary",
    ),
    "experience": (
        "experience", "work experience", "professional experience", "employment", "employment history",
        "work history", "career history", "relevant experience", "internship", "internships", "internship experience",
    ),
    "education": (
        "education", "academic background", "academics", "education and training", "academic qualifications",
        "educational qualifications",
    ),
    "skills": (
        "skills", "technical skills", "core competencies", "key skills", "skills summary", "competencies",
        "technologies", "tech stack", "skills and tools", "tools and technologies",
    ),
    "projects": ("projects", "personal projects", "academic projects", "key projects", "selected projects", "project experience"),
    "certifications": ("certifications", "certificates", "licenses", "licenses and certifications", "courses", "training"),
    "achievements": ("achievements", "awards", "honors", "accomplishments", "awards and achievements"),
}
_HEADER_LOOKUP = {phrase: kind for kind, phrases in _SECTION_PHRASES.items() for phrase in phrases}
_INLINE_HEADER = re.compile(r"^([A-Za-z &/-]{3,35}):\s*(.+)$")

_MONTHS = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
_MONTH_YEAR = r"(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+\d{4})"
_NUM_MONTH_YEAR = r"(?:\d{1,2}/\d{4})"
_YEAR = r"(?:19|20)\d{2}"
_START = rf"(?:{_MONTH_YEAR}|{_NUM_MONTH_YEAR}|{_YEAR})"
_END = rf"(?:{_MONTH_YEAR}|{_NUM_MONTH_YEAR}|{_YEAR}|present|current|now|till date|to date|ongoing)"
_RANGE = re.compile(rf"(?<![0-9/])({_START})\s*(?:-|to|until)\s*({_END})(?![0-9])")
_PRESENT_WORDS = {"present", "current", "now", "till date", "to date", "ongoing"}
_STATED_YEARS = re.compile(r"(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+[a-z+#.]+){0,4}?\s+experience")

_EDU_LINE = re.compile(
    r"\b(bachelor|master|b\.?tech|m\.?tech|university|college|school|diploma|degree|phd|b\.?sc|m\.?sc|mba|gpa|cgpa)\b"
)
_TITLE_WORDS = {
    "engineer", "developer", "manager", "analyst", "designer", "consultant", "specialist", "intern", "lead",
    "architect", "administrator", "executive", "associate", "coordinator", "scientist", "officer", "director",
    "programmer", "technician", "representative", "assistant", "accountant", "marketer", "strategist", "recruiter",
    "teacher", "nurse", "writer", "editor", "tester",
}
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"\+?\d[\d\s().-]{8,16}\d")
_BULLET_STARTS = ("-", "*", "\u2022", "\u00b7", "\u25aa", "\u25cf", "\u2013")

# Where a skill appears says how well it is evidenced: used in a job or project beats a bare list.
_EVIDENCE_PRIORITY = {"experience": 0, "projects": 0, "summary": 1, "achievements": 1, "certifications": 2, "education": 3, "skills": 4}


@dataclass
class ResumeProfile:
    lines: List[str]
    lower: List[str]
    sections: List[Optional[str]]
    skills: Dict[str, List[int]]
    certifications: Dict[str, int]  # name -> line index
    years: Optional[float]
    years_source: Optional[str]  # "dates" | "stated" | None
    date_range_count: int
    education_level: Optional[int]
    education_evidence: Optional[str]
    title_lines: List[str]
    word_count: int
    has_email: bool
    has_phone: bool
    bullet_count: int
    sections_detected: List[str]
    all_stems: Set[str]
    line_stems: List[Set[str]] = field(default_factory=list)

    def evidence(self, skill: str) -> Optional[Tuple[str, Optional[str], int]]:
        """Best (snippet, section, line index) for a skill, preferring real usage over a skills list."""
        indices = self.skills.get(skill)
        if not indices:
            return None
        best = min(indices, key=lambda i: (_EVIDENCE_PRIORITY.get(self.sections[i] or "", 2), i))
        return clip(self.lines[best]), self.sections[best], best


def _header_kind(line: str) -> Optional[str]:
    text = re.sub(r"[^a-z &/-]", " ", normalize_text(line))
    text = re.sub(r"\s+", " ", text).strip(" -/&")
    if not text or len(text) > 40 or len(text.split()) > 5:
        return None
    return _HEADER_LOOKUP.get(text)


def _detect_sections(lines: List[str]) -> List[Optional[str]]:
    sections: List[Optional[str]] = []
    current: Optional[str] = None
    for line in lines:
        kind = _header_kind(line)
        if kind is None:
            inline = _INLINE_HEADER.match(line)
            if inline:
                kind = _header_kind(inline.group(1))
        if kind is not None:
            current = kind
        sections.append(current)
    return sections


def _parse_point(text: str, today: date) -> Optional[Tuple[int, int, bool]]:
    """-> (year, month, year_only)"""
    text = text.strip()
    if text in _PRESENT_WORDS:
        return today.year, today.month, False
    match = re.match(r"([a-z]+)\.?,?\s+(\d{4})$", text)
    if match:
        month = _MONTHS.get(match.group(1)[:3])
        return (int(match.group(2)), month, False) if month else None
    match = re.match(r"(\d{1,2})/(\d{4})$", text)
    if match:
        month = int(match.group(1))
        return (int(match.group(2)), month, False) if 1 <= month <= 12 else None
    match = re.match(r"((?:19|20)\d{2})$", text)
    if match:
        return int(match.group(1)), 1, True
    return None


def _months_worked(line_lower: str, today: date) -> List[Tuple[int, int]]:
    """Month-index intervals for every date range on a line."""
    intervals: List[Tuple[int, int]] = []
    for match in _RANGE.finditer(line_lower):
        start = _parse_point(match.group(1), today)
        end = _parse_point(match.group(2), today)
        if not start or not end:
            continue
        s_year, s_month, _ = start
        e_year, e_month, e_year_only = end
        if e_year_only:
            if e_year == s_year:
                e_month = 7  # "2020 - 2020": count roughly half a year, not zero
            elif e_year == today.year:
                e_month = today.month
        if not (1970 <= s_year <= today.year and 1970 <= e_year <= today.year):
            continue
        s_index, e_index = s_year * 12 + (s_month - 1), e_year * 12 + (e_month - 1)
        e_index = min(e_index, today.year * 12 + (today.month - 1))
        if e_index > s_index:
            intervals.append((s_index, e_index))
    return intervals


def _merge_total_months(intervals: List[Tuple[int, int]]) -> int:
    """Total months covered, counting overlapping jobs once."""
    total, current_end, current_start = 0, None, None
    for start, end in sorted(intervals):
        if current_end is None or start > current_end:
            if current_end is not None:
                total += current_end - current_start
            current_start, current_end = start, end
        else:
            current_end = max(current_end, end)
    if current_end is not None:
        total += current_end - current_start
    return total


def _valid_phone(text: str) -> bool:
    for match in _PHONE.finditer(text):
        digits = re.sub(r"\D", "", match.group())
        looks_like_dates = re.search(r"(?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}", match.group())
        if 10 <= len(digits) <= 13 and not looks_like_dates:
            return True
    return False


def build_profile(text: str, contact: Optional[dict] = None, today: Optional[date] = None) -> ResumeProfile:
    today = today or date.today()
    contact = contact or {}
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    lower = [normalize_text(ln) for ln in lines]
    sections = _detect_sections(lines)
    full_lower = "\n".join(lower)

    skills = find_skill_mentions(lower)

    certs: Dict[str, int] = {}
    for index, line in enumerate(lower):
        for name in certifications_in(line):
            certs.setdefault(name, index)

    # Years of experience: only date ranges inside work-history lines, so degree dates are not counted as jobs.
    has_experience_section = "experience" in sections
    has_any_section = any(s is not None for s in sections)
    intervals: List[Tuple[int, int]] = []
    for index, line in enumerate(lower):
        if has_experience_section:
            counted = sections[index] == "experience"
        elif has_any_section:
            counted = sections[index] not in ("education", "certifications") and not _EDU_LINE.search(line)
        else:
            counted = not _EDU_LINE.search(line)
        if counted:
            intervals.extend(_months_worked(line, today))

    years: Optional[float] = None
    years_source: Optional[str] = None
    if intervals:
        years = round(_merge_total_months(intervals) / 12.0, 1)
        years_source = "dates"
    else:
        stated = [int(m.group(1)) for m in _STATED_YEARS.finditer(full_lower) if int(m.group(1)) <= 50]
        if stated:
            years, years_source = float(max(stated)), "stated"

    # Education: the highest degree named, preferring the education section.
    has_education_section = "education" in sections
    best_level: Optional[int] = None
    best_evidence: Optional[str] = None
    for index, line in enumerate(lower):
        if has_education_section and sections[index] != "education":
            continue
        levels = education_levels(line)
        if levels and (best_level is None or max(levels) > best_level):
            best_level, best_evidence = max(levels), clip(lines[index])

    title_lines = [
        lines[i] for i, ln in enumerate(lower)
        if len(lines[i]) <= 90 and not lines[i].startswith(_BULLET_STARTS) and _TITLE_WORDS.intersection(tokens(ln))
    ]

    bullet_count = sum(1 for ln in lines if ln.startswith(_BULLET_STARTS))
    date_range_count = sum(len(_RANGE.findall(ln)) for ln in lower)

    return ResumeProfile(
        lines=lines,
        lower=lower,
        sections=sections,
        skills=skills,
        certifications=certs,
        years=years,
        years_source=years_source,
        date_range_count=date_range_count,
        education_level=best_level,
        education_evidence=best_evidence,
        title_lines=title_lines,
        word_count=len(re.findall(r"\S+", text or "")),
        has_email=bool(contact.get("email")) or bool(_EMAIL.search(text or "")),
        has_phone=bool(contact.get("phone")) or _valid_phone(text or ""),
        bullet_count=bullet_count,
        sections_detected=[s for s in dict.fromkeys(sections) if s],
        all_stems=content_stems(text or ""),
        line_stems=[content_stems(ln) for ln in lines],
    )


def education_label(level: Optional[int]) -> Optional[str]:
    return EDUCATION_LABELS.get(level) if level else None


# Public names for other modules (the resume optimizer splits a resume into sections with these).
detect_sections = _detect_sections
header_kind = _header_kind
