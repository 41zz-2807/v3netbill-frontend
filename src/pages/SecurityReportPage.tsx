import { useNavigate } from 'react-router-dom'

function Badge({ tone, children }: { tone: 'slate' | 'red' | 'orange' | 'yellow' | 'green' | 'blue'; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
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

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-slate-200 bg-white p-5 ${className}`}>{children}</div>
}

function FindingTable({ findings }: { findings: Array<{id: string; severity: 'red' | 'orange' | 'yellow'; title: string; location: string; risk: string; fix: string}> }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-slate-700">
          <tr>
            <th className="px-3 py-2 font-medium w-8">#</th>
            <th className="px-3 py-2 font-medium">Severity</th>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Lokasi</th>
            <th className="px-3 py-2 font-medium">Risiko</th>
            <th className="px-3 py-2 font-medium">Rekomendasi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {findings.map((f, i) => (
            <tr key={f.id}>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-600">{i + 1}</td>
              <td className="whitespace-nowrap px-3 py-2">
                <Badge tone={f.severity}>{f.severity.toUpperCase()}</Badge>
              </td>
              <td className="px-3 py-2 font-medium text-slate-800">{f.title}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-600">{f.location}</td>
              <td className="px-3 py-2 text-slate-600">{f.risk}</td>
              <td className="px-3 py-2 text-slate-600">{f.fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const critical = [
  {
    id: 'C1',
    severity: 'red' as const,
    title: 'CORS Wildcard (WebSocket & REST)',
    location: 'session.gateway.ts:19, main.ts:7',
    risk: 'Semua domain bisa akses WebSocket & REST API → CSRF, data exfiltration, unauthorized control.',
    fix: 'Batasi origin ke domain sah (mis. https://v3netbill.<domain>, http://localhost:5173). Set credentials: true bila perlu.'
  },
  {
    id: 'C2',
    severity: 'red' as const,
    title: 'JWT Secret Fallback Hardcoded',
    location: 'jwt.strategy.ts:13',
    risk: 'Jika env JWT_SECRET kosong, pakai default yang sama di semua deploy → token bisa ditiru.',
    fix: 'Hapus fallback; wajib process.env.JWT_SECRET; crash di startup bila kosong.'
  },
  {
    id: 'C3',
    severity: 'red' as const,
    title: 'Secret di .env & docker-compose.yml',
    location: 'Root .env, docker-compose.yml',
    risk: 'Credensial SMTP, Telegram, DB, JWT tersebar di file & history git.',
    fix: 'Gunakan Docker secrets / Vault / 1Password. Jangan commit .env; gunakan .env.example + inject via CI/CD.'
  },
  {
    id: 'C4',
    severity: 'red' as const,
    title: 'pg_dump Command Injection',
    location: 'settings.service.ts:178-188',
    risk: 'DATABASE_URL di-interpolasi ke shell execFileAsync → command injection.',
    fix: 'Gunakan --host, --port, --username, --dbname terpisah; hindari interpolasi string.'
  },
  {
    id: 'C5',
    severity: 'red' as const,
    title: 'Tidak Ada Rate Limiting Login',
    location: 'auth.controller.ts',
    risk: 'Brute-force login, user enumeration.',
    fix: 'Pasang @nestjs/throttler (mis. 5 req/menit per IP untuk /auth/login).'
  },
  {
    id: 'C6',
    severity: 'red' as const,
    title: 'CORS Default Tanpa Opsi',
    location: 'main.ts:7',
    risk: 'Allow all origin, method, header.',
    fix: 'Set origin, methods, allowedHeaders, credentials eksplisit.'
  },
]

const medium = [
  {
    id: 'M1',
    severity: 'orange' as const,
    title: 'JWT Tanpa Expiry Eksplisit',
    location: 'auth.service.ts:30',
    risk: 'Token tidak kadaluarsa terkontrol (default 1h tapi tidak dikonfigurasi).',
    fix: 'Set signOptions: { expiresIn: "8h" } di JwtModule atau jwtService.sign(payload, { expiresIn: "8h" }).'
  },
  {
    id: 'M2',
    severity: 'orange' as const,
    title: 'Refresh Token Tidak Ada',
    location: 'auth.service.ts',
    risk: 'Token lama valid hingga expiry; tidak bisa revoke sesi aktif.',
    fix: 'Implement refresh token (rotasi, simpan hash di DB, revoke list).'
  },
  {
    id: 'M3',
    severity: 'orange' as const,
    title: 'Password Policy Lemah',
    location: 'create-voucher.dto.ts, change-password.dto.ts',
    risk: 'Voucher password 4 digit; password user tanpa kompleksitas minimal.',
    fix: 'Validasi minimal 8 char, uppercase, lowercase, number, symbol untuk user; voucher 4 digit OK untuk UX.'
  },
  {
    id: 'M4',
    severity: 'orange' as const,
    title: 'File Upload Tanpa Validasi Konten',
    location: 'settings.controller.ts:26-42',
    risk: 'Upload .exe/.msi atau gambar berisi malware/script.',
    fix: 'Scan MIME type & magic bytes; batasi nama file aman; simpan di storage terisolasi.'
  },
  {
    id: 'M5',
    severity: 'orange' as const,
    title: 'WebSocket Auth via Query String',
    location: 'session.gateway.ts:60-65',
    risk: 'agentToken lewat query string → bocor di log proxy, browser history.',
    fix: 'Pindahkan ke handshake.auth (header/cookie).'
  },
  {
    id: 'M6',
    severity: 'orange' as const,
    title: 'Agent Token Statis Tanpa Rotasi',
    location: 'pc.service.ts:18',
    risk: 'Token statis selamanya; kalau bocor tidak bisa dicabut.',
    fix: 'Tambah endpoint POST /api/pcs/:id/rotate-token (ADMIN) + expiry otomatis (mis. 90 hari).'
  },
  {
    id: 'M7',
    severity: 'orange' as const,
    title: 'PIN Uninstall Tanpa Rate Limit',
    location: 'settings.service.ts:240-255',
    risk: 'Serangan online guessing PIN.',
    fix: 'Batasi percobaan (mis. 5x per jam per PC) + lockout.'
  },
]

const low = [
  {
    id: 'L1',
    severity: 'yellow' as const,
    title: 'Dependencies Vulnerable (undici via @nestjs/mau)',
    location: 'npm audit',
    risk: '5 kerentanan (2 high) di undici (HTTP client).',
    fix: 'npm audit fix --force (breaking) atau upgrade @nestjs/mau jika dipakai.'
  },
  {
    id: 'L2',
    severity: 'yellow' as const,
    title: 'Docker Production Pakai start:dev',
    location: 'Dockerfile:31',
    risk: 'ts-node + watch mode → lambat, memory besar, source code terekspos.',
    fix: 'Multi-stage build: npm run build → node dist/main.js.'
  },
  {
    id: 'L3',
    severity: 'yellow' as const,
    title: 'Bind Mount Source Code di Compose',
    location: 'docker-compose.yml:27',
    risk: 'Source code host tertimpa container; development-only.',
    fix: 'Production: gunakan image built, tanpa bind mount source.'
  },
  {
    id: 'L4',
    severity: 'yellow' as const,
    title: 'Tidak Ada Security Headers (Helmet)',
    location: 'main.ts',
    risk: 'Missing CSP, HSTS, X-Frame-Options, dll.',
    fix: 'app.use(helmet()) (install helmet).'
  },
  {
    id: 'L5',
    severity: 'yellow' as const,
    title: 'Path Traversal Potential di File Download',
    location: 'settings.service.ts:141-147, 225-232',
    risk: 'path.basename cukup aman, tapi defense-in-depth.',
    fix: 'Tambah validasi safe.includes("..") throw.'
  },
]

const good = [
  'Password di-hash bcrypt cost 10 (auth, accounts, settings PIN)',
  'Validasi input pakai class-validator (whitelist, transform)',
  'Role guard global + @Public() decorator eksplisit',
  'Agent autentikasi pakai agentToken per-PC (bukan JWT)',
  'Voucher expired check >30 hari tidak dipakai',
  'Transaksi batal hanya 10 menit & hanya transaksi terakhir',
  'Soft-delete transaksi (dibatalkan timestamp) — audit trail terjaga',
  'Backup otomatis dengan retention 30 hari',
  'Wallpaper endpoint @Public() tapi hanya serve file statis — OK',
]

export default function SecurityReportPage() {
  const navigate = useNavigate()
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Kembali
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Security Audit Report — v3Netbill</h1>
      </div>

      <section className="rounded-xl bg-slate-900 p-6 text-white">
        <h2 className="text-xl font-bold">Ringkasan</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Audit keamanan dilakukan pada tanggal <strong>{new Date().toLocaleDateString('id-ID')}</strong>.
          Ditemukan <Badge tone="red">{critical.length} Kritis</Badge>,{' '}
          <Badge tone="orange">{medium.length} Sedang</Badge>,{' '}
          <Badge tone="yellow">{low.length} Rendah</Badge>, dan <Badge tone="green">{good.length} Sudah Baik</Badge>.
          Fokus perbaikan: CORS, JWT secret, rate limiting, command injection, dan production hardening.
        </p>
      </section>

      <nav className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3">
        {[
          { id: 'kritis', label: 'Kritis' },
          { id: 'sedang', label: 'Sedang' },
          { id: 'rendah', label: 'Rendah' },
          { id: 'baik', label: 'Sudah Baik' },
        ].map((t) => (
          <a key={t.id} href={`#${t.id}`} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            {t.label}
          </a>
        ))}
      </nav>

      <section id="kritis" className="scroll-mt-20">
        <SectionTitle no="1">Kritis (High Risk) — Perbaiki Segera</SectionTitle>
        <Card>
          <FindingTable findings={critical} />
        </Card>
      </section>

      <section id="sedang" className="scroll-mt-20">
        <SectionTitle no="2">Sedang (Medium Risk) — Perbaiki Minggu Ini</SectionTitle>
        <Card>
          <FindingTable findings={medium} />
        </Card>
      </section>

      <section id="rendah" className="scroll-mt-20">
        <SectionTitle no="3">Rendah / Hardening (Low Risk) — Backlog</SectionTitle>
        <Card>
          <FindingTable findings={low} />
        </Card>
      </section>

      <section id="baik" className="scroll-mt-20">
        <SectionTitle no="4">Sudah Baik (Tidak Perlu Perbaikan)</SectionTitle>
        <Card>
          <ul className="grid gap-2 sm:grid-cols-2">
            {good.map((g, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
                {g}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="scroll-mt-20">
        <SectionTitle no="5">Prioritas Perbaikan (Suggested Order)</SectionTitle>
        <Card>
          <ol className="space-y-2">
            {[
              'CORS & JWT secret (kritis, cepat)',
              'Rate limiting login & verify-pin (kritis)',
              'pg_dump command injection fix (kritis)',
              'JWT expiry + refresh token (sedang)',
              'Docker production build + remove dev bind mount (sedang)',
              'Helmet security headers (sedang)',
              'Agent token rotation endpoint (sedang)',
              'File upload content validation (sedang)',
              'Dependency audit fix (rendah)',
              'Secret management (Vault/Docker secrets) (opsional, best practice)',
            ].map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700">{p}</span>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <p className="font-medium">Catatan:</p>
        <p>Report ini di-generate dari audit kode statis & konfigurasi. Bukan hasil penetration testing dinamis. Untuk validasi penuh, lakukan pentest berkala oleh tim keamanan.</p>
      </div>
    </div>
  )
}