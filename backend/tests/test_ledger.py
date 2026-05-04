import pytest


@pytest.fixture
def posted(client):
    """Three accounts, two journals dated Jan 1 and Jan 15."""
    client.post("/accounts", json={"code": "CA01", "name": "Cash"})
    client.post("/accounts", json={"code": "RE01", "name": "Revenue"})
    client.post("/accounts", json={"code": "EX01", "name": "Expenses"})

    client.post("/journal", json={
        "date": "2022-01-01",
        "lines": [
            {"account": "CA01", "particular": "Cash receipt", "dr_amount": "1000", "cr_amount": "0"},
            {"account": "RE01", "particular": "Sales", "dr_amount": "0", "cr_amount": "1000"},
        ],
    })
    client.post("/journal", json={
        "date": "2022-01-15",
        "lines": [
            {"account": "EX01", "particular": "Office supplies", "dr_amount": "200", "cr_amount": "0"},
            {"account": "CA01", "particular": "Cash payment", "dr_amount": "0", "cr_amount": "200"},
        ],
    })


def test_list_all(client, posted):
    r = client.get("/ledger")
    assert r.status_code == 200
    assert len(r.json()) == 4  # 2 journals × 2 lines each


def test_filter_by_account(client, posted):
    r = client.get("/ledger?account=CA01")
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) == 2
    assert entries[0]["dr_amount"] == "1000.00"
    assert entries[1]["cr_amount"] == "200.00"


def test_running_balance(client, posted):
    r = client.get("/ledger?account=CA01")
    entries = r.json()
    # Entry 1: DR 1000 → balance = +1000
    # Entry 2: CR 200  → balance = +800
    assert float(entries[0]["balance"]) == 1000.0
    assert float(entries[1]["balance"]) == 800.0


def test_running_balance_cr_heavy(client, client_fresh=None):
    """An account that starts with credits should go negative."""
    client.post("/accounts", json={"code": "LI01", "name": "Liability"})
    client.post("/accounts", json={"code": "CA01", "name": "Cash"})
    client.post("/journal", json={
        "date": "2022-01-01",
        "lines": [
            {"account": "CA01", "particular": "Loan received", "dr_amount": "500", "cr_amount": "0"},
            {"account": "LI01", "particular": "Loan payable", "dr_amount": "0", "cr_amount": "500"},
        ],
    })
    r = client.get("/ledger?account=LI01")
    entries = r.json()
    assert float(entries[0]["balance"]) == -500.0


def test_filter_by_date_range(client, posted):
    r = client.get("/ledger?account=CA01&from_date=2022-01-10")
    entries = r.json()
    assert len(entries) == 1
    assert float(entries[0]["cr_amount"]) == 200.0


def test_filter_by_to_date(client, posted):
    r = client.get("/ledger?account=CA01&to_date=2022-01-01")
    entries = r.json()
    assert len(entries) == 1
    assert float(entries[0]["dr_amount"]) == 1000.0


def test_filter_by_trx_no(client, posted):
    first_trx = client.get("/journal").json()[0]["trx_no"]
    r = client.get(f"/ledger?trx_no={first_trx}")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_empty_result(client, posted):
    r = client.get("/ledger?account=ZZ99")
    assert r.status_code == 200
    assert r.json() == []


def test_no_filter_returns_all_ordered(client, posted):
    r = client.get("/ledger")
    entries = r.json()
    dates = [e["date"] for e in entries]
    assert dates == sorted(dates)
