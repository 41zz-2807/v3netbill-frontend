import axios from 'axios'
import type {
  LoginResponse,
  Pc,
  Account,
  Transaction,
  DailyReport,
  RangeReport,
  Role,
  OperatorUser,
  InstallerMeta,
  BackupResult,
  BackupFile,
} from './types'

const TOKEN_KEY = 'v3netbill_token'
const ROLE_KEY = 'v3netbill_role'
const USERNAME_KEY = 'v3netbill_username'

export const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
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
  return localStorage.getItem(TOKEN_KEY)
}

export function getRole(): Role | null {
  return (localStorage.getItem(ROLE_KEY) as Role) ?? null
}

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY)
}

export function setAuth(token: string, role: Role): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ROLE_KEY, role)
}

export function setUsername(username: string): void {
  localStorage.setItem(USERNAME_KEY, username)
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(USERNAME_KEY)
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

export async function fetchPcs(): Promise<Pc[]> {
  const { data } = await api.get<Pc[]>('/pcs')
  return data
}

export async function createPc(namaPc: string): Promise<Pc> {
  const { data } = await api.post<Pc>('/pcs', { namaPc })
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
  password: string,
  nominal: number,
): Promise<Account> {
  const { data } = await api.post<Account>('/accounts/member', { nama, password, nominal })
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

export async function downloadAuth(
  path: string,
  fallbackName: string,
): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY)
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    throw new Error(`Gagal mengunduh (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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
  })
}