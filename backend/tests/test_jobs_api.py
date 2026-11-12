import pytest

from app.config import settings
from tests.helpers import DOCX_MIME, make_docx, make_pdf

URL = "/api/v1/jobs"
DESCRIPTION = (
    "We are looking for a Backend Engineer with 3+ years of Python experience. "
    "You will design REST APIs, work with MongoDB and deploy services using Docker."
)


def payload(**overrides):
    body = {"jobTitle": "Backend Engineer", "companyName": "Acme Corp", "description": DESCRIPTION}
    body.update(overrides)
    return body


async def create(client, auth, **overrides):
    response = await client.post(URL, json=payload(**overrides), headers=auth)
    assert response.status_code == 201, response.text
    return response.json()["data"]


# ---------- create / read ----------


async def test_create_and_get_job(client, auth):
    created = await create(client, auth)
    assert created["jobTitle"] == "Backend Engineer"
    assert created["companyName"] == "Acme Corp"
    assert created["description"] == DESCRIPTION
    assert created["extractedRequirements"] is None
    assert "userId" not in created

    fetched = (await client.get(f"{URL}/{created['id']}", headers=auth)).json()["data"]
    assert fetched["description"] == DESCRIPTION


async def test_company_is_optional_and_text_is_cleaned(client, auth):
    created = await create(client, auth, jobTitle="  Data   Analyst ", companyName="", description="x\x00" + DESCRIPTION)
    assert created["jobTitle"] == "Data Analyst"
    assert created["companyName"] == ""
    assert "\x00" not in created["description"]


async def test_list_hides_full_description_but_shows_preview(client, auth):
    await create(client, auth)
    body = (await client.get(URL, headers=auth)).json()
    item = body["data"][0]
    assert "description" not in item
    assert item["descriptionPreview"].startswith("We are looking")
    assert item["descriptionLength"] == len(DESCRIPTION)
    assert body["meta"]["total"] == 1


@pytest.mark.parametrize(
    "overrides",
    [
        {"jobTitle": ""},
        {"jobTitle": "   "},
        {"description": "too short"},
        {"description": "x" * 20001},
        {"jobTitle": "t" * 201},
    ],
)
async def test_create_validates_input(client, auth, overrides):
    response = await client.post(URL, json=payload(**overrides), headers=auth)
    assert response.status_code == 422


async def test_job_quota_is_enforced(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "max_jobs_per_user", 1)
    await create(client, auth)
    response = await client.post(URL, json=payload(), headers=auth)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "JOB_LIMIT_REACHED"


# ---------- update ----------


async def test_update_changes_only_provided_fields(client, auth):
    created = await create(client, auth)
    response = await client.patch(f"{URL}/{created['id']}", json={"jobTitle": "Staff Engineer"}, headers=auth)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["jobTitle"] == "Staff Engineer"
    assert data["companyName"] == "Acme Corp"
    assert data["description"] == DESCRIPTION


async def test_changing_description_invalidates_extracted_requirements(client, auth, db):
    from bson import ObjectId

    created = await create(client, auth)
    await db["job_descriptions"].update_one(
        {"_id": ObjectId(created["id"])}, {"$set": {"extractedRequirements": {"requirements": ["python"]}}}
    )
    same = await client.patch(f"{URL}/{created['id']}", json={"description": DESCRIPTION}, headers=auth)
    assert same.json()["data"]["extractedRequirements"] == {"requirements": ["python"]}  # unchanged text keeps them

    changed = await client.patch(
        f"{URL}/{created['id']}", json={"description": DESCRIPTION + " Kubernetes is a plus."}, headers=auth
    )
    assert changed.json()["data"]["extractedRequirements"] is None


async def test_update_requires_at_least_one_field(client, auth):
    created = await create(client, auth)
    assert (await client.patch(f"{URL}/{created['id']}", json={}, headers=auth)).status_code == 422


async def test_delete_job(client, auth):
    created = await create(client, auth)
    assert (await client.delete(f"{URL}/{created['id']}", headers=auth)).status_code == 200
    assert (await client.get(f"{URL}/{created['id']}", headers=auth)).status_code == 404
    assert (await client.delete(f"{URL}/{created['id']}", headers=auth)).status_code == 404


# ---------- ownership and auth ----------


async def test_users_cannot_access_each_others_jobs(client, auth, other_auth):
    created = await create(client, auth)
    jid = created["id"]
    assert (await client.get(f"{URL}/{jid}", headers=other_auth)).status_code == 404
    assert (await client.patch(f"{URL}/{jid}", json={"jobTitle": "x"}, headers=other_auth)).status_code == 404
    assert (await client.delete(f"{URL}/{jid}", headers=other_auth)).status_code == 404
    assert (await client.get(URL, headers=other_auth)).json()["meta"]["total"] == 0
    assert (await client.get(f"{URL}/{jid}", headers=auth)).status_code == 200


@pytest.mark.parametrize("method, path", [("GET", ""), ("POST", ""), ("GET", "/abc"), ("PATCH", "/abc"), ("DELETE", "/abc"), ("POST", "/extract-text")])
async def test_all_job_endpoints_require_authentication(client, method, path):
    assert (await client.request(method, f"{URL}{path}")).status_code == 401


async def test_legacy_documents_are_presented_in_the_current_shape(client, auth, db):
    from bson import ObjectId

    me = (await client.get("/api/v1/auth/me", headers=auth)).json()["data"]["id"]
    await db["job_descriptions"].insert_one(
        {"userId": ObjectId(me), "title": "Old title", "company": "Old Co", "content": DESCRIPTION}
    )
    item = (await client.get(URL, headers=auth)).json()["data"][0]
    assert (item["jobTitle"], item["companyName"]) == ("Old title", "Old Co")
    assert item["descriptionPreview"].startswith("We are looking")


# ---------- extract text from a file ----------


async def test_extract_text_from_txt(client, auth):
    files = {"file": ("job.txt", DESCRIPTION.encode(), "text/plain")}
    data = (await client.post(f"{URL}/extract-text", files=files, headers=auth)).json()["data"]
    assert data["text"] == DESCRIPTION
    assert data["truncated"] is False


async def test_extract_text_from_docx_and_pdf(client, auth):
    docx = {"file": ("job.docx", make_docx([DESCRIPTION]), DOCX_MIME)}
    assert "REST APIs" in (await client.post(f"{URL}/extract-text", files=docx, headers=auth)).json()["data"]["text"]
    pdf = {"file": ("job.pdf", make_pdf([DESCRIPTION[:70], DESCRIPTION[70:]]), "application/pdf")}
    assert "MongoDB" in (await client.post(f"{URL}/extract-text", files=pdf, headers=auth)).json()["data"]["text"]


async def test_extract_text_truncates_very_long_documents(client, auth):
    text = ("Responsibilities include building services. " * 700).encode()
    files = {"file": ("long.txt", text, "text/plain")}
    data = (await client.post(f"{URL}/extract-text", files=files, headers=auth)).json()["data"]
    assert len(data["text"]) == 20000
    assert data["truncated"] is True


@pytest.mark.parametrize(
    "files, code",
    [
        ({"file": ("job.exe", b"MZ\x90\x00", "application/octet-stream")}, "UNSUPPORTED_FILE_TYPE"),
        ({"file": ("job.pdf", b"not a pdf at all " * 20, "application/pdf")}, "INVALID_FILE"),
        ({"file": ("job.txt", b"\x00\x01\x02binary", "text/plain")}, "INVALID_FILE"),
    ],
)
async def test_extract_text_rejects_invalid_files(client, auth, files, code):
    response = await client.post(f"{URL}/extract-text", files=files, headers=auth)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == code
