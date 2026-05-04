from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
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
from app.models.token_deny import TokenDeny
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user: User | None = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token, _ = create_token(user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser):
    return user


@router.post("/logout", status_code=204)
def logout(
    raw_token: Annotated[str, Depends(oauth2_scheme)],
    _: CurrentUser,
    db: Session = Depends(get_db),
):
    # get_current_user already validated the token — safe to decode without re-checking
    payload = jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
    jti: str = payload["jti"]
    if not db.get(TokenDeny, jti):
        db.add(TokenDeny(jti=jti))
        db.commit()
