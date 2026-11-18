"""PDF export of a resume document (reportlab).

The PDF uses the standard built-in fonts, so every page holds real, selectable text that applicant tracking
systems can read. Those fonts only cover Western European characters; anything outside that range is replaced
with "?" and reported as a warning (the DOCX export keeps every character).
"""
from __future__ import annotations

import io
import unicodedata
from typing import Any, Dict, List, Tuple
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate

from app.exports.layout import Rendered, ResumeLayout, build_layout

PAGE_SIZES = {"A4": A4, "LETTER": LETTER}

# Both templates are single column. They differ only in typeface and heading colour.
TEMPLATES: Dict[str, Dict[str, str]] = {
    "classic": {"body": "Times-Roman", "bold": "Times-Bold", "accent": "#111827", "rule": "#111827"},
    "modern": {"body": "Helvetica", "bold": "Helvetica-Bold", "accent": "#1e4fd8", "rule": "#c7d2fe"},
}

_SUBSTITUTES = {"\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2212": "-", "\u2192": "->"}


def to_standard_font_text(text: str) -> Tuple[str, int]:
    """Converts text to characters the standard PDF fonts can draw. Returns (text, number replaced)."""
    out: List[str] = []
    replaced = 0
    for char in unicodedata.normalize("NFC", text):
        char = _SUBSTITUTES.get(char, char)
        try:
            char.encode("cp1252")
        except UnicodeEncodeError:
            if unicodedata.category(char) in ("Mn", "Me", "Cf"):
                continue  # stray combining marks and zero-width characters have nothing to draw
            out.append("?")
            replaced += 1
        else:
            out.append(char)
    return "".join(out), replaced


def _styles(template: Dict[str, str]) -> Dict[str, ParagraphStyle]:
    ink = colors.HexColor("#111827")
    base = dict(fontName=template["body"], fontSize=10.5, leading=14, textColor=ink)
    return {
        "name": ParagraphStyle("name", fontName=template["bold"], fontSize=22, leading=26, textColor=colors.HexColor(template["accent"]), spaceAfter=3),
        "contact": ParagraphStyle("contact", **{**base, "fontSize": 10, "leading": 13, "textColor": colors.HexColor("#374151")}),
        "title": ParagraphStyle("title", fontName=template["bold"], fontSize=11, leading=14, textColor=colors.HexColor(template["accent"]), spaceBefore=12, spaceAfter=1),
        "body": ParagraphStyle("body", **base, spaceAfter=2),
        "bullet": ParagraphStyle("bullet", **base, leftIndent=14, bulletIndent=3, bulletFontName=template["body"], spaceAfter=2),
    }


def render_pdf(document: Dict[str, Any], *, template: str = "classic", page_size: str = "A4", title: str = "Resume") -> Rendered:
    layout: ResumeLayout = build_layout(document)
    theme = TEMPLATES.get(template, TEMPLATES["classic"])
    styles = _styles(theme)
    replaced_total = 0

    def paragraph(text: str, style: str, bullet: bool = False) -> Paragraph:
        nonlocal replaced_total
        safe, replaced = to_standard_font_text(text)
        replaced_total += replaced
        # Paragraph reads a small markup language, so resume text must be escaped or "<" and "&" would break or alter it.
        return Paragraph(escape(safe), styles[style], bulletText="\u2022" if bullet else None)

    story: List[Any] = []
    if layout.name:
        story.append(paragraph(layout.name, "name"))
    for line in layout.contact:
        story.append(paragraph(line, "contact"))

    for block in layout.blocks:
        items = [paragraph(line.text, "bullet" if line.bullet else "body", line.bullet) for line in block.lines]
        if block.title:
            heading = [
                paragraph(block.title.upper(), "title"),
                HRFlowable(width="100%", thickness=0.8, color=colors.HexColor(theme["rule"]), spaceBefore=1, spaceAfter=4),
            ]
            # A heading is never left alone at the bottom of a page.
            story.append(KeepTogether(heading + items[:1]))
            story.extend(items[1:])
        else:
            story.extend(items)

    safe_title, _ = to_standard_font_text(title)
    safe_author, _ = to_standard_font_text(layout.name)
    buffer = io.BytesIO()
    SimpleDocTemplate(
        buffer, pagesize=PAGE_SIZES.get(page_size, A4),
        leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
        title=safe_title, author=safe_author, subject="Resume", creator="ATS Resume Analyzer",
    ).build(story)

    warnings: List[str] = []
    if replaced_total:
        warnings.append(
            f"{replaced_total} character(s) the PDF font cannot show were replaced with \"?\". "
            "Use the DOCX download to keep every character."
        )
    return Rendered(buffer.getvalue(), warnings)
