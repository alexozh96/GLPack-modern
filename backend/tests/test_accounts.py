def test_list_empty(client):
    r = client.get("/accounts")
    assert r.status_code == 200
    assert r.json() == []


def test_create_and_get(client):
    r = client.post("/accounts", json={"code": "ca01", "name": "Cash"})
    assert r.status_code == 201
    data = r.json()
    assert data["code"] == "CA01"
    assert data["name"] == "Cash"

    r = client.get("/accounts/CA01")
    assert r.status_code == 200
    assert r.json()["name"] == "Cash"


def test_get_normalises_case(client):
    client.post("/accounts", json={"code": "CA01", "name": "Cash"})
    r = client.get("/accounts/ca01")
    assert r.status_code == 200


def test_get_not_found(client):
    r = client.get("/accounts/XXXX")
    assert r.status_code == 404


def test_create_duplicate(client):
    client.post("/accounts", json={"code": "CA01", "name": "Cash"})
    r = client.post("/accounts", json={"code": "CA01", "name": "Cash 2"})
    assert r.status_code == 409


def test_create_code_too_long(client):
    r = client.post("/accounts", json={"code": "ABCDE", "name": "Too long code"})
    assert r.status_code == 422


def test_create_name_too_long(client):
    r = client.post("/accounts", json={"code": "CA01", "name": "X" * 31})
    assert r.status_code == 422


def test_update(client):
    client.post("/accounts", json={"code": "CA01", "name": "Cash"})
    r = client.put("/accounts/CA01", json={"name": "Cash Updated"})
    assert r.status_code == 200
    assert r.json()["name"] == "Cash Updated"


def test_update_not_found(client):
    r = client.put("/accounts/XXXX", json={"name": "Ghost"})
    assert r.status_code == 404


def test_delete(client):
    client.post("/accounts", json={"code": "CA01", "name": "Cash"})
    r = client.delete("/accounts/CA01")
    assert r.status_code == 204
    r = client.get("/accounts/CA01")
    assert r.status_code == 404


def test_delete_not_found(client):
    r = client.delete("/accounts/XXXX")
    assert r.status_code == 404


def test_search_by_name(client):
    client.post("/accounts", json={"code": "CA01", "name": "Cash at Bank"})
    client.post("/accounts", json={"code": "CA02", "name": "Petty Cash"})
    client.post("/accounts", json={"code": "SC01", "name": "Share Capital"})

    r = client.get("/accounts?search=cash")
    assert r.status_code == 200
    codes = [a["code"] for a in r.json()]
    assert "CA01" in codes
    assert "CA02" in codes
    assert "SC01" not in codes


def test_search_by_code(client):
    client.post("/accounts", json={"code": "CA01", "name": "Bank Deposits"})
    client.post("/accounts", json={"code": "SC01", "name": "Equity"})

    r = client.get("/accounts?search=CA")
    codes = [a["code"] for a in r.json()]
    assert "CA01" in codes
    assert "SC01" not in codes


def test_prefix_filter(client):
    client.post("/accounts", json={"code": "CA01", "name": "Cash A"})
    client.post("/accounts", json={"code": "CA02", "name": "Cash B"})
    client.post("/accounts", json={"code": "SC01", "name": "Share Capital"})

    r = client.get("/accounts?prefix=CA")
    assert r.status_code == 200
    codes = [a["code"] for a in r.json()]
    assert "CA01" in codes
    assert "CA02" in codes
    assert "SC01" not in codes


def test_list_sorted_by_code(client):
    client.post("/accounts", json={"code": "SC01", "name": "Share Capital"})
    client.post("/accounts", json={"code": "CA01", "name": "Cash"})
    r = client.get("/accounts")
    codes = [a["code"] for a in r.json()]
    assert codes == sorted(codes)
