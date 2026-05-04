import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listJournals, getJournal, createJournal, updateJournal, deleteJournal } from '../api/journal'
import { listAccounts } from '../api/accounts'
import { listPhrases } from '../api/phrases'
import type { JournalSummary } from '../api/journal'
import type { Account } from '../api/accounts'
import type { Phrase } from '../api/phrases'

// ── helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

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
        className={`border border-slate-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-slate-400 ${inputClass}`}
      />
      {open && visible.length > 0 && (
        <div className="absolute z-20 top-full left-0 mt-0.5 bg-white border border-slate-200 rounded shadow-lg max-h-44 overflow-y-auto min-w-full">
          {visible.map(o => (
            <div
              key={o.value + o.label}
              onMouseDown={() => { onChange(o.value); setOpen(false) }}
              className="px-2 py-1.5 hover:bg-slate-100 cursor-pointer text-xs whitespace-nowrap"
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

  // view
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editingTrxNo, setEditingTrxNo] = useState<string | null>(null)

  // list
  const [entries, setEntries] = useState<JournalSummary[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  // lookup data
  const [accounts, setAccounts] = useState<Account[]>([])
  const [phrases, setPhrases] = useState<Phrase[]>([])

  // form
  const [formDate, setFormDate] = useState(todayStr())
  const [rows, setRows] = useState<FormRow[]>([emptyRow(), emptyRow()])
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ── computed ──────────────────────────────────────────────────────────────
  const totalDr = round2(rows.reduce((s, r) => s + (parseFloat(r.dr) || 0), 0))
  const totalCr = round2(rows.reduce((s, r) => s + (parseFloat(r.cr) || 0), 0))
  const balanced = totalDr > 0 && totalDr === totalCr
  const diff = round2(Math.abs(totalDr - totalCr))

  const accountOptions: ComboOption[] = accounts.map(a => ({
    value: a.code,
    label: `${a.code} — ${a.name}`,
  }))

  const phraseOptions: ComboOption[] = phrases.map(p => ({
    value: p.phrase,
    label: p.dr_code || p.cr_code
      ? `${p.phrase}  [Dr:${p.dr_code ?? '—'} Cr:${p.cr_code ?? '—'}]`
      : p.phrase,
  }))

  // ── effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    loadList()
    listAccounts().then(setAccounts).catch(() => {})
    listPhrases().then(setPhrases).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // open a specific entry if navigated here from Ledger view
  useEffect(() => {
    const state = location.state as { openTrx?: string } | null
    if (state?.openTrx) {
      openEdit(state.openTrx)
      window.history.replaceState({}, '')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── list handlers ─────────────────────────────────────────────────────────
  function loadList(fd = fromDate, td = toDate) {
    setListLoading(true)
    setListError(null)
    const params: Record<string, string> = {}
    if (fd) params.from_date = fd
    if (td) params.to_date = td
    listJournals(params)
      .then(setEntries)
      .catch(() => setListError('Failed to load journal entries.'))
      .finally(() => setListLoading(false))
  }

  function applyFilter() { loadList(fromDate, toDate) }

  function clearFilter() {
    setFromDate('')
    setToDate('')
    loadList('', '')
  }

  async function handleDelete(trxNo: string) {
    setDeleteBusy(true)
    try {
      await deleteJournal(trxNo)
      setEntries(prev => prev.filter(e => e.trx_no !== trxNo))
      setDeleteTarget(null)
    } catch (err) {
      setListError(apiError(err))
      setDeleteTarget(null)
    } finally {
      setDeleteBusy(false)
    }
  }

  // ── form handlers ─────────────────────────────────────────────────────────
  function openNew() {
    setEditingTrxNo(null)
    setFormDate(todayStr())
    setRows([emptyRow(), emptyRow()])
    setFormError(null)
    setView('form')
  }

  async function openEdit(trxNo: string) {
    setListError(null)
    try {
      const entry = await getJournal(trxNo)
      setEditingTrxNo(trxNo)
      setFormDate(entry.date)
      setRows(entry.lines.map(l => ({
        key: newKey(),
        account: l.account,
        particular: l.particular,
        dr: parseFloat(l.dr_amount) === 0 ? '' : l.dr_amount,
        cr: parseFloat(l.cr_amount) === 0 ? '' : l.cr_amount,
      })))
      setFormError(null)
      setView('form')
    } catch {
      setListError('Failed to load journal entry.')
    }
  }

  function setRow(key: string, patch: Partial<FormRow>) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()])
  }

  function removeRow(key: string) {
    setRows(prev => prev.filter(r => r.key !== key))
  }

  async function handleSave() {
    setFormError(null)
    setFormBusy(true)
    const lines = rows.map(r => ({
      account: r.account.trim().toUpperCase(),
      particular: r.particular.trim(),
      dr_amount: r.dr || '0',
      cr_amount: r.cr || '0',
    }))
    try {
      if (editingTrxNo) {
        await updateJournal(editingTrxNo, formDate, lines)
      } else {
        await createJournal(formDate, lines)
      }
      setView('list')
      loadList()
    } catch (err) {
      setFormError(apiError(err))
    } finally {
      setFormBusy(false)
    }
  }

  // ── form view ─────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setView('list')}
            className="text-slate-500 hover:text-slate-800 text-sm"
          >
            ← Back
          </button>
          <h2 className="text-xl font-semibold text-slate-800">
            {editingTrxNo ? `Edit Entry ${editingTrxNo}` : 'New Journal Entry'}
          </h2>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {/* Date */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 w-12">Date</label>
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* Lines table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="pb-2 pr-2 font-medium w-36">Account</th>
                  <th className="pb-2 pr-2 font-medium">Particular</th>
                  <th className="pb-2 pr-2 font-medium w-28 text-right">Debit</th>
                  <th className="pb-2 pr-2 font-medium w-28 text-right">Credit</th>
                  <th className="pb-2 w-6" />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.key} className="align-top">
                    <td className="pr-2 py-1">
                      <Combobox
                        value={row.account}
                        onChange={v => setRow(row.key, { account: v.toUpperCase().slice(0, 4) })}
                        options={accountOptions}
                        placeholder="Code"
                        inputClass="font-mono"
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <Combobox
                        value={row.particular}
                        onChange={v => setRow(row.key, { particular: v.slice(0, 45) })}
                        options={phraseOptions}
                        placeholder="Description"
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.dr}
                        onChange={e => setRow(row.key, {
                          dr: e.target.value,
                          cr: e.target.value ? '' : row.cr,
                        })}
                        placeholder="0.00"
                        className="w-full border border-slate-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.cr}
                        onChange={e => setRow(row.key, {
                          cr: e.target.value,
                          dr: e.target.value ? '' : row.dr,
                        })}
                        placeholder="0.00"
                        className="w-full border border-slate-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </td>
                    <td className="py-1 pl-1">
                      {rows.length > 1 && (
                        <button
                          onClick={() => removeRow(row.key)}
                          title="Remove line"
                          className="text-slate-400 hover:text-red-500 text-xl leading-none"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={addRow}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            + Add line
          </button>

          {/* Totals + balance */}
          <div className="border-t border-slate-200 pt-4 flex items-center gap-6 flex-wrap">
            <span className="text-sm">
              <span className="text-slate-500">Total Dr: </span>
              <span className="font-mono font-medium text-slate-800">{totalDr.toFixed(2)}</span>
            </span>
            <span className="text-sm">
              <span className="text-slate-500">Total Cr: </span>
              <span className="font-mono font-medium text-slate-800">{totalCr.toFixed(2)}</span>
            </span>
            <span className={`text-sm font-medium ${balanced ? 'text-green-600' : 'text-amber-600'}`}>
              {balanced
                ? '✓ Balanced'
                : totalDr === 0 && totalCr === 0
                ? 'Enter amounts'
                : `Difference: ${diff.toFixed(2)}`}
            </span>
          </div>

          {formError && (
            <p className="text-red-500 text-sm">{formError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!balanced || formBusy}
              className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {formBusy ? 'Saving…' : editingTrxNo ? 'Update Entry' : 'Post Entry'}
            </button>
            <button
              onClick={() => setView('list')}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── list view ─────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Journal Entries</h2>
        {canWrite && (
          <button
            onClick={openNew}
            className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            + New Entry
          </button>
        )}
      </div>

      {/* Date filter */}
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <span className="text-slate-400 text-sm">to</span>
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <button
          onClick={applyFilter}
          className="border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50 transition-colors"
        >
          Filter
        </button>
        {(fromDate || toDate) && (
          <button onClick={clearFilter} className="text-sm text-slate-400 hover:text-slate-700">
            Clear
          </button>
        )}
      </div>

      {listError && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {listError}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {listLoading ? (
          <div className="p-6 text-center text-slate-400 text-sm">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No journal entries found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-20">TRX</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-28">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Description</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600 w-28">Debit</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600 w-28">Credit</th>
                {canWrite && <th className="w-28" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(entry => (
                <tr key={entry.trx_no} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-700">{entry.trx_no}</td>
                  <td className="px-4 py-2.5 text-slate-600">{entry.date}</td>
                  <td className="px-4 py-2.5 text-slate-800 max-w-xs truncate">{entry.description}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">{fmtAmt(entry.total_dr)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">{fmtAmt(entry.total_cr)}</td>
                  {canWrite && (
                    <td className="px-4 py-2.5">
                      {deleteTarget === entry.trx_no ? (
                        <span className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500">Delete?</span>
                          <button
                            onClick={() => handleDelete(entry.trx_no)}
                            disabled={deleteBusy}
                            className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteTarget(null)}
                            className="text-slate-500 hover:text-slate-700"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-3 justify-end">
                          <button
                            onClick={() => openEdit(entry.trx_no)}
                            className="text-slate-500 hover:text-slate-800 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(entry.trx_no)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            Delete
                          </button>
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

      <p className="mt-2 text-xs text-slate-400">
        {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
      </p>
    </div>
  )
}
