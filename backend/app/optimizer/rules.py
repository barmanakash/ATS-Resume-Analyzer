"""Rule-based resume suggestions (no AI).

Every suggestion here either rewords or reorders text that is already on the resume, or is a note about a gap.
Nothing adds a skill, employer, title, number or certification the candidate did not already state.
"""
from __future__ import annotations

import re
from copy import deepcopy
from typing import Any, Dict, List, Optional

from app.optimizer.document import iter_items, set_item_text
from app.optimizer.guards import unsupported_additions
from app.scoring.skills import SKILLS_BY_NAME, skills_in
from app.scoring.text_utils import normalize_text

RANK = {"MANDATORY": 0, "PREFERRED": 1, "OPTIONAL": 2}
MAX_GAP_NOTES = 12

# Spelling a job description is likely to use for something a resume may abbreviate. Only applied when the
# job names the canonical term, and only to a term the candidate already wrote.
TERM_ALIGNMENT: Dict[str, str] = {
    "js": "JavaScript", "postgres": "PostgreSQL", "k8s": "Kubernetes", "mongo": "MongoDB", "gcp": "Google Cloud",
    "reactjs": "React", "react.js": "React", "nodejs": "Node.js", "node js": "Node.js", "vuejs": "Vue.js",
    "sklearn": "scikit-learn", "scikit learn": "scikit-learn", "powerbi": "Power BI", "cicd": "CI/CD",
    "mssql": "SQL Server", "golang": "Go", "springboot": "Spring Boot", "dotnet": ".NET", "genai": "Generative AI",
    "llm": "LLMs", "expressjs": "Express.js", "nextjs": "Next.js", "angularjs": "Angular",
    "amazon web services": "AWS", "ab testing": "A/B Testing", "search engine optimization": "SEO",
    "natural language processing": "NLP",
}
_ALIGN_PATTERNS = {
    alias: re.compile(r"(?<![a-z0-9+#.])" + re.escape(alias).replace(r"\ ", r"[\s-]+") + r"(?![a-z0-9+#])", re.IGNORECASE)
    for alias in TERM_ALIGNMENT
}

# "Responsible for managing X" -> "Managed X": same meaning, stronger opening.
_WEAK_OPENER = re.compile(r"^(?:was |were )?(?:responsible for|tasked with|in charge of)\s+([a-z]+ing)\b(.*)$", re.IGNORECASE | re.DOTALL)
_GERUND_TO_PAST = {
    "managing": "Managed", "building": "Built", "developing": "Developed", "designing": "Designed", "leading": "Led",
    "creating": "Created", "implementing": "Implemented", "maintaining": "Maintained", "testing": "Tested",
    "writing": "Wrote", "analyzing": "Analyzed", "analysing": "Analysed", "coordinating": "Coordinated",
    "handling": "Handled", "supporting": "Supported", "monitoring": "Monitored", "deploying": "Deployed",
    "delivering": "Delivered", "optimizing": "Optimized", "optimising": "Optimised", "training": "Trained",
    "preparing": "Prepared", "planning": "Planned", "reviewing": "Reviewed", "overseeing": "Oversaw",
    "running": "Ran", "owning": "Owned",
}
_LABEL = re.compile(r"^([A-Za-z][A-Za-z &/]{1,30}:\s*)(.*)$", re.DOTALL)
_WORDING_SECTIONS = {"experience", "projects", "achievements", "summary", "other"}


def _suggestion(
    category: str, original: str, proposed: Optional[str], reason: str, *, item_id: Optional[str] = None,
    section_key: Optional[str] = None, related: Optional[str] = None, status: str, confidence: Optional[float] = None,
) -> Dict[str, Any]:
    return {
        "category": category, "itemId": item_id, "sectionKey": section_key, "original": original, "proposed": proposed,
        "reason": reason, "relatedRequirement": related, "evidenceStatus": status, "confidence": confidence,
        "source": "rules",
    }


def _contains_term(text_lower: str, term_lower: str) -> bool:
    return re.search(r"(?<![a-z0-9+#.])" + re.escape(term_lower) + r"(?![a-z0-9+#])", text_lower) is not None


def _terminology(document: dict, jd_names: set) -> List[Dict[str, Any]]:
    out = []
    for section, item in iter_items(document):
        if section["key"] == "header":
            continue
        text, new, used = item["text"], item["text"], []
        for alias, canonical in TERM_ALIGNMENT.items():
            if canonical not in jd_names or canonical not in SKILLS_BY_NAME or alias not in SKILLS_BY_NAME[canonical].aliases:
                continue
            if _contains_term(new.lower(), canonical.lower()):
                continue
            replaced, count = _ALIGN_PATTERNS[alias].subn(canonical, new)
            if count:
                new = replaced
                used.append((alias, canonical))
        if new != text:
            terms = ", ".join(f"\"{c}\" (you wrote \"{a}\")" for a, c in used)
            out.append(_suggestion(
                "terminology", text, new,
                f"The job description uses {terms}. Using the same wording helps keyword matching. "
                "It is the same technology you already mention.",
                item_id=item["id"], section_key=section["key"], related=", ".join(c for _, c in used),
                status="SUPPORTED_BY_RESUME", confidence=0.9,
            ))
    return out


def _split_list(text: str):
    label_match = _LABEL.match(text)
    label, body = (label_match.group(1), label_match.group(2)) if label_match else ("", text)
    counts = {d: body.count(d) for d in (",", "|", ";")}
    delimiter = max(counts, key=counts.get)
    if counts[delimiter] < 2:
        return None
    parts = [p.strip() for p in body.split(delimiter)]
    if any(not p for p in parts):
        return None
    return label, delimiter, parts


def _skills_order(document: dict, jd_rank: Dict[str, int]) -> List[Dict[str, Any]]:
    out = []
    for section, item in iter_items(document):
        if section["key"] != "skills":
            continue
        split = _split_list(item["text"])
        if not split:
            continue
        label, delimiter, parts = split

        def rank(part: str) -> int:
            ranks = [jd_rank[n] for n in skills_in(normalize_text(part)) if n in jd_rank]
            return min(ranks) if ranks else 3

        order = sorted(range(len(parts)), key=lambda i: (rank(parts[i]), i))
        if order == list(range(len(parts))):
            continue
        separator = {",": ", ", "|": " | ", ";": "; "}[delimiter]
        proposed = label + separator.join(parts[i] for i in order)
        out.append(_suggestion(
            "skills_order", item["text"], proposed,
            "Puts the skills this job asks for first, so they are seen first. The same skills are listed; only the order changes.",
            item_id=item["id"], section_key=section["key"], status="SUPPORTED_BY_RESUME", confidence=0.95,
        ))
    return out


def _wording(document: dict) -> List[Dict[str, Any]]:
    out = []
    for section, item in iter_items(document):
        if section["key"] not in _WORDING_SECTIONS:
            continue
        match = _WEAK_OPENER.match(item["text"])
        past = _GERUND_TO_PAST.get(match.group(1).lower()) if match else None
        if not past:
            continue
        out.append(_suggestion(
            "wording", item["text"], past + match.group(2),
            "Starts with a strong action verb instead of \"Responsible for\". The meaning is unchanged.",
            item_id=item["id"], section_key=section["key"], status="WORDING_ONLY", confidence=0.85,
        ))
    return out


def _gap_notes(analysis: dict) -> List[Dict[str, Any]]:
    notes: List[Dict[str, Any]] = []
    for req in analysis.get("requirements", []):
        name, status, importance, kind = req.get("requirement"), req.get("status"), req.get("importance"), req.get("kind")
        if kind not in ("skill", "certification", "experience", "education"):
            continue
        if importance == "MANDATORY" and status == "NOT_FOUND":
            if kind == "experience":
                text = (
                    f"The job asks for {name}. Your resume shows less. Nothing is added here: describe your most relevant "
                    "work, including internships and projects, and state your experience accurately."
                )
            elif kind == "education":
                text = (
                    f"The job asks for: {name}. Your resume does not show it, so nothing is added here. "
                    "If you hold a qualification that is missing from your Education section, add it there. "
                    "If not, this is a gap that the rest of your resume has to outweigh."
                )
            else:
                text = (
                    f"The job requires {name}, but it was not found in your resume, so no change is suggested. "
                    "If you have this experience, add it yourself where you used it. If you do not, it is a genuine gap: "
                    "a course or project can close it, but it should not be added to a resume until it is true."
                )
            notes.append(_suggestion("gap", name, None, text, related=name, status="GAP_NOT_SUPPORTED"))
        elif status == "PARTIAL_MATCH" and kind == "skill":
            notes.append(_suggestion(
                "gap", name, None,
                f"{req.get('explanation', '')} Add the exact term only if you have actually used it.".strip(),
                related=name, status="GAP_NOT_SUPPORTED",
            ))
        elif status == "MATCHED" and importance == "MANDATORY" and kind == "skill" and req.get("evidenceSection") == "skills":
            notes.append(_suggestion(
                "evidence", name, None,
                f"{name} appears only in your skills list. If you used it in a job or project, mention it in that bullet "
                "so the claim has evidence.",
                related=name, status="SUPPORTED_BY_RESUME",
            ))
    return notes[:MAX_GAP_NOTES]


def generate(document: dict, analysis: dict, resume_text: str) -> List[Dict[str, Any]]:
    """All rule-based suggestions for a document. Every text change is re-checked by the safety guards.

    Each line gets at most one suggestion: rules run in sequence on a working copy, and when several apply to the
    same line their effects are combined into one proposal. (Two separate suggestions for one line could not both
    be accepted, because accepting the first changes the text the second was written against.)"""
    jd_skills = analysis.get("extractedRequirements", {}).get("skills", [])
    jd_rank = {s["name"]: RANK.get(s.get("importance"), 3) for s in jd_skills}
    jd_names = set(jd_rank)

    by_line: Dict[str, Dict[str, Any]] = {}
    working = deepcopy(document)
    for s in _terminology(document, jd_names):
        by_line[s["itemId"]] = s
        set_item_text(working, s["itemId"], s["proposed"])
    for s in _skills_order(working, jd_rank) + _wording(working):
        existing = by_line.get(s["itemId"])
        if existing:
            existing["proposed"] = s["proposed"]
            existing["reason"] = f"{existing['reason']} {s['reason']}"
        else:
            by_line[s["itemId"]] = s

    safe = [s for s in by_line.values() if not unsupported_additions(s["original"], s["proposed"], resume_text)]
    return safe + _gap_notes(analysis)
