"""
Report calculation service.

Account prefix conventions (from documentation Section 4):
  SA*  — Sales / Revenue        (credit-normal: net = cr - dr)
  CA*  — Current Assets         (debit-normal:  net = dr - cr)
  CB*  — Cash at Bank           (debit-normal)
  CL*  — Current Liabilities    (credit-normal: net = cr - dr, shown positive)
  FA*  — Fixed Assets           (debit-normal)
  EX*  — Expenses               (debit-normal)
  TD01 — Trade Debtors          (asset, debit-normal)
  TD02 — Trade Creditors        (liability, credit-normal)
  SC*  — Share Capital          (credit-normal)
  PL*  — Profit & Loss retained (credit-normal)
  CO*  — Cost of Sales / Purchase (debit-normal) — may be absent if not used
  TX*  — Taxation               (debit-normal)   — may be absent
"""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.ledger import LedgerEntry

_TWO = Decimal("0.01")
_ZERO = Decimal("0.00")


def _q(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(_TWO, rounding=ROUND_HALF_UP)


def _pct(part: Decimal, whole: Decimal) -> Decimal | None:
    if whole == _ZERO:
        return None
    return (part / whole * 100).quantize(_TWO, rounding=ROUND_HALF_UP)


def _totals_by_prefix(
    db: Session,
    company_id: int,
    period_start: date,
    period_end: date,
    *prefixes: str,
    exact_codes: list[str] | None = None,
) -> list[dict]:
    """
    Return per-account sums for entries within [period_start, period_end].
    Filters by account prefix(es) OR by explicit code list.
    """
    q = (
        db.query(
            LedgerEntry.account,
            Account.name,
            func.sum(LedgerEntry.dr_amount).label("sum_dr"),
            func.sum(LedgerEntry.cr_amount).label("sum_cr"),
        )
        .join(
            Account,
            (Account.company_id == LedgerEntry.company_id) & (Account.code == LedgerEntry.account),
        )
        .filter(
            LedgerEntry.company_id == company_id,
            LedgerEntry.date >= period_start,
            LedgerEntry.date <= period_end,
        )
    )
    if exact_codes is not None:
        q = q.filter(LedgerEntry.account.in_(exact_codes))
    elif prefixes:
        q = q.filter(or_(*(LedgerEntry.account.like(f"{p}%") for p in prefixes)))

    rows = q.group_by(LedgerEntry.account, Account.name).order_by(LedgerEntry.account).all()
    return [
        {
            "code": r.account,
            "name": r.name,
            "sum_dr": _q(r.sum_dr),
            "sum_cr": _q(r.sum_cr),
        }
        for r in rows
    ]


def _cumulative_net(
    db: Session,
    company_id: int,
    up_to: date,
    *prefixes: str,
    credit_normal: bool = True,
) -> Decimal:
    """Sum net balance of all matching accounts from the beginning up to (inclusive) up_to."""
    q = (
        db.query(func.sum(LedgerEntry.cr_amount - LedgerEntry.dr_amount))
        .filter(LedgerEntry.company_id == company_id, LedgerEntry.date <= up_to)
    )
    if prefixes:
        q = q.filter(or_(*(LedgerEntry.account.like(f"{p}%") for p in prefixes)))
    val = q.scalar() or 0
    net = _q(val)
    return net if credit_normal else -net


def _cum_rows_codes(
    db: Session,
    company_id: int,
    up_to: date,
    codes: list[str],
    debit_normal: bool,
) -> list[dict]:
    if not codes:
        return []
    q = (
        db.query(
            LedgerEntry.account,
            Account.name,
            func.sum(LedgerEntry.dr_amount).label("sum_dr"),
            func.sum(LedgerEntry.cr_amount).label("sum_cr"),
        )
        .join(
            Account,
            (Account.company_id == LedgerEntry.company_id) & (Account.code == LedgerEntry.account),
        )
        .filter(
            LedgerEntry.company_id == company_id,
            LedgerEntry.date <= up_to,
            LedgerEntry.account.in_(codes),
        )
        .group_by(LedgerEntry.account, Account.name)
        .order_by(LedgerEntry.account)
        .all()
    )
    return [
        {
            "code": r.account,
            "name": r.name,
            "amount": _q(r.sum_dr - r.sum_cr) if debit_normal else _q(r.sum_cr - r.sum_dr),
        }
        for r in q
    ]


# ── Trial Balance ─────────────────────────────────────────────────────────────

def get_trial_balance(db: Session, company_id: int, period_start: date, period_end: date) -> dict:
    rows = _totals_by_prefix(db, company_id, period_start, period_end)
    accounts = [
        {
            "code": r["code"],
            "name": r["name"],
            "total_dr": r["sum_dr"],
            "total_cr": r["sum_cr"],
            "net": r["sum_dr"] - r["sum_cr"],
        }
        for r in rows
    ]
    total_dr = sum((a["total_dr"] for a in accounts), _ZERO)
    total_cr = sum((a["total_cr"] for a in accounts), _ZERO)
    return {
        "period_start": period_start,
        "period_end": period_end,
        "accounts": accounts,
        "total_dr": total_dr,
        "total_cr": total_cr,
    }


# ── Profit & Loss ─────────────────────────────────────────────────────────────

def get_profit_loss(db: Session, company_id: int, period_start: date, period_end: date) -> dict:
    rev_rows = _totals_by_prefix(db, company_id, period_start, period_end, "SA")
    total_revenue = sum((_q(r["sum_cr"] - r["sum_dr"]) for r in rev_rows), _ZERO)

    cos_rows = _totals_by_prefix(db, company_id, period_start, period_end, "CO")
    total_cos = sum((_q(r["sum_dr"] - r["sum_cr"]) for r in cos_rows), _ZERO)

    gross_profit = total_revenue - total_cos

    oi_rows = _totals_by_prefix(db, company_id, period_start, period_end, "OI")
    other_income = sum((_q(r["sum_cr"] - r["sum_dr"]) for r in oi_rows), _ZERO)

    total_gross_revenue = gross_profit + other_income

    exp_rows = _totals_by_prefix(db, company_id, period_start, period_end, "EX")
    total_expenses = sum((_q(r["sum_dr"] - r["sum_cr"]) for r in exp_rows), _ZERO)

    profit_before_tax = total_gross_revenue - total_expenses

    tx_rows = _totals_by_prefix(db, company_id, period_start, period_end, "TX")
    taxation = sum((_q(r["sum_dr"] - r["sum_cr"]) for r in tx_rows), _ZERO)

    profit_after_tax = profit_before_tax - taxation

    pl_bf = _cumulative_net(db, company_id, period_start, "PL", credit_normal=True)
    pl_cf = pl_bf + profit_after_tax

    def _rev_lines(rows):
        return [
            {
                "code": r["code"],
                "name": r["name"],
                "amount": _q(r["sum_cr"] - r["sum_dr"]),
                "pct_of_revenue": _pct(_q(r["sum_cr"] - r["sum_dr"]), total_revenue),
            }
            for r in rows
        ]

    def _dr_lines(rows):
        return [
            {
                "code": r["code"],
                "name": r["name"],
                "amount": _q(r["sum_dr"] - r["sum_cr"]),
                "pct_of_revenue": _pct(_q(r["sum_dr"] - r["sum_cr"]), total_revenue),
            }
            for r in rows
        ]

    return {
        "period_start": period_start,
        "period_end": period_end,
        "revenue_lines": _rev_lines(rev_rows),
        "total_revenue": total_revenue,
        "cost_of_sales_lines": _dr_lines(cos_rows),
        "total_cost_of_sales": total_cos,
        "gross_profit": gross_profit,
        "other_income": other_income,
        "total_gross_revenue": total_gross_revenue,
        "expense_lines": _dr_lines(exp_rows),
        "total_expenses": total_expenses,
        "profit_before_tax": profit_before_tax,
        "taxation": taxation,
        "profit_after_tax": profit_after_tax,
        "pl_brought_forward": pl_bf,
        "pl_carried_forward": pl_cf,
    }


# ── Balance Sheet ─────────────────────────────────────────────────────────────

def get_balance_sheet(db: Session, company_id: int, period_start: date, period_end: date) -> dict:
    """Balance sheet is a snapshot at period_end — uses cumulative balances from all time."""
    period_end_date = period_end

    def _cum_rows(*prefixes, credit_normal=True):
        q = (
            db.query(
                LedgerEntry.account,
                Account.name,
                func.sum(LedgerEntry.dr_amount).label("sum_dr"),
                func.sum(LedgerEntry.cr_amount).label("sum_cr"),
            )
            .join(
                Account,
                (Account.company_id == LedgerEntry.company_id) & (Account.code == LedgerEntry.account),
            )
            .filter(
                LedgerEntry.company_id == company_id,
                LedgerEntry.date <= period_end_date,
            )
            .filter(or_(*(LedgerEntry.account.like(f"{p}%") for p in prefixes)))
            .group_by(LedgerEntry.account, Account.name)
            .order_by(LedgerEntry.account)
            .all()
        )
        return [
            {
                "code": r.account,
                "name": r.name,
                "amount": _q(r.sum_cr - r.sum_dr) if credit_normal else _q(r.sum_dr - r.sum_cr),
            }
            for r in q
        ]

    sc_rows = _cum_rows("SC", credit_normal=True)
    share_capital = sum((r["amount"] for r in sc_rows), _ZERO)

    pl_rows = _cum_rows("PL", credit_normal=True)
    pl_account = sum((r["amount"] for r in pl_rows), _ZERO)

    pl_data = get_profit_loss(db, company_id, period_start, period_end)
    pl_account_bs = pl_account + pl_data["profit_after_tax"]

    total_equity = share_capital + pl_account_bs

    ca_rows = _cum_rows("CA", "CB", credit_normal=False)
    td01_rows = _cum_rows_codes(db, company_id, period_end_date, ["TD01"], debit_normal=True)
    current_asset_lines = ca_rows + td01_rows
    total_current_assets = sum((r["amount"] for r in current_asset_lines), _ZERO)

    fa_rows = _cum_rows("FA", credit_normal=False)
    total_fixed_assets = sum((r["amount"] for r in fa_rows), _ZERO)

    cl_rows = _cum_rows("CL", credit_normal=True)
    td02_rows = _cum_rows_codes(db, company_id, period_end_date, ["TD02"], debit_normal=False)
    current_liability_lines = cl_rows + td02_rows
    total_current_liabilities = sum((r["amount"] for r in current_liability_lines), _ZERO)

    net_current_assets = total_current_assets - total_current_liabilities
    total_net_assets = net_current_assets + total_fixed_assets

    return {
        "period_end": period_end,
        "share_capital": share_capital,
        "profit_loss_account": pl_account_bs,
        "total_equity": total_equity,
        "current_assets": current_asset_lines,
        "total_current_assets": total_current_assets,
        "current_liabilities": current_liability_lines,
        "total_current_liabilities": total_current_liabilities,
        "net_current_assets": net_current_assets,
        "fixed_assets": fa_rows,
        "total_fixed_assets": total_fixed_assets,
        "total_net_assets": total_net_assets,
    }


# ── Ledger Account ────────────────────────────────────────────────────────────

def get_ledger_account(
    db: Session, company_id: int, code: str, period_start: date, period_end: date
) -> dict | None:
    acct = db.get(Account, (company_id, code.upper()))
    if not acct:
        return None

    from datetime import timedelta
    day_before = period_start - timedelta(days=1)
    pre = (
        db.query(
            func.sum(LedgerEntry.dr_amount).label("sum_dr"),
            func.sum(LedgerEntry.cr_amount).label("sum_cr"),
        )
        .filter(
            LedgerEntry.company_id == company_id,
            LedgerEntry.account == code.upper(),
            LedgerEntry.date <= day_before,
        )
        .one()
    )
    opening_balance = _q(pre.sum_dr or 0) - _q(pre.sum_cr or 0)

    entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.company_id == company_id,
            LedgerEntry.account == code.upper(),
            LedgerEntry.date >= period_start,
            LedgerEntry.date <= period_end,
        )
        .order_by(LedgerEntry.date, LedgerEntry.id)
        .all()
    )

    running = opening_balance
    lines = []
    total_dr = _ZERO
    total_cr = _ZERO
    for e in entries:
        dr = _q(e.dr_amount)
        cr = _q(e.cr_amount)
        running += dr - cr
        total_dr += dr
        total_cr += cr
        lines.append({
            "id": e.id,
            "date": e.date,
            "trx_no": e.trx_no,
            "particular": e.particular,
            "dr_amount": dr,
            "cr_amount": cr,
            "balance": running,
        })

    return {
        "code": acct.code,
        "name": acct.name,
        "period_start": period_start,
        "period_end": period_end,
        "opening_balance": opening_balance,
        "lines": lines,
        "total_dr": total_dr,
        "total_cr": total_cr,
        "closing_balance": running,
    }


# ── Expense Schedule ──────────────────────────────────────────────────────────

def get_expense_schedule(db: Session, company_id: int, period_start: date, period_end: date) -> dict:
    exp_rows = _totals_by_prefix(db, company_id, period_start, period_end, "EX")
    sa_rows = _totals_by_prefix(db, company_id, period_start, period_end, "SA")
    total_sales = sum((_q(r["sum_cr"] - r["sum_dr"]) for r in sa_rows), _ZERO)

    items = []
    total = _ZERO
    for r in exp_rows:
        amount = _q(r["sum_dr"] - r["sum_cr"])
        items.append({
            "code": r["code"],
            "name": r["name"],
            "amount": amount,
            "pct_of_sales": _pct(amount, total_sales),
        })
        total += amount

    return {
        "period_start": period_start,
        "period_end": period_end,
        "items": items,
        "total": total,
        "total_sales": total_sales,
        "total_pct": _pct(total, total_sales),
    }


# ── Debtors Listing ───────────────────────────────────────────────────────────

def get_debtors_listing(db: Session, company_id: int, period_start: date, period_end: date) -> dict:
    rows = _cum_rows_codes(db, company_id, period_end, ["TD01"], debit_normal=True)
    total = sum((r["amount"] for r in rows), _ZERO)
    return {"period_end": period_end, "items": rows, "total": total}


# ── Creditors Listing ─────────────────────────────────────────────────────────

def get_creditors_listing(db: Session, company_id: int, period_start: date, period_end: date) -> dict:
    rows = _cum_rows_codes(db, company_id, period_end, ["TD02"], debit_normal=False)
    total = sum((r["amount"] for r in rows), _ZERO)
    return {"period_end": period_end, "items": rows, "total": total}


# ── Fixed Assets ──────────────────────────────────────────────────────────────

def get_fixed_assets(db: Session, company_id: int, period_start: date, period_end: date) -> dict:
    q = (
        db.query(
            LedgerEntry.account,
            Account.name,
            func.sum(LedgerEntry.dr_amount).label("sum_dr"),
            func.sum(LedgerEntry.cr_amount).label("sum_cr"),
        )
        .join(
            Account,
            (Account.company_id == LedgerEntry.company_id) & (Account.code == LedgerEntry.account),
        )
        .filter(
            LedgerEntry.company_id == company_id,
            LedgerEntry.date <= period_end,
        )
        .filter(or_(LedgerEntry.account.like("FA%"), LedgerEntry.account.like("AD%")))
        .group_by(LedgerEntry.account, Account.name)
        .order_by(LedgerEntry.account)
        .all()
    )

    fa_map: dict[str, dict] = {}
    for r in q:
        suffix = r.account[2:]
        if r.account.startswith("FA"):
            fa_map.setdefault(suffix, {"code": r.account, "name": r.name, "cost": _ZERO, "accum_depn": _ZERO})
            fa_map[suffix]["cost"] = _q(r.sum_dr - r.sum_cr)
        elif r.account.startswith("AD"):
            fa_map.setdefault(suffix, {"code": f"FA{suffix}", "name": r.name, "cost": _ZERO, "accum_depn": _ZERO})
            fa_map[suffix]["accum_depn"] = _q(r.sum_cr - r.sum_dr)

    items = []
    total_cost = _ZERO
    total_depn = _ZERO
    total_nbv = _ZERO
    for entry in sorted(fa_map.values(), key=lambda x: x["code"]):
        nbv = entry["cost"] - entry["accum_depn"]
        items.append({
            "code": entry["code"],
            "name": entry["name"],
            "cost": entry["cost"],
            "accum_depn": entry["accum_depn"],
            "nbv": nbv,
        })
        total_cost += entry["cost"]
        total_depn += entry["accum_depn"]
        total_nbv += nbv

    return {
        "period_end": period_end,
        "items": items,
        "total_cost": total_cost,
        "total_accum_depn": total_depn,
        "total_nbv": total_nbv,
    }
