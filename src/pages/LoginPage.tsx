import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, fetchStatusPcRingkas } from '../lib/api.ts'
import type { StatusPcRingkas } from '../lib/types.ts'
import { useAuth } from '../context/AuthContext.tsx'

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

/** Sisa detik → `2j 14:00` atau `38:12`. Sama formatnya dengan dashboard. */
function formatSisa(detik: number): string {
  const total = Math.max(0, Math.floor(detik))
  const jam = Math.floor(total / 3600)
  const menit = Math.floor((total % 3600) / 60)
  const dtk = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return jam > 0 ? `${jam}j ${pad(menit)}:${pad(dtk)}` : `${pad(menit)}:${pad(dtk)}`
}

/**
 * Daftar PC di sebelah kiri kartu login.
 *
 * ⚠️ Yang ditampilkan HANYA nama PC, status, tipe akun, dan sisa waktu.
 * Nama member maupun kode voucher tidak pernah dikirim ke sini — halaman ini
 * terlihat sebelum operator login, dan nama member adalah kredensial login-nya.
 */
function DaftarPc({ pcs, muat }: { pcs: StatusPcRingkas[]; muat: boolean }) {
  const dipakai = pcs.filter((p) => p.status === 'ACTIVE').length
  const tersedia = pcs.filter((p) => p.status === 'IDLE').length
  const offline = pcs.filter((p) => p.status === 'OFFLINE').length

  return (
    <div className="login-pc">
      <div className="login-pc__kepala">
        <span className="login-pc__judul">Status PC</span>
        <span className="login-pc__rinci">
          {muat && pcs.length === 0 ? 'memuat…' : `${dipakai} dipakai · ${tersedia} tersedia · ${offline} offline`}
        </span>
      </div>
      <div className="login-pc__daftar">
        {pcs.length === 0 && !muat && <p className="login-pc__kosong">Belum ada PC terdaftar.</p>}
        {pcs.map((pc) => {
          const dipakai = pc.status === 'ACTIVE'
          const offline = pc.status === 'OFFLINE'
          return (
            <div className="login-pc__baris" key={pc.namaPc}>
              {/* Hijau berdenyut, kuning & merah diam. */}
              <span
                className={`login-pc__dot ${dipakai ? 'is-dipakai' : offline ? 'is-offline' : 'is-tersedia'}`}
                aria-hidden="true"
              />
              <span className="login-pc__nama">{pc.namaPc}</span>
              <span className={`login-pc__tipe ${dipakai ? 'is-dipakai' : offline ? 'is-offline' : 'is-tersedia'}`}>
                {dipakai ? (pc.tipe === 'MEMBER' ? 'Member' : 'Voucher') : offline ? 'Offline' : 'Tersedia'}
              </span>
              <span className={`login-pc__sisa${pc.sisaDetik === null ? ' is-kosong' : ''}`}>
                {pc.sisaDetik === null ? '—' : formatSisa(pc.sisaDetik)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
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
  const [pcs, setPcs] = useState<StatusPcRingkas[]>([])
  const [muatPc, setMuatPc] = useState(true)

  // Halaman login tidak punya WebSocket dashboard (butuh JWT), jadi status PC
  // diambil lewat endpoint publik. 10 detik cukup: yang ditampilkan cuma
  // perubahan status, dan countdown-nya dihitung ulang dari server tiap poll.
  useEffect(() => {
    let batal = false
    const muat = async () => {
      try {
        const data = await fetchStatusPcRingkas()
        if (!batal) setPcs(data)
      } catch {
        // Gagal ambil status PC tidak boleh menghalangi login — form login
        // tetap harus bisa dipakai. Diamkan saja, daftar akan kosong.
      } finally {
        if (!batal) setMuatPc(false)
      }
    }
    void muat()
    const t = setInterval(() => void muat(), 10_000)
    return () => {
      batal = true
      clearInterval(t)
    }
  }, [])

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
      <div className="login-container login-container--pc">
        <div className="login-split">
          <DaftarPc pcs={pcs} muat={muatPc} />

          <div className="login-form-side">
            {/* ⚠️ Logo menggantikan tulisan "LOGIN". Judul kata "Login" di atas
                form hanya menambah tinggi dan ruang kosong — apalagi sekarang
                form ini menyatu dengan daftar PC di sebelah kiri.
                `width`/`height` asli ditulis supaya browser memakai rasio
                411:144 saat menghitung lebar dari `height`. */}
            <img
              className="login-form-side__logo"
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
      </div>
    </div>
  )
}