import { useState } from 'react'
import { changeOwnPassword, createUser, deleteUser } from '../../lib/api.ts'
import type { OperatorUser, Role } from '../../lib/types.ts'
import { SettingsCard } from './SettingsCard'
import type { SettingsCtx } from './shared'

export default function TabPengguna({
  ctx,
  username,
  users,
  reloadUsers,
}: {
  ctx: SettingsCtx
  username: string | null
  users: OperatorUser[]
  reloadUsers: () => Promise<void>
}) {
  const { busy, setBusy, run, setErr, setMsg } = ctx

  const [newUser, setNewUser] = useState('')
  const [newUserPass, setNewUserPass] = useState('')
  const [newUserRole, setNewUserRole] = useState<Role>('KASIR')
  const [userMsg, setUserMsg] = useState<string | null>(null)

  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')

  async function submitUser() {
    const name = newUser.trim()
    if (!name || newUserPass.length < 6) {
      setUserMsg(null)
      setErr('Username wajib diisi dan password minimal 6 karakter')
      return
    }
    setBusy('user')
    setErr(null)
    setUserMsg(null)
    try {
      const created = await createUser(name, newUserPass, newUserRole)
      setUserMsg(`User "${created.username}" dibuat dengan role ${created.role}`)
      setNewUser('')
      setNewUserPass('')
      setNewUserRole('KASIR')
      await reloadUsers()
    } catch (e: unknown) {
      setErr(pesanServer(e))
    } finally {
      setBusy(null)
    }
  }

  async function hapusUser(u: OperatorUser) {
    if (
      !confirm(
        `Hapus user "${u.username}" (${u.role})?\n\n` +
          'User ini tidak bisa login lagi setelah dihapus.',
      )
    )
      return
    setBusy('user')
    setErr(null)
    setUserMsg(null)
    try {
      await deleteUser(u.id)
      setUserMsg(`User "${u.username}" dihapus`)
      await reloadUsers()
    } catch (e: unknown) {
      setErr(pesanServer(e))
    } finally {
      setBusy(null)
    }
  }

  async function submitPassword() {
    await run('password', async () => {
      try {
        setErr(null)
        await changeOwnPassword(oldPass, newPass)
        setOldPass('')
        setNewPass('')
        setMsg('Password berhasil diubah')
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  /** Admin tidak boleh menghapus akunnya sendiri, dan admin terakhir tidak
   *  boleh dihapus karena tidak akan ada yang bisa menambah user lagi.
   *  Backend juga mengecek dua hal ini. */
  const jumlahAdmin = users.filter((u) => u.role === 'ADMIN').length

  function alasanTidakBisaHapus(u: OperatorUser): string | null {
    if (u.username === username) return 'Anda tidak bisa menghapus akun Anda sendiri'
    if (u.role === 'ADMIN' && jumlahAdmin <= 1) {
      return 'Admin terakhir tidak bisa dihapus'
    }
    return null
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SettingsCard title="Tambah User" description="Akun yang bisa login ke dashboard.">
        <input
          type="text"
          placeholder="Username"
          value={newUser}
          onChange={(e) => setNewUser(e.target.value)}
          autoComplete="off"
          className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Password (min. 6 karakter)"
          value={newUserPass}
          onChange={(e) => setNewUserPass(e.target.value)}
          autoComplete="new-password"
          className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(['KASIR', 'ADMIN'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setNewUserRole(r)}
              aria-pressed={newUserRole === r}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                newUserRole === r
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r === 'KASIR' ? 'Kasir' : 'Admin'}
            </button>
          ))}
        </div>
        <p className="mb-3 text-xs text-slate-500">
          {newUserRole === 'ADMIN'
            ? 'Akses penuh: termasuk Pengaturan, data PC, dan tambah user.'
            : 'Operasional harian: PC, voucher, transaksi, dan laporan.'}
        </p>
        <button
          type="button"
          onClick={() => void submitUser()}
          disabled={busy !== null}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy === 'user' ? 'Menyimpan...' : 'Tambah User'}
        </button>
        {userMsg && (
          <p className="mt-2 rounded-md bg-green-50 px-2 py-1.5 text-xs text-green-700">
            {userMsg}
          </p>
        )}

        {users.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3">
            {users.map((u) => {
              const alasan = alasanTidakBisaHapus(u)
              return (
                <li key={u.id} className="flex items-center gap-2 text-xs">
                  <span className="truncate font-medium text-slate-700">{u.username}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${
                      u.role === 'ADMIN'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {u.role}
                  </span>
                  {u.username === username && (
                    <span className="shrink-0 text-slate-400">(anda)</span>
                  )}
                  <button
                    type="button"
                    onClick={() => void hapusUser(u)}
                    disabled={busy !== null || alasan !== null}
                    title={alasan ?? `Hapus user ${u.username}`}
                    aria-label={`Hapus user ${u.username}`}
                    className="ml-auto shrink-0 rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-slate-200 disabled:hover:bg-transparent"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </SettingsCard>

      <SettingsCard title="Ganti Kata Sandi" description="Kata sandi akun yang sedang dipakai.">
        <input
          type="password"
          placeholder="Kata sandi lama"
          value={oldPass}
          onChange={(e) => setOldPass(e.target.value)}
          autoComplete="current-password"
          className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Kata sandi baru"
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
          autoComplete="new-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={submitPassword}
          disabled={busy !== null}
          className="mt-3 w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy === 'password' ? 'Menyimpan...' : 'Ganti Kata Sandi'}
        </button>
      </SettingsCard>
    </div>
  )
}

function pesanServer(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
    (e instanceof Error ? e.message : String(e))
  )
}
