"""Deterministic checks that a proposed rewrite adds nothing the resume does not already support.

These enforce the optimizer rules in code, so they hold even if a language model ignores its instructions:
no invented skills, numbers, certifications, degrees or names. A proposal that fails any check is discarded.
"""
from __future__ import annotations

import re
from typing import List

from app.scoring.jd_parser import education_levels
from app.scoring.skills import certifications_in, skills_in
from app.scoring.text_utils import normalize_text

_NUMBER = re.compile(r"\d[\d,.]*%?")
_CAPITALISED = re.compile(r"\b[A-Z][A-Za-z0-9&+#.-]{2,}\b")
_WORD = re.compile(r"[a-z0-9][a-z0-9&+#.-]*")


def _numbers(text: str) -> set:
    return {n.rstrip(".,") for n in _NUMBER.findall(text)}


def unsupported_additions(original: str, proposed: str, resume_text: str) -> List[str]:
    """Returns the reasons `proposed` is not supported by `original` and the rest of the resume (empty = safe)."""
    problems: List[str] = []
    base = normalize_text(f"{original}\n{resume_text}")
    new = normalize_text(proposed)

    base_numbers = _numbers(base)
    for number in sorted(_numbers(new) - base_numbers):
        problems.append(f"it adds the number {number}, which is not on your resume")

    supported_skills = set(skills_in(base))
    for skill in skills_in(new):
        if skill not in supported_skills:
            problems.append(f"it adds the skill {skill}, which is not on your resume")

    supported_certs = set(certifications_in(base))
    for cert in certifications_in(new):
        if cert not in supported_certs:
            problems.append(f"it adds the certification {cert}, which is not on your resume")

    if set(education_levels(new)) - set(education_levels(base)):
        problems.append("it adds a degree that is not on your resume")

    # Capitalised words in the middle of a sentence are usually names (employers, products, titles).
    known_words = set(_WORD.findall(base))
    for skill in supported_skills:
        known_words.update(_WORD.findall(skill.lower()))
    for match in _CAPITALISED.finditer(proposed):
        before = proposed[: match.start()].rstrip()
        if not before or before.endswith((".", "!", "?", ":")):
            continue  # first word of a sentence
        word = match.group().lower().rstrip(".")
        if word not in known_words:
            problems.append(f"it adds the name \"{match.group()}\", which is not on your resume")
    return problems
