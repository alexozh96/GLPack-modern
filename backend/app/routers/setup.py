from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import AdminAccess, get_current_user
from app.database import get_db
from app.models.setup import Setup
from app.schemas.setup import SetupRead, SetupUpdate

router = APIRouter(prefix="/setup", tags=["setup"], dependencies=[Depends(get_current_user)])

_KEYS = ("company_name", "currency", "financial_year_end", "current_period", "locked_before")


def _fetch(db: Session) -> SetupRead:
    rows = db.query(Setup).filter(Setup.key.in_(_KEYS)).all()
    data = {row.key: row.value for row in rows}
    return SetupRead(**{k: data.get(k) for k in _KEYS})


@router.get("", response_model=SetupRead)
def get_setup(db: Session = Depends(get_db)):
    return _fetch(db)


@router.put("", response_model=SetupRead)
def update_setup(body: SetupUpdate, _: AdminAccess, db: Session = Depends(get_db)):
    for key, value in body.model_dump(exclude_none=True).items():
        db.merge(Setup(key=key, value=value))
    db.commit()
    return _fetch(db)
