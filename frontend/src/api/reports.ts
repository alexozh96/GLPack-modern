import { api } from './auth'

// ── Types ────────────────────────────────────────────────────────────────────

export interface AccountLine {
  code: string; name: string; total_dr: string; total_cr: string; net: string
}
export interface TrialBalanceReport {
  period_start: string; period_end: string
  accounts: AccountLine[]; total_dr: string; total_cr: string
}

export interface PnLLine {
  code: string; name: string; amount: string; pct_of_revenue?: string
}
export interface ProfitLossReport {
  period_start: string; period_end: string
  revenue_lines: PnLLine[]; total_revenue: string
  cost_of_sales_lines: PnLLine[]; total_cost_of_sales: string
  gross_profit: string; other_income: string; total_gross_revenue: string
  expense_lines: PnLLine[]; total_expenses: string
  profit_before_tax: string; taxation: string; profit_after_tax: string
  pl_brought_forward: string; pl_carried_forward: string
}

export interface BalanceSheetLine { code: string; name: string; amount: string }
export interface BalanceSheetReport {
  period_end: string
  share_capital: string; profit_loss_account: string; total_equity: string
  current_assets: BalanceSheetLine[]; total_current_assets: string
  current_liabilities: BalanceSheetLine[]; total_current_liabilities: string
  net_current_assets: string
  fixed_assets: BalanceSheetLine[]; total_fixed_assets: string
  total_net_assets: string
}

export interface ExpenseLine {
  code: string; name: string; amount: string; pct_of_sales?: string
}
export interface ExpenseScheduleReport {
  period_start: string; period_end: string
  items: ExpenseLine[]; total: string; total_sales: string; total_pct?: string
}

export interface SimpleAccountLine { code: string; name: string; amount: string }
export interface DebtorsListingReport { period_end: string; items: SimpleAccountLine[]; total: string }
export interface CreditorsListingReport { period_end: string; items: SimpleAccountLine[]; total: string }

export interface FixedAssetLine {
  code: string; name: string; cost: string; accum_depn: string; nbv: string
}
export interface FixedAssetsReport {
  period_end: string
  items: FixedAssetLine[]; total_cost: string; total_accum_depn: string; total_nbv: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function blobDownload(url: string, params: Record<string, string>, filename: string) {
  const res = await api.get(url, { params, responseType: 'blob' })
  const href = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(href)
}

function periodParams(ps: string, pe: string) {
  return { period_start: ps, period_end: pe }
}

// ── JSON fetchers ─────────────────────────────────────────────────────────────

export async function getTrialBalance(ps: string, pe: string): Promise<TrialBalanceReport> {
  const res = await api.get<TrialBalanceReport>('/reports/trial-balance', { params: periodParams(ps, pe) })
  return res.data
}
export async function getProfitLoss(ps: string, pe: string): Promise<ProfitLossReport> {
  const res = await api.get<ProfitLossReport>('/reports/profit-loss', { params: periodParams(ps, pe) })
  return res.data
}
export async function getBalanceSheet(ps: string, pe: string): Promise<BalanceSheetReport> {
  const res = await api.get<BalanceSheetReport>('/reports/balance-sheet', { params: periodParams(ps, pe) })
  return res.data
}
export async function getExpenseSchedule(ps: string, pe: string): Promise<ExpenseScheduleReport> {
  const res = await api.get<ExpenseScheduleReport>('/reports/expense-schedule', { params: periodParams(ps, pe) })
  return res.data
}
export async function getDebtorsListing(ps: string, pe: string): Promise<DebtorsListingReport> {
  const res = await api.get<DebtorsListingReport>('/reports/debtors-listing', { params: periodParams(ps, pe) })
  return res.data
}
export async function getCreditorsListing(ps: string, pe: string): Promise<CreditorsListingReport> {
  const res = await api.get<CreditorsListingReport>('/reports/creditors-listing', { params: periodParams(ps, pe) })
  return res.data
}
export async function getFixedAssets(ps: string, pe: string): Promise<FixedAssetsReport> {
  const res = await api.get<FixedAssetsReport>('/reports/fixed-assets', { params: periodParams(ps, pe) })
  return res.data
}

// ── PDF downloads ─────────────────────────────────────────────────────────────

export type ReportKey =
  | 'trial-balance' | 'profit-loss' | 'balance-sheet'
  | 'expense-schedule' | 'debtors-listing' | 'creditors-listing' | 'fixed-assets'

export async function downloadReportPdf(key: ReportKey, ps: string, pe: string): Promise<void> {
  const filename = key.replace(/-/g, '_') + '.pdf'
  await blobDownload(`/reports/${key}`, { ...periodParams(ps, pe), format: 'pdf' }, filename)
}

export async function downloadFullStatementsPdf(ps: string, pe: string): Promise<void> {
  await blobDownload(
    '/reports/full-financial-statements',
    { ...periodParams(ps, pe), format: 'pdf' },
    'financial_statements.pdf',
  )
}

// ── Ledger PDF (from Phase 10) ────────────────────────────────────────────────

export async function downloadLedgerPdf(code: string, periodStart: string, periodEnd: string): Promise<void> {
  await blobDownload(
    `/reports/ledger-account/${code}`,
    { period_start: periodStart, period_end: periodEnd, format: 'pdf' },
    `ledger_${code.toUpperCase()}.pdf`,
  )
}
