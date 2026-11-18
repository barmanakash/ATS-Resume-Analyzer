"""Tests for the PDF and DOCX renderers. No database or network: documents in, files out."""
import io
import re

from docx import Document
from pypdf import PdfReader

from app.exports.docx_export import render_docx
from app.exports.layout import ResumeLayout, build_layout, clean_text, suggest_filename
from app.exports.pdf_export import render_pdf, to_standard_font_text


def item(number, text, bullet=False):
    return {"id": f"i{number}", "text": text, "bullet": bullet}


RESUME = {
    "version": 1,
    "contact": {"name": "Jane Doe", "email": "jane.doe@example.com", "phone": "+1 415 555 0134", "location": None},
    "sections": [
        {"id": "s1", "key": "header", "title": "", "items": [item(1, "Jane Doe"), item(2, "jane.doe@example.com | +1 415 555 0134")]},
        {"id": "s2", "key": "summary", "title": "Summary", "items": [item(3, "Backend engineer who builds APIs and data services.")]},
        {"id": "s3", "key": "experience", "title": "Experience", "items": [
            item(4, "Backend Developer, Acme Corp (Jan 2019 - Present)"),
            item(5, "Built REST APIs in Python serving 2M requests per day", True),
            item(6, "Optimized MySQL queries, cutting latency by 40%", True),
        ]},
        {"id": "s4", "key": "skills", "title": "Skills", "items": [item(7, "Python, SQL, MySQL, Docker")]},
    ],
}


def pdf_text(content: bytes) -> str:
    return "\n".join(page.extract_text() for page in PdfReader(io.BytesIO(content)).pages)


def docx_doc(content: bytes) -> Document:
    return Document(io.BytesIO(content))


# ------------------------------------------------------------------ layout

def test_layout_separates_name_contact_and_sections():
    layout = build_layout(RESUME)
    assert layout.name == "Jane Doe"
    assert layout.contact == ["jane.doe@example.com | +1 415 555 0134"]
    assert [b.title for b in layout.blocks] == ["Summary", "Experience", "Skills"]
    assert [line.bullet for line in layout.blocks[1].lines] == [False, True, True]


def test_layout_falls_back_to_stored_contact_details_when_the_top_of_the_resume_was_not_detected():
    layout = build_layout({"contact": {"name": "Sam Lee", "email": "sam@example.com", "phone": "555 0100"}, "sections": [
        {"id": "s1", "key": "skills", "title": "Skills", "items": [item(1, "Go")]},
    ]})
    assert layout.name == "Sam Lee"
    assert layout.contact == ["sam@example.com | 555 0100"]


def test_layout_does_not_mistake_a_contact_line_for_the_name():
    layout = build_layout({"contact": {}, "sections": [
        {"id": "s1", "key": "header", "title": "", "items": [item(1, "sam@example.com | 555 0100")]},
    ]})
    assert layout.name == ""
    assert layout.contact == ["sam@example.com | 555 0100"]


def test_untitled_text_after_real_sections_stays_in_place_without_a_heading():
    layout = build_layout({"contact": {}, "sections": [
        {"id": "s1", "key": "header", "title": "", "items": [item(1, "Jane Doe")]},
        {"id": "s2", "key": "skills", "title": "Skills", "items": [item(2, "Python")]},
        {"id": "s3", "key": "header", "title": "", "items": [item(3, "Stray line")]},
    ]})
    assert layout.name == "Jane Doe"
    assert [(b.title, [l.text for l in b.lines]) for b in layout.blocks] == [("Skills", ["Python"]), ("", ["Stray line"])]


def test_clean_text_removes_invalid_characters_and_tidies_spaces():
    assert clean_text("bad\x00char\x1f  with\u00a0\u00a0spaces \ud800") == "badchar with spaces"
    assert clean_text(None) == ""


def test_empty_resume_is_detected():
    assert build_layout({"contact": {}, "sections": []}).is_empty
    assert build_layout({"contact": {}, "sections": [{"id": "s", "key": "skills", "title": "Skills", "items": [item(1, "  ")]}]}).is_empty


def test_filenames_are_plain_ascii():
    cases = {"Jane Doe": "Jane_Doe_Resume.pdf", "José Müller": "Jose_Muller_Resume.pdf", "": "Resume.pdf",
             "राहुल": "Resume.pdf", "A/B\\C:*?": "A_B_C_Resume.pdf"}
    for name, expected in cases.items():
        assert suggest_filename(ResumeLayout(name=name), "pdf") == expected, name
    assert re.fullmatch(r"[A-Za-z0-9_.]+", suggest_filename(ResumeLayout(name="x" * 200), "docx"))


# ------------------------------------------------------------------ PDF

def test_pdf_is_a_real_pdf_with_selectable_text_in_reading_order():
    rendered = render_pdf(RESUME)
    assert rendered.content.startswith(b"%PDF")
    text = pdf_text(rendered.content)
    order = ["Jane Doe", "jane.doe@example.com", "SUMMARY", "EXPERIENCE", "Built REST APIs", "SKILLS", "Python, SQL"]
    positions = [text.index(part) for part in order]
    assert positions == sorted(positions)
    assert "2M requests per day" in text


def test_pdf_page_size_and_metadata():
    a4 = PdfReader(io.BytesIO(render_pdf(RESUME, page_size="A4", title="My CV").content))
    letter = PdfReader(io.BytesIO(render_pdf(RESUME, page_size="LETTER").content))
    assert round(float(a4.pages[0].mediabox.width)) == 595
    assert round(float(letter.pages[0].mediabox.width)) == 612
    assert a4.metadata.title == "My CV"
    assert a4.metadata.author == "Jane Doe"


def test_pdf_text_is_escaped_so_markup_in_a_resume_is_printed_literally():
    document = {"contact": {}, "sections": [{"id": "s", "key": "skills", "title": "Skills", "items": [
        item(1, "Built <b>bold</b> & <script>alert(1)</script> tools"),
    ]}]}
    assert "Built <b>bold</b> & <script>alert(1)</script> tools" in pdf_text(render_pdf(document).content)


def test_pdf_keeps_western_european_characters_and_substitutes_a_few_symbols():
    text, replaced = to_standard_font_text("José Müller \u2013 résumé \u201cquotes\u201d \u20ac A\u2192B non\u2011breaking")
    assert replaced == 0
    assert text == "José Müller \u2013 résumé \u201cquotes\u201d \u20ac A->B non-breaking"


def test_pdf_reports_characters_it_cannot_draw_instead_of_silently_losing_them():
    document = {"contact": {}, "sections": [{"id": "s", "key": "skills", "title": "Skills", "items": [item(1, "Rahul शर्मा")]}]}
    rendered = render_pdf(document)
    assert rendered.warnings and "DOCX" in rendered.warnings[0]
    assert "????" in pdf_text(rendered.content)
    assert render_pdf(RESUME).warnings == []


def test_pdf_with_a_long_unbroken_word_and_many_pages():
    long_word = {"contact": {}, "sections": [{"id": "s", "key": "skills", "title": "Skills", "items": [item(1, "A" * 600)]}]}
    assert len(PdfReader(io.BytesIO(render_pdf(long_word).content)).pages) >= 1

    many = {"contact": {}, "sections": [
        {"id": f"s{k}", "key": "experience", "title": f"Section {k}", "items": [
            item(k * 100 + j, f"Line {j} of section {k} with enough resume text in it to wrap around the line when printed", j % 2 == 0)
            for j in range(18)]}
        for k in range(1, 9)]}
    pages = PdfReader(io.BytesIO(render_pdf(many).content)).pages
    assert len(pages) > 1
    for page in pages:  # a section heading is never left alone at the bottom of a page
        last = [line for line in page.extract_text().splitlines() if line.strip()][-1]
        assert not last.startswith("SECTION")


def test_both_pdf_templates_are_available_and_unknown_ones_fall_back():
    for template in ("classic", "modern", "something-else"):
        assert "EXPERIENCE" in pdf_text(render_pdf(RESUME, template=template).content)


# ------------------------------------------------------------------ DOCX

def test_docx_uses_real_headings_and_bullets_and_no_tables_or_images():
    document = docx_doc(render_docx(RESUME).content)
    styles = [(p.style.name, p.text) for p in document.paragraphs]
    assert ("Heading 1", "Experience") in styles
    assert ("List Bullet", "Built REST APIs in Python serving 2M requests per day") in styles
    assert [p.text for p in document.paragraphs][:2] == ["Jane Doe", "jane.doe@example.com | +1 415 555 0134"]
    assert len(document.tables) == 0 and len(document.inline_shapes) == 0


def test_docx_keeps_the_resumes_own_wording_and_every_character():
    document = {"contact": {}, "sections": [{"id": "s", "key": "skills", "title": "Skills", "items": [
        item(1, "Rahul शर्मा 🚀 <b>x</b> & y"),
    ]}]}
    rendered = render_docx(document)
    assert rendered.warnings == []
    assert "Rahul शर्मा 🚀 <b>x</b> & y" in [p.text for p in docx_doc(rendered.content).paragraphs]


def test_docx_page_size_metadata_and_theme_fonts():
    letter = docx_doc(render_docx(RESUME, page_size="LETTER", title="My CV").content)
    a4 = docx_doc(render_docx(RESUME, page_size="A4").content)
    assert round(letter.sections[0].page_width.mm, 1) == 215.9
    assert round(a4.sections[0].page_width.mm) == 210
    assert letter.core_properties.title == "My CV"
    assert letter.core_properties.author == "Jane Doe"
    modern = docx_doc(render_docx(RESUME, template="modern").content)
    heading = modern.styles["Heading 1"]
    assert heading.font.name == "Calibri" and heading.font.all_caps and heading.font.bold
    # Theme font attributes would make Word ignore the font name, so they must be gone.
    assert not any("Theme" in key or "theme" in key for key in heading.element.rPr.rFonts.attrib)


def test_docx_survives_dirty_input_and_an_empty_document():
    dirty = {"contact": {}, "sections": [{"id": "s", "key": "experience", "title": "Exp\x00erience", "items": [item(1, "bad\x00char \ud800", True)]}]}
    assert "badchar" in [p.text for p in docx_doc(render_docx(dirty).content).paragraphs]
    assert render_docx({"contact": {}, "sections": []}).content.startswith(b"PK")
