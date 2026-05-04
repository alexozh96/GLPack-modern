def test_list_empty(client):
    r = client.get("/phrases")
    assert r.status_code == 200
    assert r.json() == []


def test_create_and_list(client):
    r = client.post("/phrases", json={"phrase": "Office Supplies", "dr_code": "EX01", "cr_code": "CA01"})
    assert r.status_code == 201
    data = r.json()
    assert data["phrase"] == "Office Supplies"
    assert data["dr_code"] == "EX01"
    assert data["cr_code"] == "CA01"
    assert "id" in data

    r = client.get("/phrases")
    assert len(r.json()) == 1


def test_create_without_codes(client):
    r = client.post("/phrases", json={"phrase": "Generic Entry"})
    assert r.status_code == 201
    data = r.json()
    assert data["dr_code"] is None
    assert data["cr_code"] is None


def test_create_duplicate_raises_409(client):
    body = {"phrase": "Office Supplies", "dr_code": "EX01", "cr_code": "CA01"}
    client.post("/phrases", json=body)
    r = client.post("/phrases", json=body)
    assert r.status_code == 409


def test_phrase_too_long(client):
    r = client.post("/phrases", json={"phrase": "X" * 46})
    assert r.status_code == 422


def test_search(client):
    client.post("/phrases", json={"phrase": "Office Supplies"})
    client.post("/phrases", json={"phrase": "Bank Charges"})

    r = client.get("/phrases?search=office")
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    assert results[0]["phrase"] == "Office Supplies"


def test_delete(client):
    r = client.post("/phrases", json={"phrase": "Test Phrase"})
    phrase_id = r.json()["id"]

    r = client.delete(f"/phrases/{phrase_id}")
    assert r.status_code == 204

    r = client.get("/phrases")
    assert r.json() == []


def test_delete_not_found(client):
    r = client.delete("/phrases/9999")
    assert r.status_code == 404


def test_codes_normalised_to_upper(client):
    r = client.post("/phrases", json={"phrase": "Test", "dr_code": "ca01", "cr_code": "sc01"})
    data = r.json()
    assert data["dr_code"] == "CA01"
    assert data["cr_code"] == "SC01"


def test_list_sorted_alphabetically(client):
    client.post("/phrases", json={"phrase": "Zebra"})
    client.post("/phrases", json={"phrase": "Alpha"})
    r = client.get("/phrases")
    phrases = [p["phrase"] for p in r.json()]
    assert phrases == sorted(phrases)
