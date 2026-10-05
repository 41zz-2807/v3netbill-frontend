import axios from 'axios'
import type {
  LoginResponse,
  Pc,
  StatusPcRingkas,
  Account,
  Transaction,
  DailyReport,
  RangeReport,
  Role,
  OperatorUser,
  InstallerMeta,
  BackupResult,
  BackupFile,
  LogBillingRingkas,
  DiagnosaFile,
  LogBillingIsi,
} from './types'

const TOKEN_KEY = 'v3netbill_token'
const ROLE_KEY = 'v3netbill_role'
const USERNAME_KEY = 'v3netbill_username'

/**
 * `sessionStorage`, bukan `localStorage`.
 *
 * `localStorage` bertahan setelah browser ditutup, jadi kasir yang meninggalkan
 * komputer dalam keadaan login masih bisa dibuka siapa pun tanpa password.
 * `sessionStorage` ikut hilang saat tab/browser ditutup, jadi menutup browser
 * sama dengan keluar. Reload (F5) tidak mengosongkannya, jadi sesi tetap aman
 * dari refresh biasa.
 */
const store = (): Storage => window.sessionStorage

export const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = store().getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export function getToken(): string | null {
  return store().getItem(TOKEN_KEY)
}

export function getRole(): Role | null {
  return (store().getItem(ROLE_KEY) as Role) ?? null
}

export function getUsername(): string | null {
  return store().getItem(USERNAME_KEY)
}

export function setAuth(token: string, role: Role): void {
  store().setItem(TOKEN_KEY, token)
  store().setItem(ROLE_KEY, role)
}

export function setUsername(username: string): void {
  store().setItem(USERNAME_KEY, username)
}

export function clearAuth(): void {
  store().removeItem(TOKEN_KEY)
  store().removeItem(ROLE_KEY)
  store().removeItem(USERNAME_KEY)
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { username, password })
  return data
}

export async function createUser(
  username: string,
  password: string,
  role: Role,
): Promise<OperatorUser> {
  const { data } = await api.post<OperatorUser>('/auth/users', { username, password, role })
  return data
}

export async function fetchUsers(): Promise<OperatorUser[]> {
  const { data } = await api.get<OperatorUser[]>('/auth/users')
  return data
}

export async function deleteUser(id: string): Promise<{ deleted: string }> {
  const { data } = await api.delete<{ deleted: string }>(`/auth/users/${id}`)
  return data
}

/**
 * Daftar PC.
 *
 * ⚠️ `termasukRusak` hanya boleh true di Halaman PC. PC yang ditandai rusak
 * sengaja disembunyikan dari dashboard, halaman login, dan mobile — hanya
 * Halaman PC yang boleh melihatnya di sini, dan hanya ADMIN yang boleh memakai
 * parameter ini.
 */
export async function fetchPcs(termasukRusak = false): Promise<Pc[]> {
  const { data } = await api.get<Pc[]>(termasukRusak ? '/pcs?termasukRusak=true' : '/pcs')
  return data
}

/**
 * Ringkasan PC untuk halaman login. Endpoint publik — tidak butuh token.
 *
 * ⚠️ Jangan pakai `fetchPcs()` di sini: yang itu mengembalikan `agentToken`,
 * dan halaman login tampil sebelum operator masuk. Endpoint `/pcs/ringkas`
 * hanya mengembalikan nama PC, status, tipe akun, dan sisa waktu.
 */
export async function fetchStatusPcRingkas(): Promise<StatusPcRingkas[]> {
  const { data } = await api.get<StatusPcRingkas[]>('/pcs/ringkas')
  return data
}

export async function createPc(namaPc: string): Promise<Pc> {
  const { data } = await api.post<Pc>('/pcs', { namaPc })
  return data
}

/**
 * Ganti nama/label PC.
 *
 * ⚠️ Nama PC bukan identitas — identitas selalu `id` + `agentToken`. Jadi
 * pemanggilan ini tidak memutus agent dan tidak mengganggu sesi yang sedang
 * berjalan. Duplikat nama ditolak server dengan 409.
 */
export async function gantiNamaPc(id: string, namaPc: string): Promise<{ id: string; namaPc: string }> {
  const { data } = await api.patch<{ id: string; namaPc: string }>(`/pcs/${id}/nama`, { namaPc })
  return data
}

/**
 * Nyalakan / matikan flag "PC rusak".
 *
 * ⚠️ Flag ini BUKAN arti "PC ini benar-benar rusak" — itu flag operasional:
 * PC sedang diservis atau sengaja dikosongkan. Yang terjadi kalau
 * `rusak: true`:
 *
 * - sesi yang sedang berjalan langsung dihentikan (sisa waktu kembali),
 * - layar PC dikunci,
 * - PC hilang dari dashboard, halaman login, dan aplikasi mobile,
 * - PC tidak bisa dipakai lagi sampai flag dimatikan.
 *
 * Hapus PC yang ditandai ditolak server dengan 409.
 */
export async function setPcRusak(
  id: string,
  rusak: boolean,
  alasan?: string,
): Promise<{ id: string; namaPc: string; rusak: boolean; sesiDihentikan: boolean }> {
  const { data } = await api.patch<{
    id: string
    namaPc: string
    rusak: boolean
    sesiDihentikan: boolean
  }>(`/pcs/${id}/rusak`, { rusak, alasan })
  return data
}

export async function deletePc(id: string): Promise<void> {
  await api.delete(`/pcs/${id}`)
}

export async function unlockPc(id: string): Promise<{ unlocked: boolean; message?: string }> {
  const { data } = await api.post<{ unlocked: boolean; message?: string }>(`/pcs/${id}/unlock`)
  return data
}

export async function fetchAccounts(
  tipe?: 'VOUCHER' | 'MEMBER',
  status?: string,
): Promise<Account[]> {
  const params = new URLSearchParams()
  if (tipe) params.set('tipe', tipe)
  if (status) params.set('status', status)
  const { data } = await api.get<Account[]>(`/accounts?${params.toString()}`)
  return data
}

export async function createVoucher(
  nominal: number,
): Promise<Account & { password: string }> {
  const { data } = await api.post<Account & { password: string }>('/accounts/voucher', { nominal })
  return data
}

export async function createMember(
  nama: string,
  nominal: number,
): Promise<Account> {
  // `password` tidak dikirim lagi. Backend memberi semua akun baru password
  // bawaan yang sama, dan pelanggan bisa menggantinya sendiri dari komputer
  // lewat tombol "Buat Password" di agent.
  const { data } = await api.post<Account>('/accounts/member', { nama, nominal })
  return data
}

export async function topup(id: string, nominal: number): Promise<Account> {
  const { data } = await api.post<Account>(`/accounts/${id}/topup`, { nominal })
  return data
}

export async function koreksi(id: string, nominal: number): Promise<Account> {
  const { data } = await api.post<Account>(`/accounts/${id}/koreksi`, { nominal })
  return data
}

export async function batalTransaksi(
  accountId: string,
  transactionId: string,
): Promise<Account> {
  const { data } = await api.post<Account>(
    `/accounts/${accountId}/batal-transaksi`,
    { transactionId },
  )
  return data
}

export async function changePassword(id: string, password: string): Promise<Account> {
  const { data } = await api.patch<Account>(`/accounts/${id}/password`, { password })
  return data
}

export interface PublicSettings {
  harga_per_menit: string
  grace_period_detik: string
}

export async function fetchSettings(): Promise<Record<string, string>> {
  const { data } = await api.get<Record<string, string>>('/settings')
  return data
}

export async function patchSetting(key: string, value: string): Promise<{ key: string; value: string }> {
  const { data } = await api.patch<{ key: string; value: string }>('/settings', { key, value })
  return data
}

export async function changeOwnPassword(oldPassword: string, newPassword: string): Promise<void> {
  await api.patch('/settings/password', { oldPassword, newPassword })
}

export async function uploadInstaller(file: File): Promise<InstallerMeta> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ success: boolean; meta: InstallerMeta }>('/settings/installer', form)
  return data.meta
}

export async function uploadWallpaper(file: File): Promise<{ path: string }> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ success: boolean; path: string }>('/settings/wallpaper', form)
  return { path: data.path }
}

export async function createBackup(): Promise<BackupResult> {
  const { data } = await api.post<BackupResult>('/settings/backup')
  return data
}

export async function fetchBackupList(): Promise<BackupFile[]> {
  const { data } = await api.get<{ success: boolean; daftar: BackupFile[] }>('/settings/backup/list')
  return data.daftar
}

export async function setPinUninstall(pin: string): Promise<{ success: boolean }> {
  const { data } = await api.patch<{ success: boolean }>('/settings/pin-uninstall', { pin })
  return data
}

/**
 * Simpan PIN bypass/maintenance. PIN kosong berarti hapus hash, sehingga PC
 * kembali memakai PIN emergency bawaan.
 */
export async function setPinBypass(
  pin: string,
): Promise<{ success: boolean; kosong: boolean; terkirim: number }> {
  const { data } = await api.patch<{ success: boolean; kosong: boolean; terkirim: number }>(
    '/settings/bypass-pin',
    { pin },
  )
  return data
}

export interface DownloadProgress {
  loaded: number
  total: number
  /** 0..100, atau null kalau server tidak mengirim content-length. */
  percent: number | null
}

/**
 * Unduh berkas ber-JWT sambil melaporkan kemajuan.
 *
 * `res.blob()` yang biasa dipakai tidak memberi kabar sama sekali selama
 * 50 MB masuk, jadi pengguna hanya menunggu tanpa tahu sudah berapa persen.
 * Di sini isinya dibaca lewat `ReadableStream` sehingga `onProgress`
 * dipanggil tiap potongan data.
 *
 * Header `content-length` tidak selalu ada (server bisa mengirim chunked),
 * jadi `percent` bisa null. Jangan menggantinya dengan tebakan — angka palsu
 * lebih buruk daripada tidak ada angka.
 */
export async function downloadAuth(
  path: string,
  fallbackName: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  const token = store().getItem(TOKEN_KEY)
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    throw new Error(`Gagal mengunduh (${res.status})`)
  }

  const total = Number(res.headers.get('content-length') ?? 0)
  let loaded = 0
  const bagian: Uint8Array[] = []

  if (res.body) {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        bagian.push(value)
        loaded += value.byteLength
        onProgress?.({
          loaded,
          total,
          percent: total > 0 ? (loaded / total) * 100 : null,
        })
      }
    }
  } else {
    // Browser lama tanpa ReadableStream: turunkan ke blob, tanpa persen.
    const blob = await res.blob()
    bagian.push(new Uint8Array(await blob.arrayBuffer()))
    loaded = blob.size
    onProgress?.({ loaded, total: loaded, percent: 100 })
  }

  if (total > 0 && loaded !== total) {
    throw new Error(
      `Berkas tidak lengkap (${loaded} dari ${total} byte). Coba ulangi.`,
    )
  }

  const blob = new Blob(bagian as BlobPart[], {
    type: res.headers.get('content-type') ?? 'application/octet-stream',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  onProgress?.({ loaded, total: loaded, percent: 100 })
}

export function parseMeta<T>(raw?: string): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}


export async function revokeAccount(id: string): Promise<Account> {
  const { data } = await api.post<Account>(`/accounts/${id}/revoke`)
  return data
}

export async function fetchTransactions(params?: {
  accountId?: string
  dari?: string
  sampai?: string
}): Promise<Transaction[]> {
  const qs = new URLSearchParams()
  if (params?.accountId) qs.set('accountId', params.accountId)
  if (params?.dari) qs.set('dari', params.dari)
  if (params?.sampai) qs.set('sampai', params.sampai)
  const { data } = await api.get<Transaction[]>(`/transactions?${qs.toString()}`)
  return data
}

export async function fetchTodayReport(): Promise<DailyReport> {
  const { data } = await api.get<DailyReport>('/reports/today')
  return data
}

export async function fetchDailyReport(dari: string, sampai: string): Promise<DailyReport[]> {
  const { data } = await api.get<DailyReport[]>(
    `/reports/daily?dari=${dari}&sampai=${sampai}`,
  )
  return data
}

export async function fetchRangeReport(dari: string, sampai: string): Promise<RangeReport> {
  const { data } = await api.get<RangeReport>(
    `/reports/range?dari=${dari}&sampai=${sampai}`,
  )
  return data
}

export interface ActivityLogItem {
  id: string
  event: string
  detail: string | null
  pcId: string | null
  accountId: string | null
  kasirId: string | null
  createdAt: string
}

export interface PaginatedLogs {
  data: ActivityLogItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function fetchActivityLogs(page = 1, limit = 30): Promise<PaginatedLogs> {
  const { data } = await api.get<PaginatedLogs>(`/activity-log?page=${page}&limit=${limit}`)
  return data
}

export function formatDuration(detik: number): string {
  const d = Math.max(0, Math.floor(detik))
  const jam = Math.floor(d / 3600)
  const menit = Math.floor((d % 3600) / 60)
  const sec = d % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  // Batas 1 jam memakai jam didahulukan ("2j 00:00"), bukan "2:00:00".
  // Alasannya: bentuk H:MM:SS terlihat seperti format jam-menit yang
  // biasa, sehingga dalam satu kolom terbaca seperti dua format berbeda.
  if (jam > 0) return `${jam}j ${pad(menit)}:${pad(sec)}`
  return `${pad(menit)}:${pad(sec)}`
}

export function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID')
}

/**
 * Waktu ringkas untuk tabel log aktivitas: "27 Sep 05.17".
 *
 * Tahun tidak dicetak karena log hanya disimpan 30 hari (ada cron
 * cleanup-activity-logs jam 02:00), jadi data yang bisa muncul selalu
 * bulan berjalan atau bulan sebelumnya. Tahun baru dikembalikan hanya
 * pada desember, supaya "05 Jan" tidak tertukar dengan entry yang
 * satu tahun lalu.
 */
export function formatWaktu(dateStr: string): string {
  const d = new Date(dateStr)
  const tahunBerbeda = d.getFullYear() !== new Date().getFullYear()
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: tahunBerbeda ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
    // ⚠️ WAJIB. Tanpa `timeZone`, `toLocaleString` ikut zona yang disetel di
    // PC kasir. Kalau PC itu disetel UTC (atau zona lain), semua waktu di
    // aplikasi bergeser 7 jam — dan di aplikasi billing angka yang salah lebih
    // buruk daripada tidak ditampilkan.
    timeZone: 'Asia/Jakarta',
  })
}
/* --- Diagnosa agent (backend/src/diagnosa) --- */

/** Daftar paket diagnosa yang sudah dikirim agent. Hanya ADMIN. */
export async function fetchDiagnosaList(): Promise<DiagnosaFile[]> {
  const { data } = await api.get<DiagnosaFile[]>('/diagnosa')
  return data
}

/* --- Log billing harian (backend/src/log-billing) --- */

export async function fetchLogBillingList(): Promise<LogBillingRingkas[]> {
  const { data } = await api.get<LogBillingRingkas[]>('/log-billing')
  return data
}

/**
 * `cari` dikirim sebagai parameter query, bukan difilter di browser. Isi satu
 * hari kecil, tapi memfilter di server berarti kotak pencarian tetap bekerja
 * kalau nanti retensinya diubah dari 30 hari ke beberapa bulan.
 */
export async function fetchLogBilling(
  tanggal: string,
  cari?: string,
): Promise<LogBillingIsi> {
  const { data } = await api.get<LogBillingIsi>('/log-billing/' + encodeURIComponent(tanggal), {
    params: cari && cari.trim() !== '' ? { cari: cari.trim() } : undefined,
  })
  return data
}
