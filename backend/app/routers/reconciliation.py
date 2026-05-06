import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import CompanyUser, CompanyWrite
from app.database import get_db
from app.models.ledger import LedgerEntry
from app.models.reconciliation import BankRow
from app.schemas.reconciliation import (
    BankRowRead,
    GlEntryRead,
    ImportResult,
    MatchedPairRead,
    MatchIn,
    ReconcSummary,
)

router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])

_TWO = Decimal("0.01")


def _parse_date(s: str) -> date:
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            from datetime import datetime as _dt
            return _dt.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unrecognised date: {s!r}")


def _parse_amount(s: str) -> Decimal:
    cleaned = s.strip().replace(",", "").lstrip("$£€")
    try:
        return Decimal(cleaned).quantize(_TWO)
    except InvalidOperation:
        raise ValueError(f"Unrecognised amount: {s!r}")


@router.post("/import", response_model=ImportResult)
async def import_csv(file: UploadFile, ctx: CompanyWrite, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(400, "Empty or unreadable CSV")

    norm = {k.strip().lower(): k for k in reader.fieldnames}
    required = {"date", "description", "amount"}
    missing = required - set(norm)
    if missing:
        raise HTTPException(400, f"CSV missing column(s): {', '.join(sorted(missing))}")

    rows: list[BankRow] = []
    for i, raw in enumerate(reader, start=2):
        try:
            d = _parse_date(raw[norm["date"]])
            desc = raw[norm["description"]].strip()
            amt = _parse_amount(raw[norm["amount"]])
        except ValueError as e:
            raise HTTPException(422, f"Row {i}: {e}")
        rows.append(BankRow(company_id=company_id, date=d, description=desc, amount=amt))

    db.add_all(rows)
    db.commit()
    return ImportResult(imported=len(rows))


@router.get("/unmatched", response_model=list[BankRowRead])
def get_unmatched(ctx: CompanyUser, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    rows = (
        db.query(BankRow)
        .filter(BankRow.company_id == company_id, BankRow.matched_ledger_id.is_(None))
        .order_by(BankRow.date, BankRow.id)
        .all()
    )
    return rows


@router.get("/matched", response_model=list[MatchedPairRead])
def get_matched(ctx: CompanyUser, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    pairs = (
        db.query(BankRow, LedgerEntry)
        .join(LedgerEntry, BankRow.matched_ledger_id == LedgerEntry.id)
        .filter(BankRow.company_id == company_id)
        .order_by(BankRow.date, BankRow.id)
        .all()
    )
    return [
        MatchedPairRead(
            bank_id=b.id,
            bank_date=b.date,
            bank_description=b.description,
            bank_amount=b.amount,
            gl_id=g.id,
            gl_date=g.date,
            gl_trx_no=g.trx_no,
            gl_account=g.account,
            gl_particular=g.particular,
            gl_dr_amount=g.dr_amount,
            gl_cr_amount=g.cr_amount,
        )
        for b, g in pairs
    ]


@router.get("/gl-cash", response_model=list[GlEntryRead])
def get_gl_cash(ctx: CompanyUser, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    matched_ids = db.query(BankRow.matched_ledger_id).filter(
        BankRow.company_id == company_id,
        BankRow.matched_ledger_id.isnot(None),
    )
    entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.company_id == company_id,
            LedgerEntry.account.like("CB%"),
            LedgerEntry.id.notin_(matched_ids),
        )
        .order_by(LedgerEntry.date, LedgerEntry.id)
        .all()
    )
    return entries


@router.post("/match", response_model=BankRowRead)
def match_entry(body: MatchIn, ctx: CompanyWrite, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    bank_row = db.get(BankRow, body.bank_row_id)
    if not bank_row or bank_row.company_id != company_id:
        raise HTTPException(404, "Bank row not found")
    if bank_row.matched_ledger_id is not None:
        raise HTTPException(409, "Bank row already matched")

    gl = db.get(LedgerEntry, body.ledger_entry_id)
    if not gl or gl.company_id != company_id:
        raise HTTPException(404, "Ledger entry not found")

    existing = db.query(BankRow).filter(
        BankRow.matched_ledger_id == body.ledger_entry_id
    ).first()
    if existing:
        raise HTTPException(409, "Ledger entry already matched to another bank row")

    bank_row.matched_ledger_id = body.ledger_entry_id
    db.commit()
    db.refresh(bank_row)
    return bank_row


@router.delete("/match/{bank_row_id}", status_code=204)
def unmatch_entry(bank_row_id: int, ctx: CompanyWrite, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    bank_row = db.get(BankRow, bank_row_id)
    if not bank_row or bank_row.company_id != company_id:
        raise HTTPException(404, "Bank row not found")
    bank_row.matched_ledger_id = None
    db.commit()


@router.get("/summary", response_model=ReconcSummary)
def get_summary(ctx: CompanyUser, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    total = db.query(BankRow).filter(BankRow.company_id == company_id).count()
    matched = db.query(BankRow).filter(
        BankRow.company_id == company_id,
        BankRow.matched_ledger_id.isnot(None),
    ).count()
    return ReconcSummary(total=total, matched=matched, unmatched=total - matched)
