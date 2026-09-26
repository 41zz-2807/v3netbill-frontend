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
  formatRupiah,
} from '../lib/api.ts'
import type { Account } from '../lib/types.ts'
import Loader from '../components/Loader.tsx'

const NOMINALS = [1500, 2000, 3000, 5000, 10000]

export default function AccountsPage() {
  const [tab, setTab] = useState<'VOUCHER' | 'MEMBER'>('VOUCHER')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nominal, setNominal] = useState(2000)
  const [nominalInput, setNominalInput] = useState('')
  const [memberNama, setMemberNama] = useState('')
  const [memberPassword, setMemberPassword] = useState('')
  const [memberNominal, setMemberNominal] = useState(2000)
  const [memberNominalInput, setMemberNominalInput] = useState('')
  const [createdVoucher, setCreatedVoucher] = useState<
    (Account & { password: string }) | null
  >(null)
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

  async function handleCreateVoucher(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await createVoucher(nominal)
      setCreatedVoucher(created)
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
    setBusy(true)
    setError(null)
    try {
      await createMember(memberNama, memberPassword, memberNominal)
      setMemberNama('')
      setMemberPassword('')
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

      <div className="mb-6 flex gap-2">
        <TabButton active={tab === 'VOUCHER'} onClick={() => setTab('VOUCHER')}>
          Voucher
        </TabButton>
        <TabButton active={tab === 'MEMBER'} onClick={() => setTab('MEMBER')}>
          Member
        </TabButton>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {tab === 'VOUCHER' && (
        <form
          onSubmit={handleCreateVoucher}
          className="mb-6 rounded-lg border border-slate-200 bg-white p-4"
        >
          <h2 className="mb-3 font-semibold text-slate-800">Buat Voucher Baru</h2>
          <div className="mb-3 flex flex-wrap gap-2 items-center">
            <select
              value={nominal}
              onChange={(e) => setNominal(Number(e.target.value))}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            >
              {NOMINALS.map((n) => (
                <option key={n} value={n}>
                  {formatRupiah(n)}
                </option>
              ))}
            </select>
            <span className="text-slate-400">atau</span>
            <input
              type="number"
              step="500"
              min="500"
              value={nominalInput}
              onChange={(e) => setNominalInput(e.target.value)}
              onBlur={() => {
                const val = Number(nominalInput)
                if (!isNaN(val) && val >= 500) setNominal(val)
              }}
              placeholder="Custom (kelipatan 500)"
              className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? 'Membuat...' : 'Buat Voucher'}
          </button>

          {createdVoucher && (
            <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm">
              <div className="font-semibold text-orange-800">Voucher dibuat:</div>
              <div className="mt-1">
                Kode unik: <code className="font-bold">{createdVoucher.kodeUnik}</code>
              </div>
              <div>
                Password: <code className="font-bold">{createdVoucher.password}</code>
              </div>
              <div className="text-xs text-orange-700">
                {formatFourDigit(createdVoucher.kodeUnik)} — {formatDuration(createdVoucher.sisaWaktuDetik)}
              </div>
            </div>
          )}
        </form>
      )}

      {tab === 'MEMBER' && (
        <form
          onSubmit={handleCreateMember}
          className="mb-6 rounded-lg border border-slate-200 bg-white p-4"
        >
          <h2 className="mb-3 font-semibold text-slate-800">Buat Member Baru</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={memberNama}
              onChange={(e) => setMemberNama(e.target.value)}
              placeholder="Nama member"
              required
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
            <input
              type="text"
              value={memberPassword}
              onChange={(e) => setMemberPassword(e.target.value)}
              placeholder="Password"
              required
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={memberNominal}
                onChange={(e) => setMemberNominal(Number(e.target.value))}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
              >
                {NOMINALS.map((n) => (
                  <option key={n} value={n}>
                    {formatRupiah(n)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="500"
                min="500"
                value={memberNominalInput}
                onChange={(e) => setMemberNominalInput(e.target.value)}
                onBlur={() => {
                  const val = Number(memberNominalInput)
                  if (!isNaN(val) && val >= 500) setMemberNominal(val)
                }}
                placeholder="Custom (kelipatan 500)"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {busy ? 'Membuat...' : 'Buat'}
            </button>
          </div>
        </form>
      )}

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

function formatFourDigit(s: string | null): string {
  return s ?? '—'
}