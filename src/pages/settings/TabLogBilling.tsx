import { useCallback, useEffect, useState } from 'react'
import { downloadAuth, fetchLogBilling, fetchLogBillingList } from '../../lib/api.ts'
import type { LogBillingIsi, LogBillingRingkas } from '../../lib/types.ts'
import { SettingsCard } from './SettingsCard'
import LogAktivitasCard from './LogAktivitasCard'
import { formatBytes, type SettingsCtx } from './shared'

/** Tanggal hari ini di format yang sama dengan nama berkas di server. */
function hariIni(): string {
  const d = new Date()
  const bulan = String(d.getMonth() + 1).padStart(2, '0')
  const hari = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${bulan}-${hari}`
}

export default function TabLogBilling({ ctx }: { ctx: SettingsCtx }) {
  const { busy, run, setErr, setMsg } = ctx

  const [daftar, setDaftar] = useState<LogBillingRingkas[]>([])
  const [tanggal, setTanggal] = useState<string>(hariIni())
  const [cari, setCari] = useState('')
  const [isi, setIsi] = useState<LogBillingIsi | null>(null)

  const muatDaftar = useCallback(async () => {
    try {
      setDaftar(await fetchLogBillingList())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [setErr])

  const muatIsi = useCallback(
    async (hari: string, kata: string) => {
      try {
        setIsi(await fetchLogBilling(hari, kata))
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    },
    [setErr],
  )

  useEffect(() => {
    void muatDaftar()
  }, [muatDaftar])

  // Tanggal atau kata kunci berubah -> baca ulang. Pencarian di server, bukan
  // difilter dari isi yang sudah ada, supaya jumlah baris yang ditampilkan
  // sama dengan yang dihitung server.
  useEffect(() => {
    void muatIsi(tanggal, cari)
  }, [tanggal, cari, muatIsi])

  async function unduh() {
    await run('log-download', async () => {
      try {
        setErr(null)
        const nama = `log-billing-${tanggal}.txt`
        await downloadAuth(`/log-billing/${encodeURIComponent(tanggal)}/unduh`, nama)
        setMsg(`Log ${tanggal} diunduh: ${nama}`)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const info = daftar.find((d) => d.tanggal === tanggal)

  return (
    <div className="grid gap-5">
      {/* Dua kartu ini satu baris dan DIPAKSA SETINGGI: `items-stretch`
          (default grid) membuat kedua kartu mengikuti tinggi kartu tertinggi
          di baris yang sama, persis seperti yang diminta operator. Daftar
          tanggal ikut memanjang (`flex-1`) supaya ruang kosongnya tidak
          menggantung di bawah daftar, dan tetap bisa digulir
          (`max-h-96`) kalau tanggalnya banyak. */}
      <div className="grid gap-5 sm:grid-cols-2">
      <SettingsCard
        title="Log Billing Harian"
        description="Setiap aktivitas billing — pembuatan akun, topup, sesi berjalan dan berakhir, kunci PC, sampai operator yang menekan — ditulis sebagai berkas teks satu hari satu berkas. Berkas lebih dari 30 hari otomatis dihapus."
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Tanggal</span>
            <input
              type="date"
              value={tanggal}
              max={hariIni()}
              onChange={(e) => setTanggal(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800"
            />
          </label>

          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Cari isi log</span>
            <input
              type="search"
              value={cari}
              placeholder="mis. nama PC, kode voucher, alasan berhenti"
              onChange={(e) => setCari(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800"
            />
          </label>

          <button
            type="button"
            onClick={() => void unduh()}
            disabled={busy !== null || (isi !== null && isi.jumlahDitemukan === 0)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === 'log-download' ? 'Mengunduh...' : 'Unduh .txt'}
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {isi === null ? (
            'Memuat...'
          ) : isi.jumlahDitemukan === 0 ? (
            cari.trim() === ''
              ? 'Tidak ada log pada tanggal ini.'
              : `Tidak ada baris yang cocok dengan "${cari.trim()}".`
          ) : (
            <>
              Menampilkan {isi.jumlahDitemukan} baris
              {cari.trim() === '' && info ? ` · ${formatBytes(info.ukuranBytes)}` : ''}
            </>
          )}
        </p>
      </SettingsCard>

      <SettingsCard
        title="Daftar Tanggal"
        description="Berkas log tersedia, urut dari yang paling baru. Daftar panjang bisa digulir ke bawah. Klik salah satu tanggal untuk membuka isinya."
      >
        {/* ⚠️ JANGAN tambah class `flex` pada <ul> di bawah. `flex` adalah
            utility `display: flex`, bukan bagian dari `flex-1` — dan itu
            membuat <li> tersusun MENYAMPING (row), bukan bertumpuk.
            Gejalanya: daftar tanggal bisa digulir ke samping (scrollWidth
            2060px di kotak 389px) dan tiap tombol tanggal tinggal ~160px.
            Yang dibutuhkan hanya `flex-1` (memanjang mengisi tinggi kartu). */}
        {daftar.length > 0 ? (
          <ul className="min-h-0 max-h-96 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {daftar.map((d) => (
              <li key={d.tanggal}>
                <button
                  type="button"
                  onClick={() => setTanggal(d.tanggal)}
                  className={
                    'flex w-full items-center justify-between gap-3 px-1 py-2 text-left text-sm hover:bg-slate-50 ' +
                    (d.tanggal === tanggal ? 'font-semibold text-slate-900' : 'text-slate-700')
                  }
                >
                  <span>{d.tanggal}</span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                    <span>{d.jumlahBaris} baris</span>
                    <span className="hidden w-16 text-right sm:inline">
                      {formatBytes(d.ukuranBytes)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Belum ada berkas log.</p>
        )}
      </SettingsCard>
      </div>

      <SettingsCard title="Isi Log" description="Satu baris satu aktivitas, urut dari yang paling lama.">
        {isi !== null && isi.baris.length > 0 ? (
          <ol className="max-h-96 space-y-1 overflow-y-auto rounded-md bg-slate-50 p-3">
            {isi.baris.map((b, i) => (
              <li key={i} className="break-all font-mono text-xs leading-relaxed text-slate-700">
                {b}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">
            {isi === null ? 'Memuat...' : 'Tidak ada baris untuk ditampilkan.'}
          </p>
        )}
      </SettingsCard>

      {/* Log Aktivitas dipindahkan dari Dashboard ke sini, supaya dashboard
          tetap fokus pada kartu PC dan kasir tidak perlu menggulir jauh untuk
          melihat jejak aktivitas. */}
      <LogAktivitasCard />
    </div>
  )
}
