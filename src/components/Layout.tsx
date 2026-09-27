import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'

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
  const { role, logout } = useAuth()

  const items: NavItem[] = navItems.filter(
    (i) => i.to !== '/settings' || role === 'ADMIN',
  )

  return (
    // overflow-x-clip: halaman TIDAK boleh bisa di-scroll ke samping di HP. Card & tabel
    // yang lebar tetap bisa di-scroll di dalam lewat `overflow-x-auto` masing-masing.
    <div className="min-h-screen overflow-x-clip bg-gray-100">
      <header className="bg-[#1b233d]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          {/* Brand berupa logo. Dari JPG 1760x576 berlatar putih, dibuat
              transparan lalu dipangkas jadi PNG 411x144 (rasio 2.854:1).
              h-9 = 36px di desktop, h-7 = 28px di HP. Di HP lebar logo jadi
              80px, sehingga 80 + pill 213px + gap masih muat dalam 358px
              yang tersedia di layar 390px. */}
          <div className="flex shrink-0 items-center">
            <img
              src="/logo-v3netbill.png"
              alt="v3Netbill"
              title="v3Netbill"
              width={411}
              height={144}
              className="h-7 w-auto lg:h-9"
            />
          </div>

          {/* Menu pill. w-auto supaya lebarnya mengikuti isi item, bukan
              memaksa baris sendiri. Sebelumnya w-full yang membuat logo dan
              menu selalu jadi dua baris di HP. */}
          <nav className="navmenu w-auto shrink" aria-label="Menu utama">
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
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
