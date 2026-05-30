import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let _logoutHandler: (() => void) | null = null

export function setLogoutHandler(fn: () => void) {
  _logoutHandler = fn
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/login')
    ) {
      localStorage.removeItem('token')
      localStorage.removeItem('companyInfo')
      _logoutHandler?.()
    }
    return Promise.reject(error)
  }
)

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  must_change_password: boolean
}

export interface UserRead {
  id: number
  username: string
  platform_role: string
  is_active: boolean
  must_change_password: boolean
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>('/auth/login', data)
  return res.data
}

export async function me(): Promise<UserRead> {
  const res = await api.get<UserRead>('/auth/me')
  return res.data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  await api.post('/auth/change-password', { current_password, new_password })
}

export interface CompanyInfo {
  id: number
  name: string
  currency: string
  access_level: number
}

export async function getCompanies(): Promise<CompanyInfo[]> {
  const res = await api.get<CompanyInfo[]>('/auth/companies')
  return res.data
}

export async function selectCompany(companyId: number): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>('/auth/select-company', { company_id: companyId })
  return res.data
}
