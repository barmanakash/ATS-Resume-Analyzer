import httpx

from tests.conftest import PASSWORD, register_and_login
from tests.helpers import DOCX_MIME, RESUME_LINES, make_docx

ME = "/api/v1/users/me"
NEW_PASSWORD = "An0therStrongPass"


async def upload_resume(client, headers):
    files = {"file": ("cv.docx", make_docx(RESUME_LINES), DOCX_MIME)}
    response = await client.post("/api/v1/resumes", files=files, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def add_job(client, headers):
    body = {"jobTitle": "Engineer", "companyName": "Acme", "description": "Build and run backend services in Python."}
    assert (await client.post("/api/v1/jobs", json=body, headers=headers)).status_code == 201


# ---------- profile ----------


async def test_get_and_update_profile(client, auth):
    me = (await client.get(ME, headers=auth)).json()["data"]
    assert me["email"] == "alice@example.com"
    assert "passwordHash" not in me

    updated = await client.patch(ME, json={"fullName": "  Alice Smith  "}, headers=auth)
    assert updated.status_code == 200
    assert updated.json()["data"]["fullName"] == "Alice Smith"
    assert (await client.get("/api/v1/auth/me", headers=auth)).json()["data"]["fullName"] == "Alice Smith"


async def test_profile_update_validates_name(client, auth):
    assert (await client.patch(ME, json={"fullName": "A"}, headers=auth)).status_code == 422
    assert (await client.patch(ME, json={}, headers=auth)).status_code == 422


async def test_user_endpoints_require_authentication(client):
    for method, path in [("GET", ""), ("PATCH", ""), ("DELETE", ""), ("DELETE", "/data"), ("POST", "/change-password")]:
        assert (await client.request(method, f"{ME}{path}")).status_code == 401


# ---------- change password ----------


async def test_change_password_rejects_wrong_current_password(client, auth):
    response = await client.post(
        f"{ME}/change-password", json={"currentPassword": "WrongPassw0rd", "newPassword": NEW_PASSWORD}, headers=auth
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_CURRENT_PASSWORD"


async def test_change_password_rejects_weak_or_unchanged_password(client, auth):
    weak = await client.post(
        f"{ME}/change-password", json={"currentPassword": PASSWORD, "newPassword": "alllowercase1"}, headers=auth
    )
    assert weak.status_code == 422
    same = await client.post(
        f"{ME}/change-password", json={"currentPassword": PASSWORD, "newPassword": PASSWORD}, headers=auth
    )
    assert same.status_code == 400
    assert same.json()["error"]["code"] == "SAME_PASSWORD"


async def test_change_password_signs_out_other_devices_but_keeps_this_one(client, auth):
    from app.main import app

    # A second device logs in with the old password.
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as other_device:
        login = await other_device.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": PASSWORD})
        assert login.status_code == 200

        changed = await client.post(
            f"{ME}/change-password", json={"currentPassword": PASSWORD, "newPassword": NEW_PASSWORD}, headers=auth
        )
        assert changed.status_code == 200
        assert changed.json()["data"]["accessToken"]

        # The other device's refresh token no longer works.
        assert (await other_device.post("/api/v1/auth/refresh")).status_code == 401

    # This device still holds a working session (new refresh cookie was issued).
    assert (await client.post("/api/v1/auth/refresh")).status_code == 200

    # Old password is dead, new password works.
    assert (await client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": PASSWORD})).status_code == 401
    assert (await client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": NEW_PASSWORD})).status_code == 200


# ---------- data deletion ----------


async def test_delete_data_requires_the_correct_password(client, auth):
    await upload_resume(client, auth)
    response = await client.request("DELETE", f"{ME}/data", json={"password": "WrongPassw0rd"}, headers=auth)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_PASSWORD"
    assert (await client.get("/api/v1/resumes", headers=auth)).json()["meta"]["total"] == 1


async def test_delete_data_removes_everything_but_keeps_the_account(client, auth, other_auth, storage_dir):
    await upload_resume(client, auth)
    await add_job(client, auth)
    await upload_resume(client, other_auth)

    response = await client.request("DELETE", f"{ME}/data", json={"password": PASSWORD}, headers=auth)
    assert response.status_code == 200

    assert (await client.get("/api/v1/resumes", headers=auth)).json()["meta"]["total"] == 0
    assert (await client.get("/api/v1/jobs", headers=auth)).json()["meta"]["total"] == 0
    assert (await client.get(ME, headers=auth)).status_code == 200  # account still exists
    # Only the other user's file remains on disk, and their data is untouched.
    assert len([p for p in storage_dir.rglob("*") if p.is_file()]) == 1
    assert (await client.get("/api/v1/resumes", headers=other_auth)).json()["meta"]["total"] == 1


async def test_delete_account_removes_user_files_and_sessions(client, auth, other_auth, db, storage_dir):
    await upload_resume(client, auth)
    await add_job(client, auth)
    await upload_resume(client, other_auth)

    wrong = await client.request("DELETE", ME, json={"password": "WrongPassw0rd"}, headers=auth)
    assert wrong.status_code == 400

    response = await client.request("DELETE", ME, json={"password": PASSWORD}, headers=auth)
    assert response.status_code == 200

    assert await db["users"].count_documents({"email": "alice@example.com"}) == 0
    assert await db["resumes"].count_documents({}) == 1  # only bob's resume
    assert await db["job_descriptions"].count_documents({}) == 0
    assert len([p for p in storage_dir.rglob("*") if p.is_file()]) == 1

    # The deleted account can no longer log in or refresh, and the old token is dead.
    assert (await client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": PASSWORD})).status_code == 401
    assert (await client.post("/api/v1/auth/refresh")).status_code == 401
    assert (await client.get(ME, headers=auth)).status_code == 401
