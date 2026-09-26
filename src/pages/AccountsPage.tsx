import { useEffect, useMemo, useState } from 'react'
import {
  fetchAccounts,
  createVoucher,
  createMember,
  topup,
  koreksi,
  changePassword,
  revokeAccount,
  formatDuration,
} from '../lib/api.ts'
import type { Account } from '../lib/types.ts'
import Loader from '../components/Loader.tsx'
import { GradientCard } from '../components/ui/GradientCard.tsx'
import { Modal } from '../components/ui/Modal.tsx'
import { Pagination } from '../components/ui/Pagination.tsx'
import {
  PER_HALAMAN,
  usePagination,
  urutkanTerbaru,
} from '../hooks/usePagination.ts'
import { inputClass, buttonClass } from '../components/ui/gradientCardStyles.ts'

export default function AccountsPage() {
  const [tab, setTab] = useState<'VOUCHER' | 'MEMBER'>('VOUCHER')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nominalInput, setNominalInput] = useState('')
  const [memberNama, setMemberNama] = useState('')
  const [memberPassword, setMemberPassword] = useState('')
  const [memberNominalInput, setMemberNominalInput] = useState('')
  const [createdVoucher, setCreatedVoucher] = useState<
    (Account & { password: string }) | null
  >(null)
  const [modal, setModal] = useState<'VOUCHER' | 'MEMBER' | null>(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set())
  const [sukses, setSukses] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      const hasil = await fetchAccounts(tab)
      setAccounts(hasil)
      setError(null)
      // Buang id terpilih yang sudah tidak ada di list (mis. akun dihapus).
      const ada = new Set(hasil.map((a) => a.id))
      setTerpilih((prev) => {
        const next = new Set([...prev].filter((id) => ada.has(id)))
        return next.size === prev.size ? prev : next
      })
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [tab])

  const filtered = search.trim()
    ? accounts.filter((a) => {
        const q = search.trim().toLowerCase()
        return (
          (a.kodeUnik ?? a.nama ?? '').toLowerCase().includes(q) ||
          (a.nama ?? '').toLowerCase().includes(q) ||
          a.status.toLowerCase().includes(q)
        )
      })
    : accounts

  const terurut = useMemo(
    () => urutkanTerbaru(filtered, (a) => a.createdAt),
    [filtered],
  )
  const {
    data: baris,
    halaman,
    totalHalaman,
    total,
    setHalaman,
    reset: resetHalaman,
  } = usePagination(terurut)

  function bukaModal(jenis: 'VOUCHER' | 'MEMBER') {
    setError(null)
    setSukses(null)
    setCreatedVoucher(null)
    setModal(jenis)
  }

  function tutupModal() {
    if (busy) return
    setModal(null)
    setCreatedVoucher(null)
    setError(null)
  }

  function gantiTab(next: 'VOUCHER' | 'MEMBER') {
    resetHalaman()
    setModal(null)
    setCreatedVoucher(null)
    setTerpilih(new Set())
    setSukses(null)
    setTab(next)
  }

  function ubahSearch(next: string) {
    resetHalaman()
    setSearch(next)
    // Hide baris terpilih saat filter berubah, supaya aksi tidak pernah
    // dijalankan pada baris yang tidak kelihatan.
    setTerpilih(new Set())
  }

  function togglePilih(id: string) {
    setTerpilih((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const semuaTerpilih = baris.length > 0 && baris.every((a) => terpilih.has(a.id))

  /** Hanya baris di halaman aktif yang Affected — memilih semua dari 34
   *  halaman lalu kena aksi bulk adalah cara mudah salah pilih. */
  function toggleSemua() {
    setTerpilih((prev) => {
      const next = new Set(prev)
      if (baris.every((a) => next.has(a.id))) baris.forEach((a) => next.delete(a.id))
      else baris.forEach((a) => next.add(a.id))
      return next
    })
  }

  const terpilihList = accounts.filter((a) => terpilih.has(a.id))

  /** Jalankan aksi pada semua akun terpilih. Kegagalan parsial tetap
   *  dilaporkan per-akun supaya kasir tahu mana yang belum jadi. */
  async function jalankanBulk(
    label: string,
    aksi: (a: Account) => Promise<unknown>,
  ) {
    const target = terpilihList
    if (target.length === 0) return
    setBusy(true)
    setError(null)
    setSukses(null)
    const gagal: string[] = []
    let sukses = 0
    for (const a of target) {
      try {
        await aksi(a)
        sukses++
      } catch (err: unknown) {
        gagal.push(`${a.kodeUnik ?? a.nama ?? a.id} (${(err as Error).message})`)
      }
    }
    if (gagal.length === 0) {
      setSukses(`${label} berhasil untuk ${sukses} akun.`)
    } else {
      setError(
        `${label}: ${sukses} dari ${target.length} berhasil. Gagal — ${gagal.join('; ')}`,
      )
    }
    setTerpilih(new Set())
    await load()
    setBusy(false)
  }

  async function bulkTopup() {
    const nominal = prompt('Nominal topup (kelipatan 500):', '2000')
    if (!nominal) return
    await jalankanBulk('Topup', (a) => topup(a.id, Number(nominal)))
  }

  async function bulkKoreksi() {
    const nominal = prompt('Nominal yang ditarik (kelipatan 500):', '500')
    if (!nominal) return
    await jalankanBulk('Penarikan', (a) => koreksi(a.id, Number(nominal)))
  }

  async function bulkPassword() {
    if (terpilihList.length !== 1) return
    const pw = prompt('Password baru:')
    if (!pw) return
    await jalankanBulk('Ubah password', (a) => changePassword(a.id, pw))
  }

  async function bulkRevoke() {
    const n = terpilihList.length
    if (n === 0) return
    if (!confirm(`Nonaktifkan ${n} akun terpilih?`)) return
    await jalankanBulk('Nonaktifkan', (a) => revokeAccount(a.id))
  }

  /** Backend hanya menolak nominal yang bukan kelipatan 500 (0 lolos), jadi
   *  minimum 500 dicek di sini agar nominal nol tidak pernah terkirim. */
  function bacaNominal(input: string): number | null {
    const nilai = Number(input)
    if (input.trim() === '' || Number.isNaN(nilai) || nilai < 500 || nilai % 500 !== 0) {
      return null
    }
    return nilai
  }

  async function handleCreateVoucher(e: React.FormEvent) {
    e.preventDefault()
    const nilai = bacaNominal(nominalInput)
    if (nilai === null) {
      setError('Nominal harus kelipatan 500 dan minimal 500')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await createVoucher(nilai)
      setCreatedVoucher(created)
      setNominalInput('')
      await load()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'Gagal membuat voucher',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault()
    const nilai = bacaNominal(memberNominalInput)
    if (nilai === null) {
      setError('Nominal harus kelipatan 500 dan minimal 500')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createMember(memberNama, memberPassword, nilai)
      setMemberNama('')
      setMemberPassword('')
      setMemberNominalInput('')
      setModal(null)
      await load()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'Gagal membuat member',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Voucher & Member</h1>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <TabButton active={tab === 'VOUCHER'} onClick={() => gantiTab('VOUCHER')}>
            Voucher
          </TabButton>
          <TabButton active={tab === 'MEMBER'} onClick={() => gantiTab('MEMBER')}>
            Member
          </TabButton>
        </div>
        <button
          type="button"
          onClick={() => bukaModal(tab)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          + Buat {tab === 'VOUCHER' ? 'Voucher' : 'Member'}
        </button>
      </div>

      {error && !modal && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {sukses && !modal && (
        <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{sukses}</div>
      )}

      <Modal
        open={modal !== null}
        onClose={tutupModal}
        locked={busy}
        label={modal === 'MEMBER' ? 'Buat Member Baru' : 'Buat Voucher Baru'}
      >
        {modal === 'VOUCHER' && (
          <form onSubmit={handleCreateVoucher}>
            <GradientCard
              label="VOUCHER"
              title={createdVoucher ? 'Voucher berhasil dibuat' : 'Buat Voucher Baru'}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M10.277 16.515c.005-.11.187-.154.24-.058c.254.45.686 1.111 1.177 1.412c.49.3 1.275.386 1.791.408c.11.005.154.186.058.24c-.45.254-1.111.686-1.412 1.176s-.386 1.276-.408 1.792c-.005.11-.187.153-.24.057c-.254-.45-.686-1.11-1.176-1.411s-1.276-.386-1.792-.408c-.11-.005-.153-.187-.057-.24c.45-.254 1.11-.686 1.411-1.177c.301-.49.386-1.276.408-1.791m8.215-1c-.008-.11-.2-.156-.257-.062c-.172.283-.421.623-.697.793s-.693.236-1.023.262c-.11.008-.155.2-.062.257c.283.172.624.42.793.697s.237.693.262 1.023c.009.11.2.155.258.061c.172-.282.42-.623.697-.792s.692-.237 1.022-.262c.11-.009.156-.2.062-.258c-.283-.172-.624-.42-.793-.697s-.236-.692-.262-1.022M14.704 4.002l-.242-.306c-.937-1.183-1.405-1.775-1.95-1.688c-.545.088-.806.796-1.327 2.213l-.134.366c-.149.403-.223.604-.364.752c-.143.148-.336.225-.724.38l-.353.141l-.248.1c-1.2.48-1.804.753-1.881 1.283c-.082.565.49 1.049 1.634 2.016l.296.25c.325.275.488.413.58.6c.094.187.107.403.134.835l.024.393c.093 1.52.14 2.28.634 2.542s1.108-.147 2.336-.966l.318-.212c.35-.233.524-.35.723-.381c.2-.032.402.024.806.136l.368.102c1.422.394 2.133.591 2.52.188c.388-.403.196-1.14-.19-2.613l-.099-.381c-.11-.419-.164-.628-.134-.835s.142-.389.365-.752l.203-.33c.786-1.276 1.179-1.914.924-2.426c-.254-.51-.987-.557-2.454-.648l-.379-.024c-.417-.026-.625-.039-.806-.135c-.18-.096-.314-.264-.58-.6m-5.869 9.324C6.698 14.37 4.919 16.024 4.248 18c-.752-4.707.292-7.747 1.965-9.637c.144.295.332.539.5.73c.35.396.852.82 1.362 1.251l.367.31l.17.145c.005.064.01.14.015.237l.03.485c.04.655.08 1.294.178 1.805"
                  />
                </svg>
              }
            >
              {createdVoucher ? (
                <>
                  <div>
                    <p className="text-neutral-500">Kode unik</p>
                    <p className="font-mono text-3xl font-bold tracking-[0.3em] text-white">
                      {createdVoucher.kodeUnik}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Password</p>
                    <p className="font-mono text-3xl font-bold tracking-[0.3em] text-white">
                      {createdVoucher.password}
                    </p>
                  </div>
                  <p className="text-neutral-500">
                    Sisa waktu {formatDuration(createdVoucher.sisaWaktuDetik)}. Catat kode &amp;
                    password di atas sebelum menutup.
                  </p>
                  <button type="button" onClick={tutupModal} className={buttonClass}>
                    Selesai
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-neutral-500">
                      Nominal (kelipatan 500)
                    </label>
                    <input
                      type="number"
                      step="500"
                      min="500"
                      required
                      autoFocus
                      value={nominalInput}
                      onChange={(e) => setNominalInput(e.target.value)}
                      placeholder="Contoh: 2000"
                      className={inputClass}
                    />
                  </div>
                  {error && (
                    <p className="rounded-md bg-red-500/15 px-2.5 py-2 text-xs text-red-300">
                      {error}
                    </p>
                  )}
                  <p className="text-neutral-500">
                    Sisa waktu dihitung otomatis dari tarif per menit yang berlaku.
                  </p>
                  <button type="submit" disabled={busy} className={buttonClass}>
                    {busy ? 'Membuat...' : 'Buat Voucher'}
                  </button>
                </>
              )}
            </GradientCard>
          </form>
        )}

        {modal === 'MEMBER' && (
          <form onSubmit={handleCreateMember}>
            <GradientCard
              label="MEMBER"
              title="Buat Member Baru"
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
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
            >
              <div>
                <label className="mb-1.5 block text-neutral-500">Nama member</label>
                <input
                  type="text"
                  value={memberNama}
                  onChange={(e) => setMemberNama(e.target.value)}
                  placeholder="Nama lengkap"
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-neutral-500">Password</label>
                <input
                  type="text"
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                  placeholder="Password member"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-neutral-500">
                  Nominal (kelipatan 500)
                </label>
                <input
                  type="number"
                  step="500"
                  min="500"
                  required
                  value={memberNominalInput}
                  onChange={(e) => setMemberNominalInput(e.target.value)}
                  placeholder="Contoh: 2000"
                  className={inputClass}
                />
              </div>
              {error && (
                <p className="rounded-md bg-red-500/15 px-2.5 py-2 text-xs text-red-300">{error}</p>
              )}
              <button type="submit" disabled={busy} className={buttonClass}>
                {busy ? 'Membuat...' : 'Buat Member'}
              </button>
            </GradientCard>
          </form>
        )}
      </Modal>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => ubahSearch(e.target.value)}
            placeholder={`Cari ${tab === 'VOUCHER' ? 'kode unik' : 'nama member'} atau status...`}
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </div>
        {search && (
          <button
            onClick={() => ubahSearch('')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Bersihkan
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
        <span className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{terpilihList.length}</span> dipilih
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void bulkTopup()}
            disabled={busy || terpilihList.length === 0}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Topup
          </button>
          <button
            type="button"
            onClick={() => void bulkKoreksi()}
            disabled={busy || terpilihList.length === 0}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Tarik
          </button>
          <button
            type="button"
            onClick={() => void bulkPassword()}
            disabled={busy || terpilihList.length !== 1}
            title={
              terpilihList.length === 1
                ? 'Ubah password akun terpilih'
                : 'Pilih tepat satu akun untuk ubah password'
            }
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => void bulkRevoke()}
            disabled={busy || terpilihList.length === 0}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Nonaktifkan
          </button>
        </div>
        {terpilihList.length > 0 && (
          <button
            type="button"
            onClick={() => setTerpilih(new Set())}
            disabled={busy}
            className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Batal pilih
          </button>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-4"><Loader text="Memuat akun" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">
            {search ? `Tidak ada ${tab.toLowerCase()} yang cocok dengan "${search}".` : `Belum ada akun ${tab.toLowerCase()}.`}
          </div>
        ) : (
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="w-10 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={semuaTerpilih}
                    onChange={toggleSemua}
                    aria-label="Pilih semua"
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                </th>
                <th className="px-4 py-2">{tab === 'VOUCHER' ? 'Kode Unik' : 'Nama'}</th>
                <th className="px-4 py-2">Sisa Waktu</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {baris.map((a) => (
                <tr
                  key={a.id}
                  className={`hover:bg-slate-50 ${terpilih.has(a.id) ? 'bg-slate-100' : ''}`}
                >
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={terpilih.has(a.id)}
                      onChange={() => togglePilih(a.id)}
                      aria-label={`Pilih ${a.kodeUnik ?? a.nama}`}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {a.kodeUnik ?? a.nama}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-slate-600">
                    {formatDuration(a.sisaWaktuDetik)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(a.createdAt).toLocaleDateString('id-ID')}
                  </td>
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-medium ${
        active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-sm'
      }`}
    >
      {children}
    </button>
  )
}
