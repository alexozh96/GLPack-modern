import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSetup, updateSetup } from '../api/setup'
import { closePeriod } from '../api/period'
import type { SetupData } from '../api/setup'

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
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export function Settings() {
  const { user } = useAuth()
  const isAdmin = (user?.access_level ?? 0) >= 6

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
      // Refresh setup so locked_before is current
      const updated = await getSetup()
      setSetup(updated)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setCloseErr(msg ?? 'Period close failed.')
    } finally {
      setClosing(false)
    }
  }

  const lockedThrough = setup?.locked_before ?? null

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold text-slate-800">Settings</h2>

      {loadErr && (
        <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {loadErr}
        </div>
      )}

      {/* Company settings */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Company Settings</h3>

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
          <Field
            label="Financial Year End"
            value={form.financial_year_end}
            onChange={v => setForm(f => ({ ...f, financial_year_end: v }))}
            disabled={!isAdmin}
            placeholder="2024-12-31"
          />
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
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
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
        <h3 className="text-sm font-semibold text-slate-700">Period Close</h3>

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
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!closeDate || closing}
              className="px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 disabled:opacity-40"
            >
              {closing ? 'Closing…' : 'Close Period'}
            </button>

            {closeResult && (
              <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
                {closeResult}
              </div>
            )}
            {closeErr && (
              <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {closeErr}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Admin access required to close a period.</p>
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
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800"
              >
                Yes, Close Period
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
