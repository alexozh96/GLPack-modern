"""Seed the default admin user. Password must be changed on first login."""
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models.user import User


def seed_users(session: Session) -> int:
    if session.query(User).filter(User.username == "admin").first():
        return 0  # already exists
    session.add(User(
        username="admin",
        password_hash=hash_password("Admin123!"),
        platform_role="owner",
        must_change_password=True,
    ))
    return 1
