import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — registers all models with Base.metadata
from app.auth import get_current_user, hash_password
from app.database import Base, get_db
from app.main import app
from app.models.user import User

# StaticPool keeps a single connection so all sessions share the same in-memory db.
_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

# Reusable mock admin — returned by the get_current_user override in `client`.
# id=999 is outside normal test data ranges; access_level=6 passes all level checks.
_MOCK_ADMIN = User(id=999, username="testadmin", password_hash="", access_level=6)


@pytest.fixture(autouse=True)
def _reset_db():
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


def _db_override():
    db = _Session()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(_reset_db):
    """
    Standard test client: DB overridden, auth bypassed with a mock level-6 admin.
    All existing endpoint tests use this fixture.
    """
    app.dependency_overrides[get_db] = _db_override
    app.dependency_overrides[get_current_user] = lambda: _MOCK_ADMIN
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def raw_client(_reset_db):
    """
    Client with only DB overridden — real JWT auth is in effect.
    Use this fixture in auth and access-level tests.
    """
    app.dependency_overrides[get_db] = _db_override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def create_user():
    """
    Factory fixture: inserts a User directly into the test DB (bypasses the API).
    Returns the plain-text credentials dict so tests can call /auth/login.
    Usage:  user = create_user("alice", "pass123", level=3)
    """
    def _factory(username: str, password: str, level: int = 1) -> dict:
        db = _Session()
        try:
            u = User(
                username=username,
                password_hash=hash_password(password),
                access_level=level,
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            return {"id": u.id, "username": username, "password": password, "access_level": level}
        finally:
            db.close()
    return _factory
