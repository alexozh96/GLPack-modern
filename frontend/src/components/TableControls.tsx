import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SortDir = 'asc' | 'desc' | null

export type FilterValue =
  | { kind: 'text';   q: string }
  | { kind: 'date';   from: string; to: string }
  | { kind: 'number'; min: string;  max: string }

export type FiltersState = Record<string, FilterValue>

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTableControls() {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [filters, setFilters] = useState<FiltersState>({})

  function setSort(col: string, dir: 'asc' | 'desc') { setSortKey(col); setSortDir(dir) }
  function clearSort() { setSortKey(null); setSortDir(null) }

  function setFilter(col: string, value: FilterValue) {
    setFilters(prev => ({ ...prev, [col]: value }))
  }
  function clearFilter(col: string) {
    setFilters(prev => { const n = { ...prev }; delete n[col]; return n })
  }

  const activeCount =
    (sortKey ? 1 : 0) +
    Object.values(filters).filter(f =>
      f.kind === 'text'   ? !!f.q :
      f.kind === 'date'   ? !!(f.from || f.to) :
                            !!(f.min  || f.max)
    ).length

  return { sortKey, sortDir, filters, setSort, clearSort, setFilter, clearFilter, activeCount }
}

// ── Data helper ───────────────────────────────────────────────────────────────

export function applyTableControls<T>(
  rows: T[],
  sortKey: string | null,
  sortDir: SortDir,
  filters: FiltersState,
  getValue: (row: T, col: string) => string | number,
): T[] {
  let result = rows

  if (Object.keys(filters).length > 0) {
    result = result.filter(row => {
      for (const [col, f] of Object.entries(filters)) {
        const v = getValue(row, col)
        if (f.kind === 'text') {
          if (f.q && !String(v).toLowerCase().includes(f.q.toLowerCase())) return false
        } else if (f.kind === 'date') {
          const s = String(v)
          if (f.from && s < f.from) return false
          if (f.to   && s > f.to)   return false
        } else {
          const n = parseFloat(String(v)) || 0
          if (f.min !== '' && n < parseFloat(f.min)) return false
          if (f.max !== '' && n > parseFloat(f.max)) return false
        }
      }
      return true
    })
  }

  if (sortKey && sortDir) {
    result = [...result].sort((a, b) => {
      const av = getValue(a, sortKey)
      const bv = getValue(b, sortKey)
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  return result
}

// ── ColumnHeader ──────────────────────────────────────────────────────────────

const SORT_LABELS: Record<string, [string, string]> = {
  text:   ['A → Z',          'Z → A'],
  date:   ['Oldest first',   'Newest first'],
  number: ['Smallest first', 'Largest first'],
}

interface ColumnHeaderProps {
  label: string
  col: string
  type?: 'text' | 'date' | 'number'
  sortKey: string | null
  sortDir: SortDir
  filters: FiltersState
  onSort: (col: string, dir: 'asc' | 'desc') => void
  onClearSort: () => void
  onSetFilter: (col: string, v: FilterValue) => void
  onClearFilter: (col: string) => void
  className?: string
  right?: boolean
}

export function ColumnHeader({
  label, col, type = 'text',
  sortKey, sortDir, filters,
  onSort, onClearSort, onSetFilter, onClearFilter,
  className = '', right = false,
}: ColumnHeaderProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const thRef   = useRef<HTMLTableCellElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const isActiveSorted = sortKey === col
  const filter = filters[col]
  const hasFilter = !!filter && (
    filter.kind === 'text'   ? !!filter.q :
    filter.kind === 'date'   ? !!(filter.from || filter.to) :
                               !!(filter.min  || filter.max)
  )
  const isActive = isActiveSorted || hasFilter

  function toggle() {
    if (open) { setOpen(false); return }
    if (!thRef.current) return
    const rect = thRef.current.getBoundingClientRect()
    const menuW = 228
    const rawLeft = right ? rect.right - menuW : rect.left
    const left = Math.max(4, Math.min(rawLeft, window.innerWidth - menuW - 4)) + window.scrollX
    setPos({ top: rect.bottom + window.scrollY + 2, left })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (thRef.current?.contains(e.target as Node)) return
      if (menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function doSort(dir: 'asc' | 'desc') { onSort(col, dir); setOpen(false) }

  function doClear() {
    if (isActiveSorted) onClearSort()
    onClearFilter(col)
    setOpen(false)
  }

  const labels = SORT_LABELS[type]

  return (
    <>
      <th
        ref={thRef}
        onClick={toggle}
        className={[
          'px-5 py-3 text-xs font-semibold uppercase tracking-wide',
          'cursor-pointer select-none hover:bg-slate-100 transition-colors',
          right ? 'text-right' : 'text-left',
          isActive ? 'text-[#0875e1]' : 'text-slate-500',
          className,
        ].join(' ')}
      >
        <span className={`inline-flex items-center gap-1 ${right ? 'justify-end w-full' : ''}`}>
          {label}
          {isActiveSorted && <span className="text-[9px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
          {hasFilter      && <span className="w-1.5 h-1.5 rounded-full bg-[#0875e1] shrink-0" />}
          <span className="text-[9px] text-slate-400">▾</span>
        </span>
      </th>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, width: 228, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 space-y-2.5"
        >
          {/* Sort buttons */}
          <div className="flex gap-1.5">
            {(['asc', 'desc'] as const).map((dir, i) => (
              <button
                key={dir}
                onClick={() => doSort(dir)}
                className={[
                  'flex-1 text-xs px-2 py-1.5 rounded-lg border transition-colors leading-snug',
                  isActiveSorted && sortDir === dir
                    ? 'bg-[#0875e1] text-white border-transparent'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {dir === 'asc' ? '↑' : '↓'} {labels[i]}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100" />

          {/* Filter input */}
          <FilterControl type={type} filter={filter} onChange={v => onSetFilter(col, v)} />

          {/* Clear */}
          {isActive && (
            <>
              <div className="border-t border-slate-100" />
              <button
                onClick={doClear}
                className="w-full text-[11px] text-slate-400 hover:text-red-500 transition-colors py-0.5"
              >
                Clear sort &amp; filter
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Filter control ────────────────────────────────────────────────────────────

function FilterControl({ type, filter, onChange }: {
  type: 'text' | 'date' | 'number'
  filter: FilterValue | undefined
  onChange: (v: FilterValue) => void
}) {
  const base = [
    'w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50',
    'text-xs text-slate-900 placeholder-slate-400',
    'focus:outline-none focus:border-[#0875e1] focus:ring-1 focus:ring-[#0875e1]/20',
  ].join(' ')

  if (type === 'text') {
    return (
      <input
        autoFocus
        type="text"
        value={filter?.kind === 'text' ? filter.q : ''}
        onChange={e => onChange({ kind: 'text', q: e.target.value })}
        placeholder="Filter…"
        className={base}
      />
    )
  }

  if (type === 'date') {
    const from = filter?.kind === 'date' ? filter.from : ''
    const to   = filter?.kind === 'date' ? filter.to   : ''
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Date range</p>
        <input type="date" value={from} className={base}
          onChange={e => onChange({ kind: 'date', from: e.target.value, to })} />
        <input type="date" value={to}   className={base}
          onChange={e => onChange({ kind: 'date', from, to: e.target.value })} />
      </div>
    )
  }

  const min = filter?.kind === 'number' ? filter.min : ''
  const max = filter?.kind === 'number' ? filter.max : ''
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Amount range</p>
      <input type="number" value={min} placeholder="Min" className={base}
        onChange={e => onChange({ kind: 'number', min: e.target.value, max })} />
      <input type="number" value={max} placeholder="Max" className={base}
        onChange={e => onChange({ kind: 'number', min, max: e.target.value })} />
    </div>
  )
}
