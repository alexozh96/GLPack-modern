from pydantic import BaseModel, field_validator


class AccountCreate(BaseModel):
    code: str
    name: str

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("code cannot be empty")
        if len(v) > 4:
            raise ValueError("code must be 4 characters or fewer")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        if len(v) > 30:
            raise ValueError("name must be 30 characters or fewer")
        return v


class AccountUpdate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        if len(v) > 30:
            raise ValueError("name must be 30 characters or fewer")
        return v


class AccountRead(BaseModel):
    code: str
    name: str

    model_config = {"from_attributes": True}
