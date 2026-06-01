import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFiscalYear } from '../hooks/useFiscalYear'
import { getProfitLoss } from '../api/reports'
import { listJournals } from '../api/journal'
import type { JournalSummary } from '../api/journal'
import { PageHeader, cls } from '../components/ui'

type Preset = 'fy' | 'ytd' | 'quarter' | 'month' | 'custom'

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
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm min-h-[128px] flex flex-col justify-between">
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
      className="w-full text-left h-11 px-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0875e1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  )
}

const ACTIVE_PRESET = 'h-8 px-3 text-xs font-semibold rounded-lg bg-[#0875e1] text-white transition-colors'
const INACTIVE_PRESET = 'h-8 px-3 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors'

export function Dashboard() {
  const { company } = useAuth()
  const navigate = useNavigate()
  const canWrite = (company?.access_level ?? 0) >= 3

  const { fyStart, fyEnd, isConfigured, ready: fyReady } = useFiscalYear()

  const [preset, setPreset] = useState<Preset>('ytd')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [presetInitialized, setPresetInitialized] = useState(false)

  // Set default preset once FY context has loaded
  useEffect(() => {
    if (fyReady && !presetInitialized) {
      setPreset(isConfigured ? 'fy' : 'ytd')
      setPresetInitialized(true)
    }
  }, [fyReady, isConfigured, presetInitialized])

  const { start, end } = useMemo((): { start: string; end: string } => {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const year = today.getFullYear()
    if (preset === 'fy') {
      return fyStart && fyEnd ? { start: fyStart, end: fyEnd } : { start: `${year}-01-01`, end: todayStr }
    }
    if (preset === 'ytd') return { start: `${year}-01-01`, end: todayStr }
    if (preset === 'quarter') {
      const q = Math.floor(today.getMonth() / 3)
      return { start: new Date(year, q * 3, 1).toISOString().slice(0, 10), end: todayStr }
    }
    if (preset === 'month') {
      const m = String(today.getMonth() + 1).padStart(2, '0')
      return { start: `${year}-${m}-01`, end: todayStr }
    }
    return { start: customFrom, end: customTo }
  }, [preset, fyStart, fyEnd, customFrom, customTo])

  const [kpis, setKpis] = useState<{
    revenue: string; grossPct: string; netProfit: string; entries: number
  } | null>(null)
  const [recentEntries, setRecentEntries] = useState<JournalSummary[]>([])
  const [monthlyData, setMonthlyData] = useState<{ month: string; total: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [partial, setPartial] = useState(false)

  useEffect(() => {
    if (!presetInitialized) return
    if (!start || !end) return
    setLoading(true)
    setPartial(false)
    Promise.allSettled([
      getProfitLoss(start, end),
      listJournals({ from_date: start, to_date: end }),
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
  }, [start, end, presetInitialized]) // eslint-disable-line react-hooks/exhaustive-deps

  const maxMonthly = Math.max(...monthlyData.map(m => m.total), 1)

  const presetLabel = (() => {
    if (preset === 'fy') return `Financial year — ${start} to ${end}`
    if (preset === 'ytd') return `Year to date — ${start} to today`
    if (preset === 'quarter') return `This quarter — ${start} to today`
    if (preset === 'month') return `This month — ${start} to today`
    if (start && end) return `${start} to ${end}`
    return 'Select a date range'
  })()

  const periodSub = (() => {
    if (preset === 'fy') return 'Financial year'
    if (preset === 'ytd') return 'Year to date'
    if (preset === 'quarter') return 'This quarter'
    if (preset === 'month') return 'This month'
    return 'Selected period'
  })()

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" sub={presetLabel} />

      {/* Date range preset selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {isConfigured && (
          <button onClick={() => setPreset('fy')} className={preset === 'fy' ? ACTIVE_PRESET : INACTIVE_PRESET}>
            Financial Year
          </button>
        )}
        <button onClick={() => setPreset('ytd')} className={preset === 'ytd' ? ACTIVE_PRESET : INACTIVE_PRESET}>
          Year to Date
        </button>
        <button onClick={() => setPreset('quarter')} className={preset === 'quarter' ? ACTIVE_PRESET : INACTIVE_PRESET}>
          This Quarter
        </button>
        <button onClick={() => setPreset('month')} className={preset === 'month' ? ACTIVE_PRESET : INACTIVE_PRESET}>
          This Month
        </button>
        <button onClick={() => setPreset('custom')} className={preset === 'custom' ? ACTIVE_PRESET : INACTIVE_PRESET}>
          Custom
        </button>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className={`${cls.input} w-36`}
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className={`${cls.input} w-36`}
            />
          </div>
        )}
      </div>

      {partial && (
        <div className={cls.alertWarning}>
          Some data could not be loaded. Is the backend running?
        </div>
      )}

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 min-h-[110px] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Total Revenue"    value={kpis?.revenue ?? '—'}               sub={periodSub} />
          <KpiCard label="Gross Profit %"   value={kpis?.grossPct ?? '—'}              sub="Of revenue" />
          <KpiCard label="Net Profit"       value={kpis?.netProfit ?? '—'}             sub="After tax" />
          <KpiCard label="Journal Entries"  value={kpis ? String(kpis.entries) : '—'}  sub={periodSub} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        {/* Monthly activity chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className={`${cls.cardTitle} mb-5`}>Monthly Transaction Volume</h3>
          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center min-h-[220px] text-slate-400 text-sm">
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
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className={`${cls.cardTitle} mb-3`}>Quick Actions</h3>
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
          <h3 className={cls.cardTitle}>Recent Journal Entries</h3>
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
          <div className="p-6 text-center text-slate-400 text-sm">No journal entries found for this period.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={`${cls.th} w-20`}>TRX</th>
                <th className={`${cls.th} w-28`}>Date</th>
                <th className={cls.th}>Description</th>
                <th className={`${cls.thRight} w-28`}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentEntries.map(e => (
                <tr
                  key={e.trx_no}
                  onClick={() => navigate('/journal')}
                  className="hover:bg-[#0875e1]/[0.03] cursor-pointer transition-colors"
                >
                  <td className={cls.tdMono}>{e.trx_no}</td>
                  <td className={cls.td}>{e.date}</td>
                  <td className={`${cls.td} truncate max-w-xs`}>{e.description}</td>
                  <td className={cls.tdRight}>{fmtAmt(e.total_dr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
