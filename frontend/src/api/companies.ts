import { api } from './auth'

export interface CompanyRead {
  id: number
  name: string
  currency: string
  financial_year_end: string
  current_period: string | null
  locked_before: string | null
  is_active: boolean
  created_at: string
}

export interface CompanyCreate {
  name: string
  currency?: string
  financial_year_end?: string
}

export interface CompanyUpdate {
  name?: string
  currency?: string
  financial_year_end?: string
  is_active?: boolean
}

export interface UserCompanyAccessRead {
  user_id: number
  username: string
  access_level: number
}

export interface AssignUserBody {
  username: string
  access_level: number
}

export async function listCompanies(): Promise<CompanyRead[]> {
  const res = await api.get<CompanyRead[]>('/companies')
  return res.data
}

export async function createCompany(body: CompanyCreate): Promise<CompanyRead> {
  const res = await api.post<CompanyRead>('/companies', body)
  return res.data
}

export async function updateCompany(id: number, body: CompanyUpdate): Promise<CompanyRead> {
  const res = await api.put<CompanyRead>(`/companies/${id}`, body)
  return res.data
}

export async function deactivateCompany(id: number): Promise<CompanyRead> {
  const res = await api.delete<CompanyRead>(`/companies/${id}`)
  return res.data
}

export async function reactivateCompany(id: number): Promise<CompanyRead> {
  return updateCompany(id, { is_active: true })
}

export async function getCompanyUsers(id: number): Promise<UserCompanyAccessRead[]> {
  const res = await api.get<UserCompanyAccessRead[]>(`/companies/${id}/users`)
  return res.data
}

export async function assignUser(id: number, body: AssignUserBody): Promise<void> {
  await api.post(`/companies/${id}/users`, body)
}

export async function updateUserAccess(id: number, userId: number, accessLevel: number): Promise<void> {
  await api.put(`/companies/${id}/users/${userId}`, { access_level: accessLevel })
}

export async function removeUser(id: number, userId: number): Promise<void> {
  await api.delete(`/companies/${id}/users/${userId}`)
}
