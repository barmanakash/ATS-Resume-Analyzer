from bson import ObjectId

from app.database.collections import RESUMES
from tests.helpers import make_pdf

URL = "/api/v1/analyses"

RESUME_LINES = [
    "Jane Doe",
    "jane.doe@example.com",
    "Skills",
    "Python, FastAPI, PostgreSQL, Docker",
    "Experience",
    "Backend Engineer",
    "Jan 2020 - Present",
    "Built REST APIs with FastAPI",
    "Deployed services with Docker",
    "Education",
    "B.Tech in Computer Science",
]
JOB_DESCRIPTION = (
    "Requirements\n- 3+ years of experience\n- Strong Python and FastAPI skills\n- Experience with Docker and Kubernetes\n"
    "Nice to have\n- Terraform\n"
)


async def upload_resume(client, auth, name="resume.pdf"):
    files = {"file": (name, make_pdf(RESUME_LINES), "application/pdf")}
    response = await client.post("/api/v1/resumes", files=files, headers=auth)
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def create_job(client, auth, title="Backend Engineer", company="Acme Corp"):
    body = {"jobTitle": title, "companyName": company, "description": JOB_DESCRIPTION}
    response = await client.post("/api/v1/jobs", json=body, headers=auth)
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def create_analysis(client, auth, resume, job):
    return await client.post(URL, json={"resumeId": resume["id"], "jobDescriptionId": job["id"]}, headers=auth)


async def setup(client, auth):
    resume = await upload_resume(client, auth)
    job = await create_job(client, auth)
    response = await create_analysis(client, auth, resume, job)
    assert response.status_code == 201, response.text
    return resume, job, response.json()["data"]


async def test_endpoints_require_authentication(client):
    assert (await client.get(URL)).status_code == 401
    assert (await client.post(URL, json={"resumeId": "a", "jobDescriptionId": "b"})).status_code == 401
    assert (await client.get(f"{URL}/{ObjectId()}")).status_code == 401


async def test_create_returns_a_complete_report(client, auth):
    resume, job, report = await setup(client, auth)
    assert isinstance(report["overallScore"], int) and 0 <= report["overallScore"] <= 100
    assert report["recommendation"] in {"READY_TO_APPLY", "IMPROVE_BEFORE_APPLYING", "LOW_COMPATIBILITY"}
    assert [c["key"] for c in report["categoryScores"]] == [
        "technicalSkills", "experience", "responsibilities", "keywords", "education", "structure",
    ]
    assert report["requirements"]
    assert report["improvementRecommendations"]
    assert "not a guarantee" in report["disclaimer"]
    assert report["analysisMode"] == "rule_based"
    assert report["resumeId"] == resume["id"] and report["jobDescriptionId"] == job["id"]
    assert report["jobTitle"] == "Backend Engineer" and report["companyName"] == "Acme Corp"
    assert report["resumeName"] == resume["displayName"]
    assert "userId" not in report


async def test_report_reflects_the_resume_and_the_job(client, auth):
    _, _, report = await setup(client, auth)
    assert "Python" in report["matchedSkills"]
    assert "Terraform" in report["missingSkills"]
    kubernetes = next(r for r in report["requirements"] if r["requirement"] == "Kubernetes")
    assert kubernetes["status"] == "PARTIAL_MATCH"  # Docker is related to Kubernetes
    assert report["mandatoryGapCount"] == len(report["mandatoryGaps"])


async def test_report_endpoint_matches_the_detail_endpoint(client, auth):
    _, _, report = await setup(client, auth)
    detail = (await client.get(f"{URL}/{report['id']}", headers=auth)).json()["data"]
    full = (await client.get(f"{URL}/{report['id']}/report", headers=auth)).json()["data"]
    assert detail == full
    assert detail["overallScore"] == report["overallScore"]


async def test_list_returns_summaries_without_the_heavy_report(client, auth):
    _, _, report = await setup(client, auth)
    response = await client.get(URL, headers=auth)
    body = response.json()
    assert body["meta"]["total"] == 1
    item = body["data"][0]
    assert item["id"] == report["id"]
    assert item["overallScore"] == report["overallScore"]
    assert item["jobTitle"] == "Backend Engineer"
    for heavy in ("requirements", "improvementRecommendations", "extractedRequirements", "userId"):
        assert heavy not in item


async def test_validation_and_unknown_ids(client, auth):
    assert (await client.post(URL, json={}, headers=auth)).status_code == 422
    resume = await upload_resume(client, auth)
    job = await create_job(client, auth)
    missing = await client.post(URL, json={"resumeId": str(ObjectId()), "jobDescriptionId": job["id"]}, headers=auth)
    assert missing.status_code == 404
    bad_job = await client.post(URL, json={"resumeId": resume["id"], "jobDescriptionId": "not-an-id"}, headers=auth)
    assert bad_job.status_code == 404


async def test_users_cannot_analyse_or_read_each_others_data(client, auth, other_auth):
    resume, job, report = await setup(client, auth)

    # Bob cannot analyse Alice's resume or job, even with valid ids.
    attempt = await create_analysis(client, other_auth, resume, job)
    assert attempt.status_code == 404

    # Bob cannot read, list or delete Alice's analysis.
    assert (await client.get(f"{URL}/{report['id']}", headers=other_auth)).status_code == 404
    assert (await client.get(f"{URL}/{report['id']}/report", headers=other_auth)).status_code == 404
    assert (await client.delete(f"{URL}/{report['id']}", headers=other_auth)).status_code == 404
    assert (await client.get(URL, headers=other_auth)).json()["meta"]["total"] == 0

    # ...and Alice's analysis is untouched.
    assert (await client.get(f"{URL}/{report['id']}", headers=auth)).status_code == 200


async def test_delete_removes_the_analysis(client, auth):
    _, _, report = await setup(client, auth)
    assert (await client.delete(f"{URL}/{report['id']}", headers=auth)).status_code == 200
    assert (await client.get(f"{URL}/{report['id']}", headers=auth)).status_code == 404
    assert (await client.delete(f"{URL}/{report['id']}", headers=auth)).status_code == 404


async def test_a_resume_without_readable_text_is_rejected_with_a_clear_error(client, auth, db):
    resume = await upload_resume(client, auth)
    job = await create_job(client, auth)
    await db[RESUMES].update_one({"_id": ObjectId(resume["id"])}, {"$set": {"parsedText": ""}})
    response = await create_analysis(client, auth, resume, job)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "RESUME_UNREADABLE"


async def test_the_report_survives_deleting_the_job_and_the_resume(client, auth):
    resume, job, report = await setup(client, auth)
    assert (await client.delete(f"/api/v1/jobs/{job['id']}", headers=auth)).status_code == 200
    detail = (await client.get(f"{URL}/{report['id']}", headers=auth)).json()["data"]
    assert detail["jobTitle"] == "Backend Engineer"  # saved copy, the job itself is gone

    assert (await client.delete(f"/api/v1/resumes/{resume['id']}", headers=auth)).status_code == 200
    # Deleting a resume also deletes the analyses made from it (stated in the delete dialog).
    assert (await client.get(f"{URL}/{report['id']}", headers=auth)).status_code == 404
