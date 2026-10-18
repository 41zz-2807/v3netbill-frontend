import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/api.ts'
import { useAuth } from '../context/AuthContext.tsx'

/**
 * Halaman login — satu kartu saja.
 *
 * ⚠️ Dulu di sebelah kiri ada daftar PC (nama, status, tipe akun, sisa waktu)
 * yang diambil dari endpoint publik `/api/pcs/ringkas` tiap 10 detik. Daftar itu
 * **dihapus atas permintaan operator**: kasir sudah punya dashboard dan aplikasi
 * HP untuk tahu PC mana yang terpakai, jadi di layar login cukup satu tugas —
 * masuk.
 *
 * Endpoint `/api/pcs/ringkas` di backend sengaja TIDAK ikut dihapus. Halaman ini
 * tidak butuh internet untuk login dan tidak memanggil apa pun selain
 * `POST /api/auth/login`, jadi sekarang halaman ini bebas dari polling.
 */

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

function IkonMata({ terbuka }: { terbuka: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {terbuka ? (
        <>
          {/* mata terbuka + garis coret: sandi sedang terlihat */}
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
          <path d="M4 20 20 4" />
        </>
      ) : (
        <>
          {/* mata tertutup */}
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}

export default function LoginPage() {
  const { login: doLogin, notice } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [lihatSandi, setLihatSandi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fieldSandi = useRef<HTMLInputElement>(null)

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
      fieldSandi.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="login-container">
        {/* ⚠️ Logo menggantikan tulisan "LOGIN" sebagai judul. Judul kata
            "Login" hanya menambah tinggi dan ruang kosong.
            `width`/`height` asli ditulis supaya browser memakai rasio 411:144
            saat menghitung lebar dari `height`. */}
        <img
          className="login-logo"
          src="/logo-v3netbill.png"
          alt="v3Netbill"
          width={411}
          height={144}
        />
        <form className="login-form" onSubmit={handleSubmit}>
          {notice && <div className="login-alert login-alert--notice">{notice}</div>}
          {error && <div className="login-alert login-alert--error">{error}</div>}

          <div className="login-row">
            <IkonAmplop />
            <input
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
              className="input"
              type={lihatSandi ? 'text' : 'password'}
              name="password"
              id="password"
              placeholder="Password"
              autoComplete="current-password"
              ref={fieldSandi}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="login-mata"
              onClick={() => setLihatSandi((v) => !v)}
              aria-label={lihatSandi ? 'Sembunyikan sandi' : 'Lihat sandi'}
              title={lihatSandi ? 'Sembunyikan sandi' : 'Lihat sandi'}
            >
              <IkonMata terbuka={lihatSandi} />
            </button>
          </div>

          {/* ⚠️ Tidak ada animasi loading di sini. `ProgressBar` bikin
              tombol melompat tinggi dan terlihat seperti elemen lain yang
              tidak sengaja muncul. Cukup warna tombol yang berubah samar
              lewat kelas `.is-memproses`. */}
          <button
            type="submit"
            className={`login-button${loading ? ' is-memproses' : ''}`}
            disabled={loading}
          >
            Login
          </button>
        </form>
        <span className="agreement">v3Netbill — Sistem billing warnet</span>
      </div>
    </div>
  )
}