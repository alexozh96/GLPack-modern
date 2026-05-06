import { api } from './auth'
import type { UserRead } from './auth'

export interface UserCreate {
  username: string
  password: string
  access_level: number
}

export interface UserUpdate {
  username?: string
  password?: string
  access_level?: number
  is_active?: boolean
}

export async function listUsers(): Promise<UserRead[]> {
  const res = await api.get<UserRead[]>('/users')
  return res.data
}

export async function createUser(body: UserCreate): Promise<UserRead> {
  const res = await api.post<UserRead>('/users', body)
  return res.data
}

export async function updateUser(id: number, body: UserUpdate): Promise<UserRead> {
  const res = await api.put<UserRead>(`/users/${id}`, body)
  return res.data
}

export async function deactivateUser(id: number): Promise<UserRead> {
  const res = await api.delete<UserRead>(`/users/${id}`)
  return res.data
}

export async function reactivateUser(id: number): Promise<UserRead> {
  const res = await api.put<UserRead>(`/users/${id}`, { is_active: true })
  return res.data
}
