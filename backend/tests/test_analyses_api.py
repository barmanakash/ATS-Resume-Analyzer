from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.services.analysis_service import fail_stale_analyses

API = "/api/v1"

JOB_TEXT = (
    "Backend Engineer\nResponsibilities\n- Design and build REST APIs using Python\n"
    "- Deploy services with Docker on AWS\nRequirements\n- 3+ years of experience in backend development\n"
    "- Strong proficiency in Python and SQL\n- Experience with Docker\nNice to have\n- Experience with Kafka\n"
)
RESUME_TEXT = (
    "Jane Doe\njane.doe@example.com | +1 415 555 0134\n\nExperience\nBackend Developer, Acme Corp\n"
    "Jan 2020 - Present\n- Built REST APIs in Python serving 2M requests per day\n"
    "- Containerized services with Docker\n- Wrote SQL queries and tuned indexes\n\n"
    "Skills\nPython, SQL, Docker, Git\n\nEducation\nB.Tech in Computer Science, 2016 - 2019\n"
)


async def user_id(client, auth) -> ObjectId:
    me = await client.get(f"{API}/users/me", headers=auth)
    assert me.status_code == 200, me.text
    return ObjectId(me.json()["data"]["id"])


async def add_resume(db, owner: ObjectId, text: str = RESUME_TEXT, name: str = "jane.pdf", **extra) -> str:
    doc = {
        "userId": owner,
        "originalFileName": name,
        "displayName": name,
        "fileType": "pdf",
        "parsedText": text,
        "parsedData": {"email": "jane.doe@example.com", "phone": "+1 415 555 0134"},
        "processingStatus": "COMPLETED",
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    doc.update(extra)
    inserted = await db["resumes"].insert_one(doc)
    return str(inserted.inserted_id)


async def add_job(client, auth, title: str = "Backend Engineer") -> str:
    response = await client.post(
        f"{API}/jobs", json={"jobTitle": title, "companyName": "Acme", "description": JOB_TEXT}, headers=auth
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"]


async def analyze(client, auth, resume_id: str, job_id: str):
    return await client.post(
        f"{API}/analyses", json={"resumeId": resume_id, "jobDescriptionId": job_id}, headers=auth
    )


async def setup(client, db, auth):
    owner = await user_id(client, auth)
    return owner, await add_resume(db, owner), await add_job(client, auth)


# ---------- create ----------


async def test_create_analysis_returns_completed_report(client, db, auth):
    _, resume_id, job_id = await setup(client, db, auth)
    response = await analyze(client, auth, resume_id, job_id)
    assert response.status_code == 201, response.text
    report = response.json()["data"]

    assert report["status"] == "COMPLETED"
    assert isinstance(report["overallScore"], int) and 0 <= report["overallScore"] <= 100
    assert report["recommendation"] in {"READY_TO_APPLY", "IMPROVE_BEFORE_APPLYING", "LOW_COMPATIBILITY"}
    assert len(report["categoryScores"]) == 6
    assert report["requirements"] and report["improvementRecommendations"]
    assert report["resumeName"] == "jane.pdf" and report["jobTitle"] == "Backend Engineer"
    assert "not a guarantee" in report["disclaimer"].lower()
    assert "userId" not in report

    python = next(r for r in report["requirements"] if r["requirement"] == "Python")
    assert python["status"] == "MATCHED" and python["evidence"]
    aws = next(r for r in report["requirements"] if r["requirement"] == "AWS")
    assert aws["status"] == "NOT_FOUND" and aws["evidence"] is None
    assert "AWS" in [g["requirement"] for g in report["mandatoryGaps"]]


async def test_analysis_saves_extracted_requirements_on_the_job(client, db, auth):
    _, resume_id, job_id = await setup(client, db, auth)
    assert (await analyze(client, auth, resume_id, job_id)).status_code == 201
    job = (await client.get(f"{API}/jobs/{job_id}", headers=auth)).json()["data"]
    names = [s["name"] for s in job["extractedRequirements"]["skills"]]
    assert "Python" in names and "Docker" in names


async def test_same_inputs_give_the_same_score(client, db, auth):
    _, resume_id, job_id = await setup(client, db, auth)
    first = (await analyze(client, auth, resume_id, job_id)).json()["data"]
    second = (await analyze(client, auth, resume_id, job_id)).json()["data"]
    assert first["id"] != second["id"]
    assert first["overallScore"] == second["overallScore"]
    assert first["categoryScores"] == second["categoryScores"]


async def test_create_validates_input(client, auth):
    assert (await client.post(f"{API}/analyses", json={}, headers=auth)).status_code == 422
    assert (await client.post(f"{API}/analyses", json={"resumeId": "x"}, headers=auth)).status_code == 422


async def test_unknown_or_malformed_ids_return_404(client, db, auth):
    _, resume_id, job_id = await setup(client, db, auth)
    missing = str(ObjectId())
    assert (await analyze(client, auth, missing, job_id)).status_code == 404
    assert (await analyze(client, auth, resume_id, missing)).status_code == 404
    assert (await analyze(client, auth, "not-an-id", job_id)).status_code == 404


async def test_resume_without_text_is_rejected(client, db, auth):
    owner = await user_id(client, auth)
    empty = await add_resume(db, owner, text="   ")
    response = await analyze(client, auth, empty, await add_job(client, auth))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "RESUME_NOT_READABLE"


async def test_resume_that_failed_processing_is_rejected(client, db, auth):
    owner = await user_id(client, auth)
    failed = await add_resume(db, owner, processingStatus="FAILED")
    response = await analyze(client, auth, failed, await add_job(client, auth))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "RESUME_NOT_READY"


# ---------- read, list, delete ----------


async def test_list_returns_summaries_without_the_full_report(client, db, auth):
    _, resume_id, job_id = await setup(client, db, auth)
    created = (await analyze(client, auth, resume_id, job_id)).json()["data"]
    body = (await client.get(f"{API}/analyses", headers=auth)).json()
    assert body["meta"]["total"] == 1
    item = body["data"][0]
    assert item["id"] == created["id"] and item["overallScore"] == created["overallScore"]
    assert item["status"] == "COMPLETED"
    assert "requirements" not in item and "analysisDetails" not in item


async def test_get_analysis_and_report(client, db, auth):
    _, resume_id, job_id = await setup(client, db, auth)
    created = (await analyze(client, auth, resume_id, job_id)).json()["data"]
    summary = (await client.get(f"{API}/analyses/{created['id']}", headers=auth)).json()["data"]
    assert summary["overallScore"] == created["overallScore"] and "requirements" not in summary
    report = (await client.get(f"{API}/analyses/{created['id']}/report", headers=auth)).json()["data"]
    assert report["requirements"] == created["requirements"]
    assert report["categoryScores"] == created["categoryScores"]


async def test_delete_analysis(client, db, auth):
    _, resume_id, job_id = await setup(client, db, auth)
    created = (await analyze(client, auth, resume_id, job_id)).json()["data"]
    assert (await client.delete(f"{API}/analyses/{created['id']}", headers=auth)).status_code == 200
    assert (await client.get(f"{API}/analyses/{created['id']}", headers=auth)).status_code == 404
    assert (await client.delete(f"{API}/analyses/{created['id']}", headers=auth)).status_code == 404


async def test_legacy_analysis_has_no_detailed_report(client, db, auth):
    owner = await user_id(client, auth)
    old = await db["resume_analyses"].insert_one(
        {"userId": owner, "status": "completed", "overallScore": 42, "createdAt": datetime.now(timezone.utc)}
    )
    response = await client.get(f"{API}/analyses/{old.inserted_id}/report", headers=auth)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "LEGACY_ANALYSIS"


async def test_deleting_a_resume_deletes_its_analyses(client, db, auth):
    _, resume_id, job_id = await setup(client, db, auth)
    created = (await analyze(client, auth, resume_id, job_id)).json()["data"]
    assert (await client.delete(f"{API}/resumes/{resume_id}", headers=auth)).status_code == 200
    assert (await client.get(f"{API}/analyses/{created['id']}", headers=auth)).status_code == 404


# ---------- ownership ----------


async def test_users_cannot_see_or_delete_each_others_analyses(client, db, auth, other_auth):
    _, resume_id, job_id = await setup(client, db, auth)
    created = (await analyze(client, auth, resume_id, job_id)).json()["data"]

    for path in (f"/analyses/{created['id']}", f"/analyses/{created['id']}/report"):
        assert (await client.get(f"{API}{path}", headers=other_auth)).status_code == 404
    assert (await client.delete(f"{API}/analyses/{created['id']}", headers=other_auth)).status_code == 404
    assert (await client.get(f"{API}/analyses", headers=other_auth)).json()["meta"]["total"] == 0
    assert (await client.get(f"{API}/analyses/{created['id']}", headers=auth)).status_code == 200


async def test_user_cannot_analyze_with_someone_elses_resume_or_job(client, db, auth, other_auth):
    _, resume_id, job_id = await setup(client, db, auth)
    bob_owner = await user_id(client, other_auth)
    bob_resume = await add_resume(db, bob_owner)
    bob_job = await add_job(client, other_auth)

    assert (await analyze(client, other_auth, resume_id, bob_job)).status_code == 404  # Alice's resume
    assert (await analyze(client, other_auth, bob_resume, job_id)).status_code == 404  # Alice's job


async def test_endpoints_require_login(client):
    assert (await client.get(f"{API}/analyses")).status_code == 401
    assert (await client.post(f"{API}/analyses", json={})).status_code == 401


# ---------- lifecycle ----------


async def test_stale_unfinished_analyses_are_marked_failed(client, db, auth):
    owner = await user_id(client, auth)
    old = datetime.now(timezone.utc) - timedelta(hours=2)
    stale = await db["resume_analyses"].insert_one({"userId": owner, "status": "PROCESSING", "createdAt": old})
    fresh = await db["resume_analyses"].insert_one(
        {"userId": owner, "status": "PROCESSING", "createdAt": datetime.now(timezone.utc)}
    )
    assert await fail_stale_analyses(db) == 1
    assert (await db["resume_analyses"].find_one({"_id": stale.inserted_id}))["status"] == "FAILED"
    assert (await db["resume_analyses"].find_one({"_id": fresh.inserted_id}))["status"] == "PROCESSING"
