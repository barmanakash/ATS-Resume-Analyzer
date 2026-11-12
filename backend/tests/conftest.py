import os

# Settings are read when the app is first imported, so the test environment is set first.
# These are forced (not setdefault) so a developer's real .env can never leak into the tests.
os.environ["APP_ENV"] = "test"
os.environ["MONGODB_URI"] = "mongodb://localhost:27017"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-that-is-long-enough-1234567890"
os.environ["REQUIRE_EMAIL_VERIFICATION"] = "false"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["COOKIE_SECURE"] = "false"
os.environ["COOKIE_SAMESITE"] = "lax"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
os.environ["STORAGE_BACKEND"] = "local"

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.config import settings  # noqa: E402
from app.database.mongodb import set_database  # noqa: E402

PASSWORD = "Str0ngPassw0rd"


@pytest.fixture
def db():
    from mongomock_motor import AsyncMongoMockClient

    database = AsyncMongoMockClient()["ats_test"]
    set_database(database)
    yield database
    set_database(None)


@pytest.fixture
def storage_dir(tmp_path, monkeypatch):
    path = tmp_path / "storage"
    monkeypatch.setattr(settings, "local_storage_dir", str(path))
    return path


@pytest.fixture
async def client(db, storage_dir):
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


async def register_and_login(http: httpx.AsyncClient, email: str, password: str = PASSWORD) -> dict:
    """Creates an account and returns Authorization headers for it."""
    created = await http.post(
        "/api/v1/auth/register", json={"fullName": "Test User", "email": email, "password": password}
    )
    assert created.status_code == 201, created.text
    logged_in = await http.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert logged_in.status_code == 200, logged_in.text
    return {"Authorization": f"Bearer {logged_in.json()['data']['accessToken']}"}


@pytest.fixture
async def auth(client):
    return await register_and_login(client, "alice@example.com")


@pytest.fixture
async def other_auth(client):
    # A second, separate client so the two users never share a cookie jar.
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as other:
        yield await register_and_login(other, "bob@example.com")
