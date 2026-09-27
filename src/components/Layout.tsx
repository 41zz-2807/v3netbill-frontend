import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { useState } from 'react'

// `label` = teks pendek yang tampil di dalam pill glass (harus muat satu baris
// di max-width 560px dengan 6 item). `full` = nama lengkap, dipakai sebagai
// title tooltip + aria-label supaya tetap terbaca maksudnya.
const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    full: 'Dashboard',
    icon: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
  },
  {
    to: '/pcs',
    label: 'PC',
    full: 'PC Management',
    icon: 'M4 4h16v12H4zM9 20h6M12 16v4',
  },
  {
    to: '/accounts',
    label: 'Voucher',
    full: 'Voucher & Member',
    icon: 'M3 7h18v10H3zM3 11h18M7 15h4',
  },
  {
    to: '/transactions',
    label: 'Transaksi',
    full: 'Transaksi',
    icon: 'M4 7h13l-3-3M20 17H7l3 3',
  },
  {
    to: '/reports',
    label: 'Laporan',
    full: 'Laporan',
    icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  },
  {
    to: '/settings',
    label: 'Setting',
    full: 'Pengaturan',
    icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008 19.4a1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H2a2 2 0 110-4h.1A1.7 1.7 0 004.6 8a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V2a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H22a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  },
]

type NavItem = { to: string; label: string; full: string; icon: string }

// Ikon keluar (arrow-right-on-rectangle). Dipisah dari navItems karena bukan
// tujuan rute, melainkan aksi.
const logoutIcon =
  'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9'

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

function Layout() {
  const { role, username, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const items: NavItem[] = navItems.filter(
    (i) => i.to !== '/settings' || role === 'ADMIN',
  )

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    // overflow-x-clip: halaman TIDAK boleh bisa di-scroll ke samping di HP. Card & tabel
    // yang lebar tetap bisa di-scroll di dalam lewat `overflow-x-auto` masing-masing.
    <div className="min-h-screen overflow-x-clip bg-gray-100">
      <header className="bg-[#1b233d]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          {/* Identitas pindah ke sebelah nama aplikasi. Strip pemisah supaya
              "v3netbill" dan nama user tidak menyatu jadi satu kata. */}
          <div className="text-lg font-bold text-white">
            v3netbill
            <span className="mx-1.5 font-normal text-slate-400">-</span>
            <span className="font-semibold text-slate-200">{username}</span>
          </div>

          {/* Menu didorong ke kanan oleh justify-between, jadi tepi kanannya
              rata dengan konten body: header dan body sama-sama max-w-6xl px-4. */}
          <nav className="navmenu hidden lg:flex" aria-label="Menu utama">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={item.full}
                aria-label={item.full}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <NavIcon d={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}

            <button
              type="button"
              onClick={logout}
              className="navmenu__exit"
              title="Keluar dari sesi"
              aria-label="Keluar dari sesi"
            >
              <NavIcon d={logoutIcon} />
              <span>Keluar</span>
            </button>
          </nav>

          {/* Mobile hamburger. Di desktop tersembunyi, jadi justify-between
              tetap menyisakan dua anak: brand di kiri, pill di kanan. */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden rounded-md bg-slate-700 px-3 py-2 text-slate-100 hover:bg-slate-600"
            aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile nav drawer - overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 w-64 bg-slate-900 z-50 lg:hidden shadow-xl">
            <div className="flex flex-col p-4 space-y-2">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-base ${
                      isActive ? 'bg-slate-700 text-white' : 'text-slate-200 hover:bg-slate-800'
                    }`
                  }
                >
                  {item.full}
                </NavLink>
              ))}

              <button
                type="button"
                onClick={logout}
                className="rounded-md px-3 py-2 text-left text-base text-red-400 hover:bg-slate-800"
              >
                Keluar
              </button>
            </div>
          </div>
        </>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
