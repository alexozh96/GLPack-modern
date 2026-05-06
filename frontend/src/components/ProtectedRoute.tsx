import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
      Loading…
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

export function CompanyRequired({ children }: { children: ReactNode }) {
  const { user, company, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!company) return <Navigate to="/companies" replace />
  return <>{children}</>
}
