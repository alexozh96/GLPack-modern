"""
Tests for Phase 5 — PDF export.

Verifies:
  - ?format=pdf returns a valid PDF (starts with %PDF)
  - Content-Type is application/pdf
  - Content-Disposition filename is correct
  - JSON format still works after router refactor
  - Full financial statements endpoint works in both formats
"""

import pytest


# ── fixtures (reuse from test_reports.py pattern) ─────────────────────────────

@pytest.fixture
def accounts(client):
    for code, name in [
        ("SA01", "Sales"),
        ("EX01", "Atrium Rental"),
        ("CO01", "Purchase"),
        ("CA04", "Cash in Hand"),
        ("CB01", "Cash at Bank"),
        ("CL01", "Amt Owing Director"),
        ("FA01", "Equipment"),
        ("SC01", "Share Capital"),
        ("PL01", "Profit and Loss"),
        ("TD01", "Trade Debtors"),
        ("TD02", "Trade Creditors"),
    ]:
        client.post("/accounts", json={"code": code, "name": name})


def _post(client, dt, lines):
    r = client.post("/journal", json={"date": dt, "lines": lines})
    assert r.status_code == 201
    return r.json()


@pytest.fixture
def data(client, accounts):
    _post(client, "2022-01-01", [
        {"account": "SC01", "particular": "Share Capital", "dr_amount": "0", "cr_amount": "100"},
        {"account": "CB01", "particular": "Share Capital", "dr_amount": "100", "cr_amount": "0"},
    ])
    _post(client, "2022-03-01", [
        {"account": "CB01", "particular": "Sales receipt", "dr_amount": "5000", "cr_amount": "0"},
        {"account": "SA01", "particular": "Sales", "dr_amount": "0", "cr_amount": "5000"},
    ])
    _post(client, "2022-06-01", [
        {"account": "EX01", "particular": "Atrium Rental", "dr_amount": "1000", "cr_amount": "0"},
        {"account": "CB01", "particular": "Rental payment", "dr_amount": "0", "cr_amount": "1000"},
    ])
    _post(client, "2022-07-01", [
        {"account": "FA01", "particular": "Equipment", "dr_amount": "2000", "cr_amount": "0"},
        {"account": "CB01", "particular": "Equipment payment", "dr_amount": "0", "cr_amount": "2000"},
    ])
    _post(client, "2022-09-01", [
        {"account": "TD01", "particular": "Invoice", "dr_amount": "500", "cr_amount": "0"},
        {"account": "SA01", "particular": "Sales credit", "dr_amount": "0", "cr_amount": "500"},
    ])


_PERIOD = "?period_start=2022-01-01&period_end=2022-12-31"
_PERIOD_PDF = _PERIOD + "&format=pdf"


def _is_pdf(content: bytes) -> bool:
    return content[:4] == b"%PDF"


# ── trial balance ─────────────────────────────────────────────────────────────

class TestTrialBalancePDF:
    def test_pdf_returns_valid_pdf(self, client, data):
        r = client.get(f"/reports/trial-balance{_PERIOD_PDF}")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert _is_pdf(r.content)

    def test_pdf_content_disposition(self, client, data):
        r = client.get(f"/reports/trial-balance{_PERIOD_PDF}")
        assert "trial_balance.pdf" in r.headers["content-disposition"]

    def test_json_still_works(self, client, data):
        r = client.get(f"/reports/trial-balance{_PERIOD}")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/json")
        data_j = r.json()
        assert "accounts" in data_j
        assert "total_dr" in data_j


# ── profit & loss ─────────────────────────────────────────────────────────────

class TestProfitLossPDF:
    def test_pdf_valid(self, client, data):
        r = client.get(f"/reports/profit-loss{_PERIOD_PDF}")
        assert r.status_code == 200
        assert _is_pdf(r.content)

    def test_pdf_filename(self, client, data):
        r = client.get(f"/reports/profit-loss{_PERIOD_PDF}")
        assert "profit_loss.pdf" in r.headers["content-disposition"]

    def test_json_still_works(self, client, data):
        r = client.get(f"/reports/profit-loss{_PERIOD}")
        assert r.status_code == 200
        d = r.json()
        assert "total_revenue" in d
        assert "profit_before_tax" in d


# ── balance sheet ─────────────────────────────────────────────────────────────

class TestBalanceSheetPDF:
    def test_pdf_valid(self, client, data):
        r = client.get(f"/reports/balance-sheet{_PERIOD_PDF}")
        assert r.status_code == 200
        assert _is_pdf(r.content)

    def test_pdf_filename(self, client, data):
        r = client.get(f"/reports/balance-sheet{_PERIOD_PDF}")
        assert "balance_sheet.pdf" in r.headers["content-disposition"]

    def test_json_still_works(self, client, data):
        r = client.get(f"/reports/balance-sheet{_PERIOD}")
        assert r.status_code == 200
        d = r.json()
        assert "total_equity" in d


# ── ledger account ────────────────────────────────────────────────────────────

class TestLedgerAccountPDF:
    def test_pdf_valid(self, client, data):
        r = client.get(f"/reports/ledger-account/CB01{_PERIOD_PDF}")
        assert r.status_code == 200
        assert _is_pdf(r.content)

    def test_pdf_filename_contains_code(self, client, data):
        r = client.get(f"/reports/ledger-account/CB01{_PERIOD_PDF}")
        assert "CB01" in r.headers["content-disposition"]

    def test_json_still_works(self, client, data):
        r = client.get(f"/reports/ledger-account/CB01{_PERIOD}")
        assert r.status_code == 200
        d = r.json()
        assert "lines" in d
        assert "opening_balance" in d

    def test_404_for_unknown_account(self, client, accounts):
        r = client.get(f"/reports/ledger-account/ZZZZ{_PERIOD_PDF}")
        assert r.status_code == 404


# ── expense schedule ──────────────────────────────────────────────────────────

class TestExpenseSchedulePDF:
    def test_pdf_valid(self, client, data):
        r = client.get(f"/reports/expense-schedule{_PERIOD_PDF}")
        assert r.status_code == 200
        assert _is_pdf(r.content)

    def test_json_still_works(self, client, data):
        r = client.get(f"/reports/expense-schedule{_PERIOD}")
        assert r.status_code == 200
        assert "items" in r.json()


# ── debtors / creditors ───────────────────────────────────────────────────────

class TestListingsPDF:
    def test_debtors_pdf(self, client, data):
        r = client.get(f"/reports/debtors-listing{_PERIOD_PDF}")
        assert r.status_code == 200
        assert _is_pdf(r.content)

    def test_creditors_pdf(self, client, data):
        r = client.get(f"/reports/creditors-listing{_PERIOD_PDF}")
        assert r.status_code == 200
        assert _is_pdf(r.content)

    def test_debtors_json_still_works(self, client, data):
        r = client.get(f"/reports/debtors-listing{_PERIOD}")
        assert r.status_code == 200
        assert "total" in r.json()


# ── fixed assets ──────────────────────────────────────────────────────────────

class TestFixedAssetsPDF:
    def test_pdf_valid(self, client, data):
        r = client.get(f"/reports/fixed-assets{_PERIOD_PDF}")
        assert r.status_code == 200
        assert _is_pdf(r.content)

    def test_json_still_works(self, client, data):
        r = client.get(f"/reports/fixed-assets{_PERIOD}")
        assert r.status_code == 200
        assert "items" in r.json()


# ── full financial statements ─────────────────────────────────────────────────

class TestFullStatements:
    def test_pdf_default(self, client, data):
        r = client.get(f"/reports/full-financial-statements{_PERIOD}")
        assert r.status_code == 200
        assert _is_pdf(r.content)
        assert "financial_statements.pdf" in r.headers["content-disposition"]

    def test_pdf_explicit_format(self, client, data):
        r = client.get(f"/reports/full-financial-statements{_PERIOD_PDF}")
        assert r.status_code == 200
        assert _is_pdf(r.content)

    def test_json_format(self, client, data):
        r = client.get(f"/reports/full-financial-statements{_PERIOD}&format=json")
        assert r.status_code == 200
        d = r.json()
        assert "profit_loss" in d
        assert "balance_sheet" in d
        assert "expense_schedule" in d
        assert "debtors_listing" in d
        assert "creditors_listing" in d
        assert "fixed_assets" in d

    def test_pdf_is_multi_page(self, client, data):
        r = client.get(f"/reports/full-financial-statements{_PERIOD_PDF}")
        # 6 reports = at least 6 pages — check PDF has multiple /Page objects
        assert r.content.count(b"/Page") >= 6

    def test_invalid_period_returns_422(self, client, accounts):
        r = client.get("/reports/full-financial-statements?period_start=2022-12-31&period_end=2022-01-01")
        assert r.status_code == 422


# ── pdf content smoke tests ───────────────────────────────────────────────────

class TestPDFContent:
    def test_company_name_changes_content(self, client, data):
        # Different company names should produce different PDFs
        client.put("/setup", json={"company_name": "COMPANY A"})
        r1 = client.get(f"/reports/profit-loss{_PERIOD_PDF}")
        client.put("/setup", json={"company_name": "COMPANY B"})
        r2 = client.get(f"/reports/profit-loss{_PERIOD_PDF}")
        # Both are valid PDFs but their compressed content differs
        assert _is_pdf(r1.content)
        assert _is_pdf(r2.content)
        assert r1.content != r2.content

    def test_empty_data_pdf_still_valid(self, client, accounts):
        r = client.get(f"/reports/profit-loss{_PERIOD_PDF}")
        assert r.status_code == 200
        assert _is_pdf(r.content)

    def test_pdf_size_reasonable(self, client, data):
        r = client.get(f"/reports/full-financial-statements{_PERIOD_PDF}")
        # fpdf2 compresses content streams — minimum for a 6-page PDF is well over 1KB
        assert len(r.content) > 1_000
        assert len(r.content) < 5_000_000
