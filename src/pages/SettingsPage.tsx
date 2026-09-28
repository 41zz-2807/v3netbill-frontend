import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.tsx'
import { fetchSettings, fetchBackupList, fetchUsers, parseMeta } from '../lib/api.ts'
import type { BackupFile, BackupResult, InstallerMeta, OperatorUser } from '../lib/types.ts'
import LoadingOverlay from '../components/LoadingOverlay.tsx'
import { TabButton } from '../components/ui/Tabs.tsx'
import TabTarif from './settings/TabTarif.tsx'
import TabAgent from './settings/TabAgent.tsx'
import TabInstalasi from './settings/TabInstalasi.tsx'
import TabPengguna from './settings/TabPengguna.tsx'
import TabData from './settings/TabData.tsx'
import { BUSY_TEXT, type SettingsCtx } from './settings/shared.ts'

type TabId = 'tarif' | 'agent' | 'instalasi' | 'pengguna' | 'data'

const TABS: { id: TabId; label: string }[] = [
  { id: 'tarif', label: 'Tarif' },
  { id: 'agent', label: 'Agent & Keamanan' },
  { id: 'instalasi', label: 'Instalasi' },
  { id: 'pengguna', label: 'Pengguna' },
  { id: 'data', label: 'Data' },
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

      {busy && <LoadingOverlay text={BUSY_TEXT[busy] ?? 'Memproses'} />}

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

      {/* Di layar sempit deretan tab digeser horizontal supaya tidak memaksa
          halaman melebar. min-w-max di TabButton menjaga tiap tombol tetap
          satu baris. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </TabButton>
        ))}
      </div>

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
        <TabAgent ctx={ctx} otpChatIdAwal={otpChatId} otpTerisiAwal={otpTerisi} />
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
    </div>
  )
}
