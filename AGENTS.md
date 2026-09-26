# AGENTS.md — v3Netbill (Warnet Billing System)

Panduan untuk AI agent (opencode) mengerjakan project ini. Baca penuh sebelum mulai.

## Konteks singkat

v3Netbill adalah sistem billing warnet yang dibangun ulang TOTAl dari `v2netbill` (hasil develop
sebelumnya, dishare dari `/tmp/opencode/v2netbill-ref/`). Backend = NestJS 12 (ESM), Frontend =
React + TS + Vite + Tailwind (masih scaffold). SEMUA development harus berjalan di dalam Docker
— JANGAN pernah jalankan npm/npx/node/psql di host.

## Aturan mutlak (harus selalu dipatuhi)

1. Semua perintah npm / npx / node dijalankan lewat:
   `docker compose exec v3netbill-backend <cmd>`
   (berlaku juga untuk create-migration, prisma generate, build, test, seed).
2. Install package HANYA di dalam container (via `docker compose exec ... npm i ...`),
   JANGAN install di host lalu menyalin file. package.json di-sinkronkan lewat bind mount
   `./backend:/app`.
3. Setelah setiap langkah, verifikasi log:
   `docker compose logs v3netbill-backend`
4. Build image ulang setelah menambah dependency / prisma generate berubah:
   `docker compose build v3netbill-backend && docker compose up -d --force-recreate v3netbill-backend`
5. STOP & lapor hasil setelah tiap fase. Jangan lompat ke fase berikut tanpa konfirmasi.
6. Jangan commit ke git kecuali diminta user (repo ini TIDAK ber-git).
7. Semua relasi antar file backend WAJIB import dengan ekstensi `.js` (contoh: `'./x.service.js'`)
   karena project ini `"type": "module"` + `moduleResolution: nodenext`. JANGAN ubah ke Node16/CommonJS.
8. Prisma WAJIB dipin ke versi 5.22.x (`@prisma/client` dan `prisma`). JANGAN upgrade ke 7.x —
   format schema-nya tidak kompatibel.
9. Jangan tulis komentar berlebihan di kode; ikuti gaya file yang sudah ada.
10. Setiap AMBIGUITY (fitur, scope fase) → tanya user dulu, jangan menebak.

## Stack & struktur

```
v3netbill/
├── backend/            # NestJS 12 API + WebSocket
│   ├── Dockerfile      # node:20, npm install, prisma generate, start:dev
│   ├── package.json    # "type":"module", prisma.seed, deps Fase 1-4
│   ├── prisma/
│   │   ├── schema.prisma   # 7 model + 6 enum (PERSIS referensi v2)
│   │   └── seed.ts         # setting harga_per_menit=150, grace_period_detik=180
│   └── src/
│       ├── main.ts         # ValidationPipe global, CORS
│       ├── app.module.ts   # AuthModule..SessionModule + APP_GUARD/APP_FILTER global
│       ├── common/         # guards, decorators, filter
│       ├── prisma/         # PrismaModule (global) + PrismaService
│       ├── auth/           # login JWT, jwt.strategy
│       ├── pc/             # CRUD PC (ADMIN), generate agentToken
│       ├── accounts/       # voucher/member/topup/password/revoke
│       ├── transactions/   # riwayat transaksi
│       └── session/        # WebSocket SessionGateway + SessionService (Fase 4)
├── docker-compose.yml   # service v3netbill-backend
├── .env / .env.example
└── README.md
```

## Database & infra

- PostgreSQL container existing: `postgres-15`, user `billing_user`, pass ada di `.env` project root.
- DB: `v3netbill`; hostname dari dalam container backend = `postgres-15`.
- Network external: `war-nt-web_default` (di compose dinamai `postgres-network`).
- Named volume: `v3netbill-node-modules` (biar node_modules tidak ketimpa bind mount).
- **Akses dari luar**: TIDAK ada nginx di host. Semua domain publik lewat **Cloudflare Tunnel**
  (`cloudflared` jalan di host, config `/etc/cloudflared/config.yml`) → forward ke port lokal.
  Rincian topologi & daftar hostname: `docs/DEPLOYMENT.md`.
- **Penting**: `docker-proxy` (userland proxy) aktif di host ini, jadi container backend
  TIDAK pernah melihat IP asli PC yang konek langsung ke port yang dipublish — hanya IP bridge
  Docker. Ini memengaruhi deteksi IP PC, baca `docs/DETEKSI-IP.md` sebelum mengubahnya.

## Env (.env root project)

- `DATABASE_URL=postgresql://billing_user:<password>@postgres-15:5432/v3netbill?schema=public`
- `JWT_SECRET=<isi sendiri — jangan ditulis di dokumen/file teks>`
- `PORT=3000`, `NODE_ENV=development`

## Akses test yang sudah dibuat

- Admin: `admin` / `admin123` (Role ADMIN)
- Kasir: `kasir` / `kasir1234` (Role KASIR)

## Skema DB (8 model)

`User`, `Pc`, `Account`, `Session`, `Transaction`, `DailyReport`, `Setting`, `ActivityLog`.
Enum: `Role`(ADMIN,KASIR), `PcStatus`(IDLE,ACTIVE,OFFLINE), `AccountType`(VOUCHER,MEMBER),
`AccountStatus`(ACTIVE,REVOKED,EXPIRED), `SessionStatus`(BERJALAN,SELESAI,DISTOP),
`TransactionType`(BELI_BARU,TOPUP).

Logika bisnis yang sudah berjalan:
- Password voucher (generate otomatis di `accounts.service.ts#generatePassword`) = **4 digit angka** (0-9,
  boleh leading zero, contoh `0042`; dipakai `crypto.randomInt(0,10000).padStart(4,'0')`). Kode unik voucher
  (6 digit) TIDAK ikut diubah. Password manual JSON di PATCH `/accounts/:id/password` bebas (bukan angka wajib).
- Nominal voucher/member harus kelipatan 500; sisa waktu = floor((nominal/harga_per_menit)*60) detik.
- Session: server yang jadi sumber kebenaran waktu (tick interval 1dtk di SessionService),
  grace period disconnect = `Setting.grace_period_detik` (default 180dtk), auto-stop `disconnect_timeout`.
- Saat session stop dengan alasan `habis` → `Account.sisaWaktuDetik` di-reset ke 0 (voucher tidak bisa
  dipakai ulang). Alasan lain (`manual`/`disconnect_timeout`) → refund sisa waktu.
- WebSocket events (`/session`): `agent:register`, `agent:heartbeat`, `client:login_request`
  (→ `client:login_result`), server emit `session:start|tick|stop`, `dashboard:subscribe` →
  `dashboard:pc_update` (berisi array `pcs` dengan detail session aktif + sisa detik, bukan `{}`),
  `dashboard:log` (event `session:started|stopped`, `transaction:created`) ke room `dashboard`.
- REST reports: `GET /reports/today`, `/reports/daily?dari&sampai`, `/reports/range?dari&sampai`
  (JWT auth; hitung ulang on-read dari Transaction+Session, `upsert` ke `DailyReport.tanggal` unik,
  `sampai>=dari`, maks 366 hari).
- Guard global (`APP_GUARD`) dibuat bypass untuk context `ws` (agent pakai token PC, bukan JWT).
  `HttpExceptionFilter` juga hanya menangani context http.
- **`Pc.ipClient` adalah data TAMPILAN saja** — bukan identitas, bukan kunci unik, tidak dipakai
  routing/auth/lock. Identitas PC selalu `pcId` + validasi `agentToken`. Field diisi otomatis dari
  koneksi agent (`session.gateway.ts#alamatIp`), TIDAK diisi manual lagi di form PC.
  Urutan sumber IP: `ip dari agent` → `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for` →
  `handshake.address`. Detail & batasan topologi: `docs/DETEKSI-IP.md`.

## Status fase

- FASE 0 ✅ v2 dibersihkan total, DB `v3netbill` dibuat, referensi di `/tmp/opencode/v2netbill-ref/`.
- FASE 1 ✅ Scaffold NestJS + React-TS di container, compose + Dockerfile, volume node_modules.
- FASE 2 ✅ Prisma 5.22 + schema 7 model + migrasi `20260922142242_init` + seed.
- FASE 3 ✅ auth/pc/accounts/transactions lengkap, teruji curl (JWT, role guard, nominal 500).
- FASE 4 ✅ SessionModule WebSocket; teruji via socket.io-client (node di container):
  register, login_request, start/tick, disconnect-grace-reconnect, auto-stop. Guard bypass ws.
- FASE 5 ✅ Lengkap — 5a ReportsModule backend (`/reports/today|daily|range`, agregasi on-read
  dari Transaction+Session, upsert `DailyReport.tanggal` unik); 5b dashboard realtime WS
  (`dashboard:pc_update` detail PC+session + `dashboard:log`); 5c Frontend React+TS+Vite+Tailwind v4
  (login JWT + AuthContext, halaman Dashboard/PC/Voucher&Member/Transaksi/Laporan).

## Frontend (FASE 5c) — catatan

- Service `v3netbill-frontend` di docker-compose (port 5173), volume node_modules terpisah.
  Command: `docker compose exec v3netbill-frontend npm run build|lint`.
- REST via Vite proxy `/api` → `http://v3netbill-backend:3000`; WebSocket juga lewat proxy
  (`/socket.io` dengan `ws: true`) — `DashboardPage.tsx` konek ke `window.location.origin` + `/session`,
  BUKAN langsung ke `:3000`. Kalau dashboard ngehang di "Menghubungkan…", cek proxy `/socket.io` dulu.
- **Semua API backend diberi global prefix `/api`** (`app.setGlobalPrefix('api')` di main.ts) —
  path frontend (`/reports`, `/pcs`, `/transactions`, `/accounts`) tidak lagi bentrok dengan API,
  sehingga navigasi SPA tidak 404. Endpoint jadi `/api/auth/login`, `/api/pcs`, `/api/reports/today`,
  dst. Contoh curl: `curl http://localhost:3000/api/reports/today -H "Authorization: Bearer ..."`.
- Deps baru: axios, react-router-dom, socket.io-client, tailwindcss + @tailwindcss/vite.
- Login JWT + AuthContext (localStorage token/role/username); interceptor 401 → redirect login.

## Testing (pola yang dipakai)

- REST: `curl` dari host ke `http://localhost:3000` (boleh dari host; tidak ada npm/node).
- WebSocket: buat file `.mjs` sementara, `docker cp` ke container → `node /app/x.mjs`
  memakai `socket.io-client` (sudah devDep) + `PrismaClient` untuk inspeksi DB.
  Hapus file test dari ./backend & container setelah selesai.
- Selalu cek `docker compose logs v3netbill-backend` untuk 0 error.

## Catatan migrasi

- Perintah migrasi: `docker compose exec v3netbill-backend npx prisma migrate dev --name <nama>`
- Migrasi applied (4): `20260922142242_init`, `20260925072311_add_transaction_koreksi`,
  `20260925072645_add_transaction_void`, `20260925163314_add_activity_log`.
## FASE 6 — Settings (backup/installer/wallpaper/PIN) ✅ lengkap

- **Backend (SettingsModule)** — controller `@Controller('settings')`, semua path global prefix `/api`:
  - `GET /api/settings` — `getAll()` → semua Setting key-value (map).
  - `PATCH /api/settings` `{key,value}` — admin; validasi `KEY_KNOWN` (harga_per_menit, grace_period_detik, dll); nilai string; khusus `grace_period_detik` → integer. Update harga live (AccountsService getHargaPerMenit tiap call).
  - `PATCH /api/settings/password` `{oldPassword,newPassword}` — user sendiri, bcrypt compare + hash (tidak perlu role).
  - `POST /api/settings/installer` (multipart `file`, filter `.exe/.msi`, 200MB) — admin; simpan di `/data/installer/` + Setting `installer_meta`; `GET /api/settings/installer` → `res.download`.
  - `POST /api/settings/wallpaper` (multipart `file`, filter `.jpg/.jpeg/.png`, 10MB) — admin; simpan `/data/wallpaper/` + Setting `wallpaper_lockscreen_path`; `GET /api/settings/wallpaper` → `res.sendFile`.
  - `POST /api/settings/backup` — `pg_dump` **tanpa** `?schema=public` (API url di-strip), simpan `/data/backup/`, Setting `backup_last`; `GET /api/settings/backup/last`.
  - `PATCH /api/settings/pin-uninstall` `{pin}` — admin; bcrypt; `POST /api/settings/verify-pin` `{pcId,agentToken,pin}` — `@Public()` (tanpa JWT), validate PC `agentToken`, return `{valid}`.
- **Scheduler**: `@nestjs/schedule` `@Cron(CronExpression.EVERY_DAY_AT_1AM)` cron `auto-backup` → `createBackup()` + `cleanupOldBackups()` (retensi 30 hari). Log startup: `Scheduler terdaftar: cron "auto-backup" — next ...`.
- **Frontend** (`frontend/src/pages/SettingsPage.tsx`): section Tarif (harga_per_menit, grace_period_detik via PATCH `/settings`), Ubah Password Sendiri (`/settings/password`), Upload Installer (multer + meta display), Upload Wallpaper (preview), Backup (POST `/settings/backup` + info last), PIN Uninstall (`/settings/pin-uninstall`). Nav item "Pengaturan" admin-only di `Layout.tsx` + route `/settings` di `App.tsx` (admin guard: redirect non-admin).
- **Kenset**: `data/` bind mount (installer/wallpaper/backup persist), Dockerfile backend tambah `postgresql-client` (pg_dump).

## FASE 7-9 — Agent Client (repo terpisah `v3NetbillAgent/`) ✅

- Repo sendiri dengan git + GitHub Actions; bukan bagian backend. Build MSI via WiX v4.
- Komponen: `Agent.Service` (Windows Service, koneksi Socket.IO), `Agent.Overlay` (WPF fullscreen
  layar login + mini-panel sesi), `Agent.Core` (protokol + named pipe), `Installer/Product.wxs`.
- Config dibaca `GetConfig()` (`Agent.Service/Worker.cs:608`): **registry → appsettings.json → default**.
  Registry `HKLM\Software\v3Netbill\Agent`: `ServerUrl`, `PcId`, `AgentToken` ( ditulis MSI).
- Wizard installer punya dialog `ServerConfigDialog` (`Installer/Product.wxs:194`) — field
  **Server URL / PC ID / Agent Token**. Default property `SERVER_URL=https://v3netbill.<domain>`.
- **WAJIB isi `ServerUrl` dengan skema lengkap** (`http://192.168.1.65:3000`), karena
  `Agent.Core/ServerConnection.cs:74` memanggil `new Uri(...)` — string tanpa skema gagal.
- Transisi versi agent: `1.0.6.0` reconnect supervisor → `1.0.7.0` single reconnect authority
  (anti flapping) → `1.0.8.0` heartbeatimer bug → `1.0.9.0` heartbeat self-diagnosing + tick log.
  Commit terbaru `86a4b87`. Riwayat detail: `v3NetbillAgent/HANDOFF.md`.
- Detail arsitektur & prosedur deploy: `v3NetbillAgent/README.md`.

## Jejak aktivitas (ActivityLog) ✅

- `GET /api/activity-log?limit&cursor` (paginate) dan `GET /api/activity-log/today`.
- Dicatat dari `session.gateway.ts#broadcastActivityLog` untuk event `session:started`, `session:stopped`,
  `pc_locked`, `pc_unlocked`, `pc_shutdown`, `transaction:created`.
- Field `by` = nama user JWT, `kasirId` = id user. `by` diisi dari `client.data.username`
  (diisi saat verifikasi JWT di handshake, `session.gateway.ts:55`).
- Cron `cleanup-activity-logs` tiap 02:00 — retensi 30 hari.

## Laporan tutup hari (LaporanModule) ✅

- Cron `tutup-hari-laporan` tiap 23:30 WIB (`timeZone: Asia/Jakarta`) → agregasi hari sebelumnya,
  generate PDF (`pdfkit`), kirim email (`nodemailer`) + Telegram.
- Batas hari bisnis: 23:30 WIB. Endpoint manual `POST /api/laporan/kirim-tutup-hari` (ADMIN).
- Kredensial SMTP/Telegram hanya di `.env` — jangan ditulis ke dokumen.

## Status repository & perubahan per 2026-09-26

Tiga repo, tidak ada lagi repo root terpisah. **Dokumentasi project (`AGENTS.md`,
`CONVERSATION_LOG.md`, `docs/`, `docker-compose.yml`) berada di repo frontend ini.**

| Repo | Isi | Remote |
|---|---|---|
| repo ini (frontend) | Dashboard React + dokumentasi project | `git@github.com:41zz-2807/v3netbill-frontend.git` |
| backend | API NestJS + Prisma | `git@github.com:41zz-2807/v3netbill-server.git` |
| agent | Agent Client Windows (.NET) | `git@github.com:41zz-2807/v3netbill-agent.git` |

Commit terakhir saat ini:
- **backend** `4826a4b` — ActivityLog (schema + migrasi `20260925163314` + modul + integrasi ke
  `app/session/settings/laporan`), pesan error topup spesifik (`REVOKED`/`EXPIRED`),
  deteksi-duplikat nama member, auto-deteksi IP PC, README baru. Sudah ter-push.
- **frontend** `ab43df0` — login JWT, 9 halaman, redesign card Uiverse, kolom IP otomatis.
  Plus dokumentasi yang digabung di commit berikutnya.
- **agent** `729a31f` — `HANDOFF.md` ke kondisi 1.0.9.0. Sudah ter-push (CI rebuild MSI).

> **Penting**: ada fallback JWT hardcoded di `backend/src/session/session.module.ts`
> (`'your-super-secret-jwt-key-change-in-production'`) — sudah ada sejak commit awal, **bukan**
> dari perubahan 26 Sep, dan sudah tercatat di daftar pending security hardening.

> **Tidak ada credential di repo ini.** Password DB, `JWT_SECRET`, SMTP, Telegram, `AgentToken`,
> dan PIN darurat hanya ada di `.env` (tidak di-commit) dan di registry PC. Password
> PostgreSQL ada di container `postgres-15`.

Semua perubahan terverifikasi: backend build 0 error TS, frontend build 0 error, lint 0 error.
