import { useState } from 'react'
import {
  getTrialBalance, getProfitLoss, getBalanceSheet,
  getExpenseSchedule, getDebtorsListing, getCreditorsListing, getFixedAssets,
  downloadReportPdf, downloadFullStatementsPdf,
} from '../api/reports'
import type {
  TrialBalanceReport, ProfitLossReport, BalanceSheetReport,
  ExpenseScheduleReport, DebtorsListingReport, CreditorsListingReport, FixedAssetsReport,
  ReportKey,
} from '../api/reports'
import { PageHeader, cls } from '../components/ui'

// ── helpers ───────────────────────────────────────────────────────────────────

function d(v: string | number | null | undefined): string {
  if (v == null) return '—'
  const n = parseFloat(String(v))
  return isNaN(n) ? '—' : n.toFixed(2)
}

function pct(v: string | number | null | undefined): string {
  if (v == null) return ''
  const n = parseFloat(String(v))
  return isNaN(n) ? '' : `${n.toFixed(1)}%`
}

function apiError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { detail?: string } } }).response
    if (typeof r?.data?.detail === 'string') return r.data.detail
  }
  return 'Failed to load report.'
}

// ── table building blocks ─────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={right ? cls.thRight : cls.th}>
      {children}
    </th>
  )
}

function SectionHead({ label, cols }: { label: string; cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 pt-4 pb-1 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white">
        {label}
      </td>
    </tr>
  )
}

function DataRow({ code, name, amount, extra }: { code: string; name: string; amount: string; extra?: string }) {
  return (
    <tr className="hover:bg-[#0875e1]/[0.03] transition-colors">
      <td className="px-5 py-2 font-mono text-xs text-slate-400 w-16">{code}</td>
      <td className="px-5 py-2 text-slate-700">{name}</td>
      <td className="px-5 py-2 text-right font-mono text-slate-800">{d(amount)}</td>
      {extra !== undefined && <td className="px-5 py-2 text-right text-slate-400 text-xs">{extra}</td>}
    </tr>
  )
}

function TotalRow({ label, amount, bold, extra, cols = 4 }: {
  label: string; amount: string; bold?: boolean; extra?: string; cols?: number
}) {
  return (
    <tr className={bold ? 'border-t-2 border-slate-300 bg-slate-50' : 'border-t border-slate-200'}>
      <td />
      <td className={`px-5 py-2 ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{label}</td>
      <td className={`px-5 py-2 text-right font-mono ${bold ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>
        {d(amount)}
      </td>
      {cols > 3 && <td className="px-5 py-2 text-right text-slate-400 text-xs">{extra ?? ''}</td>}
    </tr>
  )
}

function SummaryRow({ label, amount }: { label: string; amount: string }) {
  return (
    <tr className="border-t border-slate-200">
      <td colSpan={2} className="px-5 py-2 font-medium text-slate-700 pl-8">{label}</td>
      <td className="px-5 py-2 text-right font-mono font-semibold text-slate-900">{d(amount)}</td>
      <td />
    </tr>
  )
}

// ── report renderers ──────────────────────────────────────────────────────────

function TrialBalanceView({ data }: { data: TrialBalanceReport }) {
  return (
    <table className="w-full text-sm">
      <thead><tr><Th>Code</Th><Th>Account Name</Th><Th right>Debit</Th><Th right>Credit</Th><Th right>Net</Th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {data.accounts.map(a => (
          <tr key={a.code} className="hover:bg-[#0875e1]/[0.03] transition-colors">
            <td className="px-5 py-2 font-mono text-xs text-slate-400">{a.code}</td>
            <td className="px-5 py-2 text-slate-700">{a.name}</td>
            <td className="px-5 py-2 text-right font-mono text-slate-800">{d(a.total_dr)}</td>
            <td className="px-5 py-2 text-right font-mono text-slate-800">{d(a.total_cr)}</td>
            <td className="px-5 py-2 text-right font-mono text-slate-800">{d(a.net)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-slate-300 bg-slate-50">
        <tr>
          <td /><td className="px-5 py-2 font-bold text-slate-800">Totals</td>
          <td className="px-5 py-2 text-right font-mono font-bold text-slate-900">{d(data.total_dr)}</td>
          <td className="px-5 py-2 text-right font-mono font-bold text-slate-900">{d(data.total_cr)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  )
}

function ProfitLossView({ data }: { data: ProfitLossReport }) {
  return (
    <table className="w-full text-sm">
      <thead><tr><Th>Code</Th><Th>Description</Th><Th right>Amount</Th><Th right>%</Th></tr></thead>
      <tbody>
        <SectionHead label="Revenue" cols={4} />
        {data.revenue_lines.map(l => <DataRow key={l.code} code={l.code} name={l.name} amount={l.amount} extra={pct(l.pct_of_revenue)} />)}
        <TotalRow label="Total Revenue" amount={data.total_revenue} />

        <SectionHead label="Cost of Sales" cols={4} />
        {data.cost_of_sales_lines.map(l => <DataRow key={l.code} code={l.code} name={l.name} amount={l.amount} />)}
        <TotalRow label="Total Cost of Sales" amount={data.total_cost_of_sales} />

        <SummaryRow label="Gross Profit" amount={data.gross_profit} />
        <SummaryRow label="Other Income" amount={data.other_income} />
        <SummaryRow label="Total Gross Revenue" amount={data.total_gross_revenue} />

        <SectionHead label="Expenses" cols={4} />
        {data.expense_lines.map(l => <DataRow key={l.code} code={l.code} name={l.name} amount={l.amount} />)}
        <TotalRow label="Total Expenses" amount={data.total_expenses} />

        <SummaryRow label="Profit Before Tax" amount={data.profit_before_tax} />
        <SummaryRow label="Taxation" amount={data.taxation} />
        <tr className="border-t-2 border-slate-300 bg-slate-50">
          <td colSpan={2} className="px-5 py-2 font-bold text-slate-800 pl-8">Profit After Tax</td>
          <td className="px-5 py-2 text-right font-mono font-bold text-slate-900">{d(data.profit_after_tax)}</td>
          <td />
        </tr>
        <SummaryRow label="P&L Brought Forward" amount={data.pl_brought_forward} />
        <tr className="border-t border-slate-200 bg-slate-100">
          <td colSpan={2} className="px-5 py-2 font-bold text-slate-800 pl-8">P&L Carried Forward</td>
          <td className="px-5 py-2 text-right font-mono font-bold text-slate-900">{d(data.pl_carried_forward)}</td>
          <td />
        </tr>
      </tbody>
    </table>
  )
}

function BalanceSheetView({ data }: { data: BalanceSheetReport }) {
  return (
    <table className="w-full text-sm">
      <thead><tr><Th>Code</Th><Th>Description</Th><Th right>Amount</Th></tr></thead>
      <tbody>
        <SectionHead label="Equity" cols={3} />
        <tr className="hover:bg-[#0875e1]/[0.03] transition-colors">
          <td className="px-5 py-2 font-mono text-xs text-slate-400" />
          <td className="px-5 py-2 text-slate-700">Share Capital</td>
          <td className="px-5 py-2 text-right font-mono text-slate-800">{d(data.share_capital)}</td>
        </tr>
        <tr className="hover:bg-[#0875e1]/[0.03] transition-colors">
          <td className="px-5 py-2 font-mono text-xs text-slate-400" />
          <td className="px-5 py-2 text-slate-700">Profit & Loss Account</td>
          <td className="px-5 py-2 text-right font-mono text-slate-800">{d(data.profit_loss_account)}</td>
        </tr>
        <TotalRow label="Total Equity" amount={data.total_equity} bold cols={3} />

        <SectionHead label="Current Assets" cols={3} />
        {data.current_assets.map(a => (
          <tr key={a.code} className="hover:bg-[#0875e1]/[0.03] transition-colors">
            <td className="px-5 py-2 font-mono text-xs text-slate-400">{a.code}</td>
            <td className="px-5 py-2 text-slate-700">{a.name}</td>
            <td className="px-5 py-2 text-right font-mono text-slate-800">{d(a.amount)}</td>
          </tr>
        ))}
        <TotalRow label="Total Current Assets" amount={data.total_current_assets} cols={3} />

        <SectionHead label="Current Liabilities" cols={3} />
        {data.current_liabilities.map(a => (
          <tr key={a.code} className="hover:bg-[#0875e1]/[0.03] transition-colors">
            <td className="px-5 py-2 font-mono text-xs text-slate-400">{a.code}</td>
            <td className="px-5 py-2 text-slate-700">{a.name}</td>
            <td className="px-5 py-2 text-right font-mono text-slate-800">{d(a.amount)}</td>
          </tr>
        ))}
        <TotalRow label="Total Current Liabilities" amount={data.total_current_liabilities} cols={3} />
        <tr className="border-t border-slate-200">
          <td /><td className="px-5 py-2 font-medium text-slate-700 pl-8">Net Current Assets</td>
          <td className="px-5 py-2 text-right font-mono font-semibold text-slate-900">{d(data.net_current_assets)}</td>
        </tr>

        <SectionHead label="Fixed Assets" cols={3} />
        {data.fixed_assets.map(a => (
          <tr key={a.code} className="hover:bg-[#0875e1]/[0.03] transition-colors">
            <td className="px-5 py-2 font-mono text-xs text-slate-400">{a.code}</td>
            <td className="px-5 py-2 text-slate-700">{a.name}</td>
            <td className="px-5 py-2 text-right font-mono text-slate-800">{d(a.amount)}</td>
          </tr>
        ))}
        <TotalRow label="Total Fixed Assets" amount={data.total_fixed_assets} cols={3} />
        <TotalRow label="Total Net Assets" amount={data.total_net_assets} bold cols={3} />
      </tbody>
    </table>
  )
}

function ExpenseScheduleView({ data }: { data: ExpenseScheduleReport }) {
  return (
    <table className="w-full text-sm">
      <thead><tr><Th>Code</Th><Th>Expense</Th><Th right>Amount</Th><Th right>% of Sales</Th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {data.items.map(i => <DataRow key={i.code} code={i.code} name={i.name} amount={i.amount} extra={pct(i.pct_of_sales)} />)}
      </tbody>
      <tfoot className="border-t-2 border-slate-300 bg-slate-50">
        <tr>
          <td /><td className="px-5 py-2 font-bold text-slate-800">Total Expenses</td>
          <td className="px-5 py-2 text-right font-mono font-bold text-slate-900">{d(data.total)}</td>
          <td className="px-5 py-2 text-right text-slate-500 text-xs">{pct(data.total_pct)}</td>
        </tr>
        <tr>
          <td /><td className="px-5 py-1.5 text-slate-500 text-xs">Total Sales</td>
          <td className="px-5 py-1.5 text-right font-mono text-slate-600 text-xs">{d(data.total_sales)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  )
}

function SimpleListingView({ items, total, label }: {
  items: Array<{ code: string; name: string; amount: string }>
  total: string
  label: string
}) {
  return (
    <table className="w-full text-sm">
      <thead><tr><Th>Code</Th><Th>Name</Th><Th right>Amount</Th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {items.map(i => (
          <tr key={i.code} className="hover:bg-[#0875e1]/[0.03] transition-colors">
            <td className="px-5 py-2 font-mono text-xs text-slate-400">{i.code}</td>
            <td className="px-5 py-2 text-slate-700">{i.name}</td>
            <td className="px-5 py-2 text-right font-mono text-slate-800">{d(i.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-slate-300 bg-slate-50">
        <tr>
          <td /><td className="px-5 py-2 font-bold text-slate-800">{label}</td>
          <td className="px-5 py-2 text-right font-mono font-bold text-slate-900">{d(total)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function FixedAssetsView({ data }: { data: FixedAssetsReport }) {
  return (
    <table className="w-full text-sm">
      <thead><tr><Th>Code</Th><Th>Asset</Th><Th right>Cost</Th><Th right>Accum. Depn</Th><Th right>NBV</Th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {data.items.map(i => (
          <tr key={i.code} className="hover:bg-[#0875e1]/[0.03] transition-colors">
            <td className="px-5 py-2 font-mono text-xs text-slate-400">{i.code}</td>
            <td className="px-5 py-2 text-slate-700">{i.name}</td>
            <td className="px-5 py-2 text-right font-mono text-slate-800">{d(i.cost)}</td>
            <td className="px-5 py-2 text-right font-mono text-slate-800">{d(i.accum_depn)}</td>
            <td className="px-5 py-2 text-right font-mono text-slate-800">{d(i.nbv)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-slate-300 bg-slate-50">
        <tr>
          <td /><td className="px-5 py-2 font-bold text-slate-800">Totals</td>
          <td className="px-5 py-2 text-right font-mono font-bold text-slate-900">{d(data.total_cost)}</td>
          <td className="px-5 py-2 text-right font-mono font-bold text-slate-900">{d(data.total_accum_depn)}</td>
          <td className="px-5 py-2 text-right font-mono font-bold text-slate-900">{d(data.total_nbv)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

// ── tab config ────────────────────────────────────────────────────────────────

const TABS: Array<{ key: ReportKey; label: string }> = [
  { key: 'trial-balance',      label: 'Trial Balance' },
  { key: 'profit-loss',        label: 'Profit & Loss' },
  { key: 'balance-sheet',      label: 'Balance Sheet' },
  { key: 'expense-schedule',   label: 'Expense Schedule' },
  { key: 'debtors-listing',    label: 'Debtors Listing' },
  { key: 'creditors-listing',  label: 'Creditors Listing' },
  { key: 'fixed-assets',       label: 'Fixed Assets' },
]

type ActiveReport =
  | { tab: 'trial-balance';     data: TrialBalanceReport }
  | { tab: 'profit-loss';       data: ProfitLossReport }
  | { tab: 'balance-sheet';     data: BalanceSheetReport }
  | { tab: 'expense-schedule';  data: ExpenseScheduleReport }
  | { tab: 'debtors-listing';   data: DebtorsListingReport }
  | { tab: 'creditors-listing'; data: CreditorsListingReport }
  | { tab: 'fixed-assets';      data: FixedAssetsReport }

// ── main page ─────────────────────────────────────────────────────────────────

export function Reports() {
  const [activeTab, setActiveTab] = useState<ReportKey>('trial-balance')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const [report, setReport] = useState<ActiveReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [allPdfBusy, setAllPdfBusy] = useState(false)

  const canGenerate = !!periodStart && !!periodEnd

  function switchTab(key: ReportKey) {
    setActiveTab(key)
    setReport(null)
    setError(null)
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      switch (activeTab) {
        case 'trial-balance':     setReport({ tab: activeTab, data: await getTrialBalance(periodStart, periodEnd) }); break
        case 'profit-loss':       setReport({ tab: activeTab, data: await getProfitLoss(periodStart, periodEnd) }); break
        case 'balance-sheet':     setReport({ tab: activeTab, data: await getBalanceSheet(periodStart, periodEnd) }); break
        case 'expense-schedule':  setReport({ tab: activeTab, data: await getExpenseSchedule(periodStart, periodEnd) }); break
        case 'debtors-listing':   setReport({ tab: activeTab, data: await getDebtorsListing(periodStart, periodEnd) }); break
        case 'creditors-listing': setReport({ tab: activeTab, data: await getCreditorsListing(periodStart, periodEnd) }); break
        case 'fixed-assets':      setReport({ tab: activeTab, data: await getFixedAssets(periodStart, periodEnd) }); break
      }
    } catch (err) {
      setError(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handlePdf() {
    setPdfBusy(true)
    setError(null)
    try {
      await downloadReportPdf(activeTab, periodStart, periodEnd)
    } catch {
      setError('PDF export failed.')
    } finally {
      setPdfBusy(false)
    }
  }

  async function handleAllPdf() {
    setAllPdfBusy(true)
    setError(null)
    try {
      await downloadFullStatementsPdf(periodStart, periodEnd)
    } catch {
      setError('Full statements PDF export failed.')
    } finally {
      setAllPdfBusy(false)
    }
  }

  function renderReport() {
    if (!report) return null
    switch (report.tab) {
      case 'trial-balance':     return <TrialBalanceView data={report.data} />
      case 'profit-loss':       return <ProfitLossView data={report.data} />
      case 'balance-sheet':     return <BalanceSheetView data={report.data} />
      case 'expense-schedule':  return <ExpenseScheduleView data={report.data} />
      case 'debtors-listing':   return <SimpleListingView items={report.data.items} total={report.data.total} label="Total Debtors" />
      case 'creditors-listing': return <SimpleListingView items={report.data.items} total={report.data.total} label="Total Creditors" />
      case 'fixed-assets':      return <FixedAssetsView data={report.data} />
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Reports">
        {canGenerate && (
          <button onClick={handleAllPdf} disabled={allPdfBusy} className={cls.btnSecondary}>
            {allPdfBusy ? 'Exporting…' : 'Download All (PDF)'}
          </button>
        )}
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#0875e1] text-[#0875e1] font-medium'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Period + controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 items-center flex-wrap">
        <input
          type="date"
          value={periodStart}
          onChange={e => setPeriodStart(e.target.value)}
          className={cls.input}
        />
        <span className="text-slate-400 text-sm">to</span>
        <input
          type="date"
          value={periodEnd}
          onChange={e => setPeriodEnd(e.target.value)}
          className={cls.input}
        />
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
          className={cls.btnPrimary}
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
        {report && (
          <button onClick={handlePdf} disabled={pdfBusy} className={cls.btnSecondary}>
            {pdfBusy ? 'Exporting…' : 'Export PDF'}
          </button>
        )}
      </div>

      {error && <div className={cls.alertError}>{error}</div>}

      {/* Report output */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading && (
          <div className="p-6 text-center text-slate-400 text-sm">Generating report…</div>
        )}
        {!loading && !report && !error && (
          <div className="p-6 text-center text-slate-400 text-sm">
            Select a period and click Generate to view the report.
          </div>
        )}
        {!loading && report && renderReport()}
      </div>
    </div>
  )
}
