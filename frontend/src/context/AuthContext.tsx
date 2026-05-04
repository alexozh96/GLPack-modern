import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { login as apiLogin, logout as apiLogout, me, setLogoutHandler } from '../api/auth'
import type { UserRead } from '../api/auth'

interface AuthContextValue {
  user: UserRead | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLogoutHandler(() => setUser(null))
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    me()
      .then(setUser)
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  async function signIn(username: string, password: string) {
    const { access_token } = await apiLogin({ username, password })
    localStorage.setItem('token', access_token)
    const userData = await me()
    setUser(userData)
  }

  async function signOut() {
    try {
      await apiLogout()
    } catch {
      // ignore errors on logout
    }
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
