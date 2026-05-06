"""Seed the default admin user (username: admin, password: admin123, level: 6)."""
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models.user import User


def seed_users(session: Session) -> int:
    if session.query(User).filter(User.username == "admin").first():
        return 0  # already exists
    session.add(User(
        username="admin",
        password_hash=hash_password("admin123"),
        access_level=6,
        is_system_admin=True,
    ))
    return 1
