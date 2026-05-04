import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProfitLoss } from '../api/reports'
import { listJournals } from '../api/journal'
import type { JournalSummary } from '../api/journal'

// ── helpers ───────────────────────────────────────────────────────────────────

function thisYear() {
  const y = new Date().getFullYear()
  return { start: `${y}-01-01`, end: new Date().toISOString().slice(0, 10) }
}

function fmtAmt(v: string | number | null | undefined): string {
  const n = parseFloat(String(v ?? 0))
  return isNaN(n) ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString(undefined, { month: 'short' })
}

// ── sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800 font-mono">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function QuickAction({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const canWrite = (user?.access_level ?? 0) >= 3

  const [kpis, setKpis] = useState<{
    revenue: string; grossPct: string; netProfit: string; entries: number
  } | null>(null)
  const [recentEntries, setRecentEntries] = useState<JournalSummary[]>([])
  const [monthlyData, setMonthlyData] = useState<{ month: string; total: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [partial, setPartial] = useState(false)

  useEffect(() => {
    const { start, end } = thisYear()

    Promise.allSettled([
      getProfitLoss(start, end),
      listJournals({ from_date: start }),
    ]).then(([plRes, jRes]) => {
      let anyFailed = false

      if (plRes.status === 'fulfilled') {
        const pl = plRes.value
        const rev = parseFloat(pl.total_revenue) || 0
        const gp = parseFloat(pl.gross_profit) || 0
        const net = parseFloat(pl.profit_after_tax) || 0
        setKpis({
          revenue: fmtAmt(rev),
          grossPct: rev > 0 ? `${((gp / rev) * 100).toFixed(1)}%` : '—',
          netProfit: fmtAmt(net),
          entries: 0,
        })
      } else {
        anyFailed = true
      }

      if (jRes.status === 'fulfilled') {
        const entries = jRes.value
        // Recent entries: sort desc by date then trx_no, take top 8
        const sorted = [...entries].sort(
          (a, b) => b.date.localeCompare(a.date) || b.trx_no.localeCompare(a.trx_no),
        )
        setRecentEntries(sorted.slice(0, 8))

        // Monthly totals (group by YYYY-MM, last 12 months)
        const monthMap = new Map<string, number>()
        entries.forEach(e => {
          const key = e.date.slice(0, 7)
          monthMap.set(key, (monthMap.get(key) ?? 0) + (parseFloat(e.total_dr) || 0))
        })
        const months = [...monthMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-12)
        setMonthlyData(months.map(([m, total]) => ({ month: m, total })))

        // Patch entry count into KPIs if P&L succeeded
        setKpis(prev => prev ? { ...prev, entries: entries.length } : null)
      } else {
        anyFailed = true
      }

      setPartial(anyFailed)
    }).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const maxMonthly = Math.max(...monthlyData.map(m => m.total), 1)
  const { start: yearStart } = thisYear()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">Dashboard</h2>
        <span className="text-xs text-slate-400">YTD — {yearStart} to today</span>
      </div>

      {partial && (
        <div className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg">
          Some data could not be loaded. Is the backend running?
        </div>
      )}

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 h-24 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Total Revenue" value={kpis?.revenue ?? '—'} sub="Year to date" />
          <KpiCard label="Gross Profit %" value={kpis?.grossPct ?? '—'} sub="Of revenue" />
          <KpiCard label="Net Profit" value={kpis?.netProfit ?? '—'} sub="After tax" />
          <KpiCard label="Journal Entries" value={kpis ? String(kpis.entries) : '—'} sub="This year" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Monthly activity chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Transaction Volume</h3>
          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-28 text-slate-400 text-sm">
              No data available
            </div>
          ) : (
            <>
              <div className="flex items-end gap-1 h-28">
                {monthlyData.map(({ month, total }) => {
                  const pct = (total / maxMonthly) * 100
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center justify-end">
                      <div
                        title={`${month}: ${fmtAmt(total)}`}
                        className="w-full bg-slate-600 rounded-t-sm hover:bg-slate-500 transition-colors cursor-default"
                        style={{ height: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-1 mt-1.5">
                {monthlyData.map(({ month }) => (
                  <div key={month} className="flex-1 text-center text-xs text-slate-400">
                    {monthLabel(month)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <QuickAction
              label="→ New Journal Entry"
              onClick={() => navigate('/journal')}
              disabled={!canWrite}
            />
            <QuickAction
              label="→ Chart of Accounts"
              onClick={() => navigate('/accounts')}
            />
            <QuickAction
              label="→ Trial Balance"
              onClick={() => navigate('/reports')}
            />
            <QuickAction
              label="→ Financial Statements"
              onClick={() => navigate('/reports')}
            />
          </div>
        </div>
      </div>

      {/* Recent journal entries */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Recent Journal Entries</h3>
          <button
            onClick={() => navigate('/journal')}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            View all →
          </button>
        </div>
        {loading ? (
          <div className="p-6 text-center text-slate-400 text-sm">Loading…</div>
        ) : recentEntries.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No journal entries found for this year.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-20">TRX</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-28">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Description</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600 w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentEntries.map(e => (
                <tr
                  key={e.trx_no}
                  onClick={() => navigate('/journal')}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-mono text-slate-600">{e.trx_no}</td>
                  <td className="px-4 py-2.5 text-slate-500">{e.date}</td>
                  <td className="px-4 py-2.5 text-slate-700 truncate max-w-xs">{e.description}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">{fmtAmt(e.total_dr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
