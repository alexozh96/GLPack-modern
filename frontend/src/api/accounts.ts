import { api } from './auth'

export interface Account {
  code: string
  name: string
}

export async function listAccounts(search?: string, prefix?: string): Promise<Account[]> {
  const params: Record<string, string> = {}
  if (search) params.search = search
  if (prefix) params.prefix = prefix
  const res = await api.get<Account[]>('/accounts', { params })
  return res.data
}

export async function createAccount(code: string, name: string): Promise<Account> {
  const res = await api.post<Account>('/accounts', { code, name })
  return res.data
}

export async function updateAccount(code: string, name: string): Promise<Account> {
  const res = await api.put<Account>(`/accounts/${code}`, { name })
  return res.data
}

export async function deleteAccount(code: string): Promise<void> {
  await api.delete(`/accounts/${code}`)
}
