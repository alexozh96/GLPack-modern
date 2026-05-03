from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Phrase(Base):
    __tablename__ = "phrases"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    phrase: Mapped[str] = mapped_column(String(45), nullable=False)
    dr_code: Mapped[str | None] = mapped_column(String(4), nullable=True)
    cr_code: Mapped[str | None] = mapped_column(String(4), nullable=True)

    __table_args__ = (
        UniqueConstraint("phrase", "dr_code", "cr_code", name="uq_phrase_codes"),
    )
