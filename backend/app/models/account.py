from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), primary_key=True)
    code: Mapped[str] = mapped_column(String(4), primary_key=True)
    name: Mapped[str] = mapped_column(String(30), nullable=False)
