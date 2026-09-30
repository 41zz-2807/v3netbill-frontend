import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/api.ts'
import { useAuth } from '../context/AuthContext.tsx'
import ProgressBar from '../components/ui/ProgressBar.tsx'

export default function LoginPage() {
  const { login: doLogin, notice } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await login(username, password)
      doLogin(res.access_token, res.role, username)
      // Always redirect to Dashboard after login, ignore returnUrl for security
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'Login gagal',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="login-container">
        <div className="heading">Sign In</div>
        <form className="login-form" onSubmit={handleSubmit}>
          {notice && (
            <div className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
          <input
            required
            className="input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            required
            className="input"
            type="password"
            name="password"
            id="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? (
              <ProgressBar tone="light" value={null} />
            ) : (
              'Sign In'
            )}
          </button>
        </form>
        <span className="agreement">v3Netbill — Sistem billing warnet</span>
      </div>
    </div>
  )
}