from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BankRow(Base):
    __tablename__ = "bank_rows"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    matched_ledger_id: Mapped[int | None] = mapped_column(
        ForeignKey("ledger.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    imported_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
