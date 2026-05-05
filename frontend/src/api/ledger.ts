import { api } from './auth'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export interface LedgerLine {
  id: number
  trx_no: string
  date: string
  particular: string
  dr_amount: string
  cr_amount: string
  balance: string
}

export async function getLedger(params: {
  account?: string
  from_date?: string
  to_date?: string
}): Promise<LedgerLine[]> {
  const res = await api.get<LedgerLine[]>('/ledger', { params })
  return res.data
}

export async function exportLedgerCsv(params?: {
  account?: string
  from_date?: string
  to_date?: string
}): Promise<void> {
  const res = await api.get('/ledger/export-csv', { params, responseType: 'blob' })
  const parts = ['journal_entries']
  if (params?.account) parts.push(params.account)
  if (params?.from_date) parts.push(params.from_date)
  if (params?.to_date) parts.push(params.to_date)
  downloadBlob(res.data as Blob, parts.join('_') + '.csv')
}

export interface LedgerImportResult {
  imported_rows: number
  imported_transactions: number
}

export async function importLedgerCsv(file: File): Promise<LedgerImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post<LedgerImportResult>('/ledger/import-csv', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
