import pytest

from app.core.exceptions import BadRequestError
from app.document_processing.resume_parser import detect_sections, extract_basic_info
from app.document_processing.text_extraction import (
    DocumentExtractionError,
    extract_text,
    normalize_text,
    sanitize_filename,
    validate_upload,
)
from app.storage.local_storage import LocalStorageService
from tests.helpers import DOCX_MIME, RESUME_LINES, make_docx, make_pdf


def test_sanitize_filename_strips_paths_and_control_characters():
    assert sanitize_filename("../../etc/passwd") == "passwd"
    assert sanitize_filename("C:\\Users\\me\\My CV.pdf") == "My CV.pdf"
    assert sanitize_filename("bad\x00name\n.pdf") == "badname.pdf"
    assert sanitize_filename("...") == "document"
    assert len(sanitize_filename("a" * 400 + ".pdf")) <= 150


def test_normalize_text_cleans_whitespace_and_control_characters():
    raw = "Hello\x00   World\r\n\r\n\r\n\r\nNext\u00a0line\x0b"
    assert normalize_text(raw) == "Hello World\n\nNext line"


def test_validate_upload_accepts_valid_pdf_and_docx():
    assert validate_upload("a.PDF", "application/pdf", make_pdf(RESUME_LINES), ["pdf", "docx"]) == "pdf"
    assert validate_upload("a.docx", DOCX_MIME, make_docx(["hello"]), ["pdf", "docx"]) == "docx"


def test_validate_upload_rejects_docx_zip_bombs(monkeypatch):
    import app.document_processing.text_extraction as module

    monkeypatch.setattr(module, "MAX_DOCX_UNCOMPRESSED_BYTES", 10)
    with pytest.raises(BadRequestError):
        validate_upload("a.docx", DOCX_MIME, make_docx(["some content here"]), ["docx"])


def test_validate_upload_rejects_zip_that_is_not_a_docx():
    import zipfile
    from io import BytesIO

    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("hello.txt", "not a word document")
    with pytest.raises(BadRequestError) as exc:
        validate_upload("a.docx", DOCX_MIME, buffer.getvalue(), ["docx"])
    assert exc.value.code == "INVALID_FILE"


def test_corrupted_pdf_gives_a_safe_message():
    broken = b"%PDF-1.4\n" + b"\x00garbage" * 50
    with pytest.raises(DocumentExtractionError) as exc:
        extract_text("pdf", broken)
    assert "pypdf" not in exc.value.message.lower()


def test_extract_text_from_valid_documents():
    assert "FastAPI" in extract_text("pdf", make_pdf(RESUME_LINES)).text
    assert "FastAPI" in extract_text("docx", make_docx(RESUME_LINES)).text


def test_detect_sections_matches_headings_only():
    text = "Work Experience\nBuilt things\nEDUCATION:\nSkills\nI have experience with many things and education too"
    assert detect_sections(text) == ["experience", "education", "skills"]


def test_extract_basic_info_reads_facts_without_guessing():
    info = extract_basic_info("\n".join(RESUME_LINES), page_count=2)
    assert info["email"] == "jane.doe@example.com"
    assert info["phone"] == "+1 415 555 0134"
    assert info["pageCount"] == 2
    assert info["wordCount"] > 20
    assert "skills" in info["sectionsDetected"]

    empty = extract_basic_info("Just a name and nothing else")
    assert empty["email"] is None and empty["phone"] is None


def test_local_storage_blocks_path_traversal(tmp_path):
    storage = LocalStorageService(str(tmp_path / "store"))
    with pytest.raises(ValueError):
        storage.read("../outside.txt")
    with pytest.raises(ValueError):
        storage._resolve("uploads/../../outside.txt")
    outside = tmp_path / "outside.txt"
    outside.write_text("keep me")
    storage.delete("../outside.txt")  # silently ignored, never deletes outside the storage directory
    assert outside.exists()


def test_local_storage_round_trip_and_user_cleanup(tmp_path):
    storage = LocalStorageService(str(tmp_path / "store"))
    key = storage.save("user1", "pdf", b"data")
    assert key.startswith("uploads/user1/") and key.endswith(".pdf")
    assert storage.read(key) == b"data"
    other = storage.save("user2", ".docx", b"other")
    storage.delete_user_files("user1")
    with pytest.raises(FileNotFoundError):
        storage.read(key)
    assert storage.read(other) == b"other"
