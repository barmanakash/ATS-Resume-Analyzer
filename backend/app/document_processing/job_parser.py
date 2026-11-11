from __future__ import annotations

import re
from typing import Dict, List


def extract_job_metadata(text: str) -> Dict[str, any]:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    words = re.findall(r"[A-Za-z0-9+#.]+", cleaned)
    normalized = cleaned.lower()

    keyword_pool = {
        "python",
        "sql",
        "aws",
        "javascript",
        "react",
        "node",
        "fastapi",
        "mongodb",
        "postgresql",
        "excel",
        "docker",
        "kubernetes",
        "agile",
        "leadership",
        "communication",
        "api",
        "data",
        "analytics",
        "product",
        "customer",
    }

    keywords: List[str] = []
    for word in keyword_pool:
        if word in normalized:
            keywords.append(word)

    return {
        "wordCount": len(words),
        "summary": cleaned[:500] if cleaned else "",
        "keywords": sorted(set(keywords + re.findall(r"[A-Za-z][A-Za-z+#.]{2,}", normalized)))[:50],
    }
