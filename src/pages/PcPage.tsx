import { useEffect, useState } from 'react'
import { fetchPcs, createPc, deletePc, unlockPc } from '../lib/api.ts'
import type { Pc } from '../lib/types.ts'
import { useAuth } from '../context/AuthContext.tsx'
import Loader from '../components/Loader.tsx'

export default function PcPage() {
  const { role } = useAuth()
  const [pcs, setPcs] = useState<Pc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [namaPc, setNamaPc] = useState('')
  const [created, setCreated] = useState<Pc | null>(null)
  const [creating, setCreating] = useState(false)

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
      <h1 className="mb-6 text-2xl font-bold text-slate-900">PC Management</h1>

      {role === 'ADMIN' && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-lg border border-slate-200 bg-white p-4"
        >
          <h2 className="mb-3 font-semibold text-slate-800">Tambah PC Baru</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={namaPc}
              onChange={(e) => setNamaPc(e.target.value)}
              placeholder="Nama PC (contoh: PC-01)"
              required
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {creating ? 'Membuat...' : 'Tambah'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            IP tidak perlu diisi — server mencatatnya otomatis dari koneksi agent, jadi tetap akurat
            walau IP PC berubah-ubah (DHCP).
          </p>

          {created && (
            <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm">
              <div className="font-semibold text-orange-800">PC dibuat — salin agentToken untuk agent:</div>
              <code className="mt-1 block break-all rounded bg-orange-100 px-2 py-1 text-orange-900">
                {created.agentToken}
              </code>
              <div className="mt-1 text-xs text-orange-700">
                PC ID: <code>{created.id}</code>
              </div>
            </div>
          )}
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-4"><Loader text="Memuat PC" /></div>
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
              {pcs.map((pc) => (
                <tr key={pc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{pc.namaPc}</td>
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
                      ? new Date(pc.lastHeartbeatAt).toLocaleTimeString('id-ID')
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
      </div>
    </div>
  )
}