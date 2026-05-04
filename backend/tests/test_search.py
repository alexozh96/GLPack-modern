def test_search_accounts(client):
    client.post("/accounts", json={"code": "SA01", "name": "Sales Revenue"})
    r = client.get("/search", params={"q": "sales"})
    assert r.status_code == 200
    data = r.json()
    assert any(a["code"] == "SA01" for a in data["accounts"])


def test_search_by_account_code(client):
    client.post("/accounts", json={"code": "CB01", "name": "Bank Account"})
    r = client.get("/search", params={"q": "CB01"})
    assert r.status_code == 200
    assert any(a["code"] == "CB01" for a in r.json()["accounts"])


def test_search_phrases(client):
    client.post("/accounts", json={"code": "SA01", "name": "Sales"})
    client.post("/accounts", json={"code": "CB01", "name": "Bank"})
    client.post("/phrases", json={"phrase": "Cash sale", "dr_code": "CB01", "cr_code": "SA01"})
    r = client.get("/search", params={"q": "cash"})
    assert r.status_code == 200
    assert any(p["phrase"] == "Cash sale" for p in r.json()["phrases"])


def test_search_journal_particulars(client):
    client.post("/accounts", json={"code": "CB01", "name": "Bank"})
    client.post("/accounts", json={"code": "SA01", "name": "Sales"})
    client.post("/journal", json={
        "date": "2024-05-01",
        "lines": [
            {"account": "CB01", "particular": "Widget payment", "dr_amount": "100", "cr_amount": "0"},
            {"account": "SA01", "particular": "Widget payment", "dr_amount": "0", "cr_amount": "100"},
        ],
    })
    r = client.get("/search", params={"q": "widget"})
    assert r.status_code == 200
    assert len(r.json()["journal_entries"]) == 1


def test_search_no_results(client):
    r = client.get("/search", params={"q": "zzznomatch"})
    assert r.status_code == 200
    data = r.json()
    assert data["accounts"] == []
    assert data["phrases"] == []
    assert data["journal_entries"] == []


def test_search_query_too_short(client):
    r = client.get("/search", params={"q": "x"})
    assert r.status_code == 422
