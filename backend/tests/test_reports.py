"""
Tests for the reports API (Phase 4).

Test data setup:
  Accounts:
    SA01 – Sales account (revenue, credit-normal)
    EX01 – Atrium Rental (expense, debit-normal)
    EX02 – Bank Charges (expense, debit-normal)
    CO01 – Purchase / cost of sales (debit-normal)
    CA04 – Cash in Hand (current asset, debit-normal)
    CB01 – Cash at Bank (current asset, debit-normal)
    CL01 – Amt Owing Director (current liability, credit-normal)
    FA01 – Equipment (fixed asset, debit-normal)
    SC01 – Share Capital (credit-normal)
    PL01 – Profit & Loss account (credit-normal)
    TD01 – Trade Debtors (current asset, debit-normal)
    TD02 – Trade Creditors (current liability, credit-normal)
"""

import pytest

# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def accounts(client):
    for code, name in [
        ("SA01", "Sales"),
        ("EX01", "Atrium Rental"),
        ("EX02", "Bank Charges"),
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


def _post(client, date, lines):
    r = client.post("/journal", json={"date": date, "lines": lines})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def sample_data(client, accounts):
    """
    2022 transactions:
      Sales revenue: 322991.89 CR SA01
      Cost of sales: 3000.00 DR CO01
      Expenses:
        EX01 269535.95
        EX02    72.25
      Fixed asset purchase: FA01 5000.00
      Share capital: SC01 100.00 CR
      P&L carried forward (prior year): PL01 39899.82 CR
      Cash at bank: CB01 movements

    Net profit = 322991.89 - 3000.00 - 269535.95 - 72.25 = 50383.69
    (No 'other income' or taxation in this simplified dataset.)
    """
    # Opening balances (1 Jan 2022)
    _post(client, "2022-01-01", [
        {"account": "SC01", "particular": "Share Capital", "dr_amount": "0", "cr_amount": "100.00"},
        {"account": "CB01", "particular": "Share Capital", "dr_amount": "100.00", "cr_amount": "0"},
    ])
    _post(client, "2022-01-01", [
        {"account": "PL01", "particular": "P&L Brought Forward", "dr_amount": "0", "cr_amount": "39899.82"},
        {"account": "CB01", "particular": "P&L Brought Forward", "dr_amount": "39899.82", "cr_amount": "0"},
    ])

    # Sales
    _post(client, "2022-03-01", [
        {"account": "CB01", "particular": "Sales receipt", "dr_amount": "322991.89", "cr_amount": "0"},
        {"account": "SA01", "particular": "Sales", "dr_amount": "0", "cr_amount": "322991.89"},
    ])

    # Cost of sales
    _post(client, "2022-04-01", [
        {"account": "CO01", "particular": "Purchase", "dr_amount": "3000.00", "cr_amount": "0"},
        {"account": "CB01", "particular": "Purchase payment", "dr_amount": "0", "cr_amount": "3000.00"},
    ])

    # Expenses
    _post(client, "2022-06-01", [
        {"account": "EX01", "particular": "Atrium Rental", "dr_amount": "269535.95", "cr_amount": "0"},
        {"account": "CB01", "particular": "Atrium Rental payment", "dr_amount": "0", "cr_amount": "269535.95"},
    ])
    _post(client, "2022-06-15", [
        {"account": "EX02", "particular": "Bank Charges", "dr_amount": "72.25", "cr_amount": "0"},
        {"account": "CB01", "particular": "Bank charges deducted", "dr_amount": "0", "cr_amount": "72.25"},
    ])

    # Fixed asset purchase
    _post(client, "2022-07-01", [
        {"account": "FA01", "particular": "Equipment purchase", "dr_amount": "5000.00", "cr_amount": "0"},
        {"account": "CB01", "particular": "Equipment payment", "dr_amount": "0", "cr_amount": "5000.00"},
    ])

    # Trade debtor and creditor entries
    _post(client, "2022-09-01", [
        {"account": "TD01", "particular": "Invoice raised", "dr_amount": "1000.00", "cr_amount": "0"},
        {"account": "SA01", "particular": "Sales on credit", "dr_amount": "0", "cr_amount": "1000.00"},
    ])
    _post(client, "2022-09-15", [
        {"account": "CL01", "particular": "Director loan", "dr_amount": "0", "cr_amount": "15900.00"},
        {"account": "CB01", "particular": "Director loan received", "dr_amount": "15900.00", "cr_amount": "0"},
    ])


# ── trial balance ─────────────────────────────────────────────────────────────

class TestTrialBalance:
    def test_returns_all_active_accounts(self, client, sample_data):
        r = client.get("/reports/trial-balance?period_start=2022-01-01&period_end=2022-12-31")
        assert r.status_code == 200
        data = r.json()
        codes = {a["code"] for a in data["accounts"]}
        assert "SA01" in codes
        assert "EX01" in codes
        assert "CB01" in codes

    def test_debits_equal_credits(self, client, sample_data):
        r = client.get("/reports/trial-balance?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        assert float(data["total_dr"]) == pytest.approx(float(data["total_cr"]), abs=0.01)

    def test_period_filter_excludes_outside(self, client, accounts):
        _post(client, "2021-12-31", [
            {"account": "SA01", "particular": "Old sale", "dr_amount": "0", "cr_amount": "500.00"},
            {"account": "CB01", "particular": "Old receipt", "dr_amount": "500.00", "cr_amount": "0"},
        ])
        r = client.get("/reports/trial-balance?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        assert float(data["total_dr"]) == 0.0
        assert float(data["total_cr"]) == 0.0

    def test_empty_period_returns_empty(self, client, accounts):
        r = client.get("/reports/trial-balance?period_start=2025-01-01&period_end=2025-12-31")
        assert r.status_code == 200
        data = r.json()
        assert data["accounts"] == []
        assert float(data["total_dr"]) == 0.0

    def test_invalid_period_returns_422(self, client, accounts):
        r = client.get("/reports/trial-balance?period_start=2022-12-31&period_end=2022-01-01")
        assert r.status_code == 422


# ── profit & loss ─────────────────────────────────────────────────────────────

class TestProfitLoss:
    def test_total_revenue(self, client, sample_data):
        r = client.get("/reports/profit-loss?period_start=2022-01-01&period_end=2022-12-31")
        assert r.status_code == 200
        data = r.json()
        # SA01: 322991.89 + 1000.00 = 323991.89
        assert float(data["total_revenue"]) == pytest.approx(323991.89, abs=0.01)

    def test_cost_of_sales(self, client, sample_data):
        r = client.get("/reports/profit-loss?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        assert float(data["total_cost_of_sales"]) == pytest.approx(3000.00, abs=0.01)

    def test_gross_profit(self, client, sample_data):
        r = client.get("/reports/profit-loss?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        assert float(data["gross_profit"]) == pytest.approx(
            float(data["total_revenue"]) - float(data["total_cost_of_sales"]), abs=0.01
        )

    def test_total_expenses(self, client, sample_data):
        r = client.get("/reports/profit-loss?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        assert float(data["total_expenses"]) == pytest.approx(269535.95 + 72.25, abs=0.01)

    def test_profit_before_tax(self, client, sample_data):
        r = client.get("/reports/profit-loss?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        expected = float(data["gross_profit"]) - float(data["total_expenses"])
        assert float(data["profit_before_tax"]) == pytest.approx(expected, abs=0.01)

    def test_pl_carried_forward_includes_brought_forward(self, client, sample_data):
        r = client.get("/reports/profit-loss?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        # pl_cf = pl_bf + profit_after_tax
        assert float(data["pl_carried_forward"]) == pytest.approx(
            float(data["pl_brought_forward"]) + float(data["profit_after_tax"]), abs=0.01
        )

    def test_revenue_lines_have_percentages(self, client, sample_data):
        r = client.get("/reports/profit-loss?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        for line in data["revenue_lines"]:
            assert line["pct_of_revenue"] is not None

    def test_expense_lines_have_percentages(self, client, sample_data):
        r = client.get("/reports/profit-loss?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        for line in data["expense_lines"]:
            assert line["pct_of_revenue"] is not None

    def test_no_transactions_returns_zeroes(self, client, accounts):
        r = client.get("/reports/profit-loss?period_start=2025-01-01&period_end=2025-12-31")
        assert r.status_code == 200
        data = r.json()
        assert float(data["total_revenue"]) == 0.0
        assert float(data["profit_before_tax"]) == 0.0


# ── balance sheet ─────────────────────────────────────────────────────────────

class TestBalanceSheet:
    def test_equity_equals_net_assets(self, client, sample_data):
        r = client.get("/reports/balance-sheet?period_start=2022-01-01&period_end=2022-12-31")
        assert r.status_code == 200
        data = r.json()
        assert float(data["total_equity"]) == pytest.approx(float(data["total_net_assets"]), abs=0.01)

    def test_share_capital(self, client, sample_data):
        r = client.get("/reports/balance-sheet?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        assert float(data["share_capital"]) == pytest.approx(100.00, abs=0.01)

    def test_current_assets_include_ca_cb(self, client, sample_data):
        r = client.get("/reports/balance-sheet?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        codes = {a["code"] for a in data["current_assets"]}
        assert "CB01" in codes

    def test_fixed_assets(self, client, sample_data):
        r = client.get("/reports/balance-sheet?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        assert float(data["total_fixed_assets"]) == pytest.approx(5000.00, abs=0.01)

    def test_current_liabilities_include_cl(self, client, sample_data):
        r = client.get("/reports/balance-sheet?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        codes = {a["code"] for a in data["current_liabilities"]}
        assert "CL01" in codes

    def test_net_current_assets_calculation(self, client, sample_data):
        r = client.get("/reports/balance-sheet?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        assert float(data["net_current_assets"]) == pytest.approx(
            float(data["total_current_assets"]) - float(data["total_current_liabilities"]),
            abs=0.01,
        )


# ── ledger account ────────────────────────────────────────────────────────────

class TestLedgerAccount:
    def test_returns_period_lines(self, client, sample_data):
        r = client.get("/reports/ledger-account/SA01?period_start=2022-01-01&period_end=2022-12-31")
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == "SA01"
        assert len(data["lines"]) >= 1

    def test_running_balance(self, client, accounts):
        _post(client, "2022-01-01", [
            {"account": "CB01", "particular": "R1", "dr_amount": "100", "cr_amount": "0"},
            {"account": "SA01", "particular": "R1", "dr_amount": "0", "cr_amount": "100"},
        ])
        _post(client, "2022-02-01", [
            {"account": "CB01", "particular": "R2", "dr_amount": "200", "cr_amount": "0"},
            {"account": "SA01", "particular": "R2", "dr_amount": "0", "cr_amount": "200"},
        ])
        r = client.get("/reports/ledger-account/CB01?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        balances = [float(l["balance"]) for l in data["lines"]]
        assert balances[0] == pytest.approx(100.0, abs=0.01)
        assert balances[1] == pytest.approx(300.0, abs=0.01)

    def test_opening_balance_from_prior_period(self, client, accounts):
        _post(client, "2021-12-01", [
            {"account": "CB01", "particular": "Prior", "dr_amount": "500", "cr_amount": "0"},
            {"account": "SA01", "particular": "Prior", "dr_amount": "0", "cr_amount": "500"},
        ])
        _post(client, "2022-06-01", [
            {"account": "CB01", "particular": "Current", "dr_amount": "100", "cr_amount": "0"},
            {"account": "SA01", "particular": "Current", "dr_amount": "0", "cr_amount": "100"},
        ])
        r = client.get("/reports/ledger-account/CB01?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        assert float(data["opening_balance"]) == pytest.approx(500.0, abs=0.01)
        assert len(data["lines"]) == 1  # only the 2022 entry

    def test_closing_balance_equals_opening_plus_movements(self, client, accounts):
        _post(client, "2021-12-01", [
            {"account": "CB01", "particular": "Prior", "dr_amount": "500", "cr_amount": "0"},
            {"account": "SA01", "particular": "Prior", "dr_amount": "0", "cr_amount": "500"},
        ])
        _post(client, "2022-03-01", [
            {"account": "CB01", "particular": "Current", "dr_amount": "200", "cr_amount": "0"},
            {"account": "SA01", "particular": "Current", "dr_amount": "0", "cr_amount": "200"},
        ])
        r = client.get("/reports/ledger-account/CB01?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        expected_closing = float(data["opening_balance"]) + float(data["total_dr"]) - float(data["total_cr"])
        assert float(data["closing_balance"]) == pytest.approx(expected_closing, abs=0.01)

    def test_unknown_account_returns_404(self, client, accounts):
        r = client.get("/reports/ledger-account/ZZZZ?period_start=2022-01-01&period_end=2022-12-31")
        assert r.status_code == 404


# ── expense schedule ──────────────────────────────────────────────────────────

class TestExpenseSchedule:
    def test_lists_all_ex_accounts(self, client, sample_data):
        r = client.get("/reports/expense-schedule?period_start=2022-01-01&period_end=2022-12-31")
        assert r.status_code == 200
        data = r.json()
        codes = {i["code"] for i in data["items"]}
        assert "EX01" in codes
        assert "EX02" in codes

    def test_total_matches_sum(self, client, sample_data):
        r = client.get("/reports/expense-schedule?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        item_sum = sum(float(i["amount"]) for i in data["items"])
        assert float(data["total"]) == pytest.approx(item_sum, abs=0.01)

    def test_percentages_present_when_sales_exist(self, client, sample_data):
        r = client.get("/reports/expense-schedule?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        for item in data["items"]:
            assert item["pct_of_sales"] is not None

    def test_percentages_null_when_no_sales(self, client, accounts):
        _post(client, "2022-01-01", [
            {"account": "EX01", "particular": "Rent", "dr_amount": "1000", "cr_amount": "0"},
            {"account": "CB01", "particular": "Payment", "dr_amount": "0", "cr_amount": "1000"},
        ])
        r = client.get("/reports/expense-schedule?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        for item in data["items"]:
            assert item["pct_of_sales"] is None

    def test_non_ex_accounts_excluded(self, client, sample_data):
        r = client.get("/reports/expense-schedule?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        for item in data["items"]:
            assert item["code"].startswith("EX")


# ── debtors / creditors ───────────────────────────────────────────────────────

class TestDebtorsCreditors:
    def test_debtors_listing(self, client, sample_data):
        r = client.get("/reports/debtors-listing?period_start=2022-01-01&period_end=2022-12-31")
        assert r.status_code == 200
        data = r.json()
        assert float(data["total"]) == pytest.approx(1000.00, abs=0.01)
        assert any(i["code"] == "TD01" for i in data["items"])

    def test_creditors_listing(self, client, accounts):
        _post(client, "2022-05-01", [
            {"account": "EX01", "particular": "Rent due", "dr_amount": "2000", "cr_amount": "0"},
            {"account": "TD02", "particular": "Creditor", "dr_amount": "0", "cr_amount": "2000"},
        ])
        r = client.get("/reports/creditors-listing?period_start=2022-01-01&period_end=2022-12-31")
        assert r.status_code == 200
        data = r.json()
        assert float(data["total"]) == pytest.approx(2000.00, abs=0.01)

    def test_empty_debtors(self, client, accounts):
        r = client.get("/reports/debtors-listing?period_start=2022-01-01&period_end=2022-12-31")
        assert r.status_code == 200
        data = r.json()
        assert data["items"] == []
        assert float(data["total"]) == 0.0


# ── fixed assets ──────────────────────────────────────────────────────────────

class TestFixedAssets:
    def test_fa_accounts_listed(self, client, sample_data):
        r = client.get("/reports/fixed-assets?period_start=2022-01-01&period_end=2022-12-31")
        assert r.status_code == 200
        data = r.json()
        assert any(i["code"] == "FA01" for i in data["items"])

    def test_cost_equals_debit_balance(self, client, sample_data):
        r = client.get("/reports/fixed-assets?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        fa01 = next(i for i in data["items"] if i["code"] == "FA01")
        assert float(fa01["cost"]) == pytest.approx(5000.00, abs=0.01)

    def test_no_depn_when_no_ad_account(self, client, sample_data):
        r = client.get("/reports/fixed-assets?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        fa01 = next(i for i in data["items"] if i["code"] == "FA01")
        assert float(fa01["accum_depn"]) == 0.0
        assert float(fa01["nbv"]) == float(fa01["cost"])

    def test_totals_match_items(self, client, sample_data):
        r = client.get("/reports/fixed-assets?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        assert float(data["total_cost"]) == pytest.approx(
            sum(float(i["cost"]) for i in data["items"]), abs=0.01
        )
        assert float(data["total_nbv"]) == pytest.approx(
            sum(float(i["nbv"]) for i in data["items"]), abs=0.01
        )

    def test_empty_when_no_fa_accounts(self, client, accounts):
        r = client.get("/reports/fixed-assets?period_start=2022-01-01&period_end=2022-12-31")
        data = r.json()
        assert data["items"] == []
        assert float(data["total_cost"]) == 0.0
