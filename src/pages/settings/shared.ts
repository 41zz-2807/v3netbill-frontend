export const BUSY_TEXT: Record<string, string> = {
  installer: 'Uploading installer',
  wallpaper: 'Uploading wallpaper',
  backup: 'Membuat backup',
  'backup-download': 'Mengunduh backup',
  download: 'Mengunduh installer',
  downloadApk: 'Mengunduh APK',
  tarif: 'Menyimpan tarif',
  grace: 'Menyimpan pengaturan',
  password: 'Menyimpan',
  pin: 'Menyimpan',
  pinBypass: 'Menyimpan',
  otp: 'Menyimpan',
  user: 'Menyimpan',
}

/**
 * Bagian yang dipakai semua tab: penanda proses berjalan, banner pesan, dan
 * pembungkus async yangrau mengunci tombol selama proses.
 */
export interface SettingsCtx {
  busy: string | null
  setBusy: (action: string | null) => void
  run: (action: string, fn: () => Promise<void>) => Promise<void>
  setErr: (v: string | null) => void
  setMsg: (v: string | null) => void
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatDateIndo(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** installer_meta disimpan sebagai JSON bebas, jadi field tanggal bisa saja
 *  tidak ada pada meta versi lama. new Date(undefined) menghasilkan
 *  "Invalid Date", jadi periksa dulu sebelum menampilkan. */
export function adaTanggal(dateStr: string | undefined): boolean {
  return (
    typeof dateStr === 'string' &&
    dateStr !== '' &&
    !Number.isNaN(new Date(dateStr).getTime())
  )
}
