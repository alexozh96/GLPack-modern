import { api } from './auth'

export interface JournalLineRead {
  id: number
  account: string
  particular: string
  dr_amount: string
  cr_amount: string
}

export interface JournalRead {
  trx_no: string
  date: string
  lines: JournalLineRead[]
  total_dr: string
  total_cr: string
}

export interface JournalSummary {
  trx_no: string
  date: string
  line_count: number
  total_dr: string
  total_cr: string
  description: string
}

export interface LineInput {
  account: string
  particular: string
  dr_amount: string
  cr_amount: string
}

export async function listJournals(params?: Record<string, string>): Promise<JournalSummary[]> {
  const res = await api.get<JournalSummary[]>('/journal', { params })
  return res.data
}

export async function getJournal(trxNo: string): Promise<JournalRead> {
  const res = await api.get<JournalRead>(`/journal/${trxNo}`)
  return res.data
}

export async function createJournal(date: string, lines: LineInput[]): Promise<JournalRead> {
  const res = await api.post<JournalRead>('/journal', { date, lines })
  return res.data
}

export async function updateJournal(trxNo: string, date: string, lines: LineInput[]): Promise<JournalRead> {
  const res = await api.put<JournalRead>(`/journal/${trxNo}`, { date, lines })
  return res.data
}

export async function deleteJournal(trxNo: string): Promise<void> {
  await api.delete(`/journal/${trxNo}`)
}
