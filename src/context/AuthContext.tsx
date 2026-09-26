import { createContext, useContext, useState, type ReactNode } from 'react'
import { getToken, getRole, getUsername, setAuth, clearAuth, setUsername } from '../lib/api'
import type { Role } from '../lib/types'

interface AuthState {
  token: string | null
  role: Role | null
  username: string | null
  login: (token: string, role: Role, username: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getToken())
  const [role, setRole] = useState<Role | null>(getRole())
  const [username, setUsernameState] = useState<string | null>(getUsername())

  function login(t: string, r: Role, u: string) {
    setAuth(t, r)
    setUsername(u)
    setToken(t)
    setRole(r)
    setUsernameState(u)
  }

  function logout() {
    clearAuth()
    setToken(null)
    setRole(null)
    setUsernameState(null)
  }

  return (
    <AuthContext.Provider value={{ token, role, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}