import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFiscalYear } from '../hooks/useFiscalYear'
import { getLedger } from '../api/ledger'
import { downloadLedgerPdf } from '../api/reports'
import { listAccounts } from '../api/accounts'
import type { LedgerLine } from '../api/ledger'
import type { Account } from '../api/accounts'
import { PageHeader, cls } from '../components/ui'
import { ColumnHeader, useTableControls, applyTableControls } from '../components/TableControls'

function fmtAmt(v: string | number): string {
  const n = parseFloat(String(v))
  return isNaN(n) || n === 0 ? '' : n.toFixed(2)
}

function fmtBalance(v: string): { text: string; label: string; positive: boolean | null } {
  const n = parseFloat(v)
  if (isNaN(n) || n === 0) return { text: '0.00', label: '', positive: null }
  const abs = Math.abs(n).toFixed(2)
  return n > 0
    ? { text: abs, label: 'Dr', positive: true }
    : { text: abs, label: 'Cr', positive: false }
}

export function Ledger() {
  const navigate = useNavigate()

  const { fyStart, fyEnd, ready: fyReady } = useFiscalYear()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [account, setAccount] = useState('')         // code sent to API
  const [accountQuery, setAccountQuery] = useState('') // text shown in search input
  const [accountOpen, setAccountOpen] = useState(false)
  const [fromDate, setFromDate] = useState(fyStart)
  const [toDate, setToDate] = useState(fyEnd)

  const [rows, setRows] = useState<LedgerLine[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const tc = useTableControls()

  useEffect(() => {
    listAccounts().then(setAccounts).catch(() => {})
  }, [])

  // Sync date inputs when FY context loads (handles async case on first render)
  useEffect(() => {
    if (!fyReady) return
    if (fromDate === '') setFromDate(fyStart)
    if (toDate === '') setToDate(fyEnd)
  }, [fyReady]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLedger() {
    if (!account) return
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { account }
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      const data = await getLedger(params)
      setRows(data)
      setLoaded(true)
    } catch {
      setError('Failed to load ledger data.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePdf() {
    if (!account || !fromDate || !toDate) return
    setPdfBusy(true)
    setError(null)
    try {
      await downloadLedgerPdf(account, fromDate, toDate)
    } catch {
      setError('PDF export failed.')
    } finally {
      setPdfBusy(false)
    }
  }

  function handleTrxClick(trxNo: string) {
    navigate('/journal', { state: { openTrx: trxNo } })
  }

  const filteredAccounts = accounts
    .filter(a => {
      const q = accountQuery.toLowerCase()
      return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    })
    .slice(0, 14)

  function selectAccount(a: Account) {
    setAccount(a.code)
    setAccountQuery(`${a.code} — ${a.name}`)
    setAccountOpen(false)
    setLoaded(false)
  }

  const displayed = useMemo(() => applyTableControls(
    rows, tc.sortKey, tc.sortDir, tc.filters,
    (row, col) => {
      if (col === 'date')       return row.date
      if (col === 'trx_no')     return row.trx_no
      if (col === 'particular') return row.particular
      if (col === 'dr_amount')  return parseFloat(row.dr_amount) || 0
      if (col === 'cr_amount')  return parseFloat(row.cr_amount) || 0
      if (col === 'balance')    return parseFloat(row.balance)   || 0
      return ''
    },
  ), [rows, tc.sortKey, tc.sortDir, tc.filters])

  const selectedAccount = accounts.find(a => a.code === account)
  const canPdf = !!account && !!fromDate && !!toDate

  const totalDr = rows.reduce((s, r) => s + (parseFloat(r.dr_amount) || 0), 0)
  const totalCr = rows.reduce((s, r) => s + (parseFloat(r.cr_amount) || 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader title="Ledger View">
        {canPdf && (
          <button onClick={handlePdf} disabled={pdfBusy} className={cls.btnSecondary}>
            {pdfBusy ? 'Exporting…' : 'Export PDF'}
          </button>
        )}
      </PageHeader>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex gap-3 items-center flex-wrap">
        <div className="relative">
          <input
            type="text"
            value={accountQuery}
            onChange={e => {
              setAccountQuery(e.target.value)
              setAccount('')
              setLoaded(false)
              setAccountOpen(true)
            }}
            onFocus={() => setAccountOpen(true)}
            onBlur={() => setTimeout(() => setAccountOpen(false), 150)}
            placeholder="Search account…"
            className={`${cls.input} w-56 ${accountQuery ? 'pr-8' : ''}`}
          />
          {accountQuery && (
            <button
              onMouseDown={e => {
                e.preventDefault()
                setAccountQuery('')
                setAccount('')
                setLoaded(false)
                setAccountOpen(false)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-slate-700 transition-colors text-[11px] leading-none"
              tabIndex={-1}
              aria-label="Clear"
            >
              ✕
            </button>
          )}
          {accountOpen && filteredAccounts.length > 0 && (
            <div className="absolute z-20 top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto min-w-full">
              {filteredAccounts.map(a => (
                <div
                  key={a.code}
                  onMouseDown={() => selectAccount(a)}
                  className="px-3 py-2 hover:bg-[#0875e1]/[0.06] hover:text-[#0875e1] cursor-pointer text-xs whitespace-nowrap transition-colors"
                >
                  <span className="font-mono">{a.code}</span>
                  {' — '}{a.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          className={cls.input}
        />
        <span className="text-slate-400 text-sm">to</span>
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          className={cls.input}
        />

        <button
          onClick={loadLedger}
          disabled={!account || loading}
          className={cls.btnPrimary}
        >
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>

      {selectedAccount && (
        <p className="text-sm text-slate-500">
          Account <span className="font-mono font-medium text-slate-700">{selectedAccount.code}</span>
          {' — '}{selectedAccount.name}
        </p>
      )}

      {error && <div className={cls.alertError}>{error}</div>}

      {/* Table */}
      {loaded && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No transactions found for this account.
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <ColumnHeader label="Date"       col="date"       type="date"   sortKey={tc.sortKey} sortDir={tc.sortDir} filters={tc.filters} onSort={tc.setSort} onClearSort={tc.clearSort} onSetFilter={tc.setFilter} onClearFilter={tc.clearFilter} className="w-28" />
                    <ColumnHeader label="TRX"        col="trx_no"     type="text"   sortKey={tc.sortKey} sortDir={tc.sortDir} filters={tc.filters} onSort={tc.setSort} onClearSort={tc.clearSort} onSetFilter={tc.setFilter} onClearFilter={tc.clearFilter} className="w-20" />
                    <ColumnHeader label="Particular" col="particular" type="text"   sortKey={tc.sortKey} sortDir={tc.sortDir} filters={tc.filters} onSort={tc.setSort} onClearSort={tc.clearSort} onSetFilter={tc.setFilter} onClearFilter={tc.clearFilter} />
                    <ColumnHeader label="Debit"      col="dr_amount"  type="number" sortKey={tc.sortKey} sortDir={tc.sortDir} filters={tc.filters} onSort={tc.setSort} onClearSort={tc.clearSort} onSetFilter={tc.setFilter} onClearFilter={tc.clearFilter} className="w-28" right />
                    <ColumnHeader label="Credit"     col="cr_amount"  type="number" sortKey={tc.sortKey} sortDir={tc.sortDir} filters={tc.filters} onSort={tc.setSort} onClearSort={tc.clearSort} onSetFilter={tc.setFilter} onClearFilter={tc.clearFilter} className="w-28" right />
                    <ColumnHeader label="Balance"    col="balance"    type="number" sortKey={tc.sortKey} sortDir={tc.sortDir} filters={tc.filters} onSort={tc.setSort} onClearSort={tc.clearSort} onSetFilter={tc.setFilter} onClearFilter={tc.clearFilter} className="w-32" right />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayed.map(row => {
                    const bal = fmtBalance(row.balance)
                    return (
                      <tr key={row.id} className="hover:bg-[#0875e1]/[0.03] transition-colors">
                        <td className={cls.td}>{row.date}</td>
                        <td className={cls.tdMono}>
                          <button
                            onClick={() => handleTrxClick(row.trx_no)}
                            className="hover:text-[#0875e1] hover:underline"
                          >
                            {row.trx_no}
                          </button>
                        </td>
                        <td className={cls.td}>{row.particular}</td>
                        <td className={cls.tdRight}>{fmtAmt(row.dr_amount)}</td>
                        <td className={cls.tdRight}>{fmtAmt(row.cr_amount)}</td>
                        <td className="px-5 py-3.5 text-right font-mono">
                          <span className={bal.positive === null ? 'text-slate-400' : 'text-slate-800'}>
                            {bal.text}
                          </span>
                          {bal.label && (
                            <span className={`ml-1 text-xs font-medium ${bal.positive ? 'text-blue-600' : 'text-amber-600'}`}>
                              {bal.label}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                  <tr>
                    <td colSpan={3} className="px-5 py-3 text-sm font-medium text-slate-600">
                      Totals ({displayed.length === rows.length
                        ? `${rows.length} line${rows.length !== 1 ? 's' : ''}`
                        : `${displayed.length} of ${rows.length} lines`})
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-800">
                      {totalDr.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-800">
                      {totalCr.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      )}

      {!loaded && !loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
          Select an account and click Load to view its ledger.
        </div>
      )}
    </div>
  )
}
