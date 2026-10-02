export type Role = 'ADMIN' | 'KASIR'
export type PcStatus = 'IDLE' | 'ACTIVE' | 'OFFLINE'
export type AccountType = 'VOUCHER' | 'MEMBER'
export type AccountStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED'
export type SessionStatus = 'BERJALAN' | 'SELESAI' | 'DISTOP'
export type TransactionType = 'BELI_BARU' | 'TOPUP' | 'KOREKSI'

export interface LoginResponse {
  access_token: string
  role: Role
}

export interface UserInfo {
  sub: string
  username: string
  role: Role
}

/** User operator. passwordHash tidak pernah dikirim ke frontend. */
export interface OperatorUser {
  id: string
  username: string
  role: Role
  createdAt: string
}

export interface Pc {
  id: string
  namaPc: string
  ipClient: string
  agentToken: string
  status: PcStatus
  lastHeartbeatAt: string | null
  createdAt: string
}

export interface DashboardSession {
  id: string
  accountId: string
  kodeUnik: string | null
  nama: string | null
  tipe: AccountType
  sisaDetik: number
  waktuMulai: string
}

export interface DashboardPc {
  id: string
  namaPc: string
  ipClient: string
  status: PcStatus
  lastHeartbeatAt: string | null
  session: DashboardSession | null
}

export interface DashboardUpdate {
  pcs: DashboardPc[]
  at: string
}

export interface DashboardLog {
  event: string
  at: string
  sessionId?: string
  pcId?: string
  accountId?: string
  alasan?: string
  sisaWaktuKembali?: number
  akun?: string
  durasiDetik?: number
  durasiMenit?: number
  nominal?: number
  jenis?: string
  kodeUnik?: string
  nama?: string
  kasirId?: string
  by?: string
}

export interface TransactionRef {
  id: string
  nominal: number
  durasiMenit: number
  durasiDetik?: number
  jenis: TransactionType
  createdAt: string
  dibatalkan?: string | null
  bisaDibatalkan?: boolean
}

export interface Account {
  id: string
  tipe: AccountType
  kodeUnik: string | null
  nama: string | null
  sisaWaktuDetik: number
  status: AccountStatus
  lastUsedAt: string | null
  createdAt: string
  transactions: TransactionRef[]
}

export interface Transaction {
  id: string
  accountId: string
  nominal: number
  durasiMenit: number
  jenis: TransactionType
  kasirId: string
  createdAt: string
  dibatalkan?: string | null
  dibatalkanOleh?: string | null
  bisaDibatalkan?: boolean
  account: {
    id: string
    kodeUnik: string | null
    nama: string | null
    tipe: AccountType
  }
  kasir: {
    id: string
    username: string
  }
}

export interface DailyReport {
  tanggal: string
  totalLogin: number
  voucherTerbentuk: number
  voucherTopup: number
  memberTerbentuk: number
  memberTopup: number
  pendapatanVoucher: number
  pendapatanMember: number
}

export interface RangeReport {
  dari: string
  sampai: string
  totalLogin: number
  voucherTerbentuk: number
  voucherTopup: number
  memberTerbentuk: number
  memberTopup: number
  pendapatanVoucher: number
  pendapatanMember: number
  totalPendapatan: number
  daftar: DailyReport[]
}
export interface InstallerMeta {
  filename: string
  sizeBytes: number
  uploadedAt: string
  /**
   * Hanya diisi untuk `apk_meta`, bukan untuk installer Windows.
   * Dibaca backend dari dalam berkas APK, bukan diketik.
   */
  versionCode?: number | null
  versionName?: string | null
  sha256?: string | null
}

export interface BackupResult {
  filename: string
  sizeBytes: number
}

export interface BackupFile {
  filename: string
  sizeBytes: number
  createdAt: string
}

/** Satu paket diagnosa yang dikirim agent ke server. */
export interface DiagnosaFile {
  filename: string
  sizeBytes: number
  createdAt: string
  pcId: string
}

/** Ringkasan satu berkas log harian, untuk daftar tanggal. */
export interface LogBillingRingkas {
  tanggal: string
  ukuranBytes: number
  jumlahBaris: number
}

/** Isi satu berkas log harian setelah pencarian, untuk ditampilkan. */
export interface LogBillingIsi {
  tanggal: string
  baris: string[]
  jumlahDitemukan: number
}
