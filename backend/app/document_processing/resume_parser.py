from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"(?<![\d])(\+?\d[\d\s().-]{7,}\d)(?![\d])")

# Canonical section name -> accepted headings (matched against a whole, short line).
_SECTION_HEADINGS = {
    "summary": {"summary", "professional summary", "profile", "objective", "career objective", "about me", "about"},
    "experience": {
        "experience", "work experience", "professional experience", "employment history", "work history",
        "employment", "internships", "internship",
    },
    "education": {"education", "academic background", "academics", "education and training", "qualifications"},
    "skills": {"skills", "technical skills", "core skills", "key skills", "skills and tools", "technologies"},
    "projects": {"projects", "personal projects", "academic projects", "key projects"},
    "certifications": {"certifications", "certificates", "licenses", "licenses and certifications"},
    "achievements": {"achievements", "awards", "accomplishments", "honors", "awards and achievements"},
}


def _first_phone(text: str) -> Optional[str]:
    for match in _PHONE_RE.finditer(text):
        candidate = match.group(1).strip()
        digits = re.sub(r"\D", "", candidate)
        if 9 <= len(digits) <= 15:
            return candidate
    return None


def detect_sections(text: str) -> List[str]:
    found: List[str] = []
    for line in (text or "").split("\n"):
        heading = re.sub(r"[:\-–—_*#|]+", " ", line).strip().lower()
        heading = re.sub(r"\s+", " ", heading)
        if not heading or len(heading) > 40:
            continue
        for name, variants in _SECTION_HEADINGS.items():
            if heading in variants and name not in found:
                found.append(name)
    return found


def extract_basic_info(text: str, page_count: Optional[int] = None) -> Dict[str, Any]:
    """Facts that can be read directly from the text. Nothing here is inferred or guessed."""
    email = _EMAIL_RE.search(text or "")
    return {
        "email": email.group(0) if email else None,
        "phone": _first_phone(text or ""),
        "wordCount": len(re.findall(r"\S+", text or "")),
        "pageCount": page_count,
        "sectionsDetected": detect_sections(text or ""),
    }
