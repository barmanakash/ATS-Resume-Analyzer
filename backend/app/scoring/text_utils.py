"""Text helpers shared by the scoring modules. Pure functions, no I/O."""
from __future__ import annotations

import re
from typing import List, Set

_DASHES = str.maketrans({
    "\u2013": "-", "\u2014": "-", "\u2212": "-", "\u2022": "-", "\u25cf": "-", "\u25aa": "-", "\u00a0": " ",
    "\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"',
})

TOKEN_RE = re.compile(r"[a-z][a-z0-9+#]*")

# Words that carry no matching signal in job descriptions or resumes.
STOPWORDS: Set[str] = {
    "a", "about", "above", "across", "after", "again", "all", "also", "am", "an", "and", "any", "are", "as", "at",
    "be", "because", "been", "before", "being", "between", "both", "but", "by", "can", "could", "did", "do", "does",
    "during", "each", "etc", "few", "for", "from", "had", "has", "have", "having", "he", "her", "here", "his", "how",
    "i", "if", "in", "including", "into", "is", "it", "its", "just", "may", "me", "more", "most", "must", "my", "new",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "our", "out", "over", "own", "per", "same",
    "she", "should", "so", "some", "such", "than", "that", "the", "their", "them", "then", "there", "these", "they",
    "this", "those", "through", "to", "too", "under", "until", "up", "us", "use", "used", "using", "very", "was",
    "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with", "within", "would",
    "you", "your", "yours",
    # Job-posting boilerplate
    "ability", "able", "applicant", "applicants", "available", "candidate", "candidates", "company", "demonstrated",
    "describe", "description", "detail", "duties", "environment", "equal", "excellent", "experience", "experienced",
    "good", "great", "hiring", "ideal", "ideally", "impact", "join", "knowledge", "looking", "must", "need", "needs",
    "opportunity", "passion", "passionate", "plus", "position", "preferred", "proven", "required", "requirement",
    "requirements", "responsibilities", "responsibility", "responsible", "role", "skill", "skills", "strong",
    "successful", "team", "teams", "understanding", "want", "work", "working", "year", "years", "yrs", "well",
    "ensure", "etc", "like", "make", "many", "much", "need", "provide", "related", "relevant", "support", "various",
}


def normalize_text(text: str) -> str:
    """Lower-cases and maps typographic dashes and bullets to ASCII. Keeps newlines (line structure matters)."""
    return (text or "").translate(_DASHES).lower()


def stem(word: str) -> str:
    """A small, deterministic suffix stripper (managed/manages/managing -> manag). Good enough for overlap checks."""
    w = word
    if len(w) <= 3:
        return w
    if w.endswith("ies") and len(w) > 4:
        w = w[:-3] + "y"
    elif w.endswith("ing") and len(w) > 5:
        w = w[:-3]
    elif w.endswith("ed") and len(w) > 4:
        w = w[:-2]
    elif w.endswith("es") and len(w) > 4 and w[:-2].endswith(("s", "x", "z", "ch", "sh")):
        w = w[:-2]
    elif w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        w = w[:-1]
    if w.endswith("e") and len(w) > 3:
        w = w[:-1]
    return w


def tokens(text: str) -> List[str]:
    return TOKEN_RE.findall(normalize_text(text))


def content_stems(text: str, min_len: int = 3) -> Set[str]:
    """Stems of the meaningful words in `text` (stop words and very short words removed)."""
    return {stem(t) for t in tokens(text) if t not in STOPWORDS and len(t) >= min_len}


def clip(text: str, limit: int = 220) -> str:
    """Single-line, length-limited snippet for evidence display."""
    flat = re.sub(r"\s+", " ", text or "").strip()
    return flat if len(flat) <= limit else flat[: limit - 1].rstrip() + "\u2026"


def years_between(months: float) -> float:
    return round(months / 12.0, 1)
