import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '../api/auth'
import { getCompanies } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { cls } from '../components/ui'

export function ChangePassword() {
  const { refreshUser, selectCompany } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      await refreshUser()
      // Navigate to company selection after successful password change
      try {
        const companies = await getCompanies()
        if (companies.length === 1) {
          await selectCompany(companies[0])
          navigate('/dashboard', { replace: true })
        } else {
          navigate('/companies', { replace: true })
        }
      } catch {
        navigate('/companies', { replace: true })
      }
    } catch (ex: unknown) {
      const detail = (ex as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to change password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <div className="mb-7">
            <h1 className="text-2xl font-semibold text-slate-900">Change password</h1>
            <p className="text-slate-500 text-sm mt-1">
              A new password is required before you can continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Current password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className={`w-full ${cls.input}`}
                required
                autoFocus
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className={`w-full ${cls.input}`}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-slate-400 mt-1">Min 8 characters, at least one letter and one digit.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={`w-full ${cls.input}`}
                required
                autoComplete="new-password"
              />
            </div>

            {error && <div className={cls.alertError}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full ${cls.btnPrimary} h-10`}
            >
              {loading ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
