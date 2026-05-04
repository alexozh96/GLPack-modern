import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/accounts', label: 'Chart of Accounts' },
  { to: '/journal', label: 'Journal Entry' },
  { to: '/ledger', label: 'Ledger View' },
  { to: '/reports', label: 'Reports' },
  { to: '/bank-reconciliation', label: 'Bank Reconciliation' },
  { to: '/settings', label: 'Settings' },
]

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="w-56 bg-slate-800 text-white flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-slate-700">
          <span className="text-lg font-bold tracking-tight">GLPack</span>
          <span className="text-slate-400 text-xs block">Modern</span>
        </div>
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm rounded mx-2 transition-colors ${
                  isActive
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <span className="text-slate-400 text-sm">General Ledger Accounting System</span>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-700 font-medium">{user.username}</span>
              <button
                onClick={signOut}
                className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
