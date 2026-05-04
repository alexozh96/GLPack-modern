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
