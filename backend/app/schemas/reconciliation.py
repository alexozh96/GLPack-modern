from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class BankRowRead(BaseModel):
    id: int
    date: date
    description: str
    amount: Decimal
    matched_ledger_id: int | None
    imported_at: datetime

    model_config = {"from_attributes": True}


class GlEntryRead(BaseModel):
    id: int
    date: date
    trx_no: str
    account: str
    particular: str
    dr_amount: Decimal
    cr_amount: Decimal

    model_config = {"from_attributes": True}


class MatchedPairRead(BaseModel):
    bank_id: int
    bank_date: date
    bank_description: str
    bank_amount: Decimal
    gl_id: int
    gl_date: date
    gl_trx_no: str
    gl_account: str
    gl_particular: str
    gl_dr_amount: Decimal
    gl_cr_amount: Decimal


class MatchIn(BaseModel):
    bank_row_id: int
    ledger_entry_id: int


class ImportResult(BaseModel):
    imported: int


class ReconcSummary(BaseModel):
    total: int
    matched: int
    unmatched: int
