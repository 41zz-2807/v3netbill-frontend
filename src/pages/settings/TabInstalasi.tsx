import { useRef } from 'react'
import { downloadAuth, uploadInstaller, uploadWallpaper } from '../../lib/api.ts'
import type { InstallerMeta } from '../../lib/types.ts'
import { SettingsCard } from './SettingsCard'
import { adaTanggal, formatBytes, formatDateIndo, type SettingsCtx } from './shared'

export default function TabInstalasi({
  ctx,
  installed,
  apk,
  wallFname,
  reload,
}: {
  ctx: SettingsCtx
  installed: InstallerMeta | null
  apk: InstallerMeta | null
  wallFname: string | null
  reload: () => Promise<void>
}) {
  const { busy, run, setErr, setMsg } = ctx
  const installerRef = useRef<HTMLInputElement>(null)
  const wallRef = useRef<HTMLInputElement>(null)

  async function onInstaller(file?: File) {
    if (!file) return
    await run('installer', async () => {
      try {
        setErr(null)
        const meta = await uploadInstaller(file)
        await reload()
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
        await reload()
        setMsg(`Wallpaper terupload: ${res.path}`)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SettingsCard
        title="Installer Agent"
        description="Paket .exe atau .msi untuk PC kasir. Maksimal 200 MB."
      >
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
              onClick={() =>
                void run('download', async () => {
                  try {
                    const fname = installed.filename ?? 'v3netbill-installer.msi'
                    await downloadAuth('/settings/installer', fname)
                    setMsg('Installer diunduh')
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : String(e))
                  }
                })
              }
              disabled={busy !== null}
              className="rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
            >
              {busy === 'download' ? 'Mengunduh...' : 'Unduh Installer'}
            </button>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Aplikasi Android"
        description="APK untuk HP kasir. Maksimal 200 MB."
      >
        {apk ? (
          <div className="mb-3 rounded-md bg-slate-50 p-2 text-xs text-slate-700">
            <div className="truncate">
              <span className="font-medium">{apk.filename}</span> · {formatBytes(apk.sizeBytes)}
            </div>
            {adaTanggal(apk.uploadedAt) && (
              <div className="mt-0.5 text-slate-500">
                Diunggah {formatDateIndo(apk.uploadedAt)}
              </div>
            )}
          </div>
        ) : (
          <p className="mb-3 text-xs text-slate-500">Belum ada APK Android terupload.</p>
        )}

        <div className="mt-auto">
          {apk ? (
            <button
              type="button"
              onClick={() =>
                void run('downloadApk', async () => {
                  try {
                    await downloadAuth('/settings/apk', 'v3netbill.apk')
                    setMsg('APK Android diunduh')
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : String(e))
                  }
                })
              }
              disabled={busy !== null}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {busy === 'downloadApk' ? 'Mengunduh...' : 'Download APK'}
            </button>
          ) : (
            <p className="text-xs text-slate-400">APK belum tersedia.</p>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Wallpaper Lock Screen"
        description="Gambar latar layar kunci PC. Format .jpg/.jpeg/.png, maksimal 10 MB."
      >
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
          className="mt-auto rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy === 'wallpaper' ? 'Mengunggah...' : 'Upload Wallpaper'}
        </button>
      </SettingsCard>
    </div>
  )
}
