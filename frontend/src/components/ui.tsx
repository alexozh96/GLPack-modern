import { useState } from 'react'
import type { ReactNode } from 'react'

// ─── Shared class constants ───────────────────────────────────────────────────
// All interactive controls use h-10 (40 px) so they align on the same baseline.

export const cls = {
  // Typography
  pageTitle: 'text-2xl font-semibold text-slate-900',
  pageSub:   'text-sm text-slate-500 mt-0.5',

  // Cards
  card:      'bg-white border border-slate-200 rounded-xl shadow-sm',
  cardTitle: 'text-sm font-semibold text-slate-700',

  // Form controls — fixed 40 px height for visual consistency
  input:
    'h-10 px-3 rounded-lg border border-slate-300 bg-white ' +
    'text-sm text-slate-900 placeholder-slate-400 ' +
    'focus:outline-none focus:border-[#0875e1] focus:ring-2 focus:ring-[#0875e1]/25 ' +
    'disabled:bg-slate-50 disabled:text-slate-400 transition-colors',

  select:
    'h-10 px-3 rounded-lg border border-slate-300 bg-white ' +
    'text-sm text-slate-900 ' +
    'focus:outline-none focus:border-[#0875e1] focus:ring-2 focus:ring-[#0875e1]/25 ' +
    'disabled:bg-slate-50 transition-colors',

  // Buttons — all h-10
  btnPrimary:
    'inline-flex items-center justify-center h-10 px-4 rounded-lg ' +
    'text-sm font-medium bg-[#0875e1] text-white shadow-sm ' +
    'hover:bg-[#0667c8] disabled:opacity-50 disabled:cursor-not-allowed ' +
    'transition-colors whitespace-nowrap',

  btnSecondary:
    'inline-flex items-center justify-center h-10 px-4 rounded-lg ' +
    'text-sm font-medium bg-white border border-slate-300 text-slate-700 ' +
    'hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed ' +
    'transition-colors whitespace-nowrap',

  btnDanger:
    'inline-flex items-center justify-center h-10 px-4 rounded-lg ' +
    'text-sm font-medium bg-red-700 text-white ' +
    'hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed ' +
    'transition-colors whitespace-nowrap',

  // Table atoms
  th:      'px-5 py-3 text-left  text-xs font-semibold text-slate-500 uppercase tracking-wide',
  thRight: 'px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide',
  td:      'px-5 py-3.5 text-sm text-slate-700',
  tdMono:  'px-5 py-3.5 text-sm font-mono text-slate-700',
  tdRight: 'px-5 py-3.5 text-sm text-right font-mono text-slate-700',

  // Feedback
  alertError:   'px-4 py-3 bg-red-50   border border-red-200   text-red-700   text-sm rounded-lg',
  alertWarning: 'px-4 py-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg',
  alertSuccess: 'px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg',
}

// ─── Structural components ────────────────────────────────────────────────────

export function PageHeader({
  title, sub, children,
}: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className={cls.pageTitle}>{title}</h1>
        {sub && <p className={cls.pageSub}>{sub}</p>}
      </div>
      {children && <div className="flex items-center gap-3 shrink-0">{children}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${cls.card}${className ? ' ' + className : ''}`}>{children}</div>
  )
}

export function CardHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
      <h3 className={cls.cardTitle}>{title}</h3>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="py-14 text-center text-slate-400 text-sm">{message}</div>
}

// ─── Sortable table header ────────────────────────────────────────────────────

export type SortDir = 'asc' | 'desc' | null

export function SortHeader({
  label, col, sortKey, sortDir, onSort, className = '', right = false,
}: {
  label: string
  col: string
  sortKey: string | null
  sortDir: SortDir
  onSort: (col: string) => void
  className?: string
  right?: boolean
}) {
  const active = sortKey === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`${right ? cls.thRight : cls.th} cursor-pointer select-none hover:text-slate-700 ${className}`}
    >
      <span className={`inline-flex items-center gap-1 ${right ? 'justify-end w-full' : ''}`}>
        <span className={active ? 'text-[#0875e1]' : ''}>{label}</span>
        <span className={`text-[9px] leading-none ${active ? 'text-[#0875e1]' : 'text-slate-300'}`}>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  )
}

export function useSortState(defaultKey: string | null = null, defaultDir: SortDir = null) {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  function handleSort(col: string) {
    if (sortKey === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir(null) }
    } else {
      setSortKey(col)
      setSortDir('asc')
    }
  }

  return { sortKey, sortDir, handleSort }
}
