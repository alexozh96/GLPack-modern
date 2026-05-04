from datetime import date
from pydantic import BaseModel


class AccountResult(BaseModel):
    code: str
    name: str


class PhraseResult(BaseModel):
    id: int
    phrase: str
    dr_code: str | None
    cr_code: str | None


class JournalResult(BaseModel):
    trx_no: str
    date: date
    description: str


class SearchResult(BaseModel):
    accounts: list[AccountResult]
    phrases: list[PhraseResult]
    journal_entries: list[JournalResult]
