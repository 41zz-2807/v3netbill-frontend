import { useEffect, useMemo, useState } from 'react'
import type { Pc } from '../../lib/types.ts'
import type { HasilAutoUpdate } from '../../lib/api.ts'
import { setAutoUpdatePc } from '../../lib/api.ts'
import { Modal } from '../../components/ui/Modal.tsx'
import { PastelCard } from '../../components/ui/PastelCard.tsx'

/**
 * Panel multi-select pembaruan otomatis.
 *
 * ⚠️ Yang dijaga di sini: **hanya PC yang dicentang yang tersentuh.**
 * Konsep awal memakai satu sakelar global untuk seluruh warnet, dan itu
 * dibatalkan — menyalakannya akan menggerakkan semua agent sekaligus,
 * termasuk PC yang sedang dipakai pelanggan. Karena itu di layar ini tidak
 * ada jalan memperbarui semua PC tanpa mencentangnya satu per satu, dan itu
 * memang disengaja.
 */
export function PanelUpdateAuto({
  pcs,
  dipilih,
  setDipilih,
  onSelesai,
}: {
  /** Baris PC yang sedang tampil di halaman ini (bukan seluruh daftar). */
  pcs: Pc[]
  dipilih: Set<string>
  setDipilih: (s: Set<string>) => void
  /** Dipanggil setelah server menjawab, supaya halaman bisa memuat ulang. */
  onSelesai: () => void
}) {
  const [konfirmasi, setKonfirmasi] = useState<'nyalakan' | 'matikan' | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [hasil, setHasil] = useState<HasilAutoUpdate[]>([])

  const daftarId = useMemo(() => pcs.map((p) => p.id), [pcs])

  /**
   * ⚠️ Hanya PC yang BELUM berflag boleh dicentang.
   *
   * Server mengabaikan PC yang sudah berflag, jadi mencentangnya tidak akan
   * melakukan apa pun — dan operator akan mengira tandanya diterima. Putusan
   * "batalkan update" punya jalurnya sendiri di bawah.
   */
  const sudahBerflag = useMemo(
    () => pcs.filter((p) => p.autoUpdate).map((p) => p.id),
    [pcs],
  )
  const bisaDipilih = useMemo(
    () => pcs.filter((p) => !p.autoUpdate).map((p) => p.id),
    [pcs],
  )
  const semuaDipilih = bisaDipilih.length > 0 && bisaDipilih.every((id) => dipilih.has(id))

  function toggleSemua() {
    setDipilih(semuaDipilih ? new Set() : new Set(bisaDipilih))
  }

  async function kirim(aktif: boolean) {
    const ids = [...dipilih]
    if (ids.length === 0) return
    setSibuk(true)
    setGalat(null)
    setPesan(null)
    try {
      const r = await setAutoUpdatePc(ids, aktif)
      setHasil(r.hasil)
      const ditolak = r.hasil.filter((h) => h.ditolak)
      if (ditolak.length === 0) {
        const offline = r.hasil.filter((h) => !h.terkirim).length
        setPesan(
          offline > 0
            ? `${r.berhasil} PC ditandai. ${offline} tidak tersambung ke server — update berjalan sendiri begitu agent konek lagi.`
            : `${r.berhasil} PC ditandai. Update berjalan begitu tidak ada sesi di PC itu.`,
        )
        setDipilih(new Set())
      } else {
        const nama = ditolak.map((h) => h.namaPc || h.id.slice(0, 6)).join(', ')
        setGalat(
          `${r.berhasil} PC berhasil, ${ditolak.length} ditolak: ${nama}. PC versi lama tidak bisa memperbarui dirinya sendiri.`,
        )
        // Yang ditolak tetap dicentang supaya operator bisa membacanya lagi,
        // sisanya dibebaskan supaya tidak terkurung tanpa sengaja.
        setDipilih(new Set(ditolak.map((h) => h.id)))
      }
      onSelesai()
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e))
    } finally {
      setSibuk(false)
      setKonfirmasi(null)
    }
  }

  const jumlahDipilih = dipilih.size

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={semuaDipilih}
            onChange={toggleSemua}
            disabled={bisaDipilih.length === 0}
            aria-label="Pilih semua PC"
            className="h-4 w-4 rounded border-slate-300"
          />
          <span>
            Pilih semua ({bisaDipilih.length} dari {daftarId.length} PC)
          </span>
        </label>

        {jumlahDipilih > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600">{jumlahDipilih} PC dipilih</span>
            <button
              type="button"
              onClick={() => setKonfirmasi('nyalakan')}
              disabled={sibuk}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Perbarui {jumlahDipilih} PC
            </button>
            <button
              type="button"
              onClick={() => setDipilih(new Set())}
              disabled={sibuk}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Batal pilih
            </button>
          </div>
        )}
      </div>

      {sudahBerflag.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-sm text-amber-900">
            {sudahBerflag.length} PC sedang ditandai untuk pembaruan
          </span>
          <button
            type="button"
            onClick={() => {
              setDipilih(new Set(sudahBerflag))
              setKonfirmasi('matikan')
            }}
            disabled={sibuk}
            className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            Batalkan pembaruan
          </button>
        </div>
      )}

      {pesan && <div className="mb-3 text-sm text-green-700">{pesan}</div>}
      {galat && <div className="mb-3 text-sm text-red-600">{galat}</div>}

      {hasil.length > 0 && (
        <ul className="mb-3 space-y-1 text-xs">
          {hasil.map((h) => (
            <li key={h.id} className={h.ditolak ? 'text-red-600' : 'text-slate-600'}>
              <span className="font-medium">{h.namaPc}</span>{' '}
              {h.ditolak ?? (h.terkirim ? 'diterima' : 'menunggu agent konek')}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={konfirmasi !== null}
        onClose={() => setKonfirmasi(null)}
        locked={sibuk}
        label={konfirmasi === 'matikan' ? 'Batalkan pembaruan' : 'Perbarui PC'}
      >
        <PastelCard
          label={konfirmasi === 'matikan' ? 'PEMBATALAN' : 'PEMBARUAN'}
          title={konfirmasi === 'matikan' ? 'Batalkan Pembaruan?' : `Perbarui ${jumlahDipilih} PC?`}
          onClose={() => setKonfirmasi(null)}
          closeDisabled={sibuk}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 16v-4M12 8h.01M12 22a10 10 0 100-20 10 10 0 000 20z" />
            </svg>
          }
        >
          <p className="text-sm text-slate-600">
            {konfirmasi === 'matikan'
              ? `${jumlahDipilih} PC akan kembali bisa dilogin dan dihitung lagi untuk auto-matikan.`
              : `${jumlahDipilih} PC akan ditandai untuk pembaruan otomatis.`}
          </p>

          {konfirmasi === 'nyalakan' && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>Sesi yang sedang berjalan dibiarkan. Update berjalan setelah pelanggan berhenti.</li>
              <li>PC menolak sesi baru sampai pembaruan selesai.</li>
              <li>PC tidak dimatikan otomatis selama ditandai.</li>
              <li>Setelah selesai, PC restart sendiri lalu langsung bisa dilogin lagi.</li>
            </ul>
          )}

          <p className="mt-3 text-xs text-slate-500">
            {konfirmasi === 'nyalakan'
              ? 'Jangan matikan listrik PC tersebut selama pembaruan berjalan.'
              : 'PC yang pembaruannya sedang berjalan akan berhenti.'}
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setKonfirmasi(null)}
              disabled={sibuk}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void kirim(konfirmasi === 'nyalakan')}
              disabled={sibuk}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {sibuk
                ? 'Memproses...'
                : konfirmasi === 'matikan'
                  ? 'Batalkan pembaruan'
                  : 'Perbarui'}
            </button>
          </div>
        </PastelCard>
      </Modal>
    </>
  )
}

/**
 * Badge progres pembaruan di dalam baris PC.
 *
 * ⚠️ Sengaja TIDAK memakai `ProgressBar` yang sudah ada. Komponen itu untuk
 * unduhan APK dan punya tinggi sendiri; di dalam sel tabel ia membuat baris
 * membengkak dan kolom Versi kehilangan ruang yang cuma 8%.
 */
export function BadgeUpdate({ pc }: { pc: Pc }) {
  if (!pc.autoUpdate) return null
  const persen = typeof pc.autoUpdatePercen === 'number' ? pc.autoUpdatePercen : null
  return (
    <span
      className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
      title={pc.autoUpdatePesan ?? 'PC sedang disiapkan untuk pembaruan otomatis'}
    >
      <span
        className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
        aria-hidden="true"
      />
      Update
      {persen !== null && <span className="tabular-nums">{persen}%</span>}
    </span>
  )
}

/**
 * Polling ringan selama ada PC yang sedang diperbarui.
 *
 * ⚠️ Polling, bukan WebSocket. Halaman PC selama ini REST, dan menambah
 * socket baru berarti pekerjaan dan risiko baru hanya untuk satu bilangan
 * persen yang jarang berubah.
 *
 * ⚠️ Polling **hanya** jalan saat ada PC berflag. Tanpa syarat itu, halaman
 * PC akan meminta ke server tiap 5 detik sepanjang hari tanpa ada yang perlu
 * dilihat.
 *
 * ⚠️ `jalankan` sengaja masuk ke daftar dependensi. Kalau tidak, `useEffect`
 * hanya melihat fungsi pertama yang dibuat saat render — memakai fungsi itu
 * membuat polling berhenti total, dan gejalanya "progress tidak pernah
 * bergerak" padahal server sudah mengirim angka baru.
 */
export function usePollingAutoUpdate(aktif: boolean, jalankan: () => void): void {
  useEffect(() => {
    if (!aktif) return
    // ⚠️ `jalankan` sengaja ikut jadi dependensi. Tanpanya, `useEffect` hanya
    // melihat fungsi pertama yang dibuat saat render — memakai fungsi itu membuat
    // polling berhenti total, dan gejalanya "progress tidak pernah bergerak".
    // Caller wajib mengstabilkannya dengan `useCallback`, bukan membuat panah
    // inline di sini.
    const t = setInterval(() => void jalankan(), 5000)
    return () => clearInterval(t)
  }, [aktif, jalankan])
}