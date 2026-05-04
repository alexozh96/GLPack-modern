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
