import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/api.ts'
import { useAuth } from '../context/AuthContext.tsx'
import ProgressBar from '../components/ui/ProgressBar.tsx'

/**
 * Ikon garis tipis, ukuran 20px, `currentColor` supaya warnanya mengikuti
 * `.login-row__icon` dan ikut berubah saat baris itu fokus.
 *
 * ⚠️ Jangan pakai ikon dari pustaka: mockup memakai garis tipis (outline),
 * sedangkan Feather/lucide memakai garis yang lebih tebal dan proporsinya
 * berbeda.Svg inline bisa diatur persis seperti di mockup.
 */
function Ikon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="login-row__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

function IkonAmplop() {
  return (
    <Ikon>
      {/* amplop: persegi panjang + flap */}
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 6.5 12 13l9-6.5" />
    </Ikon>
  )
}

function IkonGembok() {
  return (
    <Ikon>
      {/* gembok: badan + busur shackle + lubang kunci */}
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <circle cx="12" cy="15.5" r="1.4" />
    </Ikon>
  )
}

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
      // Selalu ke Dashboard setelah login, abaikan returnUrl demi keamanan
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
        <div className="heading">Login</div>
        <form className="login-form" onSubmit={handleSubmit}>
          {notice && <div className="login-alert login-alert--notice">{notice}</div>}
          {error && <div className="login-alert login-alert--error">{error}</div>}

          <div className="login-row">
            <IkonAmplop />
            <input
              required
              className="input"
              type="text"
              name="username"
              id="username"
              placeholder="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="login-row">
            <IkonGembok />
            <input
              required
              className="input"
              type="password"
              name="password"
              id="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? <ProgressBar tone="light" value={null} /> : 'Login'}
          </button>
        </form>
        <span className="agreement">v3Netbill — Sistem billing warnet</span>
      </div>
    </div>
  )
}
