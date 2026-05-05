import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLedger } from '../api/ledger'
import { downloadLedgerPdf } from '../api/reports'
import { listAccounts } from '../api/accounts'
import type { LedgerLine } from '../api/ledger'
import type { Account } from '../api/accounts'
import { PageHeader, cls } from '../components/ui'

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

  const [accounts, setAccounts] = useState<Account[]>([])
  const [account, setAccount] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [rows, setRows] = useState<LedgerLine[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    listAccounts().then(setAccounts).catch(() => {})
  }, [])

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
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 items-center flex-wrap">
        <select
          value={account}
          onChange={e => { setAccount(e.target.value); setLoaded(false) }}
          className={cls.select}
        >
          <option value="">Select account…</option>
          {accounts.map(a => (
            <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
          ))}
        </select>

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
            <div className="p-6 text-center text-slate-400 text-sm">
              No transactions found for this account.
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={`${cls.th} w-28`}>Date</th>
                    <th className={`${cls.th} w-20`}>TRX</th>
                    <th className={cls.th}>Particular</th>
                    <th className={`${cls.thRight} w-28`}>Debit</th>
                    <th className={`${cls.thRight} w-28`}>Credit</th>
                    <th className={`${cls.thRight} w-32`}>Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => {
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
                      Totals ({rows.length} line{rows.length !== 1 ? 's' : ''})
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
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
          Select an account and click Load to view its ledger.
        </div>
      )}
    </div>
  )
}
