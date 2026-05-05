from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import WriteAccess, get_current_user
from app.database import get_db
from app.models.account import Account
from app.models.ledger import LedgerEntry
from app.models.setup import Setup
from app.schemas.ledger import (
    JournalIn,
    JournalRead,
    JournalSummary,
    JournalUpdate,
    LedgerLineRead,
)

router = APIRouter(prefix="/journal", tags=["journal"], dependencies=[Depends(get_current_user)])

_TWO = Decimal("0.01")


def _check_locked(db: Session, entry_date: date) -> None:
    row = db.get(Setup, "locked_before")
    if row and row.value:
        try:
            locked = date.fromisoformat(row.value)
            if entry_date <= locked:
                raise HTTPException(status_code=403, detail=f"Period locked through {row.value}")
        except ValueError:
            pass


def _assert_accounts_exist(db: Session, codes: list[str]) -> None:
    missing = [c for c in codes if not db.get(Account, c)]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown account code(s): {', '.join(sorted(missing))}",
        )


def _next_trx_no(db: Session) -> str:
    used = {row[0] for row in db.query(LedgerEntry.trx_no).distinct()}
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
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    account: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(LedgerEntry)

    if from_date:
        q = q.filter(LedgerEntry.date >= from_date)
    if to_date:
        q = q.filter(LedgerEntry.date <= to_date)
    if account:
        acct = account.strip().upper()
        acct_trx = (
            select(LedgerEntry.trx_no)
            .where(LedgerEntry.account == acct)
            .distinct()
        )
        q = q.filter(LedgerEntry.trx_no.in_(acct_trx))

    rows = (
        q.with_entities(
            LedgerEntry.trx_no,
            LedgerEntry.date,
            func.count().label("line_count"),
            func.sum(LedgerEntry.dr_amount).label("total_dr"),
            func.sum(LedgerEntry.cr_amount).label("total_cr"),
            func.min(LedgerEntry.particular).label("description"),
        )
        .group_by(LedgerEntry.trx_no, LedgerEntry.date)
        .order_by(LedgerEntry.date, LedgerEntry.trx_no)
        .all()
    )

    return [
        JournalSummary(
            trx_no=row.trx_no,
            date=row.date,
            line_count=row.line_count,
            total_dr=_to_dec(row.total_dr),
            total_cr=_to_dec(row.total_cr),
            description=row.description or "",
        )
        for row in rows
    ]


@router.get("/{trx_no}", response_model=JournalRead)
def get_journal(trx_no: str, db: Session = Depends(get_db)):
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.trx_no == trx_no.upper())
        .order_by(LedgerEntry.id)
        .all()
    )
    if not entries:
        raise HTTPException(status_code=404, detail="Journal not found")
    return _build_journal_read(trx_no.upper(), entries)


@router.post("", response_model=JournalRead, status_code=201)
def create_journal(body: JournalIn, _: WriteAccess, db: Session = Depends(get_db)):
    trx_no = body.trx_no or _next_trx_no(db)

    if db.query(LedgerEntry).filter(LedgerEntry.trx_no == trx_no).first():
        raise HTTPException(status_code=409, detail=f"trx_no '{trx_no}' already exists")

    _assert_accounts_exist(db, list({line.account for line in body.lines}))

    entries = [
        LedgerEntry(
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
def update_journal(trx_no: str, body: JournalUpdate, _: WriteAccess, db: Session = Depends(get_db)):
    trx_no = trx_no.upper()
    existing = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.trx_no == trx_no)
        .order_by(LedgerEntry.id)
        .all()
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Journal not found")
    _check_locked(db, existing[0].date)

    new_date = body.date if body.date is not None else existing[0].date

    if body.lines is not None:
        _assert_accounts_exist(db, list({line.account for line in body.lines}))
        for e in existing:
            db.delete(e)
        db.flush()
        entries = [
            LedgerEntry(
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
def bulk_delete_journals(body: BulkJournalDeleteIn, _: WriteAccess, db: Session = Depends(get_db)):
    deleted = 0
    locked: list[str] = []
    not_found: list[str] = []
    for trx_no in body.trx_nos:
        entries = db.query(LedgerEntry).filter(LedgerEntry.trx_no == trx_no.upper()).all()
        if not entries:
            not_found.append(trx_no)
            continue
        try:
            _check_locked(db, entries[0].date)
        except HTTPException:
            locked.append(trx_no)
            continue
        for e in entries:
            db.delete(e)
        deleted += 1
    db.commit()
    return BulkJournalDeleteResult(deleted=deleted, locked=locked, not_found=not_found)


@router.delete("/{trx_no}", status_code=204)
def delete_journal(trx_no: str, _: WriteAccess, db: Session = Depends(get_db)):
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.trx_no == trx_no.upper())
        .all()
    )
    if not entries:
        raise HTTPException(status_code=404, detail="Journal not found")
    _check_locked(db, entries[0].date)
    for e in entries:
        db.delete(e)
    db.commit()
