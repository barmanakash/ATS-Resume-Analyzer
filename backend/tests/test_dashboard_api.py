from datetime import datetime, timedelta

from bson import ObjectId

from app.config import settings
from tests.helpers import RESUME_LINES, make_pdf

URL = "/api/v1/dashboard/summary"
DESCRIPTION = (
    "We are looking for a Backend Engineer with 3+ years of Python experience. "
    "You will design REST APIs, work with MongoDB and deploy services using Docker."
)


async def user_id_of(client, auth) -> ObjectId:
    me = (await client.get("/api/v1/auth/me", headers=auth)).json()["data"]
    return ObjectId(me["id"])


async def upload_resume(client, auth, name="resume.pdf"):
    files = {"file": (name, make_pdf(RESUME_LINES), "application/pdf")}
    response = await client.post("/api/v1/resumes", files=files, headers=auth)
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def create_job(client, auth, title="Backend Engineer"):
    body = {"jobTitle": title, "companyName": "Acme Corp", "description": DESCRIPTION}
    response = await client.post("/api/v1/jobs", json=body, headers=auth)
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def insert_analysis(db, user_id, resume_id, job_id, score, created_at=None):
    doc = {
        "userId": user_id,
        "resumeId": resume_id,
        "jobDescriptionId": job_id,
        "status": "completed",
        "overallScore": score,
        "createdAt": created_at or datetime.utcnow(),
    }
    await db["resume_analyses"].insert_one(doc)


async def test_requires_authentication(client):
    assert (await client.get(URL)).status_code == 401


async def test_empty_account_returns_zero_counts_and_no_average(client, auth):
    data = (await client.get(URL, headers=auth)).json()["data"]
    assert data["totalResumes"] == 0
    assert data["totalJobDescriptions"] == 0
    assert data["totalAnalyses"] == 0
    assert data["averageCompatibilityScore"] is None  # "no data" must not look like a 0% score
    assert data["recentResumes"] == []
    assert data["recentAnalyses"] == []
    assert data["scoreTrend"] == []
    assert data["usage"]["analysesThisMonth"] == 0
    assert data["usage"]["resumes"] == {"used": 0, "limit": settings.max_resumes_per_user}
    assert data["usage"]["jobDescriptions"] == {"used": 0, "limit": settings.max_jobs_per_user}


async def test_counts_names_and_average_cover_all_analyses(client, auth, db):
    uid = await user_id_of(client, auth)
    resume = await upload_resume(client, auth)
    job = await create_job(client, auth)
    # Seven analyses: more than the five shown in the recent list, so the average must not use only those.
    scores = [10, 20, 30, 40, 50, 60, 100]
    for index, score in enumerate(scores):
        await insert_analysis(db, uid, resume["id"], job["id"], score, datetime.utcnow() - timedelta(minutes=10 - index))

    data = (await client.get(URL, headers=auth)).json()["data"]
    assert data["totalResumes"] == 1
    assert data["totalJobDescriptions"] == 1
    assert data["totalAnalyses"] == 7
    assert data["averageCompatibilityScore"] == round(sum(scores) / len(scores), 1)
    assert data["usage"]["analysesThisMonth"] == 7

    assert len(data["recentAnalyses"]) == 5
    newest = data["recentAnalyses"][0]
    assert newest["overallScore"] == 100
    assert newest["jobTitle"] == "Backend Engineer"
    assert newest["companyName"] == "Acme Corp"
    assert newest["resumeName"] == resume["displayName"]
    assert [point["score"] for point in data["scoreTrend"]] == scores  # oldest first


async def test_deleted_job_leaves_name_empty_instead_of_failing(client, auth, db):
    uid = await user_id_of(client, auth)
    resume = await upload_resume(client, auth)
    job = await create_job(client, auth)
    await insert_analysis(db, uid, resume["id"], job["id"], 80)
    assert (await client.delete(f"/api/v1/jobs/{job['id']}", headers=auth)).status_code == 200

    item = (await client.get(URL, headers=auth)).json()["data"]["recentAnalyses"][0]
    assert item["jobTitle"] is None
    assert item["resumeName"] == resume["displayName"]


async def test_old_analyses_do_not_count_towards_this_month(client, auth, db):
    uid = await user_id_of(client, auth)
    resume = await upload_resume(client, auth)
    job = await create_job(client, auth)
    await insert_analysis(db, uid, resume["id"], job["id"], 70, datetime.utcnow() - timedelta(days=90))
    data = (await client.get(URL, headers=auth)).json()["data"]
    assert data["totalAnalyses"] == 1
    assert data["usage"]["analysesThisMonth"] == 0


async def test_malformed_scores_are_ignored_in_the_average(client, auth, db):
    uid = await user_id_of(client, auth)
    resume = await upload_resume(client, auth)
    job = await create_job(client, auth)
    await insert_analysis(db, uid, resume["id"], job["id"], 80)
    await insert_analysis(db, uid, resume["id"], job["id"], None)
    await insert_analysis(db, uid, resume["id"], job["id"], "n/a")
    data = (await client.get(URL, headers=auth)).json()["data"]
    assert data["totalAnalyses"] == 3
    assert data["averageCompatibilityScore"] == 80
    assert len(data["scoreTrend"]) == 1


async def test_responses_never_expose_internal_fields(client, auth, db):
    uid = await user_id_of(client, auth)
    resume = await upload_resume(client, auth)
    job = await create_job(client, auth)
    await insert_analysis(db, uid, resume["id"], job["id"], 75)
    data = (await client.get(URL, headers=auth)).json()["data"]
    for item in data["recentResumes"] + data["recentAnalyses"]:
        assert "userId" not in item
        assert "storagePath" not in item
        assert "parsedText" not in item


async def test_users_only_see_their_own_data(client, auth, other_auth, db):
    uid = await user_id_of(client, auth)
    resume = await upload_resume(client, auth)
    job = await create_job(client, auth)
    await insert_analysis(db, uid, resume["id"], job["id"], 90)

    data = (await client.get(URL, headers=other_auth)).json()["data"]
    assert data["totalResumes"] == 0
    assert data["totalAnalyses"] == 0
    assert data["averageCompatibilityScore"] is None
    assert data["recentResumes"] == []
    assert data["recentAnalyses"] == []

