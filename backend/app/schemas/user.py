from pydantic import BaseModel, field_validator


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    id: int
    username: str
    access_level: int
    is_system_admin: bool
    is_active: bool

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
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
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v

    @field_validator("access_level")
    @classmethod
    def level_valid(cls, v: int) -> int:
        if v not in (1, 3, 6):
            raise ValueError("access_level must be 1, 3, or 6")
        return v


class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    access_level: int | None = None
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
        if v is not None and len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v

    @field_validator("access_level")
    @classmethod
    def level_valid(cls, v: int | None) -> int | None:
        if v is not None and v not in (1, 3, 6):
            raise ValueError("access_level must be 1, 3, or 6")
        return v
