from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    code: Mapped[str] = mapped_column(String(4), primary_key=True)
    name: Mapped[str] = mapped_column(String(30), nullable=False)
