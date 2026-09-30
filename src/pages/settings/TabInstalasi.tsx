import { useRef, useState } from 'react'
import { downloadAuth, uploadInstaller, uploadWallpaper } from '../../lib/api.ts'
import type { InstallerMeta } from '../../lib/types.ts'
import ProgressBar from '../../components/ui/ProgressBar.tsx'
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
  // Kemajuan unduhan, disimpan per berkas supaya dua kartu tidak saling menimpa.
  const [unduh, setUnduh] = useState<Record<string, { percent: number | null; detail?: string }>>({})

  async function unduhBerkas(
    kunci: string,
    path: string,
    fname: string,
    label: string,
  ) {
    await run(kunci, async () => {
      try {
        setUnduh((s) => ({ ...s, [kunci]: { percent: 0 } }))
        await downloadAuth(path, fname, (p) =>
          setUnduh((s) => ({
            ...s,
            [kunci]: {
              percent: p.percent,
              detail: p.total
                ? `${formatBytes(p.loaded)} dari ${formatBytes(p.total)}`
                : `${formatBytes(p.loaded)}`,
            },
          })),
        )
        setMsg(label)
        setUnduh((s) => {
          const { [kunci]: _buang, ...sisa } = s
          return sisa
        })
      } catch (e) {
        setUnduh((s) => {
          const { [kunci]: _buang, ...sisa } = s
          return sisa
        })
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
          {installed &&
            (unduh.download ? (
              <div className="rounded-md bg-slate-900 px-3 py-2.5">
                <ProgressBar
                  tone="light"
                  value={unduh.download.percent}
                  label="Mengunduh installer"
                  detail={unduh.download.detail}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void unduhBerkas(
                    'download',
                    '/settings/installer',
                    installed.filename ?? 'v3netbill-installer.msi',
                    'Installer diunduh',
                  )
                }
                disabled={busy !== null}
                className="rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
              >
                Unduh Installer
              </button>
            ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Aplikasi Android"
        description="APK untuk HP kasir. Maksimal 200 MB."
      >
        {apk ? (
          <div className="mb-3 rounded-md bg-slate-50 p-2 text-xs text-slate-700">
            <div className="truncate">
              <span className="font-medium">{apk.filename}</span> ·{' '}
              {formatBytes(apk.sizeBytes)}
            </div>
            {/* Versi ini dibaca backend dari dalam APK. Penting untuk kasir:
                aplikasi Android membandingkan nomor ini dengan miliknya sendiri
                untuk menampilkan "pembaruan tersedia". Kalau tidak tampil di
                sini, orang tidak bisa memastikan HP-nya sudah versi benar. */}
            <div className="mt-0.5 text-slate-500">
              {apk.versionName ? (
                <>
                  Versi {apk.versionName} (build {apk.versionCode})
                </>
              ) : (
                'Nomor versi tidak terbaca dari APK ini'
              )}
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
            unduh.downloadApk ? (
              <div className="rounded-md bg-slate-900 px-3 py-2.5">
                <ProgressBar
                  tone="light"
                  value={unduh.downloadApk.percent}
                  label="Mengunduh APK"
                  detail={unduh.downloadApk.detail}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void unduhBerkas(
                    'downloadApk',
                    '/settings/apk',
                    'v3netbill.apk',
                    'APK Android diunduh',
                  )
                }
                disabled={busy !== null}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Download APK
              </button>
            )
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
