"""Extracts structured requirements from a job description using rules (no AI).

The result says what the job asks for and how strongly: MANDATORY, PREFERRED or OPTIONAL. Importance comes from
the section a line sits in ("Requirements", "Nice to have", ...) and from wording on the line itself
("must", "a plus", ...). Line wording wins over the section.
"""
from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from app.scoring.skills import SKILLS, SKILLS_BY_NAME, certifications_in, skills_in
from app.scoring.text_utils import STOPWORDS, clip, normalize_text, stem, tokens

MANDATORY = "MANDATORY"
PREFERRED = "PREFERRED"
OPTIONAL = "OPTIONAL"
_RANK = {MANDATORY: 0, PREFERRED: 1, OPTIONAL: 2}

EDUCATION_LABELS = {1: "Diploma", 2: "Bachelor's degree", 3: "Master's degree", 4: "Doctorate"}

_SECTION_PHRASES: Dict[str, Tuple[str, ...]] = {
    "required": (
        "requirements", "requirement", "required", "required qualifications", "required skills", "qualifications",
        "minimum qualifications", "basic qualifications", "must have", "must haves", "must-have", "what you need",
        "what we're looking for", "what we are looking for", "what you bring", "who you are", "your profile",
        "skills", "skills and experience", "skills & experience", "key skills", "technical skills", "experience",
        "experience and skills", "what you'll need", "what you will need", "essential", "essential skills",
        "you have", "you should have", "you'll bring",
    ),
    "preferred": (
        "preferred", "preferred qualifications", "preferred skills", "nice to have", "nice-to-have", "nice to haves",
        "bonus", "bonus points", "good to have", "desirable", "additional qualifications", "a plus", "pluses",
        "extra credit", "great to have",
    ),
    "responsibilities": (
        "responsibilities", "key responsibilities", "your responsibilities", "what you'll do", "what you will do",
        "the role", "your role", "role overview", "duties", "key duties", "day to day", "what you'll be doing",
        "job duties", "about the role",
    ),
    "ignore": (
        "about us", "about the company", "about", "company", "company overview", "benefits", "perks",
        "perks and benefits", "what we offer", "why join us", "who we are", "our culture", "equal opportunity",
        "equal opportunity employer", "compensation", "salary", "how to apply",
    ),
}
_HEADER_LOOKUP: Dict[str, str] = {phrase: kind for kind, phrases in _SECTION_PHRASES.items() for phrase in phrases}

_INLINE_HEADER = re.compile(r"^([A-Za-z' /&-]{3,40}):\s*(.*)$")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?;])\s+(?=[A-Z0-9])")

_PREFERRED_CUES = re.compile(
    r"\b(preferred|nice[- ]to[- ]have|a plus|is a plus|bonus|good to have|desirable|ideally|an advantage|"
    r"advantageous|familiarity with|exposure to|would be great|an asset|is an asset)\b"
)
_MANDATORY_CUES = re.compile(
    r"\b(must|required|requires|mandatory|essential|minimum|at least|proficien\w*|expert\w*|strong|solid|"
    r"hands-on|extensive)\b"
)
_NEGATED = re.compile(r"\b(?:not|no)\b[^.;]{0,25}\b(?:required|necessary|needed)\b")

_YEARS_RANGE = re.compile(r"(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)")
_YEARS_MIN = re.compile(r"(?:at least|minimum(?: of)?|min\.?|over|more than)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)")
_YEARS_PLUS = re.compile(r"(\d{1,2})\s*\+\s*(?:years?|yrs?)")
_YEARS_PLAIN = re.compile(r"(\d{1,2})\s*(?:years?|yrs?)(?:\s+of)?(?:\s+[a-z+#.]+){0,4}?\s+experience")

# Degree levels. Abbreviations need their dots ("b.e", "m.s") so ordinary words like "be" never match.
_EDU_PATTERNS: List[Tuple[int, "re.Pattern[str]"]] = [
    (4, re.compile(r"\b(?:ph\.?d|doctorate|doctoral)\b")),
    (3, re.compile(
        r"\bmaster(?:'s|s)\b|\bmaster\s+(?:degree|of|in)\b|\bm\.?tech\b|\bm\.?sc\b|\bmba\b|\bmca\b|\bm\.s\b|\bm\.e\b|\bm\.?eng\b"
    )),
    (2, re.compile(
        r"\bbachelor(?:'s|s)?\b|\bb\.?tech\b|\bb\.?sc\b|\bbca\b|\bb\.e\b|\bb\.s\b|\bb\.a\b|\bb\.?eng\b|\bundergraduate\s+degree\b"
    )),
    (1, re.compile(r"\bdiploma\b|\bassociate'?s?\s+degree\b")),
]
# "A degree in X" with no level named. Only used when no specific level is present, otherwise
# "Master's degree in X" would also count as a generic (lower) degree.
_EDU_GENERIC = re.compile(r"\b(?:college|university)\s+degree\b|\bdegree\s+in\b|\b4[- ]year\s+degree\b")
_EQUIVALENT_EXPERIENCE = re.compile(r"\bequivalent\s+(?:practical\s+|work\s+|professional\s+)?experience\b")

_ACTION_VERBS = {
    "design", "develop", "build", "implement", "maintain", "manage", "lead", "create", "collaborate", "analyze",
    "analyse", "write", "deliver", "optimize", "optimise", "test", "deploy", "monitor", "coordinate", "plan", "drive",
    "own", "support", "improve", "review", "mentor", "partner", "work", "ensure", "define", "prepare", "conduct",
    "execute", "identify", "provide", "respond", "handle", "operate", "produce", "research", "present", "architect",
    "integrate", "debug", "document", "train", "contribute", "participate", "automate", "migrate", "troubleshoot",
}

_BULLETS = "-*\u2022\u00b7\u25aa\u25cf> \t"

# Stems of every word used in a skill alias: these are skills, not generic "keywords".
_SKILL_STEMS = {stem(t) for skill in SKILLS for alias in skill.aliases for t in tokens(alias)}


def _header_kind(line: str) -> Optional[str]:
    text = re.sub(r"[^a-z' /&-]", " ", normalize_text(line))
    text = re.sub(r"\s+", " ", text).strip(" -/&")
    if not text or len(text) > 45 or len(text.split()) > 6:
        return None
    return _HEADER_LOOKUP.get(text)


def _segments(text: str) -> List[Tuple[str, Optional[str]]]:
    """Splits the posting into (sentence-or-bullet, section) pairs."""
    out: List[Tuple[str, Optional[str]]] = []
    section: Optional[str] = None
    for raw in (text or "").splitlines():
        line = raw.strip().lstrip(_BULLETS).strip()
        if not line:
            continue
        kind = _header_kind(line)
        if kind:
            section = kind
            continue
        inline = _INLINE_HEADER.match(line)
        if inline:
            inline_kind = _header_kind(inline.group(1))
            if inline_kind:
                section = inline_kind
                line = inline.group(2).strip()
                if not line:
                    continue
        for sentence in _SENTENCE_SPLIT.split(line):
            sentence = sentence.strip()
            if len(sentence) >= 3:
                out.append((sentence, section))
    return out


def _importance(segment_lower: str, section: Optional[str]) -> str:
    if section == "ignore":
        return OPTIONAL
    cleaned = _NEGATED.sub(" ", segment_lower)
    if _PREFERRED_CUES.search(cleaned):
        return PREFERRED
    if _MANDATORY_CUES.search(cleaned):
        return MANDATORY
    if section == "preferred":
        return PREFERRED
    return MANDATORY


def _years_in(segment_lower: str) -> List[Tuple[int, Optional[int]]]:
    if "experience" not in segment_lower and "exp." not in segment_lower:
        return []
    found: List[Tuple[int, Optional[int]]] = []
    consumed: List[Tuple[int, int]] = []

    def overlaps(span: Tuple[int, int]) -> bool:
        return any(span[0] < end and start < span[1] for start, end in consumed)

    for match in _YEARS_RANGE.finditer(segment_lower):
        low, high = int(match.group(1)), int(match.group(2))
        if low <= high:
            found.append((low, high))
            consumed.append(match.span())
    for pattern in (_YEARS_MIN, _YEARS_PLUS, _YEARS_PLAIN):
        for match in pattern.finditer(segment_lower):
            if overlaps(match.span()):
                continue
            found.append((int(match.group(1)), None))
            consumed.append(match.span())
    return [(low, high) for low, high in found if 0 <= low <= 40]


def education_levels(segment_lower: str) -> List[int]:
    """Degree levels named in already-lower-cased text. A job takes the lowest ("Bachelor's or Master's" ->
    Bachelor's); a resume takes the highest."""
    levels = [level for level, pattern in _EDU_PATTERNS if pattern.search(segment_lower)]
    if not levels and _EDU_GENERIC.search(segment_lower):
        levels = [2]
    return levels


def extract_requirements(job_text: str) -> Dict[str, Any]:
    segments = _segments(job_text)

    skills: Dict[str, Dict[str, Any]] = {}
    certs: Dict[str, Dict[str, Any]] = {}
    year_candidates: List[Tuple[int, Optional[int]]] = []
    required_levels: List[int] = []
    preferred_levels: List[int] = []
    accepts_equivalent = False
    responsibilities: List[str] = []
    verb_fallback: List[str] = []
    keyword_counts: Counter = Counter()
    keyword_forms: Dict[str, Counter] = {}
    keyword_order: Dict[str, int] = {}

    for seg, section in segments:
        lower = normalize_text(seg)
        importance = _importance(lower, section)

        for name in skills_in(lower):
            entry = skills.setdefault(name, {"importance": importance, "mentions": 0, "context": clip(seg, 180)})
            entry["mentions"] += 1
            if _RANK[importance] < _RANK[entry["importance"]]:
                entry["importance"] = importance
                entry["context"] = clip(seg, 180)

        for name in certifications_in(lower):
            entry = certs.setdefault(name, {"importance": importance, "context": clip(seg, 180)})
            if _RANK[importance] < _RANK[entry["importance"]]:
                entry["importance"] = importance
                entry["context"] = clip(seg, 180)

        if section == "ignore":
            continue  # company blurbs and benefits say nothing about what the candidate needs

        if importance != PREFERRED:
            year_candidates.extend(_years_in(lower))

        levels = education_levels(lower)
        level = min(levels) if levels else None
        if level is not None:
            (preferred_levels if importance == PREFERRED else required_levels).append(level)
            if _EQUIVALENT_EXPERIENCE.search(lower):
                accepts_equivalent = True

        words = lower.split()
        first_word = re.sub(r"[^a-z]", "", words[0]) if words else ""
        if 25 <= len(seg) <= 300:
            if section == "responsibilities":
                responsibilities.append(clip(seg, 300))
            elif first_word in _ACTION_VERBS:
                verb_fallback.append(clip(seg, 300))

        for token in tokens(lower):
            if token in STOPWORDS or len(token) < 4:
                continue
            key = stem(token)
            if key in _SKILL_STEMS:
                continue
            keyword_counts[key] += 1
            keyword_forms.setdefault(key, Counter())[token] += 1
            keyword_order.setdefault(key, len(keyword_order))

    min_years: Optional[int] = None
    max_years: Optional[int] = None
    if year_candidates:
        min_years, max_years = max(year_candidates, key=lambda pair: pair[0])
        if min_years == 0:
            min_years, max_years = None, None

    skill_list = [
        {
            "name": name,
            "kind": SKILLS_BY_NAME[name].kind,
            "importance": data["importance"],
            "mentions": data["mentions"],
            "context": data["context"],
        }
        for name, data in skills.items()
    ]
    skill_list.sort(key=lambda s: (_RANK[s["importance"]], -s["mentions"], s["name"]))

    cert_list = [{"name": name, **data} for name, data in certs.items()]
    cert_list.sort(key=lambda c: (_RANK[c["importance"]], c["name"]))

    frequent = [k for k, count in keyword_counts.items() if count >= 2]
    frequent.sort(key=lambda k: (-keyword_counts[k], keyword_order[k]))
    keywords = [
        {"term": keyword_forms[k].most_common(1)[0][0], "count": keyword_counts[k]} for k in frequent[:20]
    ]

    return {
        "minYears": min_years,
        "maxYears": max_years,
        "skills": skill_list,
        "certifications": cert_list,
        "education": {
            "requiredLevel": min(required_levels) if required_levels else None,
            "requiredLabel": EDUCATION_LABELS[min(required_levels)] if required_levels else None,
            "preferredLevel": min(preferred_levels) if preferred_levels else None,
            "preferredLabel": EDUCATION_LABELS[min(preferred_levels)] if preferred_levels else None,
            "acceptsEquivalentExperience": accepts_equivalent,
        },
        "responsibilities": (responsibilities or verb_fallback)[:15],
        "keywords": keywords,
    }
