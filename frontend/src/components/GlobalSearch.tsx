import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { search } from '../api/search'
import type { SearchResult } from '../api/search'

const EMPTY: SearchResult = { accounts: [], phrases: [], journal_entries: [] }

function hasResults(r: SearchResult) {
  return r.accounts.length > 0 || r.phrases.length > 0 || r.journal_entries.length > 0
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>(EMPTY)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Click outside to close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(EMPTY)
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await search(q)
      setResults(res)
      setOpen(true)
    } catch {
      setResults(EMPTY)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => runSearch(q), 300)
  }

  function handleFocus() {
    if (query.length >= 2 && hasResults(results)) setOpen(true)
  }

  function goAccount() {
    setOpen(false)
    setQuery('')
    navigate('/accounts')
  }

  function goJournal(trxNo: string) {
    setOpen(false)
    setQuery('')
    navigate('/journal', { state: { openTrx: trxNo } })
  }

  function goSettings() {
    setOpen(false)
    setQuery('')
    navigate('/settings')
  }

  const total = results.accounts.length + results.phrases.length + results.journal_entries.length

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-64 focus-within:border-[#0875e1]/50 focus-within:ring-2 focus-within:ring-[#0875e1]/10 transition-all">
        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder="Search accounts, entries…"
          className="bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none w-full"
        />
        {loading && <span className="text-xs text-slate-300">…</span>}
        {!loading && <kbd className="text-[10px] text-slate-300 font-mono bg-slate-100 border border-slate-200 rounded px-1 py-0.5 leading-none">⌃K</kbd>}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 max-h-96 overflow-y-auto">
          {!hasResults(results) ? (
            <div className="px-4 py-3 text-sm text-slate-400">No results for "{query}"</div>
          ) : (
            <>
              {results.accounts.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em]">Accounts</div>
                  {results.accounts.map(a => (
                    <button
                      key={a.code}
                      onClick={() => goAccount()}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#0875e1]/5 flex items-center gap-3 transition-colors"
                    >
                      <span className="font-mono text-xs text-slate-400 w-10 shrink-0">{a.code}</span>
                      <span className="text-sm text-slate-700 truncate">{a.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.journal_entries.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em]">Journal Entries</div>
                  {results.journal_entries.map(j => (
                    <button
                      key={j.trx_no}
                      onClick={() => goJournal(j.trx_no)}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#0875e1]/5 flex items-center gap-3 transition-colors"
                    >
                      <span className="font-mono text-xs text-slate-400 w-10 shrink-0">{j.trx_no}</span>
                      <div className="min-w-0">
                        <div className="text-sm text-slate-700 truncate">{j.description}</div>
                        <div className="text-xs text-slate-400">{j.date}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.phrases.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em]">Phrases</div>
                  {results.phrases.map(p => (
                    <button
                      key={p.id}
                      onClick={goSettings}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#0875e1]/5 transition-colors"
                    >
                      <span className="text-sm text-slate-700">{p.phrase}</span>
                      {(p.dr_code || p.cr_code) && (
                        <span className="text-xs text-slate-400 ml-2">
                          {[p.dr_code && `Dr:${p.dr_code}`, p.cr_code && `Cr:${p.cr_code}`].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="px-4 pt-2 pb-1 border-t border-slate-100 mt-1">
                <span className="text-xs text-slate-300">{total} result{total !== 1 ? 's' : ''}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
