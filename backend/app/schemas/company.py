from datetime import datetime
from pydantic import BaseModel, field_validator

VALID_COMPANY_ACCESS_LEVELS = (1, 3, 4, 6)


class CompanyCreate(BaseModel):
    name: str
    currency: str = "SGD"
    financial_year_end: str = "12-31"

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be blank")
        return v


class CompanyRead(BaseModel):
    id: int
    name: str
    currency: str
    financial_year_end: str
    current_period: str | None
    locked_before: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyUpdate(BaseModel):
    name: str | None = None
    currency: str | None = None
    financial_year_end: str | None = None
    current_period: str | None = None
    locked_before: str | None = None
    is_active: bool | None = None


class UserCompanyAccessRead(BaseModel):
    user_id: int
    username: str
    access_level: int

    model_config = {"from_attributes": True}


class AssignUserBody(BaseModel):
    username: str
    access_level: int = 1

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("username cannot be blank")
        return v

    @field_validator("access_level")
    @classmethod
    def level_valid(cls, v: int) -> int:
        if v not in VALID_COMPANY_ACCESS_LEVELS:
            raise ValueError(f"access_level must be one of: {VALID_COMPANY_ACCESS_LEVELS}")
        return v


class UpdateAccessBody(BaseModel):
    access_level: int

    @field_validator("access_level")
    @classmethod
    def level_valid(cls, v: int) -> int:
        if v not in VALID_COMPANY_ACCESS_LEVELS:
            raise ValueError(f"access_level must be one of: {VALID_COMPANY_ACCESS_LEVELS}")
        return v
