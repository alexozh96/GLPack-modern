from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import AdminAccess, get_current_user
from app.database import get_db
from app.services.period_close import close_period

router = APIRouter(prefix="/period", tags=["period"], dependencies=[Depends(get_current_user)])


class PeriodCloseIn(BaseModel):
    period_end: date


class PeriodCloseResult(BaseModel):
    period_end: str
    locked_before: str
    closing_lines_written: int
    net_profit: str


@router.post("/close", response_model=PeriodCloseResult)
def close_period_endpoint(body: PeriodCloseIn, _: AdminAccess, db: Session = Depends(get_db)):
    return close_period(db, body.period_end)
