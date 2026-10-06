import { useEffect, useMemo, useState } from 'react'
import { fetchPcs, createPc, deletePc, unlockPc, gantiNamaPc, setPcRusak, setWattPc } from '../lib/api.ts'
import type { Pc } from '../lib/types.ts'
import { useAuth } from '../context/AuthContext.tsx'
import ProgressBar from '../components/ui/ProgressBar.tsx'
import { Modal } from '../components/ui/Modal.tsx'
import { PastelCard } from '../components/ui/PastelCard.tsx'
import {
  inputClass,
  buttonClass,
  buttonSecondaryClass,
  errorClass,
  fieldLabelClass,
  hintClass,
} from '../components/ui'
import { Pagination } from '../components/ui/Pagination.tsx'
import {
  PER_HALAMAN,
  usePagination,
  urutkanTerbaru,
} from '../hooks/usePagination.ts'

function IsiPcPage() {
  const { role } = useAuth()

  const [pcs, setPcs] = useState<Pc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [namaPc, setNamaPc] = useState('')
  const [created, setCreated] = useState<Pc | null>(null)
  const [creating, setCreating] = useState(false)
  const [modal, setModal] = useState(false)

  const terurut = useMemo(() => urutkanTerbaru(pcs, (pc) => pc.createdAt), [pcs])
  const {
    data: baris,
    halaman,
    totalHalaman,
    total,
    setHalaman,
  } = usePagination(terurut)

  async function load() {
    try {
      setLoading(true)
      // ⚠️ `termasukRusak` hanya berlaku untuk ADMIN. Kalau kasir yang membuka
      // halaman ini, PC yang ditandai memang tidak akan terlihat — dan itu
      // benar, karena hanya ADMIN yang boleh mengubah flag itu.
      setPcs(await fetchPcs(role === 'ADMIN'))
      setError(null)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function bukaModal() {
    setError(null)
    setCreated(null)
    setModal(true)
  }

  function tutupModal() {
    if (creating) return
    setModal(false)
    setCreated(null)
    setError(null)
  }

  /* ---------- tandai PC rusak ---------- */
  const [rusakTarget, setRusakTarget] = useState<Pc | null>(null)
  const [alasanRusak, setAlasanRusak] = useState('')
  const [rusakError, setRusakError] = useState<string | null>(null)
  const [rusakInfo, setRusakInfo] = useState<string | null>(null)
  const [menyimpanRusak, setMenyimpanRusak] = useState(false)

  function bukaRusak(pc: Pc) {
    setRusakTarget(pc)
    setAlasanRusak(pc.alasanRusak ?? '')
    setRusakError(null)
  }

  function tutupRusak() {
    if (menyimpanRusak) return
    setRusakTarget(null)
    setAlasanRusak('')
    setRusakError(null)
  }

  async function handleSetRusak(rusak: boolean) {
    if (!rusakTarget) return
    setMenyimpanRusak(true)
    setRusakError(null)
    try {
      const hasil = await setPcRusak(rusakTarget.id, rusak, alasanRusak.trim() || undefined)
      setRusakTarget(null)
      setAlasanRusak('')
      await load()
      // Sesi yang dihentikan berarti ada sisa waktu yang dikembalikan ke
      // pelanggan. Kasir perlu tahu itu terjadi, bukan mengira PC ini idle.
      if (hasil.sesiDihentikan) {
        setRusakInfo(
          `${hasil.namaPc} ditandai rusak. Sesi yang sedang berjalan dihentikan dan sisa waktu dikembalikan.`,
        )
      }
    } catch (err: unknown) {
      const pesan = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
      setRusakError(Array.isArray(pesan) ? pesan[0] : (pesan ?? 'Gagal menyimpan flag PC rusak'))
    } finally {
      setMenyimpanRusak(false)
    }
  }

  /* ---------- ganti nama PC ---------- */
  const [editId, setEditId] = useState<string | null>(null)
  const [editNama, setEditNama] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)

  function bukaEdit(pc: Pc) {
    setEditId(pc.id)
    setEditNama(pc.namaPc)
    setEditError(null)
  }

  function tutupEdit() {
    if (menyimpan) return
    setEditId(null)
    setEditNama('')
    setEditError(null)
  }

  async function handleGantiNama(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    const nama = editNama.trim()
    if (!nama) {
      setEditError('Nama PC tidak boleh kosong.')
      return
    }
    setMenyimpan(true)
    setEditError(null)
    try {
      await gantiNamaPc(editId, nama)
      setEditId(null)
      setEditNama('')
      // Muat ulang supaya label di seluruh halaman ikut berubah.
      await load()
    } catch (err: unknown) {
      const pesan = (err as { response?: { data?: { message?: string } } }).response?.data?.message
      setEditError(pesan ?? 'Gagal mengganti nama PC')
    } finally {
      setMenyimpan(false)
    }
  }

  /**
   * Ubah daya listrik PC.
   *
   * ⚠️ Input TIDAK dikunci ke daftar preset, tapi tetap berupa angka 1-1000.
   * Alasannya: operator punya PC 150 W dan ada satu 300 W; memaksa memilih dari
   * daftar tetap akan salah untuk kasus yang belum dipikirkan. Validasi tetap
   * ditegakkan server — kolom ini jadi angka rupiah.
   */
  async function handleWatt(pc: Pc, mentah: string) {
    const watt = Number.parseInt(mentah, 10)
    if (!Number.isFinite(watt) || watt < 1 || watt > 1000) {
      setError('Daya harus angka antara 1 dan 1000 watt.')
      return
    }
    if (watt === pc.watt) return
    setError(null)
    try {
      await setWattPc(pc.id, watt)
      await load()
    } catch (err: unknown) {
      const pesan = (err as { response?: { data?: { message?: string } } }).response?.data?.message
      setError(pesan ?? 'Gagal menyimpan daya listrik PC')
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const pc = await createPc(namaPc)
      setCreated(pc)
      setNamaPc('')
      await load()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'Gagal membuat PC',
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus PC ini?')) return
    try {
      await deletePc(id)
      await load()
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  async function handleUnlock(id: string) {
    if (!confirm('Buka kunci PC ini? Sesi aktif akan dihentikan.')) return
    try {
      setError(null)
      await unlockPc(id)
      await load()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'Gagal membuka kunci',
      )
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      alert(`${label} berhasil disalin: ${text}`)
    } catch (err) {
      alert('Gagal menyalin ke clipboard')
    }
  }

  function formatShortId(id: string): string {
    return `${id.slice(0, 8)}…`
  }

  function formatShortToken(token: string): string {
    return `${token.slice(0, 8)}…`
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">PC Management</h1>
        {role === 'ADMIN' && (
          <button
            type="button"
            onClick={bukaModal}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            + Tambah PC
          </button>
        )}
      </div>

      <Modal open={modal} onClose={tutupModal} locked={creating} label="Tambah PC Baru">
        <form onSubmit={handleCreate}>
          <PastelCard
            label="PC BARU"
            title={created ? 'PC berhasil dibuat' : 'Tambah PC Baru'}
            onClose={tutupModal}
            closeDisabled={creating}
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            }
          >
            {created ? (
              <>
                <div>
                  <p className={fieldLabelClass}>agentToken</p>
                  <code className="mt-1 block break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
                    {created.agentToken}
                  </code>
                </div>
                <div>
                  <p className={fieldLabelClass}>PC ID</p>
                  <p className="break-all font-mono text-sm text-slate-800">{created.id}</p>
                </div>
                <p className={hintClass}>
                  agentToken dipakai agent untuk konek ke server. Salin sebelum menutup.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(created.agentToken, 'agentToken')}
                    className={buttonClass}
                  >
                    Salin agentToken
                  </button>
                  <button type="button" onClick={tutupModal} className={buttonSecondaryClass}>
                    Selesai
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={fieldLabelClass}>Nama PC</label>
                  <input
                    type="text"
                    value={namaPc}
                    onChange={(e) => setNamaPc(e.target.value)}
                    placeholder="Contoh: PC-01"
                    required
                    autoFocus
                    className={inputClass}
                  />
                </div>
                <p className={hintClass}>
                  IP tidak perlu diisi — server mencatatnya otomatis dari koneksi agent, jadi
                  tetap akurat walau IP PC berubah-ubah (DHCP).
                </p>
                {error && <p className={errorClass}>{error}</p>}
                <button type="submit" disabled={creating} className={buttonClass}>
                  {creating ? 'Membuat...' : 'Tambah PC'}
                </button>
              </>
            )}
          </PastelCard>
        </form>
      </Modal>

      {/* Modal ganti nama PC. Nama PC hanya label — PC ID, Agent Token, dan
          sesi yang sedang jalan tidak tersentuh. */}
      {editId && (
        <Modal open onClose={tutupEdit} locked={menyimpan} label="Ganti nama PC">
          <PastelCard
            label="PC"
            title="Ganti Nama PC"
            onClose={tutupEdit}
            closeDisabled={menyimpan}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            }
          >
            <p className={hintClass}>
              Nama PC hanya label tampilan. PC ID, Agent Token, dan sesi yang sedang
              berjalan tidak berubah — jadi aman dipakai saat PC sedang dipakai pelanggan.
            </p>
            <form onSubmit={handleGantiNama}>
              <div>
                <label className={fieldLabelClass} htmlFor="nama-pc-baru">Nama baru</label>
                <input
                  id="nama-pc-baru"
                  className={inputClass}
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  maxLength={30}
                  autoFocus
                  placeholder="Contoh: PC001"
                />
              </div>
              {editError && <p className={errorClass}>{editError}</p>}
              <button type="submit" disabled={menyimpan} className={buttonClass}>
                {menyimpan ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          </PastelCard>
        </Modal>
      )}

      {error && !modal && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {rusakInfo && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {rusakInfo}
          <button
            type="button"
            onClick={() => setRusakInfo(null)}
            className="ml-2 underline hover:no-underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Modal tandai PC rusak.
          ⚠️ Bunyinya: PC ini TIDAK rusak, hanya ditandai agar tidak dipakai.
          Operator sering memakai ini saat PC sedang diservis — jadi kalimatnya
          harus jelas supaya tidak disalahartikan sebagai "PC ini mati". */}
      {rusakTarget && (
        <Modal open onClose={tutupRusak} locked={menyimpanRusak} label="Tandai PC rusak">
          <PastelCard
            label={rusakTarget.namaPc}
            title={rusakTarget.rusak ? 'Batalkan Tanda Rusak' : 'Tandai PC Rusak'}
            onClose={tutupRusak}
            closeDisabled={menyimpanRusak}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            }
          >
            {rusakTarget.rusak ? (
              <>
                <p className={hintClass}>
                  Setelah flag dibatalkan, <strong>{rusakTarget.namaPc}</strong> muncul lagi di
                  dashboard, halaman login, dan aplikasi mobile, lalu bisa dipakai seperti biasa.
                </p>
                {rusakError && <p className={errorClass}>{rusakError}</p>}
                <button
                  type="button"
                  disabled={menyimpanRusak}
                  onClick={() => void handleSetRusak(false)}
                  className={buttonClass}
                >
                  {menyimpanRusak ? 'Menyimpan...' : `Ya, pakai lagi ${rusakTarget.namaPc}`}
                </button>
              </>
            ) : (
              <>
                <p className={hintClass}>
                  Ini <strong>bukan</strong> berarti {rusakTarget.namaPc} rusak. Tanda ini dipakai
                  supaya PC tidak bisa dipakai dan tidak muncul di dashboard, halaman login, dan
                  aplikasi mobile.
                </p>
                <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  Kalau sedang dipakai pelanggan, sesinya langsung dihentikan dan sisa
                  waktunya dikembalikan.
                </p>
                <form
                  className="mt-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleSetRusak(true)
                  }}
                >
                  <div>
                    <label className={fieldLabelClass} htmlFor="alasan-pc-rusak">
                      Alasan (opsional)
                    </label>
                    <input
                      id="alasan-pc-rusak"
                      className={inputClass}
                      value={alasanRusak}
                      onChange={(e) => setAlasanRusak(e.target.value)}
                      maxLength={200}
                      placeholder="Contoh: ganti hard disk, mouse rusak"
                    />
                  </div>
                  {rusakError && <p className={errorClass}>{rusakError}</p>}
                  <button type="submit" disabled={menyimpanRusak} className={buttonClass}>
                    {menyimpanRusak ? 'Menyimpan...' : `Tandai ${rusakTarget.namaPc} rusak`}
                  </button>
                </form>
              </>
            )}
          </PastelCard>
        </Modal>
      )}

      <div className="rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <div className="p-4"><ProgressBar label="Memuat PC" value={null} /></div>
        ) : pcs.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">Belum ada PC.</div>
          // ⚠️ TIDAK pakai `min-w-max` di sini. Lebar minimum itu memaksa
          // tabel melebar melebihi wadahnya, jadi halaman harus digeser
          // horizontal — dan kolom paling penting (Status, Last Heartbeat)
          // justru berada paling kanan, di luar layar. Diganti `table-fixed`
          // + lebar per kolom + ikon di header.
        ) : (
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 w-[15%]" scope="col">Nama</th>
                <th className="px-3 py-2 w-[15%]" scope="col">
                  <span className="flex items-center gap-1.5" title="IP client, diisi otomatis dari koneksi agent — tidak diisi manual">
                    <IkonMuka />
                    <span className="sr-only">IP client</span>
                  </span>
                </th>
                <th className="px-3 py-2 w-[13%]" scope="col">
                  <span className="flex items-center gap-1.5" title="PC ID — dipakai saat memasang ulang MSI">
                    <IkonKartu />
                    <span className="sr-only">PC ID</span>
                  </span>
                </th>
                <th className="px-3 py-2 w-[13%]" scope="col">
                  <span className="flex items-center gap-1.5" title="Agent Token — rahasia, jangan dibagikan">
                    <IkonGembok />
                    <span className="sr-only">Agent Token</span>
                  </span>
                </th>
                <th className="px-3 py-2 w-[9%]" scope="col">
                  <span className="flex items-center gap-1.5" title="Daya listrik PC (watt) — dasar perkiraan biaya listrik di laporan uptime">
                    <IkonBolt />
                    <span className="sr-only">Daya listrik (watt)</span>
                  </span>
                </th>
                <th className="px-3 py-2 w-[13%]" scope="col">
                  <span className="flex items-center gap-1.5" title="Status PC">
                    <IkonDenyut />
                    <span className="sr-only">Status</span>
                  </span>
                </th>
                <th className="px-3 py-2 w-[19%]" scope="col">
                  <span className="flex items-center gap-1.5" title="Heartbeat terakhir dari agent">
                    <IkonJam />
                    <span className="sr-only">Last Heartbeat</span>
                  </span>
                </th>
                {role === 'ADMIN' && <th className="px-3 py-2 w-[12%]" scope="col"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {baris.map((pc) => (
                <tr key={pc.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900 truncate" title={pc.namaPc}>
                    <span className="flex items-center gap-2">
                      {pc.namaPc}
                      {role === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => bukaEdit(pc)}
                          className="p-1 text-slate-400 hover:text-slate-700 transition"
                          title={`Ganti nama ${pc.namaPc}`}
                          aria-label={`Ganti nama ${pc.namaPc}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 truncate" title={pc.ipClient || 'belum connect'}>
                    {pc.ipClient || '— belum connect'}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-slate-500 truncate" title={pc.id}>
                        {formatShortId(pc.id)}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(pc.id, 'PC ID')}
                        className="p-1 text-slate-400 hover:text-slate-600 transition"
                        title="Salin PC ID"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-slate-500 truncate" title={pc.agentToken}>
                        {formatShortToken(pc.agentToken)}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(pc.agentToken, 'Agent Token')}
                        className="p-1 text-slate-400 hover:text-slate-600 transition"
                        title="Salin Agent Token"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        pc.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : pc.status === 'IDLE'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {pc.status}
                    </span>
                    {/* ⚠️ Badge "Rusak" ditampilkan DI BAWAH status, bukan
                        menggantikannya. Status koneksi masih informasi berguna —
                        PC yang ditandai masih heartbeat, jadi kasir bisa
                        membedakan "PC nyala tapi ditandai" dari "PC mati". */}
                    {pc.rusak && (
                      <div className="mt-1">
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                          Ditandai rusak
                        </span>
                        {pc.alasanRusak && (
                          <p className="mt-1 max-w-[220px] text-xs text-slate-500">
                            {pc.alasanRusak}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={1000}
                      defaultValue={pc.watt}
                      disabled={role !== 'ADMIN'}
                      onBlur={(e) => void handleWatt(pc, e.target.value)}
                      aria-label={`Daya listrik ${pc.namaPc} dalam watt`}
                      title={
                        role === 'ADMIN'
                          ? 'Daya PC dalam watt. Meter 2.200 VA itu kapasitas sambungan, bukan watt PC — pakai 150-300 W.'
                          : 'Hanya admin yang bisa mengubah daya listrik'
                      }
                      className="w-16 rounded border border-slate-300 px-1.5 py-1 text-right text-xs tabular-nums text-slate-700 disabled:border-transparent disabled:bg-transparent disabled:px-0"
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-600 truncate" title={pc.lastHeartbeatAt ?? ''}>
                    {pc.lastHeartbeatAt
                      ? new Date(pc.lastHeartbeatAt).toLocaleTimeString('id-ID', {
                          // ⚠️ WAJIB — lihat catatan di `formatWaktu()` pada `src/lib/api.ts`.
                          timeZone: 'Asia/Jakarta',
                        })
                      : '—'}
                  </td>
                  {role === 'ADMIN' && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 justify-end">
                      {/* ⚠️ Urutan tombol: tanda rusak, buka kunci, hapus.
                          PC yang ditandai tidak bisa dihapus, jadi tombol
                          Hapus mati sampai flag dibatalkan. Penolakan juga
                          ditegakkan server (409) — disable di sini cuma
                          biar kasir tidak salah klik. */}
                      {/* ⚠️ Ketiga tombol ini ikon saja.
                          Versi bertulisan ("Tandai Rusak", "Buka Kunci",
                          "Hapus") memakai total ~250px dalam kolom yang hanya
                          12% lebar, jadi ketiganya MEMBUNGKUS ke dua baris dan
                          setiap baris tabel jadi tinggi sekali — ruang yang
                          terbuang karena teks tombol, bukan karena data.
                          `title` + `aria-label` tetap menyimpan artinya, jadi
                          tidak ada yang hilang untuk pembaca layar. */}
                      <button
                        type="button"
                        onClick={() => bukaRusak(pc)}
                        title={pc.rusak ? `Batalkan tanda rusak ${pc.namaPc}` : `Tandai ${pc.namaPc} rusak`}
                        aria-label={pc.rusak ? `Batalkan tanda rusak ${pc.namaPc}` : `Tandai ${pc.namaPc} rusak`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-red-700 ring-1 ring-inset ring-red-300 transition hover:bg-red-50"
                      >
                        {pc.rusak ? <IkonPulih /> : <IkonPalu />}
                      </button>
                      {pc.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => void handleUnlock(pc.id)}
                          title={`Buka kunci ${pc.namaPc}`}
                          aria-label={`Buka kunci ${pc.namaPc}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700"
                        >
                          <IkonGembokBuka />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(pc.id)}
                        disabled={pc.rusak}
                        title={
                          pc.rusak
                            ? 'PC yang ditandai rusak tidak bisa dihapus — batalkan tandanya dulu'
                            : `Hapus ${pc.namaPc}`
                        }
                        aria-label={`Hapus ${pc.namaPc}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-400"
                      >
                        <IkonSampah />
                      </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && totalHalaman > 1 && (
          <Pagination
            currentPage={halaman}
            totalPages={totalHalaman}
            onPageChange={setHalaman}
            totalItems={total}
            itemsPerPage={PER_HALAMAN}
          />
        )}
      </div>
    </div>
  )
}

/**
 * ADMIN saja.
 *
 * ⚠️ Menu-nya disembunyikan di `Layout.tsx`, tapi itu BELUM cukup — kasir bisa
 * tetap sampai ke sini dengan mengetik `/pcs` atau bookmark lama. Kalau hanya
 * disembunyikan, jaminannya nol.
 *
 * ⚠️ Guard TIDAK ditulis di atas hook milik halaman ini. `return` sebelum
 * `useState`/`useEffect` membuat seluruh hook jadi bersyarat, dan itu ditolak
 * aturan `react-hooks/rules-of-hooks` — semuanya jadi error, bukan warning.
 * `SettingsPage` lolos hanya karena guard-nya diletakkan SETELAH semua hook.
 * Memisahkan komponen lebih bersih: kasir tidak sampai memanggil API sama sekali.
 *
 * ⚠️ Pesan penolakan WAJIB memberi jalan keluar. Tanpa tautan, kasir tiba-tiba
 * kehilangan akses tanpa tahu harus pindah ke mana.
 */
export default function PcPage() {
  const { role } = useAuth()

  if (role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="font-medium text-slate-800">Halaman PC Management hanya untuk ADMIN.</p>
        <p className="mt-1 text-sm text-slate-600">
          Memulai, mengunci, dan mematikan sesi PC tetap bisa dari halaman Dashboard.
        </p>
        <a
          href="/"
          className="mt-4 inline-block rounded-md bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          Kembali ke Dashboard
        </a>
      </div>
    )
  }

  return <IsiPcPage />
}

/*
 * Ikon header tabel PC.
 *
 * ⚠️ Ditulis lokal di file ini, bukan di komponen bersama, karena ada tiga
 * halaman lain yang punya tabel dengan gaya sama tapi berbeda ikon — memaksakan
 * satu komponen berarti setiap tabel harus menerima daftar ikon, dan yang
 * terjadi hanya ada kolom yang dibiarkan kosong.
 *
 * Semua `aria-hidden` + `sr-only` teks, supaya nama kolom tetap terbaca
 * pembaca layar walaupun header-nya cuma ikon.
 */
function IkonMuka() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
    </svg>
  )
}

function IkonKartu() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18v14H3zM3 10h18M7 15h4" />
    </svg>
  )
}

function IkonGembok() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7A5 5 0 007 7v2H5a1 1 0 00-1 1v11a1 1 0 001 1h14a1 1 0 001-1V10a1 1 0 00-1-1h-2z" />
    </svg>
  )
}

function IkonDenyut() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  )
}

function IkonJam() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
/*
 * Segitiga peringatan, bukan palu.
 *
 * ⚠️ Versi palu yang dipakai pertama kali ter-render jadi goresan kecil
 * kemerahan — pada 32px ukurannya tidak terbaca sebagai "tandai rusak", dan
 * operator jadi tidak tahu tombol itu melakukan apa. Segitiga + tanda seru
 * lazim berarti "bahaya/peringatan" di mana saja.
 */
function IkonBolt() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L4.1 12.7a1 1 0 00.8 1.6H11l-1 7.7 8.9-10.7a1 1 0 00-.8-1.6H12l1-7.7z" />
    </svg>
  )
}

function IkonPalu() {
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    </svg>
  )
}

function IkonPulih() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0113.7-5.7L20 6M20 14a8 8 0 01-13.7 5.7L4 18" />
    </svg>
  )
}

function IkonGembokBuka() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7A5 5 0 007 7v2H5a1 1 0 00-1 1v11a1 1 0 001 1h14a1 1 0 001-1V10a1 1 0 00-1-1h-2M8 9h8a4 4 0 010 8H8" />
    </svg>
  )
}

function IkonSampah() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  )
}
