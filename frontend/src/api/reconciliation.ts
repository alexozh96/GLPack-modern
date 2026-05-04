import { api } from './auth'

export interface BankRowRead {
  id: number
  date: string
  description: string
  amount: string
  matched_ledger_id: number | null
  imported_at: string
}

export interface GlEntryRead {
  id: number
  date: string
  trx_no: string
  account: string
  particular: string
  dr_amount: string
  cr_amount: string
}

export interface MatchedPairRead {
  bank_id: number
  bank_date: string
  bank_description: string
  bank_amount: string
  gl_id: number
  gl_date: string
  gl_trx_no: string
  gl_account: string
  gl_particular: string
  gl_dr_amount: string
  gl_cr_amount: string
}

export interface ReconcSummary {
  total: number
  matched: number
  unmatched: number
}

export interface ImportResult {
  imported: number
}

export async function importCsv(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post<ImportResult>('/reconciliation/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function getUnmatchedBankRows(): Promise<BankRowRead[]> {
  const res = await api.get<BankRowRead[]>('/reconciliation/unmatched')
  return res.data
}

export async function getMatchedPairs(): Promise<MatchedPairRead[]> {
  const res = await api.get<MatchedPairRead[]>('/reconciliation/matched')
  return res.data
}

export async function getGlCashEntries(): Promise<GlEntryRead[]> {
  const res = await api.get<GlEntryRead[]>('/reconciliation/gl-cash')
  return res.data
}

export async function matchEntry(bankRowId: number, ledgerEntryId: number): Promise<BankRowRead> {
  const res = await api.post<BankRowRead>('/reconciliation/match', {
    bank_row_id: bankRowId,
    ledger_entry_id: ledgerEntryId,
  })
  return res.data
}

export async function unmatchEntry(bankRowId: number): Promise<void> {
  await api.delete(`/reconciliation/match/${bankRowId}`)
}

export async function getSummary(): Promise<ReconcSummary> {
  const res = await api.get<ReconcSummary>('/reconciliation/summary')
  return res.data
}
