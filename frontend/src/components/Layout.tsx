import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { GlobalSearch } from './GlobalSearch'
import {
  LayoutDashboard,
  BookOpen,
  ScrollText,
  Landmark,
  BarChart2,
  CreditCard,
  Settings,
  ChevronRight,
  LogOut,
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Financials',
    items: [
      { to: '/dashboard',  label: 'Dashboard',         Icon: LayoutDashboard },
      { to: '/journal',    label: 'Journal Entry',      Icon: BookOpen        },
      { to: '/ledger',     label: 'Ledger View',        Icon: ScrollText      },
    ],
  },
  {
    label: 'Reference',
    items: [
      { to: '/accounts',            label: 'Chart of Accounts',   Icon: Landmark  },
      { to: '/reports',             label: 'Reports',              Icon: BarChart2 },
      { to: '/bank-reconciliation', label: 'Bank Reconciliation',  Icon: CreditCard },
      { to: '/settings',            label: 'Settings',             Icon: Settings  },
    ],
  },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/accounts':            'Chart of Accounts',
  '/journal':             'Journal Entry',
  '/ledger':              'Ledger View',
  '/reports':             'Reports',
  '/bank-reconciliation': 'Bank Reconciliation',
  '/settings':            'Settings',
}

function UserAvatar({ username }: { username: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-[#0875e1] flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
      {username.slice(0, 2).toUpperCase()}
    </div>
  )
}

function RoleLabel(level: number) {
  if (level >= 6) return 'Administrator'
  if (level >= 3) return 'Bookkeeper'
  return 'Read Only'
}

export function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'GLPack Modern'

  return (
    <div className="flex h-screen bg-slate-50">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-64 bg-[#0f2137] flex flex-col shrink-0 shadow-[2px_0_8px_rgba(0,0,0,0.25)]">

        {/* App logo / name */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0875e1] flex items-center justify-center shrink-0 shadow-md">
              <span className="text-white font-bold text-sm tracking-tight">GL</span>
            </div>
            <div>
              <div className="text-white font-semibold text-sm leading-tight">GLPack Modern</div>
              <div className="text-white/35 text-xs mt-0.5">Financial System</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-5 overflow-y-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mb-6">
              <div className="px-5 mb-2 text-[10px] font-semibold text-white/30 uppercase tracking-[0.12em]">
                {group.label}
              </div>
              <div className="space-y-0.5 px-3">
                {group.items.map(({ to, label, Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                        isActive
                          ? 'bg-[#0875e1] text-white font-medium shadow-sm'
                          : 'text-white/55 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User info */}
        {user && (
          <div className="px-4 py-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <UserAvatar username={user.username} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{user.username}</div>
                <div className="text-xs text-white/35 mt-0.5">{RoleLabel(user.access_level)}</div>
              </div>
              <button
                onClick={signOut}
                title="Sign out"
                className="text-white/30 hover:text-white/80 transition-colors p-1 rounded"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top header bar */}
        <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 font-medium">GLPack</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-800 font-semibold">{pageTitle}</span>
          </div>
          <GlobalSearch />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
