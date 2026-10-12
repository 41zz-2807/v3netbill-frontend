import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface MenuItem {
  key: string
  label: string
  icon?: ReactNode
  /** `danger` untuk aksi merusak (hapus), `warn` untuk tanda rusak. */
  warna?: 'biasa' | 'warn' | 'danger'
  disabled?: boolean
  /** Alasan kalau disabled — ditampilkan sebagai judul tooltip. */
  alasanDisabled?: string
  onClick: () => void
}

/**
 * Tombol aksi yang membuka daftar menu.
 *
 * <p>Diganti dari deretan tombol ikon pada 12 Okt karena tiga tombol cuma
 * 32px itu memakai lebar kolom yang sama dengan lima kolom data lain, dan di
 * lebar tablet menggabung ke dua baris sehingga tiap baris tabel ikut
 * meninggi. Satu tombol + menu mengembalikan ruang ke kolom data.
 *
 * <p>Menu ditutup di luar klik, tombol Escape, dan scroll — tiga jalan yang
 * semuanya harus ada. Kalau hanya tombol Escape, satu klik kosong di luar
 * dropdown akan meninggakan menu terbuka dan menutupi baris di bawahnya.
 */
export function DropdownAksi({
  labelAksesibel,
  items,
}: {
  labelAksesibel: string
  items: MenuItem[]
}) {
  const [terbuka, setTerbuka] = useState(false)
  const wadah = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!terbuka) return
    const tutup = (e: MouseEvent) => {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setTerbuka(false)
    }
    const tutupEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTerbuka(false)
    }
    // ⚠️ Harus fungsi bernama, bukan arrow inline: arrow inline di dalam
    // addEventListener tidak bisa dilepas, jadi setiap kali menu dibuka ada
    // satu listener baru yang tertinggal sampai halaman ditutup.
    const tutupScroll = () => setTerbuka(false)

    document.addEventListener('mousedown', tutup)
    document.addEventListener('keydown', tutupEscape)
    window.addEventListener('scroll', tutupScroll, true)
    return () => {
      document.removeEventListener('mousedown', tutup)
      document.removeEventListener('keydown', tutupEscape)
      window.removeEventListener('scroll', tutupScroll, true)
    }
  }, [terbuka])

  return (
    <div ref={wadah} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setTerbuka((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={terbuka}
        aria-label={labelAksesibel}
        title={labelAksesibel}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 hover:text-slate-900"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>

      {terbuka && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.disabled ? item.alasanDisabled : item.label}
              onClick={() => {
                setTerbuka(false)
                item.onClick()
              }}
              className={[
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition',
                item.disabled
                  ? 'cursor-not-allowed text-slate-300'
                  : item.warna === 'danger'
                    ? 'text-red-700 hover:bg-red-50'
                    : item.warna === 'warn'
                      ? 'text-amber-700 hover:bg-amber-50'
                      : 'text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
