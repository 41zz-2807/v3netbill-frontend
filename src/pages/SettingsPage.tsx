import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.tsx'
import {
  fetchSettings,
  patchSetting,
  changeOwnPassword,
  uploadInstaller,
  uploadWallpaper,
  createBackup,
  fetchBackupList,
  setPinUninstall,
  downloadAuth,
  parseMeta,
  createUser,
  fetchUsers,
  deleteUser,
} from '../lib/api.ts'
import type {
  InstallerMeta,
  BackupResult,
  BackupFile,
  OperatorUser,
  Role,
} from '../lib/types.ts'
import { Pagination } from '../components/ui/Pagination.tsx'
import {
  PER_HALAMAN,
  usePagination,
  urutkanTerbaru,
} from '../hooks/usePagination.ts'
import LoadingOverlay from '../components/LoadingOverlay.tsx'

const BUSY_TEXT: Record<string, string> = {
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
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDateIndo(dateStr: string): string {
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
function adaTanggal(dateStr: string | undefined): boolean {
  return typeof dateStr === 'string' && dateStr !== '' && !Number.isNaN(new Date(dateStr).getTime())
}

export default function SettingsPage() {
  const { role, username } = useAuth()

  const [harga, setHarga] = useState('')
  const [grace, setGrace] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')

  const [pin, setPin] = useState('')
  const [pinMsg, setPinMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [newUser, setNewUser] = useState('')
  const [newUserPass, setNewUserPass] = useState('')
  const [newUserRole, setNewUserRole] = useState<Role>('KASIR')
  const [userMsg, setUserMsg] = useState<string | null>(null)
  const [users, setUsers] = useState<OperatorUser[]>([])

  const [otpToken, setOtpToken] = useState('')
  const [otpChatId, setOtpChatId] = useState('')
  const [otpTerisi, setOtpTerisi] = useState(false)
  const [otpMsg, setOtpMsg] = useState<string | null>(null)

  const installerRef = useRef<HTMLInputElement>(null)
  const wallRef = useRef<HTMLInputElement>(null)
  const [installed, setInstalled] = useState<InstallerMeta | null>(null)
  const [apk, setApk] = useState<InstallerMeta | null>(null)
  const [wallFname, setWallFname] = useState<string | null>(null)
  const [backupInfo, setBackupInfo] = useState<BackupResult | null>(null)
  const [backups, setBackups] = useState<BackupFile[]>([])
  const backupTerurut = useMemo(
    () => urutkanTerbaru(backups, (b) => b.createdAt),
    [backups],
  )
  const {
    data: barisBackup,
    halaman,
    totalHalaman,
    total,
    setHalaman,
  } = usePagination(backupTerurut)

  const loadBackups = useCallback(async () => {
    try {
      setBackups(await fetchBackupList())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const load = useCallback(async () => {
    try {
      setErr(null)
      const s = await fetchSettings()
      setHarga(s.harga_per_menit ?? '')
      setGrace(s.grace_period_detik ?? '')
      setInstalled(parseMeta<InstallerMeta>(s.installer_meta))
      setApk(parseMeta<InstallerMeta>(s.apk_meta))
      setWallFname(s.wallpaper_lockscreen_path ?? null)
      setOtpChatId(s.agent_otp_chat_id ?? '')
      setOtpTerisi(Boolean(s.agent_otp_bot_token))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await fetchUsers())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
    void loadBackups()
    void loadUsers()
  }, [load, loadBackups, loadUsers])

  async function submitUser() {
    const username = newUser.trim()
    if (!username || newUserPass.length < 6) {
      setUserMsg(null)
      setErr('Username wajib diisi dan password minimal 6 karakter')
      return
    }
    setBusy('user')
    setErr(null)
    setUserMsg(null)
    try {
      const created = await createUser(username, newUserPass, newUserRole)
      setUserMsg(`User "${created.username}" dibuat dengan role ${created.role}`)
      setNewUser('')
      setNewUserPass('')
      setNewUserRole('KASIR')
      await loadUsers()
    } catch (e: unknown) {
      setErr(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (e instanceof Error ? e.message : String(e)),
      )
    } finally {
      setBusy(null)
    }
  }

  async function hapusUser(u: OperatorUser) {
    if (!confirm(
      `Hapus user "${u.username}" (${u.role})?\n\n` +
        'User ini tidak bisa login lagi setelah dihapus.',
    )) return
    setBusy('user')
    setErr(null)
    setUserMsg(null)
    try {
      await deleteUser(u.id)
      setUserMsg(`User "${u.username}" dihapus`)
      await loadUsers()
    } catch (e: unknown) {
      setErr(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (e instanceof Error ? e.message : String(e)),
      )
    } finally {
      setBusy(null)
    }
  }

  /** Admin tidak boleh menghapus akunnya sendiri, dan admin terakhir tidak
   *  boleh dihapus karena tidak akan ada yang bisa menambah user lagi.
   *  Backend juga mengecek dua hal ini. */
  const jumlahAdmin = users.filter((u) => u.role === 'ADMIN').length

  function alasanTidakBisaHapus(u: OperatorUser): string | null {
    if (u.username === username) return 'Anda tidak bisa menghapus akun Anda sendiri'
    if (u.role === 'ADMIN' && jumlahAdmin <= 1) {
      return 'Admin terakhir tidak bisa dihapus'
    }
    return null
  }

  if (role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6 text-center text-slate-700">
        Hanya ADMIN yang dapat mengakses halaman ini.
      </div>
    )
  }

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  async function saveTarif() {
    await run('tarif', async () => {
      try {
        setErr(null)
        await patchSetting('harga_per_menit', harga)
        setMsg('Tarif tersimpan')
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function saveGrace() {
    await run('grace', async () => {
      try {
        setErr(null)
        await patchSetting('grace_period_detik', grace)
        setMsg('Grace period tersimpan')
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function submitPassword() {
    await run('password', async () => {
      try {
        setErr(null)
        await changeOwnPassword(oldPass, newPass)
        setOldPass('')
        setNewPass('')
        setMsg('Password berhasil diubah')
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function submitPin() {
    await run('pin', async () => {
      try {
        setErr(null)
        await setPinUninstall(pin)
        setPinMsg('PIN uninstall tersimpan')
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  /**
   * Simpan konfigurasi OTP Telegram. Kosongkan token untuk mematikan fitur —
   * agent akan kembali memakai PIN emergency bawaan (rollback).
   */
  async function saveOtp(matikan: boolean) {
    await run('otp', async () => {
      try {
        setErr(null)
        await patchSetting('agent_otp_chat_id', matikan ? '' : otpChatId.trim())
        await patchSetting('agent_otp_bot_token', matikan ? '' : otpToken.trim())
        setOtpToken('')
        setOtpTerisi(!matikan)
        setOtpMsg(
          matikan
            ? 'OTP dimatikan. Agent kembali ke PIN emergency bawaan (123456).'
            : 'OTP aktif. Config dikirim ke agent yang sedang terhubung.',
        )
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function onInstaller(file?: File) {
    if (!file) return
    await run('installer', async () => {
      try {
        setErr(null)
        const meta = await uploadInstaller(file)
        await load()
        setMsg(`Installer terupload: ${meta.filename}`)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function onWallpaper(file?: File) {
    if (!file) return
    await run('wallpaper', async () => {
      try {
        setErr(null)
        const res = await uploadWallpaper(file)
        await load()
        setMsg(`Wallpaper terupload: ${res.path}`)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function doBackup() {
    await run('backup', async () => {
      try {
        setErr(null)
        const b = await createBackup()
        setBackupInfo(b)
        await loadBackups()
        setMsg('Backup database berhasil')
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function downloadBackupFile(filename: string) {
    await run('backup-download', async () => {
      try {
        await downloadAuth(`/settings/backup/download?filename=${encodeURIComponent(filename)}`, filename)
        setMsg(`Backup diunduh: ${filename}`)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Pengaturan</h1>

      {busy && <LoadingOverlay text={BUSY_TEXT[busy] ?? 'Memproses'} />}

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      )}
      {msg && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-800">Tarif & Kebijakan</h2>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Harga per Menit (Rp)</span>
            <input
              type="number"
              value={harga}
              min={1}
              onChange={(e) => setHarga(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={saveTarif}
            disabled={busy !== null}
            className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === 'tarif' ? 'Menyimpan...' : 'Simpan Tarif'}
          </button>
          <div className="mt-5">
            <label className="block">
              <span className="mb-1 block text-sm text-slate-600">Grace Period (detik)</span>
              <input
                type="number"
                value={grace}
                min={0}
                onChange={(e) => setGrace(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={saveGrace}
              disabled={busy !== null}
              className="mt-2 self-start rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
            >
              {busy === 'grace' ? 'Menyimpan...' : 'Simpan Grace Period'}
            </button>
          </div>
        </section>

        <section className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-800">Akses Agent</h2>

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            PIN Uninstall
          </h3>
          <input
            type="password"
            placeholder="PIN (contoh: 2468)"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={submitPin}
            disabled={busy !== null}
            className="mt-2 self-start rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
          >
            {busy === 'pin' ? 'Menyimpan...' : 'Simpan PIN'}
          </button>
          {pinMsg && <div className="mt-2 text-sm text-green-700">{pinMsg}</div>}

          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              OTP Telegram
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Untuk membuka layar lock saat mode maintenance. Kode dikirim ke Telegram,
              berlaku 5 menit, dan hanya bisa dipakai sekali.
            </p>

            <label className="block">
              <span className="mb-1 block text-sm text-slate-600">Bot Token</span>
              <input
                type="password"
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value)}
                placeholder={otpTerisi ? 'Sudah tersimpan — isi lagi untuk mengganti' : '123456789:AA...'}
                autoComplete="off"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="mt-2 block">
              <span className="mb-1 block text-sm text-slate-600">Chat ID</span>
              <input
                value={otpChatId}
                onChange={(e) => setOtpChatId(e.target.value)}
                placeholder="Contoh: 123456789"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveOtp(false)}
                disabled={busy !== null || !otpToken.trim() || !otpChatId.trim()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {busy === 'otp' ? 'Menyimpan...' : 'Simpan & Kirim'}
              </button>
              {otpTerisi && (
                <button
                  type="button"
                  onClick={() => void saveOtp(true)}
                  disabled={busy !== null}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Matikan
                </button>
              )}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              {otpTerisi
                ? 'Status: aktif. Config tersimpan di tiap PC, jadi OTP tetap terkirim walau server mati.'
                : 'Status: tidak aktif. Agent memakai PIN emergency bawaan (123456).'}
            </p>
            {otpMsg && <div className="mt-2 text-sm text-green-700">{otpMsg}</div>}
          </div>
        </section>

        <section className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-800">Installer Aplikasi</h2>
          {installed ? (
            <div className="mb-3 rounded-md bg-slate-50 p-2 text-xs text-slate-700">
              <div className="truncate">
                <span className="font-medium">{installed.filename}</span> ·{' '}
                {formatBytes(installed.sizeBytes)}
              </div>
              {adaTanggal(installed.uploadedAt) && (
                <div className="mt-0.5 text-slate-500">
                  Diunggah {formatDateIndo(installed.uploadedAt)}
                </div>
              )}
            </div>
          ) : (
            <p className="mb-3 text-xs text-slate-500">Belum ada installer terupload.</p>
          )}
          <input
            ref={installerRef}
            type="file"
            accept=".exe,.msi"
            className="hidden"
            onChange={(e) => void onInstaller(e.target.files?.[0])}
          />
          <div className="mt-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={() => installerRef.current?.click()}
              disabled={busy !== null}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {busy === 'installer' ? 'Mengunggah...' : 'Upload (.exe/.msi, maks 200 MB)'}
            </button>
            {installed && (
              <button
                type="button"
                onClick={() => void run('download', async () => {
                  try {
                    const fname = installed?.filename ?? 'v3netbill-installer.msi'
                    await downloadAuth('/settings/installer', fname)
                    setMsg('Installer diunduh')
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : String(e))
                  }
                })}
                disabled={busy !== null}
                className="rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
              >
                {busy === 'download' ? 'Mengunduh...' : 'Unduh Installer'}
              </button>
            )}

            {/* Aplikasi Android. Sengaja dibuat sebagai link tulisan, bukan
                tombol, supaya tidak bersaing dengan tombol installer di atas
                dan tidak menambah satu tombol lagi di card yang sama. */}
            <div className="border-t border-slate-100 pt-2">
              {apk ? (
                <button
                  type="button"
                  onClick={() => void run('downloadApk', async () => {
                    try {
                      await downloadAuth('/settings/apk', 'v3netbill.apk')
                      setMsg('APK Android diunduh')
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : String(e))
                    }
                  })}
                  disabled={busy !== null}
                  className="text-xs text-blue-700 underline underline-offset-2 hover:text-blue-900 disabled:opacity-50"
                >
                  {busy === 'downloadApk' ? 'Mengunduh APK...' : 'Download APK (Android)'}
                </button>
              ) : (
                <p className="text-xs text-slate-400">
                  Belum ada APK Android terupload.
                </p>
              )}
              {apk && (
                <span className="ml-1.5 text-xs text-slate-400">
                  {formatBytes(apk.sizeBytes)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lock Screen
            </h3>
            <input
              ref={wallRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => void onWallpaper(e.target.files?.[0])}
            />
            {wallFname ? (
              <p className="mb-2 truncate rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                Aktif: <span className="font-medium">{wallFname}</span>
              </p>
            ) : (
              <p className="mb-2 text-xs text-slate-500">Belum ada wallpaper terupload.</p>
            )}
            <button
              type="button"
              onClick={() => wallRef.current?.click()}
              disabled={busy !== null}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {busy === 'wallpaper' ? 'Mengunggah...' : 'Upload Wallpaper'}
            </button>
            <p className="mt-2 text-xs text-slate-500">Format .jpg/.jpeg/.png, maks 10 MB.</p>
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-800">Tambah User</h2>
          <input
            type="text"
            placeholder="Username"
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Password (min. 6 karakter)"
            value={newUserPass}
            onChange={(e) => setNewUserPass(e.target.value)}
            className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(['KASIR', 'ADMIN'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setNewUserRole(r)}
                aria-pressed={newUserRole === r}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  newUserRole === r
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r === 'KASIR' ? 'Kasir' : 'Admin'}
              </button>
            ))}
          </div>
          <p className="mb-3 text-xs text-slate-500">
            {newUserRole === 'ADMIN'
              ? 'Akses penuh: termasuk Pengaturan, data PC, dan tambah user.'
              : 'Operasional harian: PC, voucher, transaksi, dan laporan.'}
          </p>
          <button
            type="button"
            onClick={() => void submitUser()}
            disabled={busy !== null}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === 'user' ? 'Menyimpan...' : 'Tambah User'}
          </button>
          {userMsg && (
            <p className="mt-2 rounded-md bg-green-50 px-2 py-1.5 text-xs text-green-700">
              {userMsg}
            </p>
          )}
          {users.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3">
              {users.map((u) => {
                const alasan = alasanTidakBisaHapus(u)
                return (
                  <li key={u.id} className="flex items-center gap-2 text-xs">
                    <span className="truncate font-medium text-slate-700">{u.username}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${
                        u.role === 'ADMIN'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {u.role}
                    </span>
                    {u.username === username && (
                      <span className="shrink-0 text-slate-400">(anda)</span>
                    )}
                    <button
                      type="button"
                      onClick={() => void hapusUser(u)}
                      disabled={busy !== null || alasan !== null}
                      title={alasan ?? `Hapus user ${u.username}`}
                      aria-label={`Hapus user ${u.username}`}
                      className="ml-auto shrink-0 rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-slate-200 disabled:hover:bg-transparent"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-800">Ganti Kata Sandi</h2>
          <input
            type="password"
            placeholder="Kata sandi lama"
            value={oldPass}
            onChange={(e) => setOldPass(e.target.value)}
            className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Kata sandi baru"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={submitPassword}
            disabled={busy !== null}
            className="mt-3 w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === 'password' ? 'Menyimpan...' : 'Ganti Kata Sandi'}
          </button>
        </section>

      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-slate-800">Backup Database</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void doBackup()}
            disabled={busy !== null}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === 'backup' ? 'Membuat...' : 'Buat Backup Sekarang'}
          </button>
          {backupInfo && (
            <span className="text-sm text-slate-600">
              Terakhir: {backupInfo.filename} ({formatBytes(backupInfo.sizeBytes)})
            </span>
          )}
        </div>
        {backups.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-slate-100 text-left text-slate-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Nama File</th>
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Ukuran</th>
                  <th className="px-3 py-2 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {barisBackup.map((bk) => (
                  <tr key={bk.filename}>
                    <td className="max-w-[260px] truncate px-3 py-2 font-mono text-xs text-slate-700">{bk.filename}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDateIndo(bk.createdAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatBytes(bk.sizeBytes)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void downloadBackupFile(bk.filename)}
                        disabled={busy !== null}
                        className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                      >
                        {busy === 'backup-download' ? 'Mengunduh...' : 'Download'}
                      </button>
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
        ) : (
          <p className="mt-3 text-sm text-slate-500">Belum ada backup.</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Backup otomatis dijalankan setiap pukul 01:00 dan riwayat lebih dari 30 hari otomatis dihapus.
        </p>
      </section>
    </div>
  )
}