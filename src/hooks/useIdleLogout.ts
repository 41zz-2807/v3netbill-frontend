import { useEffect, useRef } from 'react'

/** Batas tanpa aktivitas sebelum sesi dikunci: 5 menit. */
const IDLE_MS = 5 * 60 * 1000

/**
 * Event yang dianggap sebagai "operator masih bekerja". `pointermove` ikut
 * dipakai supaya mouse yang digerakkan tanpa klik (mis. sedang membaca layar)
 * juga menahan penguncian. `focus` tidak dipakai: berpindah tab lalu kembali
 * bukan pekerjaan, hanya menahan timer tanpa alasan.
 */
const AKTIVITAS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const

/**
 * Panggil `onIdle` kalau tidak ada aktivitas selama 5 menit.
 *
 * Cara kerjanya: satu `setInterval` memeriksa satu variabel batas waktu setiap
 * detik, dan setiap event aktivitas hanya menulis ulang variabel itu tanpa
 * menyentuh timer. Jadi `pointermove` yang bisa ratusan kali per detik tidak
 * membuat interval di-restart terus-menerus.
 *
 * `onIdle` dibaca lewat `ref`, bukan dari closure. Kalau callback ikut jadi
 * dependency `useEffect`, setiap render menghasilkan efek baru, dan efek lama
 * yang baru dibersihkan bisa membatalkan timer yang baru dibuat.
 */
export function useIdleLogout(aktif: boolean, onIdle: () => void): void {
  const cb = useRef(onIdle)

  // Ditulis di dalam efek, bukan saat render: lint melarang menyentuh ref
  // saat render, dan nilainya memang baru dipakai 1 detik kemudian.
  useEffect(() => {
    cb.current = onIdle
  })

  useEffect(() => {
    if (!aktif) return

    let batas = Date.now() + IDLE_MS
    const jam = window.setInterval(() => {
      if (Date.now() < batas) return
      window.clearInterval(jam)
      cb.current()
    }, 1000)

    const catatAktivitas = () => {
      batas = Date.now() + IDLE_MS
    }
    for (const e of AKTIVITAS) {
      window.addEventListener(e, catatAktivitas, { passive: true })
    }

    return () => {
      window.clearInterval(jam)
      for (const e of AKTIVITAS) {
        window.removeEventListener(e, catatAktivitas)
      }
    }
  }, [aktif])
}
