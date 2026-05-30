import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — registers all models with Base.metadata
from app.auth import (
    _get_any_authenticated_user,
    get_current_company,
    get_current_user,
    hash_password,
)
from app.database import Base, get_db
from app.limiter import login_rate_limit
from app.main import app
from app.models.company import Company
from app.models.user import User
from app.models.user_company_access import UserCompanyAccess

# StaticPool keeps a single connection so all sessions share the same in-memory db.
_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

_TEST_COMPANY_ID = 1

# Reusable mock platform owner — used by auth dependency overrides in `client`.
_MOCK_ADMIN = User(
    id=999,
    username="testadmin",
    password_hash="",
    platform_role="owner",
    is_active=True,
    must_change_password=False,
)


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


def _seed_company():
    """Insert the default test company (id=1) so company-scoped endpoints work."""
    db = _Session()
    try:
        if not db.get(Company, _TEST_COMPANY_ID):
            db.add(Company(
                id=_TEST_COMPANY_ID,
                name="Test Company",
                currency="SGD",
                financial_year_end="12-31",
            ))
            db.commit()
    finally:
        db.close()


@pytest.fixture
def client(_reset_db):
    """
    Standard test client: DB overridden, auth bypassed with a mock platform owner.
    Company 1 is pre-seeded so setup and company-scoped endpoints work.
    """
    _seed_company()
    app.dependency_overrides[get_db] = _db_override
    app.dependency_overrides[get_current_user] = lambda: _MOCK_ADMIN
    app.dependency_overrides[_get_any_authenticated_user] = lambda: _MOCK_ADMIN
    app.dependency_overrides[get_current_company] = lambda: (_MOCK_ADMIN, _TEST_COMPANY_ID, 6)
    app.dependency_overrides[login_rate_limit] = lambda: None
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
    app.dependency_overrides[login_rate_limit] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def create_user():
    """
    Factory fixture: inserts a User, ensures Company 1 exists, and grants the
    user per-company access. Returns plain-text credentials so tests can call
    /auth/login and /auth/select-company.

    Usage:  user = create_user("alice", "Pass1234", level=3)
    """
    def _factory(
        username: str,
        password: str,
        level: int = 1,
        platform_role: str = "user",
    ) -> dict:
        db = _Session()
        try:
            if not db.get(Company, _TEST_COMPANY_ID):
                db.add(Company(
                    id=_TEST_COMPANY_ID,
                    name="Test Company",
                    currency="SGD",
                    financial_year_end="12-31",
                ))
                db.flush()

            u = User(
                username=username,
                password_hash=hash_password(password),
                platform_role=platform_role,
                is_active=True,
                must_change_password=False,
            )
            db.add(u)
            db.flush()

            db.add(UserCompanyAccess(
                user_id=u.id,
                company_id=_TEST_COMPANY_ID,
                access_level=level,
            ))
            db.commit()
            db.refresh(u)
            return {
                "id": u.id,
                "username": username,
                "password": password,
                "access_level": level,
                "platform_role": platform_role,
            }
        finally:
            db.close()
    return _factory
