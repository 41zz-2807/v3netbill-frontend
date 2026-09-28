# v3Netbill — Log Kerja Historis

> ⚠️ **INI SNAPSHOT HISTORIS TANGGAL 26 Sep 2026 — BUKAN STATUS TERKINI.**
>
> Untuk aturan kerja, status fase, referensi API, dan daftar fitur yang benar-benar
> ada sekarang, baca **[`AGENTS.md`](./AGENTS.md)**. Kalau dokumen ini berbeda dengan
> AGENTS.md, **AGENTS.md yang benar**.
>
> Bagian di bawah tetap ditulis karena beberapa keputusan hanya bisa dipahami kalau
> tahu urutannya. Tapi jangan pakai bagian "Pending" di sini sebagai daftar kerja:
> isinya sudah usang. Contoh, `SecurityReportPage.tsx` dan `InformasiProdukPage.tsx`
> yang tercatat sebagai "Important Files" sudah **dihapus** pada 28 Sep.

**Project**: V3Netbill (Warnet Billing System)  
**Snapshot**: 2026-09-26  
**Working Directory**: `/home/warnet/docker/v3netbill`

---

## Stack Overview
- **Backend**: NestJS 12 (ESM, Node 20), PostgreSQL 15 via Prisma 5.22, Socket.IO
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Agent Client**: Windows .NET 8 (WPF + Windows Service + WiX v4 installer)
- **Infra**: Docker Compose, external PostgreSQL network, Cloudflare tunnel

---

## Completed Work (Chronological)

### 1. Dashboard Stat Cards Restyle (Yaya12085)
- `DashboardPage.tsx`: StatCard redesigned to Yaya12085 style
- Removed `$` icon and `%` badge per request
- Compact card: label left + big number right (1 row) + colored progress bar
- **Files**: `frontend/src/pages/DashboardPage.tsx`

### 2. Disconnect/Session Fix (Critical Bug)
- **Problem**: PC turned off by client → server timer didn't stop, session stayed alive
- **Fix**: `session.service.ts:handleDisconnect()` → immediate `stopSession(..., 'disconnect_timeout')` (removed `disconnectedAt` grace)
- Grace checker kept as safety net (10s interval)
- Verified: session stops <4s after agent socket disconnect, balance refunded (6000→5999)
- **Files**: `backend/src/session/session.service.ts`

### 3. PC Deletion Bug Fix
- **Problem**: FK restrict (P2003) when deleting PC with existing sessions
- **Fix**: `pc.service.ts:remove()` rejects with 400 if BERJALAN session exists; else transaction deletes sessions + PC
- Cleaned up 2 test PCs ("PC TEST DISCONNECT" `261d6bbd...`, `efb31f36...`); only PC001 remains
- **Files**: `backend/src/pc/pc.service.ts`

### 4. Laporan Page — Manual Simulation (Removed)
- Added "Tutup Hari" simulation button (read-only) with 3 recharts charts
- Per user request: removed manual button, moved to automated daily cron

### 5. Laporan Automation (Daily PDF + Email + Telegram)
**Backend**:
- New deps: `nodemailer`, `pdfkit`, `@types/nodemailer`, `@types/pdfkit`
- `ReportsService.laporanTutupHari()` → returns `tanggal = hariIniBaseUtc - 1 day`, aggregate, transactions
- `LaporanModule`: `laporan.service.ts`, `laporan.controller.ts`, `laporan.module.ts`
- Cron: `@Cron('30 23 * * *', { name: 'tutup-hari-laporan', timeZone: 'Asia/Jakarta' })` — verified next 2026-09-25T23:30:00+07:00
- `POST /api/laporan/kirim-tutup-hari` (ADMIN)

**PDF Layout Fixes (3 iterations)**:
1. Initial: clean layout but footer at mid-page
2. Second: `RangeError: Maximum call stack size exceeded` (pdfkit recursion via `pageAdded` + `height/ellipsis`)
3. Final: manual `addPage()` + explicit footer + single-line cells with measured width + `fit()` truncation

**Env Added** (`.env`, `docker-compose.yml`, `.env.example`) — NILAI ASLI TIDAK DITULIS DI SINI,
ambil dari `.env` project root bila dibutuhkan:
```
SMTP_HOST=<smtp host>
SMTP_PORT=587
SMTP_USER=<email pengirim>
SMTP_PASS=<isi dari .env>
SMTP_FROM_EMAIL=<email pengirim>
SMTP_FROM_NAME=Smart-Plus
SMTP_ENCRYPTION=tls
TELEGRAM_BOT_TOKEN=<isi dari .env>
TELEGRAM_CHAT_ID=<isi dari .env>
LAPORAN_EMAIL_TUJUAN=<isi dari .env>
```

**Frontend**:
- Recharts 3.10.1 installed (3 charts: Keuangan, Pemakaian PC, Voucher & Member)
- Removed manual simulation button/UI

**Verified**: Email OK (messageId), Telegram OK ("terkirim ke chat"), PDF `laporan-tutup-hari-2026-09-24.pdf`

**Files**: `backend/src/laporan/*`, `backend/src/reports/reports.service.ts`, `frontend/src/pages/ReportsPage.tsx`

### 6. Frontend Global Button Restyle (Uiverse)
- `frontend/index.html`: `data-ui-buttons="uiverse"` + CSS in `index.css`
- Rollback: remove attribute + CSS

### 7. Git Push (Backend Only)
- Init git in `/backend`, added remote `git@github.com:41zz-2807/v3netbill-server.git`
- `.gitignore`: excludes `.env`, `dist`, `frontend-dist`, `*.tsbuildinfo`, `*.mjs` (temp scripts)
- Commit: "feat: v3netbill backend (NestJS 12) — auth, pc, accounts, transactions, session, reports, settings, tutup hari report"
- Pushed to `main` branch (72 files)

### 8. Informasi Produk Page (`/info-produk`)
- Comprehensive documentation page: Tentang, Cara Pakai, Menu & Tools, Sisi Server (REST + WS + Cron), Sisi Client (Agent .NET), Aturan & Logika, Keamanan
- Matches Security Report style: header, sticky TOC, cards, tables, code blocks
- Removed "Kembali" button per request
- Removed button from Settings page

### 9. Security Audit Report Page (`/security-report`)
- Full HTML report with severity tables:
  - **6 Kritis**: CORS wildcard, JWT secret fallback, secrets in .env, pg_dump injection, no rate limiting, CORS default
  - **7 Sedang**: JWT expiry, refresh token, password policy, file upload validation, WS auth via query, agent token rotation, PIN rate limit
  - **5 Rendah**: deps vulnerable, Docker dev build, bind mount, Helmet missing, path traversal
  - **9 Sudah Baik**: bcrypt, class-validator, role guard, agentToken, voucher expiry, void window, soft-delete, backup retention
- Prioritized fix order (1-10)

### 10. Topup Error Message Improvement
- **Problem**: 400 "Account tidak aktif" for revoked/expired vouchers — unclear
- **Fix**: Specific messages per status:
  - REVOKED → `Voucher sudah direvoke (nonaktifkan) — tidak bisa di-topup`
  - EXPIRED → `Voucher sudah expired — tidak bisa di-topup`
  - Other non-ACTIVE → `Account tidak aktif`
- **Files**: `backend/src/accounts/accounts.service.ts:154-162`

### 11. Voucher/Member Actions Dropdown
- **Problem**: 4 buttons (Topup, Tarik, Password, Nonaktifkan) cluttered table row
- **Fix**: Single "Aksi ▼" dropdown menu with items; "Nonaktifkan" only shows for ACTIVE status, styled red (danger)
- **Files**: `frontend/src/pages/AccountsPage.tsx` (added `DropdownMenu` component)

### 12. Jejak Aktivitas (ActivityLog)
- Model `ActivityLog` + enum/timestamp, migrasi `20260925163314_add_activity_log`
- `backend/src/activity-log/` — service + controller: `GET /api/activity-log?limit&cursor` (paginate),
  `GET /api/activity-log/today`
- Dicatat dari `session.gateway.ts#broadcastActivityLog` untuk event `session:started`, `session:stopped`,
  `pc_locked`, `pc_unlocked`, `pc_shutdown`, `transaction:created`
- Cron `cleanup-activity-logs` tiap 02:00, retensi 30 hari
- **Files**: `backend/prisma/schema.prisma`, `backend/src/activity-log/*`, `backend/src/app.module.ts`

### 13. Redesign Card PC — Uiverse
- `DashboardPage.tsx`: kartu PC diganti total gaya Uiverse (bukan stat card lama)
- Mapping: baris = 1 PC; **judul** = `namaPc - ipClient`; **hero** = countdown sesi (atau status bila
  tidak ada sesi); **footer** = 2 item `Status / Tipe` (kolom IP & countdown duplikat dihapus)
- Aksi kanan atas: Start (hijau) / Kunci (kuning) / Matikan (merah), gradien; warning bila sisa ≤ 300 dtk
- `index.css`: class `.uui-card` ter-namespase, gradien status ACTIVE/IDLE/OFFLINE, grid responsif
  1/2/3/4 kolom, `max-width: 340px` (mobile 260px)
- **Masalah**: tombol global Uiverse (selector `html[data-ui-buttons="uiverse"] button`) menimpa
  gradien tombol card. **Fix**: selector global mengecualikan `.uui-card__act` (varian normal,
  `:hover`, `:disabled`)
- **Files**: `frontend/src/pages/DashboardPage.tsx`, `frontend/src/index.css`

### 14. Fix Atribusi Log — "PC001 dikunci oleh -"
- **Gejala**: jejak aktivitas menampilkan `by` kosong (dash) untuk aksi lock/shutdown
- **Akar masalah**: `client.data.username` tidak pernah diisi saat verifikasi JWT di handshake
- **Fix**: verifikasi JWT mengisi `client.data.username`; helper `actorName(client)` dipakai untuk
  event `session:started`, `pc_locked`, `pc_shutdown` (fallback ke role, lalu `unknown`)
- Payload `ActivityLog` sekarang membawa `by` (nama user) + `kasirId` (id user)
- Frontend memetakan `detail.by` ke `DashboardLog.by`; teks log session-started menampilkan aktor
- **Catatan**: log lama yang sudah tersimpan tidak dimigrasikan — tetap tampil `-`
- **Verifikasi**: e2e dengan PC dummy → `event=pc_lock by="admin"`, `kasirId` terisi
- **Files**: `backend/src/session/session.gateway.ts`, `frontend/src/pages/DashboardPage.tsx`

### 15. Auto-Deteksi IP PC (Opsi B) + Perbaikan Header Cloudflare
- **Latar belakang**: `ipClient` diisi manual admin, tidak aman terhadap DHCP
- **Keputusan user**: Opsi B — form PC tidak minta IP lagi, server ambil dari koneksi agent
- Investigasi: dipastikan `ipClient` **hanya data tampilan** — bukan identitas,
  bukan kunci unik, tidak dipakai routing/auth/lock. Identitas PC selalu `pcId` + `agentToken`
- **Perubahan backend**:
  - `dto/create-pc.dto.ts` — `ipClient` jadi opsional (`@IsOptional` + `@IsIP`)
  - `pc.service.ts` — `create()` memakai `ipClient ?? ''` (kolom tetap `NOT NULL`, tanpa migrasi)
  - `session.gateway.ts#alamatIp()` — bersihkan `::ffff:`, validasi `isIP()`
  - `session.service.ts#registerPc(pcId, ipTerlihat?)` — **hanya menulis IP kalau berubah**
  - log register: `(ip x.x.x.x)`
- **Perubahan frontend**: `PcPage.tsx` form tanpa input IP + kolom "IP (otomatis)" dengan
  `— belum connect` bila kosong; `api.ts` `createPc(namaPc)` tanpa argumen IP
- **Temuan penting (Cloudflare)**: PC001 ternyata DI LUAR jaringan Docker, koneksi lewat internet
  via **Cloudflare Tunnel**. `handshake.address` hanya memberi IP tunnel connector, bukan IP PC.
  Perbaikan: `alamatIp()` memakai urutan prioritas `cf-connecting-ip` → `x-real-ip` →
  `x-forwarded-for` (entri pertama) → `handshake.address`; plus `sumberIp()` untuk log header mana
  yang dipakai
- **Hasil verifikasi**: PC001 tercatat `180.178.96.34 via cf-connecting-ip` (IP publik asli).
  Jalur fallback (koneksi langsung tanpa header CF) → `127.0.0.1 via socket`
- **Batasan yang diketahui**: untuk PC di jaringan LAN yang konek ke `http://192.168.1.65:3000`,
  `docker-proxy` (userland proxy) aktif → backend selalu melihat `172.18.0.1`, sehingga **semua**
  PC LAN akan tercatat IP yang sama. Koneksi tetap normal, hanya kolom IP tidak informatif.
  Dua opsi perbaikan (agent kirim IP sendiri / matikan userland-proxy) **sengaja belum dikerjakan**
- **Files**: `backend/src/pc/*`, `backend/src/session/*`, `frontend/src/pages/PcPage.tsx`,
  `frontend/src/lib/api.ts`
- **Dokumentasi**: `docs/DETEKSI-IP.md`

### 16. Agent Reconnect — Seri Fix 1.0.6.0 → 1.0.9.0
- `1.0.6.0` (`de5b3c3`) — supervisor reconnect di `Worker.cs` supaya agent kembali online setelah
  backend restart
- `1.0.7.0` (`5b90c77`) — **single reconnect authority**: matikan `ReconnectionAttempts` library
  (anti flapping / dual reconnect)
- `1.0.8.0` (`213a03d`) — bug heartbeat mati permanen setelah reconnect (`StartHeartbeat ??=` tidak
  pernah membuat timer baru)
- `1.0.9.0` (`1f53432`) — heartbeat jadi self-diagnosing (log + hilangkan `async void`)
- `86a4b87` — catat alasan disconnect + tick heartbeat ke `agent.log` (bukan cuma Event Log)
- Semua sudah ter-push ke repo agent; CI hijau

### 17. Status Perubahan Belum Di-commit (per 2026-09-26)
- **Backend** (`git` — base commit `cf999ff`), 13 file dimodifikasi + 4 baru:
  - `prisma/schema.prisma` + `prisma/migrations/20260925163314_add_activity_log/` — model `ActivityLog`
  - `src/activity-log/` (module, service, controller) — fitur jejak aktivitas, **baru**
  - `src/app.module.ts`, `src/session/session.module.ts`, `src/settings/settings.module.ts`,
    `src/laporan/laporan.module.ts` — registrasi `ActivityLogModule`
  - `src/laporan/laporan.service.ts` — reset log aktivitas setelah tutup hari
  - `src/settings/settings.service.ts` — cron `cleanup-activity-logs` (retensi 30 hari)
  - `src/accounts/accounts.service.ts` — pesan error topup spesifik + deteksi-duplikat nama member
  - `src/pc/dto/create-pc.dto.ts`, `src/pc/pc.service.ts` — `ipClient` opsional
  - `src/session/session.gateway.ts`, `src/session/session.service.ts` — auto-deteksi IP + `by`/`kasirId`
  - `README.md` — ganti scaffold NestJS dengan dokumentasi nyata
- **Frontend**: **belum pernah di-commit** — tidak ada `.git` di `frontend/`. Berisi seluruh
  halaman, redesign card Uiverse, kolom IP otomatis, atribusi `by`.
- **Root project** (`AGENTS.md`, `CONVERSATION_LOG.md`, `docs/`): **tidak ada repo** — dokumentasi
  ini tidak ter-version control.
- **Agent**: sudah ter-push, `86a4b87` (v1.0.9.0). Yang tersisa uncommitted hanya `HANDOFF.md`.
- Semua perubahan sudah diverifikasi: backend build 0 error TS, frontend build 0 error,
  lint 0 error (12 warning lama).
- **Known issue (pre-existing, sudah ada di commit `cf999ff`)**: fallback JWT hardcoded di
  `src/session/session.module.ts`. Bukan dari perubahan ini — sudah ada di daftar pending
  security hardening.

---

## Key Technical Details

### Tutup Hari Boundary
- 23:30 WIB = 16:30 UTC
- Day T = [23:30 WIB T−1, 23:30 WIB T)
- Reports reset to 0 after cutoff
- Cron timezone: `Asia/Jakarta`

### Session Logic
- Server is time authority (tick 1s)
- Grace period from setting (default 180s)
- Stop reasons: `habis` (saldo→0), `manual`/`disconnect_timeout` (refund sisa waktu)
- PC restart/disconnect → session auto-stop + refund

### Voucher/Member Rules
- Nominal kelipatan 500
- Durasi = floor((nominal / harga_per_menit) * 60) detik
- Voucher password: 4 digit (crypto.randomInt, leading zero OK)
- Voucher: sekali pakai, habis → saldo 0; Member: topup allowed, refund on stop

### Environment
- All npm/npx/node run inside Docker: `docker compose exec v3netbill-backend|frontend <cmd>`
- Frontend build: `npm run build` (dist served by backend at `/app/frontend-dist`)
- Backend dev: `nest start --watch` (ts-node, hot reload)
- Typecheck: `npx tsc --noEmit -p tsconfig.json` (filter supertest error)

### Test Credentials
- Admin: `admin` / `admin123` (ADMIN)
- Kasir: `kasir` / `kasir1234` (KASIR)
- PC001 ID: `16edfa47-4c1a-4bb6-b4e5-5e9607e655bd`

---

## Pending / Next Steps (Not Done)

> ⚠️ **Daftar usang (snapshot 26 Sep).** Item 2–4 dan 6 sudah dikerjakan atau tidak
> berlaku lagi. Yang masih relevan hanya item 1 (hardening keamanan) dan item 5
> (IP PC untuk jaringan LAN). Daftar terkini ada di bagian Pending AGENTS.md.

1. **Security Hardening** (from audit):
   - Fix CORS (restrict origin)
   - Remove JWT secret fallback
   - Move secrets to Docker secrets/Vault
   - Fix pg_dump command injection
   - Add `@nestjs/throttler` rate limiting
   - Add JWT expiry + refresh token
   - Add Helmet security headers
   - Production Docker build (multi-stage, no bind mount)

2. **Agent Token Rotation** endpoint (`POST /api/pcs/:id/rotate-token`)

3. **File Upload Content Validation** (MIME/magic bytes)

4. **Dependency Audit Fix** (`npm audit fix --force`)

5. **IP PC untuk PC di jaringan LAN** — stumbled saat verifikasi Opsi B. Untuk PC yang konek
   langsung ke `http://192.168.1.65:3000`, backend selalu mencatat `172.18.0.1` karena
   `docker-proxy` (userland proxy) aktif. Dua opsi yang sudah dianalisis tapi **belum dikerjakan**
   (user memilih berhenti dulu, lanjut ke tahap design):
   - **Opsi A** — agent mengirim IP-nya sendiri di payload `agent:register` (backend sudah siap
     menerima, tinggal isi). Butuh build + deploy MSI baru ke semua PC klien.
   - **Opsi B** — matikan userland proxy lewat `/etc/docker/daemon.json`
     (`"userland-proxy": false`) supaya Docker pakai iptables DNAT murni dan IP sumber terjaga.
     Tidak perlu redeploy MSI, tapi restart Docker daemon mematikan semua container (termasuk
     Postgres dan sesi aktif) — sebaiknya hanya saat jam tutup.
   - Detail & tradeoff: `docs/DETEKSI-IP.md`

6. ~~**Commit backend & frontend**~~ — **SELESAI 26 Sep**, sudah di-commit & ter-push ke GitHub.
   Lihat bagian "Sesi 26 Sep — Commit, Push & Audit Keamanan" di bawah.

---

## Important Files Reference

| Feature | Files |
|---------|-------|
| Dashboard | `frontend/src/pages/DashboardPage.tsx` |
| Session/Disconnect | `backend/src/session/session.service.ts`, `session.gateway.ts` |
| PC Management | `backend/src/pc/pc.service.ts`, `pc.controller.ts` |
| Accounts/Voucher | `backend/src/accounts/accounts.service.ts`, `accounts.controller.ts` |
| Reports/Laporan | `backend/src/reports/reports.service.ts`, `laporan/laporan.service.ts`, `laporan.controller.ts` |
| Settings | `backend/src/settings/settings.service.ts`, `settings.controller.ts` |
| Activity Log | `backend/src/activity-log/activity-log.service.ts`, `activity-log.controller.ts` |
| Auth | `backend/src/auth/auth.service.ts`, `jwt.strategy.ts`, `dto/login.dto.ts` |
| Prisma schema | `backend/prisma/schema.prisma`, `backend/prisma/seed.ts` |
| Frontend Pages | `frontend/src/pages/*.tsx` |
| Frontend API/Types | `frontend/src/lib/api.ts`, `types.ts` |
| Frontend Auth | `frontend/src/context/AuthContext.tsx` |
| Docker/Env | `docker-compose.yml`, `backend/Dockerfile`, `.env`, `.env.example` |
| Agent Service | `v3NetbillAgent/Agent.Service/Worker.cs` |
| Agent Overlay | `v3NetbillAgent/Agent.Overlay/MainWindow.xaml(.cs)`, `PipeClient.cs` |
| Agent Installer | `v3NetbillAgent/Installer/Product.wxs` |
| Topologi | `docs/DEPLOYMENT.md` |
| Deteksi IP | `docs/DETEKSI-IP.md` |

---

## How to Resume

1. Start containers:
   ```bash
   cd /home/warnet/docker/v3netbill
   docker compose up -d
   ```

2. Check logs:
   ```bash
   docker compose logs v3netbill-backend -f
   docker compose logs v3netbill-frontend -f
   ```

3. Run typecheck:
   ```bash
   docker compose exec -T v3netbill-backend npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v supertest
   ```

4. Build frontend:
   ```bash
   docker compose exec -T v3netbill-frontend npm run build
   ```

5. Access:
   - Dev: http://localhost:5173 (Vite HMR)
   - Prod: http://localhost:3000 (backend serves frontend-dist)

6. Admin login: `admin` / `admin123`

---

## Agent Client (Separate Repo)
- Path: `/home/warnet/docker/v3netbill/v3NetbillAgent`
- Has own GitHub repo with CI/CD (GitHub Actions)
- Installer MSI built via WiX v4
- Versi agent saat ini: **1.0.9.0** (commit `86a4b87`)
- Emergency PIN: nilai default ada di `Installer/Product.wxs` / `Agent.Overlay` — ambil dari sana
  bila perlu, jangan disalin ke dokumen teks
- See `v3NetbillAgent/README.md` and `HANDOFF.md` for details

---

## Sesi 26 Sep (sesi terakhir) — Commit, Push & Audit Keamanan

Ringkasan sesi ini: verifikasi semua 10 commit ter-push ke GitHub, percobaan membuat MSI baru,
audit keamanan repo public, dan pembahasan .apk Android (hold, belum dikerjakan).

### 1. Push 10 commit (frontend 8 + backend 2)

Semua perubahan UI yang dibuat sesi-sesi sebelumnya **ternyata sudah ter-commit** tapi belum
ter-push. Setelah user konfirmasi, keduanya dipush:

```
frontend  d3d937b..a2c2b35   8 commit
backend   4826a4b..59bf2b4   2 commit
agent     (tidak ada perubahan)
```

Verifikasi: ketiga repo `0/0` behind/ahead. File yang sebelumnya tidak tracked
(`usePagination.ts`, `gradientCardStyles.ts`, `dto/create-user.dto.ts`) sudah terkonfirmasi ada
di GitHub via raw.githubusercontent.

### 2. Upaya build MSI baru — TERHENTI (butuh token)

User minta "buat msi baru, simpan ke installer". Hasil investigasi:

- **Tidak bisa build di host Linux.** `Agent.Overlay` pakai `UseWPF=true` dengan target
  `net8.0-windows` → WPF tidak bisa dikompilasi di Linux sama sekali. Tidak ada dotnet SDK
  di host juga.
- **Harus lewat GitHub Actions** (`runs-on: windows-latest`).
- **CI sebenarnya sudah sukses** — run #40 (`fd62335`, success), artifact
  `v3NetbillAgentSetup` 61.1 MB, `expired=False`. Jadi MSI baru **sudah ada**.
- **Gagal di-download**: endpoint artifact selalu butuh autentikasi. Coba tanpa token → HTTP 404.
  `gh` tidak terinstall, tidak ada `GITHUB_TOKEN` di env, tidak ada `~/.netrc`/`~/.git-credentials`.
- Pola token GitHub ditemukan di `/tmp/opencode/dl4.sh` (skrip sesi sebelumnya), **sengaja tidak
  diambil** — menambang kredensial tanpa izin eksplisit. User lalu bilang hold.

**Status**: tombol "Unduh Installer" masih menunjuk MSI lama (build 24 Sep) yang normal dipakai
→ tidak mendesak.

### 3. Audit keamanan — TEMUAN PENTING

Kesalahan umum user: "sudah di-push jadi aman". Salah. Push ke repo **public** justru berarti
isi bisa dibaca siapa saja. Scan dilakukan terhadap isi repo publik via GitHub API.

**Yang AMAN (tidak ada credential asli):**
- `.env.example` pakai `<password>` placeholder
- `docker-compose.yml` pakai `${JWT_SECRET}`, `${TELEGRAM_BOT_TOKEN}`
- Password DB, `JWT_SECRET`, SMTP, Telegram, `AgentToken`, PIN → hanya di `.env` (tidak di-commit)

**⚠️ Yang BERMASALAH:**

1. **Fallback JWT hardcoded — di 3 file, bukan 1.** Catatan lama hanya menyebut
   `session.module.ts`. Fact-check menemukan ketiganya:
   - `backend/src/auth/auth.module.ts:14`
   - `backend/src/auth/jwt.strategy.ts:13`
   - `backend/src/session/session.module.ts:13`

   Semuanya `process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'`.
   Karena repo backend **public**, string ini terbaca. Kalau `JWT_SECRET` kosong → JWT bisa
   dipalsukan siapa saja yang bisa internet → login sebagai admin. **Prioritas tinggi.**

2. **Peta infrastruktur publik** — `docs/DEPLOYMENT.md` + `docs/DETEKSI-IP.md` membocorkan
   IP LAN host, port `3000` yang terbuka langsung ke LAN, nama container `postgres-15`, dan
   topologi Cloudflare Tunnel. Tidak berbahaya di jaringan privat, tapi membantu attacker.

3. **Ketiga repo public** — dikonfirmasi via API. GitHub free tier hanya 1 private repo.

### 4. Pembahasan .apk Android — HOLD, belum dikerjakan

User tanya apakah frontend bisa jadi .apk. **Dipabei hanya frontend** (bukan backend/MSI).
Rencana/teknologi untuk .apk hanya didokumentasikan, **tidak ada perubahan kode**:

- Rekomendasi: **Capacitor** (`@capacitor/core` + `@capacitor/android`), karena frontend
  sudah SPA Vite — paling ringan.
- Alur: `npx cap init` → `npx cap add android` → `npx cap sync` → `./gradlew assembleDebug`.
- Backend tetap di Docker; .apk cuma WebView yang memanggil API. Butuh `baseUrl` manual
  (atau `10.0.2.2` untuk emulator yang merujuk ke host).
- Alternatif paling murah: kasih link browser saja (sudah ada lewat Cloudflare Tunnel).

**Status**: opsional, user memutuskan cukupani dulu. Tidak ada file yang diubah.

### 5. GitHub → Gitea (deferred)

**Rencana user**: GitHub free hanya 1 repo private. Rencana pindah ke **self-hosted Gitea**.
Belum ada yang dikerjakan — hanya keputusan. Diskusi capability Gitea: bisa menyimpan
`.msi` sebagai release asset, tapi **tidak bisa membuat MSI** (Git service, bukan build
server) — tetap perlu CI.

---

## Dokumentasi Referensi

| File | Isi |
|------|-----|
| `AGENTS.md` | Aturan kerja untuk AI agent, skema DB, status fase, catatan per fase |
| `backend/README.md` | Arsitektur backend, daftar endpoint, WS event, cron, migrasi |
| `frontend/README.md` | Halaman & routing, auth, proxy Vite, konvensi CSS Uiverse |
| `v3NetbillAgent/README.md` | Arsitektur agent, protokol Socket.IO, named pipe, deploy |
| `v3NetbillAgent/HANDOFF.md` | Status terkini agent untuk sesi berikutnya |
| `docs/DEPLOYMENT.md` | Topologi jaringan, Docker, Cloudflare Tunnel, backup/restore |
| `docs/DETEKSI-IP.md` | Kenapa & bagaimana IP PC dideteksi, batasan topologinya |
| `CONVERSATION_LOG.md` | Log kerja kronologis + status perubahan belum di-commit |