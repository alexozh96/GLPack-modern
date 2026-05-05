import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  importCsv,
  getUnmatchedBankRows,
  getGlCashEntries,
  getMatchedPairs,
  getSummary,
  matchEntry,
  unmatchEntry,
} from '../api/reconciliation'
import type { BankRowRead, GlEntryRead, MatchedPairRead, ReconcSummary } from '../api/reconciliation'
import { PageHeader, cls } from '../components/ui'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(v: string | number): string {
  const n = parseFloat(String(v))
  if (isNaN(n)) return '—'
  const abs = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${abs})` : abs
}

// ── sub-components ────────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: ReconcSummary | null }) {
  if (!summary) return null
  return (
    <div className="flex gap-3 text-sm flex-wrap">
      <span className="px-3 py-1.5 bg-slate-100 rounded-full text-slate-600 font-medium">
        Total: <strong>{summary.total}</strong>
      </span>
      <span className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-green-700 font-medium">
        Matched: <strong>{summary.matched}</strong>
      </span>
      <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-amber-700 font-medium">
        Unmatched: <strong>{summary.unmatched}</strong>
      </span>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export function BankReconciliation() {
  const { user } = useAuth()
  const canWrite = (user?.access_level ?? 0) >= 3
  const fileRef = useRef<HTMLInputElement>(null)

  const [bankRows, setBankRows] = useState<BankRowRead[]>([])
  const [glEntries, setGlEntries] = useState<GlEntryRead[]>([])
  const [matchedPairs, setMatchedPairs] = useState<MatchedPairRead[]>([])
  const [summary, setSummary] = useState<ReconcSummary | null>(null)

  const [selectedBank, setSelectedBank] = useState<number | null>(null)
  const [selectedGl, setSelectedGl] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [matchErr, setMatchErr] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)
    const [b, g, m, s] = await Promise.allSettled([
      getUnmatchedBankRows(),
      getGlCashEntries(),
      getMatchedPairs(),
      getSummary(),
    ])
    if (b.status === 'fulfilled') setBankRows(b.value)
    if (g.status === 'fulfilled') setGlEntries(g.value)
    if (m.status === 'fulfilled') setMatchedPairs(m.value)
    if (s.status === 'fulfilled') setSummary(s.value)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)
    try {
      const res = await importCsv(file)
      setImportMsg(`Imported ${res.imported} row(s).`)
      await loadAll()
    } catch {
      setImportMsg('Import failed. Check CSV has date, description, amount columns.')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleMatch() {
    if (selectedBank === null || selectedGl === null) return
    setMatchErr(null)
    try {
      await matchEntry(selectedBank, selectedGl)
      setSelectedBank(null)
      setSelectedGl(null)
      await loadAll()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMatchErr(msg ?? 'Match failed.')
    }
  }

  async function handleUnmatch(bankRowId: number) {
    await unmatchEntry(bankRowId)
    await loadAll()
  }

  const canMatch = selectedBank !== null && selectedGl !== null

  return (
    <div className="space-y-5">
      <PageHeader title="Bank Reconciliation">
        <SummaryBar summary={summary} />
      </PageHeader>

      {/* CSV import */}
      {canWrite && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-slate-600">Import bank CSV</span>
          <span className="text-xs text-slate-400">(columns: date, description, amount)</span>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className={cls.btnPrimary}
          >
            {importing ? 'Importing…' : 'Choose File'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          {importMsg && (
            <span className={`text-sm ${importMsg.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
              {importMsg}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>
      ) : (
        <>
          {/* Two-column matching area */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Unmatched bank rows */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className={cls.cardTitle}>
                  Unmatched Bank Rows
                  <span className="ml-2 text-xs font-normal text-slate-400">({bankRows.length})</span>
                </h3>
              </div>
              {bankRows.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">All bank rows matched</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {bankRows.map(row => (
                    <button
                      key={row.id}
                      onClick={() => setSelectedBank(selectedBank === row.id ? null : row.id)}
                      className={`w-full text-left px-4 py-2.5 transition-colors ${
                        selectedBank === row.id ? 'bg-[#0875e1]/[0.06] border-l-2 border-[#0875e1]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400">{row.date}</span>
                        <span className={`text-sm font-mono font-medium ${parseFloat(row.amount) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          {fmtAmt(row.amount)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 truncate">{row.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Unmatched GL cash entries */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className={cls.cardTitle}>
                  Unmatched GL Cash Entries
                  <span className="ml-2 text-xs font-normal text-slate-400">({glEntries.length})</span>
                </h3>
              </div>
              {glEntries.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">No unmatched GL cash entries</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {glEntries.map(entry => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedGl(selectedGl === entry.id ? null : entry.id)}
                      className={`w-full text-left px-4 py-2.5 transition-colors ${
                        selectedGl === entry.id ? 'bg-[#0875e1]/[0.06] border-l-2 border-[#0875e1]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400">{entry.date} · TRX {entry.trx_no} · {entry.account}</span>
                        <span className="text-sm font-mono font-medium text-slate-800">
                          {parseFloat(entry.dr_amount) > 0 ? `Dr ${fmtAmt(entry.dr_amount)}` : `Cr ${fmtAmt(entry.cr_amount)}`}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 truncate">{entry.particular}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Match button */}
          {canWrite && (
            <div className="flex items-center gap-3">
              <button onClick={handleMatch} disabled={!canMatch} className={cls.btnPrimary}>
                Match Selected
              </button>
              {!canMatch && (selectedBank !== null || selectedGl !== null) && (
                <span className="text-xs text-slate-400">Select one item from each column</span>
              )}
              {matchErr && <span className={cls.alertError}>{matchErr}</span>}
            </div>
          )}

          {/* Matched pairs */}
          {matchedPairs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className={cls.cardTitle}>
                  Matched Pairs
                  <span className="ml-2 text-xs font-normal text-slate-400">({matchedPairs.length})</span>
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={cls.th}>Bank Date</th>
                    <th className={cls.th}>Bank Description</th>
                    <th className={cls.thRight}>Bank Amount</th>
                    <th className={cls.th}>GL TRX</th>
                    <th className={cls.th}>GL Particular</th>
                    <th className={cls.thRight}>GL Dr/Cr</th>
                    {canWrite && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matchedPairs.map(pair => (
                    <tr key={pair.bank_id} className="hover:bg-[#0875e1]/[0.03] transition-colors">
                      <td className={cls.td}>{pair.bank_date}</td>
                      <td className={`${cls.td} truncate max-w-[160px]`}>{pair.bank_description}</td>
                      <td className={`${cls.tdRight} ${parseFloat(pair.bank_amount) < 0 ? 'text-red-600' : ''}`}>
                        {fmtAmt(pair.bank_amount)}
                      </td>
                      <td className={cls.tdMono}>{pair.gl_trx_no}</td>
                      <td className={`${cls.td} truncate max-w-[160px]`}>{pair.gl_particular}</td>
                      <td className={cls.tdRight}>
                        {parseFloat(pair.gl_dr_amount) > 0 ? `Dr ${fmtAmt(pair.gl_dr_amount)}` : `Cr ${fmtAmt(pair.gl_cr_amount)}`}
                      </td>
                      {canWrite && (
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleUnmatch(pair.bank_id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Unmatch
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
