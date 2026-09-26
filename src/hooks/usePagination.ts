import { useMemo, useState } from 'react'

export const PER_HALAMAN = 15

/** Urutkan terbaru lebih dulu. Nilai key berupa string tanggal; format
 *  ISO ("2026-09-26" atau "...T13:45:00Z") aman dibandingkan leksikografis. */
export function urutkanTerbaru<T>(data: T[], getKey: (item: T) => string): T[] {
  return [...data].sort((a, b) => {
    const ka = getKey(a)
    const kb = getKey(b)
    if (ka === kb) return 0
    return ka < kb ? 1 : -1
  })
}

export interface PaginationResult<T> {
  /** Potongan data untuk halaman ini. */
  data: T[]
  halaman: number
  totalHalaman: number
  total: number
  /** Pindah halaman. Dijepit agar tidak keluar dari rentang. */
  setHalaman: (halaman: number) => void
  /** Kembali ke halaman 1 — dipanggil saat filter berubah. */
  reset: () => void
}

export function usePagination<T>(data: T[], perHalaman: number = PER_HALAMAN): PaginationResult<T> {
  const [halaman, setHalamanState] = useState(1)
  const totalHalaman = Math.max(1, Math.ceil(data.length / perHalaman))
  const aman = Math.min(halaman, totalHalaman)

  // Data bisa menyusut (filter, akun dihapus) sehingga halaman aktif jadi tidak
  // valid. State-nya diturunkan saat render, bukan lewat useEffect, supaya tidak
  // terjadi render ganda. Ini pola "adjust state saat props berubah" dari React.
  if (aman !== halaman) setHalamanState(aman)

  const potongan = useMemo(
    () => data.slice((aman - 1) * perHalaman, aman * perHalaman),
    [data, aman, perHalaman],
  )

  return {
    data: potongan,
    halaman: aman,
    totalHalaman,
    total: data.length,
    setHalaman: (h) => setHalamanState(Math.min(Math.max(1, h), totalHalaman)),
    reset: () => setHalamanState(1),
  }
}
