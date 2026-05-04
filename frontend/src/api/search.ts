import { api } from './auth'

export interface AccountResult {
  code: string
  name: string
}

export interface PhraseResult {
  id: number
  phrase: string
  dr_code: string | null
  cr_code: string | null
}

export interface JournalResult {
  trx_no: string
  date: string
  description: string
}

export interface SearchResult {
  accounts: AccountResult[]
  phrases: PhraseResult[]
  journal_entries: JournalResult[]
}

export async function search(q: string): Promise<SearchResult> {
  const res = await api.get<SearchResult>('/search', { params: { q } })
  return res.data
}
