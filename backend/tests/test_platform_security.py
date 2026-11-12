from tests.helpers import DOCX_MIME, make_docx


async def test_health_endpoint_and_security_headers(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ok"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"


async def test_api_responses_are_not_cacheable(client, auth):
    response = await client.get("/api/v1/auth/me", headers=auth)
    assert response.headers["cache-control"] == "no-store"


async def test_oversized_request_body_is_rejected_with_413(client, auth):
    from app.config import settings

    too_big = b"A" * (settings.max_request_body_bytes + 1024)
    response = await client.post(
        "/api/v1/resumes",
        files={"file": ("big.docx", too_big, DOCX_MIME)},
        headers=auth,
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"


async def test_refresh_rejects_untrusted_origin(client):
    blocked = await client.post("/api/v1/auth/refresh", headers={"Origin": "https://evil.example"})
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "UNTRUSTED_ORIGIN"

    # A trusted origin passes the origin check (and then fails only because no cookie was sent).
    allowed = await client.post("/api/v1/auth/refresh", headers={"Origin": "http://localhost:3000"})
    assert allowed.status_code == 401
    assert allowed.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"


async def test_logout_rejects_untrusted_origin(client):
    response = await client.post("/api/v1/auth/logout", headers={"Origin": "https://evil.example"})
    assert response.status_code == 403


async def test_cors_allows_only_configured_origin(client):
    ok = await client.options(
        "/api/v1/resumes",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert ok.headers.get("access-control-allow-credentials") == "true"

    denied = await client.options(
        "/api/v1/resumes",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in denied.headers


async def test_validation_errors_do_not_echo_submitted_values(client):
    response = await client.post(
        "/api/v1/auth/register", json={"fullName": "X", "email": "not-an-email", "password": "SuperSecret123"}
    )
    assert response.status_code == 422
    assert "SuperSecret123" not in response.text


async def test_rate_limiting_blocks_repeated_login_attempts(client, monkeypatch):
    from app.config import settings
    from app.core.rate_limit import limiter

    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    limiter.reset()
    try:
        statuses = [
            (await client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "Whatever123"})).status_code
            for _ in range(12)
        ]
    finally:
        limiter.reset()
    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429
