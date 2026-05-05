import { api } from './auth'

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
