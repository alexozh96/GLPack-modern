import { api } from './auth'

export interface PeriodCloseResult {
  period_end: string
  locked_before: string
  closing_lines_written: number
  net_profit: string
}

export async function closePeriod(period_end: string): Promise<PeriodCloseResult> {
  const res = await api.post<PeriodCloseResult>('/period/close', { period_end })
  return res.data
}
