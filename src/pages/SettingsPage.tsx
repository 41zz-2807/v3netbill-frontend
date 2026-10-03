import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.tsx'
import { fetchSettings, fetchBackupList, fetchUsers, parseMeta } from '../lib/api.ts'
import type { BackupFile, BackupResult, InstallerMeta, OperatorUser } from '../lib/types.ts'
import ProgressBar from '../components/ui/ProgressBar.tsx'
import TabTarif from './settings/TabTarif.tsx'
import TabAgent from './settings/TabAgent.tsx'
import TabInstalasi from './settings/TabInstalasi.tsx'
import TabPengguna from './settings/TabPengguna.tsx'
import TabData from './settings/TabData.tsx'
import TabLogBilling from './settings/TabLogBilling.tsx'
import TabDiagnosa from './settings/TabDiagnosa.tsx'
import TabNav, { type TabNavItem } from './settings/TabNav.tsx'
import { BUSY_TEXT, type SettingsCtx } from './settings/shared.ts'

type TabId = 'tarif' | 'agent' | 'instalasi' | 'pengguna' | 'data' | 'log' | 'diagnosa'

const TABS: TabNavItem[] & { id: TabId }[] = [
  { id: 'tarif', label: 'Tarif', hint: 'Harga per menit & grace period' },
  { id: 'agent', label: 'Agent & Keamanan', hint: 'PIN uninstall, bypass, OTP' },
  { id: 'instalasi', label: 'Instalasi', hint: 'MSI, APK, wallpaper' },
  { id: 'pengguna', label: 'Pengguna', hint: 'Tambah operator, ganti sandi' },
  { id: 'data', label: 'Data', hint: 'Backup database' },
  { id: 'log', label: 'Log Billing', hint: 'Aktivitas billing harian' },
  { id: 'diagnosa', label: 'Diagnosa Agent', hint: 'Log yang dikirim agent' },
]

export default function SettingsPage() {
  const { role, username } = useAuth()
  const [tab, setTab] = useState<TabId>('tarif')

  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [harga, setHarga] = useState('')
  const [grace, setGrace] = useState('')
  const [otpChatId, setOtpChatId] = useState('')
  const [otpTerisi, setOtpTerisi] = useState(false)
  const [ncUrl, setNcUrl] = useState('')
  const [ncUser, setNcUser] = useState('')
  const [ncFolder, setNcFolder] = useState('log-pc-warnet')
  const [ncPasswordTerisi, setNcPasswordTerisi] = useState(false)
  const [installed, setInstalled] = useState<InstallerMeta | null>(null)
  const [apk, setApk] = useState<InstallerMeta | null>(null)
  const [wallFname, setWallFname] = useState<string | null>(null)
  const [users, setUsers] = useState<OperatorUser[]>([])
  const [backupInfo, setBackupInfo] = useState<BackupResult | null>(null)
  const [backups, setBackups] = useState<BackupFile[]>([])

  const loadSettings = useCallback(async () => {
    try {
      setErr(null)
      const s = await fetchSettings()
      setHarga(s.harga_per_menit ?? '')
      setGrace(s.grace_period_detik ?? '')
      setOtpChatId(s.agent_otp_chat_id ?? '')
        setOtpTerisi(Boolean(s.agent_otp_bot_token))
        // ⚠️ nextcloud_password sengaja TIDAK dimuat ke mana pun di frontend.
        // Yang masuk ke form cuma "sudah tersimpan atau belum". Nilai aslinya
        // tetap ada di `s` karena `fetchSettings()` mengambil seluruh Setting,
        // tapi tidak pernah ditulis ke state maupun ke DOM.
        setNcUrl(s.nextcloud_url ?? '')
        setNcUser(s.nextcloud_user ?? '')
        setNcFolder(s.nextcloud_folder || 'log-pc-warnet')
        setNcPasswordTerisi(Boolean(s.nextcloud_password))
      setInstalled(parseMeta<InstallerMeta>(s.installer_meta))
      setApk(parseMeta<InstallerMeta>(s.apk_meta))
      setWallFname(s.wallpaper_lockscreen_path ?? null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await fetchUsers())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const loadBackups = useCallback(async () => {
    try {
      setBackups(await fetchBackupList())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void loadSettings()
    void loadUsers()
    void loadBackups()
  }, [loadSettings, loadUsers, loadBackups])

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  if (role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6 text-center text-slate-700">
        Hanya ADMIN yang dapat mengakses halaman ini.
      </div>
    )
  }

  const ctx: SettingsCtx = { busy, setBusy, run, setErr, setMsg }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Pengaturan</h1>

      {/* Dahulu proses apa pun menutup layar penuh dengan Loader. Sekarang
          cukup garis tipis di dalam halaman: isinya masih kelihatan dan
          pengguna tidak merasa aplikasinya menggantung. Unduhan punya persen
          sendiri di dalam tombolnya, jadi aksi itu sengaja tidak memakai bar ini. */}
      {busy && !busy.startsWith('download') && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <ProgressBar label={BUSY_TEXT[busy] ?? 'Memproses'} value={null} />
        </div>
      )}

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {msg}
        </div>
      )}

      {/* Sidebar di kiri mulai lg (1024px). Di bawah itu TabNav menjadi
          pem-trigger yang menutup sendiri — lihat TabNav untuk alasannya. */}
      <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <nav aria-label="Bagian pengaturan">
          <TabNav items={TABS} active={tab} onChange={(id) => setTab(id as TabId)} />
        </nav>

        <div className="mt-4 min-w-0 lg:mt-0">

      {tab === 'tarif' && (
        <TabTarif
          ctx={ctx}
          harga={harga}
          grace={grace}
          setHarga={setHarga}
          setGrace={setGrace}
        />
      )}
      {tab === 'agent' && (
        <TabAgent
          ctx={ctx}
          otpChatIdAwal={otpChatId}
          otpTerisiAwal={otpTerisi}
          ncUrlAwal={ncUrl}
          ncUserAwal={ncUser}
          ncFolderAwal={ncFolder}
          ncPasswordTerisi={ncPasswordTerisi}
        />
      )}
      {tab === 'instalasi' && (
        <TabInstalasi
          ctx={ctx}
          installed={installed}
          apk={apk}
          wallFname={wallFname}
          reload={loadSettings}
        />
      )}
      {tab === 'pengguna' && (
        <TabPengguna ctx={ctx} username={username} users={users} reloadUsers={loadUsers} />
      )}
      {tab === 'data' && (
        <TabData
          ctx={ctx}
          backups={backups}
          backupInfo={backupInfo}
          setBackupInfo={setBackupInfo}
          reloadBackups={loadBackups}
        />
      )}
      {tab === 'log' && <TabLogBilling ctx={ctx} />}
      {tab === 'diagnosa' && <TabDiagnosa ctx={ctx} />}
        </div>
      </div>
    </div>
  )
}
