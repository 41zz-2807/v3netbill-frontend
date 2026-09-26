import { useEffect, useState } from 'react'
import { fetchTransactions, batalTransaksi, formatRupiah } from '../lib/api.ts'
import type { Transaction } from '../lib/types.ts'
import Loader from '../components/Loader.tsx'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')

  async function load() {
    try {
      setLoading(true)
      setTransactions(await fetchTransactions({ dari: dari || undefined, sampai: sampai || undefined }))
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

  function applyFilter(e: React.FormEvent) {
    e.preventDefault()
    void load()
  }

  async function handleBatal(t: Transaction) {
    const label = t.account.nama ?? t.account.kodeUnik ?? '-'
    const nominalTxt = t.jenis === 'KOREKSI' ? `-${formatRupiah(Math.abs(t.nominal))}` : formatRupiah(t.nominal)
    if (
      !confirm(
        `Batalkan transaksi ini?\n\n${label} — ${t.jenis} ${nominalTxt}\n` +
          `Waktu (${t.durasiMenit} mnt) akan dikembalikan/dikurangi dari akun.\n\n` +
          'Hanya bisa dibatalkan jika ini transaksi terakhir akun (maks 10 menit).',
      )
    ) {
      return
    }
    try {
      await batalTransaksi(t.account.id, t.id)
      await load()
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Riwayat Transaksi</h1>

      <form
        onSubmit={applyFilter}
        className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Dari</label>
          <input
            type="date"
            value={dari}
            onChange={(e) => setDari(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Sampai</label>
          <input
            type="date"
            value={sampai}
            onChange={(e) => setSampai(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          Filter
        </button>
        <button
          type="button"
          onClick={() => {
            setDari('')
            setSampai('')
            void load()
          }}
          className="rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
        >
          Reset
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-4"><Loader text="Memuat transaksi" /></div>
        ) : transactions.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">Belum ada transaksi.</div>
        ) : (
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Waktu</th>
                <th className="px-4 py-2">Akun</th>
                <th className="px-4 py-2">Jenis</th>
                <th className="px-4 py-2 text-right">Nominal</th>
                <th className="px-4 py-2">Durasi</th>
                <th className="px-4 py-2">Kasir</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <tr
                  key={t.id}
                  className={`hover:bg-slate-50 ${
                    t.dibatalkan ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(t.createdAt).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {t.account.nama ?? t.account.kodeUnik}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {t.jenis}{t.jenis === 'KOREKSI' && <span className="ml-1 text-xs text-orange-500">(−)</span>}
                    {t.dibatalkan && (
                      <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                        DIBATALKAN
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${
                      t.jenis === 'KOREKSI' ? 'text-red-600' : 'text-slate-900'
                    }`}
                  >
                    {t.jenis === 'KOREKSI' ? `-${formatRupiah(Math.abs(t.nominal))}` : formatRupiah(t.nominal)}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-slate-600">{t.durasiMenit} mnt</td>
                  <td className="px-4 py-2 text-slate-600">{t.kasir.username}</td>
                  <td className="px-4 py-2 text-right">
                    {t.bisaDibatalkan ? (
                      <button
                        onClick={() => void handleBatal(t)}
                        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Batal
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}