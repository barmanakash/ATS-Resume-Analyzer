"""Turns the structured resume document into one plain, single-column layout that both exporters draw.

Single column, real text, standard headings and no tables, images or text boxes: this is what applicant tracking
systems read most reliably. The resume's wording is never changed here; text is only cleaned of characters that
cannot be stored in the output files.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Dict, List

# Control characters, lone surrogates and non-characters: invalid in XML (DOCX) and meaningless in a resume.
_INVALID = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ud800-\udfff\ufffe\uffff]")
_SPACES = re.compile(r"[ \t\u00a0]+")
_DIGIT_RUN = re.compile(r"\d{3}")

MAX_NAME_CHARS = 60


def clean_text(value: Any) -> str:
    text = _INVALID.sub("", str(value or ""))
    return _SPACES.sub(" ", text).strip()


@dataclass
class Line:
    text: str
    bullet: bool = False


@dataclass
class Block:
    title: str  # empty for text that has no heading
    lines: List[Line]


@dataclass
class ResumeLayout:
    name: str = ""
    contact: List[str] = field(default_factory=list)
    blocks: List[Block] = field(default_factory=list)

    @property
    def is_empty(self) -> bool:
        return not self.name and not self.contact and not self.blocks


@dataclass
class Rendered:
    content: bytes
    warnings: List[str] = field(default_factory=list)


def _looks_like_name(line: str) -> bool:
    return 0 < len(line) <= MAX_NAME_CHARS and "@" not in line and not _DIGIT_RUN.search(line)


def build_layout(document: Dict[str, Any]) -> ResumeLayout:
    """Header lines are the first run of untitled 'header' sections (name and contact details)."""
    header: List[str] = []
    blocks: List[Block] = []
    in_header = True

    for section in (document or {}).get("sections", []):
        lines = [
            Line(clean_text(item.get("text")), bool(item.get("bullet")))
            for item in section.get("items", [])
            if clean_text(item.get("text"))
        ]
        if section.get("key") == "header" and in_header:
            header.extend(line.text for line in lines)
            continue
        in_header = False
        if not lines:
            continue
        title = clean_text(section.get("title")) or str(section.get("key") or "").replace("_", " ").title()
        # Text that landed in a 'header' section after real sections belongs where it is, without a heading.
        blocks.append(Block("" if section.get("key") == "header" else title, lines))

    contact = (document or {}).get("contact") or {}
    contact_name = clean_text(contact.get("name"))
    if header:
        first = header[0]
        is_name = bool(contact_name and first == contact_name) or _looks_like_name(first)
        name, contact_lines = (first, header[1:]) if is_name else ("", header)
    else:
        # Nothing was detected at the top of the resume, so fall back to the stored contact details.
        name = contact_name
        details = [clean_text(contact.get(key)) for key in ("email", "phone", "location")]
        contact_lines = [" | ".join(d for d in details if d)] if any(details) else []

    return ResumeLayout(name=name, contact=contact_lines, blocks=blocks)


def suggest_filename(layout: ResumeLayout, extension: str) -> str:
    """ASCII-only file name such as Jane_Doe_Resume.pdf (safe in a download header). Accents are dropped: José -> Jose."""
    ascii_name = unicodedata.normalize("NFKD", layout.name).encode("ascii", "ignore").decode("ascii")
    stem = re.sub(r"[^A-Za-z0-9]+", "_", ascii_name).strip("_")[:50]
    return f"{stem + '_' if stem else ''}Resume.{extension}"
