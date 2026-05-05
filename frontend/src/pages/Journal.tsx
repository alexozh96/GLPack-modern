import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { listJournals, getJournal, createJournal, updateJournal, deleteJournal } from '../api/journal'
import { listAccounts } from '../api/accounts'
import { listPhrases } from '../api/phrases'
import { importLedgerCsv, exportLedgerCsv } from '../api/ledger'
import type { JournalSummary } from '../api/journal'
import type { Account } from '../api/accounts'
import type { Phrase } from '../api/phrases'
import { PageHeader, cls } from '../components/ui'

function todayStr() { return new Date().toISOString().slice(0, 10) }
function round2(n: number) { return Math.round(n * 100) / 100 }
function fmtAmt(v: string | number) {
  const n = parseFloat(String(v))
  return isNaN(n) ? '0.00' : n.toFixed(2)
}

function apiError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { detail?: unknown } } }).response
    const d = r?.data?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((x: { msg?: string }) => x.msg ?? String(x)).join('; ')
  }
  return 'An unexpected error occurred.'
}

let _rowId = 0
function newKey() { return String(++_rowId) }
function emptyRow(): FormRow { return { key: newKey(), account: '', particular: '', dr: '', cr: '' } }

type FormRow = { key: string; account: string; particular: string; dr: string; cr: string }

// ── Combobox ──────────────────────────────────────────────────────────────────

interface ComboOption { value: string; label: string }

function Combobox({ value, onChange, options, placeholder, inputClass = '' }: {
  value: string
  onChange: (v: string) => void
  options: ComboOption[]
  placeholder?: string
  inputClass?: string
}) {
  const [open, setOpen] = useState(false)
  const lower = value.toLowerCase()
  const visible = options
    .filter(o => o.value.toLowerCase().includes(lower) || o.label.toLowerCase().includes(lower))
    .slice(0, 12)

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={`w-full ${cls.input} ${inputClass}`}
      />
      {open && visible.length > 0 && (
        <div className="absolute z-20 top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto min-w-full">
          {visible.map(o => (
            <div
              key={o.value + o.label}
              onMouseDown={() => { onChange(o.value); setOpen(false) }}
              className="px-3 py-2 hover:bg-[#0875e1]/[0.06] hover:text-[#0875e1] cursor-pointer text-xs whitespace-nowrap transition-colors"
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Journal Page ──────────────────────────────────────────────────────────────

export function Journal() {
  const { user } = useAuth()
  const location = useLocation()
  const canWrite = (user?.access_level ?? 0) >= 3
  const toast = useToast()

  const [view, setView] = useState<'list' | 'form'>('list')
  const [editingTrxNo, setEditingTrxNo] = useState<string | null>(null)

  const [entries, setEntries] = useState<JournalSummary[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [phrases, setPhrases] = useState<Phrase[]>([])

  const [importBusy, setImportBusy] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  const [exportBusy, setExportBusy] = useState(false)

  const [formDate, setFormDate] = useState(todayStr())
  const [rows, setRows] = useState<FormRow[]>([emptyRow(), emptyRow()])
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const totalDr = round2(rows.reduce((s, r) => s + (parseFloat(r.dr) || 0), 0))
  const totalCr = round2(rows.reduce((s, r) => s + (parseFloat(r.cr) || 0), 0))
  const balanced = totalDr > 0 && totalDr === totalCr
  const diff = round2(Math.abs(totalDr - totalCr))

  const accountOptions: ComboOption[] = accounts.map(a => ({ value: a.code, label: `${a.code} — ${a.name}` }))
  const phraseOptions: ComboOption[] = phrases.map(p => ({
    value: p.phrase,
    label: p.dr_code || p.cr_code ? `${p.phrase}  [Dr:${p.dr_code ?? '—'} Cr:${p.cr_code ?? '—'}]` : p.phrase,
  }))

  useEffect(() => {
    loadList()
    listAccounts().then(setAccounts).catch(() => {})
    listPhrases().then(setPhrases).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const state = location.state as { openTrx?: string } | null
    if (state?.openTrx) { openEdit(state.openTrx); window.history.replaceState({}, '') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function loadList(fd = fromDate, td = toDate) {
    setListLoading(true); setListError(null)
    const params: Record<string, string> = {}
    if (fd) params.from_date = fd
    if (td) params.to_date = td
    listJournals(params)
      .then(setEntries)
      .catch(() => setListError('Failed to load journal entries.'))
      .finally(() => setListLoading(false))
  }

  function applyFilter() { loadList(fromDate, toDate) }
  function clearFilter() { setFromDate(''); setToDate(''); loadList('', '') }

  async function handleDelete(trxNo: string) {
    setDeleteBusy(true)
    try {
      await deleteJournal(trxNo)
      setEntries(prev => prev.filter(e => e.trx_no !== trxNo))
      setDeleteTarget(null)
    } catch (err) {
      setListError(apiError(err))
      setDeleteTarget(null)
      if ((err as { response?: { status?: number } })?.response?.status === 403)
        toast.error('This entry is in a locked period and cannot be deleted.')
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleExport() {
    setExportBusy(true)
    try {
      await exportLedgerCsv({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      })
    } catch {
      setListError('Export failed.')
    } finally {
      setExportBusy(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportBusy(true)
    setImportResult(null)
    setListError(null)
    try {
      const result = await importLedgerCsv(file)
      setImportResult(`Imported ${result.imported_rows} rows across ${result.imported_transactions} transaction${result.imported_transactions !== 1 ? 's' : ''}`)
      loadList()
    } catch (err) {
      setListError(apiError(err))
    } finally {
      setImportBusy(false)
    }
  }

  function openNew() {
    setEditingTrxNo(null); setFormDate(todayStr())
    setRows([emptyRow(), emptyRow()]); setFormError(null); setView('form')
  }

  async function openEdit(trxNo: string) {
    setListError(null)
    try {
      const entry = await getJournal(trxNo)
      setEditingTrxNo(trxNo); setFormDate(entry.date)
      setRows(entry.lines.map(l => ({
        key: newKey(), account: l.account, particular: l.particular,
        dr: parseFloat(l.dr_amount) === 0 ? '' : l.dr_amount,
        cr: parseFloat(l.cr_amount) === 0 ? '' : l.cr_amount,
      })))
      setFormError(null); setView('form')
    } catch { setListError('Failed to load journal entry.') }
  }

  function setRow(key: string, patch: Partial<FormRow>) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))
  }
  function addRow() { setRows(prev => [...prev, emptyRow()]) }
  function removeRow(key: string) { setRows(prev => prev.filter(r => r.key !== key)) }

  async function handleSave() {
    setFormError(null); setFormBusy(true)
    const lines = rows.map(r => ({
      account: r.account.trim().toUpperCase(),
      particular: r.particular.trim(),
      dr_amount: r.dr || '0',
      cr_amount: r.cr || '0',
    }))
    try {
      if (editingTrxNo) { await updateJournal(editingTrxNo, formDate, lines) }
      else              { await createJournal(formDate, lines) }
      setView('list'); loadList()
    } catch (err) {
      setFormError(apiError(err))
      if ((err as { response?: { status?: number } })?.response?.status === 403)
        toast.error('This entry is in a locked period and cannot be edited.')
    } finally { setFormBusy(false) }
  }

  // ── Form view ─────────────────────────────────────────────────────────────

  if (view === 'form') {
    return (
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('list')}
            className="text-sm text-slate-400 hover:text-[#0875e1] font-medium transition-colors"
          >
            ← Back
          </button>
          <h2 className="text-2xl font-bold text-slate-800">
            {editingTrxNo ? `Edit Entry — ${editingTrxNo}` : 'New Journal Entry'}
          </h2>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 shadow-sm">
          {/* Date */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-semibold text-slate-600 w-16 shrink-0">Date</label>
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              className={cls.input}
            />
          </div>

          {/* Lines table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 pr-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-44">Account</th>
                  <th className="py-3 pr-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Particular</th>
                  <th className="py-3 pr-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Debit</th>
                  <th className="py-3 pr-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Credit</th>
                  <th className="py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.key} className="align-top">
                    <td className="pr-3 py-2">
                      <Combobox
                        value={row.account}
                        onChange={v => setRow(row.key, { account: v.toUpperCase().slice(0, 4) })}
                        options={accountOptions}
                        placeholder="Code"
                        inputClass="font-mono"
                      />
                      {(() => {
                        const name = accounts.find(a => a.code === row.account)?.name
                        return name ? (
                          <p className="text-[11px] text-slate-400 leading-tight mt-0.5 px-0.5 truncate">{name}</p>
                        ) : null
                      })()}
                    </td>
                    <td className="pr-3 py-2">
                      <Combobox
                        value={row.particular}
                        onChange={v => setRow(row.key, { particular: v.slice(0, 45) })}
                        options={phraseOptions}
                        placeholder="Description"
                      />
                    </td>
                    <td className="pr-3 py-2">
                      <input
                        type="number" min="0" step="0.01" value={row.dr}
                        onChange={e => setRow(row.key, { dr: e.target.value, cr: e.target.value ? '' : row.cr })}
                        placeholder="0.00"
                        className={`w-full ${cls.input} text-right`}
                      />
                    </td>
                    <td className="pr-3 py-2">
                      <input
                        type="number" min="0" step="0.01" value={row.cr}
                        onChange={e => setRow(row.key, { cr: e.target.value, dr: e.target.value ? '' : row.dr })}
                        placeholder="0.00"
                        className={`w-full ${cls.input} text-right`}
                      />
                    </td>
                    <td className="py-2 pl-1">
                      {rows.length > 1 && (
                        <button
                          onClick={() => removeRow(row.key)}
                          title="Remove line"
                          className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 text-lg leading-none transition-colors"
                        >×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addRow} className="text-sm text-[#0875e1] hover:text-[#0667c8] font-medium transition-colors">
            + Add line
          </button>

          {/* Totals */}
          <div className="border-t border-slate-200 pt-4 flex items-center gap-6 flex-wrap">
            <span className="text-sm">
              <span className="text-slate-500">Total Dr: </span>
              <span className="font-mono font-semibold text-slate-800">{totalDr.toFixed(2)}</span>
            </span>
            <span className="text-sm">
              <span className="text-slate-500">Total Cr: </span>
              <span className="font-mono font-semibold text-slate-800">{totalCr.toFixed(2)}</span>
            </span>
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
              balanced
                ? 'bg-green-50 text-green-700 border border-green-200'
                : totalDr === 0 && totalCr === 0
                ? 'text-slate-400'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {balanced ? '✓ Balanced' : totalDr === 0 && totalCr === 0 ? 'Enter amounts' : `Difference: ${diff.toFixed(2)}`}
            </span>
          </div>

          {formError && <div className={cls.alertError}>{formError}</div>}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={!balanced || formBusy} className={cls.btnPrimary}>
              {formBusy ? 'Saving…' : editingTrxNo ? 'Update Entry' : 'Post Entry'}
            </button>
            <button onClick={() => setView('list')} className={cls.btnSecondary}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <PageHeader
        title="Journal Entries"
        sub={`${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}`}
      >
        <>
          <button
            onClick={handleExport}
            disabled={exportBusy}
            className={cls.btnSecondary}
          >
            {exportBusy ? 'Exporting…' : 'Export CSV'}
          </button>
          {canWrite && (
            <>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
              />
              <button
                onClick={() => importFileRef.current?.click()}
                disabled={importBusy}
                className={cls.btnSecondary}
              >
                {importBusy ? 'Importing…' : 'Import CSV'}
              </button>
              <button onClick={openNew} className={cls.btnPrimary}>+ New Entry</button>
            </>
          )}
        </>
      </PageHeader>

      {/* Date filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex gap-3 items-center flex-wrap">
        <input
          type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className={cls.input}
        />
        <span className="text-slate-400 text-sm">to</span>
        <input
          type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className={cls.input}
        />
        <button onClick={applyFilter} className={cls.btnSecondary}>Filter</button>
        {(fromDate || toDate) && (
          <button onClick={clearFilter} className="text-sm text-slate-400 hover:text-[#0875e1] transition-colors">
            Clear
          </button>
        )}
      </div>

      {importResult && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-3">
          {importResult}
        </div>
      )}
      {listError && <div className={cls.alertError}>{listError}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {listLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No journal entries found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={`${cls.th} w-24`}>TRX</th>
                <th className={`${cls.th} w-28`}>Date</th>
                <th className={cls.th}>Description</th>
                <th className={`${cls.thRight} w-28`}>Debit</th>
                <th className={`${cls.thRight} w-28`}>Credit</th>
                {canWrite && <th className="w-32" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(entry => (
                <tr key={entry.trx_no} className="hover:bg-[#0875e1]/[0.03] transition-colors">
                  <td className={cls.tdMono}>{entry.trx_no}</td>
                  <td className={cls.td}>{entry.date}</td>
                  <td className={`${cls.td} max-w-xs truncate`}>{entry.description}</td>
                  <td className={cls.tdRight}>{fmtAmt(entry.total_dr)}</td>
                  <td className={cls.tdRight}>{fmtAmt(entry.total_cr)}</td>
                  {canWrite && (
                    <td className="px-5 py-3.5 text-right">
                      {deleteTarget === entry.trx_no ? (
                        <span className="flex items-center gap-2 text-xs justify-end">
                          <span className="text-slate-500">Delete?</span>
                          <button onClick={() => handleDelete(entry.trx_no)} disabled={deleteBusy}
                            className="text-red-600 hover:text-red-800 font-semibold disabled:opacity-50">Yes</button>
                          <button onClick={() => setDeleteTarget(null)}
                            className="text-slate-400 hover:text-slate-600">No</button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-4 justify-end">
                          <button onClick={() => openEdit(entry.trx_no)}
                            className="text-xs text-slate-400 hover:text-[#0875e1] font-medium transition-colors">Edit</button>
                          <button onClick={() => setDeleteTarget(entry.trx_no)}
                            className="text-xs text-slate-400 hover:text-red-600 font-medium transition-colors">Delete</button>
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
