"""
Tests for /users CRUD endpoints (admin-only, Phase 6).

Uses `client` fixture (mock admin bypass) for CRUD tests, and
`raw_client` + `create_user` for access-level tests.
"""

import pytest


# ── list ──────────────────────────────────────────────────────────────────────

class TestListUsers:
    def test_empty_list(self, client):
        r = client.get("/users")
        assert r.status_code == 200
        assert r.json() == []

    def test_lists_created_users(self, client):
        client.post("/users", json={"username": "alice", "password": "pass1234", "access_level": 1})
        client.post("/users", json={"username": "bob", "password": "pass1234", "access_level": 3})
        r = client.get("/users")
        assert r.status_code == 200
        names = [u["username"] for u in r.json()]
        assert "alice" in names
        assert "bob" in names


# ── create ────────────────────────────────────────────────────────────────────

class TestCreateUser:
    def test_create_returns_user(self, client):
        r = client.post("/users", json={"username": "carol", "password": "pass1234", "access_level": 1})
        assert r.status_code == 201
        data = r.json()
        assert data["username"] == "carol"
        assert data["access_level"] == 1
        assert "password" not in data
        assert "password_hash" not in data

    def test_create_default_level_is_1(self, client):
        r = client.post("/users", json={"username": "dave", "password": "pass1234"})
        assert r.status_code == 201
        assert r.json()["access_level"] == 1

    def test_duplicate_username_returns_409(self, client):
        client.post("/users", json={"username": "eve", "password": "pass1234"})
        r = client.post("/users", json={"username": "eve", "password": "different"})
        assert r.status_code == 409

    def test_short_password_returns_422(self, client):
        r = client.post("/users", json={"username": "frank", "password": "x"})
        assert r.status_code == 422

    def test_invalid_level_returns_422(self, client):
        r = client.post("/users", json={"username": "grace", "password": "pass1234", "access_level": 2})
        assert r.status_code == 422

    def test_blank_username_returns_422(self, client):
        r = client.post("/users", json={"username": "  ", "password": "pass1234"})
        assert r.status_code == 422

    def test_username_too_long_returns_422(self, client):
        r = client.post("/users", json={"username": "a" * 21, "password": "pass1234"})
        assert r.status_code == 422

    def test_all_valid_levels(self, client):
        for level in (1, 3, 6):
            r = client.post("/users", json={"username": f"u{level}", "password": "pass1234", "access_level": level})
            assert r.status_code == 201


# ── get by id ─────────────────────────────────────────────────────────────────

class TestGetUser:
    def test_get_existing(self, client):
        created = client.post("/users", json={"username": "henry", "password": "pass1234"}).json()
        r = client.get(f"/users/{created['id']}")
        assert r.status_code == 200
        assert r.json()["username"] == "henry"

    def test_get_not_found(self, client):
        r = client.get("/users/9999")
        assert r.status_code == 404


# ── update ────────────────────────────────────────────────────────────────────

class TestUpdateUser:
    def test_update_username(self, client):
        u = client.post("/users", json={"username": "ivan", "password": "pass1234"}).json()
        r = client.put(f"/users/{u['id']}", json={"username": "ivan2"})
        assert r.status_code == 200
        assert r.json()["username"] == "ivan2"

    def test_update_access_level(self, client):
        u = client.post("/users", json={"username": "jane", "password": "pass1234", "access_level": 1}).json()
        r = client.put(f"/users/{u['id']}", json={"access_level": 3})
        assert r.status_code == 200
        assert r.json()["access_level"] == 3

    def test_update_password_works(self, client, raw_client, create_user):
        u = client.post("/users", json={"username": "karen", "password": "oldpass1"}).json()
        client.put(f"/users/{u['id']}", json={"password": "newpass1"})
        # Verify new password works via /auth/login
        r = raw_client.post("/auth/login", json={"username": "karen", "password": "newpass1"})
        assert r.status_code == 200

    def test_update_not_found(self, client):
        r = client.put("/users/9999", json={"username": "ghost"})
        assert r.status_code == 404

    def test_duplicate_username_returns_409(self, client):
        client.post("/users", json={"username": "leo", "password": "pass1234"})
        u2 = client.post("/users", json={"username": "mia", "password": "pass1234"}).json()
        r = client.put(f"/users/{u2['id']}", json={"username": "leo"})
        assert r.status_code == 409

    def test_cannot_demote_self(self, raw_client, create_user):
        # Create a real system-admin user and log in as them
        u = create_user("self_admin", "pass1234", level=6, is_system_admin=True)
        token = raw_client.post("/auth/login", json={"username": "self_admin", "password": "pass1234"}).json()["access_token"]
        hdrs = {"Authorization": f"Bearer {token}"}
        r = raw_client.put(f"/users/{u['id']}", json={"access_level": 1}, headers=hdrs)
        assert r.status_code == 422


# ── delete ────────────────────────────────────────────────────────────────────

class TestDeleteUser:
    def test_delete_user(self, client):
        u = client.post("/users", json={"username": "nina", "password": "pass1234"}).json()
        r = client.delete(f"/users/{u['id']}")
        assert r.status_code == 200
        assert r.json()["is_active"] is False
        assert client.get(f"/users/{u['id']}").status_code == 200

    def test_delete_not_found(self, client):
        r = client.delete("/users/9999")
        assert r.status_code == 404

    def test_cannot_delete_self(self, raw_client, create_user):
        u = create_user("self_del", "pass1234", level=6, is_system_admin=True)
        token = raw_client.post("/auth/login", json={"username": "self_del", "password": "pass1234"}).json()["access_token"]
        hdrs = {"Authorization": f"Bearer {token}"}
        r = raw_client.delete(f"/users/{u['id']}", headers=hdrs)
        assert r.status_code == 422


# ── non-admin access ──────────────────────────────────────────────────────────

class TestNonAdminAccess:
    def _token(self, raw_client, create_user, level: int) -> dict:
        create_user(f"lvl{level}user", "pass1234", level=level)
        t = raw_client.post("/auth/login", json={"username": f"lvl{level}user", "password": "pass1234"}).json()["access_token"]
        return {"Authorization": f"Bearer {t}"}

    def test_level1_cannot_list_users(self, raw_client, create_user):
        hdrs = self._token(raw_client, create_user, 1)
        assert raw_client.get("/users", headers=hdrs).status_code == 403

    def test_level3_cannot_create_user(self, raw_client, create_user):
        hdrs = self._token(raw_client, create_user, 3)
        r = raw_client.post("/users", json={"username": "x", "password": "pass1234"}, headers=hdrs)
        assert r.status_code == 403
