from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import AdminAccess, get_current_user
from app.database import get_db
from app.models.account import Account
from app.schemas.account import AccountCreate, AccountRead, AccountUpdate

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


@router.delete("/{code}", status_code=204)
def delete_account(code: str, _: AdminAccess, db: Session = Depends(get_db)):
    account = db.get(Account, code.upper())
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()
