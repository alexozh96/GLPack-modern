import { useState, useEffect, useMemo, useRef } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { listAccounts, createAccount, updateAccount, deleteAccount, importAccountsCsv } from '../api/accounts'
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

interface ModalState {
  mode: 'create' | 'edit'
  account?: Account
}

function apiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: { detail?: string } } }).response
    if (res?.data?.detail) return res.data.detail
  }
  return 'An unexpected error occurred.'
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

  const [importBusy, setImportBusy] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    setLoadError(null)
    listAccounts()
      .then(setAccounts)
      .catch(() => setLoadError('Failed to load accounts.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    const p = prefix.toUpperCase()
    return accounts.filter((a) => {
      const matchSearch = !s || a.code.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)
      const matchPrefix = !p || a.code.startsWith(p)
      return matchSearch && matchPrefix
    })
  }, [accounts, search, prefix])

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
    setFormError(null)
    setFormBusy(true)
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

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportBusy(true)
    setImportResult(null)
    setLoadError(null)
    try {
      const result = await importAccountsCsv(file)
      setImportResult(`Imported ${result.imported}, skipped ${result.skipped}`)
      load()
    } catch (err) {
      setLoadError(apiErrorMessage(err))
    } finally {
      setImportBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Chart of Accounts"
        sub={`${accounts.length} accounts total`}
      >
        {isAdmin && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
              className={cls.btnSecondary}
            >
              {importBusy ? 'Importing…' : 'Import CSV'}
            </button>
            <button onClick={openCreate} className={cls.btnPrimary}>
              + New Account
            </button>
          </>
        )}
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search code or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${cls.input} w-56`}
        />
        <select
          value={prefix}
          onChange={e => setPrefix(e.target.value)}
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
                <th className={`${cls.th} w-24`}>Code</th>
                <th className={cls.th}>Name</th>
                {isAdmin && <th className="w-32" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(account => (
                <tr key={account.code} className="hover:bg-[#0875e1]/[0.03] transition-colors">
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
      <p className="text-xs text-slate-400">{filtered.length} account{filtered.length !== 1 ? 's' : ''} shown</p>

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
                <button
                  type="submit"
                  disabled={formBusy}
                  className={`flex-1 ${cls.btnPrimary}`}
                >
                  {formBusy ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className={`flex-1 ${cls.btnSecondary}`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
