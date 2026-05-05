from __future__ import annotations

from datetime import date as _Date
from decimal import Decimal
from pydantic import BaseModel, field_validator, model_validator


class LedgerLineIn(BaseModel):
    account: str
    particular: str
    dr_amount: Decimal = Decimal("0")
    cr_amount: Decimal = Decimal("0")

    @field_validator("account")
    @classmethod
    def normalise_account(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("particular")
    @classmethod
    def validate_particular(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("particular cannot be empty")
        if len(v) > 45:
            raise ValueError("particular must be 45 characters or fewer")
        return v

    @field_validator("dr_amount", "cr_amount", mode="before")
    @classmethod
    def non_negative(cls, v) -> Decimal:
        d = Decimal(str(v))
        if d < 0:
            raise ValueError("amounts must be non-negative")
        return d

    @model_validator(mode="after")
    def not_both_zero(self) -> LedgerLineIn:
        if self.dr_amount == 0 and self.cr_amount == 0:
            raise ValueError("each line must have a non-zero dr_amount or cr_amount")
        return self


class JournalIn(BaseModel):
    trx_no: str | None = None
    date: _Date
    lines: list[LedgerLineIn]

    @field_validator("trx_no")
    @classmethod
    def validate_trx_no(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().upper()
        if not v:
            return None
        if len(v) > 4:
            raise ValueError("trx_no must be 4 characters or fewer")
        return v

    @field_validator("lines")
    @classmethod
    def at_least_one_line(cls, v: list) -> list:
        if not v:
            raise ValueError("journal must have at least one line")
        return v

    @model_validator(mode="after")
    def balanced(self) -> JournalIn:
        total_dr = sum(line.dr_amount for line in self.lines)
        total_cr = sum(line.cr_amount for line in self.lines)
        if total_dr != total_cr:
            raise ValueError(f"journal is unbalanced: dr={total_dr} cr={total_cr}")
        return self


class JournalUpdate(BaseModel):
    date: _Date | None = None
    lines: list[LedgerLineIn] | None = None

    @model_validator(mode="after")
    def balanced_if_lines(self) -> JournalUpdate:
        if self.lines is None:
            return self
        total_dr = sum(line.dr_amount for line in self.lines)
        total_cr = sum(line.cr_amount for line in self.lines)
        if total_dr != total_cr:
            raise ValueError(f"journal is unbalanced: dr={total_dr} cr={total_cr}")
        return self


class LedgerLineRead(BaseModel):
    id: int
    account: str
    particular: str
    dr_amount: Decimal
    cr_amount: Decimal

    model_config = {"from_attributes": True}


class JournalRead(BaseModel):
    trx_no: str
    date: _Date
    lines: list[LedgerLineRead]
    total_dr: Decimal
    total_cr: Decimal


class JournalSummaryLine(BaseModel):
    account_code: str
    account_name: str
    particular: str
    debit: Decimal
    credit: Decimal


class JournalSummary(BaseModel):
    trx_no: str
    date: _Date
    line_count: int
    total_dr: Decimal
    total_cr: Decimal
    description: str
    lines: list[JournalSummaryLine]


class LedgerLineWithBalance(BaseModel):
    id: int
    trx_no: str
    date: _Date
    particular: str
    dr_amount: Decimal
    cr_amount: Decimal
    balance: Decimal
