// import { useNavigate } from 'react-router-dom'

function Badge({ tone, children }: { tone: 'slate' | 'sky' | 'amber' | 'emerald' | 'rose'; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

function SectionTitle({ no, children }: { no: string; children: React.ReactNode }) {
  return (
    <h2 className="mb-4 scroll-mt-24 text-xl font-bold text-slate-900">
      <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-sm text-white">
        {no}
      </span>
      {children}
    </h2>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-5">{children}</div>
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 mt-6 text-base font-semibold text-slate-800 first:mt-0">{children}</h3>
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-2 text-sm last:border-0 sm:flex-row sm:gap-4">
      <div className="w-1/3 shrink-0 font-medium text-slate-500">{label}</div>
      <div className="text-slate-800">{value}</div>
    </div>
  )
}

function ApiTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-slate-700">
          <tr>
            <th className="px-3 py-2 font-medium">Metode</th>
            <th className="px-3 py-2 font-medium">Endpoint</th>
            <th className="px-3 py-2 font-medium">Keterangan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(([m, p, d]) => (
            <tr key={m + p}>
              <td className="whitespace-nowrap px-3 py-2">
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold text-white ${
                    m === 'GET' ? 'bg-emerald-600' : m === 'POST' ? 'bg-sky-600' : 'bg-amber-600'
                  }`}
                >
                  {m}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-800">{p}</td>
              <td className="px-3 py-2 text-slate-600">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WsTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-slate-700">
          <tr>
            <th className="px-3 py-2 font-medium">Event</th>
            <th className="px-3 py-2 font-medium">Arah</th>
            <th className="px-3 py-2 font-medium">Fungsi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(([e, a, d]) => (
            <tr key={e}>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-800">{e}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{a}</td>
              <td className="px-3 py-2 text-slate-600">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">
      {children}
    </pre>
  )
}

function Step({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
        {no}
      </span>
      <div className="text-sm text-slate-700">
        <span className="font-semibold text-slate-800">{title}</span>
        <div className="mt-0.5 text-slate-600">{children}</div>
      </div>
    </li>
  )
}

const toc = [
  { id: 'tentang', label: 'Tentang v3Netbill' },
  { id: 'cara-pakai', label: 'Cara Pemakaian' },
  { id: 'tools', label: 'Menu & Tools' },
  { id: 'server', label: 'Sisi Server' },
  { id: 'client', label: 'Sisi Client (Agent)' },
  { id: 'rules', label: 'Aturan & Logika' },
  { id: 'keamanan', label: 'Keamanan' },
]

export default function InformasiProdukPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900">Informasi Produk v3Netbill</h1>

      <section className="rounded-xl bg-slate-900 p-6 text-white">
        <h2 className="text-xl font-bold">v3Netbill — Billing System Warnet</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Aplikasi manajemen billing warnet lengkap: mengelola PC client, voucher & member, sesi pemakaian
          realtime, transaksi, laporan harian otomatis (PDF via email & Telegram), serta tools pendukung
          (installer agent, wallpaper lock screen, backup database). Berjalan dalam 3 komponen: server
          (backend + dashboard), dan agent di setiap PC client Windows.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Badge tone="sky">Backend: NestJS 12 + Node 20</Badge>
          <Badge tone="sky">Database: PostgreSQL 15 (Prisma)</Badge>
          <Badge tone="emerald">Frontend: React 19 + Vite + Tailwind</Badge>
          <Badge tone="amber">Agent Client: Windows .NET 8 (WPF)</Badge>
          <Badge tone="rose">Realtime: Socket.IO</Badge>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3">
        {toc.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {t.label}
          </a>
        ))}
      </nav>

      <section id="tentang" className="scroll-mt-20">
        <SectionTitle no="1">Tentang v3Netbill</SectionTitle>
        <Card>
          <SubHead>Arsitektur 3 komponen</SubHead>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Server (Backend)</div>
              <p className="text-xs text-slate-600">
                REST API + WebSocket untuk semua logika billing. Menjadi sumber kebenaran waktu sesi,
                menghitung laporan, mengatur tarif, dan menjadwalkan tugas otomatis (backup, tutup hari).
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Dashboard (Frontend)</div>
              <p className="text-xs text-slate-600">
                Halaman web untuk operator (Admin/Kasir): memantau PC secara realtime, membuat voucher,
                melihat transaksi & laporan, dan mengelola pengaturan.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Agent (PC Client)</div>
              <p className="text-xs text-slate-600">
                Program Windows yang terpasang di tiap PC warnet. Menampilkan layar login, mengunci saat
                sesi berjalan, dan mencatat waktu pemakaian.
              </p>
            </div>
          </div>
          <SubHead>Alur data normal</SubHead>
          <Code>{`PC Client (Agent)
  │  Socket.IO  namespace:/session
  │  agent:register (pcId + agentToken)
  │  client:login_request (kode + password)
  ▼
v3Netbill Server (NestJS)
  │  validasi akun → hitung durasi → buat Session
  │  session:start ▶ session:tick (1 detik) ▶ session:stop
  ▼
PostgreSQL 15 (data akun, sesi, transaksi, laporan)

Dashboard (Admin/Kasir) ⇄ Server via REST /api/* + WebSocket realtime`}</Code>
        </Card>
      </section>

      <section id="cara-pakai" className="scroll-mt-20">
        <SectionTitle no="2">Cara Pemakaian</SectionTitle>
        <Card>
          <ol className="space-y-3">
            <Step no={1} title="Masuk ke aplikasi">
              Buka URL dashboard lalu login. Akun <Badge tone="sky">ADMIN</Badge> punya akses semua menu
              termasuk Pengaturan; akun <Badge tone="amber">KASIR</Badge> untuk operasional harian
              (PC, voucher, transaksi, laporan).
            </Step>
            <Step no={2} title="Atur tarif & kebijakan">
              Di menu <b>Pengaturan</b>, isi harga per menit dan grace period sesuai tarif warnet Anda.
            </Step>
            <Step no={3} title="Daftarkan PC">
              Di <b>PC Management</b>, tambah PC (nama + IP). Sistem menghasilkan <code className="rounded bg-slate-100 px-1 text-xs">agentToken</code> unik yang dipakai agent untuk terhubung.
            </Step>
            <Step no={4} title="Pasang agent di PC client">
              Download installer MSI di Pengaturan, jalankan sebagai Administrator di PC client, lalu isi
              Server URL, PC ID, dan Agent Token (lihat bagian <i>Sisi Client</i>).
            </Step>
            <Step no={5} title="Buat voucher / member">
              Di <b>Voucher & Member</b>, buat voucher (isikan nominal) dan/atau member. Voucher punya kode
              unik 6 digit + password 4 digit untuk login.
            </Step>
            <Step no={6} title="Mulai sesi">
              Kasir login di PC client memakai kode + password, atau dari Dashboard (pilih PC → Start dengan
              voucher yang sudah dibuat / buat voucher langsung). Sesi berjalan dan dihitung mundur oleh server.
            </Step>
            <Step no={7} title="Pantau & lapor">
              Dashboard menampilkan status PC realtime. Laporan otomatis dibuat setiap hari pukul 23:30 WIB
              (PDF dikirim via email dan Telegram), dan backup database tiap pukul 01:00 WIB.
            </Step>
          </ol>
        </Card>
      </section>

      <section id="tools" className="scroll-mt-20">
        <SectionTitle no="3">Menu & Tools di Aplikasi</SectionTitle>
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Dashboard</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Kartu ringkasan: jumlah PC Aktif / Idle / Offline beserta progress bar.</li>
                <li>Daftar PC realtime (status, sesi aktif, sisa waktu).</li>
                <li>Aksi cepat: Mulai Sesi, Kunci PC, Shutdown PC (Admin/Kasir).</li>
                <li>Log aktivitas realtime (sesi mulai/selesai, transaksi, kunci/mati PC).</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">PC Management</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Tambah PC (cukup nama) — hanya Admin. IP dicatat otomatis dari koneksi agent.</li>
                <li>Lihat status, IP, token agent.</li>
                <li>Unlock manual bila sesi macet.</li>
                <li>Hapus PC (ditolak bila ada sesi aktif; riwayat sesi ikut terhapus).</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Voucher & Member</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Buat Voucher (nominal kelipatan 500) dan Member (nama + nominal).</li>
                <li>Topup saldo, koreksi nominal, batal transaksi terakhir.</li>
                <li>Ubah password, revoke akun (nonaktifkan).</li>
                <li>Cari / filter akun (tipe, status, kata kunci).</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Transaksi</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Riwayat semua transaksi (beli baru, topup, koreksi).</li>
                <li>Filter berdasarkan tanggal, kasir, atau kata kunci.</li>
                <li>Detail mencakup akun, nominal, dan kasir penanggung jawab.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Laporan</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Laporan hari ini (total login, pendapatan voucher/member).</li>
                <li>Ringkasan harian / rentang tanggal dengan grafik interaktif.</li>
                <li>Tabel pemakaian per hari, voucher member, dan pendapatan.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Pengaturan</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Harga per menit & grace period.</li>
                <li>PIN uninstall agent + ganti kata sandi sendiri.</li>
                <li>Upload installer agent (.exe/.msi, maks 200 MB) dan wallpaper lock screen (10 MB).</li>
                <li>Backup database manual + daftar & unduh backup.</li>
              </ul>
            </div>
          </div>
        </Card>
      </section>

      <section id="server" className="scroll-mt-20">
        <SectionTitle no="4">Sisi Server (Backend)</SectionTitle>
        <Card>
          <SubHead>Rest API (prefix /api, autentikasi JWT)</SubHead>
          <ApiTable
            rows={[
              ['POST', '/api/auth/login', 'Login admin/kasir → token JWT'],
              ['GET', '/api/pcs', 'Daftar PC + status'],
              ['POST', '/api/pcs', 'Daftarkan PC baru (Admin)'],
              ['DELETE', '/api/pcs/:id', 'Hapus PC (Admin, hanya jika tidak ada sesi aktif)'],
              ['POST', '/api/pcs/:id/unlock', 'Unlock PC manual (Admin)'],
              ['GET', '/api/accounts', 'Daftar voucher/member + filter'],
              ['POST', '/api/accounts/voucher', 'Buat voucher'],
              ['POST', '/api/accounts/member', 'Buat member'],
              ['POST', '/api/accounts/:id/topup', 'Topup saldo akun'],
              ['POST', '/api/accounts/:id/koreksi', 'Koreksi nominal transaksi'],
              ['POST', '/api/accounts/:id/batal-transaksi', 'Batalkan transaksi'],
              ['PATCH', '/api/accounts/:id/password', 'Ganti password akun'],
              ['POST', '/api/accounts/:id/revoke', 'Nonaktifkan akun'],
              ['GET', '/api/transactions', 'Riwayat transaksi + filter'],
              ['GET', '/api/reports/today', 'Ringkasan hari ini'],
              ['GET', '/api/reports/daily', 'Laporan harian (dari & sampai)'],
              ['GET', '/api/reports/range', 'Laporan rentang tanggal (maks 366 hari)'],
              ['GET', '/api/settings', 'Daftar pengaturan (tarif, grace, dll)'],
              ['PATCH', '/api/settings', 'Ubah pengaturan (Admin)'],
              ['PATCH', '/api/settings/password', 'Ganti password akun sendiri'],
              ['POST', '/api/settings/installer', 'Upload installer agent (Admin)'],
              ['GET', '/api/settings/installer', 'Unduh installer agent'],
              ['POST', '/api/settings/wallpaper', 'Upload wallpaper lock screen (Admin)'],
              ['GET', '/api/settings/wallpaper', 'Ambil wallpaper (tanpa login, dipakai agent)'],
              ['POST', '/api/settings/backup', 'Buat backup database (Admin)'],
              ['GET', '/api/settings/backup/list', 'Daftar backup'],
              ['GET', '/api/settings/backup/download', 'Unduh backup'],
              ['PATCH', '/api/settings/pin-uninstall', 'Atur PIN uninstall (Admin)'],
              ['POST', '/api/settings/verify-pin', 'Verifikasi PIN (dipakai agent/teknisi)'],
              ['POST', '/api/laporan/kirim-tutup-hari', 'Kirim laporan tutup hari PDF (Admin)'],
            ]}
          />

          <SubHead>WebSocket realtime (namespace /session)</SubHead>
          <WsTable
            rows={[
              ['agent:register', 'Agent → Server', 'Daftarkan agent dengan pcId + agentToken'],
              ['agent:heartbeat', 'Agent → Server', 'Tanda hidup tiap ±15 detik, update lastHeartbeatAt'],
              ['client:login_request', 'Agent → Server', 'Minta mulai sesi (kode + password)'],
              ['client:login_result', 'Server → Agent', 'Hasil login (sukses / pesan penolakan)'],
              ['session:start', 'Server → Agent', 'Sesi dimulai (sessionId + durasi detik)'],
              ['session:tick', 'Server → Agent', 'Sisa waktu tiap detik'],
              ['session:stop', 'Server → Agent', 'Sesi selesai (alasan: manual/habis/disconnect_timeout)'],
              ['dashboard:subscribe', 'Dashboard → Server', 'Berlangganan data realtime'],
              ['dashboard:pc_update', 'Server → Dashboard', 'Update daftar PC + sesi aktif'],
              ['dashboard:log', 'Server → Dashboard', 'Log aktivitas realtime'],
              ['dashboard:start_pc', 'Dashboard → Server', 'Mulai sesi dari dashboard (kode akun)'],
              ['dashboard:start_voucher', 'Dashboard → Server', 'Buat voucher & langsung mulai sesi'],
              ['dashboard:lock_pc', 'Dashboard → Server', 'Perintah kunci PC'],
              ['dashboard:shutdown_pc', 'Dashboard → Server', 'Perintah matikan PC'],
              ['admin:lock / admin:shutdown', 'Server → Agent', 'Eksekusi kunci / shutdown di PC client'],
            ]}
          />

          <SubHead>Tugas otomatis (cron)</SubHead>
          <div className="space-y-2">
            <Row
              label="Tutup hari (23:30 WIB)"
              value="Menghitung laporan harian → make PDF (Laporan Tutup Hari) → kirim ke email & Telegram secara otomatis."
            />
            <Row
              label="Backup database (01:00 WIB)"
              value="Dump database via pg_dump ke folder backup. Riwayat lebih dari 30 hari otomatis dihapus."
            />
          </div>
        </Card>
      </section>

      <section id="client" className="scroll-mt-20">
        <SectionTitle no="5">Sisi Client (Agent Windows)</SectionTitle>
        <Card>
          <SubHead>Komponen</SubHead>
          <div className="grid gap-3 sm:grid-cols-3">
            <Row label="Agent.Core" value="Class library logika koneksi & protokol Socket.IO ke server." />
            <Row label="Agent.Service" value="Windows Service (system, auto-start) — pemegang koneksi utama ke server." />
            <Row label="Agent.Overlay" value="Aplikasi WPF tampil di desktop user: layar login, countdown, lock screen." />
          </div>

          <SubHead>Komunikasi internal (Named Pipe)</SubHead>
          <p className="text-sm text-slate-600">
            Service dan Overlay berkomunikasi via pipe bernama <code className="rounded bg-slate-100 px-1 text-xs">v3netbill-agent</code>:
            Service mengirim <b>StateUpdate / SessionTick / LoginResult</b>, Overlay mengirim{' '}
            <b>LoginRequest / PinVerifyRequest</b>.
          </p>

          <SubHead>Siklus satu sesi di client</SubHead>
          <Code>{`1. Agent register  -> server  (pcId + agentToken)
2. Overlay tampil layar "Masuk"  (sambil heartbeat tiap 15 dtk)
3. User masukkan kode + password -> client:login_request
4. Server validasi & buat Session -> session:start
5. Overlay unlock desktop + tampil mini-window countdown
6. session:tick tiap detik (server = sumber waktu)
7. Selesai / ditekan stop / PC mati -> session:stop -> terkunci lagi`}</Code>

          <SubHead>Penguncian (Lock Enforcement)</SubHead>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>
              Saat Locked: <b>Task Manager</b> dinonaktifkan (registry <code className="rounded bg-slate-100 px-1 text-xs">DisableTaskMgr=1</code>) dan dikembalikan ke 0 saat unlock.
            </li>
            <li>
              <b>Watchdog</b>: tiap 5 detik memastikan Overlay berjalan saat Locked — restart otomatis bila mati.
            </li>
            <li>
              <b>Keyboard hook</b>: memblokir <code className="rounded bg-slate-100 px-1 text-xs">Alt+Tab</code>,{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">Win</code>, dan{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">Alt+F4</code> hanya saat Locked. <code className="rounded bg-slate-100 px-1 text-xs">Ctrl+Alt+Del</code> tidak diblokir (aturan Windows).
            </li>
            <li>
              <b>Teknisi</b>: tekan <code className="rounded bg-slate-100 px-1 text-xs">Ctrl+Alt+Shift+F12</code> → masukkan PIN → verifikasi ke server → hook dinonaktifkan sementara.
            </li>
            <li>
              <b>PIN darurat</b>: tombol STOP AGENT tersedia bila PC macet (service/pipe bermasalah). Perlu PIN default provider.
            </li>
          </ul>

          <SubHead>Konfigurasi & instalasi</SubHead>
          <Code>{`// appsettings.json (atau registry HKLM\\SOFTWARE\\v3Netbill\\Agent)
{
  "Server": { "Url": "http://<server>:3000" },
  "Agent": { "PcId": "<PC ID dari dashboard>", "Token": "<agentToken dari dashboard>" },
  "Overlay": { "ExePath": "" }
}`}</Code>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>Installer <b>.msi (WiX v4)</b> → wizard minta Server URL, PC ID, dan Agent Token.</li>
            <li>Instal sebagai Administrator; Service auto-start, Overlay dijadwalkan jalan saat user logon.</li>
            <li>Verifikasi: <code className="rounded bg-slate-100 px-1 text-xs">Get-Service v3NetbillAgent</code> dan <code className="rounded bg-slate-100 px-1 text-xs">Get-ScheduledTask -TaskName v3NetbillAgentOverlay</code>.</li>
            <li>Build lewat GitHub Actions (artefak <code className="rounded bg-slate-100 px-1 text-xs">v3NetbillAgentSetup.msi</code>).</li>
          </ul>
        </Card>
      </section>

      <section id="rules" className="scroll-mt-20">
        <SectionTitle no="6">Aturan & Logika Bisnis</SectionTitle>
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Tarif & durasi</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Nominal voucher/member harus kelipatan 500.</li>
                <li>Durasi = floor((nominal ÷ harga per menit) × 60) detik.</li>
                <li>Harga per menit & grace period bisa diubah langsung (aktif tanpa restart).</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Voucher</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Kode unik 6 digit; password 4 digit angka (boleh diawali 0).</li>
                <li>Sekali dipakai hingga waktu habis; habis → saldo direset 0 (tidak bisa dipakai ulang).</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Member</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Identitas pakai nama; saldo bisa ditopup berkali-kali.</li>
                <li>Sisa waktu dari sesi sebelumnya di-refund (tidak hangus).</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Sesi</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Server adalah sumber waktu (tick tiap 1 detik), bukan PC.</li>
                <li>Alasan stop: habis / manual / disconnect_timeout.</li>
                <li>habis → saldo 0. manual / disconnect_timeout → sisa waktu dikembalikan.</li>
                <li>PC mati / jaringan putus → sesi otomatis berhenti (disconnect_timeout) dan saldo di-refund.</li>
                <li>Grace period (default 180 detik) memberi toleransi sambung-kembali.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Hari buku & tutup hari</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Batas hari buku 23:30 WIB; transaksi setelahnya masuk hari berikutnya.</li>
                <li>Laporan otomatis 23:30 WIB (PDF via email + Telegram).</li>
                <li>Laporan dihitung ulang dari data transaksi & sesi (on-read).</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Akses & role</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>ADMIN: semua fitur termasuk Pengaturan & data PC.</li>
                <li>KASIR: operasional harian (PC, voucher, transaksi, laporan).</li>
                <li>Login dikunci saja: akun admin/kasir dibatasi per role di tiap endpoint.</li>
              </ul>
            </div>
          </div>
        </Card>
      </section>

      <section id="keamanan" className="scroll-mt-20">
        <SectionTitle no="7">Keamanan</SectionTitle>
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Autentikasi</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Token JWT untuk operator, diverifikasi tiap request REST.</li>
                <li>Agent memakai agentToken per-PC (bukan JWT) saat koneksi WebSocket.</li>
                <li>Password disimpan ter-hash (bcrypt).</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-bold text-slate-800">Proteksi client</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Task Manager diblokir saat sesi aktif, watchdog menjaga overlay.</li>
                <li>Keyboard hook memblokir pintasan keluar saat Locked.</li>
                <li>PIN uninstall & PIN darurat melindungi agent dari penyalahgunaan.</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Catatan: informasi ini disediakan sebagai panduan penggunaan produk. Nilai kredensial pada halaman
            ini hanya contoh; konfigurasi asli dikelola dari menu Pengaturan.
          </p>
        </Card>
      </section>
    </div>
  )
}