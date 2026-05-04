"""P&L calculation correctness with known seeded data."""
from decimal import Decimal


def _seed(client):
    for code, name in [("SA01", "Sales"), ("CO01", "Cost of Sales"),
                       ("EX01", "Expenses"), ("TX01", "Taxation"),
                       ("CA01", "Cash"), ("PL01", "Retained Earnings")]:
        client.post("/accounts", json={"code": code, "name": name})

    def journal(date, lines):
        r = client.post("/journal", json={"date": date, "lines": lines})
        assert r.status_code == 201

    # Revenue: 10,000 credit to SA01
    journal("2022-06-01", [
        {"account": "CA01", "particular": "Sales", "dr_amount": "10000", "cr_amount": "0"},
        {"account": "SA01", "particular": "Sales", "dr_amount": "0", "cr_amount": "10000"},
    ])
    # Cost of sales: 3,000 debit to CO01
    journal("2022-06-02", [
        {"account": "CO01", "particular": "COGS", "dr_amount": "3000", "cr_amount": "0"},
        {"account": "CA01", "particular": "COGS", "dr_amount": "0", "cr_amount": "3000"},
    ])
    # Expenses: 2,000 debit to EX01
    journal("2022-06-03", [
        {"account": "EX01", "particular": "Rent", "dr_amount": "2000", "cr_amount": "0"},
        {"account": "CA01", "particular": "Rent", "dr_amount": "0", "cr_amount": "2000"},
    ])
    # Taxation: 500 debit to TX01
    journal("2022-06-04", [
        {"account": "TX01", "particular": "Tax", "dr_amount": "500", "cr_amount": "0"},
        {"account": "CA01", "particular": "Tax", "dr_amount": "0", "cr_amount": "500"},
    ])


def test_pl_net_profit(client):
    _seed(client)
    r = client.get("/reports/profit-loss", params={
        "period_start": "2022-01-01",
        "period_end": "2022-12-31",
    })
    assert r.status_code == 200
    data = r.json()

    # Revenue = 10,000; Gross profit = 10,000 - 3,000 = 7,000
    assert Decimal(data["total_revenue"]) == Decimal("10000.00")
    assert Decimal(data["total_cost_of_sales"]) == Decimal("3000.00")
    assert Decimal(data["gross_profit"]) == Decimal("7000.00")

    # Expenses = 2,000; profit_before_tax = 5,000
    assert Decimal(data["total_expenses"]) == Decimal("2000.00")
    assert Decimal(data["profit_before_tax"]) == Decimal("5000.00")

    # Taxation = 500; profit_after_tax = 4,500
    assert Decimal(data["taxation"]) == Decimal("500.00")
    assert Decimal(data["profit_after_tax"]) == Decimal("4500.00")


def test_pl_gross_profit_pct(client):
    _seed(client)
    r = client.get("/reports/profit-loss", params={
        "period_start": "2022-01-01",
        "period_end": "2022-12-31",
    })
    data = r.json()
    rev_line = data["revenue_lines"][0]
    # pct_of_revenue = 10000/10000 = 100%
    assert Decimal(rev_line["pct_of_revenue"]) == Decimal("100.00")


def test_pl_zero_revenue_period(client):
    """No entries in period → all zeros, no division-by-zero errors."""
    for code, name in [("SA01", "Sales"), ("CA01", "Cash")]:
        client.post("/accounts", json={"code": code, "name": name})
    r = client.get("/reports/profit-loss", params={
        "period_start": "2023-01-01",
        "period_end": "2023-12-31",
    })
    assert r.status_code == 200
    data = r.json()
    assert Decimal(data["total_revenue"]) == Decimal("0.00")
    assert Decimal(data["profit_after_tax"]) == Decimal("0.00")
