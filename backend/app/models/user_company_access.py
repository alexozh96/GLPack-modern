from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class UserCompanyAccess(Base):
    __tablename__ = "user_company_access"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    access_level: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
