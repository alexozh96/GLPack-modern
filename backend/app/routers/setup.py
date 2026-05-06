from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import CompanyAdmin, CompanyUser
from app.database import get_db
from app.models.company import Company
from app.schemas.setup import SetupRead, SetupUpdate

router = APIRouter(prefix="/setup", tags=["setup"])


def _to_setup_read(company: Company) -> SetupRead:
    return SetupRead(
        company_name=company.name,
        currency=company.currency,
        financial_year_end=company.financial_year_end,
        current_period=company.current_period,
        locked_before=company.locked_before,
    )


@router.get("", response_model=SetupRead)
def get_setup(ctx: CompanyUser, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    return _to_setup_read(company)


@router.put("", response_model=SetupRead)
def update_setup(body: SetupUpdate, ctx: CompanyAdmin, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    updates = body.model_dump(exclude_none=True)
    if "company_name" in updates:
        company.name = updates["company_name"]
    if "currency" in updates:
        company.currency = updates["currency"]
    if "financial_year_end" in updates:
        company.financial_year_end = updates["financial_year_end"]
    if "current_period" in updates:
        company.current_period = updates["current_period"]
    if "locked_before" in updates:
        company.locked_before = updates["locked_before"]
    db.commit()
    db.refresh(company)
    return _to_setup_read(company)
