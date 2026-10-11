import type { ActivityLogItem } from './api.ts'
import { formatDuration, formatWaktu } from './api.ts'
import type { DashboardLog } from './types.ts'

/**
 * Logika "Log Aktivitas" yang sebelumnya hidup di dalam DashboardPage.
 *
 * Dipisah ke sini karena log yang sama sekarang tampil di dua tempat:
 * Pengaturan -> Log Billing. Kalau logikanya tetap di DashboardPage, tab
 * Pengaturan harus menyalinnya — dan tes yang menyalin nilai produksi hanya
 * mengulang nilai itu (kalau salah, tesnya mengabadikan kesalahannya).
 */

const LOG_EVENT_LABEL: Record<string, string> = {
  'session:started_dashboard': 'Sesi Berjalan',
  'session:started': 'Sesi Berjalan',
  'session:stopped': 'Sesi Berakhir',
  'transaction:created': 'Transaksi',
  'voucher:created_dashboard': 'Voucher Dibuat',
  'voucher:created': 'Voucher Dibuat',
  'account:revoked': 'Akun Dinonaktifkan',
  'account:password_changed': 'Password Diubah',
  pc_lock: 'PC Dikunci',
  pc_locked: 'PC Dikunci',
  pc_unlock: 'PC Dibuka',
  pc_unlocked: 'PC Dibuka',
  pc_shutdown: 'PC Dimatikan',
  pc_shutdown_auto: 'PC Mati Otomatis',
  'teknisi:login': 'Teknisi Login',
  'teknisi:logout': 'Teknisi Keluar',
}

const LOG_EVENT_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  'session:started_dashboard': 'success',
  'session:started': 'success',
  'session:stopped': 'warning',
  'transaction:created': 'info',
  'voucher:created_dashboard': 'success',
  'voucher:created': 'success',
  'account:revoked': 'danger',
  'account:password_changed': 'warning',
  pc_lock: 'warning',
  pc_locked: 'warning',
  pc_unlock: 'info',
  pc_unlocked: 'info',
  pc_shutdown: 'danger',
}

const STOP_REASON: Record<string, string> = {
  habis: 'Waktu habis',
  manual: 'Dihentikan manual',
  disconnect_timeout: 'Koneksi terputus',
  akun_nonaktif: 'Akun dinonaktifkan',
}

export function logEventLabel(event: string): string {
  return LOG_EVENT_LABEL[event] ?? event
}

export function logEventVariant(
  event: string,
): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  return LOG_EVENT_VARIANT[event] ?? 'default'
}

export function formatLogDetail(log: DashboardLog, pcName?: string): string {
  const pc = pcName ?? 'PC'
  switch (log.event) {
    case 'session:started_dashboard':
    case 'session:started':
      return `${pc} mulai dipakai akun ${log.akun ?? '-'}${log.by ? ` oleh ${log.by}` : ''}`
    case 'session:stopped': {
      const alasan = STOP_REASON[log.alasan ?? ''] ?? log.alasan ?? '-'
      return (
        `${pc} — akun ${log.akun ?? '-'}: ${alasan}, ` +
        `sisa kembali ${formatDuration(log.sisaWaktuKembali ?? 0)}`
      )
    }
    case 'transaction:created':
      return `${log.jenis ?? '-'} ${log.kodeUnik ?? log.nama ?? '-'} — Rp ${log.nominal?.toLocaleString('id-ID') ?? '-'}`
    case 'pc_lock':
    case 'pc_locked':
      return `${pc} dikunci oleh ${log.by ?? '-'}`
    case 'pc_unlock':
    case 'pc_unlocked':
      return `${pc} dibuka oleh ${log.by ?? '-'}`
    case 'pc_shutdown':
      return `${pc} dimatikan oleh ${log.by ?? '-'}`
    case 'pc_shutdown_auto':
      return `${pc} dimatikan otomatis — ${log.keterangan ?? `idle ${log.menit ?? '-'} menit tanpa aktivitas login`}`
    case 'teknisi:login':
      return `${pc} dibuka oleh teknisi ${log.teknisi ?? '-'} — tanpa penagihan`
    case 'teknisi:logout':
      return `${pc} dikunci — akses teknisi dimatikan${log.teknisi ? ` (${log.teknisi})` : ''}`
    default:
      return ''
  }
}

/** Waktu log yang sudah diformat, dipakai tabel & kartu mobile. */
export function formatLogWaktu(at: string): string {
  return formatWaktu(at)
}

/**
 * Ubah satu baris `ActivityLog` dari API menjadi bentuk yang dipakai UI.
 *
 * ⚠️ Pemetaan field di sini memilih secara MANUAL. Field yang tidak disebut
 * HILANG diam-diam — gejalanya "idle - menit", bukan error.
 */
export function itemKeLog(item: ActivityLogItem): DashboardLog {
  let detail: Record<string, unknown> = {}
  try {
    detail = item.detail ? JSON.parse(item.detail) : {}
  } catch {
    detail = {}
  }
  return {
    event: item.event,
    at: item.createdAt,
    sessionId: detail.sessionId as string | undefined,
    pcId: item.pcId as string | undefined,
    accountId: item.accountId as string | undefined,
    kasirId: item.kasirId as string | undefined,
    alasan: detail.alasan as string | undefined,
    sisaWaktuKembali: detail.sisaWaktuKembali as number | undefined,
    akun: detail.akun as string | undefined,
    durasiDetik: detail.durasiDetik as number | undefined,
    durasiMenit: detail.durasiMenit as number | undefined,
    nominal: detail.nominal as number | undefined,
    jenis: detail.jenis as string | undefined,
    kodeUnik: detail.kodeUnik as string | undefined,
    nama: detail.nama as string | undefined,
    by: detail.by as string | undefined,
    pc: detail.pc as string | undefined,
    keterangan: detail.detail as string | undefined,
    menit: detail.menit as number | undefined,
    teknisi: detail.teknisi as string | undefined,
  }
}
