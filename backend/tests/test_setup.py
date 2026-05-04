def test_get_setup_empty(client):
    r = client.get("/setup")
    assert r.status_code == 200
    data = r.json()
    for key in ("company_name", "currency", "financial_year_end", "current_period"):
        assert key in data


def test_update_and_get(client):
    r = client.put("/setup", json={"company_name": "ACME Ltd", "currency": "SGD"})
    assert r.status_code == 200
    data = r.json()
    assert data["company_name"] == "ACME Ltd"
    assert data["currency"] == "SGD"

    r = client.get("/setup")
    assert r.json()["company_name"] == "ACME Ltd"


def test_partial_update_preserves_other_keys(client):
    client.put("/setup", json={"company_name": "ACME Ltd", "currency": "SGD"})
    client.put("/setup", json={"currency": "USD"})
    r = client.get("/setup")
    data = r.json()
    assert data["company_name"] == "ACME Ltd"
    assert data["currency"] == "USD"


def test_update_all_fields(client):
    body = {
        "company_name": "Test Corp",
        "currency": "MYR",
        "financial_year_end": "12-31",
        "current_period": "2023-12-31",
    }
    r = client.put("/setup", json=body)
    assert r.status_code == 200
    data = r.json()
    for k, v in body.items():
        assert data[k] == v
    assert "locked_before" in data


def test_update_empty_body_is_noop(client):
    client.put("/setup", json={"company_name": "Before"})
    r = client.put("/setup", json={})
    assert r.status_code == 200
    assert r.json()["company_name"] == "Before"
