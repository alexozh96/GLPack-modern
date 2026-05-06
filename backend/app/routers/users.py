from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import SystemAdmin, hash_password
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(_: SystemAdmin, db: Session = Depends(get_db)):
    return db.query(User).order_by(User.id).all()


@router.post("", response_model=UserRead, status_code=201)
def create_user(body: UserCreate, _: SystemAdmin, db: Session = Depends(get_db)):
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        access_level=body.access_level,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already exists")
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, _: SystemAdmin, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserRead)
def update_user(user_id: int, body: UserUpdate, admin: SystemAdmin, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.username is not None:
        user.username = body.username
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    if body.access_level is not None:
        if user.id == admin.id and body.access_level < 6:
            raise HTTPException(status_code=422, detail="Cannot reduce your own access level")
        user.access_level = body.access_level
    if body.is_active is not None:
        if user.id == admin.id and not body.is_active:
            raise HTTPException(status_code=422, detail="Cannot deactivate your own account")
        user.is_active = body.is_active
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already exists")
    db.refresh(user)
    return user


@router.delete("/{user_id}", response_model=UserRead)
def deactivate_user(user_id: int, admin: SystemAdmin, db: Session = Depends(get_db)):
    """Soft-deactivates a user. Preserves audit trail."""
    if user_id == admin.id:
        raise HTTPException(status_code=422, detail="Cannot deactivate your own account")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user
