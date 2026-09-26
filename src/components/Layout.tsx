import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { useState } from 'react'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/pcs', label: 'PC Management' },
  { to: '/accounts', label: 'Voucher & Member' },
  { to: '/transactions', label: 'Transaksi' },
  { to: '/reports', label: 'Laporan' },
]

function Layout() {
  const { role, username, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const items = [...navItems]
  if (role === 'ADMIN') {
    items.push({ to: '/settings', label: 'Pengaturan' })
  }

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="text-lg font-bold">v3Netbill</div>
          <div className="flex items-center gap-2">
            {/* Mobile hamburger button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-md bg-slate-700 px-3 py-2 text-slate-100 hover:bg-slate-600"
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

            {/* Desktop nav - hidden on mobile */}
            <div className="hidden gap-1 md:flex">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm ${
                      isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Mobile nav drawer - overlay */}
            {mobileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 bg-black/50 z-40 md:hidden"
                  onClick={closeMobileMenu}
                  aria-hidden="true"
                />
                <div className="fixed inset-y-0 right-0 w-64 bg-slate-900 z-50 md:hidden shadow-xl">
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
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={logout}
              className="rounded-md bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
            >
              {username} ({role}) — Keluar
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout