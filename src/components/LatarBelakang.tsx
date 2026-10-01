/**
 * Lapisan latar belakang untuk seluruh aplikasi.
 *
 * Kenapa komponen, bukan `background-image` di CSS?
 *
 * ⚠️ **`url()` tidak bisa dipakai di CSS file ini sama sekali.** Di kombinasi
 * Tailwind v4 + Vite 8 (Rolldown) yang dipakai project ini, satu deklarasi
 * `url(...)` apa pun — bahkan data URI — bikin build gagal dengan
 * `CssSyntaxError: Missed semicolon` dari postcss. Sudah diuji satu per satu:
 * `url()`, `url("...")`, `url('...')`, path absolut, path relatif, di
 * `background-image`, di `list-style-image`, di `::before`, dan di custom
 * property. Semuanya gagal; `background-color` dan `linear-gradient` aman.
 *
 * Efeknya tidak pernah terlihat sebelumnya karena tidak ada satu pun `url()`
 * di `index.css` — semua warna dan gradien. Sekarang latar ini butuh berkas
 * gambar, jadi masalahnya forcefully ke depan.
 *
 * Solusinya: gambar dipasang lewat `<img>` + `object-cover`, bukan `url()`.
 * Vite menangani referensi asset di JSX dengan baik, dan `public/`
 * disajikan apa adanya tanpa perlu hashing.
 *
 * ⚠️ Foto aslinya gelap (biru tua). `LAPIS PUTIH` 70% yang membuatnya tetap
 * light — jadi gambar benar-benar terlihat 30%, sesuai permintaan. Jangan
 * diturunkan opacity-nya tanpa mengukur kontras teks di atasnya.
 */

const LAPIS_PUTIH = 0.7

export function LatarBelakang() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <img
        src="/bg-globe.jpg"
        alt=""
        className="h-full w-full object-cover"
        style={{ opacity: 1 - LAPIS_PUTIH }}
      />
      <div
        className="absolute inset-0 bg-white"
        style={{ opacity: LAPIS_PUTIH }}
      />
    </div>
  )
}
