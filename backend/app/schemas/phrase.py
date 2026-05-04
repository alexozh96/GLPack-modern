from pydantic import BaseModel, field_validator


class PhraseCreate(BaseModel):
    phrase: str
    dr_code: str | None = None
    cr_code: str | None = None

    @field_validator("phrase")
    @classmethod
    def validate_phrase(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("phrase cannot be empty")
        if len(v) > 45:
            raise ValueError("phrase must be 45 characters or fewer")
        return v

    @field_validator("dr_code", "cr_code", mode="before")
    @classmethod
    def validate_code(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if len(v) > 4:
            raise ValueError("account code must be 4 characters or fewer")
        return v.upper()


class PhraseRead(BaseModel):
    id: int
    phrase: str
    dr_code: str | None
    cr_code: str | None

    model_config = {"from_attributes": True}
