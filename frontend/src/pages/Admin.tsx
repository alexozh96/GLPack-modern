import { useState, useEffect } from 'react'
import {
  UserPlus,
  Pencil,
  X,
  Check,
  KeyRound,
  ShieldCheck,
  Building2,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { listUsers, createUser, updateUser, deactivateUser, reactivateUser } from '../api/users'
import {
  listCompanies,
  createCompany,
  deactivateCompany,
  reactivateCompany,
  getCompanyUsers,
  assignUser,
  updateUserAccess,
  removeUser,
} from '../api/companies'
import type { CompanyRead, UserCompanyAccessRead } from '../api/companies'
import type { UserRead } from '../api/auth'
// UserRead used for users list display
import { useAuth } from '../context/AuthContext'
import { PageHeader, cls } from '../components/ui'
import { useToast } from '../context/ToastContext'

const ROLE_LABELS: Record<string, string> = { owner: 'Platform Owner', staff: 'Support Staff', user: 'Standard User' }

// ── User tab: inline edit row ─────────────────────────────────────────────────

interface EditState {
  username: string
  platform_role: string
  password: string
}

function EditRow({
  user,
  onSave,
  onCancel,
}: {
  user: UserRead
  onSave: (id: number, data: EditState) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<EditState>({
    username: user.username,
    platform_role: user.platform_role,
    password: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(user.id, form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2 text-slate-400 text-sm">{user.id}</td>
      <td className="px-4 py-2">
        <input
          className={`${cls.input} py-1 text-sm`}
          value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          maxLength={20}
        />
      </td>
      <td className="px-4 py-2">
        <select
          className={`${cls.input} py-1 text-sm`}
          value={form.platform_role}
          onChange={e => setForm(f => ({ ...f, platform_role: e.target.value }))}
        >
          <option value="user">Standard User</option>
          <option value="staff">Support Staff</option>
          <option value="owner">Platform Owner</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          type="password"
          className={`${cls.input} py-1 text-sm`}
          placeholder="Leave blank to keep"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
        />
      </td>
      <td className="px-4 py-2 text-center">
        <span className="text-slate-400 text-xs">—</span>
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1 rounded bg-[#0875e1] text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="w-3 h-3" /> Save
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1 rounded bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── User tab: create form ─────────────────────────────────────────────────────

function CreateUserForm({ onCreate }: { onCreate: (u: UserRead) => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', platform_role: 'user' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const user = await createUser(form)
      onCreate(user)
      setForm({ username: '', password: '', platform_role: 'user' })
      setOpen(false)
      toast.success(`User "${user.username}" created`)
    } catch (ex: unknown) {
      const msg = (ex as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create user'
      setErr(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0875e1] text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        New User
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm w-full max-w-md">
      <div className="text-sm font-semibold text-slate-800 mb-4">Create User</div>
      {err && <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Username</label>
          <input required maxLength={20} className={cls.input} value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
          <input required type="password" minLength={6} className={cls.input} value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Platform Role</label>
          <select className={cls.input} value={form.platform_role}
            onChange={e => setForm(f => ({ ...f, platform_role: e.target.value }))}>
            <option value="user">Standard User</option>
            <option value="staff">Support Staff</option>
            <option value="owner">Platform Owner</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#0875e1] text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setErr(null) }}
          className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Companies tab: company users panel ───────────────────────────────────────

function CompanyUsersPanel({ company }: { company: CompanyRead }) {
  const toast = useToast()
  const [members, setMembers] = useState<UserCompanyAccessRead[]>([])
  const [loading, setLoading] = useState(true)
  const [addForm, setAddForm] = useState({ username: '', access_level: 1 })
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCompanyUsers(company.id)
      .then(setMembers)
      .catch(() => toast.error('Failed to load company users'))
      .finally(() => setLoading(false))
  }, [company.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.username.trim()) return
    setSaving(true)
    try {
      await assignUser(company.id, { username: addForm.username.trim(), access_level: addForm.access_level })
      const updated = await getCompanyUsers(company.id)
      setMembers(updated)
      setAddForm({ username: '', access_level: 1 })
      setAddOpen(false)
      toast.success('User assigned')
    } catch {
      toast.error('Failed to assign user')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangeLevel(userId: number, level: number) {
    try {
      await updateUserAccess(company.id, userId, level)
      setMembers(ms => ms.map(m => m.user_id === userId ? { ...m, access_level: level } : m))
    } catch {
      toast.error('Failed to update access level')
    }
  }

  async function handleRemove(userId: number, username: string) {
    try {
      await removeUser(company.id, userId)
      setMembers(ms => ms.filter(m => m.user_id !== userId))
      toast.success(`Removed ${username} from company`)
    } catch {
      toast.error('Failed to remove user')
    }
  }

  if (loading) return <div className="px-5 py-4 text-sm text-slate-400">Loading…</div>

  return (
    <div className="bg-slate-50 border-t border-slate-200 px-6 py-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Users with access
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-slate-400 mb-3">No users assigned yet.</p>
      ) : (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-xs font-medium text-slate-400">
              <th className="text-left pb-2 pr-4">Username</th>
              <th className="text-left pb-2 pr-4">Access Level</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map(m => (
              <tr key={m.user_id}>
                <td className="py-2 pr-4 text-slate-800 font-medium">{m.username}</td>
                <td className="py-2 pr-4">
                  <select
                    className="h-8 px-2 rounded border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:border-[#0875e1]"
                    value={m.access_level}
                    onChange={e => handleChangeLevel(m.user_id, Number(e.target.value))}
                  >
                    <option value={1}>Read Only</option>
                    <option value={3}>Bookkeeper</option>
                    <option value={4}>Accountant</option>
                    <option value={6}>Admin</option>
                  </select>
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleRemove(m.user_id, m.username)}
                    className="text-red-400 hover:text-red-600 transition-colors p-1"
                    title="Remove user"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {addOpen ? (
        <form onSubmit={handleAssign} className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Username</label>
            <input
              required
              type="text"
              placeholder="Enter username…"
              className="h-8 px-2 rounded border border-slate-300 text-xs text-slate-700 bg-white focus:outline-none focus:border-[#0875e1] w-36"
              value={addForm.username}
              onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Level</label>
            <select
              className="h-8 px-2 rounded border border-slate-300 text-xs text-slate-700 bg-white focus:outline-none focus:border-[#0875e1]"
              value={addForm.access_level}
              onChange={e => setAddForm(f => ({ ...f, access_level: Number(e.target.value) }))}
            >
              <option value={1}>Read Only</option>
              <option value={3}>Bookkeeper</option>
              <option value={4}>Accountant</option>
              <option value={6}>Admin</option>
            </select>
          </div>
          <button type="submit" disabled={saving || !addForm.username.trim()}
            className="h-8 px-3 rounded bg-[#0875e1] text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Assigning…' : 'Add'}
          </button>
          <button type="button" onClick={() => setAddOpen(false)}
            className="h-8 px-3 rounded bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300">
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1 text-xs text-[#0875e1] font-medium hover:underline"
        >
          <Plus className="w-3 h-3" />
          Add user
        </button>
      )}
    </div>
  )
}

// ── Companies tab: create company form ────────────────────────────────────────

function CreateCompanyForm({ onCreate }: { onCreate: (c: CompanyRead) => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', currency: 'SGD', financial_year_end: '12-31' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const company = await createCompany(form)
      onCreate(company)
      setForm({ name: '', currency: 'SGD', financial_year_end: '12-31' })
      setOpen(false)
      toast.success(`Company "${company.name}" created`)
    } catch (ex: unknown) {
      const msg = (ex as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create company'
      setErr(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0875e1] text-white text-sm font-medium hover:bg-blue-700 transition-colors">
        <Building2 className="w-4 h-4" />
        New Company
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm w-full max-w-md">
      <div className="text-sm font-semibold text-slate-800 mb-4">Create Company</div>
      {err && <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Company Name</label>
          <input required maxLength={100} className={cls.input} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Currency</label>
            <input maxLength={10} className={cls.input} value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">FY End (MM-DD)</label>
            <input maxLength={5} placeholder="12-31" className={cls.input} value={form.financial_year_end}
              onChange={e => setForm(f => ({ ...f, financial_year_end: e.target.value }))} />
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#0875e1] text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setErr(null) }}
          className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Companies tab ─────────────────────────────────────────────────────────────

function CompaniesTab() {
  const toast = useToast()
  const [companies, setCompanies] = useState<CompanyRead[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    listCompanies()
      .then(setCompanies)
      .catch(() => setErr('Failed to load companies'))
      .finally(() => setLoading(false))
  }, [])

  async function handleToggleActive(company: CompanyRead) {
    try {
      const updated = company.is_active
        ? await deactivateCompany(company.id)
        : await reactivateCompany(company.id)
      setCompanies(cs => cs.map(c => c.id === company.id ? updated : c))
      toast.success(`Company "${company.name}" ${updated.is_active ? 'reactivated' : 'deactivated'}`)
    } catch {
      toast.error('Action failed')
    }
  }

  if (loading) return <div className="text-slate-400 text-sm py-10 text-center">Loading…</div>
  if (err) return <div className="text-red-500 text-sm py-10 text-center">{err}</div>

  return (
    <div className="space-y-6">
      <CreateCompanyForm onCreate={c => setCompanies(prev => [...prev, c])} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3 text-left w-8"></th>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Currency</th>
              <th className="px-4 py-3 text-left">FY End</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(company => (
              <>
                <tr
                  key={company.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${!company.is_active ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setExpandedId(expandedId === company.id ? null : company.id)}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                      title="Manage users"
                    >
                      {expandedId === company.id
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{company.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{company.name}</td>
                  <td className="px-4 py-3 text-slate-600">{company.currency}</td>
                  <td className="px-4 py-3 text-slate-600">{company.financial_year_end}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      company.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {company.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setExpandedId(expandedId === company.id ? null : company.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors"
                      >
                        Manage Users
                      </button>
                      <button
                        onClick={() => handleToggleActive(company)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                          company.is_active
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        {company.is_active
                          ? <><X className="w-3 h-3" /> Deactivate</>
                          : <><Check className="w-3 h-3" /> Reactivate</>
                        }
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === company.id && (
                  <tr key={`${company.id}-panel`}>
                    <td colSpan={7} className="p-0">
                      <CompanyUsersPanel company={company} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {companies.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">No companies found</div>
        )}
      </div>
    </div>
  )
}

// ── Main Admin page ───────────────────────────────────────────────────────────

export function Admin() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'users' | 'companies'>('users')
  const [users, setUsers] = useState<UserRead[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => setErr('Failed to load users'))
      .finally(() => setUsersLoading(false))
  }, [])

  async function handleSave(id: number, data: EditState) {
    const payload: { username?: string; password?: string; platform_role?: string } = {
      username: data.username,
      platform_role: data.platform_role,
    }
    if (data.password) payload.password = data.password
    try {
      const updated = await updateUser(id, payload)
      setUsers(us => us.map(u => u.id === id ? updated : u))
      setEditingId(null)
      toast.success('User updated')
    } catch (ex: unknown) {
      const msg = (ex as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Update failed'
      toast.error(msg)
    }
  }

  async function handleToggleActive(user: UserRead) {
    try {
      const updated = user.is_active
        ? await deactivateUser(user.id)
        : await reactivateUser(user.id)
      setUsers(us => us.map(u => u.id === user.id ? updated : u))
      toast.success(`User "${user.username}" ${updated.is_active ? 'reactivated' : 'deactivated'}`)
    } catch (ex: unknown) {
      const msg = (ex as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Action failed'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Administration" sub="Manage users and company accounts" />

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['users', 'companies'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[#0875e1] text-[#0875e1]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'users' ? 'Users' : 'Companies'}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <>
          {usersLoading ? (
            <div className="text-slate-400 text-sm py-10 text-center">Loading…</div>
          ) : err ? (
            <div className="text-red-500 text-sm py-10 text-center">{err}</div>
          ) : (
            <>
              <CreateUserForm onCreate={u => setUsers(prev => [...prev, u])} />

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">ID</th>
                      <th className="px-4 py-3 text-left">Username</th>
                      <th className="px-4 py-3 text-left">Access</th>
                      <th className="px-4 py-3 text-left">New Password</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map(user =>
                      editingId === user.id ? (
                        <EditRow
                          key={user.id}
                          user={user}
                          onSave={handleSave}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${!user.is_active ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3 text-slate-400">{user.id}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            <div className="flex items-center gap-2">
                              {user.username}
                              {user.platform_role === 'owner' && (
                                <span title="Platform Owner" className="text-[#0875e1]">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </span>
                              )}
                              {user.must_change_password && (
                                <span title="Must change password" className="text-amber-500 text-xs font-medium">⚠</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[user.platform_role] ?? user.platform_role}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            <span className="flex items-center gap-1"><KeyRound className="w-3 h-3" /> ••••••</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              user.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => setEditingId(user.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors">
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              {user.id !== me?.id && user.platform_role !== 'owner' && (
                                <button
                                  onClick={() => handleToggleActive(user)}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                    user.is_active
                                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                                  }`}
                                >
                                  {user.is_active ? <><X className="w-3 h-3" /> Deactivate</> : <><Check className="w-3 h-3" /> Reactivate</>}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">No users found</div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'companies' && (
        <CompaniesTab />
      )}
    </div>
  )
}
