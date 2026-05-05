import { useSetup } from '../context/SetupContext'

export interface FiscalYearDates {
  fyStart: string   // YYYY-MM-DD, '' if not configured
  fyEnd: string     // YYYY-MM-DD, '' if not configured
  isConfigured: boolean
  ready: boolean    // true once setup context has finished loading
}

/**
 * Derives the current financial year date range from the stored FY end setting.
 *
 * Accepts MM-DD (e.g. "06-30") or legacy YYYY-MM-DD (extracts MM-DD).
 * Auto-rolls each year: if today is past the FY end, advances to the next year.
 */
function deriveFYDates(fyEndValue: string): { start: string; end: string } | null {
  let mmdd = fyEndValue.trim()
  // Handle legacy full-date format stored before MM-DD convention
  if (/^\d{4}-\d{2}-\d{2}$/.test(mmdd)) mmdd = mmdd.slice(5)
  if (!/^\d{2}-\d{2}$/.test(mmdd)) return null

  const today = new Date()
  const year = today.getFullYear()
  const candidateEnd = new Date(`${year}-${mmdd}`)
  if (isNaN(candidateEnd.getTime())) return null

  // If today is past this year's FY end, the current FY ends next year
  const fyEnd = today <= candidateEnd ? candidateEnd : new Date(`${year + 1}-${mmdd}`)

  // FY start = one day after the previous year's FY end
  const fyStart = new Date(fyEnd)
  fyStart.setFullYear(fyStart.getFullYear() - 1)
  fyStart.setDate(fyStart.getDate() + 1)

  return {
    start: fyStart.toISOString().slice(0, 10),
    end: fyEnd.toISOString().slice(0, 10),
  }
}

export function useFiscalYear(): FiscalYearDates {
  const { setup, loading } = useSetup()

  const fye = setup?.financial_year_end ?? ''
  const derived = fye ? deriveFYDates(fye) : null

  return {
    fyStart: derived?.start ?? '',
    fyEnd: derived?.end ?? '',
    isConfigured: !!derived,
    ready: !loading,
  }
}
