import axios from 'axios'

export const api = axios.create({ baseURL: 'http://localhost:8000' })

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
}

export interface UserRead {
  id: number
  username: string
  full_name: string | null
  access_level: number
  is_active: boolean
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
