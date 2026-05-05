import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import WriteAccess, get_current_user
from app.database import get_db
from app.models.account import Account
from app.models.ledger import LedgerEntry
from app.models.setup import Setup
from app.schemas.ledger import LedgerLineWithBalance

router = APIRouter(prefix="/ledger", tags=["ledger"], dependencies=[Depends(get_current_user)])

_TWO = Decimal("0.01")


class CsvImportResult(BaseModel):
    imported_rows: int
    imported_transactions: int


def _parse_dec(s: str) -> Decimal:
    try:
        return Decimal(s.strip().replace(",", "")).quantize(_TWO, rounding=ROUND_HALF_UP)
    except InvalidOperation:
        raise ValueError(f"invalid amount: {s!r}")


@router.get("", response_model=list[LedgerLineWithBalance])
def list_ledger(
    account: str | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    trx_no: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(LedgerEntry)
    if account:
        q = q.filter(LedgerEntry.account == account.strip().upper())
    if from_date:
        q = q.filter(LedgerEntry.date >= from_date)
    if to_date:
        q = q.filter(LedgerEntry.date <= to_date)
    if trx_no:
        q = q.filter(LedgerEntry.trx_no == trx_no.strip().upper())

    entries = q.order_by(LedgerEntry.date, LedgerEntry.id).all()

    running = Decimal("0")
    result = []
    for e in entries:
        running += Decimal(str(e.dr_amount)) - Decimal(str(e.cr_amount))
        result.append(
            LedgerLineWithBalance(
                id=e.id,
                trx_no=e.trx_no,
                date=e.date,
                particular=e.particular,
                dr_amount=Decimal(str(e.dr_amount)),
                cr_amount=Decimal(str(e.cr_amount)),
                balance=running,
            )
        )
    return result


@router.get("/export-csv")
def export_ledger_csv(
    account: str | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(LedgerEntry)
    if account:
        q = q.filter(LedgerEntry.account == account.strip().upper())
    if from_date:
        q = q.filter(LedgerEntry.date >= from_date)
    if to_date:
        q = q.filter(LedgerEntry.date <= to_date)
    entries = q.order_by(LedgerEntry.date, LedgerEntry.trx_no, LedgerEntry.id).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "trx_no", "account", "particular", "dr_amount", "cr_amount"])
    for e in entries:
        writer.writerow([e.date, e.trx_no, e.account, e.particular,
                         f"{e.dr_amount:.2f}", f"{e.cr_amount:.2f}"])

    parts = ["journal_entries"]
    if account:
        parts.append(account.upper())
    if from_date:
        parts.append(str(from_date))
    if to_date:
        parts.append(str(to_date))
    filename = "_".join(parts) + ".csv"

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import-csv", response_model=CsvImportResult)
async def import_csv(file: UploadFile, _: WriteAccess, db: Session = Depends(get_db)):
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(400, "Empty or unreadable CSV")

    norm = {k.strip().lower(): k for k in reader.fieldnames}
    required = {"date", "trx_no", "account", "particular", "dr_amount", "cr_amount"}
    missing = required - set(norm)
    if missing:
        raise HTTPException(400, f"CSV missing column(s): {', '.join(sorted(missing))}")

    # ── Parse all rows first ──────────────────────────────────────────────────
    errors: list[str] = []
    parsed: list[dict] = []
    for i, raw in enumerate(reader, start=2):
        try:
            row_date = date.fromisoformat(raw[norm["date"]].strip())
            trx = raw[norm["trx_no"]].strip().upper()
            if not trx or len(trx) > 4:
                raise ValueError(f"trx_no must be 1–4 characters, got {trx!r}")
            acct = raw[norm["account"]].strip().upper()
            if not acct or len(acct) > 4:
                raise ValueError(f"account must be 1–4 characters, got {acct!r}")
            particular = raw[norm["particular"]].strip()
            if not particular or len(particular) > 45:
                raise ValueError("particular must be 1–45 characters")
            dr = _parse_dec(raw[norm["dr_amount"]])
            cr = _parse_dec(raw[norm["cr_amount"]])
            if dr == 0 and cr == 0:
                raise ValueError("dr_amount and cr_amount cannot both be zero")
            parsed.append({"date": row_date, "trx_no": trx, "account": acct,
                           "particular": particular, "dr_amount": dr, "cr_amount": cr})
        except (ValueError, KeyError) as e:
            errors.append(f"Row {i}: {e}")

    if errors:
        raise HTTPException(422, detail=errors)

    # ── Validate trx_no balance ───────────────────────────────────────────────
    from collections import defaultdict
    groups: dict[str, list[dict]] = defaultdict(list)
    for row in parsed:
        groups[row["trx_no"]].append(row)

    for trx_no, rows in groups.items():
        total_dr = sum(r["dr_amount"] for r in rows)
        total_cr = sum(r["cr_amount"] for r in rows)
        if total_dr != total_cr:
            errors.append(f"trx_no {trx_no}: unbalanced (dr={total_dr} cr={total_cr})")

    if errors:
        raise HTTPException(422, detail=errors)

    # ── Validate accounts exist ───────────────────────────────────────────────
    codes = {r["account"] for r in parsed}
    for code in sorted(codes):
        if not db.get(Account, code):
            errors.append(f"Account {code!r} not found")

    if errors:
        raise HTTPException(422, detail=errors)

    # ── Check trx_no conflicts with existing DB entries ───────────────────────
    existing_trx = {row[0] for row in db.query(LedgerEntry.trx_no).distinct()}
    for trx_no in groups:
        if trx_no in existing_trx:
            errors.append(f"trx_no {trx_no!r} already exists in the database")

    if errors:
        raise HTTPException(422, detail=errors)

    # ── Check period lock ─────────────────────────────────────────────────────
    lock_row = db.get(Setup, "locked_before")
    if lock_row and lock_row.value:
        try:
            locked = date.fromisoformat(lock_row.value)
            for row in parsed:
                if row["date"] <= locked:
                    errors.append(
                        f"trx_no {row['trx_no']} date {row['date']} is in locked period (locked through {locked})"
                    )
                    break
        except ValueError:
            pass

    if errors:
        raise HTTPException(422, detail=errors)

    # ── Insert ────────────────────────────────────────────────────────────────
    entries = [
        LedgerEntry(
            date=row["date"], trx_no=row["trx_no"], account=row["account"],
            particular=row["particular"], dr_amount=row["dr_amount"], cr_amount=row["cr_amount"],
        )
        for row in parsed
    ]
    db.add_all(entries)
    db.commit()

    return CsvImportResult(imported_rows=len(entries), imported_transactions=len(groups))
