import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import {
  fetchTodayReport,
  fetchRangeReport,
  fetchUptime,
  formatRupiah,
  formatWaktu,
  unduhUptimePdf,
} from '../lib/api.ts'
import type { DailyReport, RangeReport, UptimeRingkasan } from '../lib/types.ts'
import { Pagination } from '../components/ui/Pagination.tsx'
import {
  PER_HALAMAN,
  usePagination,
  urutkanTerbaru,
} from '../hooks/usePagination.ts'
import ProgressBar from '../components/ui/ProgressBar.tsx'

const WARNA_VOUCHER = '#8b5cf6'
const WARNA_MEMBER = '#10b981'
const WARNA_LOGIN = '#f59e0b'
const WARNA_UPTIME = '#0ea5e9'

function today(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function labelTanggal(t: string): string {
  return new Date(t + 'T00:00:00Z')
    .toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      // ⚠️ WAJIB — lihat catatan di `formatWaktu()` pada `src/lib/api.ts`.
      // String `T00:00:00Z` berarti 00:00 UTC = 07:00 WIB, jadi tanggalnya
      // tidak bergeser di zona WIB — tapi PC kasir yang disetel di zona
      // belakang UTC (mis. UTC-5) akan melihat tanggalnya mundur satu hari.
      timeZone: 'Asia/Jakarta',
    })
    .replace('.', '')
}

interface ChartRow {
  tanggal: string
  pendapatanVoucher: number
  pendapatanMember: number
  voucher: number
  member: number
  login: number
}

function toChartRows(daftar: DailyReport[]): ChartRow[] {
  return daftar.map((d) => ({
    tanggal: d.tanggal,
    pendapatanVoucher: d.pendapatanVoucher,
    pendapatanMember: d.pendapatanMember,
    voucher: d.voucherTerbentuk + d.voucherTopup,
    member: d.memberTerbentuk + d.memberTopup,
    login: d.totalLogin,
  }))
}

function rupiahCompact(n: number): string {
  if (n >= 1000000) return `Rp ${(n / 1000000).toFixed(1)}jt`
  if (n >= 1000) return `Rp ${Math.round(n / 1000)}rb`
  return `Rp ${n}`
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 p-3">
      <div className="text-2xl font-bold tabular-nums text-slate-900 break-words">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <p className="mb-3 text-xs text-slate-500">{subtitle}</p>
      <div className="h-56">{children}</div>
    </div>
  )
}


/**
 * Baris untuk grafik uptime: satu baris per PC, satuan MENIT.
 *
 * ⚠️ Sumbu X = nama PC, sumbu Y = menit — sesuai yang diminta, dan bukan
 * "per hari". Jadi kalau rentang di form lebih dari satu hari, angkanya
 * adalah total menit PC menyala selama rentang itu, bukan rata-rata per hari.
 * Karena itu tooltip-nya juga menuliskan jamnya, supaya angka menit yang
 * besar tetap bisa dibaca dengan cepat.
 */
function barisUptime(u: UptimeRingkasan | null): Array<{ namaPc: string; menit: number }> {
  if (!u) return []
  return u.pcs.map((pc) => ({ namaPc: pc.namaPc, menit: Math.round(pc.detik / 60) }))
}

/**
 * Data grafik HARIAN: satu titik per tanggal dalam rentang filter.
 *
 * ⚠️ Grafik per-PC di bawah memakai `pc.detik` — jumlah SELURUH rentang.
 * Meskipun angka ikut ter-filter, efeknya tidak pernah kelihatan: ganti 7
 * hari ke 1 hari hanya mengubah angka total, bukan bentuk grafik.
 *
 * Grafik ini memakai `perHari`, jadi tanggal yang muncul di sumbu X adalah
 * tanggal-tanggal yang ada di dalam filter. Memilih 1 hari = satu titik,
 * memilih 30 hari = 30 titik. Itulah arti sebenarnya dari "grafik ikut filter".
 */
function barisUptimeHarian(
  u: UptimeRingkasan | null,
): Array<Record<string, string | number>> {
  if (!u) return []
  return u.tanggal.map((t) => {
    const baris: Record<string, string | number> = { tanggal: labelTanggalRingkas(t) }
    for (const pc of u.pcs) {
      baris[pc.namaPc] = Math.round(
        (pc.perHari.find((h) => h.tanggal === t)?.detik ?? 0) / 60,
      )
    }
    return baris
  })
}

/** "2026-10-06" -> "6 Okt". Tahun tidak perlu: filter maksimum 366 hari. */
function labelTanggalRingkas(tanggal: string): string {
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal)
  if (!m) return tanggal
  return `${Number(m[3])} ${bulan[Number(m[2]) - 1] ?? m[2]}`
}

/** Palet per-PC untuk garis harian —_%Grey_%_harus berbeda agar tidak tumpang. */
const WARNA_GARIS = [
  '#0ea5e9', '#f97316', '#22c55e', '#a855f7', '#ef4444',
  '#14b8a6', '#eab308', '#ec4899', '#3b82f6', '#84cc16',
]

/** Durasi ringkas untuk badge: "2j 15m" atau "45m". */
function formatDurasiPendek(detik: number): string {
  const total = Math.max(0, Math.floor(detik))
  const jam = Math.floor(total / 3600)
  const menit = Math.floor((total % 3600) / 60)
  if (jam > 0) return `${jam}j ${menit}m`
  return `${menit}m`
}

/**
 * Label sumbu Y — angka mentah dalam MENIT.
 *
 * ⚠️ Label "menit" TIDAK dipasang sebagai `label` pada YAxis. Dengan
 * `position: insideTopLeft`, teksnya menimpa tick teratas dan terbaca
 * "men6000". Satuannya sudah disebut di subjudul kartu, jadi mengulang di
 * sumbu hanya menambah tabrakan.
 *
 * ⚠️ Sengaja TIDAK diubah jadi jam kalau angka sudah besar. Format yang
 * berganti-ganti di satu sumbu membuat pembacaan salah: `75j` dan `900m` di
 * sumbu yang sama terlihat seperti dua satuan berbeda, padahal keduanya
 * durasi. Menit tetap terbaca sampai ratusan ribu, jadi tidak ada kebutuhan
 * untuk menyingkat. Jam tersedia di tooltip dan di tabel.
 */
function labelMenit(nilai: number): string {
  return String(Math.round(nilai))
}

export default function ReportsPage() {
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null)
  const [range, setRange] = useState<RangeReport | null>(null)
  const [uptime, setUptime] = useState<UptimeRingkasan | null>(null)
  const [dari, setDari] = useState(daysAgo(6))
  const [sampai, setSampai] = useState(today())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      const [t, r, u] = await Promise.all([
        fetchTodayReport(),
        fetchRangeReport(dari, sampai),
        fetchUptime(dari, sampai),
      ])
      setTodayReport(t)
      setRange(r)
      setUptime(u)
      setError(null)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function applyRange(e: React.FormEvent) {
    e.preventDefault()
    resetHalaman()
    void load()
  }

  /**
   * Unduh PDF laporan uptime.
   *
   * ⚠️ Rentang yang dikirim HARUS sama dengan yang sedang tampil. Kalau tidak,
   * kasir mengunduh PDF 7 hari sementara layarnya 1 hari, dan keduanya sama
   *-sama "benar" — sumber kebingungan yang tidak punya gejala sama sekali.
   */
  async function unduhPdf() {
    setSedangUnduh(true)
    try {
      await unduhUptimePdf(dari, sampai)
      setError(null)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setSedangUnduh(false)
    }
  }

  /**
   * Unduh PDF laporan uptime.
   *
   * ⚠️ Rentang yang dikirim HARUS sama dengan yang sedang tampil. Kalau tidak,
   * kasir mengunduh PDF 7 hari sementara layarnya 1 hari, dan keduanya sama
   *-sama "benar" — sumber kebingungan yang tidak punya gejala sama sekali.
   */
  const chartRows = range ? toChartRows(range.daftar) : []
  const tabelLaporan = useMemo(
    () => (range ? urutkanTerbaru(range.daftar, (d) => d.tanggal) : []),
    [range],
  )

  const barisUptimePc = useMemo(() => barisUptime(uptime), [uptime])
  const barisHarian = useMemo(() => barisUptimeHarian(uptime), [uptime])
  const [sedangUnduh, setSedangUnduh] = useState(false)
  const totalUptimeDetik = useMemo(
    () => (uptime ? uptime.pcs.reduce((n, pc) => n + pc.detik, 0) : 0),
    [uptime],
  )
  const {
    data: barisLaporan,
    halaman,
    totalHalaman,
    total,
    setHalaman,
    reset: resetHalaman,
  } = usePagination(tabelLaporan)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Laporan</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-semibold text-slate-800">Laporan Hari Ini</h2>
        <p className="-mt-1 mb-3 text-xs text-slate-500">
          Periode tutup hari: 23:30 WIB. Di jam 23:30 transaksi keuangan otomatis tutup hari dan kembali ke 0 untuk hari berikutnya.
        </p>
        {loading ? (
          <div className="p-4"><ProgressBar label="Memuat laporan" value={null} /></div>
        ) : todayReport ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Total Login" value={String(todayReport.totalLogin)} />
            <MiniStat
              label="Pendapatan Voucher"
              value={formatRupiah(todayReport.pendapatanVoucher)}
            />
            <MiniStat
              label="Pendapatan Member"
              value={formatRupiah(todayReport.pendapatanMember)}
            />
            <MiniStat
              label="Total Pendapatan"
              value={formatRupiah(
                todayReport.pendapatanVoucher + todayReport.pendapatanMember,
              )}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-400">Belum ada data hari ini.</p>
        )}
      </div>

      <form
        onSubmit={applyRange}
        className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"
      >
        <h2 className="font-semibold text-slate-800 sm:self-center">Laporan Rentang</h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Dari</label>
          <input
            type="date"
            value={dari}
            onChange={(e) => setDari(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Sampai</label>
          <input
            type="date"
            value={sampai}
            onChange={(e) => setSampai(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          Tampilkan
        </button>
      </form>

      {chartRows.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard title="Grafik Keuangan" subtitle="Pendapatan per hari (Voucher & Member)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="tanggal"
                  tickFormatter={labelTanggal}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis
                  tickFormatter={rupiahCompact}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  width={64}
                />
                <Tooltip
                  labelFormatter={(l) => formatWaktu(String(l) + 'T00:00:00')}
                  formatter={(value, name) => [formatRupiah(Number(value ?? 0)), String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pendapatanVoucher" name="Voucher" fill={WARNA_VOUCHER} radius={[3, 3, 0, 0]} />
                <Bar dataKey="pendapatanMember" name="Member" fill={WARNA_MEMBER} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Grafik Pemakaian PC" subtitle="Total login / sesi per hari">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="tanggal"
                  tickFormatter={labelTanggal}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={32} allowDecimals={false} />
                <Tooltip labelFormatter={(l) => formatWaktu(String(l) + 'T00:00:00')} />
                <Bar dataKey="login" name="Login" fill={WARNA_LOGIN} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Grafik Voucher & Member" subtitle="Jumlah transaksi per hari">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="tanggal"
                  tickFormatter={labelTanggal}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={32} allowDecimals={false} />
                <Tooltip labelFormatter={(l) => formatWaktu(String(l) + 'T00:00:00')} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="voucher" name="Voucher" fill={WARNA_VOUCHER} radius={[3, 3, 0, 0]} />
                <Bar dataKey="member" name="Member" fill={WARNA_MEMBER} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

      {/* ⚠️ Lebar penuh (xl:col-span-3), bukan 1/3 kolom seperti yang lain.
          Sumbu X di sini adalah NAMA PC — bukan tanggal — jadi butuh ruang
          supaya "PC001" tidak terpotong jadi "PC0…". Kalau ikut 1/3 kolom,
          setiap nama PC jadi tidak terbaca dan grafiknya jadi tidak berguna. */}
      {uptime && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 xl:col-span-3">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Grafik Uptime PC</h3>
              <p className="text-xs text-slate-500">
                Berapa lama tiap PC menyala dalam menit, dihitung dari heartbeat
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                Total {formatDurasiPendek(totalUptimeDetik)} dari {uptime.pcs.length} PC
              </span>
              <button
                type="button"
                onClick={() => void unduhPdf()}
                disabled={sedangUnduh}
                title="Unduh laporan ini sebagai PDF"
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                <IkonUnduh />
                {sedangUnduh ? 'Menyiapkan...' : 'Download PDF'}
              </button>
            </div>
          </div>

          {/* ⚠️ Angka ini ESTIMASI, bukan hasil pengukuran-listrik.
              Sumbernya: heartbeat agent yang dicatat tiap 60 detik x daya
              (watt) per PC. Jadi hanya sebesar waktu PC menyala — bukan
              sebesar daya nyatanya, yang berbeda menurut beban (idle, HD, game).

              ⚠️ 2.200 VA di meter itu KAPASITAS SAMBUNGAN, bukan watt PC.
              Kalau angka itu dipakai, biaya di sini jadi ~15x lipat lebih
              besar dan format rupiahnya tetap meyakinkan. */}
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KartuListrik
              label="Total energi"
              nilai={`${formatKwh(uptime.listrik.totalKwh, 2)} kWh`}
              ket={`${uptime.pcs.length} PC x ${formatDurasiPendek(uptime.listrik.totalDetik)} menyala`}
            />
            <KartuListrik
              label="Estimasi biaya listrik"
              nilai={formatRupiahBulat(uptime.listrik.totalRupiah)}
              ket={`Tarif ${formatTarif(uptime.listrik.tarifPerKwh)}/kWh`}
            />
            <KartuListrik
              label="Rata-rata per hari"
              nilai={formatRupiahBulat(
                uptime.tanggal.length > 0 ? uptime.listrik.totalRupiah / uptime.tanggal.length : 0,
              )}
              ket={`${uptime.tanggal.length} hari`}
            />
            <KartuListrik
              label="Total daya terpasang"
              nilai={`${uptime.listrik.totalWatt.toLocaleString('id-ID')} W`}
              ket={
                uptime.listrik.totalWatt > 0
                  ? `${uptime.pcs.length} PC rata-rata ${Math.round(
                      uptime.listrik.totalWatt / uptime.pcs.length,
                    )} W`
                  : '—'
              }
            />
          </div>

          {barisUptimePc.length > 0 ? (
            <>
              {/* ⚠️ Grafik HARIAN ini yang benar-benar "ikut filter".
                  Sumbu X = tanggal dalam rentang, jadi memilih 1 hari
                  menghasilkan satu titik dan memilih 30 hari 30 titik.
                  Grafik batang di bawahnya tetap per-PC (total rentang),
                  jadi dua-duanya dipertahankan — yang mana yang dicari
                  kasir tergantung pertanyaannya. */}
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700">
                  Uptime harian per PC (menit)
                </p>
                <p className="text-[11px] text-slate-500">
                  {barisHarian.length} hari sesuai filter
                </p>
              </div>
              <div className="mb-4 h-64" aria-label="Grafik uptime harian per PC">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={barisHarian}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="tanggal"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      interval="preserveStartEnd"
                      minTickGap={12}
                    />
                    <YAxis
                      tickFormatter={labelMenit}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      width={56}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(v, nama) => [`${Number(v ?? 0)} menit`, String(nama)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" iconSize={8} />
                    {uptime.pcs.map((pc, i) => (
                      <Line
                        key={pc.id}
                        type="monotone"
                        dataKey={pc.namaPc}
                        stroke={WARNA_GARIS[i % WARNA_GARIS.length]}
                        strokeWidth={2}
                        dot={{ r: 2.5 }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barisUptimePc} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="namaPc"
                      tick={{ fontSize: 12, fill: '#475569' }}
                      interval={0}
                    />
                    <YAxis
                      tickFormatter={labelMenit}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      width={56}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(v, nama) => {
                        const menit = Number(v ?? 0)
                        return [
                          `${menit} menit (${(menit / 60).toFixed(1)} jam)`,
                          String(nama),
                        ]
                      }}
                    />
                    <Bar dataKey="menit" name="Menit menyala" fill={WARNA_UPTIME} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ⚠️ Data ini BUKAN historis. `Pc.lastHeartbeatAt` hanya
                  menyimpan heartbeat terakhir (ditimpa tiap 15 detik) dan
                  koneksi tidak pernah ditulis ke database, jadi tidak ada
                  angka sebelum pencatat ini dijalankan. Tanpa catatan ini,
                  grafik kosong akan disalahpakai sebagai "PC-nya mati". */}
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Angka mulai terisi sejak pencatat uptime dijalankan — tidak ada
                data sebelum itu. PC dengan baris kosong berarti belum tercatat
                menyala, bukan berarti datanya bermasalah.
              </p>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-max text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">PC</th>
                      <th className="px-3 py-2 text-right">Watt</th>
                      <th className="px-3 py-2 text-right">Menit</th>
                      <th className="px-3 py-2 text-right">Jam</th>
                      <th className="px-3 py-2 text-right">kWh</th>
                      <th className="px-3 py-2 text-right">Biaya</th>
                    </tr>
                    <tr className="bg-slate-100/70 font-semibold">
                      <td className="px-3 py-2 text-slate-900">Total</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {uptime.listrik.totalWatt.toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {Math.round(uptime.listrik.totalDetik / 60)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {(uptime.listrik.totalDetik / 3600).toFixed(1)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatKwh(uptime.listrik.totalKwh, 2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                        {formatRupiahBulat(uptime.listrik.totalRupiah)}
                      </td>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...barisUptimePc]
                      .sort((a, b) => b.menit - a.menit)
                      .map((baris) => {
                        const pc = uptime.pcs.find((x) => x.namaPc === baris.namaPc)
                        return (
                          <tr key={baris.namaPc}>
                            <td className="px-3 py-2 font-medium text-slate-900">{baris.namaPc}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                              {pc?.watt ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                              {baris.menit}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                              {(baris.menit / 60).toFixed(1)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                              {formatKwh(pc?.kwh ?? 0, 3)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                              {formatRupiahBulat(pc?.rupiah ?? 0)}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">
              Belum ada PC yang tercatat pada rentang ini.
            </p>
          )}
        </div>
      )}
        </div>
      )}

      {range && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-800">
            Ringkasan {range.dari} — {range.sampai}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Total Login" value={String(range.totalLogin)} />
            <MiniStat label="Voucher Dibuat" value={String(range.voucherTerbentuk)} />
            <MiniStat label="Voucher Topup" value={String(range.voucherTopup)} />
            <MiniStat label="Member Baru" value={String(range.memberTerbentuk)} />
            <MiniStat label="Member Topup" value={String(range.memberTopup)} />
            <MiniStat
              label="Pendapatan Voucher"
              value={formatRupiah(range.pendapatanVoucher)}
            />
            <MiniStat
              label="Pendapatan Member"
              value={formatRupiah(range.pendapatanMember)}
            />
            <MiniStat
              label="Total Pendapatan"
              value={formatRupiah(range.totalPendapatan)}
            />
          </div>
        </div>
      )}

      {range && range.daftar.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Tanggal</th>
                <th className="px-4 py-2">Login</th>
                <th className="px-4 py-2">Voucher</th>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2 text-right">Pendapatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {barisLaporan.map((d) => (
                <tr key={d.tanggal} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-600">{formatWaktu(d.tanggal + 'T00:00:00')}</td>
                  <td className="px-4 py-2 tabular-nums">{d.totalLogin}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {d.voucherTerbentuk + d.voucherTopup}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{d.memberTerbentuk + d.memberTopup}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatRupiah(d.pendapatanVoucher + d.pendapatanMember)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalHalaman > 1 && (
            <Pagination
              currentPage={halaman}
              totalPages={totalHalaman}
              onPageChange={setHalaman}
              totalItems={total}
              itemsPerPage={PER_HALAMAN}
            />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Satu kartu angka listrik di atas grafik uptime.
 *
 * ⚠️ `nilai` sudah diformat di luar, komponen ini tidak tahu satuan apa pun
 * — supaya kWh (desimal) dan rupiah (pemisah ribuan) bisa tampil berdampingan
 * tanpa satu pun jadi salah bulat.
 */
function KartuListrik({
  label,
  nilai,
  ket,
}: {
  label: string
  nilai: string
  ket: string
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-900">{nilai}</div>
      <div className="text-[11px] text-slate-500">{ket}</div>
    </div>
  )
}

/**
 * kWh dengan pemisah desimal Indonesia (koma).
 *
 * ⚠️ `toFixed()` memakai titik — hasilnya "2.60 kWh" bersebelahan dengan
 * "Rp 3.752" yang pakai koma. Dua format berbeda dalam satu tampilan, dan
 * pembaca biasanya hanya memperhatikan satu kolom, jadi tidak menangkapnya.
 * `toLocaleString('id-ID')` memakai pemisah yang sama dengan format uang
 * yang sudah dipakai di seluruh aplikasi.
 */
function formatKwh(n: number, desimal: number): string {
  return n.toLocaleString('id-ID', {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  })
}

/**
 * Rupiah untuk DIJUALKAN: bulat, tanpa desimal.
 *
 * ⚠️ `formatRupiah()` di `lib/api.ts` memakai `toLocaleString('id-ID')` tanpa
 * pembulatan, jadi nilainya ikut membawa desimal — hasilnya `Rp 3.751,535`.
 * Itu bukan format uang dan kasir akan berhenti mempercayai angkanya.
 *
 * Pembulatan ke rupiah terdekat AMAN di sini, bukan kehilangan informasi:
 * presisi kWh sudah tampil sendiri di kolom kWh (3 desimal), jadi angka
 * kilowatt-hour yang bisa hilang jauh lebih kecil dari satu sen.
 */
function formatRupiahBulat(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

/**
 * Tarif per kWh: dua desimal, karena ini TARIF bukan jumlah tagihan.
 *
 * ⚠️ `toLocaleString` tanpa `minimumFractionDigits` mengubah `1444.7` jadi
 * `1.444,7` — padahal PLN mencantumkan `Rp 1.444,70`, dan angka yang berbeda
 * satu digit terakhir dari daftar tarif resmi itu menimbulkan keraguan sendiri.
 */
function formatTarif(n: number): string {
  return `Rp ${n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Ikon unduh — dipakai tombol Download PDF di kartu laporan uptime. */
function IkonUnduh() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" />
    </svg>
  )
}
