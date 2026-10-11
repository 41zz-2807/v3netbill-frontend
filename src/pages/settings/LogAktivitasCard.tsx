import { useCallback, useEffect, useState } from 'react'
import { fetchActivityLogs } from '../../lib/api.ts'
import type { DashboardLog } from '../../lib/types.ts'
import {
  formatLogDetail,
  formatLogWaktu,
  itemKeLog,
  logEventLabel,
  logEventVariant,
} from '../../lib/log-activity.ts'
import { Badge, Pagination, Table, type Column } from '../../components/ui'
import { PER_HALAMAN } from '../../hooks/usePagination.ts'
import { SettingsCard } from './SettingsCard'

/**
 * Log Aktivitas — dipindahkan dari Dashboard ke Pengaturan -> Log Billing.
 *
 * Dashboard memakai koneksi WebSocket yang sama dengan kartu PC, jadi di sana
 * log ikut segar sendiri lewat event `dashboard:log`. Halaman Pengaturan tidak
 * punya koneksi itu, jadi di sini log disegarkan berkala (30 detik) — cukup
 * untuk daftar yang dibaca sesekali, dan tidak menambah beban berarti.
 */
export default function LogAktivitasCard() {
  const [logs, setLogs] = useState<DashboardLog[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const muat = useCallback(async (halaman: number) => {
    setLoading(true)
    try {
      const res = await fetchActivityLogs(halaman, PER_HALAMAN)
      setLogs(res.data.map(itemKeLog))
      setTotalPages(res.totalPages)
      setTotal(res.total)
    } catch {
      // Sengaja dibiarkan kosong: halaman Pengaturan punya banner pesan
      // sendiri, dan log yang gagal dimuat bukan alasan menampilkan error
      // kedua di tengah halaman.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void muat(page)
  }, [page, muat])

  useEffect(() => {
    const id = setInterval(() => void muat(page), 30000)
    return () => clearInterval(id)
  }, [page, muat])

  const columns: Column<DashboardLog>[] = [
    { key: 'at', header: 'Waktu', render: (log) => formatLogWaktu(log.at) },
    {
      key: 'event',
      header: 'Event',
      render: (log) => (
        <Badge variant={logEventVariant(log.event)} size="sm">
          {logEventLabel(log.event)}
        </Badge>
      ),
    },
    {
      key: 'detail',
      header: 'Detail',
      render: (log) => (
        <span className="text-slate-600">{formatLogDetail(log, log.pc)}</span>
      ),
    },
  ]

  return (
    <SettingsCard
      title="Log Aktivitas"
      description="Jejak aktivitas sistem: sesi berjalan/berakhir, transaksi, kunci PC, sampai PC yang mati otomatis."
    >
      {loading && logs.length === 0 ? (
        <div className="flex justify-center p-4 text-sm text-slate-500">Memuat log...</div>
      ) : logs.length === 0 ? (
        <div className="p-4 text-center text-sm text-slate-400">Belum ada aktivitas.</div>
      ) : (
        <>
          {/* ⚠️ Di bawah `lg` tabel DIJADIkan kartu bertumpuk, pola yang sama
              dengan tabel riwayat backup di tab Data. Breakept `lg`, bukan
              `sm`: tabel butuh wrapper minimal ~688px, jadi kartu dipakai
              sampai 1024px. */}
          <ul className="space-y-2 lg:hidden">
            {logs.map((log) => (
              <li
                key={`${log.at}-${log.event}`}
                className="rounded-md border border-slate-200 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={logEventVariant(log.event)} size="sm">
                    {logEventLabel(log.event)}
                  </Badge>
                  <span className="whitespace-nowrap text-xs text-slate-500">
                    {formatLogWaktu(log.at)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {formatLogDetail(log, log.pc)}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
            <Table
              columns={columns}
              data={logs}
              keyExtractor={(log) => `${log.at}-${log.event}`}
              striped
              hoverable
            />
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              showTotal
              totalItems={total}
              itemsPerPage={PER_HALAMAN}
            />
          )}
        </>
      )}
    </SettingsCard>
  )
}
