import { useEffect, useRef, useState } from 'react'
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

  async function load() {
    try {
      setLoading(true)
      setAccounts(await fetchAccounts(tab))
      setError(null)
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

  function bukaModal(jenis: 'VOUCHER' | 'MEMBER') {
    setError(null)
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
    setModal(null)
    setCreatedVoucher(null)
    setTab(next)
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

  async function handleTopup(id: string) {
    const nominalTopup = prompt('Nominal topup (kelipatan 500):', '2000')
    if (!nominalTopup) return
    try {
      await topup(id, Number(nominalTopup))
      await load()
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  async function handleKoreksi(id: string, sisaDetik: number) {
    const nominalKoreksi = prompt(
      'Nominal yang ditarik (kelipatan 500):\n\n' +
        `Sisa waktu saat ini: ${formatDuration(sisaDetik)}`,
      '500',
    )
    if (!nominalKoreksi) return
    try {
      await koreksi(id, Number(nominalKoreksi))
      await load()
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  async function handleChangePassword(id: string) {
    const pw = prompt('Password baru:')
    if (!pw) return
    try {
      await changePassword(id, pw)
      await load()
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Nonaktifkan akun ini?')) return
    try {
      await revokeAccount(id)
      await load()
    } catch (err: unknown) {
      setError((err as Error).message)
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cari ${tab === 'VOUCHER' ? 'kode unik' : 'nama member'} atau status...`}
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Bersihkan
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
                <th className="px-4 py-2">{tab === 'VOUCHER' ? 'Kode Unik' : 'Nama'}</th>
                <th className="px-4 py-2">Sisa Waktu</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Dibuat</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
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
                  <td className="px-4 py-2 text-right">
                    <DropdownMenu
                      items={[
                        { label: 'Topup', onClick: () => void handleTopup(a.id) },
                        { label: 'Tarik', onClick: () => void handleKoreksi(a.id, a.sisaWaktuDetik) },
                        { label: 'Password', onClick: () => void handleChangePassword(a.id) },
                        ...(a.status === 'ACTIVE'
                          ? [{ label: 'Nonaktifkan', onClick: () => void handleRevoke(a.id), danger: true as const }]
                          : []),
                      ]}
                    />
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

function DropdownMenu({
  items,
  triggerLabel = 'Aksi',
  disabled = false,
}: {
  items: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean; shortcut?: string; icon?: React.ReactNode }>
  triggerLabel?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const toggle = () => {
    if (!disabled) setOpen(!open)
  }

  return (
    <div className="hs-dropdown relative inline-block" ref={ref}>
      <button
        type="button"
        id="hs-dropdown-custom-trigger"
        className="hs-dropdown-toggle py-1.5 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-full border bg-white border-neutral-300 text-neutral-700 shadow-sm hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Dropdown"
        onClick={toggle}
        disabled={disabled}
      >
        <span className="font-medium truncate max-w-30">{triggerLabel}</span>
        <svg
          className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        className={`hs-dropdown-menu absolute right-0 top-full z-50 transition-[opacity,margin] duration-200 ease-out min-w-56 bg-white border border-neutral-200 rounded-lg shadow-md mt-1 ${
          open ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="hs-dropdown-custom-trigger"
      >
        <div className="p-0.5 space-y-0.5">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={item.disabled || disabled}
              onClick={() => {
                if (!item.disabled && !disabled) {
                  item.onClick()
                  setOpen(false)
                }
              }}
              className={`
                flex items-center gap-x-2 py-1.5 px-3 rounded-lg text-sm w-full
                ${item.disabled || disabled
                  ? 'opacity-50 cursor-not-allowed pointer-events-none text-neutral-400'
                  : item.danger
                  ? 'text-red-600 hover:bg-red-50 focus:bg-red-50'
                  : 'text-neutral-700 hover:bg-neutral-100 focus:bg-neutral-100'
                }
                focus:outline-none
              `}
            >
              {item.icon && <span className="flex-shrink-0 w-4 h-4">{item.icon}</span>}
              {item.label}
              {item.shortcut && (
                <span className="ml-auto text-xs text-neutral-400 font-mono">{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
