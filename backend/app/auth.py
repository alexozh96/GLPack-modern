"""
JWT + bcrypt authentication helpers and FastAPI dependencies.

Access levels:
  1  read-only  (any authenticated user)
  3  entry      (can create/edit journal transactions and phrases)
  6  admin      (user management, chart-of-accounts changes, setup)
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
_EXPIRE_MINUTES = 60 * 8  # 8-hour sessions

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── token helpers ─────────────────────────────────────────────────────────────

def create_token(user_id: int) -> tuple[str, str]:
    """Return (access_token, jti). jti is stored on logout for revocation."""
    jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(minutes=_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "jti": jti, "exp": expire}
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
    return user


def require_level(min_level: int):
    """Return a dependency that enforces a minimum access level and yields the user."""
    def _dep(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.access_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access level {min_level} or higher required",
            )
        return user
    return _dep


# Annotated shorthands for route signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
WriteAccess = Annotated[User, Depends(require_level(3))]
AdminAccess = Annotated[User, Depends(require_level(6))]
