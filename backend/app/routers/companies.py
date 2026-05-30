import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from jose import JWTError, jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import ALGORITHM, SECRET_KEY, CurrentUser, PlatformOwner, oauth2_scheme, hash_password
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
from app.schemas.user import CreateCompanyUserRequest, UserRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/companies", tags=["companies"])


def _require_company_admin_or_owner(
    company_id: int,
    user: User,
    token: str,
    db: Session,
) -> None:
    """Allow platform owner OR a company admin (access_level=6) with a company-scoped token."""
    if user.platform_role == "owner":
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


def _count_company_admins(company_id: int, exclude_user_id: int, db: Session) -> int:
    return (
        db.query(UserCompanyAccess)
        .filter(
            UserCompanyAccess.company_id == company_id,
            UserCompanyAccess.access_level == 6,
            UserCompanyAccess.user_id != exclude_user_id,
        )
        .count()
    )


@router.get("", response_model=list[CompanyRead])
def list_companies(user: CurrentUser, db: Session = Depends(get_db)):
    if user.platform_role in ("owner", "staff"):
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
def create_company(body: CompanyCreate, _: PlatformOwner, db: Session = Depends(get_db)):
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
    if user.platform_role == "user":
        access = db.query(UserCompanyAccess).filter_by(
            user_id=user.id, company_id=company_id
        ).first()
        if not access:
            raise HTTPException(403, "No access to this company")
    return company


@router.put("/{company_id}", response_model=CompanyRead)
def update_company(company_id: int, body: CompanyUpdate, _: PlatformOwner, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(company, field, value)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", response_model=CompanyRead)
def deactivate_company(company_id: int, _: PlatformOwner, db: Session = Depends(get_db)):
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
    _require_company_admin_or_owner(company_id, user, token, db)
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
    """Assign an existing platform user to a company by username."""
    _require_company_admin_or_owner(company_id, user, token, db)
    if not db.get(Company, company_id):
        raise HTTPException(404, "Company not found")

    # Look up by username — avoids exposing sequential user IDs to company admins
    target = db.query(User).filter(User.username == body.username).first()
    if not target:
        raise HTTPException(404, "User not found")

    existing = db.query(UserCompanyAccess).filter_by(
        user_id=target.id, company_id=company_id
    ).first()
    if existing:
        existing.access_level = body.access_level
    else:
        db.add(UserCompanyAccess(
            user_id=target.id,
            company_id=company_id,
            access_level=body.access_level,
        ))
    db.commit()
    return {"ok": True}


@router.post("/{company_id}/users/create", response_model=UserRead, status_code=201)
def create_company_user(
    company_id: int,
    body: CreateCompanyUserRequest,
    user: CurrentUser,
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
):
    """Create a new user scoped only to this company. Requires company admin or platform owner."""
    _require_company_admin_or_owner(company_id, user, token, db)
    company = db.get(Company, company_id)
    if not company or not company.is_active:
        raise HTTPException(404, "Company not found or inactive")

    new_user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        platform_role="user",
        must_change_password=True,
    )
    db.add(new_user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already exists")

    db.add(UserCompanyAccess(
        user_id=new_user.id,
        company_id=company_id,
        access_level=body.access_level,
    ))
    db.commit()
    db.refresh(new_user)
    logger.info(
        "company_user_created creator=%s new_user=%s company_id=%s",
        user.username, new_user.username, company_id,
    )
    return new_user


@router.put("/{company_id}/users/{user_id}")
def update_user_access(
    company_id: int,
    user_id: int,
    body: UpdateAccessBody,
    user: CurrentUser,
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
):
    _require_company_admin_or_owner(company_id, user, token, db)
    access = db.query(UserCompanyAccess).filter_by(
        user_id=user_id, company_id=company_id
    ).first()
    if not access:
        raise HTTPException(404, "User not assigned to this company")

    # Last-admin protection: prevent demoting the only remaining company admin
    if access.access_level == 6 and body.access_level < 6:
        if _count_company_admins(company_id, user_id, db) == 0 and user.platform_role != "owner":
            raise HTTPException(422, "Cannot demote the last company admin")

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
    _require_company_admin_or_owner(company_id, user, token, db)
    access = db.query(UserCompanyAccess).filter_by(
        user_id=user_id, company_id=company_id
    ).first()
    if not access:
        raise HTTPException(404, "User not assigned to this company")

    # Last-admin protection
    if access.access_level == 6:
        if _count_company_admins(company_id, user_id, db) == 0 and user.platform_role != "owner":
            raise HTTPException(422, "Cannot remove the last company admin")

    db.delete(access)
    db.commit()
