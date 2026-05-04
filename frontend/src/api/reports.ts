import { api } from './auth'

export async function downloadLedgerPdf(
  code: string,
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  const res = await api.get(`/reports/ledger-account/${code}`, {
    params: { period_start: periodStart, period_end: periodEnd, format: 'pdf' },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ledger_${code.toUpperCase()}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
