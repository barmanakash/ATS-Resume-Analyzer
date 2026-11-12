"""Upload validation and text extraction for PDF, DOCX and plain-text documents.

Error messages raised from here are written to be shown to end users, so they never include
library internals or document content.
"""
from __future__ import annotations

import re
import unicodedata
import zipfile
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Iterable, Optional

from app.core.exceptions import BadRequestError

MAX_PDF_PAGES = 20
MAX_TEXT_CHARS = 100_000
MIN_READABLE_CHARS = 80  # fewer characters than this in a PDF usually means a scanned image
MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024  # zip-bomb guard
MAX_DOCX_ENTRIES = 2000

_CONTENT_TYPES = {
    "pdf": {"application/pdf", "application/x-pdf"},
    "docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    "txt": {"text/plain"},
}
# Browsers sometimes send a generic type; the file signature check below is the real gate.
_GENERIC_TYPES = {"", "application/octet-stream", "binary/octet-stream"}


class DocumentExtractionError(Exception):
    """The file was accepted but its text could not be extracted."""

    def __init__(self, message: str, code: str = "UNREADABLE_DOCUMENT"):
        self.message = message
        self.code = code
        super().__init__(message)


@dataclass
class ExtractionResult:
    text: str
    page_count: Optional[int] = None


def sanitize_filename(name: str, fallback: str = "document") -> str:
    base = Path((name or "").replace("\\", "/")).name
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip().strip(".")
    return base[:150] or fallback


def validate_upload(filename: str, content_type: Optional[str], content: bytes, allowed: Iterable[str]) -> str:
    """Checks extension, declared MIME type and the real file signature. Returns the file type."""
    allowed = set(allowed)
    extension = Path(filename or "").suffix.lower().lstrip(".")
    if extension not in allowed:
        readable = " and ".join(t.upper() for t in sorted(allowed))
        raise BadRequestError(f"Only {readable} files are supported.", code="UNSUPPORTED_FILE_TYPE")
    if not content:
        raise BadRequestError("The uploaded file is empty.", code="EMPTY_FILE")

    declared = (content_type or "").split(";")[0].strip().lower()
    if declared not in _GENERIC_TYPES and declared not in _CONTENT_TYPES[extension]:
        raise BadRequestError("The file content type does not match its extension.", code="FILE_TYPE_MISMATCH")

    if extension == "pdf":
        if b"%PDF-" not in content[:1024]:
            raise BadRequestError("This file is not a valid PDF.", code="INVALID_FILE")
    elif extension == "docx":
        _check_docx_signature(content)
    elif extension == "txt":
        sample = content[:4096]
        if b"\x00" in sample:
            raise BadRequestError("This file is not a valid text document.", code="INVALID_FILE")
    return extension


def _check_docx_signature(content: bytes) -> None:
    invalid = BadRequestError("This file is not a valid DOCX document.", code="INVALID_FILE")
    if not content.startswith(b"PK"):
        raise invalid
    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            infos = archive.infolist()
            if len(infos) > MAX_DOCX_ENTRIES or sum(i.file_size for i in infos) > MAX_DOCX_UNCOMPRESSED_BYTES:
                raise BadRequestError("This document is too complex to process.", code="INVALID_FILE")
            if "word/document.xml" not in {i.filename for i in infos}:
                raise invalid
    except zipfile.BadZipFile:
        raise invalid


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\u00a0", " ")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:MAX_TEXT_CHARS]


def extract_text(file_type: str, content: bytes) -> ExtractionResult:
    if file_type == "pdf":
        return _extract_pdf(content)
    if file_type == "docx":
        return _extract_docx(content)
    if file_type == "txt":
        text = normalize_text(content.decode("utf-8", errors="replace"))
        if not text:
            raise DocumentExtractionError("The document does not contain any readable text.")
        return ExtractionResult(text=text)
    raise DocumentExtractionError("Unsupported document type.", code="UNSUPPORTED_FILE_TYPE")


def _extract_pdf(content: bytes) -> ExtractionResult:
    unreadable = DocumentExtractionError("We could not read this PDF. It may be corrupted.")
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(content), strict=False)
        if reader.is_encrypted:
            try:
                if not reader.decrypt(""):
                    raise DocumentExtractionError(
                        "This PDF is password-protected. Remove the password and upload it again.",
                        code="PASSWORD_PROTECTED",
                    )
            except DocumentExtractionError:
                raise
            except Exception:
                raise DocumentExtractionError(
                    "This PDF is password-protected. Remove the password and upload it again.",
                    code="PASSWORD_PROTECTED",
                )
        total_pages = len(reader.pages)
        parts = []
        for page in reader.pages[:MAX_PDF_PAGES]:
            parts.append(page.extract_text() or "")
    except DocumentExtractionError:
        raise
    except Exception:
        raise unreadable

    text = normalize_text("\n".join(parts))
    if len(re.sub(r"\s", "", text)) < MIN_READABLE_CHARS:
        raise DocumentExtractionError(
            "This PDF looks like a scanned image with no selectable text. "
            "Please upload a text-based PDF or a DOCX version of your resume.",
            code="SCANNED_PDF",
        )
    return ExtractionResult(text=text, page_count=total_pages)


def _extract_docx(content: bytes) -> ExtractionResult:
    try:
        from docx import Document
        from docx.table import Table
        from docx.text.paragraph import Paragraph

        document = Document(BytesIO(content))
        lines = []
        # Walk the body in order so text inside tables (common in resume templates) keeps its position.
        for child in document.element.body.iterchildren():
            tag = child.tag.rsplit("}", 1)[-1]
            if tag == "p":
                lines.append(Paragraph(child, document).text)
            elif tag == "tbl":
                for row in Table(child, document).rows:
                    cells = []
                    for cell in row.cells:
                        value = cell.text.strip()
                        if value and value not in cells:  # merged cells repeat their text
                            cells.append(value)
                    if cells:
                        lines.append(" | ".join(cells))
    except Exception:
        raise DocumentExtractionError("We could not read this DOCX file. It may be corrupted.")

    text = normalize_text("\n".join(lines))
    if len(re.sub(r"\s", "", text)) < 20:
        raise DocumentExtractionError("The document does not contain any readable text.")
    return ExtractionResult(text=text)
