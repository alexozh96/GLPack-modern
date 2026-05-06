from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.company import Company
from app.models.ledger import LedgerEntry

_TWO = Decimal("0.01")
_ZERO = Decimal("0.00")

_PL_PREFIXES = ("SA", "CO", "OI", "EX", "TX")
_CREDIT_NORMAL_PREFIXES = {"SA", "OI"}


def _q(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(_TWO, rounding=ROUND_HALF_UP)


def _pl_account_balances(db: Session, company_id: int, up_to: date) -> list[dict]:
    """Cumulative per-account sums for all P&L accounts up to date."""
    q = (
        db.query(
            LedgerEntry.account,
            func.sum(LedgerEntry.dr_amount).label("sum_dr"),
            func.sum(LedgerEntry.cr_amount).label("sum_cr"),
        )
        .filter(
            LedgerEntry.company_id == company_id,
            LedgerEntry.date <= up_to,
            or_(*(LedgerEntry.account.like(f"{p}%") for p in _PL_PREFIXES)),
        )
        .group_by(LedgerEntry.account)
        .order_by(LedgerEntry.account)
        .all()
    )
    return [{"code": r.account, "sum_dr": _q(r.sum_dr), "sum_cr": _q(r.sum_cr)} for r in q]


def _next_trx(db: Session, company_id: int) -> str:
    used = {
        row[0]
        for row in db.query(LedgerEntry.trx_no)
        .filter(LedgerEntry.company_id == company_id)
        .distinct()
    }
    max_n = 0
    for code in used:
        try:
            max_n = max(max_n, int(code))
        except (ValueError, TypeError):
            pass
    n = max_n + 1
    while str(n).zfill(4) in used:
        n += 1
    return str(n).zfill(4)


def _get_or_create_pl_account(db: Session, company_id: int) -> str:
    row = (
        db.query(Account)
        .filter(Account.company_id == company_id, Account.code.like("PL%"))
        .order_by(Account.code)
        .first()
    )
    if row:
        return row.code
    acct = Account(company_id=company_id, code="PL01", name="Profit & Loss Account")
    db.add(acct)
    db.flush()
    return "PL01"


def close_period(db: Session, company_id: int, period_end: date) -> dict:
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")

    if company.locked_before:
        try:
            existing = date.fromisoformat(company.locked_before)
            if existing >= period_end:
                raise HTTPException(400, f"Period already closed through {company.locked_before}")
        except ValueError:
            pass

    pl_rows = _pl_account_balances(db, company_id, period_end)
    pl_acct = _get_or_create_pl_account(db, company_id)

    dr_lines: list[tuple[str, Decimal]] = []
    cr_lines: list[tuple[str, Decimal]] = []

    for r in pl_rows:
        prefix = next((p for p in _PL_PREFIXES if r["code"].startswith(p)), None)
        if prefix is None:
            continue
        if prefix in _CREDIT_NORMAL_PREFIXES:
            net = r["sum_cr"] - r["sum_dr"]
            if net > _ZERO:
                dr_lines.append((r["code"], net))
            elif net < _ZERO:
                cr_lines.append((r["code"], -net))
        else:
            net = r["sum_dr"] - r["sum_cr"]
            if net > _ZERO:
                cr_lines.append((r["code"], net))
            elif net < _ZERO:
                dr_lines.append((r["code"], -net))

    total_revenue_close = sum(a for _, a in dr_lines)
    total_cost_close = sum(a for _, a in cr_lines)
    profit = total_revenue_close - total_cost_close

    closing_count = 0
    if dr_lines or cr_lines:
        trx = _next_trx(db, company_id)
        entries: list[LedgerEntry] = []

        for code, amt in dr_lines:
            entries.append(LedgerEntry(
                company_id=company_id,
                date=period_end, trx_no=trx, account=code,
                particular="BALANCE CARRIED DOWN", dr_amount=amt, cr_amount=_ZERO,
            ))
        for code, amt in cr_lines:
            entries.append(LedgerEntry(
                company_id=company_id,
                date=period_end, trx_no=trx, account=code,
                particular="BALANCE CARRIED DOWN", dr_amount=_ZERO, cr_amount=amt,
            ))

        if profit > _ZERO:
            entries.append(LedgerEntry(
                company_id=company_id,
                date=period_end, trx_no=trx, account=pl_acct,
                particular="BALANCE CARRIED DOWN", dr_amount=_ZERO, cr_amount=profit,
            ))
        elif profit < _ZERO:
            entries.append(LedgerEntry(
                company_id=company_id,
                date=period_end, trx_no=trx, account=pl_acct,
                particular="BALANCE CARRIED DOWN", dr_amount=-profit, cr_amount=_ZERO,
            ))

        db.add_all(entries)
        closing_count = len(entries)

    company.locked_before = str(period_end)
    db.commit()

    return {
        "period_end": str(period_end),
        "locked_before": str(period_end),
        "closing_lines_written": closing_count,
        "net_profit": str(profit),
    }
