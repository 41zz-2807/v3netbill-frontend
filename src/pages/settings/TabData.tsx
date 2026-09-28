import { useMemo } from 'react'
import { createBackup, downloadAuth } from '../../lib/api.ts'
import type { BackupFile, BackupResult } from '../../lib/types.ts'
import { Pagination } from '../../components/ui/Pagination.tsx'
import { PER_HALAMAN, urutkanTerbaru, usePagination } from '../../hooks/usePagination.ts'
import { SettingsCard } from './SettingsCard'
import { formatBytes, formatDateIndo, type SettingsCtx } from './shared'

export default function TabData({
  ctx,
  backups,
  backupInfo,
  setBackupInfo,
  reloadBackups,
}: {
  ctx: SettingsCtx
  backups: BackupFile[]
  backupInfo: BackupResult | null
  setBackupInfo: (v: BackupResult | null) => void
  reloadBackups: () => Promise<void>
}) {
  const { busy, run, setErr, setMsg } = ctx

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

  async function doBackup() {
    await run('backup', async () => {
      try {
        setErr(null)
        const b = await createBackup()
        setBackupInfo(b)
        setMsg(`Backup database berhasil: ${b.filename}`)
        await reloadBackups()
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function downloadBackupFile(filename: string) {
    await run('backup-download', async () => {
      try {
        await downloadAuth(
          `/settings/backup/download?filename=${encodeURIComponent(filename)}`,
          filename,
        )
        setMsg(`Backup diunduh: ${filename}`)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="grid gap-5">
      <SettingsCard
        title="Backup Database"
        description="Backup otomatis dijalankan setiap pukul 01:00 dan riwayat lebih dari 30 hari otomatis dihapus."
      >
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
      </SettingsCard>

      <SettingsCard title="Riwayat Backup" description="Klik Download untuk menyimpan salinan lokal.">
        {backups.length > 0 ? (
          <>
            {/* Di layar sempit tabel dipindah jadi kartu bertumpuk. Tabelnya
                memakai min-w-max sehingga di HP kolom Aksi terdorong keluar
                layar dan tidak ada petunjuk kalau bisa digeser — tombol
                Download jadi praktis tidak ditemukan. */}
            <ul className="space-y-2 sm:hidden">
              {barisBackup.map((bk) => (
                <li
                  key={bk.filename}
                  className="rounded-md border border-slate-200 p-3 text-sm"
                >
                  <div className="break-all font-mono text-xs text-slate-700">
                    {bk.filename}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="whitespace-nowrap">{formatDateIndo(bk.createdAt)}</span>
                    <span className="whitespace-nowrap">{formatBytes(bk.sizeBytes)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadBackupFile(bk.filename)}
                    disabled={busy !== null}
                    className="mt-2 w-full rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {busy === 'backup-download' ? 'Mengunduh...' : 'Download'}
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto rounded-md border border-slate-200 sm:block">
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
                    <td className="max-w-[220px] truncate px-3 py-2 font-mono text-xs text-slate-700 sm:max-w-[260px]">
                      {bk.filename}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {formatDateIndo(bk.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {formatBytes(bk.sizeBytes)}
                    </td>
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
          </>
        ) : (
          <p className="text-sm text-slate-500">Belum ada backup.</p>
        )}
      </SettingsCard>
    </div>
  )
}
