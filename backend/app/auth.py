"""
JWT + bcrypt authentication helpers and FastAPI dependencies.

Access levels:
  1  read-only  (any authenticated user)
  3  entry      (can create/edit journal transactions and phrases)
  6  admin      (user management, chart-of-accounts changes, setup)

System admin (is_system_admin=True): cross-company user management, company creation.

Two token types:
  user-token    — payload: {sub, jti, exp}          — issued on login
  company-token — payload: {sub, company_id, jti, exp} — issued on select-company
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.token_deny import TokenDeny
from app.models.user import User

SECRET_KEY: str = os.getenv("SECRET_KEY", "glpack-dev-secret-change-in-production")
ALGORITHM = "HS256"
_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_HOURS", "8")) * 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── token helpers ─────────────────────────────────────────────────────────────

def create_token(user_id: int, company_id: int | None = None) -> tuple[str, str]:
    """Return (access_token, jti). jti is stored on logout for revocation."""
    jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(minutes=_EXPIRE_MINUTES)
    payload: dict = {"sub": str(user_id), "jti": jti, "exp": expire}
    if company_id is not None:
        payload["company_id"] = company_id
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM), jti


# ── FastAPI dependencies ──────────────────────────────────────────────────────

def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise exc

    user_id: str | None = payload.get("sub")
    jti: str | None = payload.get("jti")
    if not user_id or not jti:
        raise exc

    if db.get(TokenDeny, jti):
        raise exc

    user = db.get(User, int(user_id))
    if not user:
        raise exc
    if not user.is_active:
        raise exc
    return user


def get_current_company(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> tuple[User, int, int]:
    """
    Returns (user, company_id, access_level).
    Raises 401 if token has no company_id.
    Raises 403 if user no longer has access to that company.
    System admins bypass the access table check and receive access_level 6.
    """
    from app.models.company import Company
    from app.models.user_company_access import UserCompanyAccess

    user = get_current_user(token, db)

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    company_id: int | None = payload.get("company_id")
    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No company selected. POST /auth/select-company first.",
        )

    if user.is_system_admin:
        company = db.get(Company, company_id)
        if not company or not company.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company not found or inactive")
        return user, company_id, 6

    access = db.query(UserCompanyAccess).filter_by(user_id=user.id, company_id=company_id).first()
    if not access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this company")
    return user, company_id, access.access_level


def require_level(min_level: int):
    """Return a dependency that enforces a minimum global access level."""
    def _dep(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.access_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access level {min_level} or higher required",
            )
        return user
    return _dep


def require_company_level(min_level: int):
    """Return a dependency that enforces a minimum per-company access level."""
    def _dep(
        ctx: Annotated[tuple[User, int, int], Depends(get_current_company)],
    ) -> tuple[User, int, int]:
        user, company_id, access_level = ctx
        if access_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Company access level {min_level} or higher required",
            )
        return ctx
    return _dep


def _require_system_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_system_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System administrator access required",
        )
    return user


# ── Annotated shorthands ──────────────────────────────────────────────────────

# Global / non-company-scoped
CurrentUser = Annotated[User, Depends(get_current_user)]
WriteAccess = Annotated[User, Depends(require_level(3))]
AdminAccess = Annotated[User, Depends(require_level(6))]
SystemAdmin = Annotated[User, Depends(_require_system_admin)]

# Company-scoped — yield (user, company_id, access_level)
CompanyUser  = Annotated[tuple[User, int, int], Depends(get_current_company)]
CompanyWrite = Annotated[tuple[User, int, int], Depends(require_company_level(3))]
CompanyAdmin = Annotated[tuple[User, int, int], Depends(require_company_level(6))]
