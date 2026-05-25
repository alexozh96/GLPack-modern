from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.auth import ALGORITHM, SECRET_KEY, CurrentUser, SystemAdmin, oauth2_scheme
from app.database import get_db
from app.models.company import Company
from app.models.user import User
from app.models.user_company_access import UserCompanyAccess
from app.schemas.company import (
    AssignUserBody,
    CompanyCreate,
    CompanyRead,
    CompanyUpdate,
    UpdateAccessBody,
    UserCompanyAccessRead,
)

router = APIRouter(prefix="/companies", tags=["companies"])


def _require_company_admin_or_sysadmin(
    company_id: int,
    user: User,
    token: str,
    db: Session,
) -> None:
    """Allow system admin (user-level token) OR company admin (access_level=6 in company-scoped token)."""
    if user.is_system_admin:
        return
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Not authenticated")
    token_company_id: int | None = payload.get("company_id")
    if token_company_id != company_id:
        raise HTTPException(403, "Token not scoped to this company")
    access = db.query(UserCompanyAccess).filter_by(
        user_id=user.id, company_id=company_id
    ).first()
    if not access or access.access_level < 6:
        raise HTTPException(403, "Company admin access required")


@router.get("", response_model=list[CompanyRead])
def list_companies(user: CurrentUser, db: Session = Depends(get_db)):
    if user.is_system_admin:
        return db.query(Company).order_by(Company.id).all()
    company_ids = [
        r.company_id
        for r in db.query(UserCompanyAccess).filter_by(user_id=user.id).all()
    ]
    return (
        db.query(Company)
        .filter(Company.id.in_(company_ids), Company.is_active.is_(True))
        .order_by(Company.id)
        .all()
    )


@router.post("", response_model=CompanyRead, status_code=201)
def create_company(body: CompanyCreate, _: SystemAdmin, db: Session = Depends(get_db)):
    company = Company(**body.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyRead)
def get_company(company_id: int, user: CurrentUser, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    if not user.is_system_admin:
        access = db.query(UserCompanyAccess).filter_by(
            user_id=user.id, company_id=company_id
        ).first()
        if not access:
            raise HTTPException(403, "No access to this company")
    return company


@router.put("/{company_id}", response_model=CompanyRead)
def update_company(company_id: int, body: CompanyUpdate, _: SystemAdmin, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(company, field, value)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", response_model=CompanyRead)
def deactivate_company(company_id: int, _: SystemAdmin, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    company.is_active = False
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}/users", response_model=list[UserCompanyAccessRead])
def list_company_users(
    company_id: int,
    user: CurrentUser,
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
):
    _require_company_admin_or_sysadmin(company_id, user, token, db)
    if not db.get(Company, company_id):
        raise HTTPException(404, "Company not found")
    rows = (
        db.query(UserCompanyAccess, User)
        .join(User, UserCompanyAccess.user_id == User.id)
        .filter(UserCompanyAccess.company_id == company_id)
        .all()
    )
    return [
        UserCompanyAccessRead(
            user_id=uca.user_id,
            username=u.username,
            access_level=uca.access_level,
        )
        for uca, u in rows
    ]


@router.post("/{company_id}/users", status_code=201)
def assign_user(
    company_id: int,
    body: AssignUserBody,
    user: CurrentUser,
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
):
    _require_company_admin_or_sysadmin(company_id, user, token, db)
    if not db.get(Company, company_id):
        raise HTTPException(404, "Company not found")
    if not db.get(User, body.user_id):
        raise HTTPException(404, "User not found")
    existing = db.query(UserCompanyAccess).filter_by(
        user_id=body.user_id, company_id=company_id
    ).first()
    if existing:
        existing.access_level = body.access_level
    else:
        db.add(UserCompanyAccess(
            user_id=body.user_id,
            company_id=company_id,
            access_level=body.access_level,
        ))
    db.commit()
    return {"ok": True}


@router.put("/{company_id}/users/{user_id}")
def update_user_access(
    company_id: int,
    user_id: int,
    body: UpdateAccessBody,
    user: CurrentUser,
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
):
    _require_company_admin_or_sysadmin(company_id, user, token, db)
    access = db.query(UserCompanyAccess).filter_by(
        user_id=user_id, company_id=company_id
    ).first()
    if not access:
        raise HTTPException(404, "User not assigned to this company")
    access.access_level = body.access_level
    db.commit()
    return {"ok": True}


@router.delete("/{company_id}/users/{user_id}", status_code=204)
def remove_user_access(
    company_id: int,
    user_id: int,
    user: CurrentUser,
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
):
    _require_company_admin_or_sysadmin(company_id, user, token, db)
    access = db.query(UserCompanyAccess).filter_by(
        user_id=user_id, company_id=company_id
    ).first()
    if not access:
        raise HTTPException(404, "User not assigned to this company")
    db.delete(access)
    db.commit()
