import { useEffect, useRef, useState } from 'react'

export interface TabNavItem {
  id: string
  label: string
  /** Deskripsi singkat, hanya ditampilkan di sidebar desktop. */
  hint?: string
}

/**
 * Navigasi antar-bagian halaman Pengaturan.
 *
 * Dua tata letak, dipilih satu sama lain, bukan dua komponen terpisah:
 *
 * - Desktop (>= lg): daftar tegak di kiri, isi halaman di kanan. Daftar selalu
 *   terlihat — kasir yang sedang menyetel tarif tidak boleh perlu membuka
 *   sesuatu dulu untuk pindah ke bagian lain.
 * - Mobile (< lg): tertutup secara bawaan, hanya nama bagian yang sedang aktif
 *   yang terlihat. Mengetuuknya membuka daftar, dan daftar menutup sendiri
 *   begitu ada bagian yang dipilih — supaya tidak memakan layar HP yang memang
 *   sempit.
 *
 * `aria-expanded` dipakai karena daftar mobile benar-benar bisa dibuka-tutup;
 * membacanya sebagai Screen Reader akan erhalten colapso yang disengaja, bukan
 * kotak yang terpotong.
 */
export default function TabNav({
  items,
  active,
  onChange,
}: {
  items: TabNavItem[]
  active: string
  onChange: (id: string) => void
}) {
  const [terbuka, setTerbuka] = useState(false)
  const wadahRef = useRef<HTMLDivElement>(null)
  const aktif = items.find((t) => t.id === active)

  // Klik di luar menutup daftar mobile. Tanpa ini daftar tetap terbuka walau
  // operator sudah pindah ke bagian lain.
  useEffect(() => {
    if (!terbuka) return
    const klikDiLuar = (e: MouseEvent) => {
      if (!wadahRef.current?.contains(e.target as Node)) setTerbuka(false)
    }
    const tekanEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTerbuka(false)
    }
    document.addEventListener('mousedown', klikDiLuar)
    document.addEventListener('keydown', tekanEsc)
    return () => {
      document.removeEventListener('mousedown', klikDiLuar)
      document.removeEventListener('keydown', tekanEsc)
    }
  }, [terbuka])

  const pilih = (id: string) => {
    onChange(id)
    setTerbuka(false) // mobile: tutup sendiri setelah memilih
  }

  const gayaTombol = (aktif_: boolean) =>
    `flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
      aktif_
        ? 'bg-slate-900 text-white'
        : 'bg-white text-slate-700 hover:bg-slate-50'
    }`

  return (
    <div ref={wadahRef} className="relative lg:static">
      {/* ---------- Mobile: pemicu yang membuka daftar ---------- */}
      <button
        type="button"
        onClick={() => setTerbuka((v) => !v)}
        aria-expanded={terbuka}
        className={`${gayaTombol(terbuka)} shadow-sm lg:hidden`}
      >
        <span className="min-w-0 truncate">{aktif?.label ?? 'Pilih bagian'}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${terbuka ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Daftar. Mobile: absolute di bawah pemicu supaya tidak mendorong
          isi halaman. Desktop: tegak di kiri, selalu terlihat. */}
      <ul
        className={
          terbuka
            ? 'absolute left-0 right-0 top-full z-20 mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg lg:static lg:mt-0 lg:space-y-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none'
            : 'hidden lg:static lg:block lg:space-y-1'
        }
      >
        {items.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => pilih(t.id)}
              aria-current={t.id === active ? 'page' : undefined}
              className={`${gayaTombol(t.id === active)} flex-col items-start gap-0.5`}
            >
              <span className="w-full truncate">{t.label}</span>
              {t.hint && (
                <span
                  className={`w-full text-[11px] leading-tight ${
                    t.id === active ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {t.hint}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}