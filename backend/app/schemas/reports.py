from datetime import date
from decimal import Decimal
from pydantic import BaseModel


class AccountLine(BaseModel):
    code: str
    name: str
    total_dr: Decimal
    total_cr: Decimal
    net: Decimal


class TrialBalanceReport(BaseModel):
    period_start: date
    period_end: date
    accounts: list[AccountLine]
    total_dr: Decimal
    total_cr: Decimal


class PnLLine(BaseModel):
    code: str
    name: str
    amount: Decimal
    pct_of_revenue: Decimal | None = None


class ProfitLossReport(BaseModel):
    period_start: date
    period_end: date
    revenue_lines: list[PnLLine]
    total_revenue: Decimal
    cost_of_sales_lines: list[PnLLine]
    total_cost_of_sales: Decimal
    gross_profit: Decimal
    other_income: Decimal
    total_gross_revenue: Decimal
    expense_lines: list[PnLLine]
    total_expenses: Decimal
    profit_before_tax: Decimal
    taxation: Decimal
    profit_after_tax: Decimal
    pl_brought_forward: Decimal
    pl_carried_forward: Decimal


class BalanceSheetLine(BaseModel):
    code: str
    name: str
    amount: Decimal


class BalanceSheetReport(BaseModel):
    period_end: date
    share_capital: Decimal
    profit_loss_account: Decimal
    total_equity: Decimal
    current_assets: list[BalanceSheetLine]
    total_current_assets: Decimal
    current_liabilities: list[BalanceSheetLine]
    total_current_liabilities: Decimal
    net_current_assets: Decimal
    fixed_assets: list[BalanceSheetLine]
    total_fixed_assets: Decimal
    total_net_assets: Decimal


class LedgerLine(BaseModel):
    id: int
    date: date
    trx_no: str
    particular: str
    dr_amount: Decimal
    cr_amount: Decimal
    balance: Decimal


class LedgerAccountReport(BaseModel):
    code: str
    name: str
    period_start: date
    period_end: date
    opening_balance: Decimal
    lines: list[LedgerLine]
    total_dr: Decimal
    total_cr: Decimal
    closing_balance: Decimal


class ExpenseLine(BaseModel):
    code: str
    name: str
    amount: Decimal
    pct_of_sales: Decimal | None = None


class ExpenseScheduleReport(BaseModel):
    period_start: date
    period_end: date
    items: list[ExpenseLine]
    total: Decimal
    total_sales: Decimal
    total_pct: Decimal | None = None


class SimpleAccountLine(BaseModel):
    code: str
    name: str
    amount: Decimal


class DebtorsListingReport(BaseModel):
    period_end: date
    items: list[SimpleAccountLine]
    total: Decimal


class CreditorsListingReport(BaseModel):
    period_end: date
    items: list[SimpleAccountLine]
    total: Decimal


class FixedAssetLine(BaseModel):
    code: str
    name: str
    cost: Decimal
    accum_depn: Decimal
    nbv: Decimal


class FixedAssetsReport(BaseModel):
    period_end: date
    items: list[FixedAssetLine]
    total_cost: Decimal
    total_accum_depn: Decimal
    total_nbv: Decimal
