"""Builders for small, valid test documents (no external fixtures needed)."""
from io import BytesIO
from typing import Iterable


def make_pdf(lines: Iterable[str]) -> bytes:
    """A minimal valid single-page PDF whose text layer contains `lines`."""

    def esc(text: str) -> str:
        return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    stream = "BT /F1 12 Tf 72 720 Td 14 TL\n" + "".join(f"({esc(line)}) Tj T*\n" for line in lines) + "ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        "/Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n{body}\nendobj\n".encode("latin-1")
    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += "".join(f"{offset:010d} 00000 n \n" for offset in offsets).encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF".encode()
    return out


def make_docx(paragraphs: Iterable[str], table_rows: Iterable[Iterable[str]] = ()) -> bytes:
    from docx import Document

    document = Document()
    for text in paragraphs:
        document.add_paragraph(text)
    rows = [list(r) for r in table_rows]
    if rows:
        table = document.add_table(rows=len(rows), cols=len(rows[0]))
        for r, row in enumerate(rows):
            for c, value in enumerate(row):
                table.cell(r, c).text = value
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


RESUME_LINES = [
    "Jane Doe",
    "jane.doe@example.com | +1 415 555 0134",
    "Professional Summary",
    "Backend engineer with five years of experience building APIs.",
    "Experience",
    "Senior Developer at Acme Corp, Jan 2020 - Present",
    "Built REST services in Python and FastAPI serving 2 million requests per day.",
    "Education",
    "B.Sc. Computer Science, State University, 2015 - 2019",
    "Skills",
    "Python, FastAPI, MongoDB, Docker",
]

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
