import { useCallback, useEffect, useRef, useState } from 'react'
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
} from '../lib/api.ts'
import type { InstallerMeta, BackupResult, BackupFile } from '../lib/types.ts'
import LoadingOverlay from '../components/LoadingOverlay.tsx'

const BUSY_TEXT: Record<string, string> = {
  installer: 'Uploading installer',
  wallpaper: 'Uploading wallpaper',
  backup: 'Membuat backup',
  'backup-download': 'Mengunduh backup',
  download: 'Mengunduh installer',
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

export default function SettingsPage() {
  const { role } = useAuth()

  const [harga, setHarga] = useState('')
  const [grace, setGrace] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')

  const [pin, setPin] = useState('')
  const [pinMsg, setPinMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const installerRef = useRef<HTMLInputElement>(null)
  const wallRef = useRef<HTMLInputElement>(null)
  const [installed, setInstalled] = useState<InstallerMeta | null>(null)
  const [wallFname, setWallFname] = useState<string | null>(null)
  const [backupInfo, setBackupInfo] = useState<BackupResult | null>(null)
  const [backups, setBackups] = useState<BackupFile[]>([])

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
      setWallFname(s.wallpaper_lockscreen_path ?? null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
    void loadBackups()
  }, [load, loadBackups])

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
        <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-slate-800">Tarif & Kebijakan</h2>
        <div className="grid gap-3 sm:grid-cols-2">
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
            className="self-end rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === 'tarif' ? 'Menyimpan...' : 'Simpan Tarif'}
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
            className="self-end rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
          >
            {busy === 'grace' ? 'Menyimpan...' : 'Simpan Grace Period'}
          </button>
        </div>
      </section>

        <section className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-800">PIN Uninstall Agent</h2>
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
            className="mt-3 w-full rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
          >
            {busy === 'pin' ? 'Menyimpan...' : 'Simpan PIN'}
          </button>
          {pinMsg && (
            <div className="mt-2 text-sm text-green-700">{pinMsg}</div>
          )}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
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

        <section className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-800">Installer Aplikasi</h2>
          {installed ? (
            <div className="mb-3 truncate rounded-md bg-slate-50 p-2 text-xs text-slate-700">
              <span className="font-medium">{installed.filename}</span> · {formatBytes(installed.sizeBytes)}
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
          </div>
        </section>

        <section className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-800">Wallpaper Lock Screen</h2>
          <input
            ref={wallRef}
            type="file"
            accept=".jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => void onWallpaper(e.target.files?.[0])}
          />
          {wallFname ? (
            <p className="mb-3 truncate rounded-md bg-slate-50 p-2 text-xs text-slate-700">
              Wallpaper aktif: <span className="font-medium">{wallFname}</span>
            </p>
          ) : (
            <p className="mb-3 text-xs text-slate-500">Belum ada wallpaper terupload.</p>
          )}
          <button
            type="button"
            onClick={() => wallRef.current?.click()}
            disabled={busy !== null}
            className="mt-auto w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === 'wallpaper' ? 'Mengunggah...' : 'Upload (.jpg/.jpeg/.png, maks 10 MB)'}
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
          <div className="mt-3 max-h-60 overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-left text-slate-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Nama File</th>
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Ukuran</th>
                  <th className="px-3 py-2 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((bk) => (
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