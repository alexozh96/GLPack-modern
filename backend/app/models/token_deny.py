from datetime import datetime
from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class TokenDeny(Base):
    """Revoked JWT IDs — populated on logout, checked on every authenticated request."""
    __tablename__ = "token_deny"

    jti: Mapped[str] = mapped_column(String(36), primary_key=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
