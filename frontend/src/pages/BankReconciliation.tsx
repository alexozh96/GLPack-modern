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
    <div className="flex gap-4 text-sm">
      <span className="px-3 py-1 bg-slate-100 rounded-full text-slate-600">
        Total: <strong>{summary.total}</strong>
      </span>
      <span className="px-3 py-1 bg-green-100 rounded-full text-green-700">
        Matched: <strong>{summary.matched}</strong>
      </span>
      <span className="px-3 py-1 bg-amber-100 rounded-full text-amber-700">
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Bank Reconciliation</h2>
        <SummaryBar summary={summary} />
      </div>

      {/* CSV import */}
      {canWrite && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-slate-600">Import bank CSV</span>
          <span className="text-xs text-slate-400">(columns: date, description, amount)</span>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="px-3 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
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
                <h3 className="text-sm font-semibold text-slate-700">
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
                        selectedBank === row.id ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-slate-50'
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
                <h3 className="text-sm font-semibold text-slate-700">
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
                        selectedGl === entry.id ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-slate-50'
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
              <button
                onClick={handleMatch}
                disabled={!canMatch}
                className="px-4 py-2 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 disabled:opacity-40"
              >
                Match Selected
              </button>
              {!canMatch && (selectedBank !== null || selectedGl !== null) && (
                <span className="text-xs text-slate-400">Select one item from each column</span>
              )}
              {matchErr && <span className="text-sm text-red-600">{matchErr}</span>}
            </div>
          )}

          {/* Matched pairs */}
          {matchedPairs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-700">
                  Matched Pairs
                  <span className="ml-2 text-xs font-normal text-slate-400">({matchedPairs.length})</span>
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Bank Date</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Bank Description</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">Bank Amount</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">GL TRX</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">GL Particular</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">GL Dr/Cr</th>
                    {canWrite && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matchedPairs.map(pair => (
                    <tr key={pair.bank_id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500">{pair.bank_date}</td>
                      <td className="px-4 py-2.5 text-slate-700 truncate max-w-[160px]">{pair.bank_description}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${parseFloat(pair.bank_amount) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {fmtAmt(pair.bank_amount)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{pair.gl_trx_no}</td>
                      <td className="px-4 py-2.5 text-slate-700 truncate max-w-[160px]">{pair.gl_particular}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                        {parseFloat(pair.gl_dr_amount) > 0 ? `Dr ${fmtAmt(pair.gl_dr_amount)}` : `Cr ${fmtAmt(pair.gl_cr_amount)}`}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => handleUnmatch(pair.bank_id)}
                            className="text-xs text-red-500 hover:text-red-700"
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
