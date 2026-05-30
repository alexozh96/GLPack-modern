import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from sqlalchemy.orm import Session

from app.auth import (
    ALGORITHM,
    SECRET_KEY,
    AnyAuthenticatedUser,
    CurrentUser,
    create_token,
    hash_password,
    oauth2_scheme,
    verify_password,
)
from app.database import get_db
from app.limiter import login_rate_limit
from app.models.company import Company
from app.models.token_deny import TokenDeny
from app.models.user import User
from app.models.user_company_access import UserCompanyAccess
from app.schemas.user import ChangePasswordRequest, LoginRequest, TokenResponse, UserRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    body: LoginRequest,
    db: Session = Depends(get_db),
    _: None = Depends(login_rate_limit),
):
    client_ip = request.client.host if request.client else "unknown"
    user: User | None = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash) or not user.is_active:
        logger.warning("login_failed username=%s ip=%s", body.username, client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token, _ = create_token(user.id)
    logger.info("login_success user_id=%s username=%s ip=%s", user.id, user.username, client_ip)
    return TokenResponse(access_token=token, must_change_password=user.must_change_password)


@router.get("/me", response_model=UserRead)
def me(user: AnyAuthenticatedUser):
    """Returns the current user. Accessible even when must_change_password is set."""
    return user


@router.post("/change-password", status_code=204)
def change_password(
    body: ChangePasswordRequest,
    user: AnyAuthenticatedUser,
    db: Session = Depends(get_db),
):
    """Change the authenticated user's password. Works even when must_change_password is set."""
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    db.commit()
    logger.info("password_changed user_id=%s", user.id)


@router.get("/companies")
def get_user_companies(user: CurrentUser, db: Session = Depends(get_db)):
    """List companies the current user has access to, with their per-company access level."""
    if user.platform_role in ("owner", "staff"):
        companies = db.query(Company).filter(Company.is_active.is_(True)).order_by(Company.id).all()
        level = 6 if user.platform_role == "owner" else 1
        return [
            {"id": c.id, "name": c.name, "currency": c.currency, "access_level": level}
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


from pydantic import BaseModel


class _SelectCompanyBody(BaseModel):
    company_id: int


@router.post("/select-company", response_model=TokenResponse)
def select_company(body: _SelectCompanyBody, user: CurrentUser, db: Session = Depends(get_db)):
    """Exchange a user-token for a company-scoped token."""
    company = db.get(Company, body.company_id)
    if not company or not company.is_active:
        raise HTTPException(status_code=404, detail="Company not found or inactive")

    if user.platform_role == "user":
        access = db.query(UserCompanyAccess).filter_by(
            user_id=user.id, company_id=body.company_id
        ).first()
        if not access:
            raise HTTPException(status_code=403, detail="No access to this company")

    token, _ = create_token(user.id, company_id=body.company_id)
    logger.info("company_selected user_id=%s company_id=%s", user.id, body.company_id)
    return TokenResponse(access_token=token)


@router.post("/logout", status_code=204)
def logout(
    raw_token: Annotated[str, Depends(oauth2_scheme)],
    user: AnyAuthenticatedUser,
    db: Session = Depends(get_db),
):
    payload = jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
    jti: str = payload["jti"]
    exp = payload.get("exp")
    expires_at = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None

    if not db.get(TokenDeny, jti):
        db.add(TokenDeny(jti=jti, expires_at=expires_at))
        db.commit()
    logger.info("logout user_id=%s", user.id)
