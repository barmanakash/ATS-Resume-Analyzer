"""DOCX export of a resume document (python-docx).

Section titles use Word's real "Heading 1" style and bullets use the real list style, so applicant tracking systems
and screen readers see the structure. Single column, no tables, text boxes or images. Every Unicode character is
kept (unlike the PDF export, which is limited to the standard fonts).
"""
from __future__ import annotations

import io
from typing import Any, Dict

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Mm, Pt, RGBColor

from app.exports.layout import Rendered, ResumeLayout, build_layout

PAGE_SIZES_MM = {"A4": (210, 297), "LETTER": (215.9, 279.4)}

TEMPLATES: Dict[str, Dict[str, str]] = {
    "classic": {"font": "Times New Roman", "accent": "111827", "rule": "111827"},
    "modern": {"font": "Calibri", "accent": "1E4FD8", "rule": "C7D2FE"},
}

_THEME_FONT_ATTRIBUTES = ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme")
# Elements that must come after <w:pBdr> inside a paragraph's properties (order is fixed by the file format).
_AFTER_PARAGRAPH_BORDER = (
    "w:shd", "w:tabs", "w:suppressAutoHyphens", "w:kinsoku", "w:wordWrap", "w:overflowPunct", "w:topLinePunct",
    "w:autoSpaceDE", "w:autoSpaceDN", "w:bidi", "w:adjustRightInd", "w:snapToGrid", "w:spacing", "w:ind",
    "w:contextualSpacing", "w:mirrorIndents", "w:suppressOverlap", "w:jc", "w:textDirection", "w:textAlignment",
    "w:textboxTightWrap", "w:outlineLvl", "w:divId", "w:cnfStyle", "w:rPr", "w:sectPr", "w:pPrChange",
)


def _style_font(style, font_name: str, size: float, *, bold: bool = None, color: str = None) -> None:
    style.font.name = font_name
    style.font.size = Pt(size)
    if bold is not None:
        style.font.bold = bold
    if color:
        style.font.color.rgb = RGBColor.from_string(color)
    fonts = style.element.rPr.rFonts
    fonts.set(qn("w:eastAsia"), font_name)
    fonts.set(qn("w:cs"), font_name)
    # Built-in styles point at theme fonts, and Word prefers those over the name set above.
    for attribute in _THEME_FONT_ATTRIBUTES:
        if fonts.get(qn(attribute)) is not None:
            del fonts.attrib[qn(attribute)]


def _heading_rule(style, color: str) -> None:
    properties = style.element.get_or_add_pPr()
    border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    for key, value in (("w:val", "single"), ("w:sz", "6"), ("w:space", "1"), ("w:color", color)):
        bottom.set(qn(key), value)
    border.append(bottom)
    properties.insert_element_before(border, *_AFTER_PARAGRAPH_BORDER)


def render_docx(document: Dict[str, Any], *, template: str = "classic", page_size: str = "A4", title: str = "Resume") -> Rendered:
    layout: ResumeLayout = build_layout(document)
    theme = TEMPLATES.get(template, TEMPLATES["classic"])
    doc = Document()

    width, height = PAGE_SIZES_MM.get(page_size, PAGE_SIZES_MM["A4"])
    section = doc.sections[0]
    section.page_width, section.page_height = Mm(width), Mm(height)
    section.left_margin = section.right_margin = Mm(20)
    section.top_margin = section.bottom_margin = Mm(18)

    normal = doc.styles["Normal"]
    _style_font(normal, theme["font"], 10.5, color="111827")
    normal.paragraph_format.space_after = Pt(2)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.line_spacing = 1.1

    heading = doc.styles["Heading 1"]
    _style_font(heading, theme["font"], 11, bold=True, color=theme["accent"])
    heading.font.all_caps = True  # shown in capitals; the stored text keeps the resume's own wording
    heading.paragraph_format.space_before = Pt(12)
    heading.paragraph_format.space_after = Pt(4)
    heading.paragraph_format.keep_with_next = True
    _heading_rule(heading, theme["rule"])

    bullet = doc.styles["List Bullet"]
    _style_font(bullet, theme["font"], 10.5, color="111827")
    bullet.paragraph_format.space_after = Pt(2)

    if layout.name:
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.space_after = Pt(3)
        run = paragraph.add_run(layout.name)
        run.bold = True
        run.font.size = Pt(22)
        run.font.color.rgb = RGBColor.from_string(theme["accent"])
    for line in layout.contact:
        paragraph = doc.add_paragraph()
        run = paragraph.add_run(line)
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor.from_string("374151")

    for block in layout.blocks:
        if block.title:
            doc.add_paragraph(block.title, style="Heading 1")
        for line in block.lines:
            doc.add_paragraph(line.text, style="List Bullet" if line.bullet else "Normal")

    properties = doc.core_properties
    properties.title = title
    properties.author = layout.name
    properties.last_modified_by = ""
    properties.subject = "Resume"
    properties.comments = ""

    buffer = io.BytesIO()
    doc.save(buffer)
    return Rendered(buffer.getvalue(), [])
