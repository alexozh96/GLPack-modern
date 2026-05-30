import re
from pydantic import BaseModel, field_validator

VALID_PLATFORM_ROLES = ("owner", "staff", "user")
VALID_COMPANY_ACCESS_LEVELS = (1, 3, 4, 6)


def _check_password_complexity(v: str) -> str:
    if len(v) < 8:
        raise ValueError("password must be at least 8 characters")
    if not re.search(r"[A-Za-z]", v):
        raise ValueError("password must contain at least one letter")
    if not re.search(r"\d", v):
        raise ValueError("password must contain at least one digit")
    return v


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class UserRead(BaseModel):
    id: int
    username: str
    platform_role: str
    is_active: bool
    must_change_password: bool

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str
    password: str
    platform_role: str = "user"

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("username cannot be blank")
        if len(v) > 20:
            raise ValueError("username max 20 characters")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        return _check_password_complexity(v)

    @field_validator("platform_role")
    @classmethod
    def role_valid(cls, v: str) -> str:
        if v not in VALID_PLATFORM_ROLES:
            raise ValueError(f"platform_role must be one of: {', '.join(VALID_PLATFORM_ROLES)}")
        return v


class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    platform_role: str | None = None
    is_active: bool | None = None

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("username cannot be blank")
            if len(v) > 20:
                raise ValueError("username max 20 characters")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str | None) -> str | None:
        if v is not None:
            return _check_password_complexity(v)
        return v

    @field_validator("platform_role")
    @classmethod
    def role_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_PLATFORM_ROLES:
            raise ValueError(f"platform_role must be one of: {', '.join(VALID_PLATFORM_ROLES)}")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        return _check_password_complexity(v)


class CreateCompanyUserRequest(BaseModel):
    """Used by company admins to create a new user scoped to their company."""
    username: str
    password: str
    access_level: int = 1

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("username cannot be blank")
        if len(v) > 20:
            raise ValueError("username max 20 characters")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        return _check_password_complexity(v)

    @field_validator("access_level")
    @classmethod
    def level_valid(cls, v: int) -> int:
        if v not in VALID_COMPANY_ACCESS_LEVELS:
            raise ValueError(f"access_level must be one of: {VALID_COMPANY_ACCESS_LEVELS}")
        return v
