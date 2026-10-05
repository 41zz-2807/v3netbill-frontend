import { patchSetting } from '../../lib/api.ts'
import { SettingsCard } from './SettingsCard'
import type { SettingsCtx } from './shared'

/**
 * Nilai tarif & grace period datang dari SettingsPage, bukan state lokal.
 * Kalau state lokal di sini mulai kosong, form akan tampil kosong padahal
 * server sudah punya nilai, dan menekan Simpan akan menimpa nilai itu dengan
 * string kosong.
 */
export default function TabTarif({
  ctx,
  harga,
  grace,
  setHarga,
  setGrace,
  autoMati,
  setAutoMati,
}: {
  ctx: SettingsCtx
  harga: string
  grace: string
  setHarga: (v: string) => void
  setGrace: (v: string) => void
  autoMati: string
  setAutoMati: (v: string) => void
}) {
  const { busy, run, setErr, setMsg } = ctx

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

  async function saveAutoMati() {
    await run('auto-mati', async () => {
      try {
        setErr(null)
        // ⚠️ Backend jatuh ke default 5 kalau nilainya bukan angka >= 0. Jadi
        // teks yang diketik kasir di sini tidak akan menggagalkan penyimpanan,
        // hanya diam-diam diabaikan — dan gejalanya baru muncul jauh kemudian,
        // saat PC tiba-tiba mati sendiri. Karena itu divalidasi di frontend
        // juga supaya kasir diberi tahu sekarang.
        const angka = Number(autoMati.trim())
        if (!Number.isInteger(angka) || angka < 0) {
          setErr('Menit harus angka bulat 0 atau lebih. Isi 0 untuk mematikan fitur ini.')
          return
        }
        await patchSetting('auto_shutdown_menit', String(angka))
        setMsg('Pengaturan auto-matikan tersimpan')
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SettingsCard title="Harga per Menit" description="Dipakai untuk menghitung sisa waktu voucher dan member.">
        <input
          type="text"
          inputMode="numeric"
          value={harga}
          onChange={(e) => setHarga(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={saveTarif}
          disabled={busy !== null}
          className="mt-2 self-start rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
        >
          {busy === 'tarif' ? 'Menyimpan...' : 'Simpan Tarif'}
        </button>
      </SettingsCard>

      <SettingsCard
        title="Grace Period"
        description="Jeda dalam detik sebelum sesi otomatis berhenti saat koneksi PC putus."
      >
        <input
          type="text"
          inputMode="numeric"
          value={grace}
          onChange={(e) => setGrace(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={saveGrace}
          disabled={busy !== null}
          className="mt-2 self-start rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
        >
          {busy === 'grace' ? 'Menyimpan...' : 'Simpan Grace Period'}
        </button>
      </SettingsCard>

      <SettingsCard
        title="Matikan PC Otomatis"
        description="Menit menganggur sebelum PC dimatikan otomatis. Isi 0 untuk mematikan fitur ini."
      >
        <input
          type="text"
          inputMode="numeric"
          value={autoMati}
          onChange={(e) => setAutoMati(e.target.value)}
          placeholder="5"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">
          Hitungan mulai ulang setiap ada aktivitas login, saat kasir menekan
          Buka Kunci, dan setiap kali PC konek ke server. PC yang sedang dipakai
          pelanggan tidak pernah dimatikan.
        </p>
        <button
          type="button"
          onClick={saveAutoMati}
          disabled={busy !== null}
          className="mt-2 self-start rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
        >
          {busy === 'auto-mati' ? 'Menyimpan...' : 'Simpan Auto-Matikan'}
        </button>
      </SettingsCard>
    </div>
  )
}
