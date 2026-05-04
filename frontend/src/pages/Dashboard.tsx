import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProfitLoss } from '../api/reports'
import { listJournals } from '../api/journal'
import type { JournalSummary } from '../api/journal'

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

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm min-h-[110px] flex flex-col justify-between">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
      <div>
        <p className="text-2xl font-bold text-slate-800 font-mono mt-3">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function QuickAction({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-4 py-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-[#0875e1]/40 hover:bg-[#0875e1]/[0.03] hover:text-[#0875e1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  )
}

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
        const sorted = [...entries].sort(
          (a, b) => b.date.localeCompare(a.date) || b.trx_no.localeCompare(a.trx_no),
        )
        setRecentEntries(sorted.slice(0, 8))
        const monthMap = new Map<string, number>()
        entries.forEach(e => {
          const key = e.date.slice(0, 7)
          monthMap.set(key, (monthMap.get(key) ?? 0) + (parseFloat(e.total_dr) || 0))
        })
        const months = [...monthMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-12)
        setMonthlyData(months.map(([m, total]) => ({ month: m, total })))
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
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">Year to date — {yearStart} to today</p>
        </div>
      </div>

      {partial && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg">
          Some data could not be loaded. Is the backend running?
        </div>
      )}

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 min-h-[110px] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiCard label="Total Revenue"    value={kpis?.revenue ?? '—'}            sub="Year to date" />
          <KpiCard label="Gross Profit %"   value={kpis?.grossPct ?? '—'}           sub="Of revenue"   />
          <KpiCard label="Net Profit"       value={kpis?.netProfit ?? '—'}          sub="After tax"    />
          <KpiCard label="Journal Entries"  value={kpis ? String(kpis.entries) : '—'} sub="This year" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        {/* Monthly activity chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-5">Monthly Transaction Volume</h3>
          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
              No data available
            </div>
          ) : (
            <>
              <div className="flex items-end gap-1 h-40">
                {monthlyData.map(({ month, total }) => {
                  const p = (total / maxMonthly) * 100
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center justify-end">
                      <div
                        title={`${month}: ${fmtAmt(total)}`}
                        className="w-full bg-[#0875e1] rounded-t hover:bg-[#0667c8] transition-colors cursor-default opacity-80 hover:opacity-100"
                        style={{ height: `${Math.max(p, 3)}%` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-1 mt-2">
                {monthlyData.map(({ month }) => (
                  <div key={month} className="flex-1 text-center text-[10px] text-slate-400">
                    {monthLabel(month)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <QuickAction label="New Journal Entry"      onClick={() => navigate('/journal')}  disabled={!canWrite} />
            <QuickAction label="Chart of Accounts"     onClick={() => navigate('/accounts')} />
            <QuickAction label="Trial Balance"         onClick={() => navigate('/reports')}  />
            <QuickAction label="Financial Statements"  onClick={() => navigate('/reports')}  />
          </div>
        </div>
      </div>

      {/* Recent journal entries */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Recent Journal Entries</h3>
          <button
            onClick={() => navigate('/journal')}
            className="text-xs text-[#0875e1] hover:text-[#0667c8] font-medium"
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
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">TRX</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentEntries.map(e => (
                <tr
                  key={e.trx_no}
                  onClick={() => navigate('/journal')}
                  className="hover:bg-[#0875e1]/[0.03] cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5 font-mono text-slate-600 text-sm">{e.trx_no}</td>
                  <td className="px-4 py-3.5 text-slate-500 text-sm">{e.date}</td>
                  <td className="px-4 py-3.5 text-slate-700 text-sm truncate max-w-xs">{e.description}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-700 text-sm">{fmtAmt(e.total_dr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
