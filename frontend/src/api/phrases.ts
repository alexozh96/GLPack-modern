import { api } from './auth'

export interface Phrase {
  id: number
  phrase: string
  dr_code: string | null
  cr_code: string | null
}

export async function listPhrases(search?: string): Promise<Phrase[]> {
  const params: Record<string, string> = {}
  if (search) params.search = search
  const res = await api.get<Phrase[]>('/phrases', { params })
  return res.data
}

export async function createPhrase(
  phrase: string,
  dr_code: string | null,
  cr_code: string | null,
): Promise<Phrase> {
  const res = await api.post<Phrase>('/phrases', { phrase, dr_code, cr_code })
  return res.data
}

export async function deletePhrase(id: number): Promise<void> {
  await api.delete(`/phrases/${id}`)
}
