from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth import CompanyUser
from app.database import get_db
from app.models.company import Company
from app.schemas.reports import (
    BalanceSheetReport,
    CreditorsListingReport,
    DebtorsListingReport,
    ExpenseScheduleReport,
    FixedAssetsReport,
    LedgerAccountReport,
    ProfitLossReport,
    TrialBalanceReport,
)
from app.services import reports as svc
from app.services import pdf_export as pdf_svc

router = APIRouter(prefix="/reports", tags=["reports"])

_PDF_MIME = "application/pdf"


def _validate_period(period_start: date, period_end: date) -> None:
    if period_start > period_end:
        raise HTTPException(status_code=422, detail="period_start must be on or before period_end")


def _company_name(db: Session, company_id: int) -> str:
    company = db.get(Company, company_id)
    return company.name if company else "GLPACK"


def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    return Response(
        content=pdf_bytes,
        media_type=_PDF_MIME,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/trial-balance")
def trial_balance(
    ctx: CompanyUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
    format: str = Query("json"),
    db: Session = Depends(get_db),
):
    _, company_id, _ = ctx
    _validate_period(period_start, period_end)
    data = svc.get_trial_balance(db, company_id, period_start, period_end)
    if format == "pdf":
        pdf = pdf_svc.build_single_pdf("trial-balance", data, _company_name(db, company_id))
        return _pdf_response(pdf, "trial_balance.pdf")
    return TrialBalanceReport(**data)


@router.get("/profit-loss")
def profit_loss(
    ctx: CompanyUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
    format: str = Query("json"),
    db: Session = Depends(get_db),
):
    _, company_id, _ = ctx
    _validate_period(period_start, period_end)
    data = svc.get_profit_loss(db, company_id, period_start, period_end)
    if format == "pdf":
        pdf = pdf_svc.build_single_pdf("profit-loss", data, _company_name(db, company_id))
        return _pdf_response(pdf, "profit_loss.pdf")
    return ProfitLossReport(**data)


@router.get("/balance-sheet")
def balance_sheet(
    ctx: CompanyUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
    format: str = Query("json"),
    db: Session = Depends(get_db),
):
    _, company_id, _ = ctx
    _validate_period(period_start, period_end)
    data = svc.get_balance_sheet(db, company_id, period_start, period_end)
    if format == "pdf":
        pdf = pdf_svc.build_single_pdf("balance-sheet", data, _company_name(db, company_id))
        return _pdf_response(pdf, "balance_sheet.pdf")
    return BalanceSheetReport(**data)


@router.get("/ledger-account/{code}")
def ledger_account(
    code: str,
    ctx: CompanyUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
    format: str = Query("json"),
    db: Session = Depends(get_db),
):
    _, company_id, _ = ctx
    _validate_period(period_start, period_end)
    data = svc.get_ledger_account(db, company_id, code, period_start, period_end)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Account '{code.upper()}' not found")
    if format == "pdf":
        pdf = pdf_svc.lines_to_pdf(
            [pdf_svc.render_ledger_account(data, _company_name(db, company_id))]
        )
        return _pdf_response(pdf, f"ledger_{code.upper()}.pdf")
    return LedgerAccountReport(**data)


@router.get("/expense-schedule")
def expense_schedule(
    ctx: CompanyUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
    format: str = Query("json"),
    db: Session = Depends(get_db),
):
    _, company_id, _ = ctx
    _validate_period(period_start, period_end)
    data = svc.get_expense_schedule(db, company_id, period_start, period_end)
    if format == "pdf":
        pdf = pdf_svc.build_single_pdf("expense-schedule", data, _company_name(db, company_id))
        return _pdf_response(pdf, "expense_schedule.pdf")
    return ExpenseScheduleReport(**data)


@router.get("/debtors-listing")
def debtors_listing(
    ctx: CompanyUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
    format: str = Query("json"),
    db: Session = Depends(get_db),
):
    _, company_id, _ = ctx
    _validate_period(period_start, period_end)
    data = svc.get_debtors_listing(db, company_id, period_start, period_end)
    if format == "pdf":
        pdf = pdf_svc.build_single_pdf("debtors-listing", data, _company_name(db, company_id))
        return _pdf_response(pdf, "debtors_listing.pdf")
    return DebtorsListingReport(**data)


@router.get("/creditors-listing")
def creditors_listing(
    ctx: CompanyUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
    format: str = Query("json"),
    db: Session = Depends(get_db),
):
    _, company_id, _ = ctx
    _validate_period(period_start, period_end)
    data = svc.get_creditors_listing(db, company_id, period_start, period_end)
    if format == "pdf":
        pdf = pdf_svc.build_single_pdf("creditors-listing", data, _company_name(db, company_id))
        return _pdf_response(pdf, "creditors_listing.pdf")
    return CreditorsListingReport(**data)


@router.get("/fixed-assets")
def fixed_assets(
    ctx: CompanyUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
    format: str = Query("json"),
    db: Session = Depends(get_db),
):
    _, company_id, _ = ctx
    _validate_period(period_start, period_end)
    data = svc.get_fixed_assets(db, company_id, period_start, period_end)
    if format == "pdf":
        pdf = pdf_svc.build_single_pdf("fixed-assets", data, _company_name(db, company_id))
        return _pdf_response(pdf, "fixed_assets.pdf")
    return FixedAssetsReport(**data)


@router.get("/full-financial-statements")
def full_financial_statements(
    ctx: CompanyUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
    format: str = Query("pdf"),
    db: Session = Depends(get_db),
):
    """Bundle all financial statement reports into one PDF."""
    _, company_id, _ = ctx
    _validate_period(period_start, period_end)
    company = _company_name(db, company_id)

    expense = svc.get_expense_schedule(db, company_id, period_start, period_end)
    pl = svc.get_profit_loss(db, company_id, period_start, period_end)
    bs = svc.get_balance_sheet(db, company_id, period_start, period_end)
    debtors = svc.get_debtors_listing(db, company_id, period_start, period_end)
    creditors = svc.get_creditors_listing(db, company_id, period_start, period_end)
    fa = svc.get_fixed_assets(db, company_id, period_start, period_end)

    if format == "json":
        return {
            "expense_schedule": expense,
            "profit_loss": pl,
            "balance_sheet": bs,
            "debtors_listing": debtors,
            "creditors_listing": creditors,
            "fixed_assets": fa,
        }

    pdf = pdf_svc.build_full_statements_pdf(expense, pl, bs, debtors, creditors, fa, company)
    return _pdf_response(pdf, "financial_statements.pdf")
