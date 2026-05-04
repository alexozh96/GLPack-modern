import io


def _csv(*rows: str) -> bytes:
    header = "date,trx_no,account,particular,dr_amount,cr_amount"
    return "\n".join([header] + list(rows)).encode()


def _seed_accounts(client):
    client.post("/accounts", json={"code": "CB01", "name": "Bank"})
    client.post("/accounts", json={"code": "SA01", "name": "Sales"})


def _upload(client, data: bytes):
    return client.post(
        "/ledger/import-csv",
        files={"file": ("import.csv", io.BytesIO(data), "text/csv")},
    )


def test_import_success(client):
    _seed_accounts(client)
    data = _csv(
        "2024-01-10,0001,CB01,Receipt,500.00,0.00",
        "2024-01-10,0001,SA01,Receipt,0.00,500.00",
    )
    r = _upload(client, data)
    assert r.status_code == 200
    body = r.json()
    assert body["imported_rows"] == 2
    assert body["imported_transactions"] == 1


def test_import_multiple_transactions(client):
    _seed_accounts(client)
    data = _csv(
        "2024-01-10,0001,CB01,Deposit,200.00,0.00",
        "2024-01-10,0001,SA01,Deposit,0.00,200.00",
        "2024-01-11,0002,CB01,Withdraw,0.00,100.00",
        "2024-01-11,0002,SA01,Withdraw,100.00,0.00",
    )
    r = _upload(client, data)
    assert r.status_code == 200
    assert r.json()["imported_transactions"] == 2


def test_import_missing_column(client):
    data = b"date,trx_no,account,particular,dr_amount\n2024-01-01,0001,CB01,X,100.00"
    r = _upload(client, data)
    assert r.status_code == 400


def test_import_unknown_account(client):
    _seed_accounts(client)
    data = _csv("2024-01-10,0001,ZZZZ,X,100.00,0.00", "2024-01-10,0001,SA01,X,0.00,100.00")
    r = _upload(client, data)
    assert r.status_code == 422
    assert any("ZZZZ" in e for e in r.json()["detail"])


def test_import_unbalanced_trx(client):
    _seed_accounts(client)
    data = _csv("2024-01-10,0001,CB01,X,100.00,0.00", "2024-01-10,0001,SA01,X,0.00,50.00")
    r = _upload(client, data)
    assert r.status_code == 422
    assert any("unbalanced" in e for e in r.json()["detail"])


def test_import_duplicate_trx_no(client):
    _seed_accounts(client)
    data = _csv(
        "2024-01-10,0001,CB01,First,100.00,0.00",
        "2024-01-10,0001,SA01,First,0.00,100.00",
    )
    _upload(client, data)  # first import
    r = _upload(client, data)  # duplicate
    assert r.status_code == 422
    assert any("already exists" in e for e in r.json()["detail"])


def test_import_entries_visible_in_ledger(client):
    _seed_accounts(client)
    data = _csv(
        "2024-02-20,0099,CB01,Test import,750.00,0.00",
        "2024-02-20,0099,SA01,Test import,0.00,750.00",
    )
    _upload(client, data)
    r = client.get("/ledger", params={"account": "CB01"})
    assert r.status_code == 200
    entries = r.json()
    assert any(e["trx_no"] == "0099" for e in entries)
