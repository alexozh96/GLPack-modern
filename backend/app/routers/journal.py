from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from itertools import groupby

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CompanyUser, CompanyWrite
from app.database import get_db
from app.models.account import Account
from app.models.company import Company
from app.models.ledger import LedgerEntry
from app.schemas.ledger import (
    JournalIn,
    JournalRead,
    JournalSummary,
    JournalSummaryLine,
    JournalUpdate,
    LedgerLineRead,
)

router = APIRouter(prefix="/journal", tags=["journal"])

_TWO = Decimal("0.01")


def _check_locked(db: Session, company_id: int, entry_date: date) -> None:
    company = db.get(Company, company_id)
    if company and company.locked_before:
        try:
            locked = date.fromisoformat(company.locked_before)
            if entry_date <= locked:
                raise HTTPException(status_code=403, detail=f"Period locked through {company.locked_before}")
        except ValueError:
            pass


def _assert_accounts_exist(db: Session, company_id: int, codes: list[str]) -> None:
    missing = [c for c in codes if not db.get(Account, (company_id, c))]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown account code(s): {', '.join(sorted(missing))}",
        )


def _next_trx_no(db: Session, company_id: int) -> str:
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


def _to_dec(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(_TWO, rounding=ROUND_HALF_UP)


def _build_journal_read(trx_no: str, entries: list[LedgerEntry]) -> JournalRead:
    lines = [LedgerLineRead.model_validate(e) for e in entries]
    return JournalRead(
        trx_no=trx_no,
        date=entries[0].date,
        lines=lines,
        total_dr=sum((l.dr_amount for l in lines), Decimal("0")),
        total_cr=sum((l.cr_amount for l in lines), Decimal("0")),
    )


@router.get("", response_model=list[JournalSummary])
def list_journals(
    ctx: CompanyUser,
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    account: str | None = Query(None),
    db: Session = Depends(get_db),
):
    _, company_id, _ = ctx
    q = (
        db.query(
            LedgerEntry.id,
            LedgerEntry.trx_no,
            LedgerEntry.date,
            LedgerEntry.account,
            LedgerEntry.particular,
            LedgerEntry.dr_amount,
            LedgerEntry.cr_amount,
            Account.name.label("account_name"),
        )
        .outerjoin(
            Account,
            (Account.company_id == LedgerEntry.company_id) & (Account.code == LedgerEntry.account),
        )
        .filter(LedgerEntry.company_id == company_id)
    )

    if from_date:
        q = q.filter(LedgerEntry.date >= from_date)
    if to_date:
        q = q.filter(LedgerEntry.date <= to_date)
    if account:
        acct = account.strip().upper()
        acct_trx = (
            select(LedgerEntry.trx_no)
            .where(LedgerEntry.company_id == company_id, LedgerEntry.account == acct)
            .distinct()
        )
        q = q.filter(LedgerEntry.trx_no.in_(acct_trx))

    rows = q.order_by(LedgerEntry.date, LedgerEntry.trx_no, LedgerEntry.id).all()

    result = []
    for (trx_no, date_val), group_iter in groupby(rows, key=lambda r: (r.trx_no, r.date)):
        group = list(group_iter)
        lines = [
            JournalSummaryLine(
                account_code=r.account,
                account_name=r.account_name or "",
                particular=r.particular,
                debit=_to_dec(r.dr_amount),
                credit=_to_dec(r.cr_amount),
            )
            for r in group
        ]
        result.append(
            JournalSummary(
                trx_no=trx_no,
                date=date_val,
                line_count=len(group),
                total_dr=sum(l.debit for l in lines),
                total_cr=sum(l.credit for l in lines),
                description=group[0].particular,
                lines=lines,
            )
        )
    return result


@router.get("/{trx_no}", response_model=JournalRead)
def get_journal(trx_no: str, ctx: CompanyUser, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.company_id == company_id, LedgerEntry.trx_no == trx_no.upper())
        .order_by(LedgerEntry.id)
        .all()
    )
    if not entries:
        raise HTTPException(status_code=404, detail="Journal not found")
    return _build_journal_read(trx_no.upper(), entries)


@router.post("", response_model=JournalRead, status_code=201)
def create_journal(body: JournalIn, ctx: CompanyWrite, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    trx_no = body.trx_no or _next_trx_no(db, company_id)

    if db.query(LedgerEntry).filter(
        LedgerEntry.company_id == company_id, LedgerEntry.trx_no == trx_no
    ).first():
        raise HTTPException(status_code=409, detail=f"trx_no '{trx_no}' already exists")

    _assert_accounts_exist(db, company_id, list({line.account for line in body.lines}))

    entries = [
        LedgerEntry(
            company_id=company_id,
            date=body.date,
            trx_no=trx_no,
            account=line.account,
            particular=line.particular,
            dr_amount=line.dr_amount,
            cr_amount=line.cr_amount,
        )
        for line in body.lines
    ]
    db.add_all(entries)
    db.commit()
    for e in entries:
        db.refresh(e)
    return _build_journal_read(trx_no, entries)


@router.put("/{trx_no}", response_model=JournalRead)
def update_journal(trx_no: str, body: JournalUpdate, ctx: CompanyWrite, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    trx_no = trx_no.upper()
    existing = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.company_id == company_id, LedgerEntry.trx_no == trx_no)
        .order_by(LedgerEntry.id)
        .all()
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Journal not found")
    _check_locked(db, company_id, existing[0].date)

    new_date = body.date if body.date is not None else existing[0].date

    if body.lines is not None:
        _assert_accounts_exist(db, company_id, list({line.account for line in body.lines}))
        for e in existing:
            db.delete(e)
        db.flush()
        entries = [
            LedgerEntry(
                company_id=company_id,
                date=new_date,
                trx_no=trx_no,
                account=line.account,
                particular=line.particular,
                dr_amount=line.dr_amount,
                cr_amount=line.cr_amount,
            )
            for line in body.lines
        ]
        db.add_all(entries)
    else:
        for e in existing:
            e.date = new_date
        entries = existing

    db.commit()
    for e in entries:
        db.refresh(e)
    return _build_journal_read(trx_no, entries)


class BulkJournalDeleteIn(BaseModel):
    trx_nos: list[str]


class BulkJournalDeleteResult(BaseModel):
    deleted: int
    locked: list[str]
    not_found: list[str]


@router.delete("/bulk", response_model=BulkJournalDeleteResult)
def bulk_delete_journals(body: BulkJournalDeleteIn, ctx: CompanyWrite, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    deleted = 0
    locked: list[str] = []
    not_found: list[str] = []
    for trx_no in body.trx_nos:
        entries = db.query(LedgerEntry).filter(
            LedgerEntry.company_id == company_id,
            LedgerEntry.trx_no == trx_no.upper(),
        ).all()
        if not entries:
            not_found.append(trx_no)
            continue
        try:
            _check_locked(db, company_id, entries[0].date)
        except HTTPException:
            locked.append(trx_no)
            continue
        for e in entries:
            db.delete(e)
        deleted += 1
    db.commit()
    return BulkJournalDeleteResult(deleted=deleted, locked=locked, not_found=not_found)


@router.delete("/{trx_no}", status_code=204)
def delete_journal(trx_no: str, ctx: CompanyWrite, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.company_id == company_id, LedgerEntry.trx_no == trx_no.upper())
        .all()
    )
    if not entries:
        raise HTTPException(status_code=404, detail="Journal not found")
    _check_locked(db, company_id, entries[0].date)
    for e in entries:
        db.delete(e)
    db.commit()
