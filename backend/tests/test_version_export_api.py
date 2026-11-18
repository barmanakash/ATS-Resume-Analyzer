import io
from datetime import datetime, timezone

from bson import ObjectId
from docx import Document
from pypdf import PdfReader

API = "/api/v1"
PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def item(number, text, bullet=False):
    return {"id": f"i{number}", "text": text, "bullet": bullet}


CONTENT = {
    "version": 1,
    "contact": {"name": "Jane Doe", "email": "jane.doe@example.com", "phone": None, "location": None},
    "sections": [
        {"id": "s1", "key": "header", "title": "", "items": [item(1, "Jane Doe"), item(2, "jane.doe@example.com")]},
        {"id": "s2", "key": "experience", "title": "Experience", "items": [
            item(3, "Backend Developer, Acme Corp"), item(4, "Built REST APIs in Python", True)]},
    ],
}


async def user_id(client, auth) -> ObjectId:
    me = await client.get(f"{API}/users/me", headers=auth)
    assert me.status_code == 200, me.text
    return ObjectId(me.json()["data"]["id"])


async def add_version(db, owner: ObjectId, content=CONTENT, name="Backend Engineer - optimized") -> str:
    inserted = await db["resume_versions"].insert_one({
        "userId": owner, "resumeId": "r1", "analysisId": "a1", "versionNumber": 1, "name": name, "kind": "optimized",
        "content": content, "baseline": content, "history": [], "createdAt": datetime.now(timezone.utc),
    })
    return str(inserted.inserted_id)


def export(client, auth, version_id, **body):
    return client.post(f"{API}/versions/{version_id}/export", json=body, headers=auth)


async def test_pdf_download(client, db, auth):
    version_id = await add_version(db, await user_id(client, auth))
    response = await export(client, auth, version_id, format="pdf")
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == PDF
    assert response.headers["content-disposition"] == 'attachment; filename="Jane_Doe_Resume.pdf"'
    assert "no-store" in response.headers["cache-control"]
    assert "x-export-warnings" not in response.headers
    assert response.content.startswith(b"%PDF")
    text = PdfReader(io.BytesIO(response.content)).pages[0].extract_text()
    assert "Jane Doe" in text and "Built REST APIs in Python" in text


async def test_docx_download(client, db, auth):
    version_id = await add_version(db, await user_id(client, auth))
    response = await export(client, auth, version_id, format="docx")
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == DOCX
    assert response.headers["content-disposition"] == 'attachment; filename="Jane_Doe_Resume.docx"'
    paragraphs = [(p.style.name, p.text) for p in Document(io.BytesIO(response.content)).paragraphs]
    assert ("Heading 1", "Experience") in paragraphs
    assert ("List Bullet", "Built REST APIs in Python") in paragraphs


async def test_template_and_page_size_are_honoured(client, db, auth):
    version_id = await add_version(db, await user_id(client, auth))
    letter = await export(client, auth, version_id, format="pdf", template="modern", pageSize="LETTER")
    a4 = await export(client, auth, version_id, format="pdf")
    assert round(float(PdfReader(io.BytesIO(letter.content)).pages[0].mediabox.width)) == 612
    assert round(float(PdfReader(io.BytesIO(a4.content)).pages[0].mediabox.width)) == 595


async def test_pdf_warns_when_it_cannot_draw_characters_but_docx_keeps_them(client, db, auth):
    content = {**CONTENT, "sections": [{"id": "s1", "key": "skills", "title": "Skills", "items": [item(1, "Rahul शर्मा")]}]}
    version_id = await add_version(db, await user_id(client, auth), content=content)
    pdf = await export(client, auth, version_id, format="pdf")
    assert pdf.status_code == 200
    assert "DOCX" in pdf.headers["x-export-warnings"]
    docx = await export(client, auth, version_id, format="docx")
    assert "x-export-warnings" not in docx.headers
    assert "Rahul शर्मा" in [p.text for p in Document(io.BytesIO(docx.content)).paragraphs]


async def test_invalid_options_are_rejected(client, db, auth):
    version_id = await add_version(db, await user_id(client, auth))
    assert (await export(client, auth, version_id, format="exe")).status_code == 422
    assert (await export(client, auth, version_id, format="pdf", template="fancy")).status_code == 422
    assert (await export(client, auth, version_id, format="pdf", pageSize="A0")).status_code == 422
    assert (await export(client, auth, version_id)).status_code == 422


async def test_empty_versions_cannot_be_exported(client, db, auth):
    version_id = await add_version(db, await user_id(client, auth), content={"version": 1, "contact": {}, "sections": []})
    response = await export(client, auth, version_id, format="pdf")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "EMPTY_RESUME"


async def test_corrupt_stored_content_is_a_clean_error_not_a_crash(client, db, auth):
    broken = {"version": 1, "contact": {}, "sections": [{"id": "s1", "key": "x", "title": "", "items": [
        {"id": "dup", "text": "a"}, {"id": "dup", "text": "b"}]}]}
    version_id = await add_version(db, await user_id(client, auth), content=broken)
    response = await export(client, auth, version_id, format="pdf")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_RESUME_DOCUMENT"


async def test_old_plain_text_versions_and_unknown_ids_are_not_found(client, db, auth):
    owner = await user_id(client, auth)
    old = await add_version(db, owner, content="plain text from the old optimizer")
    assert (await export(client, auth, old, format="pdf")).status_code == 404
    assert (await export(client, auth, str(ObjectId()), format="pdf")).status_code == 404
    assert (await export(client, auth, "not-an-id", format="pdf")).status_code == 404


async def test_a_user_cannot_export_someone_elses_version(client, db, auth, other_auth):
    version_id = await add_version(db, await user_id(client, auth))
    assert (await export(client, other_auth, version_id, format="pdf")).status_code == 404
    assert (await export(client, auth, version_id, format="pdf")).status_code == 200


async def test_export_requires_login(client, db, auth):
    version_id = await add_version(db, await user_id(client, auth))
    response = await client.post(f"{API}/versions/{version_id}/export", json={"format": "pdf"})
    assert response.status_code == 401


async def test_download_headers_are_readable_by_the_browser_frontend(client, db, auth):
    version_id = await add_version(db, await user_id(client, auth))
    response = await client.options(
        f"{API}/versions/{version_id}/export",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    assert response.status_code == 200
    actual = await client.post(
        f"{API}/versions/{version_id}/export", json={"format": "pdf"}, headers={**auth, "Origin": "http://localhost:3000"}
    )
    exposed = actual.headers.get("access-control-expose-headers", "").lower()
    assert "content-disposition" in exposed and "x-export-warnings" in exposed
