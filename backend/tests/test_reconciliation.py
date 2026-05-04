import io
from decimal import Decimal


def _csv(rows: list[str]) -> bytes:
    return "\n".join(["date,description,amount"] + rows).encode()


def _seed_ledger(client):
    """Create an account and a CB* journal entry; return the ledger entry id."""
    client.post("/accounts", json={"code": "CB01", "name": "Bank Account"})
    client.post("/accounts", json={"code": "SA01", "name": "Sales"})
    r = client.post("/journal", json={
        "date": "2024-03-15",
        "lines": [
            {"account": "CB01", "particular": "Receipt", "dr_amount": "500.00", "cr_amount": "0"},
            {"account": "SA01", "particular": "Receipt", "dr_amount": "0", "cr_amount": "500.00"},
        ],
    })
    assert r.status_code == 201
    lines = client.get("/journal/0001").json()["lines"]
    cb_line = next(l for l in lines if l["account"] == "CB01")
    return cb_line["id"]


# ── Import ────────────────────────────────────────────────────────────────────

def test_import_csv_success(client):
    csv_data = _csv(["2024-01-15,Deposit,1000.00", "2024-01-16,Fee,-25.00"])
    r = client.post(
        "/reconciliation/import",
        files={"file": ("bank.csv", io.BytesIO(csv_data), "text/csv")},
    )
    assert r.status_code == 200
    assert r.json()["imported"] == 2


def test_import_csv_missing_column(client):
    bad = b"date,amount\n2024-01-01,100.00"
    r = client.post(
        "/reconciliation/import",
        files={"file": ("bank.csv", io.BytesIO(bad), "text/csv")},
    )
    assert r.status_code == 400


def test_import_csv_bad_date(client):
    bad = _csv(["not-a-date,Deposit,100.00"])
    r = client.post(
        "/reconciliation/import",
        files={"file": ("bank.csv", io.BytesIO(bad), "text/csv")},
    )
    assert r.status_code == 422


# ── Unmatched / summary ───────────────────────────────────────────────────────

def test_unmatched_returns_imported_rows(client):
    csv_data = _csv(["2024-01-10,Payment,200.00"])
    client.post("/reconciliation/import", files={"file": ("b.csv", io.BytesIO(csv_data), "text/csv")})
    r = client.get("/reconciliation/unmatched")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_summary_counts(client):
    csv_data = _csv(["2024-01-10,A,100.00", "2024-01-11,B,200.00"])
    client.post("/reconciliation/import", files={"file": ("b.csv", io.BytesIO(csv_data), "text/csv")})
    r = client.get("/reconciliation/summary")
    data = r.json()
    assert data["total"] == 2
    assert data["matched"] == 0
    assert data["unmatched"] == 2


# ── GL cash entries ───────────────────────────────────────────────────────────

def test_gl_cash_returns_cb_entries(client):
    _seed_ledger(client)
    r = client.get("/reconciliation/gl-cash")
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) == 1
    assert entries[0]["account"] == "CB01"


# ── Match / unmatch ───────────────────────────────────────────────────────────

def test_match_and_unmatch(client):
    gl_id = _seed_ledger(client)
    csv_data = _csv(["2024-03-15,Receipt,500.00"])
    client.post("/reconciliation/import", files={"file": ("b.csv", io.BytesIO(csv_data), "text/csv")})

    bank_rows = client.get("/reconciliation/unmatched").json()
    bank_id = bank_rows[0]["id"]

    # Match
    r = client.post("/reconciliation/match", json={"bank_row_id": bank_id, "ledger_entry_id": gl_id})
    assert r.status_code == 200
    assert r.json()["matched_ledger_id"] == gl_id

    # Unmatched list should now be empty
    assert client.get("/reconciliation/unmatched").json() == []

    # GL cash should not show this entry anymore
    assert client.get("/reconciliation/gl-cash").json() == []

    # Summary
    summ = client.get("/reconciliation/summary").json()
    assert summ["matched"] == 1
    assert summ["unmatched"] == 0

    # Matched list
    pairs = client.get("/reconciliation/matched").json()
    assert len(pairs) == 1
    assert pairs[0]["bank_id"] == bank_id
    assert pairs[0]["gl_id"] == gl_id

    # Unmatch
    r = client.delete(f"/reconciliation/match/{bank_id}")
    assert r.status_code == 204
    assert len(client.get("/reconciliation/unmatched").json()) == 1


def test_match_duplicate_bank_row(client):
    gl_id = _seed_ledger(client)
    csv_data = _csv(["2024-03-15,A,500.00"])
    client.post("/reconciliation/import", files={"file": ("b.csv", io.BytesIO(csv_data), "text/csv")})
    bank_id = client.get("/reconciliation/unmatched").json()[0]["id"]

    client.post("/reconciliation/match", json={"bank_row_id": bank_id, "ledger_entry_id": gl_id})
    # Second match on already-matched bank row
    r = client.post("/reconciliation/match", json={"bank_row_id": bank_id, "ledger_entry_id": gl_id})
    assert r.status_code == 409
