import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface LocationState {
  from?: { pathname: string }
}

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const from = state?.from?.pathname ?? '/dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(username, password)
      navigate(from, { replace: true })
    } catch {
      setError('Invalid username or password.')
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

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800">Sign in</h1>
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
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0875e1]/40 focus:border-[#0875e1] transition-colors"
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
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0875e1]/40 focus:border-[#0875e1] transition-colors"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0875e1] hover:bg-[#0667c8] text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
