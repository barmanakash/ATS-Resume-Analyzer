"""The structured resume document the optimizer edits.

A resume is a list of sections; each section is a list of items (one line or bullet each). Suggestions target a
single item, so accepting, rejecting and reverting one never touches the rest of the resume. The original text of
the resume is never modified: the optimizer works on a copy (a "version").
"""
from __future__ import annotations

import re
from typing import Any, Dict, Iterator, List, Optional, Tuple

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from app.core.exceptions import BadRequestError
from app.scoring.resume_profile import detect_sections, header_kind

BULLET_CHARS = "-*\u2022\u00b7\u25aa\u25cf\u2013\u2014"
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
MAX_TOTAL_CHARS = 100_000


def _clean(value: str) -> str:
    return _CONTROL.sub("", value)


class Item(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    text: str = Field(max_length=2000)
    bullet: bool = False

    @field_validator("text")
    @classmethod
    def _text(cls, value: str) -> str:
        return _clean(value)


class Section(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    key: str = Field(min_length=1, max_length=30)
    title: str = Field(default="", max_length=120)
    items: List[Item] = Field(default_factory=list, max_length=500)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        return _clean(value)


class Contact(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    email: Optional[str] = Field(default=None, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=60)
    location: Optional[str] = Field(default=None, max_length=200)


class ResumeDocument(BaseModel):
    version: int = 1
    contact: Contact = Field(default_factory=Contact)
    sections: List[Section] = Field(default_factory=list, max_length=60)

    @model_validator(mode="after")
    def _check(self):
        ids = [s.id for s in self.sections] + [i.id for s in self.sections for i in s.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Every section and line needs a unique id.")
        if sum(len(i.text) for s in self.sections for i in s.items) > MAX_TOTAL_CHARS:
            raise ValueError("The resume is too long.")
        return self


def validate_document(raw: Any) -> Dict[str, Any]:
    """Validates a resume document sent by a client and returns it in canonical form."""
    try:
        return ResumeDocument.model_validate(raw).model_dump()
    except ValidationError as exc:
        first = exc.errors()[0]
        where = ".".join(str(p) for p in first.get("loc", ()))
        message = str(first.get("msg", "Invalid resume content")).removeprefix("Value error, ")
        raise BadRequestError(f"Invalid resume content ({where}): {message}" if where else message, code="INVALID_RESUME_DOCUMENT")


def build_document(text: str, contact: Optional[dict] = None) -> Dict[str, Any]:
    """Splits extracted resume text into sections and items. Text is kept exactly; nothing is added or dropped
    except the bullet marker (kept as a flag) and blank lines."""
    contact = contact or {}
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    kinds = detect_sections(lines)

    sections: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    item_number = 0

    def start(key: str, title: str) -> Dict[str, Any]:
        section = {"id": f"s{len(sections) + 1}", "key": key, "title": title, "items": []}
        sections.append(section)
        return section

    for line, kind in zip(lines, kinds):
        is_bullet = line.startswith(tuple(BULLET_CHARS))
        header = None if is_bullet else header_kind(line)
        if header is not None:
            current = start(header, line.rstrip(":").strip())
            continue
        key = kind or "header"
        if current is None or current["key"] != key:
            current = start(key, "" if key == "header" else key.title())
        body = line.lstrip(BULLET_CHARS + " \t").strip() if is_bullet else line
        if not body:
            continue
        item_number += 1
        current["items"].append({"id": f"i{item_number}", "text": _clean(body)[:2000], "bullet": is_bullet})

    first = lines[0] if lines else ""
    name = first if first and len(first) <= 60 and "@" not in first and not re.search(r"\d{3}", first) and header_kind(first) is None else None
    email_match = _EMAIL.search(text or "")
    return {
        "version": 1,
        "contact": {
            "name": name,
            "email": contact.get("email") or (email_match.group() if email_match else None),
            "phone": contact.get("phone"),
            "location": None,
        },
        "sections": sections,
    }


def iter_items(doc: Dict[str, Any]) -> Iterator[Tuple[Dict[str, Any], Dict[str, Any]]]:
    for section in doc.get("sections", []):
        for item in section.get("items", []):
            yield section, item


def find_item(doc: Dict[str, Any], item_id: Optional[str]) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
    for section, item in iter_items(doc):
        if item["id"] == item_id:
            return section, item
    return None


def set_item_text(doc: Dict[str, Any], item_id: str, text: str) -> bool:
    found = find_item(doc, item_id)
    if not found:
        return False
    found[1]["text"] = text
    return True


def document_text(doc: Dict[str, Any]) -> str:
    """Plain-text rendering, used for preview and as the source text for safety checks."""
    out: List[str] = []
    for section in doc.get("sections", []):
        if section.get("title"):
            out.append(section["title"])
        for item in section.get("items", []):
            out.append(("- " if item.get("bullet") else "") + item["text"])
        out.append("")
    return "\n".join(out).strip()
