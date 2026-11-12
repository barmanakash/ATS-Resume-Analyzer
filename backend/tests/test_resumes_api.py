import pytest

from app.config import settings
from tests.helpers import DOCX_MIME, RESUME_LINES, make_docx, make_pdf

URL = "/api/v1/resumes"


def docx_upload(name="resume.docx", lines=RESUME_LINES, content_type=DOCX_MIME):
    return {"file": (name, make_docx(lines), content_type)}


def pdf_upload(name="resume.pdf", lines=RESUME_LINES, content_type="application/pdf"):
    return {"file": (name, make_pdf(lines), content_type)}


# ---------- upload ----------


async def test_upload_docx_extracts_text_and_hides_internals(client, auth, storage_dir):
    response = await client.post(URL, files=docx_upload(), data={"displayName": "My main resume"}, headers=auth)
    assert response.status_code == 201, response.text
    data = response.json()["data"]

    assert data["originalFileName"] == "resume.docx"
    assert data["displayName"] == "My main resume"
    assert data["fileType"] == "docx"
    assert data["processingStatus"] == "COMPLETED"
    assert "jane.doe@example.com" in data["parsedText"]
    assert data["parsedData"]["email"] == "jane.doe@example.com"
    assert data["parsedData"]["phone"].startswith("+1 415")
    assert {"experience", "education", "skills"} <= set(data["parsedData"]["sectionsDetected"])

    # Server internals must never reach the client.
    assert "storagePath" not in data and "userId" not in data
    # The file is stored under a random name, not the user-supplied one.
    stored = [p for p in storage_dir.rglob("*") if p.is_file()]
    assert len(stored) == 1 and stored[0].suffix == ".docx" and "resume" not in stored[0].name


async def test_upload_pdf_extracts_text(client, auth):
    response = await client.post(URL, files=pdf_upload(), headers=auth)
    assert response.status_code == 201, response.text
    data = response.json()["data"]
    assert data["fileType"] == "pdf"
    assert data["displayName"] == "resume"  # defaults to the file name without extension
    assert "FastAPI" in data["parsedText"]
    assert data["parsedData"]["pageCount"] == 1


async def test_docx_table_text_is_extracted(client, auth):
    files = {"file": ("r.docx", make_docx(["Jane Doe", "Skills"], [["Python", "FastAPI"], ["MongoDB", "Docker"]] ), DOCX_MIME)}
    response = await client.post(URL, files=files, headers=auth)
    assert response.status_code == 201, response.text
    assert "Python | FastAPI" in response.json()["data"]["parsedText"]


@pytest.mark.parametrize(
    "files, code",
    [
        ({"file": ("resume.txt", b"plain text resume content " * 10, "text/plain")}, "UNSUPPORTED_FILE_TYPE"),
        ({"file": ("resume.exe", b"MZ\x90\x00", "application/octet-stream")}, "UNSUPPORTED_FILE_TYPE"),
        ({"file": ("resume.pdf", b"this is not really a pdf " * 20, "application/pdf")}, "INVALID_FILE"),
        ({"file": ("resume.docx", make_pdf(RESUME_LINES), DOCX_MIME)}, "INVALID_FILE"),
        ({"file": ("resume.docx", b"PK\x03\x04 not a real zip archive", DOCX_MIME)}, "INVALID_FILE"),
        ({"file": ("resume.pdf", make_pdf(RESUME_LINES), "image/png")}, "FILE_TYPE_MISMATCH"),
        ({"file": ("resume.pdf", b"", "application/pdf")}, "EMPTY_FILE"),
    ],
)
async def test_upload_rejects_invalid_files(client, auth, storage_dir, files, code):
    response = await client.post(URL, files=files, headers=auth)
    assert response.status_code == 400, response.text
    assert response.json()["error"]["code"] == code
    assert not [p for p in storage_dir.rglob("*") if p.is_file()]  # nothing stored for a rejected file


async def test_scanned_pdf_is_rejected_with_clear_message(client, auth):
    response = await client.post(URL, files=pdf_upload(lines=[]), headers=auth)
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "SCANNED_PDF"
    assert "scanned" in error["message"].lower()


async def test_generic_browser_content_type_is_accepted_when_signature_is_valid(client, auth):
    response = await client.post(URL, files=docx_upload(content_type="application/octet-stream"), headers=auth)
    assert response.status_code == 201


async def test_file_larger_than_limit_is_rejected(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_mb", 1)
    big = b"%PDF-1.4\n" + b"A" * int(1.5 * 1024 * 1024)  # over the file limit, under the request-body limit
    response = await client.post(URL, files={"file": ("big.pdf", big, "application/pdf")}, headers=auth)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "FILE_TOO_LARGE"


async def test_resume_quota_is_enforced(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "max_resumes_per_user", 1)
    assert (await client.post(URL, files=docx_upload(), headers=auth)).status_code == 201
    second = await client.post(URL, files=docx_upload("two.docx"), headers=auth)
    assert second.status_code == 400
    assert second.json()["error"]["code"] == "RESUME_LIMIT_REACHED"


# ---------- list / get / rename ----------


async def test_list_is_paginated_and_excludes_heavy_fields(client, auth):
    for index in range(3):
        await client.post(URL, files=docx_upload(f"r{index}.docx"), headers=auth)
    response = await client.get(URL, params={"page": 1, "pageSize": 2}, headers=auth)
    body = response.json()
    assert response.status_code == 200
    assert len(body["data"]) == 2
    assert body["meta"] == {"total": 3, "page": 1, "pageSize": 2, "totalPages": 2}
    for item in body["data"]:
        assert "parsedText" not in item and "storagePath" not in item and "userId" not in item
        assert item["originalFileName"].endswith(".docx")  # the dashboard reads this field


async def test_get_resume_returns_detail(client, auth):
    created = (await client.post(URL, files=docx_upload(), headers=auth)).json()["data"]
    response = await client.get(f"{URL}/{created['id']}", headers=auth)
    assert response.status_code == 200
    assert "Jane Doe" in response.json()["data"]["parsedText"]


async def test_rename_changes_display_name_only(client, auth):
    created = (await client.post(URL, files=docx_upload("original.docx"), headers=auth)).json()["data"]
    response = await client.patch(f"{URL}/{created['id']}", json={"displayName": "  Data   Role  "}, headers=auth)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["displayName"] == "Data Role"
    assert data["originalFileName"] == "original.docx"


@pytest.mark.parametrize("payload", [{"displayName": ""}, {"displayName": "   "}, {}, {"displayName": "x" * 201}])
async def test_rename_validates_input(client, auth, payload):
    created = (await client.post(URL, files=docx_upload(), headers=auth)).json()["data"]
    response = await client.patch(f"{URL}/{created['id']}", json=payload, headers=auth)
    assert response.status_code == 422


async def test_invalid_id_is_not_found(client, auth):
    assert (await client.get(f"{URL}/not-an-object-id", headers=auth)).status_code == 404


# ---------- download ----------


async def test_download_returns_original_bytes(client, auth):
    original = make_docx(RESUME_LINES)
    created = (await client.post(URL, files={"file": ("cv.docx", original, DOCX_MIME)}, headers=auth)).json()["data"]
    response = await client.get(f"{URL}/{created['id']}/file", headers=auth)
    assert response.status_code == 200
    assert response.content == original
    assert response.headers["content-type"] == DOCX_MIME
    assert 'filename="cv.docx"' in response.headers["content-disposition"]
    assert response.headers["x-content-type-options"] == "nosniff"


# ---------- ownership ----------


async def test_users_cannot_access_each_others_resumes(client, auth, other_auth):
    created = (await client.post(URL, files=docx_upload(), headers=auth)).json()["data"]
    rid = created["id"]

    assert (await client.get(f"{URL}/{rid}", headers=other_auth)).status_code == 404
    assert (await client.get(f"{URL}/{rid}/file", headers=other_auth)).status_code == 404
    assert (await client.patch(f"{URL}/{rid}", json={"displayName": "hijack"}, headers=other_auth)).status_code == 404
    assert (await client.delete(f"{URL}/{rid}", headers=other_auth)).status_code == 404
    assert (await client.get(URL, headers=other_auth)).json()["meta"]["total"] == 0

    # Still intact for the owner.
    assert (await client.get(f"{URL}/{rid}", headers=auth)).status_code == 200


@pytest.mark.parametrize(
    "method, path",
    [("GET", ""), ("POST", ""), ("GET", "/abc"), ("PATCH", "/abc"), ("DELETE", "/abc"), ("GET", "/abc/file")],
)
async def test_all_resume_endpoints_require_authentication(client, method, path):
    response = await client.request(method, f"{URL}{path}")
    assert response.status_code == 401


# ---------- delete ----------


async def test_delete_removes_file_and_all_derived_records(client, auth, other_auth, db, storage_dir):
    from bson import ObjectId

    mine = (await client.post(URL, files=docx_upload(), headers=auth)).json()["data"]
    me = (await client.get("/api/v1/auth/me", headers=auth)).json()["data"]["id"]
    uid, rid = ObjectId(me), ObjectId(mine["id"])

    version = await db["resume_versions"].insert_one({"userId": uid, "resumeId": rid, "versionNumber": 1})
    await db["resume_analyses"].insert_one({"userId": uid, "resumeId": rid, "overallScore": 80})
    await db["resume_analyses"].insert_one({"userId": uid, "resumeId": str(rid), "overallScore": 70})  # legacy string ref
    await db["optimization_suggestions"].insert_one({"userId": uid, "resumeVersionId": version.inserted_id})
    await db["resume_analyses"].insert_one({"userId": uid, "resumeId": ObjectId(), "overallScore": 50})  # other resume

    assert [p for p in storage_dir.rglob("*") if p.is_file()]
    response = await client.delete(f"{URL}/{mine['id']}", headers=auth)
    assert response.status_code == 200

    assert not [p for p in storage_dir.rglob("*") if p.is_file()]
    assert await db["resumes"].count_documents({}) == 0
    assert await db["resume_versions"].count_documents({}) == 0
    assert await db["optimization_suggestions"].count_documents({}) == 0
    assert await db["resume_analyses"].count_documents({}) == 1  # only the unrelated analysis remains
    assert (await client.get(f"{URL}/{mine['id']}", headers=auth)).status_code == 404


# ---------- records created before the schema matched the spec ----------


async def test_legacy_documents_are_presented_in_the_current_shape(client, auth, db):
    from bson import ObjectId

    me = (await client.get("/api/v1/auth/me", headers=auth)).json()["data"]["id"]
    await db["resumes"].insert_one(
        {
            "userId": ObjectId(me),
            "name": "Old resume",
            "fileName": "old.pdf",
            "fileType": "pdf",
            "storagePath": "C:/secret/server/path/old.pdf",
            "status": "processed",
            "parsedText": "text",
        }
    )
    item = (await client.get(URL, headers=auth)).json()["data"][0]
    assert item["originalFileName"] == "old.pdf"
    assert item["displayName"] == "Old resume"
    assert item["processingStatus"] == "COMPLETED"
    assert "storagePath" not in item
