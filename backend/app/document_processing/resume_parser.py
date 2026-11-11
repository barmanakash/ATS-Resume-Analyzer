from __future__ import annotations

import re
from typing import Dict, List


def extract_resume_metadata(text: str) -> Dict[str, any]:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    words = re.findall(r"[A-Za-z0-9+#.]+", cleaned)
    normalized = (cleaned or "").lower()
    summary = cleaned[:500] if cleaned else ""

    keyword_pool = {
        "python",
        "sql",
        "excel",
        "aws",
        "docker",
        "kubernetes",
        "java",
        "javascript",
        "react",
        "node",
        "fastapi",
        "mongodb",
        "postgresql",
        "rest",
        "api",
        "teamwork",
        "leadership",
        "communication",
        "project",
        "data",
        "analytics",
        "machine learning",
        "product",
        "sales",
        "marketing",
        "business",
        "customer",
        "tableau",
        "power bi",
        "excel",
        "jira",
        "agile",
    }

    skills: List[str] = []
    for word in keyword_pool:
        if word in normalized:
            skills.append(word)

    experience_match = re.search(r"(\d+(?:\.\d+)?)\s*(\+?)\s*(?:years?|yrs?)\s*(?:of\s*)?experience", normalized)
    years = None
    if experience_match:
        years = float(experience_match.group(1))

    return {
        "wordCount": len(words),
        "summary": summary,
        "keywords": skills[:20],
        "hasPhone": bool(re.search(r"\+?\d[\d\s().-]{7,}\d", cleaned)),
        "hasEmail": bool(re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", cleaned)),
        "experienceYears": years,
    }
