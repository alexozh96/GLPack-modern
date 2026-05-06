import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCompanies } from '../api/auth'
import type { CompanyInfo } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { Building2 } from 'lucide-react'

function levelLabel(level: number) {
  if (level >= 6) return 'Admin'
  if (level >= 3) return 'Bookkeeper'
  return 'Read Only'
}

export function CompanySelect() {
  const { selectCompany } = useAuth()
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function handleSelect(company: CompanyInfo) {
    setSelecting(company.id)
    try {
      await selectCompany(company)
      navigate('/dashboard', { replace: true })
    } catch {
      setErr('Failed to select company. Please try again.')
      setSelecting(null)
    }
  }

  useEffect(() => {
    getCompanies()
      .then(async list => {
        if (list.length === 1) {
          await handleSelect(list[0])
        } else {
          setCompanies(list)
          setLoading(false)
        }
      })
      .catch(() => {
        setErr('Failed to load companies.')
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-[#f4f6f8] items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">

        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-[#0875e1] flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-base">GL</span>
          </div>
          <div>
            <div className="text-slate-900 font-semibold text-base leading-tight">GLPack Modern</div>
            <div className="text-slate-400 text-xs mt-0.5">Select a company to continue</div>
          </div>
        </div>

        {err && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {err}
          </div>
        )}

        {companies.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 text-sm font-medium">No companies available</p>
            <p className="text-slate-400 text-sm mt-1">Contact your administrator to get access.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {companies.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                disabled={selecting !== null}
                className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-[#0875e1] hover:shadow-md text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#0875e1]/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-[#0875e1]" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{c.name}</div>
                      <div className="text-slate-400 text-xs mt-0.5">
                        {c.currency} · {levelLabel(c.access_level)}
                      </div>
                    </div>
                  </div>
                  {selecting === c.id ? (
                    <span className="text-xs text-[#0875e1] font-medium shrink-0">Selecting…</span>
                  ) : (
                    <span className="text-xs text-slate-300 group-hover:text-[#0875e1] font-medium shrink-0 transition-colors">
                      Select →
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
