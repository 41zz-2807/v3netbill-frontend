import { useEffect, useMemo, useState } from 'react'
import { fetchPcs, createPc, deletePc, unlockPc, gantiNamaPc } from '../lib/api.ts'
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

export default function PcPage() {
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
      setPcs(await fetchPcs())
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

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="p-4"><ProgressBar label="Memuat PC" value={null} /></div>
        ) : pcs.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">Belum ada PC.</div>
        ) : (
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2" title="Diisi otomatis dari koneksi agent, tidak diisi manual">IP (otomatis)</th>
                <th className="px-4 py-2">PC ID</th>
                <th className="px-4 py-2">Agent Token</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Last Heartbeat</th>
                {role === 'ADMIN' && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {baris.map((pc) => (
                <tr key={pc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">
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
                  <td className="px-4 py-2 text-slate-600">{pc.ipClient || '— belum connect'}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-slate-500" title={pc.id}>
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
                      <code className="font-mono text-xs text-slate-500 truncate max-w-[120px]" title={pc.agentToken}>
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
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {pc.lastHeartbeatAt
                      ? new Date(pc.lastHeartbeatAt).toLocaleTimeString('id-ID', {
                          // ⚠️ WAJIB — lihat catatan di `formatWaktu()` pada `src/lib/api.ts`.
                          timeZone: 'Asia/Jakarta',
                        })
                      : '—'}
                  </td>
                  {role === 'ADMIN' && (
                    <td className="px-4 py-2 text-right">
                      {pc.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => void handleUnlock(pc.id)}
                          className="mr-2 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Buka Kunci
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(pc.id)}
                        style={{ '--btn-clr': '#dc2626' } as React.CSSProperties}
                        className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                      >
                        Hapus
                      </button>
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