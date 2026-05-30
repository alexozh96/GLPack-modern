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

  // Force password change before accessing any other page
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}

export function CompanyRequired({ children }: { children: ReactNode }) {
  const { user, company, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.must_change_password) return <Navigate to="/change-password" replace />
  if (!company) return <Navigate to="/companies" replace />
  return <>{children}</>
}

export function PlatformOwnerRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.must_change_password) return <Navigate to="/change-password" replace />
  if (user.platform_role !== 'owner') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/** @deprecated use PlatformOwnerRoute */
export function SystemAdminRoute({ children }: { children: ReactNode }) {
  return <PlatformOwnerRoute>{children}</PlatformOwnerRoute>
}
