from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import (
    ALGORITHM,
    SECRET_KEY,
    CurrentUser,
    create_token,
    oauth2_scheme,
    verify_password,
)
from app.database import get_db
from app.limiter import login_rate_limit
from app.models.company import Company
from app.models.token_deny import TokenDeny
from app.models.user import User
from app.models.user_company_access import UserCompanyAccess
from app.schemas.user import LoginRequest, TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db), _: None = Depends(login_rate_limit)):
    user: User | None = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash) or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token, _ = create_token(user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser):
    return user


@router.get("/companies")
def get_user_companies(user: CurrentUser, db: Session = Depends(get_db)):
    """List companies the current user has access to, with their per-company access level."""
    if user.is_system_admin:
        companies = db.query(Company).filter(Company.is_active.is_(True)).order_by(Company.id).all()
        return [
            {"id": c.id, "name": c.name, "currency": c.currency, "access_level": 6}
            for c in companies
        ]
    rows = (
        db.query(UserCompanyAccess, Company)
        .join(Company, UserCompanyAccess.company_id == Company.id)
        .filter(
            UserCompanyAccess.user_id == user.id,
            Company.is_active.is_(True),
        )
        .order_by(Company.id)
        .all()
    )
    return [
        {"id": c.id, "name": c.name, "currency": c.currency, "access_level": uca.access_level}
        for uca, c in rows
    ]


class SelectCompanyRequest(BaseModel):
    company_id: int


@router.post("/select-company", response_model=TokenResponse)
def select_company(body: SelectCompanyRequest, user: CurrentUser, db: Session = Depends(get_db)):
    """Exchange a user-token for a company-scoped token."""
    company = db.get(Company, body.company_id)
    if not company or not company.is_active:
        raise HTTPException(status_code=404, detail="Company not found or inactive")

    if not user.is_system_admin:
        access = db.query(UserCompanyAccess).filter_by(
            user_id=user.id, company_id=body.company_id
        ).first()
        if not access:
            raise HTTPException(status_code=403, detail="No access to this company")

    token, _ = create_token(user.id, company_id=body.company_id)
    return TokenResponse(access_token=token)


@router.post("/logout", status_code=204)
def logout(
    raw_token: Annotated[str, Depends(oauth2_scheme)],
    _: CurrentUser,
    db: Session = Depends(get_db),
):
    payload = jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
    jti: str = payload["jti"]
    if not db.get(TokenDeny, jti):
        db.add(TokenDeny(jti=jti))
        db.commit()
