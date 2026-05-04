import pytest


@pytest.fixture
def accounts(client):
    client.post("/accounts", json={"code": "CA01", "name": "Cash"})
    client.post("/accounts", json={"code": "RE01", "name": "Revenue"})
    client.post("/accounts", json={"code": "EX01", "name": "Expenses"})


@pytest.fixture
def simple_journal(client, accounts):
    r = client.post("/journal", json={
        "date": "2022-03-15",
        "lines": [
            {"account": "CA01", "particular": "Cash received", "dr_amount": "500.00", "cr_amount": "0"},
            {"account": "RE01", "particular": "Sales revenue", "dr_amount": "0", "cr_amount": "500.00"},
        ],
    })
    assert r.status_code == 201
    return r.json()


# ── create ────────────────────────────────────────────────────────────────────

def test_create_journal_auto_trx_no(client, accounts):
    r = client.post("/journal", json={
        "date": "2022-03-15",
        "lines": [
            {"account": "CA01", "particular": "Cash received", "dr_amount": "500.00", "cr_amount": "0"},
            {"account": "RE01", "particular": "Sales revenue", "dr_amount": "0", "cr_amount": "500.00"},
        ],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["trx_no"] == "0001"
    assert data["date"] == "2022-03-15"
    assert len(data["lines"]) == 2
    assert float(data["total_dr"]) == 500.0
    assert float(data["total_cr"]) == 500.0


def test_auto_trx_no_increments(client, accounts):
    for _ in range(3):
        client.post("/journal", json={
            "date": "2022-01-01",
            "lines": [
                {"account": "CA01", "particular": "DR", "dr_amount": "1", "cr_amount": "0"},
                {"account": "RE01", "particular": "CR", "dr_amount": "0", "cr_amount": "1"},
            ],
        })
    trx_nos = [j["trx_no"] for j in client.get("/journal").json()]
    assert trx_nos == ["0001", "0002", "0003"]


def test_create_explicit_trx_no(client, accounts):
    r = client.post("/journal", json={
        "trx_no": "BD01",
        "date": "2022-03-15",
        "lines": [
            {"account": "CA01", "particular": "Cash", "dr_amount": "100", "cr_amount": "0"},
            {"account": "RE01", "particular": "Sales", "dr_amount": "0", "cr_amount": "100"},
        ],
    })
    assert r.status_code == 201
    assert r.json()["trx_no"] == "BD01"


def test_create_duplicate_trx_no(client, accounts, simple_journal):
    r = client.post("/journal", json={
        "trx_no": simple_journal["trx_no"],
        "date": "2022-04-01",
        "lines": [
            {"account": "CA01", "particular": "x", "dr_amount": "1", "cr_amount": "0"},
            {"account": "RE01", "particular": "x", "dr_amount": "0", "cr_amount": "1"},
        ],
    })
    assert r.status_code == 409


def test_create_unbalanced(client, accounts):
    r = client.post("/journal", json={
        "date": "2022-03-15",
        "lines": [
            {"account": "CA01", "particular": "Cash", "dr_amount": "500", "cr_amount": "0"},
            {"account": "RE01", "particular": "Sales", "dr_amount": "0", "cr_amount": "400"},
        ],
    })
    assert r.status_code == 422


def test_create_empty_lines(client, accounts):
    r = client.post("/journal", json={"date": "2022-03-15", "lines": []})
    assert r.status_code == 422


def test_create_line_both_zero(client, accounts):
    r = client.post("/journal", json={
        "date": "2022-03-15",
        "lines": [
            {"account": "CA01", "particular": "Bad", "dr_amount": "0", "cr_amount": "0"},
        ],
    })
    assert r.status_code == 422


def test_create_negative_amount(client, accounts):
    r = client.post("/journal", json={
        "date": "2022-03-15",
        "lines": [
            {"account": "CA01", "particular": "Bad", "dr_amount": "-100", "cr_amount": "0"},
            {"account": "RE01", "particular": "Bad", "dr_amount": "0", "cr_amount": "-100"},
        ],
    })
    assert r.status_code == 422


def test_create_unknown_account(client):
    r = client.post("/journal", json={
        "date": "2022-03-15",
        "lines": [
            {"account": "ZZZZ", "particular": "Ghost", "dr_amount": "100", "cr_amount": "0"},
            {"account": "XXXX", "particular": "Ghost", "dr_amount": "0", "cr_amount": "100"},
        ],
    })
    assert r.status_code == 422


def test_create_trx_no_too_long(client, accounts):
    r = client.post("/journal", json={
        "trx_no": "ABCDE",
        "date": "2022-03-15",
        "lines": [
            {"account": "CA01", "particular": "x", "dr_amount": "1", "cr_amount": "0"},
            {"account": "RE01", "particular": "x", "dr_amount": "0", "cr_amount": "1"},
        ],
    })
    assert r.status_code == 422


# ── read ──────────────────────────────────────────────────────────────────────

def test_get_journal(client, accounts, simple_journal):
    trx_no = simple_journal["trx_no"]
    r = client.get(f"/journal/{trx_no}")
    assert r.status_code == 200
    data = r.json()
    assert data["trx_no"] == trx_no
    assert len(data["lines"]) == 2


def test_get_journal_not_found(client):
    r = client.get("/journal/XXXX")
    assert r.status_code == 404


def test_list_journals(client, accounts, simple_journal):
    r = client.get("/journal")
    assert r.status_code == 200
    assert len(r.json()) == 1
    s = r.json()[0]
    assert s["line_count"] == 2
    assert float(s["total_dr"]) == 500.0


def test_list_filter_by_from_date(client, accounts):
    client.post("/journal", json={
        "date": "2022-01-01",
        "lines": [
            {"account": "CA01", "particular": "Jan", "dr_amount": "100", "cr_amount": "0"},
            {"account": "RE01", "particular": "Jan", "dr_amount": "0", "cr_amount": "100"},
        ],
    })
    client.post("/journal", json={
        "date": "2022-06-01",
        "lines": [
            {"account": "CA01", "particular": "Jun", "dr_amount": "200", "cr_amount": "0"},
            {"account": "RE01", "particular": "Jun", "dr_amount": "0", "cr_amount": "200"},
        ],
    })
    r = client.get("/journal?from_date=2022-03-01")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert float(r.json()[0]["total_dr"]) == 200.0


def test_list_filter_by_to_date(client, accounts):
    client.post("/journal", json={
        "date": "2022-01-01",
        "lines": [
            {"account": "CA01", "particular": "Jan", "dr_amount": "100", "cr_amount": "0"},
            {"account": "RE01", "particular": "Jan", "dr_amount": "0", "cr_amount": "100"},
        ],
    })
    client.post("/journal", json={
        "date": "2022-12-01",
        "lines": [
            {"account": "CA01", "particular": "Dec", "dr_amount": "300", "cr_amount": "0"},
            {"account": "RE01", "particular": "Dec", "dr_amount": "0", "cr_amount": "300"},
        ],
    })
    r = client.get("/journal?to_date=2022-06-30")
    assert len(r.json()) == 1
    assert float(r.json()[0]["total_dr"]) == 100.0


def test_list_filter_by_account(client, accounts):
    # Journal involving only CA01 and RE01
    client.post("/journal", json={
        "date": "2022-01-01",
        "lines": [
            {"account": "CA01", "particular": "Cash", "dr_amount": "100", "cr_amount": "0"},
            {"account": "RE01", "particular": "Sales", "dr_amount": "0", "cr_amount": "100"},
        ],
    })
    # Journal involving EX01 and CA01
    client.post("/journal", json={
        "date": "2022-01-02",
        "lines": [
            {"account": "EX01", "particular": "Expense", "dr_amount": "50", "cr_amount": "0"},
            {"account": "CA01", "particular": "Cash out", "dr_amount": "0", "cr_amount": "50"},
        ],
    })
    r = client.get("/journal?account=EX01")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert float(r.json()[0]["total_dr"]) == 50.0


# ── update ────────────────────────────────────────────────────────────────────

def test_update_journal_lines(client, accounts, simple_journal):
    trx_no = simple_journal["trx_no"]
    r = client.put(f"/journal/{trx_no}", json={
        "lines": [
            {"account": "CA01", "particular": "Updated DR", "dr_amount": "750", "cr_amount": "0"},
            {"account": "RE01", "particular": "Updated CR", "dr_amount": "0", "cr_amount": "750"},
        ],
    })
    assert r.status_code == 200
    data = r.json()
    assert float(data["total_dr"]) == 750.0
    assert data["lines"][0]["particular"] == "Updated DR"


def test_update_journal_date_only(client, accounts, simple_journal):
    trx_no = simple_journal["trx_no"]
    r = client.put(f"/journal/{trx_no}", json={"date": "2022-12-31"})
    assert r.status_code == 200
    assert r.json()["date"] == "2022-12-31"
    assert len(r.json()["lines"]) == 2  # lines unchanged


def test_update_journal_not_found(client):
    r = client.put("/journal/XXXX", json={"date": "2022-01-01"})
    assert r.status_code == 404


def test_update_unbalanced_lines(client, accounts, simple_journal):
    trx_no = simple_journal["trx_no"]
    r = client.put(f"/journal/{trx_no}", json={
        "lines": [
            {"account": "CA01", "particular": "Bad", "dr_amount": "999", "cr_amount": "0"},
            {"account": "RE01", "particular": "Bad", "dr_amount": "0", "cr_amount": "1"},
        ],
    })
    assert r.status_code == 422


def test_update_with_unknown_account(client, accounts, simple_journal):
    trx_no = simple_journal["trx_no"]
    r = client.put(f"/journal/{trx_no}", json={
        "lines": [
            {"account": "ZZZZ", "particular": "Ghost", "dr_amount": "100", "cr_amount": "0"},
            {"account": "ZZZZ", "particular": "Ghost", "dr_amount": "0", "cr_amount": "100"},
        ],
    })
    assert r.status_code == 422


# ── delete ────────────────────────────────────────────────────────────────────

def test_delete_journal(client, accounts, simple_journal):
    trx_no = simple_journal["trx_no"]
    r = client.delete(f"/journal/{trx_no}")
    assert r.status_code == 204
    assert client.get(f"/journal/{trx_no}").status_code == 404


def test_delete_journal_not_found(client):
    r = client.delete("/journal/XXXX")
    assert r.status_code == 404


def test_delete_removes_from_list(client, accounts, simple_journal):
    trx_no = simple_journal["trx_no"]
    client.delete(f"/journal/{trx_no}")
    assert client.get("/journal").json() == []


# ── period lock guard ─────────────────────────────────────────────────────────

def _close_period(client, period_end: str):
    r = client.post("/period/close", json={"period_end": period_end})
    assert r.status_code == 200, r.text
    return r.json()


def test_update_locked_entry_returns_403(client, accounts, simple_journal):
    trx_no = simple_journal["trx_no"]
    _close_period(client, "2022-12-31")
    r = client.put(f"/journal/{trx_no}", json={"date": "2022-03-16"})
    assert r.status_code == 403


def test_delete_locked_entry_returns_403(client, accounts, simple_journal):
    trx_no = simple_journal["trx_no"]
    _close_period(client, "2022-12-31")
    r = client.delete(f"/journal/{trx_no}")
    assert r.status_code == 403


def test_entry_after_lock_is_editable(client, accounts, simple_journal):
    """Entries dated after the lock date should still be editable."""
    # Create a post-lock entry
    client.post("/journal", json={
        "date": "2023-06-01",
        "lines": [
            {"account": "CA01", "particular": "Post lock", "dr_amount": "100", "cr_amount": "0"},
            {"account": "RE01", "particular": "Post lock", "dr_amount": "0", "cr_amount": "100"},
        ],
    })
    _close_period(client, "2022-12-31")
    r = client.put("/journal/0002", json={"date": "2023-06-02"})
    assert r.status_code == 200
