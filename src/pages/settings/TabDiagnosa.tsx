import { useCallback, useEffect, useState } from 'react'
import { downloadAuth, fetchDiagnosaList } from '../../lib/api.ts'
import type { DiagnosaFile } from '../../lib/types.ts'
import { SettingsCard } from './SettingsCard'
import ProgressBar from '../../components/ui/ProgressBar.tsx'
import { formatBytes, formatDateIndo, type SettingsCtx } from './shared'

/**
 * Paket diagnosa yang dikirim agent Windows.
 *
 * Agent mengirimnya SENDIRI ketika socket ke server dinyatakan mati — bukan
 * karena ada perintah dari sini. Jadi daftar ini tidak pernah bisa dipaksa
 * terkirim: operator hanya bisa melihat dan mengunduh apa yang sudah terkirim.
 */
export default function TabDiagnosa({ ctx }: { ctx: SettingsCtx }) {
  const { busy, run, setErr, setMsg } = ctx

  const [daftar, setDaftar] = useState<DiagnosaFile[]>([])
  const [unduh, setUnduh] = useState<Record<string, { percent: number | null; detail?: string }>>({})

  const muat = useCallback(async () => {
    try {
      setDaftar(await fetchDiagnosaList())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [setErr])

  useEffect(() => {
    void muat()
  }, [muat])

  async function unduhBerkas(f: DiagnosaFile) {
    await run('diagnosa-download', async () => {
      try {
        setErr(null)
        setUnduh((s) => ({ ...s, [f.filename]: { percent: 0 } }))
        await downloadAuth(
          `/diagnosa/${encodeURIComponent(f.filename)}`,
          f.filename,
          (p) =>
            setUnduh((s) => ({
              ...s,
              [f.filename]: {
                percent: p.percent,
                detail: p.total
                  ? `${formatBytes(p.loaded)} dari ${formatBytes(p.total)}`
                  : formatBytes(p.loaded),
              },
            })),
        )
        setMsg(`Diagnosa diunduh: ${f.filename}`)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      } finally {
        setUnduh((s) => {
          const next = { ...s }
          delete next[f.filename]
          return next
        })
      }
    })
  }

  const ada = daftar.length > 0

  return (
    <div className="grid gap-5">
      <SettingsCard
        title="Diagnosa Agent"
        description="Agent Windows mengirim paket ini otomatis ke server ketika koneksinya ke server putus dan tidak berhasil pulih — bukan karena ada perintah dari halaman ini. Isinya log agent, status service, scheduled task, dan daftar proses. Berkas yang lebih dari 14 hari otomatis dihapus."
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void run('diagnosa-muat', muat)}
            disabled={busy !== null}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === 'diagnosa-muat' ? 'Memuat...' : 'Muat ulang'}
          </button>
          <span className="text-xs text-slate-500">
            {ada ? `${daftar.length} berkas terkirim` : 'Belum ada berkas diagnosa.'}
          </span>
        </div>

        </SettingsCard>

      {ada && (
        <SettingsCard
          title="Berkas terkirim"
          description="Klik Download untuk menyimpan salinan lokal."
        >
          {/* Pola sama seperti tabel backup: di layar sempit tabel min-w-max
              mendorong kolom Aksi keluar layar tanpa petunjuk bisa digeser,
              jadi di bawah `sm` diganti kartu bertumpuk. */}
          <ul className="space-y-2 sm:hidden">
            {daftar.map((f) => (
              <li key={f.filename} className="rounded-md border border-slate-200 p-3 text-sm">
                <div className="break-all font-mono text-xs text-slate-700">{f.filename}</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-600">
                  <span className="whitespace-nowrap">{formatDateIndo(f.createdAt)}</span>
                  <span className="whitespace-nowrap">{formatBytes(f.sizeBytes)}</span>
                </div>
                {unduh[f.filename] ? (
                  <div className="mt-2 rounded-full bg-sky-600 px-3 py-2">
                    <ProgressBar
                      tone="light"
                      size="sm"
                      value={unduh[f.filename].percent}
                      detail={unduh[f.filename].detail}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void unduhBerkas(f)}
                    disabled={busy !== null}
                    className="mt-2 w-full rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    Download
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-md border border-slate-200 sm:block">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-slate-100 text-left text-slate-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Nama File</th>
                  <th className="px-3 py-2 font-medium">PC</th>
                  <th className="px-3 py-2 font-medium">Dikirim</th>
                  <th className="px-3 py-2 font-medium">Ukuran</th>
                  <th className="px-3 py-2 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daftar.map((f) => (
                  <tr key={f.filename}>
                    <td className="max-w-[220px] truncate px-3 py-2 font-mono text-xs text-slate-700 sm:max-w-[280px]">
                      {f.filename}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {f.pcId || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {formatDateIndo(f.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {formatBytes(f.sizeBytes)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {unduh[f.filename] ? (
                        <div className="ml-auto w-40 rounded-full bg-sky-600 px-3 py-1.5">
                          <ProgressBar
                            tone="light"
                            size="sm"
                            value={unduh[f.filename].percent}
                            detail={unduh[f.filename].detail}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void unduhBerkas(f)}
                          disabled={busy !== null}
                          className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                        >
                          Download
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsCard>
      )}
    </div>
  )
}