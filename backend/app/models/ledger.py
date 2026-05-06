from datetime import date
from decimal import Decimal
from sqlalchemy import Date, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class LedgerEntry(Base):
    __tablename__ = "ledger"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    trx_no: Mapped[str] = mapped_column(String(4), nullable=False, index=True)
    account: Mapped[str] = mapped_column(String(4), nullable=False, index=True)
    particular: Mapped[str] = mapped_column(String(45), nullable=False)
    dr_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    cr_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")

    __table_args__ = (
        Index("ix_ledger_date", "date"),
    )
