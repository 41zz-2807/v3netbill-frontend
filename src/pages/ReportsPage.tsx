import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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

  const chartRows = range ? toChartRows(range.daftar) : []
  const tabelLaporan = useMemo(
    () => (range ? urutkanTerbaru(range.daftar, (d) => d.tanggal) : []),
    [range],
  )

  const barisUptimePc = useMemo(() => barisUptime(uptime), [uptime])
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
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              Total {formatDurasiPendek(totalUptimeDetik)} dari {uptime.pcs.length} PC
            </span>
          </div>

          {barisUptimePc.length > 0 ? (
            <>
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
                      <th className="px-3 py-2 text-right">Menit</th>
                      <th className="px-3 py-2 text-right">Jam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...barisUptimePc]
                      .sort((a, b) => b.menit - a.menit)
                      .map((baris) => (
                        <tr key={baris.namaPc}>
                          <td className="px-3 py-2 font-medium text-slate-900">{baris.namaPc}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {baris.menit}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {(baris.menit / 60).toFixed(1)}
                          </td>
                        </tr>
                      ))}
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