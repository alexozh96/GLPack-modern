import { useState, useEffect, useMemo, useRef } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  listAccounts, createAccount, updateAccount, deleteAccount,
  importAccountsCsv, exportAccountsCsv, bulkDeleteAccounts,
} from '../api/accounts'
import type { Account } from '../api/accounts'
import { PageHeader, cls } from '../components/ui'

const PREFIX_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: '1', label: '1 — Assets' },
  { value: '2', label: '2 — Liabilities' },
  { value: '3', label: '3 — Equity' },
  { value: '4', label: '4 — Revenue' },
  { value: '5', label: '5 — Expenses' },
]

interface ModalState { mode: 'create' | 'edit'; account?: Account }

interface ImportPreview {
  file: File
  headers: string[]
  rows: string[][]
  total: number
}

function apiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: { detail?: string } } }).response
    if (res?.data?.detail) return res.data.detail
  }
  return 'An unexpected error occurred.'
}

function parseCsvPreview(text: string): { headers: string[]; rows: string[][]; total: number } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 1) return { headers: [], rows: [], total: 0 }
  const parse = (s: string) => s.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
  const headers = parse(lines[0])
  const data = lines.slice(1).map(parse)
  return { headers, rows: data.slice(0, 5), total: data.length }
}

export function Accounts() {
  const { user } = useAuth()
  const isAdmin = (user?.access_level ?? 0) >= 6

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [prefix, setPrefix] = useState('')

  const [modal, setModal] = useState<ModalState | null>(null)
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  // multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false)

  // import
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // export
  const [exportBusy, setExportBusy] = useState(false)

  function load() {
    setLoading(true)
    setLoadError(null)
    listAccounts()
      .then(data => { setAccounts(data); setSelected(new Set()) })
      .catch(() => setLoadError('Failed to load accounts.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    const p = prefix.toUpperCase()
    return accounts.filter(a => {
      const matchSearch = !s || a.code.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)
      const matchPrefix = !p || a.code.startsWith(p)
      return matchSearch && matchPrefix
    })
  }, [accounts, search, prefix])

  const allSelected = filtered.length > 0 && filtered.every(a => selected.has(a.code))

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(a => a.code)))
    }
  }

  function toggleSelect(code: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  function openCreate() {
    setFormCode(''); setFormName(''); setFormError(null)
    setModal({ mode: 'create' })
  }

  function openEdit(account: Account) {
    setFormCode(account.code); setFormName(account.name); setFormError(null)
    setModal({ mode: 'edit', account })
  }

  function closeModal() { setModal(null); setFormError(null) }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null); setFormBusy(true)
    try {
      if (modal?.mode === 'create') {
        const created = await createAccount(formCode, formName)
        setAccounts(prev => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)))
      } else if (modal?.mode === 'edit' && modal.account) {
        const updated = await updateAccount(modal.account.code, formName)
        setAccounts(prev => prev.map(a => a.code === updated.code ? updated : a))
      }
      closeModal()
    } catch (err) {
      setFormError(apiErrorMessage(err))
    } finally {
      setFormBusy(false)
    }
  }

  async function handleDelete(account: Account) {
    setDeleteBusy(true)
    try {
      await deleteAccount(account.code)
      setAccounts(prev => prev.filter(a => a.code !== account.code))
      setDeleteTarget(null)
    } catch (err) {
      setDeleteTarget(null)
      setLoadError(apiErrorMessage(err))
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleBulkDelete() {
    setBulkDeleteBusy(true)
    try {
      const result = await bulkDeleteAccounts([...selected])
      setBulkDeleteConfirm(false)
      setSelected(new Set())
      const msg = result.skipped.length > 0
        ? `Deleted ${result.deleted}. Skipped ${result.skipped.length} (in use or not found).`
        : `Deleted ${result.deleted} account${result.deleted !== 1 ? 's' : ''}.`
      setImportResult(msg)
      load()
    } catch (err) {
      setLoadError(apiErrorMessage(err))
      setBulkDeleteConfirm(false)
    } finally {
      setBulkDeleteBusy(false)
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const text = await file.text()
    const { headers, rows, total } = parseCsvPreview(text)
    setImportPreview({ file, headers, rows, total })
  }

  async function handleImportConfirm() {
    if (!importPreview) return
    setImportBusy(true)
    setImportResult(null)
    setLoadError(null)
    try {
      const result = await importAccountsCsv(importPreview.file)
      setImportResult(`Imported ${result.imported}, skipped ${result.skipped}`)
      setImportPreview(null)
      load()
    } catch (err) {
      setLoadError(apiErrorMessage(err))
      setImportPreview(null)
    } finally {
      setImportBusy(false)
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    setExportBusy(true)
    try {
      await exportAccountsCsv(search || undefined, prefix || undefined)
    } catch {
      setLoadError('Export failed.')
    } finally {
      setExportBusy(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <PageHeader
        title="Chart of Accounts"
        sub={`${accounts.length} accounts total`}
      >
        <>
          {isAdmin && selected.size > 0 && (
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Delete {selected.size} selected
            </button>
          )}
          <button onClick={handleExport} disabled={exportBusy} className={cls.btnSecondary}>
            {exportBusy ? 'Exporting…' : 'Export CSV'}
          </button>
          {isAdmin && (
            <>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importBusy}
                className={cls.btnSecondary}
              >
                Import CSV
              </button>
              <button onClick={openCreate} className={cls.btnPrimary}>
                + New Account
              </button>
            </>
          )}
        </>
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search code or name…"
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(new Set()) }}
          className={`${cls.input} w-56`}
        />
        <select
          value={prefix}
          onChange={e => { setPrefix(e.target.value); setSelected(new Set()) }}
          className={cls.select}
        >
          {PREFIX_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {importResult && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-3">
          {importResult}
        </div>
      )}
      {loadError && <div className={cls.alertError}>{loadError}</div>}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No accounts found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {isAdmin && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="accent-[#0875e1] cursor-pointer"
                    />
                  </th>
                )}
                <th className={`${cls.th} w-24`}>Code</th>
                <th className={cls.th}>Name</th>
                {isAdmin && <th className="w-36" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(account => (
                <tr
                  key={account.code}
                  className={`transition-colors ${selected.has(account.code) ? 'bg-[#0875e1]/[0.04]' : 'hover:bg-[#0875e1]/[0.03]'}`}
                >
                  {isAdmin && (
                    <td className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(account.code)}
                        onChange={() => toggleSelect(account.code)}
                        className="accent-[#0875e1] cursor-pointer"
                      />
                    </td>
                  )}
                  <td className={cls.tdMono}>{account.code}</td>
                  <td className={cls.td}>{account.name}</td>
                  {isAdmin && (
                    <td className="px-5 py-3.5 text-right">
                      {deleteTarget?.code === account.code ? (
                        <span className="flex items-center gap-2 text-xs justify-end">
                          <span className="text-slate-500">Delete?</span>
                          <button
                            onClick={() => handleDelete(account)}
                            disabled={deleteBusy}
                            className="text-red-600 hover:text-red-800 font-semibold disabled:opacity-50"
                          >Yes</button>
                          <button
                            onClick={() => setDeleteTarget(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >No</button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-4 justify-end">
                          <button
                            onClick={() => openEdit(account)}
                            className="text-xs text-slate-400 hover:text-[#0875e1] font-medium transition-colors"
                          >Edit</button>
                          <button
                            onClick={() => setDeleteTarget(account)}
                            className="text-xs text-slate-400 hover:text-red-600 font-medium transition-colors"
                          >Delete</button>
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
      <p className="text-xs text-slate-400">
        {filtered.length} account{filtered.length !== 1 ? 's' : ''} shown
        {selected.size > 0 && ` · ${selected.size} selected`}
      </p>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm space-y-5">
            <h3 className="text-lg font-bold text-slate-800">
              {modal.mode === 'create' ? 'New Account' : 'Edit Account'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Code <span className="text-slate-400 font-normal text-xs">(1–4 chars)</span>
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={e => setFormCode(e.target.value.toUpperCase().slice(0, 4))}
                  disabled={modal.mode === 'edit'}
                  className={`w-full ${cls.input} font-mono`}
                  required
                  autoFocus={modal.mode === 'create'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Name <span className="text-slate-400 font-normal text-xs">(max 30 chars)</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value.slice(0, 30))}
                  className={`w-full ${cls.input}`}
                  required
                  autoFocus={modal.mode === 'edit'}
                />
              </div>
              {formError && <div className={cls.alertError}>{formError}</div>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={formBusy} className={`flex-1 ${cls.btnPrimary}`}>
                  {formBusy ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={closeModal} className={`flex-1 ${cls.btnSecondary}`}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Delete {selected.size} account{selected.size !== 1 ? 's' : ''}?
            </h3>
            <p className="text-sm text-slate-600">
              Accounts that are referenced in journal entries will be skipped automatically.
              All others will be permanently removed.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteBusy}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {bulkDeleteBusy ? 'Deleting…' : `Delete ${selected.size}`}
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className={`flex-1 ${cls.btnSecondary}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import preview confirmation */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl space-y-5">
            <h3 className="text-lg font-bold text-slate-800">Confirm Import</h3>
            <div className="text-sm text-slate-600 space-y-1">
              <p>File: <span className="font-mono text-slate-800">{importPreview.file.name}</span></p>
              <p>Rows found: <span className="font-semibold text-slate-800">{importPreview.total}</span></p>
              <p className="text-xs text-slate-400">Accounts with existing codes will be skipped.</p>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-52 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {importPreview.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importPreview.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-1.5 font-mono text-slate-700">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importPreview.total > 5 && (
                <p className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">
                  Showing first 5 of {importPreview.total} rows
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleImportConfirm}
                disabled={importBusy}
                className={`flex-1 ${cls.btnPrimary}`}
              >
                {importBusy ? 'Importing…' : `Import ${importPreview.total} row${importPreview.total !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={() => setImportPreview(null)}
                className={`flex-1 ${cls.btnSecondary}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
