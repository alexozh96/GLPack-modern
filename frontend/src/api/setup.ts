import { api } from './auth'

export interface SetupData {
  company_name: string | null
  currency: string | null
  financial_year_end: string | null
  current_period: string | null
  locked_before: string | null
}

export async function getSetup(): Promise<SetupData> {
  const res = await api.get<SetupData>('/setup')
  return res.data
}

export async function updateSetup(data: Partial<Omit<SetupData, 'locked_before'>>): Promise<SetupData> {
  const res = await api.put<SetupData>('/setup', data)
  return res.data
}
