import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { listAccounts, createAccount, updateAccount, deleteAccount } from '../api/accounts'
import type { Account } from '../api/accounts'

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
    setFormCode('')
    setFormName('')
    setFormError(null)
    setModal({ mode: 'create' })
  }

  function openEdit(account: Account) {
    setFormCode(account.code)
    setFormName(account.name)
    setFormError(null)
    setModal({ mode: 'edit', account })
  }

  function closeModal() {
    setModal(null)
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormBusy(true)
    try {
      if (modal?.mode === 'create') {
        const created = await createAccount(formCode, formName)
        setAccounts((prev) => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)))
      } else if (modal?.mode === 'edit' && modal.account) {
        const updated = await updateAccount(modal.account.code, formName)
        setAccounts((prev) => prev.map((a) => (a.code === updated.code ? updated : a)))
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
      setAccounts((prev) => prev.filter((a) => a.code !== account.code))
      setDeleteTarget(null)
    } catch (err) {
      // show error inline by keeping the delete target and surfacing a message
      setDeleteTarget(null)
      setLoadError(apiErrorMessage(err))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Chart of Accounts</h2>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            + New Account
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search code or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <select
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          {PREFIX_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Error banner */}
      {loadError && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {loadError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No accounts found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-24">Code</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Name</th>
                {isAdmin && <th className="w-28" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((account) => (
                <tr key={account.code} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-700">{account.code}</td>
                  <td className="px-4 py-2.5 text-slate-800">{account.name}</td>
                  {isAdmin && (
                    <td className="px-4 py-2.5">
                      {deleteTarget?.code === account.code ? (
                        <span className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500">Delete?</span>
                          <button
                            onClick={() => handleDelete(account)}
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
                            onClick={() => openEdit(account)}
                            className="text-slate-500 hover:text-slate-800 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(account)}
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

      <p className="mt-2 text-xs text-slate-400">{filtered.length} account{filtered.length !== 1 ? 's' : ''}</p>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm space-y-5">
            <h3 className="text-lg font-semibold text-slate-800">
              {modal.mode === 'create' ? 'New Account' : 'Edit Account'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Code <span className="text-slate-400 font-normal">(1–4 chars)</span>
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase().slice(0, 4))}
                  disabled={modal.mode === 'edit'}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-100 disabled:text-slate-500"
                  required
                  autoFocus={modal.mode === 'create'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name <span className="text-slate-400 font-normal">(max 30 chars)</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value.slice(0, 30))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  required
                  autoFocus={modal.mode === 'edit'}
                />
              </div>
              {formError && (
                <p className="text-red-500 text-sm">{formError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={formBusy}
                  className="flex-1 bg-slate-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {formBusy ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-slate-300 text-slate-700 rounded-lg py-2 text-sm hover:bg-slate-50 transition-colors"
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
