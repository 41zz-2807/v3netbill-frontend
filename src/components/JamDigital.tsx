import { useEffect, useState } from 'react'

/**
 * Jam digital 24 jam di header, zona WIB.
 *
 * ⚠️ `timeZone: 'Asia/Jakarta'` itu WAJIB, bukan opsional. Tanpa itu, jam ikut
 * zona yang disetel di PC kasir — PC yang disetel UTC atau zona mana pun di
 * belakang UTC akan menampilkan jam yang meleset beberapa jam, dan di aplikasi
 * billing jam yang salah lebih buruk daripada tidak ditampilkan. Pola yang
 * sama sudah dipakai `formatWaktu()` di `src/lib/api.ts`.
 *
 * ⚠️ Jam dirakit dari `formatToParts()`, bukan dari `format()` langsung.
 * `id-ID` memakai TITIK sebagai pemisah waktu — hasilnya `16.36.49`, bukan
 * `16:36:49`. Menempelkan titik di mana pun tidak akan cocok untuk semua locale, jadi lebih
 * aman dirakit sendiri dari bagian-bagiannya.
 *
 * ⚠️ `hourCycle: 'h23'` dipakai sebagai gantinya `hour12: false`. Di sebagian
 * versi ICU, `hour12: false` memetakan ke siklus `h24`, dan tengah malam
 * ditulis `24:00:00` — angka jam yang tidak pernah ada di jam digital.
 */
const FORMATTER = new Intl.DateTimeFormat('id-ID', {
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Asia/Jakarta',
})

function jamSekarang(): string {
  const bagian = FORMATTER.formatToParts(new Date())
  const ambil = (jenis: Intl.DateTimeFormatPartTypes): string =>
    bagian.find((b) => b.type === jenis)?.value ?? '00'
  return `${ambil('hour')}:${ambil('minute')}:${ambil('second')}`
}

export default function JamDigital() {
  const [jam, setJam] = useState(jamSekarang)
  const [sempit, setSempit] = useState(
    typeof window === 'undefined' ? false : window.innerWidth < 640,
  )

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const jadwalkan = () => {
      // Ditunggu sampai awal detik berikutnya, supaya angka yang tampil berganti
      // tepat pada detiknya — bukan beberapa milidetik setelahnya, dan tidak
      // pernah melompati satu detik.
      const tunggu = 1000 - (Date.now() % 1000)
      timer = setTimeout(() => {
        setJam(jamSekarang())
        jadwalkan()
      }, tunggu)
    }
    jadwalkan()

    const cekLebar = () => setSempit(window.innerWidth < 640)
    window.addEventListener('resize', cekLebar)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', cekLebar)
    }
  }, [])

  return (
    <span
      className={`flex shrink-0 items-center rounded-full bg-white/10 text-white ${
        sempit ? 'gap-0 px-2.5 py-1' : 'gap-2 px-3 py-1.5'
      }`}
      // ⚠️ `tabular-nums` wajib. Tanpa itu tiap digit punya lebar berbeda,
      // sehingga angka jam bergeser tiap detik dan seluruh header ikut bergerak.
      style={{ fontVariantNumeric: 'tabular-nums' }}
      title="Waktu Indonesia Barat (WIB)"
    >
      {/* Di layar sempit ikon dan label "WIB" disembunyikan supaya jam tetap
          muat. Keterangan zone waktu tetap ada sebagai teks untuk pembaca
          layar, jadi informasinya tidak hilang. */}
      {!sempit && (
        <svg
          className="h-4 w-4 opacity-80"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )}
      <span className={`font-mono font-semibold tracking-wide ${sempit ? 'text-xs' : 'text-sm'}`}>
        {jam}
      </span>
      {!sempit && <span className="text-[10px] font-medium opacity-70">WIB</span>}
      <span className="sr-only">Waktu Indonesia Barat</span>
    </span>
  )
}