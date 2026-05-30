import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCompanies } from '../api/auth'
import { cls } from '../components/ui'

export function Login() {
  const { signIn, selectCompany } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    let mustChangePassword = false
    try {
      const result = await signIn(username, password)
      mustChangePassword = result.mustChangePassword
    } catch {
      setError('Invalid username or password.')
      setLoading(false)
      return
    }
    if (mustChangePassword) {
      navigate('/change-password', { replace: true })
      return
    }
    try {
      const companies = await getCompanies()
      if (companies.length === 0) {
        setError('Your account has no company access. Contact your administrator.')
        setLoading(false)
        return
      }
      if (companies.length === 1) {
        await selectCompany(companies[0])
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/companies', { replace: true })
      }
    } catch {
      setError('Failed to load companies. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#f4f6f8]">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-96 bg-[#0f2137] flex-col justify-between p-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0875e1] flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-base">GL</span>
          </div>
          <div>
            <div className="text-white font-semibold text-base leading-tight">GLPack Modern</div>
            <div className="text-white/35 text-xs mt-0.5">Financial System</div>
          </div>
        </div>

        <div>
          <p className="text-white/80 text-2xl font-semibold leading-snug">
            Your general ledger,<br />modernised.
          </p>
          <p className="text-white/40 text-sm mt-3 leading-relaxed">
            Journal entries, financial statements, bank reconciliation — all in one place.
          </p>
        </div>

        <p className="text-white/20 text-xs">GLPack Modern &copy; {new Date().getFullYear()}</p>
      </div>

      {/* Right panel — sign-in form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
            <div className="mb-7">
              <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
              <p className="text-slate-500 text-sm mt-1">Enter your credentials to continue.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className={`w-full ${cls.input}`}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`w-full ${cls.input}`}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && <div className={cls.alertError}>{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className={`w-full ${cls.btnPrimary} h-10`}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
