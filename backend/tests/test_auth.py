"""
Tests for Phase 6 — authentication endpoints and access-level enforcement.

Uses `raw_client` (real JWT in effect) and `create_user` (direct DB insert).
"""

import pytest


# ── helpers ───────────────────────────────────────────────────────────────────

def _login(raw_client, username: str, password: str) -> dict:
    r = raw_client.post("/auth/login", json={"username": username, "password": password})
    return r


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── login ─────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_valid_credentials_return_token(self, raw_client, create_user):
        create_user("alice", "secret1", level=1)
        r = _login(raw_client, "alice", "secret1")
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 20

    def test_wrong_password_returns_401(self, raw_client, create_user):
        create_user("bob", "correctpass", level=1)
        r = _login(raw_client, "bob", "wrongpass")
        assert r.status_code == 401

    def test_unknown_user_returns_401(self, raw_client):
        r = _login(raw_client, "nobody", "pass")
        assert r.status_code == 401

    def test_token_type_is_bearer(self, raw_client, create_user):
        create_user("carol", "pass123", level=1)
        r = _login(raw_client, "carol", "pass123")
        assert r.json()["token_type"] == "bearer"


# ── /auth/me ──────────────────────────────────────────────────────────────────

class TestMe:
    def test_returns_current_user(self, raw_client, create_user):
        u = create_user("dan", "pass123", level=3)
        r = _login(raw_client, "dan", "pass123")
        token = r.json()["access_token"]

        me = raw_client.get("/auth/me", headers=_auth_header(token))
        assert me.status_code == 200
        data = me.json()
        assert data["username"] == "dan"
        assert data["access_level"] == 3
        assert data["id"] == u["id"]

    def test_no_token_returns_401(self, raw_client):
        r = raw_client.get("/auth/me")
        assert r.status_code == 401

    def test_invalid_token_returns_401(self, raw_client):
        r = raw_client.get("/auth/me", headers={"Authorization": "Bearer not.a.token"})
        assert r.status_code == 401


# ── logout ────────────────────────────────────────────────────────────────────

class TestLogout:
    def test_logout_invalidates_token(self, raw_client, create_user):
        create_user("eve", "pass123", level=1)
        token = _login(raw_client, "eve", "pass123").json()["access_token"]
        hdrs = _auth_header(token)

        # Token works before logout
        assert raw_client.get("/auth/me", headers=hdrs).status_code == 200

        # Logout
        lo = raw_client.post("/auth/logout", headers=hdrs)
        assert lo.status_code == 204

        # Token rejected after logout
        assert raw_client.get("/auth/me", headers=hdrs).status_code == 401

    def test_logout_without_token_returns_401(self, raw_client):
        r = raw_client.post("/auth/logout")
        assert r.status_code == 401

    def test_double_logout_is_harmless(self, raw_client, create_user):
        create_user("frank", "pass123", level=1)
        token = _login(raw_client, "frank", "pass123").json()["access_token"]
        hdrs = _auth_header(token)
        raw_client.post("/auth/logout", headers=hdrs)
        # Second logout with now-invalid token → 401
        r = raw_client.post("/auth/logout", headers=hdrs)
        assert r.status_code == 401


# ── unauthenticated access to protected endpoints ─────────────────────────────

class TestProtectedEndpoints:
    def test_accounts_requires_auth(self, raw_client):
        r = raw_client.get("/accounts")
        assert r.status_code == 401

    def test_journal_requires_auth(self, raw_client):
        r = raw_client.get("/journal")
        assert r.status_code == 401

    def test_reports_requires_auth(self, raw_client):
        r = raw_client.get("/reports/trial-balance?period_start=2022-01-01&period_end=2022-12-31")
        assert r.status_code == 401

    def test_health_is_public(self, raw_client):
        r = raw_client.get("/health")
        assert r.status_code == 200


# ── access level enforcement ──────────────────────────────────────────────────

class TestAccessLevels:
    def _get_token(self, raw_client, create_user, level: int) -> str:
        username = f"user_level{level}"
        create_user(username, "pass123", level=level)
        return _login(raw_client, username, "pass123").json()["access_token"]

    def test_level1_can_read_accounts(self, raw_client, create_user):
        token = self._get_token(raw_client, create_user, 1)
        r = raw_client.get("/accounts", headers=_auth_header(token))
        assert r.status_code == 200

    def test_level1_cannot_create_account(self, raw_client, create_user):
        token = self._get_token(raw_client, create_user, 1)
        r = raw_client.post(
            "/accounts",
            json={"code": "SA01", "name": "Sales"},
            headers=_auth_header(token),
        )
        assert r.status_code == 403

    def test_level3_cannot_create_account(self, raw_client, create_user):
        token = self._get_token(raw_client, create_user, 3)
        r = raw_client.post(
            "/accounts",
            json={"code": "SA01", "name": "Sales"},
            headers=_auth_header(token),
        )
        assert r.status_code == 403

    def test_level6_can_create_account(self, raw_client, create_user):
        token = self._get_token(raw_client, create_user, 6)
        r = raw_client.post(
            "/accounts",
            json={"code": "SA01", "name": "Sales"},
            headers=_auth_header(token),
        )
        assert r.status_code == 201

    def test_level1_cannot_post_journal(self, raw_client, create_user):
        admin_token = self._get_token(raw_client, create_user, 6)
        raw_client.post("/accounts", json={"code": "CA01", "name": "Cash"}, headers=_auth_header(admin_token))
        raw_client.post("/accounts", json={"code": "SA01", "name": "Sales"}, headers=_auth_header(admin_token))

        token = self._get_token(raw_client, create_user, 1)
        r = raw_client.post(
            "/journal",
            json={
                "date": "2022-01-01",
                "lines": [
                    {"account": "CA01", "particular": "x", "dr_amount": "100", "cr_amount": "0"},
                    {"account": "SA01", "particular": "x", "dr_amount": "0", "cr_amount": "100"},
                ],
            },
            headers=_auth_header(token),
        )
        assert r.status_code == 403

    def test_level3_can_post_journal(self, raw_client, create_user):
        admin_token = self._get_token(raw_client, create_user, 6)
        raw_client.post("/accounts", json={"code": "CA01", "name": "Cash"}, headers=_auth_header(admin_token))
        raw_client.post("/accounts", json={"code": "SA01", "name": "Sales"}, headers=_auth_header(admin_token))

        token = self._get_token(raw_client, create_user, 3)
        r = raw_client.post(
            "/journal",
            json={
                "date": "2022-01-01",
                "lines": [
                    {"account": "CA01", "particular": "x", "dr_amount": "100", "cr_amount": "0"},
                    {"account": "SA01", "particular": "x", "dr_amount": "0", "cr_amount": "100"},
                ],
            },
            headers=_auth_header(token),
        )
        assert r.status_code == 201
