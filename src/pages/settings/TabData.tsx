import { useMemo, useState } from 'react'
import { createBackup, downloadAuth, patchSetting, kirimLaporanTutupHari } from '../../lib/api.ts'
import type { BackupFile, BackupResult } from '../../lib/types.ts'
import { Pagination } from '../../components/ui/Pagination.tsx'
import ProgressBar from '../../components/ui/ProgressBar.tsx'
import { PER_HALAMAN, urutkanTerbaru, usePagination } from '../../hooks/usePagination.ts'
import { SettingsCard } from './SettingsCard'
import { formatBytes, formatDateIndo, type SettingsCtx } from './shared'

/**
 * Penanda kasar alamat yang terlihat tidak valid.
 *
 * ⚠️ Sengaja dibuat SAMA LONGAR dengan `pisahkanEmail()` di server. Kalau
 * pemeriksaan di sini lebih ketat, admin akan melihat "ditolak" untuk alamat
 * yang sebenarnya terkirim — dan itu lebih membingungkan daripada tidak
 * memeriksa sama sekali. Yang ditanya hanya bentuk yang jelas-jelas salah,
 * sisanya diserahkan ke server.
 */
function PesanAlamatEmail({ mentah }: { mentah: string }) {
  const kandidat = mentah.split(/[;,\s]+/).map((s) => s.trim()).filter(Boolean)
  if (kandidat.length === 0) {
    return (
      <p className="mt-1 text-[11px] text-slate-400">
        Kosong — laporan akan dikirim ke alamat bawaan di server.
      </p>
    )
  }
  const rusak = kandidat.filter((k) => {
    const at = k.split('@')
    return !(at.length === 2 && at[0].length > 0 && at[1].includes('.'))
  })
  if (rusak.length === 0) {
    return (
      <p className="mt-1 text-[11px] text-emerald-700">
        {kandidat.length} alamat valid.
      </p>
    )
  }
  return (
    <p className="mt-1 text-[11px] text-amber-700">
      {rusak.length} alamat terlihat tidak valid dan akan dilewati:{' '}
      {rusak.join(', ')}
    </p>
  )
}

export default function TabData({
  ctx,
  backups,
  backupInfo,
  setBackupInfo,
  reloadBackups,
  emailTujuan,
  setEmailTujuan,
}: {
  ctx: SettingsCtx
  backups: BackupFile[]
  backupInfo: BackupResult | null
  setBackupInfo: (v: BackupResult | null) => void
  reloadBackups: () => Promise<void>
  emailTujuan: string
  setEmailTujuan: (v: string) => void
}) {
  const { busy, run, setErr, setMsg } = ctx
  // File yang sedang diunduh, supaya bar kemajuan menempel pada baris yang
  // sedang dikerjakan dan bukan di semua baris sekaligus.
  const [unduh, setUnduh] = useState<Record<string, { percent: number | null; detail?: string }>>({})

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


  async function saveEmailTujuan(): Promise<void> {
    await run('email-tujuan', async () => {
      try {
        setErr(null)
        await patchSetting('laporan_email_tujuan', emailTujuan.trim())
        setMsg('Penerima email laporan tersimpan')
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function kirimSekarang(): Promise<void> {
    await run('kirim-laporan', async () => {
      try {
        setErr(null)
        // ⚠️ Simpan DULUH baru kirim. Kalau kirim dulu lalu simpan, emailnya
        // masih memakai daftar lama — jadi admin mengira daftar barunya sudah
        // diuji padahal belum.
        await patchSetting('laporan_email_tujuan', emailTujuan.trim())
        const hasil = await kirimLaporanTutupHari()
        if (!hasil.email.ok) {
          setErr(`Email gagal: ${hasil.email.error ?? 'tanpa keterangan'}`)
          return
        }
        const ditolak = hasil.email.info?.match(/(\d+) dilewati/)
        setMsg(
          `Laporan terkirim ke ${hasil.email.info ?? 'penerima'}` +
            (ditolak ? ` (${ditolak[1]} alamat dilewati)` : ''),
        )
        await reloadBackups()
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function downloadBackupFile(filename: string) {
    await run('backup-download', async () => {
      try {
        setUnduh((s) => ({ ...s, [filename]: { percent: 0 } }))
        await downloadAuth(
          `/settings/backup/download?filename=${encodeURIComponent(filename)}`,
          filename,
          (p) =>
            setUnduh((s) => ({
              ...s,
              [filename]: {
                percent: p.percent,
                detail: p.total
                  ? `${formatBytes(p.loaded)} dari ${formatBytes(p.total)}`
                  : `${formatBytes(p.loaded)}`,
              },
            })),
        )
        setUnduh((s) => {
          const { [filename]: _buang, ...sisa } = s
          return sisa
        })
        setMsg(`Backup diunduh: ${filename}`)
      } catch (e) {
        setUnduh((s) => {
          const { [filename]: _buang, ...sisa } = s
          return sisa
        })
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="grid gap-5">
      {/* ===== Penerima Email Laporan =====
          ⚠️ Nilai ini dibaca ulang tiap kali laporan dikirim, jadi tidak ada
          restart dan tidak perlu tombol terapkan terpisah. Yang dilakukan di
          bawah hanya fallback: kalau Setting kosong, server memakai variabel
          environment `LAPORAN_EMAIL_TUJUAN` seperti sebelumnya. */}
      <SettingsCard
        title="Penerima Email Laporan"
        description="Laporan tutup hari dikirim ke semua alamat di bawah, setiap hari jam 23:30 WIB."
      >
        <textarea
          value={emailTujuan}
          onChange={(e) => setEmailTujuan(e.target.value)}
          rows={3}
          placeholder={'contoh@warnet.id, kedua@warnet.id'}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

        {/* Validasi dibuat sama longgarnya dengan server: kalau di sini
            lebih ketat, admin akan melihat alamat ditolak padahal server
            menerimanya — dan itu lebih membingungkan daripada tidak
            memvalidasi sama sekali. Yang ditampilkan hanya penanda kasar,
            sisanya biarkan server yang memutuskan. */}
        <PesanAlamatEmail mentah={emailTujuan} />

        <p className="mt-1 text-[11px] text-slate-500">
          Pisahkan dengan koma, titik koma, atau baris baru. Alamat yang tidak
          valid dilewati, bukan membatalkan pengiriman ke alamat lain. Kosongkan
          untuk memakai pengaturan bawaan di server.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveEmailTujuan}
            disabled={busy !== null}
            className="rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
          >
            {busy === 'email-tujuan' ? 'Menyimpan...' : 'Simpan Penerima'}
          </button>
          {/* Kirim sekarang sekaligus jadi TES: kalau alamat salah, SMTP
              rusak, atau PDF-nya tidak jadi, hasilnya langsung terlihat di
              sini — bukan besok malam saat tidak ada yang sedang memantau. */}
          <button
            type="button"
            onClick={kirimSekarang}
            disabled={busy !== null}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === 'kirim-laporan' ? 'Mengirim...' : 'Simpan & Kirim Sekarang'}
          </button>
        </div>
      </SettingsCard>

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
                  {unduh[bk.filename] ? (
                    <div className="mt-2 rounded-full bg-sky-600 px-3 py-2">
                      <ProgressBar
                        tone="light"
                        size="sm"
                        value={unduh[bk.filename].percent}
                        detail={unduh[bk.filename].detail}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void downloadBackupFile(bk.filename)}
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
                      {unduh[bk.filename] ? (
                        <div className="ml-auto w-40 rounded-full bg-sky-600 px-3 py-1.5">
                          <ProgressBar
                            tone="light"
                            size="sm"
                            value={unduh[bk.filename].percent}
                            detail={unduh[bk.filename].detail}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void downloadBackupFile(bk.filename)}
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
