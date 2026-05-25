import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSetup, updateSetup } from '../api/setup'
import { closePeriod } from '../api/period'
import { listPhrases, createPhrase, deletePhrase } from '../api/phrases'
import type { SetupData } from '../api/setup'
import type { Phrase } from '../api/phrases'
import { PageHeader, cls } from '../components/ui'

// ── helpers ───────────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, disabled, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder ?? ''}
        className={`w-full ${cls.input}`}
      />
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export function Settings() {
  const { company } = useAuth()
  const isAdmin = (company?.access_level ?? 0) >= 6

  const [setup, setSetup] = useState<SetupData | null>(null)
  const [form, setForm] = useState({ company_name: '', currency: '', financial_year_end: '', current_period: '' })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const [closeDate, setCloseDate] = useState('')
  const [closing, setClosing] = useState(false)
  const [closeResult, setCloseResult] = useState<string | null>(null)
  const [closeErr, setCloseErr] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // phrases
  const canWrite = (company?.access_level ?? 0) >= 3
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [phraseSearch, setPhraseSearch] = useState('')
  const [newPhrase, setNewPhrase] = useState('')
  const [newDr, setNewDr] = useState('')
  const [newCr, setNewCr] = useState('')
  const [phraseErr, setPhraseErr] = useState<string | null>(null)
  const [phraseBusy, setPhraseBusy] = useState(false)

  function loadPhrases(search = phraseSearch) {
    listPhrases(search || undefined).then(setPhrases).catch(() => {})
  }

  useEffect(() => { loadPhrases('') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getSetup()
      .then(data => {
        setSetup(data)
        setForm({
          company_name: data.company_name ?? '',
          currency: data.currency ?? '',
          financial_year_end: data.financial_year_end ?? '',
          current_period: data.current_period ?? '',
        })
      })
      .catch(() => setLoadErr('Could not load settings. Is the backend running?'))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const updated = await updateSetup({
        company_name: form.company_name || null,
        currency: form.currency || null,
        financial_year_end: form.financial_year_end || null,
        current_period: form.current_period || null,
      })
      setSetup(updated)
      setSaveMsg('Settings saved.')
    } catch {
      setSaveMsg('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleClose() {
    setConfirmOpen(false)
    setClosing(true)
    setCloseResult(null)
    setCloseErr(null)
    try {
      const res = await closePeriod(closeDate)
      setCloseResult(
        `Period closed through ${res.locked_before}. ${res.closing_lines_written} closing line(s) written. Net profit: ${res.net_profit}.`,
      )
      const updated = await getSetup()
      setSetup(updated)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setCloseErr(msg ?? 'Period close failed.')
    } finally {
      setClosing(false)
    }
  }

  async function handleAddPhrase() {
    if (!newPhrase.trim()) return
    setPhraseBusy(true)
    setPhraseErr(null)
    try {
      await createPhrase(
        newPhrase.trim(),
        newDr.trim().toUpperCase() || null,
        newCr.trim().toUpperCase() || null,
      )
      setNewPhrase('')
      setNewDr('')
      setNewCr('')
      loadPhrases()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPhraseErr(msg ?? 'Failed to add phrase.')
    } finally {
      setPhraseBusy(false)
    }
  }

  async function handleDeletePhrase(id: number) {
    await deletePhrase(id)
    loadPhrases()
  }

  const lockedThrough = setup?.locked_before ?? null

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" />

      {loadErr && <div className={cls.alertError}>{loadErr}</div>}

      {/* Company settings */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className={cls.cardTitle}>Company Settings</h3>

        <Field
          label="Company Name"
          value={form.company_name}
          onChange={v => setForm(f => ({ ...f, company_name: v }))}
          disabled={!isAdmin}
          placeholder="My Company Ltd"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Currency"
            value={form.currency}
            onChange={v => setForm(f => ({ ...f, currency: v }))}
            disabled={!isAdmin}
            placeholder="USD"
          />
          <div>
            <Field
              label="Financial Year End (MM-DD)"
              value={form.financial_year_end}
              onChange={v => setForm(f => ({ ...f, financial_year_end: v }))}
              disabled={!isAdmin}
              placeholder="12-31"
            />
            <p className="text-xs text-slate-400 mt-1">
              Month and day only — e.g. 06-30 for June 30. The app rolls this forward each year automatically.
            </p>
          </div>
        </div>
        <Field
          label="Current Period"
          value={form.current_period}
          onChange={v => setForm(f => ({ ...f, current_period: v }))}
          disabled={!isAdmin}
          placeholder="2024"
        />

        {isAdmin && (
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSave} disabled={saving} className={cls.btnPrimary}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {saveMsg && (
              <span className={`text-sm ${saveMsg.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
                {saveMsg}
              </span>
            )}
          </div>
        )}

        {!isAdmin && (
          <p className="text-xs text-slate-400">Admin access required to change settings.</p>
        )}
      </div>

      {/* Period Close */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className={cls.cardTitle}>Period Close</h3>

        <div className="text-sm text-slate-600 space-y-1">
          <p>
            Closing a period zeroes all P&amp;L accounts (SA, CO, OI, EX, TX) by posting a
            balancing journal entry, then transfers the net profit to the P&amp;L retained account.
            All journal entries on or before the close date will be locked from editing or deletion.
          </p>
          {lockedThrough && (
            <p className="font-medium text-amber-700">
              Currently locked through: {lockedThrough}
            </p>
          )}
        </div>

        {isAdmin ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Period End Date</label>
              <input
                type="date"
                value={closeDate}
                onChange={e => setCloseDate(e.target.value)}
                className={cls.input}
              />
            </div>

            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!closeDate || closing}
              className={cls.btnDanger}
            >
              {closing ? 'Closing…' : 'Close Period'}
            </button>

            {closeResult && <div className={cls.alertSuccess}>{closeResult}</div>}
            {closeErr && <div className={cls.alertError}>{closeErr}</div>}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Admin access required to close a period.</p>
        )}
      </div>

      {/* Phrases */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className={cls.cardTitle}>Journal Phrases</h3>
          <input
            type="text"
            value={phraseSearch}
            onChange={e => { setPhraseSearch(e.target.value); loadPhrases(e.target.value) }}
            placeholder="Search…"
            className={`${cls.input} w-40`}
          />
        </div>

        {canWrite && (
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium text-slate-500 mb-1">Phrase</label>
              <input
                type="text"
                value={newPhrase}
                onChange={e => setNewPhrase(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddPhrase()}
                placeholder="e.g. Cash sale"
                maxLength={45}
                className={`w-full ${cls.input}`}
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-slate-500 mb-1">Dr Code</label>
              <input
                type="text"
                value={newDr}
                onChange={e => setNewDr(e.target.value.toUpperCase())}
                placeholder="CB01"
                maxLength={4}
                className={`w-full ${cls.input} font-mono`}
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-slate-500 mb-1">Cr Code</label>
              <input
                type="text"
                value={newCr}
                onChange={e => setNewCr(e.target.value.toUpperCase())}
                placeholder="SA01"
                maxLength={4}
                className={`w-full ${cls.input} font-mono`}
              />
            </div>
            <button
              onClick={handleAddPhrase}
              disabled={!newPhrase.trim() || phraseBusy}
              className={cls.btnPrimary}
            >
              {phraseBusy ? 'Adding…' : 'Add'}
            </button>
            {phraseErr && <p className="w-full text-xs text-red-600">{phraseErr}</p>}
          </div>
        )}

        {phrases.length === 0 ? (
          <div className="px-5 py-6 text-center text-slate-400 text-sm">No phrases found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={cls.th}>Phrase</th>
                <th className={`${cls.th} w-24`}>Dr</th>
                <th className={`${cls.th} w-24`}>Cr</th>
                {canWrite && <th className="w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {phrases.map(p => (
                <tr key={p.id} className="hover:bg-[#0875e1]/[0.03] transition-colors">
                  <td className={cls.td}>{p.phrase}</td>
                  <td className={cls.tdMono}>{p.dr_code ?? '—'}</td>
                  <td className={cls.tdMono}>{p.cr_code ?? '—'}</td>
                  {canWrite && (
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDeletePhrase(p.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm space-y-4">
            <h4 className="text-base font-semibold text-slate-800">Confirm Period Close</h4>
            <p className="text-sm text-slate-600">
              Close period through <strong>{closeDate}</strong>?
              This will post closing journal entries and lock all transactions on or before that date.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={handleClose} className={`flex-1 ${cls.btnDanger}`}>
                Yes, Close Period
              </button>
              <button onClick={() => setConfirmOpen(false)} className={`flex-1 ${cls.btnSecondary}`}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
