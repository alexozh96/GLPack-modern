"""
JWT + bcrypt authentication helpers and FastAPI dependencies.

Platform roles (User.platform_role):
  'owner'  — full platform control: create companies/users, view all data
  'staff'  — view-only across all companies (read-only, no financial writes)
  'user'   — standard user, scoped to explicitly assigned companies only

Company access levels (UserCompanyAccess.access_level):
  1  viewer      — read-only
  3  bookkeeper  — create/edit/delete journals, phrases, bank reconciliation
  4  accountant  — bookkeeper + create/edit/delete chart-of-accounts
  6  admin       — full company control: setup, period close, user management

Two token types:
  user-token    — payload: {sub, jti, exp}              — issued on login
  company-token — payload: {sub, company_id, jti, exp}  — issued on select-company
"""

import os
import sys
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

_DEFAULT_SECRET = "glpack-dev-secret-change-in-production"
SECRET_KEY: str = os.getenv("SECRET_KEY", _DEFAULT_SECRET)
ALGORITHM = "HS256"
_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_HOURS", "8")) * 60

# Refuse to start with the hardcoded default key outside of test/dev contexts.
# "pytest" is in sys.modules when pytest is running; devs can also set
# GLPACK_INSECURE_DEV=1 in their .env to bypass for local development.
if (
    SECRET_KEY == _DEFAULT_SECRET or len(SECRET_KEY) < 32
) and "pytest" not in sys.modules and not os.getenv("GLPACK_INSECURE_DEV"):
    raise RuntimeError(
        "SECRET_KEY is not configured or too weak (min 32 chars). "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\" "
        "and set it in your .env file. "
        "For local dev only, set GLPACK_INSECURE_DEV=1 in .env to bypass this check."
    )

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


# ── core token → user resolution (no policy checks) ──────────────────────────

def _resolve_user_from_token(token: str, db: Session) -> User:
    """Decode the token and return the matching active user. No policy enforcement."""
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
    if not user or not user.is_active:
        raise exc
    return user


# ── FastAPI dependencies ──────────────────────────────────────────────────────

def _get_any_authenticated_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> User:
    """Authenticate the user but do NOT enforce must_change_password.
    Use for endpoints that must remain accessible during the forced password-change flow
    (logout, /auth/me, /auth/change-password)."""
    return _resolve_user_from_token(token, db)


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> User:
    """Authenticate and enforce must_change_password. Used by all normal endpoints."""
    user = _resolve_user_from_token(token, db)
    if user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "MUST_CHANGE_PASSWORD",
                "message": "Password change required before using this endpoint.",
            },
        )
    return user


def get_current_company(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> tuple[User, int, int]:
    """
    Returns (user, company_id, access_level).

    Platform owners  → access_level 6 in any active company.
    Platform staff   → access_level 1 (read-only) in any active company.
    Standard users   → access_level from UserCompanyAccess; 403 if not assigned.

    Raises 401 if the token has no company_id claim.
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

    company = db.get(Company, company_id)
    if not company or not company.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company not found or inactive")

    if user.platform_role == "owner":
        return user, company_id, 6

    if user.platform_role == "staff":
        return user, company_id, 1

    # Standard user — must have explicit per-company access
    access = db.query(UserCompanyAccess).filter_by(user_id=user.id, company_id=company_id).first()
    if not access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this company")
    return user, company_id, access.access_level


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


def _require_platform_owner(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.platform_role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform owner access required",
        )
    return user


def _require_platform_staff_or_owner(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.platform_role not in ("owner", "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform staff or owner access required",
        )
    return user


# ── Annotated shorthands ──────────────────────────────────────────────────────

# Bypass must_change_password — for logout, /me, /change-password only
AnyAuthenticatedUser = Annotated[User, Depends(_get_any_authenticated_user)]

# Normal authenticated user (blocks must_change_password)
CurrentUser = Annotated[User, Depends(get_current_user)]

# Platform-level roles
PlatformOwner = Annotated[User, Depends(_require_platform_owner)]
PlatformStaff = Annotated[User, Depends(_require_platform_staff_or_owner)]

# Company-scoped — yield (user, company_id, access_level)
CompanyUser      = Annotated[tuple[User, int, int], Depends(get_current_company)]
CompanyWrite     = Annotated[tuple[User, int, int], Depends(require_company_level(3))]
CompanyAccountant = Annotated[tuple[User, int, int], Depends(require_company_level(4))]
CompanyAdmin     = Annotated[tuple[User, int, int], Depends(require_company_level(6))]
