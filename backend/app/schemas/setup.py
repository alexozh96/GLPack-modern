from pydantic import BaseModel


class SetupRead(BaseModel):
    company_name: str | None = None
    currency: str | None = None
    financial_year_end: str | None = None
    current_period: str | None = None
    locked_before: str | None = None


class SetupUpdate(BaseModel):
    company_name: str | None = None
    currency: str | None = None
    financial_year_end: str | None = None
    current_period: str | None = None
    locked_before: str | None = None
