import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import AdminAccess, get_current_user
from app.database import get_db
from app.models.account import Account
from app.models.ledger import LedgerEntry
from app.schemas.account import AccountCreate, AccountRead, AccountUpdate


class AccountImportResult(BaseModel):
    imported: int
    skipped: int


class BulkDeleteIn(BaseModel):
    codes: list[str]


class BulkDeleteResult(BaseModel):
    deleted: int
    skipped: list[str]

router = APIRouter(prefix="/accounts", tags=["accounts"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[AccountRead])
def list_accounts(
    search: str | None = Query(None),
    prefix: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Account)
    if search:
        term = f"%{search}%"
        q = q.filter(Account.name.ilike(term) | Account.code.ilike(term))
    if prefix:
        q = q.filter(Account.code.ilike(f"{prefix}%"))
    return q.order_by(Account.code).all()


@router.get("/export-csv")
def export_accounts_csv(
    search: str | None = Query(None),
    prefix: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Account)
    if search:
        term = f"%{search}%"
        q = q.filter(Account.name.ilike(term) | Account.code.ilike(term))
    if prefix:
        q = q.filter(Account.code.ilike(f"{prefix}%"))
    accounts = q.order_by(Account.code).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["code", "name"])
    for a in accounts:
        writer.writerow([a.code, a.name])

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="accounts.csv"'},
    )


@router.get("/{code}", response_model=AccountRead)
def get_account(code: str, db: Session = Depends(get_db)):
    account = db.get(Account, code.upper())
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.post("", response_model=AccountRead, status_code=201)
def create_account(body: AccountCreate, _: AdminAccess, db: Session = Depends(get_db)):
    if db.get(Account, body.code):
        raise HTTPException(status_code=409, detail="Account code already exists")
    account = Account(code=body.code, name=body.name)
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.put("/{code}", response_model=AccountRead)
def update_account(code: str, body: AccountUpdate, _: AdminAccess, db: Session = Depends(get_db)):
    account = db.get(Account, code.upper())
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account.name = body.name
    db.commit()
    db.refresh(account)
    return account


@router.delete("/bulk", response_model=BulkDeleteResult)
def bulk_delete_accounts(body: BulkDeleteIn, _: AdminAccess, db: Session = Depends(get_db)):
    deleted = 0
    skipped: list[str] = []
    for code in body.codes:
        account = db.get(Account, code.upper())
        if not account:
            skipped.append(code)
            continue
        has_entries = db.query(LedgerEntry).filter(LedgerEntry.account == code.upper()).first()
        if has_entries:
            skipped.append(code)
            continue
        db.delete(account)
        deleted += 1
    db.commit()
    return BulkDeleteResult(deleted=deleted, skipped=skipped)


@router.delete("/{code}", status_code=204)
def delete_account(code: str, _: AdminAccess, db: Session = Depends(get_db)):
    account = db.get(Account, code.upper())
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()


@router.post("/import-csv", response_model=AccountImportResult)
async def import_accounts_csv(file: UploadFile, _: AdminAccess, db: Session = Depends(get_db)):
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(400, "Empty or unreadable CSV")

    norm = {k.strip().lower(): k for k in reader.fieldnames}
    missing = {"code", "name"} - set(norm)
    if missing:
        raise HTTPException(400, f"CSV missing column(s): {', '.join(sorted(missing))}")

    imported = skipped = 0
    for row in reader:
        code = row.get(norm["code"], "").strip().upper()[:4]
        name = row.get(norm["name"], "").strip()[:30]
        if not code or not name:
            skipped += 1
            continue
        if db.get(Account, code):
            skipped += 1
            continue
        db.add(Account(code=code, name=name))
        imported += 1

    db.commit()
    return AccountImportResult(imported=imported, skipped=skipped)
