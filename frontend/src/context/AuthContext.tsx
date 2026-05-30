import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  login as apiLogin,
  logout as apiLogout,
  me,
  setLogoutHandler,
  selectCompany as apiSelectCompany,
} from '../api/auth'
import type { UserRead, CompanyInfo } from '../api/auth'

interface AuthContextValue {
  user: UserRead | null
  company: CompanyInfo | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<{ mustChangePassword: boolean }>
  signOut: () => Promise<void>
  selectCompany: (company: CompanyInfo) => Promise<void>
  clearCompany: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null)
  const [company, setCompany] = useState<CompanyInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLogoutHandler(() => {
      setUser(null)
      setCompany(null)
      localStorage.removeItem('companyInfo')
    })
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    const stored = localStorage.getItem('companyInfo')
    if (stored) {
      try {
        setCompany(JSON.parse(stored))
      } catch {
        localStorage.removeItem('companyInfo')
      }
    }
    me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('companyInfo')
        setCompany(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function signIn(username: string, password: string): Promise<{ mustChangePassword: boolean }> {
    localStorage.removeItem('companyInfo')
    setCompany(null)
    const { access_token, must_change_password } = await apiLogin({ username, password })
    localStorage.setItem('token', access_token)
    const userData = await me()
    setUser(userData)
    return { mustChangePassword: must_change_password }
  }

  async function signOut() {
    try {
      await apiLogout()
    } catch {
      // ignore
    }
    localStorage.removeItem('token')
    localStorage.removeItem('companyInfo')
    setUser(null)
    setCompany(null)
  }

  async function selectCompany(info: CompanyInfo) {
    const { access_token } = await apiSelectCompany(info.id)
    localStorage.setItem('token', access_token)
    localStorage.setItem('companyInfo', JSON.stringify(info))
    setCompany(info)
  }

  function clearCompany() {
    localStorage.removeItem('companyInfo')
    setCompany(null)
  }

  async function refreshUser() {
    const userData = await me()
    setUser(userData)
  }

  return (
    <AuthContext.Provider value={{ user, company, loading, signIn, signOut, selectCompany, clearCompany, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
