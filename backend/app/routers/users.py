from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import AdminAccess, hash_password
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(_: AdminAccess, db: Session = Depends(get_db)):
    return db.query(User).order_by(User.id).all()


@router.post("", response_model=UserRead, status_code=201)
def create_user(body: UserCreate, _: AdminAccess, db: Session = Depends(get_db)):
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
def get_user(user_id: int, _: AdminAccess, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserRead)
def update_user(user_id: int, body: UserUpdate, admin: AdminAccess, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.username is not None:
        user.username = body.username
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    if body.access_level is not None:
        # Prevent the admin from demoting themselves
        if user.id == admin.id and body.access_level < 6:
            raise HTTPException(status_code=422, detail="Cannot reduce your own access level")
        user.access_level = body.access_level
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already exists")
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, admin: AdminAccess, db: Session = Depends(get_db)):
    if user_id == admin.id:
        raise HTTPException(status_code=422, detail="Cannot delete your own account")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
