import { createContext, useContext, useState, type ReactNode } from 'react'
import { getToken, getRole, getUsername, setAuth, clearAuth, setUsername } from '../lib/api'
import type { Role } from '../lib/types'

interface AuthState {
  token: string | null
  role: Role | null
  username: string | null
  /** Kabar singkat di layar login, mis. setelah sesi terkunci otomatis. */
  notice: string | null
  login: (token: string, role: Role, username: string) => void
  logout: (notice?: string) => void
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * Pesan setelah sesi berakhir otomatis.
 *
 * Sengaja dibuat general dan TIDAK menyebut "tidak ada aktivitas selama 5 menit".
 * Kasir tidak perlu tahu penyebab teknisnya, cukup tahu harus login ulang.
 */
export const PESAN_SESI_BERAKHIR = 'Sesi berakhir. Silakan login kembali.'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getToken())
  const [role, setRole] = useState<Role | null>(getRole())
  const [username, setUsernameState] = useState<string | null>(getUsername())
  const [notice, setNotice] = useState<string | null>(null)

  function login(t: string, r: Role, u: string) {
    setAuth(t, r)
    setUsername(u)
    setToken(t)
    setRole(r)
    setUsernameState(u)
    setNotice(null)
  }

  function logout(notice?: string) {
    clearAuth()
    setToken(null)
    setRole(null)
    setUsernameState(null)
    setNotice(notice ?? null)
  }

  return (
    <AuthContext.Provider value={{ token, role, username, notice, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}