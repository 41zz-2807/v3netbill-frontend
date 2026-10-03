import { useState } from 'react'
import { patchSetting, setPinBypass, setPinUninstall } from '../../lib/api.ts'
import { SettingsCard } from './SettingsCard'
import type { SettingsCtx } from './shared'

export default function TabAgent({
  ctx,
  otpChatIdAwal,
  otpTerisiAwal,
  ncUrlAwal,
  ncUserAwal,
  ncFolderAwal,
  ncPasswordTerisi,
}: {
  ctx: SettingsCtx
  otpChatIdAwal: string
  otpTerisiAwal: boolean
  ncUrlAwal: string
  ncUserAwal: string
  ncFolderAwal: string
  ncPasswordTerisi: boolean
}) {
  const { busy, run, setErr } = ctx
  const [pin, setPin] = useState('')
  const [pinMsg, setPinMsg] = useState<string | null>(null)
  const [pinBypass, setPinBypassValue] = useState('')
  const [pinBypassMsg, setPinBypassMsg] = useState<string | null>(null)
  const [otpToken, setOtpToken] = useState('')
  const [otpChatId, setOtpChatId] = useState(otpChatIdAwal)
  const [otpTerisi, setOtpTerisi] = useState(otpTerisiAwal)
  const [otpMsg, setOtpMsg] = useState<string | null>(null)

  // ⚠️ Password Nextcloud TIDAK pernah dimuat ke form. Field ini tampil kosong
  // dengan placeholder "sudah tersimpan", persis seperti Bot Token di bawah.
  // Kalau password ikut dimuat, ia masuk ke DOM dan bisa dibaca skrip di
  // browser — dan `GET /api/settings` memang mengembalikannya apa adanya.
  const [ncUrl, setNcUrl] = useState(ncUrlAwal)
  const [ncUser, setNcUser] = useState(ncUserAwal)
  const [ncPassword, setNcPassword] = useState('')
  const [ncFolder, setNcFolder] = useState(ncFolderAwal)
  const [ncTerisi, setNcTerisi] = useState(ncPasswordTerisi)
  const [ncMsg, setNcMsg] = useState<string | null>(null)

  async function submitPin() {
    await run('pin', async () => {
      try {
        setErr(null)
        await setPinUninstall(pin)
        setPinMsg('PIN uninstall tersimpan')
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function submitPinBypass() {
    await run('pinBypass', async () => {
      try {
        setErr(null)
        const hasil = await setPinBypass(pinBypass)
        setPinBypassValue('')
        if (hasil.kosong) {
          setPinBypassMsg(
            `PIN bypass dihapus. ${hasil.terkirim} PC diberi tahu, dan kembali ke PIN emergency 123456.`,
          )
        } else {
          setPinBypassMsg(
            `PIN bypass tersimpan, dikirim ke ${hasil.terkirim} PC yang tersambung. ` +
              'PC yang sedang offline menerimanya saat connect lagi.',
          )
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  /** Kosongkan PIN di server, bukan cuma di form. */
  async function hapusPinBypass() {
    if (
      !window.confirm(
        'PIN bypass dihapus dari server? Semua PC akan kembali memakai PIN emergency 123456.',
      )
    ) {
      return
    }
    setPinBypassValue('')
    await run('pinBypass', async () => {
      try {
        setErr(null)
        const hasil = await setPinBypass('')
        setPinBypassMsg(
          `PIN bypass dihapus. ${hasil.terkirim} PC diberi tahu, dan kembali ke PIN emergency 123456.`,
        )
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  /**
   * Simpan konfigurasi OTP Telegram. Kosongkan token untuk mematikan fitur —
   * agent akan kembali memakai PIN emergency bawaan (rollback).
   */
  /**
   * Simpan konfigurasi Nextcloud lalu kirim ke agent yang sedang terhubung.
   *
   * Password DIKOSONGKAN tidak berarti dihapus. Kalau dihapus, admins tidak
   * bisa menyimpan username/folder tanpa mengetik ulang password yang
   * memang tidak pernah ditampilkan lagi. Jadi: password terkirim hanya kalau
   * diketik. Tombol "Matikan" yang benar-benar mengosongkan semuanya.
   */
  async function saveNextcloud(matikan: boolean) {
    await run('nc', async () => {
      try {
        setErr(null)
        if (matikan) {
          await patchSetting('nextcloud_url', '')
          await patchSetting('nextcloud_user', '')
          await patchSetting('nextcloud_password', '')
          await patchSetting('nextcloud_folder', '')
          setNcUrl('')
          setNcUser('')
          setNcPassword('')
          setNcFolder('log-pc-warnet')
          setNcTerisi(false)
          setNcMsg('Upload log ke Nextcloud dimatikan di semua PC.')
          return
        }

        await patchSetting('nextcloud_url', ncUrl.trim())
        await patchSetting('nextcloud_user', ncUser.trim())
        await patchSetting('nextcloud_folder', ncFolder.trim() || 'log-pc-warnet')
        if (ncPassword.trim()) {
          await patchSetting('nextcloud_password', ncPassword.trim())
          setNcPassword('')
        }
        setNcTerisi(true)
        setNcMsg(
          ncPassword.trim()
            ? 'Tersimpan. Log dikirim tiap 5 menit, dan langsung dicoba sekarang juga.'
            : 'Tersimpan. Password tidak diubah karena field dikosongkan.',
        )
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function saveOtp(matikan: boolean) {
    await run('otp', async () => {
      try {
        setErr(null)
        await patchSetting('agent_otp_chat_id', matikan ? '' : otpChatId.trim())
        await patchSetting('agent_otp_bot_token', matikan ? '' : otpToken.trim())
        setOtpToken('')
        setOtpTerisi(!matikan)
        setOtpMsg(
          matikan
            ? 'OTP dimatikan. Agent kembali ke PIN emergency bawaan (123456).'
            : 'OTP aktif. Config dikirim ke agent yang sedang terhubung.',
        )
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SettingsCard
        title="PIN Uninstall"
        description="Diminta saat skrip uninstall atau dialog uninstall dijalankan. Dicek ke server, bukan lokal."
      >
        <input
          type="password"
          placeholder="PIN (contoh: 2468)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoComplete="off"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={submitPin}
          disabled={busy !== null}
          className="mt-2 self-start rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
        >
          {busy === 'pin' ? 'Menyimpan...' : 'Simpan PIN'}
        </button>
        {pinMsg && <div className="mt-2 text-sm text-green-700">{pinMsg}</div>}
      </SettingsCard>

      <SettingsCard
        title="PIN Bypass / Maintenance"
        description="PIN untuk mematikan agent dari layar login client. Dipakai saat server mati atau perlu maintenance. Disimpan sebagai hash lalu didorong ke PC, jadi tetap bisa dipakai tanpa server. Kosongkan untuk kembali ke PIN emergency bawaan 123456."
      >
        <input
          type="password"
          placeholder="PIN bypass (contoh: 9753)"
          value={pinBypass}
          onChange={(e) => setPinBypassValue(e.target.value)}
          autoComplete="off"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submitPinBypass}
            disabled={busy !== null}
            className="rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 disabled:opacity-50"
          >
            {busy === 'pinBypass' ? 'Menyimpan...' : 'Simpan PIN Bypass'}
          </button>
          <button
            type="button"
            onClick={hapusPinBypass}
            disabled={busy !== null}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            title="Kosongkan PIN di server supaya PC kembali ke PIN emergency bawaan"
          >
            Hapus PIN Bypass
          </button>
        </div>
        {pinBypassMsg && <div className="mt-2 text-sm text-green-700">{pinBypassMsg}</div>}
      </SettingsCard>

        <SettingsCard
          title="Log ke Nextcloud"
          description="Agent mengirim log agent + overlay tiap 5 menit, supaya kasir tidak perlu Remote Desktop ke PC klien."
        >
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">URL Nextcloud</span>
            <input
              value={ncUrl}
              onChange={(e) => setNcUrl(e.target.value)}
              placeholder="https://cloud.example.id"
              autoComplete="off"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="mt-2 block">
            <span className="mb-1 block text-sm text-slate-600">Username</span>
            <input
              value={ncUser}
              onChange={(e) => setNcUser(e.target.value)}
              placeholder="akun khusus log, bukan akun admin"
              autoComplete="off"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="mt-2 block">
            <span className="mb-1 block text-sm text-slate-600">Password</span>
            <input
              type="password"
              value={ncPassword}
              onChange={(e) => setNcPassword(e.target.value)}
              placeholder={
                ncTerisi ? 'Sudah tersimpan — isi lagi untuk mengganti' : 'Kosongkan untuk tidak memakai'
              }
              autoComplete="off"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="mt-2 block">
            <span className="mb-1 block text-sm text-slate-600">Folder</span>
            <input
              value={ncFolder}
              onChange={(e) => setNcFolder(e.target.value)}
              placeholder="log-pc-warnet"
              autoComplete="off"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveNextcloud(false)}
              disabled={busy !== null || !ncUrl.trim() || !ncUser.trim()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {busy === 'nc' ? 'Menyimpan...' : 'Simpan & Kirim'}
            </button>
            {ncTerisi && (
              <button
                type="button"
                onClick={() => void saveNextcloud(true)}
                disabled={busy !== null}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                Matikan
              </button>
            )}
          </div>

          {ncMsg && <div className="mt-2 text-sm text-green-700">{ncMsg}</div>}

          <p className="mt-3 text-xs text-slate-500">
            Diubah sekali di sini, berlaku ke semua PC tanpa pasang ulang. Password tidak pernah
            ditampilkan lagi setelah disimpan. Disarankan memakai akun Nextcloud khusus untuk log,
            bukan akun admin.
          </p>
        </SettingsCard>

      <SettingsCard
        title="OTP Telegram"
        description="Untuk membuka layar lock saat mode maintenance. Kode dikirim ke Telegram, berlaku 5 menit, dan hanya bisa dipakai sekali."
      >
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Bot Token</span>
          <input
            type="password"
            value={otpToken}
            onChange={(e) => setOtpToken(e.target.value)}
            placeholder={
              otpTerisi ? 'Sudah tersimpan — isi lagi untuk mengganti' : '123456789:AA...'
            }
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-2 block">
          <span className="mb-1 block text-sm text-slate-600">Chat ID</span>
          <input
            value={otpChatId}
            onChange={(e) => setOtpChatId(e.target.value)}
            placeholder="Contoh: 123456789"
            inputMode="numeric"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveOtp(false)}
            disabled={busy !== null || !otpToken.trim() || !otpChatId.trim()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === 'otp' ? 'Menyimpan...' : 'Simpan & Kirim'}
          </button>
          {otpTerisi && (
            <button
              type="button"
              onClick={() => void saveOtp(true)}
              disabled={busy !== null}
              className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              Matikan
            </button>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {otpTerisi
            ? 'Status: aktif. Config tersimpan di tiap PC, jadi OTP tetap terkirim walau server mati.'
            : 'Status: tidak aktif. Agent memakai PIN emergency bawaan (123456).'}
        </p>
        {otpMsg && <div className="mt-2 text-sm text-green-700">{otpMsg}</div>}
      </SettingsCard>
    </div>
  )
}
