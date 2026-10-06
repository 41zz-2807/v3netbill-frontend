# AGENTS.md — v3Netbill (Warnet Billing System)

Panduan untuk AI agent (opencode) mengerjakan project ini. Baca penuh sebelum mulai.

## Dokumen mana yang dibaca

| Dokumen | Isi | Status |
|---|---|---|
| **`AGENTS.md`** (file ini) | **Sumber kebenaran utama**: aturan, status fase, referensi API terverifikasi, pelajaran proses | **selalu** |
| `docs/DEPLOYMENT.md` | Topologi, port, Cloudflare Tunnel, backup/restore, data persisten |-current |
| `docs/DETEKSI-IP.md` | Analisis mendalam deteksi IP PC (versi panjang dari ringkasan di bawah) | current |
| `CONVERSATION_LOG.md` | Log kerja **historis** per 26 Sep | ⚠️ snapshot, jangan dipakai sebagai status |
| `README.md` (repo ini) | Halaman & routing frontend | current |
| `README.md` (repo backend) | Ringkasan endpoint per modul | current |
| `README.md` + `HANDOFF.md` (repo agent) | Arsitektur agent, build MSI, deploy | current |
| `README.md` (repo mobile) | Fitur aplikasi Android, build APK | current |

Kalau dua dokumen berbeda, **AGENTS.md yang benar**. Dokumentasi yang sudah usang
lebih berbahaya daripada tidak ada, jadi jangan menambah dokumen baru tanpa
memeriksa ulang isi dokumen yang sudah ada.

## Konteks singkat

v3Netbill adalah sistem billing warnet yang dibangun ulang TOTAl dari `v2netbill` (hasil develop
sebelumnya, dishare dari `/tmp/opencode/v2netbill-ref/`). Backend = NestJS 12 (ESM), Frontend =
React + TS + Vite + Tailwind, Mobile = Flutter Android, Agent PC = .NET WPF. SEMUA development
harus berjalan di dalam Docker — JANGAN pernah jalankan npm/npx/node/psql/flutter/dotnet di host.

Project ini sekarang **4 repo terpisah** (semua public, semua punya git sendiri):
backend, frontend (berisi dokumentasi project), agent, mobile. **Semuanya sudah berada
dalam satu folder project** di `/home/warnet/docker/v3netbill/`. Lihat bagian
"Status repository" untuk checkout masing-masing.

Selain repo, ada dua skrip pembantu di root project: `dk` (dart) dan `fl` (flutter),
keduanya menjalankan perintah di dalam container Flutter SDK.

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
- **Data Docker sekarang di `/dev/sda3`** (28 Sep 2026). `/var/lib/docker` dan
  `/var/lib/containerd` di-bind mount ke `/home/warnet/docker-data/`. Semua build,
  image, volume, dan container otomatis kesana — tidak perlu set apa pun per project.
  Rollback: `/home/warnet/docker-migration-backup/ROLLBACK.md`.
- **`postgres-15` punya compose sendiri** di `/home/warnet/docker/war-nt-web/`
  (`.env` + `docker-compose.yml`). File ini hilang di tengah jalan lalu dibuat ulang
  dari `docker inspect`. ⚠️ **Jangan pernah `docker compose down -v` di sana** —
  volume `war-nt-web_postgres_data` adalah satu-satunya salinan DB `v3netbill`,
  `dashboard`, dan `yearlybook_db`.
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
- `LOG_BILLING_DIR=/data/logs` (opsional, default-nya itu juga; lihat bagian "Log billing berkas")

## Akses test yang sudah dibuat

- ~~Admin: `admin` / `admin123`~~ — **TIDAK ADA LAGI.** Akun `admin` sudah hilang
  (login balas 401). Akun ADMIN yang sekarang bernama **`aziz`**; passwordnya
  **sengaja tidak ditulis di dokumen ini** (repo publik). User yang ada per 4 Okt:
  `aziz` (ADMIN), `kasir` (KASIR), `kasir2` (KASIR).
- Kasir: `kasir` / `kasir1234` (Role KASIR)

## Skema DB (8 model)

`User`, `Pc`, `Account`, `Session`, `Transaction`, `DailyReport`, `Setting`, `ActivityLog`.
Enum: `Role`(ADMIN,KASIR), `PcStatus`(IDLE,ACTIVE,OFFLINE), `AccountType`(VOUCHER,MEMBER),
`AccountStatus`(ACTIVE,REVOKED,EXPIRED), `SessionStatus`(BERJALAN,SELESAI,DISTOP),
`TransactionType`(BELI_BARU,TOPUP).

Logika bisnis yang sudah berjalan:
- **Password semua akun baru = `0000`, tidak acak lagi.** Konstantanya `PASSWORD_DEFAULT` di
  `backend/src/accounts/password.ts`; `generatePassword()` yang dulu membuat 4 digit acak **sudah
  dihapus**. Field `password` dihapus dari `CreateMemberDto` (voucher memang tidak pernah punya).
  ⚠️ Field `password` yang masih dikirim APK/versi web **lama sengaja diabaikan, bukan ditolak**,
  supaya klien lama tidak ikut rusak. Ganti password sendiri: `PATCH /accounts/:id/password`
  (butuh password lama) atau dari layar PC lewat event agent `client:create_password`.
  ⚠️ Event agent itu **mewajibkan `passwordLama`** dan mencocokkannya dengan bcrypt di
  `SessionService.setPasswordByKode()` — dulu versinya tidak memverifikasi sama sekali, dan itu
  berarti siapa pun yang duduk di komputer itu bisa mengganti password akun orang lain.
  Halaman web tetap seperti semula: `PATCH /accounts/:id/password` **tidak** minta password lama,
  karena yang mengganti adalah operator warnet, bukan pelanggan.
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
- ⚠️ **`Pc.status` di database BOLEH berisi `OFFLINE`** — pernyataan lama di dokumen ini
  ("TIDAK PERNAH") sudah salah. `SessionService.checkPcOffline()` tiap 10 detik
  menuliskannya ke DB lalu broadcast, karena `broadcastPcUpdate()` sebelumnya hanya
  jalan saat register/start/stop. Kolom itu karena itu **cache**, bukan sumber
  kebenaran; sumber kebenaran ada dua: `lastHeartbeatAt` (satu-satunya bukti agent
  masih hidup) dan `Session` berstatus `BERJALAN`.
  Status yang dikirim ke dashboard & mobile dihitung `statusPcDitampilkan()` di
  `backend/src/pc/pc-status.ts`: heartbeat basi → `OFFLINE`; heartbeat segar +
  ada sesi berjalan → `ACTIVE`; selain itu baru nilai kolom. Dipakai bersama oleh
  `GET /api/pcs` (mobile) dan `getDashboardData()` (dashboard web).
  `lastHeartbeatAt: null` juga berarti OFFLINE, bukan IDLE. Ambang **30 detik** mengikuti
  `HEARTBEAT_INTERVAL_DETIK = 15` di agent (`Agent.Core/ServerConnection.cs:31`).
  - 🔴 **Kalau `Pc.status` boleh ditulis OFFLINE, maka WAJIB ada yang memulihkannya.**
    Bug 4 Okt: `heartbeat()` hanya memperbarui `lastHeartbeatAt`, jadi heartbeat yang
    tertinggal satu kali (>30 detik) **tanpa memutus socket** meninggalkan kolom
    `OFFLINE` sampai agent reconnect — dan `statusPcEfektif()` yang dulu
    mengembalikan nilai kolom apa adanya ikut memekatkan. Gejalanya di dashboard:
    hitung mundur hilang, label "TIDAK ADA SESI", tombol **Start** muncul (bukan
    Kunci) di PC yang sedang tersesi, dan Start itu selalu ditolak "PC sudah memiliki
    sesi berjalan". Tempel PC client tetap jalan karena `session:tick` tidak bergantung
    pada status PC — itu sebabnya gejalanya tampak kontradiktif.
    Dua perbaikan, keduanya wajib: `heartbeat()` menulis `ACTIVE`/`IDLE` lagi, dan
    `getDashboardData()`/`findAll()` memakai `statusPcDitampilkan()`. Tes regresi:
    `backend/test/pc-status.spec.ts` (11 kasus) — sudah dibuktikan **gagal** kalau
    logikanya dikembalikan ke versi lama.
  - 🔴 **Dan jebakan kedua yang langsung saya buat sendiri di fix yang sama:**
    `sessionByPc.get(pc.id) !== null` selalu bernilai **true** untuk PC tanpa sesi,
    karena `Map.get()` mengembalikan `undefined` dan `undefined !== null`. Akibatnya
    **setiap PC idle tampil "Aktif"** — dan `session` di payload tetap `null`, jadi
    gejalanya terlihat sangat tidak masuk akal. Yang benar `sessionByPc.has(pc.id)`.
    ⚠️ Unit test fungsi murni **tidak akan** menangkap ini, karena parameternya
    sudah berupa boolean; yang perlu dijaga adalah bentuk pemanggilan di call site.
    Tes yang benar-benar memegangnya ada di `test/pc-status.spec.ts` ("pola
    pemanggilan di getDashboardData()"). Verifikasi wajib: bandingkan `status` di
    payload `dashboard:pc_update` **dengan nilai kolom di database pada saat yang
    sama** — `GET /api/pcs` saja tidak cukup, karena dua jalur itu punya call site
    berbeda.

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
- FASE 8 ✅ Mobile Flutter Android (repo terpisah `v3netbill-mobile`) + distribusi APK lewat
  Settings web. Detail: bagian "FASE 8 — Mobile app" di bawah.

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
- Login JWT + AuthContext (**sessionStorage** token/role/username); interceptor 401 → redirect login.

## Testing (pola yang dipakai)

- REST: `curl` dari host ke `http://localhost:3000` (boleh dari host; tidak ada npm/node).
- WebSocket: buat file `.mjs` sementara, `docker cp` ke container → `node /app/x.mjs`
  memakai `socket.io-client` (sudah devDep) + `PrismaClient` untuk inspeksi DB.
  Hapus file test dari ./backend & container setelah selesai.
- Selalu cek `docker compose logs v3netbill-backend` untuk 0 error.
- Mobile (Flutter): tidak ada Flutter di host, jadi selalu lewat skrip di root project:
  ```
  cd /home/warnet/docker/v3netbill
  ./fl analyze            # statis
  ./fl test               # 21 test
  ./fl build apk --release --dart-define=API_BASE_URL=https://v3netbill.bilmary.my.id/api \
                                --dart-define=API_WS_URL=wss://v3netbill.bilmary.my.id/session
  ./dk format lib test    # dart biasa
  ```
  `--dart-define` dua-duanya **wajib** saat build, kalau tidak build memakai default yang
  kebetulan sama dengan produksi. Kalau build APK untuk produksi, lebih baik ambil dari
  artifact CI (lihat bagian FASE 8) daripada build lokal.
- Mobile (data nyata): dump jawaban API ke fixture JSON lalu pakai di widget test.
  `test/fixture_accounts.json` berisi 97 akun asli dari server; ini yang duluan
  terbukti menangkap bug `LocaleDataException`.

## Catatan migrasi

- Perintah migrasi: `docker compose exec v3netbill-backend npx prisma migrate dev --name <nama>`
- Migrasi applied (8): `20260922142242_init`, `20260925072311_add_transaction_koreksi`,
  `20260925072645_add_transaction_void`, `20260925163314_add_activity_log`,
  `20260930100153_add_perangkat_notifikasi`, `20261005083648_pc_rusak`,
  `20261005095854_pc_terakhir_aktif`, `20261005161709_uptime_pc`.

## Referensi API — diverifikasi dari kode

Dihasilkan dengan membaca decorator di `backend/src/**/*.controller.ts` (28 Sep 2026).
**Kalau kamu mengubah endpoint, perbarui tabel ini di commit yang sama.** Tabel README
di repo backend pernah kedaluwarsa dan menuliskan password voucher acak yang sudah
dihapus — itu lebih berbahaya daripada tidak ada dokumentasi.

Semua path diawali `/api` (global prefix di `main.ts`). WebSocket namespace `/session`.

### Modul backend

| Modul | Path | Fungsi |
|---|---|---|
| `auth` | `src/auth/` | Login JWT, user operator (tambah/list/hapus) |
| `pc` | `src/pc/` | CRUD PC, generate `agentToken`, unlock manual |
| `accounts` | `src/accounts/` | Voucher & member: beli, topup, koreksi, void, password, revoke |
| `transactions` | `src/transactions/` | Riwayat transaksi |
| `session` | `src/session/` | **Inti sistem** — gateway WebSocket + logika sesi real-time |
| `reports` | `src/reports/` | Rekap harian & rentang (dihitung ulang on-read) |
| `laporan` | `src/laporan/` | Laporan tutup hari: PDF + email + Telegram (cron) |
| `settings` | `src/settings/` | Tarif, password, upload, backup, PIN uninstall & bypass |
| `activity-log` | `src/activity-log/` | Jejak aktivitas (paginate + today) |
| `notifikasi` | `src/notifikasi/` | Token perangkat + push FCM saat pelanggan login |
| `log-billing` | `src/log-billing/` | Log aktivitas billing harian sebagai berkas teks |
| `common` | `src/common/` | Guards, decorators, exception filter |
| `prisma` | `src/prisma/` | `PrismaService` (module global) |

### REST

Kolom role: `ADMIN` = wajib admin. `—` = cukup JWT apa pun. `PUBLIC` = `@Public()`,
tanpa JWT sama sekali.

| Method | Path | Role |
|---|---|---|
| POST | `/api/auth/login` | **PUBLIC** |
| POST | `/api/auth/users` | ADMIN |
| GET | `/api/auth/users` | ADMIN |
| DELETE | `/api/auth/users/:id` | ADMIN |
| GET | `/api/pcs` | — |
| GET | `/api/pcs/ringkas` | **PUBLIC** (lihat catatan di bawah) |
| POST | `/api/pcs` | — |
| PATCH | `/api/pcs/:id/nama` | ADMIN |
| PATCH | `/api/pcs/:id/rusak` | ADMIN |
| DELETE | `/api/pcs/:id` | ADMIN |
| POST | `/api/pcs/:id/unlock` | ADMIN |
| GET | `/api/accounts` | — |
| POST | `/api/accounts/voucher` | — |
| POST | `/api/accounts/member` | — |
| POST | `/api/accounts/:id/topup` | — |
| POST | `/api/accounts/:id/koreksi` | — |
| POST | `/api/accounts/:id/batal-transaksi` | — |
| PATCH | `/api/accounts/:id/password` | — |
| POST | `/api/accounts/:id/revoke` | — |
| GET | `/api/transactions` | — |
| GET | `/api/reports/today` | — |
| GET | `/api/reports/daily?dari&sampai` | — |
| GET | `/api/reports/range?dari&sampai` | — |
| GET | `/api/reports/uptime?dari&sampai` | — |
| POST | `/api/laporan/kirim-tutup-hari` | — |
| POST | `/api/notifikasi/token` | — |
| DELETE | `/api/notifikasi/token` | — |
| GET | `/api/settings` | — |
| PATCH | `/api/settings` | ADMIN |
| PATCH | `/api/settings/password` | — |
| POST | `/api/settings/installer` | ADMIN |
| GET | `/api/settings/installer/info` | — |
| GET | `/api/settings/installer` | — |
| POST | `/api/settings/apk` | ADMIN |
| GET | `/api/settings/apk/info` | — |
| GET | `/api/settings/apk` | — |
| POST | `/api/settings/wallpaper` | ADMIN |
| GET | `/api/settings/wallpaper` | **PUBLIC** |
| POST | `/api/settings/backup` | ADMIN |
| GET | `/api/settings/backup/last` | ADMIN |
| GET | `/api/settings/backup/list` | ADMIN |
| GET | `/api/settings/backup/download` | ADMIN |
| PATCH | `/api/settings/pin-uninstall` | ADMIN |
| PATCH | `/api/settings/bypass-pin` | ADMIN |
| POST | `/api/settings/verify-pin` | **PUBLIC** |
| GET | `/api/log-billing` | ADMIN |
| GET | `/api/log-billing/:tanggal?cari=` | ADMIN |
| GET | `/api/log-billing/:tanggal/unduh` | ADMIN |
| POST | `/api/diagnosa` | **PUBLIC** |
| GET | `/api/diagnosa` | ADMIN |
| GET | `/api/diagnosa/:nama` | ADMIN |

Empat endpoint `PUBLIC` punya alasan spesifik, jangan diubah tanpa paham dulu:

- `auth/login` — memang pintu masuk.
- `settings/verify-pin` — dipakai `.bat` uninstall & `UninstallGuardWindow` yang
  **tidak punya JWT**. Identitas PC (`pcId` + `agentToken`) yang dipakai, bukan akun.
- `settings/wallpaper` — layar lock agent mengambil wallpaper tanpa punya JWT.
- `diagnosa` — agent Windows mengirim paket log sendiri tanpa JWT. Identitasnya
  `pcId` + `agentToken`, sama seperti `verify-pin`. Paket yang diterima **tidak
  pernah bisa diakses tanpa JWT**: daftar & unduh hanya ADMIN.
- `pcs/ringkas` — dipakai **halaman login** untuk menampilkan daftar PC dan
  sisa waktu. Halaman login tampil **sebelum** operator login, jadi tidak ada
  JWT-nya sama sekali.

### 🔴 `GET /api/pcs/ringkas` — JANGAN PERNAH mengganti dengan `GET /api/pcs`

`GET /api/pcs` mengembalikan `{ ...pc }`, jadi **`agentToken` ikut terbawa**.
Token itu cukup untuk menjalankan `client:create_password` (mengganti password
akun orang) dan `client:stop_session` (menghentikan sesi). Kalau endpoint itu
dibuat publik, **siapa pun di internet bisa mengambil semua token agent**.

`pcs/ringkas` sengaja dibuat terpisah dan hanya mengirim empat field:

```json
{ "namaPc": "PC003", "status": "ACTIVE", "tipe": "MEMBER", "sisaDetik": 5964 }
```

Yang **tidak** dikirim dan tidak boleh ditambah: `id`, `agentToken`,
`ipClient`, `lastHeartbeatAt`, nama member, dan kode voucher. Nama member itu
**kredensial login**-nya, dan halaman login terlihat siapa pun sebelum masuk.

Sisa waktu dihitung persis seperti `getDashboardData()` — dari
`Account.sisaWaktuDetik` dikurangi selisih waktu — jadi angkanya tidak mungkin
berbeda dengan kartu PC di dashboard.

### 🔴 Flag "PC rusak" — bukan arti PC ini benar-benar rusak

Kolom `Pc.rusak` + `Pc.alasanRusak` (migrasi `20261005083648_pc_rusak`). Ini flag
**operasional**: PC sedang diservis atau sengaja dikosongkan. Yang dijamin hanya
dua — PC itu tidak bisa dipakai, dan tidak muncul di halaman mana pun kecuali
Halaman PC.

⚠️ **Jangan pernah menyaring laporan dengan flag ini.** Rekap dihitung dari
`Transaction`/`Session`, jadi PC yang ditandai tetap masuk laporan.

Tiga titik baca yang menutup dashboard, login, dan mobile sekaligus:

| Fungsi | Menutup |
|---|---|
| `PcService.ringkas()` | Halaman Login (publik) |
| `PcService.findAll()` tanpa param | Mobile `GET /api/pcs` |
| `SessionService.getDashboardData()` | Dashboard web + Mobile (WS) |

⚠️ **Halaman PC ikut memakai `findAll()`, jadi jangan disaring di sana** — kalau
begitu flag-nya tidak punya tempat untuk dibatalkan. Karena itu `findAll()` punya
argumen `termasukRusak`, dan `?termasukRusak=true` **hanya diterima ADMIN**
(dicek di body controller, bukan `@Roles()`, karena kasir tetap boleh membaca
daftar PC biasa).

⚠️ **Penjaga sesi HARUS di `createSessionAndStart()`, bukan di tiap pemanggil.**
Tiga cara mulai sesi — `loginRequest`, `startFromDashboard`,
`createVoucherAndStart` — semuanya lewat fungsi itu, jadi satu titik menutup
semuanya termasuk percobaan login langsung dari layar PC yang tidak bisa dicegah
dari frontend. Dan pengecekan `pc.rusak` **wajib di atas** penulisan
`lastUsedAt`, kalau tidak voucher pelanggan ikut terpakai tanpa sesi jalan.

⚠️ **Urutan di `setRusak()` bukan gaya penulisan.** Sesi dihentikan → layar
dikunci → flag ditulis → broadcast. Kalau flag ditulis dulu, ada celah PC sudah
disingkirkan dari dashboard tapi sesinya masih jalan, jadi kasir tidak pernah
melihat sesi itu.

⚠️ **`remove()` menolak PC yang ditandai dengan 409.** Menghapus PC menghapus
sesinya dengan `deleteMany`, jadi seluruh riwayat transaksinya hilang permanen.
PC rusak justru PC yang paling mungkin perlu ditelusuri ulang. Penolakan ditegakkan
di server; `disabled` di frontend cuma biar kasir tidak salah klik.

Tes: `backend/test/pc-rusak.spec.ts` (8) + `test/pc-rusak-service.spec.ts` (10).

### 🔴 Auto-matikan PC setelah menganggur (5 Okt) ✅

Kolom `Pc.terakhirAktifAt` (migrasi `20261005095854_pc_terakhir_aktif`) +
Setting `auto_shutdown_menit` (default 5, `0` = mati, diubah dari
**Pengaturan → Tarif**). PC yang idle selama N menit dimatikan otomatis dengan
event `admin:shutdown` yang **sudah ada** di agent — tanpa perlu rebuild MSI.

Perilaku yang sudah disepakati, dan ketiganya wajib dijaga:

| Keadaan | Yang terjadi |
|---|---|
| PC dinyalakan tapi belum pernah dipakai | **ikut dimatikan** setelah N menit menganggur |
| Sesi baru dimulai | hitungan mulai ulang dari 0 |
| Kasir menekan Buka Kunci | hitungan diundur dari sekarang |
| PC ditandai `rusak` | dilewati, tidak dimatikan |

⚠️ **Timer di-update di TIGA tempat saja**: `registerPc()` (boot/reconnect),
`stopSession()` (sesi berakhir), `unlockPc()`. Dan di-set `null` di
`createSessionAndStart()`.

⚠️ **JANGAN pernah meng-update `terakhirAktifAt` dari `heartbeat()`.** Heartbeat
datang tiap 15 detik — kalau timer ikut di-reset di sana, hitung mundur tidak
pernah mencapai nol dan PC tidak pernah mati. Ini jebakan yang paling mudah
terjadi karena `heartbeat()` terlihat seperti tempat yang "tepat" untuk menyalakan
timer.

⚠️ **Urutan pengaman di `checkAutoShutdown()` jangan diubah.** Semuanya wajib,
dan yang paling penting adalah cek sesi berjalan:

```
setting 0                  -> lewati
rusak = true               -> lewati
ada Session BERJALAN       -> lewati   ← PC pelanggan tidak boleh mati
agent tidak tersambung     -> lewati, timer TIDAK disenapkan
kirim admin:shutdown, catat log, set terakhirAktifAt = null
```

⚠️ **Kalau agent offline, timer HARUS dibiarkan menyala.** Kalau tetap diset
`null` "karena sudah dikirim", PC itu menggantung menyala **selamanya** — tidak
ada perintah kedua yang akan dikirim. Ini sebabnya `matikanPcOtomatis()` di
gateway mengembalikan `boolean`, bukan `void`.

⚠️ **Setting dibaca ulang tiap 10 detik, tidak di-cache**, supaya admin bisa
menyetel `0` untuk mematikan fitur dengan segera. Tapi `NaN`/`negatif` selalu
jatuh ke default 5 — kalau tidak, `NaN` membuat semua PC langsung dianggap sudah
terlalu lama dan **seluruh PC mati bersamaan**. Warning-nya hanya dicetak sekali
per nilai berbeda, kalau tidak satu baris rusak akan inundated log tiap 10 detik.

Tes: `backend/test/auto-shutdown.spec.ts` (13 kasus). **Tiga pengaman sudah
dibuktikan menangkap bug** — masing-masing dimatikan sementara di kode, dan
tesnya gagal tepat di pengaman itu.

### 🔴 Timer auto-matikan bisa jadi `null` dan tidak pernah pulih (6 Okt)

`Pc.terakhirAktifAt` **boleh bernilai `null`**, dan itu bukan hanya kasus "PC
baru" — semua PC lama juga null begitu migrasi `pc_terakhir_aktif` pertama kali
dijalankan. Null ini berarti "belum ada bukti pakai", tapi `checkAutoShutdown()`
dalam bentuk lama **berhentisentuh PC itu sama sekali**: tidak ada timer, tidak ada
hitung mundur, tidak pernah dimatikan.

Jadi fitur auto-matikan terlihat bekerja di PC yang kebetulan dipakai pelanggan
setelah migrasi, dan **tidak pernah bekerja sama sekali** di PC yang belum
dipakai — persis kebalikan dari yang dimasukkan.

Perbaikannya satu metode, dipanggil tiap 10 detik oleh checker yang sama:

```
senyapkanTimerPCKosong() -> updateManyMany di mana
  terakhirAktifAt IS NULL
  AND rusak = false
  DAN heartbeat segar
  DAN TIDAK ada Session BERJALAN
```

Empat syarat itu wajib semua. Kalau satu salah, akibatnya lebih buruk dari
sebelum: PC dengan sesi berjalan akan ikut dimatikan, atau PC yang ditandai
rusak akan dinyalakan ulang.

⚠️ **JANGAN pakai `heartbeat()` untuk menyalakan timer.** Sama seperti alasan
sebelumnya, heartbeat datang tiap 15 detik.

⚠️ **HATI-HATI dengan `sessionByPc.get()` vs `.has()`** — jebakan yang sama
sudah pernah menewaskan logika status PC. Di sini yang dipakai adalah query
`Session` langsung, bukan map in-memory, jadi tidak bisa mengulangi kesalahan
itu.

Terbukti live: PC simulasi dengan `auto_shutdown_menit=1` menerima
`admin:shutdown` sekitar 67 detik, dan timer kosongnya pulih dalam 14 detik.
Mutasi tes (menghapus syarat `tidak ada sesi`) **gagal** seperti seharusnya.

### 📊 Grafik uptime PC (6 Okt) ✅

Kolom `Pc.lastHeartbeatAt` sudah ada, tapi itu cuma **heartbeat terakhir** —
tidak ada jejak history sama sekali. Jadi "grafik uptime" dibangun dari
`lastHeartbeatAt` yang **disampel** tiap 60 detik, lalu dijumlahkan per hari.

```
src/uptime/uptime.service.ts       cron 60 dtk + cron bersih 6 jam
src/uptime/uptime-query.service.ts agregasi rentang tanggal
prisma/migrations/20261005161709_uptime_pc
```

Tabel `UptimePc` unik per (`pcId`, `tanggal`) dengan kolom `dihitungSampai`
sebagai **watermark**. Fungsinya mencegah penghitungan ganda: hanya selisih
waktu sejak watermark terakhir yang ditambahkan.

| Facts | Nilai |
|---|---|
| Frekuensi sampel | 60 detik (bukan 15 — heartbeat terlalu rapat, tabelnya membengkak tanpa manfaat) |
| Batas atas | 86.400 detik/hari per PC |
| PC `rusak` | **dilewati**, sama seperti di tiga titik baca lainnya |
| Penyimpanan | UTC, kolom `tanggal` |
| Endpoint | `GET /api/reports/uptime?dari&sampai` |
| Batas rentang | 366 hari, `sampai >= dari` |

⚠️ **Tidak ada data historis.** Baris pertama baru muncul saat service berjalan
pada 6 Okt — sampai saat itu Halaman Laporan sengaja menampilkan pesan "belum
ada data", bukan grafik kosong yang terlihat rusak.

⚠️ **Setiap PC diproses dalam `try/catch` sendiri.** Satu PC dengan `lastUsedAt`
di masa depan atau nilai aneh tidak boleh menghentikan penghitungan PC lain.

### 🔴 Ganti Service dependencies = server bisa gagal START (6 Okt)

Menambah satu parameter constructor di `LaporanService` — `SettingsService` —
**langsung menjatuhkan seluruh backend**, karena `LaporanModule` belum mengimpor
`SettingsModule`:

```
ERROR [ExceptionHandler] UnknownDependenciesException: Nest can't resolve
dependencies of the LaporanService (ReportsService, ActivityLogService, ?).
Please make sure that the argument SettingsService at index [2] is available in
the LaporanModule module.
```

Dua hal yang membuatnya berbahaya:

1. **Bukan hanya fiturnya yang mati — seluruh server tidak start.** Tidak ada
   satu PC pun yang bisa billing.
2. **Baris kompilasi tetap bersih.** `npx nest build` sukses, jadi tidak ada
   peringatan sama sekali. Yang memunculkan error hanya saat bootstrap runtime.

⚠️ Tanda `?` pada parameter (`private readonly settingsService?:
SettingsService`) **tidak** membuat Nest menjadikannya opsional — dia tetap
mencari provider itu dan tetap gagal kalau tidak ada. Tanda itu cuma untuk
TypeScript.

⚠️ Kalau menambah service ke module **yang sudah ada**, periksa dulu apakah
module itu sudah mengimpor module pengimbarunya. `SettingsModule` sendiri
mengimpor `SessionModule`, tapi itu **tidak** berarti import-nya otomatis — dan
`forwardRef` juga tidak diperlukan karena `SettingsService` di-`exports`.

### 📄 Laporan PDF — satu halaman, tanpa tabel transaksi (6 Okt)

Dulu laporan tutup hari pecah jadi **79 halaman**, hampir semuanya kosong, dan
halaman pertama penuh tabel rincian transaksi yang tidak pernah dibaca anyone.

Kini: **satu halaman**, isi aslinya 8 kartu ringkasan, dua grafik batang
(Pendapatan, Aktivitas Akun), dan tabel perbandingan 5 hari.

| Bagian | Nilai |
|---|---|
| Transactions | **Dihapus** dari PDF, tidak ada gantinya |
| Grafik | Batang relatif terhadap nilai terbesar, supaya perbandingannya jujur |
| Perbandingan | 5 hari terakhir, termasuk hari laporan |
| Rasio ekstrem | `>= 10x` ditampilkan `x50,5`, bukan `+4950%` |
| Ukuran | ~55.861 byte, 1 halaman |

Tiga bug yang semuanya lolos `nest build`:

1. **`footer()` menggeser `doc.y`.** Fungsi itu menggambar nomor halaman dengan
  ursor pdfkit, jadi setelah dipanggil kursor berada di bawah footer. Dipanggil
   sebelum tabel → seluruh isi tergeser 79 halaman.
2. **Nilai balik `batangDatar()` diabaikan.** `yG` masih menunjuk ke ATAS batang
   terakhir, lalu tabel menggambar judulnya di koordinat yang sama → tabel
   perbandingan **menimpa** grafik Aktivitas Akun. Tidak ada error sama sekali,
   karena pdfkit tidak pernah memeriksa tabrakan koordinat.
3. **`tinggiGrafik` tidak pernah dipakai.** Tinggi batang dihitung dari
   `tinggiBatangBaris` (22), sedangkan tinggi yang dikembalikan closure
   memakai `jarakBaris` (7) →perkiraan salah 15pt per grafik.

⚠️ **Batas jumlah baris tabel dibuat keras di `buildPdf()`**, bukan di service
pemanggil. Ini yang benar-benar menjamin satu halaman: `tinggiTabel =
tinggiJudul + (1 + jumlahBaris) * 16`.

Dulu di situ ada "pemadatan" layout saat ruang kurang, dan **percobaan
membuktikan itu lebih buruk, bukan lebih baik**:

| Skenario | Kode lama | Versi "pemadatan" |
|---|---|---|
| Kekurangan 70pt | 1 halaman | 1 halaman (tidak membuktikan apa pun) |
| Kekurangan 630pt (40 baris disuntik) | 56 halaman | **133 halaman** |

Dua sebabnya. Pertama, `contentBottom` cuma **ambang**, bukan ruang nyata —
mengubahnya tidak pernah membuat halaman meluber, jadi tes pertama sama sekali
tidak membuktikan apa pun. Kedua, memadatkan celah hanya menghemat sekitar 96pt
sementara kekurangan 630pt, dan menggeser koordinat justru menambah pemecahan
halaman.

Aturannya: kalau yang perlu dipadatkan adalah **tabel yang tumbuh sendiri**,
batasi jumlah barisnya. Jangan tambah محاولة kompres selebar-lebarnya.

### 📧 Penerima email laporan bisa diatur (6 Okt)

Key Setting baru: `laporan_email_tujuan`. Kalau kosong, server memakai
`LAPORAN_EMAIL_TUJUAN` seperti sebelumnya — jadi tidak ada perubahan perilaku
untuk yang sudah jalan.

Di UI: **Pengaturan → Data**, textarea + tombol "Simpan Penerima" dan
"Simpan & Kirim Sekarang". Teks untuk SMTP/pengirim tidak pernah ditampilkan.

Parsing menerima koma, titik koma, spasi, dan baris baru, dan **alamat tidak
valid dilewati, bukan membatalkan pengiriman** ke alamat lain. Alamat juga
dikirim **satu per satu**, bukan sekali jalan untuk seluruh daftar.

⚠️ **Kirim per penerima itu wajib, dan bukan sekadar formalitas.** Dengan satu
`sendMail()` berisi daftar, server mail membalas `550 all recipients were
rejected` begitu **satu** alamat tidak bisa deliver — jadi satu alamat salah
ketik membuat laporan hilang untuk **semua** penerima, termasuk yang alamatnya
benar. Terbukti nyata terhadap server sungguhan.

⚠️ **Validasi di frontend harus SEMA LONGGAR dengan `pisahkanEmail()`** di
server. Kalau lebih ketat, admin melihat "ditolak" untuk alamat yang sebenarnya
terkirim, dan itu lebih membingungkan daripada tidak memvalidasi sama sekali.

⚠️ **Tombol "Simpan & Kirim" menyimpan DULU baru mengirim.** Kalau kirim dulu
lalu simpan, emailnya masih memakai daftar lama — jadi admin mengira daftar
barunya sudah diuji padahal belum.

### 🔧 Simulasi agent (`backend/test/tools/simulasi-agent.mjs`)

Untuk menguji auto-matikan tanpa memakai PC sungguhan:

```bash
docker compose exec v3netbill-backend node /app/test/tools/simulasi-agent.mjs <pcId> <agentToken>
```

⚠️ **Wajib** `pcId` + `agentToken` **milik PC uji sendiri**. `registerAgent()`
memutus socket lama yang punya token sama, jadi memakai PC asli akan saling
menendang dengan agent asli dan mengakhiri sesi pelanggan sungguhan. Lihat
bagian "Tes TIDAK BOLEH memakai PC sungguhan".

### Hitung mundur di dashboard

`DashboardPcInfo` menambah `matiDalamDetik: number | null`. `null` = PC tidak akan
dimatikan (ada sesi, ditandai rusak, atau fiturnya dimatikan).

⚠️ **Angka ini hanya informatif. Server tetap satu-satunya pihak yang mematikan
PC.** Kalau frontend yang mematikan, kasir yang menutup tab akan membuat PC tidak
pernah mati.

Dua jebakan di sisi frontend yang sudah diperbaiki:

1. **Jangan pakai `formatDuration()` untuk hitung mundur.** Fungsi itu untuk
   sisa waktu sesi dan menambahkan jam didahulukan, jadi 149 detik terbaca
   `2j 29:29`. Ada `formatHitungMundur()` khusus (`M:SS`, atau `H:MM:SS` di atas
   1 jam).
2. **Hitung mundur dihitung dari `payload.at`, bukan dari penghitung yang
   dikurangi satu per detik.** Broadcast baru datang tiap ~10 detik dengan nilai
   yang sudah berkurang — kalau penghitung lokal ikut berkurang, keduanya saling
   meniadakan dan angkanya terlihat macet lalu melompat. Rumusnya:
   `matiDalamDetik - floor((sekarangMs - payloadMs) / 1000)`.

⚠️ **Tidak boleh ada `useState`/`useEffect` di dalam `pcs.map()`** — itu
callback, bukan komponen, dan React menolaknya dengan `rules-of-hooks`. Satu
`setInterval` global di komponen induk, lalu nilai dihitung per kartu.

⚠️ **Celah yang sengaja dibiarkan**: pelanggan yang berdiri di depan PC **tidak
melihat** hitung mundur ini — hanya kasir di dashboard yang melihat. Menutupnya
butuh perubahan WPF di agent → build MSI baru → pasang ulang ke semua PC. Kalau
pelanggan datang di menit ke-4, PC bisa mati tanpa peringatan di layarnya.

### 🔴 `namaPc` itu LABEL, bukan identitas — tapi punya 3 cache yang wajib di-invalidate

`namaPc` **tidak terikat ke apa pun** sebagai identitas:

```
"Pc_pkey"          PRIMARY KEY, btree (id)          <- identitas
"Pc_agentToken_key" UNIQUE, btree (agentToken)     <- kunci agent
```

Tidak ada unique index pada `namaPc`, dan semua foreign key memakai `id`. Jadi
`PATCH /api/pcs/:id/nama` **aman dipakai saat PC sedang dipakai pelanggan** —
sesi, agent, dan `agentToken` tidak tersentuh (terbukti: ganti nama PC001 saat
sesi member berjalan 4308 detik → `id` & `agentToken` tetap, 63 transaksi utuh).

Tiga tempat ini **baca nama dari cache sendiri**, jadi kalau nama diganti
tanpa membereskan ketiganya, hasilnya justru kebalikan dari tujuan operator:

| Tempat | Gejala kalau dilupakan |
|---|---|
| `log-billing.namaPc()` | Cache hanya diisi ulang saat **kosong** → seluruh baris log berikutnya tetap memakai nama **LAMA** selamanya. Panggil `invalidateNamaPc()` |
| Agent → Nextcloud | Nama PC = awalan nama berkas log (`PC001-agent-....log`). Agent menerimanya lewat `agent:nextcloud_config`, jadi tanpa dorongan ulang log repair tersimpan dengan nama lama. Panggil `SessionService.kirimUlangNamaKeAgent()` |
| Duplikat nama | Tidak ada unique index → dua PC bisa sama-sama "PC001". Membingungkan, dan `key={namaPc}` di halaman login bentrok. Tolak dengan **409** |

Nama PC juga dipakai untuk **slug nama berkas diagnosa**
(`diagnosa.service.ts`, disanitasi 24 karakter) — hanya memengaruhi berkas yang
diunggah setelahnya.

⚠️ **`@IsNotEmpty()` tidak menolak input spasi saja.** `"   "` lolos DTO,
lalu `.trim()` menjadikannya `""` — dan nama kosong tersimpan di database.
Validasi WAJIB diulang **setelah** trim (lihat `PcService.gantiNama()`). Ini
sudah terjadi sungguhan dan baru ketahuan karena mengujinya ke server.

⚠️ **`GET /api/settings/apk/info` dan `GET /api/settings/installer/info` wajib
JWT, dan JANGAN digantikan `GET /api/settings`.** Yang terakhir mengembalikan seluruh isi tabel `Setting` —
termasuk `agent_otp_bot_token` (token bot Telegram yang aktif),
`agent_otp_chat_id`, `pin_bypass_hash`, dan `pin_uninstall_hash` dalam bentuk
jelas. Aplikasi Android cukup butuh enam field: `ada`, `versionCode`,
`versionName`, `ukuranBytes`, `sha256`, `tanggalUpload`. Halaman Pengaturan
cukup lima field untuk MSI: `ada`, `versionName`, `ukuranBytes`, `sha256`,
`tanggalUpload`. Endpoint `info` mengembalikan unbelasan byte; `settings`
mengembalikan semuanya.

### WebSocket namespace `/session`

Dikirim klien → server:

| Event | Pengirim | Isi |
|---|---|---|
| `agent:register` | agent | `{ pcId, agentToken }` |
| `agent:heartbeat` | agent | `{ pcId }` |
| `client:login_request` | overlay | `{ pcId, kredensial: { kode, password } }` |
| `client:create_password` | overlay | `{ pcId, kode, passwordLama, password }` |
| `client:stop_session` | overlay | `{ pcId }` |
| `dashboard:subscribe` | web/mobile | masuk room `dashboard` |
| `dashboard:start_pc` | web/mobile | `{ pcId, kode }` |
| `dashboard:start_voucher` | web/mobile | `{ pcId, nominal }` |
| `dashboard:lock_pc` | web/mobile | `{ pcId }` |
| `dashboard:shutdown_pc` | web/mobile | `{ pcId }` |

Dikirim server → klien:

| Event | Ke | Isi |
|---|---|---|
| `client:login_result` | overlay | `{ success, sessionId?, message? }` |
| `session:start` | agent | `{ sessionId, durasiDetikTersedia, account }` |
| `session:tick` | agent | `{ sisaDetik }` — tiap 1 detik |
| `session:stop` | agent | `{ alasan }` |
| `admin:lock` | agent | `{ pcId }` |
| `admin:shutdown` | agent | `{ pcId }` |
| `agent:otp_config` | agent | `{ botToken, chatId }` — dorongan saat register & saat admin simpan |
| `agent:bypass_config` | agent | `{ hash }` — hash bcrypt PIN bypass |
| `dashboard:pc_update` | room `dashboard` | `{ pcs: [...] }` — array detail PC + sesi aktif + sisa detik |
| `dashboard:log` | room `dashboard` | jejak aktivitas |

### Cron

| Nama | Jadwal | Fungsi |
|---|---|---|
| `auto-backup` | 01:00 | `pg_dump` + hapus backup > 30 hari |
| `cleanup-activity-logs` | 02:00 | hapus activity log > 30 hari |
| `cleanup-log-billing` | 03:00 + saat start | hapus berkas log billing > 30 hari |
| `cleanup-diagnosa` | 04:00 + saat start | hapus paket diagnosa agent > 14 hari |
| `tutup-hari-laporan` | 23:30 WIB | rekap hari sebelumnya → PDF + email + Telegram |

Batas hari bisnis = **23:30 WIB** (hari T = [23:30 T-1, 23:30 T)). Rekap nol dihitung
setelah batas ini.

### 🔴 Zona waktu: server & database UTC, aplikasi menampilkan WIB (4 Okt)

Semua yang ada hubungannya dengan **tanggal** di backend harus dihitung eksplisit sebagai WIB.
Server, container, dan PostgreSQL berjalan di zona **UTC**, jadi tidak ada yang
otomatis jadi WIB.

**Helper yang wajib dipakai** — `backend/src/common/wib-date.ts`:

| Fungsi | Hasil | Dipakai di |
|---|---|---|
| `awalHariWib('2026-10-04')` | `2026-10-03T17:00:00.000Z` = 00:00 WIB | `transactions.service.ts` |
| `akhirHariWib('2026-10-04')` | `2026-10-04T16:59:59.999Z` = 23:59 WIB | `transactions.service.ts` |
| `tanggalWib()` | `'2026-10-05'` pada WIB 01:00 | `log-billing.service.ts` |

⚠️ **Dua jebakan yang sudah menyebabkan bug nyata, dan keduanya sudah diperbaiki:**

1. **`setHours()` memakai jam LOKAL server.** Server UTC, jadi
   `new Date(tgl).setHours(23,59,59,999)` = 23:59 **UTC** = 06:59 WIB **hari
   berikutnya**. Filter "sampai 04 Okt" jadi ikut menghitung transaksi 05 Okt
   jam 00:00–06:59. `new Date(tgl)` untuk batas "dari" punya masalah serupa di
   ujung lain: 00:00 UTC = 07:00 WIB, jadi 7 jam pertama transaksi hilang.
2. **`toISOString()` mengembalikan UTC.** `toISOString().slice(0,10)` untuk nama
   berkas log = tanggal UTC, dan antara 00:00–06:59 WIB tanggal UTC masih
   milik **hari sebelumnya** — aktivitas jam-jam itu masuk
   `billing-<kemarin>.log`.

**Yang sudah benar dan tidak boleh diubah** — batas **hari buku 23:30 WIB**
(16:30 UTC) punya hitungannya sendiri, dan memang berbeda:

- `reports.service.ts` — `WIB_OFFSET_MIN` + `CUTOFF_WIB_MIN`, Window 24 jam geser
- `activity-log.service.ts` — `getTutupHariBoundary()`, `setUTCHours(16,30)`
- cron `tutup-hari-laporan` — `timeZone: 'Asia/Jakarta'` di decorator `@Cron`

⚠️ **Helper `wib-date.ts` itu batas 00:00, bukan 23:30.** Memakainya di Reports
atau ActivityLog akan menghapus batas tutup hari.

**Frontend: semua `toLocaleString` WAJIB diberi `timeZone: 'Asia/Jakarta'`.**
Tanpa itu, `toLocaleString` ikut zona yang disetel di PC kasir — PC yang
disetel UTC atau zona mana pun di belakang UTC akan menampilkan semua waktu
7 jam (atau lebih) mundur. Sudah dipasang di `formatWaktu()` (`src/lib/api.ts`),
`formatDateIndo()`, `TransactionsPage`, `AccountsPage`, `PcPage`, `ReportsPage`.

⚠️ **`ReportsPage.labelTanggal()` parses `t + 'T00:00:00Z'`**, jadi 00:00 UTC =
07:00 WIB — tanggalnya **tidak** bergeser di zona WIB. Aman diberi `timeZone`,
dan justru itulah yang melindungi dari PC kasir berzona UTC-5 yang akan melihat
tanggalnya mundur satu hari.

⚠️ **Waktu yang dicetak di terminal selalu UTC.** `date`, `new Date()`, dan
`toISOString()` di dalam container semuanya UTC. Kalau hasilnya berbeda dengan
lokasi kasir (WIB), tambahkan 7 jam — jangan langsung menyalahkan aplikasi.
Data di database benar; yang salah sering kali cuma command yang dipakai untuk
memeriksanya.

Tes regresi: `backend/test/wib-date.spec.ts` (9 kasus).

⚠️ **Semua yang dipanggil dari cron atau `setInterval` wajib dibungkus
`try/catch`.** Aturan ini sudah tercatat sejak `0c13a60`, tapi **tidak pernah
diterapkan di semua tempat** — dan itu terbukti lewat dua crash, bukan lewat
kode.

**Crash 1 (`0c13a60`)** — `checkGracePeriodExpired()` tanpa penjaga. Satu setting
`grace_period_detik` kosong membuat `parseInt` jadi `NaN`, `NaN * 1000` jadi
`Invalid Date`, Prisma menolak, dan proses Node mati — seluruh PC kehilangan
billing sekaligus.

**Crash 2 (30 Sep)** — `startSessionTick()` punya callback `async` tanpa
`try/catch`. Baris `Session` dihapus (oleh skrip uji, dan bisa juga oleh
`bersihkan-data`) sementara tick 1-detiknya masih jalan → tick berikutnya
memanggil `session.update()` untuk baris yang sudah tidak ada → Prisma melempar
`P2025` → unhandled rejection → **proses Node mati**. Ekor lognya 200 baris
minified Prisma yang tercetak, dan penyebabnya jauh di atas sana.

Yang membuatnya berbahaya adalah **betapa tidak mungkinnya** bug ini terjadi dari
kode yang dibaca: race-nya cuma muncul kalau ada yang menghapus baris di antara
`findUnique` dan `update`.

Tiga callback yang ada sekarang semuanya sudah dijaga:

| Callback | File | Penjaga |
|---|---|---|
| `startSessionTick` | `session.service.ts:499` | `try/catch` penuh + `P2025` dikenali sebagai kondisi wajar, tick berhenti sendiri |
| `startDisconnectCheck` | `session.service.ts:708` | pengaman lapis kedua, walau dua checker di bawahnya sudah punya penjaga sendiri |
| `checkGracePeriodExpired` | `session.service.ts:760` | sudah ada sejak `0c13a60` |
| `checkPcOffline` | `session.service.ts:741` | sudah ada sejak awal |

⚠️ **`broadcastPcUpdate()` juga wajib aman dari penolakan.** Method itu dipanggil
**tanpa `await`** dari beberapa tempat (termasuk dari tick sesi), jadi penolakan
di dalamnya juga jadi unhandled rejection. Sekarang body-nya dibungkus
`try/catch` sendiri, jadi aman dari semua pemanggil.

⚠️ **Skrip uji yang menyentuh `Session` TIDAK BOLEH menghapus baris
`sessions`/`Session` untuk mengakhiri sesi.** Gunakan `stopSession` — itu jalur
normalnya. Menghapus baris itu melanggar seluruh aturan tick di atas dan menjatuhkan
server. Perbaikan harus diuji lewat jalur yang STRUKTURAL benar, bukan yang
paling singkat.

### Backup & restore

| Aksi | Cara |
|---|---|
| Backup manual | `POST /api/settings/backup` (Pengaturan → Data) |
| Restore | `docker cp <file.sql> postgres-15:/tmp/restore.sql` lalu `docker exec postgres-15 psql -U billing_user -d v3netbill -f /tmp/restore.sql` |

`pg_dump` dijalankan **tanpa** `?schema=public` (query string di-strip dari API URL) —
lihat `settings.service.ts`.

### Mengosongkan data — skrip `bersihkan-data` (bukan endpoint web)

`/home/warnet/docker/v3netbill/bersihkan-data` (root project, **tidak masuk repo** —
sejajar dengan `dk` dan `fl`). Menghapus seluruh data operasional:

```
Transaction, Session, Account, DailyReport, ActivityLog
```

**Pc, User, dan Setting tidak disentuh.** `User` dihapus berarti tidak ada yang bisa
login lagi; `Pc` dipakai agent yang sedang jalan.

```bash
./bersihkan-data              # dry-run: hanya menampilkan yang akan dihapus
./bersihkan-data --jalankan   # backup otomatis, lalu hapus (minta ketik HAPUS SEMUA)
```

⚠️ **Kenapa skrip bash, BUKAN endpoint web** — ini keputusan yang disengaja, jangan
diubah tanpa alasan baru. Endpoint "hapus semua akun + semua transaksi" yang aktif
permanen di domain publik adalah sasaran bernilai tinggi, dan `JWT_SECRET` masih punya
fallback hardcoded yang terbaca publik di repo backend (lihat bagian audit keamanan
di bawah). Membaca data sudah berisiko; menghapus seluruh database berlipat. Operasi
ini sekali pakai, jadi tidak perlu jadi fitur aplikasi.

**Urutan DELETE wajib begini** — `Transaction.accountId` dan `Session.accountId` punya
`ON DELETE RESTRICT` (bukan `CASCADE`), jadi menghapus `Account` duluan akan ditolak
PostgreSQL. `Transaction.kasirId` juga `RESTRICT` ke `User`, makanya `User` tidak boleh
dihapus. Semua DELETE dibungkus `-1` (`--single-transaction`) + `ON_ERROR_STOP=1`, jadi
gagal di tengah tidak meninggalkan keadaan setengah jadi.

**Tiga lapis pengaman**, semuanya sudah diuji:

| Lapis | Perilaku |
|---|---|
| Default = dry-run | tanpa `--jalankan` tidak ada yang dihapus, exit 0 |
| Backup otomatis | `pg_dump` ke `data/backup/pre-bersih-<stempel>.sql`; **kalau < 1000 byte skrip berhenti** dan data tidak dihapus |
| Konfirmasi ketik | harus persis `HAPUS SEMUA`; salah atau stdin bukan TTY → dibatalkan |
| Guard sesi aktif | kalau ada `Session` berstatus `BERJALAN`, berhenti **sebelum** backup, exit 1 — mencegah waktu pelanggan terpotong di tengah sesi |

⚠️ **Dua jebakan bash yang sudah ditemukan dan tidak boleh diulang** (30 Sep):
- **`docker exec -i` memakan stdin.** Fungsi `psql_db()` sengaja **tanpa** `-i`. Dengan
  `-i`, docker mewarisi stdin skrip, dan jawaban konfirmasi ikut hilang — jadi `HAPUS
  SEMUA` selalu terbaca kosong dan skrip selalu "Dibatalkan" tanpa alasan yang jelas.
  Semua SQL di skrip ini lewat argumen `-c`, jadi `-i` memang tidak pernah dibutuhkan.
- **`read`, bukan `baca`.** Versi pertama salah ketik dan `set -e` langsung menghentikan
  skrip — jadi tidak merusak data, tapi jalur konfirmasi mati tanpa error yang
  menunjuk ke penyebabnya. Jalankan `bash -n <skrip>` sebelum dipakai.

Verifikasi 30 Sep: dry-run, konfirmasi salah, guard sesi aktif (dibuat 1 sesi uji lalu
dibuang), dan DELETE sungguhan — keempatnya diuji di **database salinan**
(`v3netbill_ujicoba`, dibuat dari `pg_dump` lalu di-drop), bukan di produksi. Hanya
uji jalur DELETE tanpa risiko begitu dua bug di atas ketahuan.

**Sudah dijalankan sekali di produksi, 30 Sep 08:24.** 121 akun (102 masih punya sisa
waktu), 140 transaksi, 64 sesi, 29 rekap dihapus. Backup pengembalian ada di
`data/backup/pre-bersih-2026-09-30T08-24-47.sql` (69.542 byte). Setelah itu backend
direstart; 0 error konsol di 6 halaman. ⚠️ Rekap harian yang **sudah pernah dikirim**
ke email/Telegram tidak kembali — menghapus tabel tidak menarik kembali yang terkirim.

### Deteksi IP PC — ringkas + pilihan yang belum dikerjakan

`Pc.ipClient` **hanya data tampilan**. Bukan identitas, bukan kunci unik, tidak dipakai
routing, auth, atau lock. Identitas PC selalu `pcId` + validasi `agentToken`.

Untuk PC **di luar jaringan** (lewat Cloudflare Tunnel) nilainya akurat — Cloudflare
menaruh IP asli di `CF-Connecting-IP`. Untuk PC **satu jaringan LAN** nilainya **belum
akurat**: karena `docker-proxy` (userland proxy) aktif di host, backend selalu mencatat
IP bridge Docker dan tidak bisa membedakan antar PC. Tidak mengganggu fungsi apa pun,
hanya kolom IP di dashboard yang tidak informatif.

Dua opsi yang sudah dianalisis tapi **belum dikerjakan**:

- **Opsi A** — agent mengirim IP-nya sendiri di payload `agent:register`. Butuh build +
  deploy MSI baru ke semua PC.
- **Opsi B** — matikan userland proxy lewat `/etc/docker/daemon.json`
  (`"userland-proxy": false`) supaya Docker pakai iptables DNAT murni. Tidak perlu
  redeploy MSI, tapi restart Docker mematikan semua container termasuk Postgres.

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

### Halaman Pengaturan — 7 tab (`97082bd`, tab Log Billing 1 Okt, tab Diagnosa 2 Okt)

Dulu `SettingsPage.tsx` 897 baris dengan 6 kartu dalam grid datar. Tinggi baris
mengikuti kartu tertinggi, jadi Tarif punya ~430 px ruang kosong dan Installer
~590 px, karena "Akses Agent" di sebelahnya jauh lebih tinggi. Nama kartu juga
tidak sesuai isinya: Akses Agent memuat 3 hal tidak berhubungan, Installer 4 hal.

Kini **7 tab**, tiap tab 2–3 kartu yang berkelompok. (Semula 5; tab Log
Billing ditambahkan 1 Okt, tab Diagnosa Agent 2 Okt — lihat bagian
"Diagnosa agent otomatis".)

```
src/pages/SettingsPage.tsx        → header, tab, banner, busy overlay
src/pages/settings/shared.ts      → BUSY_TEXT, SettingsCtx, formatBytes/formatDateIndo
src/pages/settings/SettingsCard.tsx
src/pages/settings/TabTarif.tsx        Harga per Menit · Grace Period
src/pages/settings/TabAgent.tsx        PIN Uninstall · PIN Bypass · OTP Telegram
src/pages/settings/TabInstalasi.tsx    MSI · APK Android · Wallpaper Lock Screen
src/pages/settings/TabPengguna.tsx     Tambah User · Ganti Kata Sandi
src/pages/settings/TabData.tsx         Backup · Riwayat Backup
src/pages/settings/TabLogBilling.tsx   Log Billing Harian · Daftar Tanggal · Isi Log
src/pages/settings/TabDiagnosa.tsx     Daftar paket diagnosa agent + unduh
src/pages/settings/TabNav.tsx           Sidebar (desktop) / pemicu yang menutup sendiri (mobile)
```

⚠️ **Kartu "Log Billing Harian" dan "Daftar Tanggal" sengaja satu baris**
(`sm:grid-cols-2` + `items-start`), bukan dua kartu terpisah. `items-start`
supaya tiap kartu memakai tinggi alaminya — kalau tidak, yang lebih pendek ikut
diregangkan dan muncul ruang kosong (pelajaran no. 16).

`SettingsCtx` (`busy`, `setBusy`, `run`, `setErr`, `setMsg`) dinaikkan ke
induk lalu dioper ke setiap tab, jadi satu proses mengunci tombol di semua tab
dan banner pesan tidak menumpuk. State khusus tab tetap lokal di tabnya.

**Nilai setting milik INDUK, bukan state lokal tab.** `TabTarif` pernah punya
`useState('')` sendiri sehingga form tampil kosong padahal server sudah punya
nilai — dan sekali tersimpan kosong, seluruh server tumbang (lihat pelajaran
no. 15). Sekarang `harga`/`grace` dimuat di `SettingsPage` lalu dioper masuk.
Aturan: kalau nilai awal berasal dari server, **jangan** mendeklarasikannya ulang
di tab.

- **Komponen `Card` di `src/components/ui/` TIDAK dipakai** di halaman ini
  karena paletnya `neutral-*`, sedangkan aplikasi ini 366× pakai `slate-*`.
  Memakainya akan menimbulkan warna yang beda. `SettingsCard` lokal memakai
  class yang sama persis dengan `<section>` sebelumnya.
- **`TabButton` diekstrak** dari `AccountsPage.tsx` ke
  `src/components/ui/Tabs.tsx` supaya Voucher & Member dan Pengaturan konsisten.
- **Mobile**: deretan tab `overflow-x-auto` + `min-w-max` (digeser, bukan
  melebar); kartu `sm:grid-cols-2` (jadi 1 kolom di HP). **Tabel backup
  berubah jadi kartu bertumpuk di `sm:hidden`** — tabelnya `min-w-max`, jadi
  di HP kolom "Download" ada seluruhnya di luar layar tanpa petunjuk bisa
  digeser, membuat tombolnya praktis tidak ditemukan. Pola yang sama masih
  belum dipakai di halaman log aktivitas (lihat Pending).
- Halaman **Informasi Produk** dan **Security Report** dihapus (`97082bd`);
  keduanya tidak punya item navigasi dan tidak direferencing dari mana pun.

### ⚠️ Setting rusak tidak boleh menjatuhkan server (`0c13a60`)

`checkGracePeriodExpired()` dipanggil dari `setInterval` tiap 10 detik **tanpa
`try/catch`**. Satu error di dalamnya jadi unhandled rejection yang
menjatuhkan **seluruh proses Node** — bukan cuma menghentikan satu sesi. Semua
PC kehilangan billing sekaligus.

Penyebabnya `grace_period_detik` kosong: `parseInt('', 10)` = `NaN`, dikali
1000 jadi `Invalid Date`, dan Prisma menolak tanggal yang tidak valid. Satu baris
rusak di database jadi melumpuhkan seluruh layanan.

Dua lapis: `loadGracePeriod()` memakai default 180 detik + `logger.warn` kalau
nilai tidak valid/negatif, dan `checkGracePeriodExpired()` sekarang menangkap
error apa pun — sama seperti `checkPcOffline()` yang sudah punya penjaga sejak
dulu. **Uji:} sengaja dikosongkan `grace_period_detik` → server tetap melayani
permintaan, 0 crash.

**Umum:** apa pun yang dipanggil dari `setInterval`/`@Cron` **wajib** dibungkus
`try/catch`, kalau tidak satu data rusak bisa mematikan seluruh backend.

## FASE 7-9 — Agent Client (repo terpisah `v3NetbillAgent/`) ✅

- Repo sendiri dengan git + GitHub Actions; bukan bagian backend. Build MSI via WiX v4.
- Komponen: `Agent.Service` (Windows Service, koneksi Socket.IO), `Agent.Overlay` (WPF fullscreen
  layar login + mini-panel sesi), `Agent.Core` (protokol + named pipe), `Installer/Product.wxs`.
- Config dibaca `GetConfig()` (`Agent.Service/Worker.cs:608`): **registry → appsettings.json → default**.
  Registry `HKLM\Software\v3Netbill\Agent`: `ServerUrl`, `PcId`, `AgentToken` ( ditulis MSI).
- Wizard installer punya dialog `ServerConfigDialog` (`Installer/Product.wxs:194`) — field
  **Server URL / PC ID / Agent Token**. Default `SERVER_URL` **diisi saat build MSI oleh
  workflow** lewat `wix build -d SERVER_URL="${{ env.SERVER_URL }}"`, dan nilainya diambil dari
  **GitHub Actions variable** bernama `SERVER_URL` (bukan secret). Di `Product.wxs` hanya ada
  fallback yang akan ditimpa itu — jangan andalkan isinya. Detail jebakannya:
  bagian "Build MSI & WiX" di bawah.
- **WAJIB isi `ServerUrl` dengan skema lengkap** (`http://192.168.1.59:3000`), karena
  `Agent.Core/ServerConnection.cs:91` memanggil `new Uri($"{serverBaseUrl.TrimEnd('/')}/session")` —
  string tanpa skema gagal. ⚠️ `ServerUrl` berisi **base URL saja**, tanpa `/session`;
  `ServerConnection` yang menambahkannya.

### Build MSI & WiX — jebakan yang sudah dilewati

⚠️ **`-d NAME=Value` TIDAK menimpa atribut `Property`. Dia hanya membuat
preprocessor variable, dan harus ditulis `$(var.NAME)` di dalam `.wxs`.**

Ini jebakan paling merusak di repo ini, karena gejalanya muncul **jauh** dari
penyebabnya: agent terpasang dengan `ServerUrl = http://localhost:3000`, lalu
mencoba konek ke localhost **di PC kasir**. Akibatnya PC jadi OFFLINE dan
wallpaper tidak pernah terunduh — padahal endpoint wallpaper di server sehat
saja. Log server juga tidak menunjukkan apa-apa karena agent tidak pernah
sampai.

Dua tahap, keduanya sudah terperbaiki:

1. `build-agent.yml` meneruskan `-d SERVER_URL="${{ env.SERVER_URL }}"`.
   Nilainya dari **GitHub Actions variable** (`SERVER_URL`), bukan secret.
   Variabelnya sudah ada dari awal dengan nilai yang benar — hanya cablingnya
   yang belum ada.
2. `Product.wxs` menulis `Value="$(var.SERVER_URL)"`. Sebelumnya literal
   `Value="http://localhost:3000"`, jadi define-nya tidak pernah terpakai.

Cara memastikan benar: **`grep 'http://localhost:3000' <file>.msi`**. Kalau
masih ada, build-nya salah. Pola `$(var.…)` yang sudah bekerja bisa dilihat di
`Product.wxs` untuk `Source="$(var.SvcPublishDir)"`. Perhatikan bedanya dengan
`$(WIXUIARCH)` — itu preprocessor variable bawaan WiX, bukan dari `-d`.

Konsekuensinya disengaja: build tanpa `-d SERVER_URL` **gagal** dengan
`WIX0150: Undefined preprocessor variable`. Itu jauh lebih baik daripada
menghasilkan MSI yang terpasang tapi tidak konek.

- ⚠️ **Step "Verify MSI contents" sekarang membaca tabel Property MSI dan
  gagal keras kalau `SERVER_URL` kosong atau masih `localhost:3000`.**
  Sebelumnya step itu hanya memeriksa file ada, sehingga MSI dengan default
  salah tetap lolos hijau. Kalau kamu menambah property yang wajib benar,
  tambahkan juga pemeriksaannya di sini.
- **Upload manual kalau langkah CI dilewati** (lihat tiga secret kosong di
  bawah). Rangkaiannya sudah dipakai dan terverifikasi:
  ```bash
  # 1. artifact SELALU butuh token, dan sering terpotong di unduhan pertama
  TOKEN="$(cat v3netbill-mobile/github-token.txt)"
  curl -L -C - --retry 5 --retry-all-errors -H "Authorization: Bearer $TOKEN" \
    -o artifact.zip ".../actions/artifacts/<id>/zip"
  # 2. upload lewat LOCALHOST, bukan lewat domain
  curl -X POST http://localhost:3000/api/settings/installer \
    -H "Authorization: Bearer $TOKEN" -F "file=@...msi"
  ```
  ⚠️ Upload lewat domain dari host **terpotong di ~18 MB** (Cloudflare); MSI
  62 MB selalu gagal. Selalu lewat `localhost:3000`.
  ⚠️ **Ukuran MSI TIDAK berubah antar build.** Dua MSI berturut-turut sama
 -sama `64822192` byte padahal isinya berbeda — hampir salah mengira artifact itu
  basi karena ukurannya sama. Yang menentukan hanya `sha256`. Verifikasi
  unduh ulang dari server dan bandingkan hash, bukan lihat ukuran.
  ⚠️ Berkas di `/data/installer/` **root-owned** (dibuat container sebagai
  root). Untuk menghapus berkas lama harus lewat
  `docker exec v3netbill-backend rm -f ...`, dan **nama aktif dibaca dari
  `installer_meta`** — jangan hardcode, supaya ada kasir yang mengunduh versi
  salah. Command lengkap: bagian "Distribusi lewat Settings web".
- **Validasi lokal WiX (lebih cepat daripada menunggu CI ~4 menit).** Container
  `mcr.microsoft.com/dotnet/sdk:8.0` sudah ada di cache mesin ini:
  ```bash
  docker run --rm -v "$PWD/v3NetbillAgent:/w" -w /w mcr.microsoft.com/dotnet/sdk:8.0 \
    bash -c 'dotnet tool install --global wix --version 4.0.5
             wix build Installer/Product.wxs -d SERVER_URL=<url> ...'
  ```
  Yang **harus** dicek: `WIX0005` (elemen tak dikenal), `WIX0103` (sumber file
  tidak ketemu), `WIX0150` (preprocessor variable undefined — ini yang
  menangkap bug `SERVER_URL`). Yang **diabaikan**: `WIX0389` dan `WIX0000`.
  ⚠️ `<WixVariable>` di dalam `.wxs` **tidak** memenuhi `$(var.X)` — hanya
  `-d` yang bisa. Sudah dicoba dan ditolak dengan `WIX0005`.
- Versi WiX **wajib `4.0.5`**, mengikuti `WIX_VERSION` di `.github/workflows/build-agent.yml`.
  Jangan naikkan ke 5.x tanpa sengaja menguji ulang.
- ⚠️ **`WixVariable` (cara kustomisasi banner di WiX v3) TIDAK didukung WiX v4.** Ditolak
  `WIX0005` di **enam** posisi penempatan yang dicoba: anak `<Package>`, anak `<Wix>`, di dalam
  `<UI>` di tingkat `<Package>` maupun di dalam `<Fragment>`, dan dua variasi dengan prefix
  namespace `ui:`. Karena itu **banner dialog installer tidak dikustomisasi** — gambar bawaan
  `WixUI_Bmp_Banner`. Ikon produk memakai `<Icon>` + `<Property Id="ARPPRODUCTICON">`, dan itu
  yang tampil di panel Program dan Features.
- ⚠️ **`SourceFile` di-resolve dari FOLDER KERJA `wix build`, bukan dari lokasi berkas `.wxs`.**
  Workflow memanggil `wix build "$ws/Installer/Product.wxs" ...` dari root repo, jadi path ikon
  ditulis `Agent.Overlay\app.ico`. Kalau ditulis `..\Agent.Overlay\app.ico` hasilnya
  `WIX0103: Cannot find the Icon file` — sempat menggagalkan satu siklus CI.
- **Wix hanya benar-benar didukung di Windows.** Menjalankannya di container Linux tetap
  mengembalikan error palsu `WIX0389` ("Directory/@Name is not a relative path") untuk baris
  yang tidak disentuh, karena tool mencetak warning "all behavior after this point is undefined".
  Arti: validasi lokal **hanya berguna untuk menangkap `WIX0005`/`WIX0103`**, sedangkan
  `WIX0389` harus diabaikan. Build MSI sungguhan tetap harus lewat CI.
- Validasi lokal lebih cepat daripada menunggu CI (yang butuh ~4 menit per siklus): pasang
  `wix` lewat `dotnet tool install --global wix --version 4.0.5`, generate ulang
  `SvcDepFiles.wxs`/`OverlayDepFiles.wxs` sesuai skrip di workflow, lalu `wix build ...`
  dan **grep hanya `WIX0005`**.
- ⚠️ **Step "Upload MSI to Backend" di CI bisa dilewati TANPA error.** Kalau secret
  `V3NETBILL_ADMIN_USER` / `V3NETBILL_ADMIN_PASSWORD` / `V3NETBILL_BACKEND_URL` belum diisi,
  lognya `Secret ... belum diatur; lewati upload` tapi step tetap keluar **OK**. Jadi tampilan
  hijau di GitHub tidak berarti MSI sudah sampai ke server — **verifikasi `installer_meta`**
  lewat `GET /api/settings` sebelum percaya, atau upload manual.
- Aset ikon & logo: `Agent.Overlay/app.ico` (16–256 px, dipakai executable Windows **dan**
  `ARPPRODUCTICON` MSI) plus `Agent.Overlay/Assets/logo-v3netbill.png` (logo **berserta tulisan**,
  dipakai header kartu login). Keduanya hasil potong dari
  `frontend/public/logo-v3netbill.png`.
- Transisi versi agent: `1.0.6.0` reconnect supervisor → `1.0.7.0` single reconnect authority
  (anti flapping) → `1.0.8.0` heartbeat timer bug → `1.0.9.0` heartbeat self-diagnosing + tick log →
    `1.0.10.0` nomor versi terbaca → `1.0.11.0` `lpDesktop` + watchdog session 0 →
    `1.0.12.0` flag path seragam + log mode maintenance ->
    `1.0.13.0` maintenance ke registry + installer mengakhirinya, login card mockup,
    log agent ke Nextcloud -> `1.0.14.0` konfigurasi Nextcloud dari web ->
    `1.0.15.0` perbaikan tampilan kartu login -> `1.0.16.0` kolom Nextcloud dibuang dari
    installer -> `1.0.17.0` nama berkas log pakai nama PC.
    Riwayat detail: `v3NetbillAgent/HANDOFF.md`.
- Detail arsitektur & prosedur deploy: `v3NetbillAgent/README.md`.

### ⚠️ Empat jebakan rendering yang HANYA terlihat dari screenshot (1 Okt)

Semuanya ketahuan **setelah** MSI terpasang di PC kasir dan difoto, bukan dari
membaca kode. `dotnet build` lulus untuk keempatnya. Kalau ada sesi berikutnya
yang mengubah XAML, periksa empat hal ini lebih dulu — semuanya sudah diperbaiki
di commit `a4a4f16` dan `38d90a9`.

1. **Elemen di luar cabang visibility tidak ikut disembunyikan.**
   `WallpaperVeil` (lapisan putih di atas wallpaper) hanya memanggil
   `SinkronkanVeil()` di cabang `locked`. Begitu pengguna login dan
   `OverlayBackground` di-`Collapsed`, **veil 62% tetap menggantung di atas
   seluruh desktop** dan layar terlihat washed out. Perbaikannya: panggil
   **sekali di akhir `UpdateVisibility()`**, bukan per cabang.

2. **`DropShadowEffect` = kotak, bukan bayangan, di bawah RDP.**
   Tanpa GPU, WPF memakai software rendering dan `BlurRadius` tidak lagi
   diburamai. Hasilnya **kotak transparan dengan tepi tajam** tepat di sekeliling
   elemen — terlihat di mini panel. Efeknya dihapus; batas 1px + panel putih
   sudah cukup memisahkan dari desktop. Kalau perlu bayangan halus, jangan
   pakai `DropShadowEffect` di sini.

3. **`Margin` pada `Border` = ruang DI LUAR panel, bukan jarak di dalam.**
   Dialog ganti password menaruh `Margin="24,20"` di Border, jadi caption dan
   ketiga field **nempel di tepi panel putih** sementara judul di header punya
   jarak. Yang benar: `Padding` di Border. (Kartu login tidak terpengaruh —
   di sana header pakai `Padding` dan body pakai `Margin`.)

4. **Dua anak dari `StackPanel` yang sama tampil bertumpuk, bukan layering.**
   `LoginCard` dan `PinDialog` sama-sama anak `ContentPanel`. `ShowPinDialog()`
   yang hanya mengubah `Visibility` PinDialog membuat keduanya tampil
   vertikal. Setelah-dialog yang menutup **HARUS** mengembalikan `LoginCard`,
   kalau tidak layar login jadi kosong tanpa jalan keluar.

**Yang berubah dari 1 Okt:** tema terang. Semua permukaan (kartu login, mini
panel, dialog PIN, dialog ganti password, jendela uninstall) memakai panel putih
+ header pastel `#E0F7FA` + teks slate, mengikuti kartu PC di aplikasi web. Aksen
teal `#00D4AA` tetap dipakai untuk LOGIN, fokus field, dan garis timeline hijau.
Latar layar penuh tetap wallpaper dari Pengaturan, tidak ada gambar baru yang
dikirim ke PC kasir — hanya ditambah **veil putih** di atasnya supaya wallpaper
gelap tidak membuat kartu putih terlihat seperti tempelan.

⚠️ **Teks `maintenance` (mode teknisi) memakai `#45FFFFFF` — putih transparan
yang HILANG TOTAL di atas wallpaper terang.** Sudah diubah ke `#450F172A`. Kalau
nanti theme diganti lagi, cek semua warna berawanan alpha atau dengan lantain.

⚠️ **Resource bersama harus di `App.xaml`**, bukan `Window.Resources`:
`FieldInsetBrush`, `FieldCaptionStyle`, `PillPasswordTemplate`. Kalau dipindah ke
dalam `Window.Resources`, jendela terpisah tidak akan menemukannya saat runtime.
`OverlayTextStyle` sudah dihapus — dipakai tidak lagi setelah teks diganti jadi
warna eksplisit.

### Redesign UI Agent Client (27 Sep) ✅ `e0c1908` — ⚠️ TELAH DIGANTI

> **Bagian ini sudah usang.** Seluruh desain gelap (kartu `#1A1A22`, header Uiverse,
> aksen teal di atas latar gelap) digantikan tema terang pada 1 Okt. Bagian ini
> disimpan sebagai sejarah saja, bukan spesifikasi yang harus diikuti. Yang berlaku
> sekarang: bagian "Empat jebakan rendering" di atas.


⚠️ **Penting: ada DUA kartu sesi, dan hanya satu yang pernah tampil.**
`CountdownCard` (`MainWindow.xaml:36-70`) adalah **dead code** — satu-satunya baris kode
yang menyentuhnya `MainWindow.xaml.cs:181` selalu `Collapsed`, dan kartu itu ada di dalam
`ContentPanel` yang di-collapse saat sesi aktif. Isinya juga 100% statis tanpa binding.
**Sudah dihapus di `c0e6852`.** Kartu yang benar-benar tampil saat sesi berjalan = `MiniPanel`.

**Login card** (`MainWindow.xaml`, gaya Uiverse + aksen teal):
- Card `#F21A1A22`, radius 20, padding `34,30`
- Field bentuk pil (radius 23, tinggi 46) — bukan lebar tetap 280px + label 70px lagi
- Ikon (Path Geometry) + caption kecil 11px di atas field
- **Inset shadow**: WPF tidak punya inner shadow, dipakai `LinearGradientBrush`
  `FieldInsetBrush` (gelap di atas → memudar ke bawah). Alternatif yang lebih akurat
  adalah Border bersarang, tapi butuh 3-4 elemen.
- Border field menyala teal saat `IsKeyboardFocusWithin`
- `hover scale` dari CSS asal **sengaja tidak dipakai**: di layar lock, cursor masuk form
  akan menggeser posisi field → risk klik keliru

**Mini panel** (300px, gaya audio player):
- **Lingkaran 72px = tombol stop sesi** (ikon kotak stop + label "STOP"). Tombol
  "STOP SESI" yang terpisah sudah dihapus.
- Countdown 46px dipindah ke bawah baris lingkaran+identitas supaya tetap terbaca dari jauh
- Baris kanan lingkaran: `AKUN` (label 10px), `AkunLabel` (judul 16px),
  `PcLabelText` (subjudul 12px) — diisi `PcId` dari registry via `MainWindow.SetPcLabel()`
- Timeline 4px, ujung membulat lewat `Border` + `ClipToBounds`. **Template `ProgressBar`
  bawaan sengaja tidak diganti** agar binding `ProgressPercent` dari server tetap andal.
- **Warna timeline ikut sisa waktu** (properti baru di `SessionStateProxy.cs`):
  | Ambang | Warna |
  |---|---|
  | `>= 60%` | hijau `#2FBF71` (`IsWaktuAman`) |
  | `30% – 59%` | kuning `#F0B429` (`IsWaktuSedang`) |
  | `< 30%` | merah `#FF5252` (`IsWaktuKritis`) |

⚠️ **Jangan pernah pakai animasi dekoratif untuk progress bar.** CSS Uiverse memakai
`scaleX(0→1)` selama 10 detik looping — itu **tidak terkait sisa waktu sama sekali**.
Di aplikasi billing, bar yang bergerak sendiri adalah **kerugian nyata**: customer
melihat bar menunjukkan "hampir habis" padahal masih 1 jam. Nilai bar harus selalu dari
`ProgressPercent` server.

**Akses mode teknisi disembunyikan**: tombol "Admin PIN" 110x36 diganti teks samar
`maintenance` 11px `#45FFFFFF` di kiri bawah, tanpa bentuk tombol, tetap diklik membuka
dialog PIN (`ShowPinDialog`, logikanya tidak diubah).

⚠️ **WPF: `Background="Transparent"` TIDAK cukup untuk menghilangkan bentuk tombol.**
Template bawaan (Aero2) punya trigger `IsMouseOver` **di dalam `ControlTemplate` itu
sendiri** yang menggambar background terang. Harus dipasang `ControlTemplate` minimal
(isi `ContentPresenter` saja) supaya tidak ada yang bisa menggambar. Field `Foreground`
harus ditaruh di dalam `Style` — kalau ditulis sebagai atribut biasa, atribut itu menang
dan trigger hover mati diam-diam.

**Stop sesi 1 klik** (`9e0741f`): konfirmasi 2 langkah dihapus, field
`_stopConfirmArmed` / `_stopConfirmAt` dihapus. Penjaga "pipe belum tersambung"
**tetap dipertahankan** — itu kondisi teknis, bukan konfirmasi.

⚠️ **Dialog apa pun TIDAK BOLEH diletakkan di dalam `ContentPanel`.** `ContentPanel`
di-`Collapsed` setiap kali sesi berjalan (`MainWindow.xaml.cs#UpdateVisibility`, cabang
`sessionActive`), jadi apa pun yang ada di dalamnya ikut lenyap bersama. Dialog `BuatPasswordDialog`
semula diletakkan di sana: tombolnya sudah benar-benar mengubah `Visibility` jadi `Visible`, tapi
karena induknya tertutup, hasilnya **tidak terlihat sama sekali** — gejalanya persis seperti
tombol yang mati. Dialog yang perlu muncul saat sesi berjalan harus jadi anak langsung
`x:Name="RootGrid"`, sama seperti `MiniPanel`, dan diletakkan **paling akhir** supaya tidak
tertimpa elemen lain. Jangan lupa `HorizontalAlignment`/`VerticalAlignment="Center"`, karena tanpa
itu Border di dalam Grid akan merebut seluruh tinggi jendela. Diperbaiki di `39c6504`.

⚠️ **Saat sesi berjalan, overlay hanya 340x268** (`UpdateWindowState`, cabang
`SisaDetik > 0`) — bukan layar penuh. Dialog yang dimunculkan saat sesi berjalan
harus muat di ukuran itu. Dialog ganti password punya lebar 380 dan tinggi ~373,
jadi bagian bawahnya keluar dari tepi window: karena `VerticalAlignment="Center"`,
field "ULANGI PASSWORD BARU" dan tombolnya terpotong **tepat di batas bawah**.
Tampakannya seperti dialog tidak lengkap, dan ini lebih buruk dari bug pertama —
`ResizeMode="NoResize"` membuat jendela tidak bisa diperbesar sendiri, tombol
BATAL ikut terpotong, sehingga **pengguna terkunci di dialog yang tidak bisa
ditutup**. Solusinya dua sisi: `Width`/`Height` window dibesar sementara selama
dialog terbuka lalu dikembalikan saat ditutup (`908c1c8`), **dan** dialog wajib
punya minimal dua jalur keluar (tombol tutup + `Key.Escape`) sebagai pengaman.
Jangan andalkan satu tombol saja — kalau layout-nya salah lagi, pengaman itu
yang menyelamatkan.

Ukuran mini **harus ditulis sebagai konstanta**, bukan dibaca dari properti
`Width`/`Height` di constructor: properti itu masih bernilai `0` sebelum
`InitializeComponent()` jalan, jadi akibatnya window 0x0 saat dialog ditutup.

⚠️ **Memperbesar window overlay BUKAN solusi yang bisa diandalkan** (`f7de14e`).
`UpdateWindowState()` dipanggil ulang setiap ada `StateUpdate` dari service
dan selalu memaksa ukuran `340x268`, jadi perubahan ukuran yang dilakukan
saat dialog dibuka bisa langsung ditimpa lagi. Gejalanya: dialog tetap
terpotong, BATAL ikut terpotong, dan karena `ResizeMode="NoResize"` pengguna
terkunci — dialog baru terlihat utuh setelah waktu habis, karena saat lock
layar jendela diperbesar ke layar penuh.

**Dialog yang muncul saat sesi berjalan harus jadi `Window` terpisah**
(`BuatPasswordDialogWindow.xaml`), bukan Border di dalam `MainWindow`:
ukurannya menyesuaikan sendiri, tidak tersentuh `UpdateWindowState()`, dan
tidak bisa terpotong elemen mana pun. Dialog juga wajib ditutup otomatis saat
sesi berakhir — kalau tidak, pengguna melihat layar yang menggantung tanpa ada
yang bisa dilakukan. Tombol `IsCancel="True"` otomatis memberi jalur keluar
ESC tanpa perlu handler manual.

Resource yang dipakai lebih dari satu jendela (`FieldInsetBrush`,
`FieldCaptionStyle`, `PillPasswordTemplate`) **harus di `App.xaml`**. Yang ada
di `Window.Resources` hanya terlihat oleh jendela itu sendiri, jadi jendela
baru akan gagal menemukannya saat runtime.


⚠️ **`GetValue<string>(0)` dari ack Socket.IO TIDAK bisa dipakai kalau jawabannya
objek** (`2ef0689`). Argumen ack dari NestJS adalah objek, jadi pemanggilan itu
melempar `JsonException: The JSON value could not be converted to System.String`.
Karena ada `catch (JsonException) { return null; }`, fungsi balik **sebelum sempat**
memakai cabang cadangan `RawText`. Akibatnya agent selalu mendapat `null`, dan
`Worker.cs` memetakan `null` ke pesan generik — sehingga **berhasil maupun gagal
sama-sama tampil "Gagal mengganti password"**. Cabang `RawText` juga tidak bisa
karena isinya isinya berbentuk larik `[{...}]`, sedangkan yang dibutuhkan objek tunggal.
Yang benar: `GetValue<JsonElement>(0).GetRawText()`.

Gejalanya sangat menyesatkan karena **password-nya benar-benar berubah** di server.
Satu percobaan tercatat SUKSES di `docker compose logs` sementara user melihat
teks gagal, dan percobaan berikutnya dengan password lama yang sudah diganti ikut
gagal. Dua sisi yang harus dicek: (a) apakah request benar-benar sampai dan
dijawab server — `SessionGateway` me-log tiap `create_password`, jadi log itu
bukti mandiri; (b) apakah client benar-benar membaca jawabannya.

Cara membuktikannya tanpa menebak: program uji kecil yang memakai
`CreatePasswordResultPayload` asli dari `Agent.Core` lalu memanggil server
sungguhan, mencetak ketiga bentuk baca ack. Struktur SocketIOClient 4.0.5 bisa
dicek tanpa menebak lewat `GetTypes()` + reflection, atau dengan probing
compiler — jangan menulis `GetValue<T>(0)` sambil menebak tipe generiknya.

⚠️ **Log agent ada di `C:\ProgramData\v3NetbillAgent\logs\agent.log`** — bukan
`AgentLog.txt` (nama itu nama kelasnya). `Environment.SpecialFolder.CommonApplicationData`
bukan `LocalApplicationData`, jadi path-nya `ProgramData`, bukan folder user.

**Ganti password dipindah ke mini window** (`a1e5211`): semula tombolnya ada di
layar login, padahal saat itu belum ada akun yang dipakai — tidak masuk akal. Sekarang tombol
`GANTI PASSWORD` ada di mini window, jadi **hanya tampil saat sesi berjalan**, dan yang menekan
memang pemilik akun itu sendiri. Dialognya 3 isian: password lama, baru, ulangi baru; kolom
lama diberi petunjuk nilai `0000` selama belum pernah diganti. Password lama ikut dikirim dan
dicocokkan di server. Kode PC dihapus dari mini window (`PcLabelText` + `SetPcLabel()` dibuang),
dan kode untuk ganti password diambil dari `SessionStateProxy.AkunKode`/`AkunNama`, bukan dari
kolom login.

## FASE 8 — Mobile app (Flutter Android) ✅

Repo keempat, terpisah: `git@github.com:41zz-2807/v3netbill-mobile.git` (public).
Checkout di host: `/home/warnet/docker/v3netbill/v3netbill-mobile` — sudah dipindahkan
ke dalam satu folder project pada 27 Sep, sebelumnya di `/home/warnet/mobile/`.
Build memakai image `mobiledevops/flutter-sdk-image:3.44.4` (10.7 GB) + cache mount
`/home/warnet/cache/pub` & `/home/warnet/cache/gradle`. Tidak ada Flutter di host — semua
lewat `docker run`.

### Dua skrip pembantu di root project

`dk` dan `fl` ada di `/home/warnet/docker/v3netbill/`, bukan di dalam repo (jadi tidak
ikut ter-commit). Keduanya memanggil `docker run` dengan mount yang sama:

```
dk <args>                 -> dart, untuk analyze / test / perintah dart lain
fl analyze|test|build ... -> flutter, mis. ./fl analyze
```

⚠️ **Kalau repo mobile dipindah lagi, dua skrip ini wajib ikut diperbarui** — keduanya
hardcode `-v /home/warnet/docker/v3netbill/v3netbill-mobile:/app`. Tidak ada cron,
systemd, atau container yang mengaitkan path itu, jadi selain `dk`/`fl` tidak ada lagi
yang perlu disentuh.

### Token GitHub

Disimpan di `github-token.txt` di **root repo mobile**, izin `600`, dan sudah masuk
`.gitignore` (baris 36). Repo ini public, jadi file itu **tidak boleh** pernah ikut
commit. Pakai: `GH_TOKEN="$(cat github-token.txt)" gh ...`.

- **Fitur**: login + `flutter_secure_storage`, Dashboard/Home, Voucher, Member, Profile, Logout.
  Dark mode, status hijau/oranye/merah, bottom navigation 3 tab, realtime Socket.IO.
  PC: Start / **Akhiri Sesi** / Matikan. Akun: buat voucher & member, search, bulk select,
  Topup, Koreksi/Tarik, Revoke.
- **Halaman PC dan halaman Transaksi sudah dihapus** (27 Sep). Semua PC sudah tampil di
  dashboard, jadi tab PC hanya menduplikasi isi yang sama. Navigasi jadi Home / Voucher /
  Profile. `lib/features/transactions/` dihapus seluruhnya.
- **Heartbeat tidak lagi punya baris sendiri.** Sempat diganti jadi icon komputer kecil,
  tapi itu salah karena kartu PC sudah punya icon komputer di sebelah kiri nama PC — jadi
  ada dua icon dalam satu kartu. Sekarang heartbeat cuma terlihat dari **warna icon yang sudah
  ada**: hijau kalau agent heartbeat < 30 detik, kembali ke warna status PC kalau sudah
  lama tidak heartbeat (`Pc.heartbeatSehat` di `models/pc.dart`).
- **Semua path URL wajib `/api`**: base URL sudah memuat `/api` di akhirnya
  (`api_config.dart`), jadi pemanggil cukup `'/pcs'`, bukan `'/api/pcs'`.
- **Namespace WebSocket adalah `/session`, bukan `/socket.io`.** Ini kesalahan yang sudah
  pernah terjadi: string `/socket.io` yang muncul di `libapp.so` itu default library
  socket_io_client sendiri, bukan konfigurasi kita. Cara memastikan = `strings`/grep
  `wss://v3netbill.bilmary.my.id/session` di `lib/arm64-v8a/libapp.so`.
- **Operator tidak boleh pakai `client:stop_session`** — event itu hanya untuk agent PC
  (butuh `pcId` + `agentToken`). Operator memakainya `dashboard:lock_pc`, yang sekaligus
  juga mengakhiri sesi. Event operator: `dashboard:subscribe`, `dashboard:start_pc`
  (payload `{pcId,kode}` — tanpa password), `dashboard:lock_pc`, `dashboard:shutdown_pc`.
- **Kredensial sesi untuk member itu `nama`, bukan kode.** Backend mencari akun dari
  `kodeUnik` dulu, lalu jatuh ke pencocokan `nama` (`session.service.ts:198-205`). Member
  memang tidak punya `kodeUnik` sama sekali — data server menunjukkan 17 dari 17 member
  punya kolom itu kosong. Jadi kalau membuat member lalu langsung memulai sesi, yang
  dikirim adalah `nama`, bukan `kodeUnik`. Ini sudah diuji ke backend sungguhan.
- **Animasi dashboard yang bergerak sendiri dihapus.** Untuk aplikasi billing, angka yang
  beranimasi tanpa sumber data = menampilkan info yang salah.
- **Bar aksi di halaman Voucher/Member sekarang ikon saja** (`f1457cc`). Versi lama
  berisi teks "N dipilih" + 4 chip berlabel, dan total lebarnya melebihi layar HP —
  Flutter melaporkan `RenderFlex overflowed by 261 pixels` pada lebar 390 px. Sekarang
  5 `IconButton` dengan tooltip (`spaceEvenly`), dan teks jumlah terpilih dihapus.

⚠️ **Widget test dengan lebar default TIDAK bisa menangkap overflow.** `flutter test`
memakai permukaan 800×600, cukup lebar untuk `Row` mana pun. Bug seperti ini baru
tampak setelah `tester.view.physicalSize = Size(390*3, 844*3)` + `devicePixelRatio = 3.0`.
Selalu uji halaman yang diduga meluber pada **lebar HP**, bukan lebar default.
Widget test juga bisa dipakai untuk menyimpan tangkapan layar
(`RepaintBoundary` + `toImage`) — tapi `toImage()` harus **di-await** di dalam test,
kalau tidak test selesai dulu dan berkasnya tidak pernah tertulis.

### ⚠️ `intl` WAJIB diinisialisasi sebelum `runApp` (bug yang pernah ada)

`Formatters` memakai `DateFormat('d MMM', 'id_ID')`, tapi paket `intl` **tidak** memuat
data locale secara otomatis. Tanpa `await initializeDateFormatting('id_ID', null)` di
`main()`, setiap pemakaian `DateFormat` melempar `LocaleDataException`.

Akibatnya dashboard dan daftar voucher/member **tampil kosong tanpa pesan error apa pun**,
karena setiap kartu gagal dibangun. Tombol aksi ikut hilang karena tidak ada kartu untuk
dipilih. Nomor format (`rupiah`) dan `duration` tidak terpengaruh karena tidak butuh
data locale — itu sebabnya bug ini sempat tidak ketahuan.

Tes regresi ada di `test/accounts_page_test.dart` (memakai 97 akun nyata dari server
sebagai fixture `test/fixture_accounts.json`) supaya masalah yang sama tidak muncul lagi
tanpa terdeteksi.


## Pembaruan diri aplikasi Android (30 Sep) ✅

Aplikasi mengecek versi sendiri di backend dan bisa mengunduh + memasang APK tanpa
peramban. Kasir tidak perlu membuka browser lagi.

### Bagian yang WAJIB ada dulu: nomor versi

⚠️ **Sebelum 30 Sep, APK mana pun yang dibangun punya `versionCode = 1` dan
`versionName = 1.0.0`** — termasuk 12 build di CI. `pubspec.yaml` ditulis
`version: 1.0.0+1` dan tidak pernah dinaikkan, dan workflow CI tidak mengoper
`--build-name`/`--build-number` sama sekali. Akibatnya **tidak ada satu pun
angka yang bisa dibandingkan**, jadi fitur cek pembaruan secara harfiah tidak
mungkin ada. APK terpasang saat itu sudah dibaca `aapt2`: `versionCode='1'`.

Sekarang workflow CI mengoper:

```
--build-name="$BUILD_NAME"    # 1.0.<run_number>
--build-number="$BUILD_NUMBER" # <github.run_number>
```

Ditambah step **"Pastikan nomor versi benar-benar masuk ke APK"** yang memanggil
`aapt2 dump badging` dan **gagalkan build** kalau `versionCode` di APK tidak sama
dengan yang dimaksud. Ini bukan formalitas: tanpa itu, "build succeeded" tidak
berarti nomor versinya benar, dan seluruh HP kasir akan menampilkan penanda
"pembaruan tersedia" yang tak pernah bisa dibersihkan. Step-nya sengaja
ditempatkan **setelah** "Kumpulkan APK", karena berkas yang diperiksa baru ada
setelah langkah itu.

⚠️ **Ruang nomor CI dan lokal sudah DIPISAH (30 Sep).** Sempat keduanya
pakai ruang yang sama dan bentrok sungguhan: build lokal memakai 13/14/15, CI juga
menghasilkan 13/14/15. Akibatnya **artifact CI bernomor 13 tidak bisa dipasang
di HP yang sudah punya 15** (Android menolak downgrade), dan dua APK berbeda
sama-sama mengklaim `versionCode 13`.

Sekarang **CI memakai `1000 + run_number`** (terbukti: run 14 → `versionCode 1014`),
sedangkan build lokal untuk uji coba tetap di bawah 1000. Konsekuensi yang
disengaja: APK dari CI selalu dianggap lebih baru oleh build lokal mana pun, dan
itu benar karena APK CI adalah rilis sungguhan.

Aturan praktis: **jangan pernah mengunggah APK bernomor lebih kecil ke server**,
dan jangan mengayangkan artifact CI ke HP yang sudah punya build lokal. Yang
benar-benar mengidentifikasi sebuah APK adalah **sha256-nya**, bukan nomornya.

### Backend: baca versi + sha256 dari dalam APK

- Dependensi baru: **`app-info-parser`** (MIT, tanpa native module, dependensinya
  semuanya pure JS). Tipe ditulis manual di `backend/src/types/app-info-parser.d.ts`
  karena paketnya **tidak punya `.d.ts` di npm** — `npm i @types/app-info-parser`
  akan 404.
- `ApkMeta` (di `settings.service.ts`) menambah `versionCode`, `versionName`,
  `sha256`. Semuanya diisi di `saveApk()` dengan membaca **berkas yang diupload**,
  bukan dari nama berkas dan bukan dari input orang.
- `sha256` dihitung dari berkas memakai `createHash('sha256')` bawaan Node.
- Import-nya `import AppInfoParser from 'app-info-parser'` (default import).
  **Jangan pakai `import AppInfoParser = require(...)`** — project ini ESM
  (`"type": "module"` + module `nodenext`) dan import-equals ditolak TypeScript.
- Kalau parser gagal, **unggahan TIDAK digagalkan**: `versionCode` jadi `null`
  plus `logger.warn`. APK-nya tetap berguna untuk unduh manual, dan aplikasi
  menampilkan "versi tidak terbaca". Gagalkan unggahan berarti kasir kehilangan
  satu-satunya jalan getting out.

⚠️ **`parse()` mengembalikan `Promise`, bukan objek.** Dipanggil tanpa `await`,
`r.versionCode` selalu `undefined` dan hasilnya `{}` — terlihat seperti "APK-nya
rusak" padahal bukan. Dan `versionCode` bisa berupa **string**, jadi selalu
`Number()`-kan hasilnya. Ini sempat hampir membuat parser dianggap salah.

⚠️ **`META-INF/com/android/build/gradle/app-metadata.properties` TIDAK memuat
versi** — hanya `appMetadataVersion` dan `androidGradlePluginVersion`. Sudah dicek
langsung di dalam APK. Satu-satunya sumber nomor versi adalah
`AndroidManifest.xml` biner (format AXML), dan itu yang diurai paket tersebut.
Hasilnya sudah dicocokkan dengan `aapt2` untuk dua APK dan identik.

### Backend: endpoint `GET /api/settings/apk/info`

```
{ ada, versionCode, versionName, ukuranBytes, sha256, tanggalUpload }
```

Terverifikasi 30 Sep: 401 tanpa token, 200 dengan token admin **dan** kasir,
body **192 byte**. Wajib JWT karena siapa pun yang bisa mengunggah APK otomatis
berhak memasang apa pun di setiap HP warnet.

### Android: pasang APK (Kotlin sendiri, bukan paket)

⚠️ **`install_plugin` TIDAK bisa dipakai di project ini.** Manifestnya masih
`package="com.example.installplugin"`, yang adalah **error keras sejak AGP 8**,
dan `android/build.gradle`-nya masih `compileSdk 28` tanpa `namespace`. Project ini
AGP **9.0.1**. Kalau paket ini ditambahkan, build gagal dengan
`processReleaseManifest`. Jangan mencobanya.

Solusinya ~150 baris sendiri di
`android/app/src/main/kotlin/com/v3netbill/v3netbill_mobile/MainActivity.kt` +
MethodChannel `v3netbill/install`. Konsekuensinya: zero dependensi yang bisa rusak
dan seluruh kode bisa dikompilasi di CI.

- `AndroidManifest.xml`: permission `REQUEST_INSTALL_PACKAGES` + `<provider>` FileProvider
  dengan authority `${applicationId}.fileprovider` + `res/xml/file_paths.xml`
  (hanya `cache-path`/`external-cache-path`/`files-path`, **tanpa `root-path`**).
  Ditambah satu `<queries>` untuk `ACTION_VIEW` + mime APK, karena Android 11+
  menyembunyikan installer kalau tidak dinyatakan.
- ⚠️ **`FlutterActivity` extends `Activity`, bukan `ComponentActivity`.** Jadi
  `registerForActivityResult` **tidak ada** dan build gagal dengan
  `Unresolved reference`. Pakai `startActivityForResult` + `onActivityResult`.
- ⚠️ **`resultCode` dari layar Pengaturan izin tidak boleh dipakai.** Android
  mengembalikan `RESULT_CANCELED` baik saat izin dinyalakan maupun ditolak, jadi
  satu-satunya sumber kebenaran adalah `canRequestPackageInstalls()`. Mengambil
  `resultCode` akan membuat alur terasa macet padahal izinnya sudah menyala.
- `onDestroy()` mengirim status `dibatalkan` kalau masih ada `MethodChannel.Result`
  yang menggantung — kalau tidak, sisi Dart menunggu selamanya.
- Empat status: `diterima`, `dibatalkan`, `izin_ditolak`, `gagal`. `dibatalkan`
  itu **pilihan pengguna, bukan kegagalan**, dan berkas sengaja dibiarkan supaya
  menekan "Pasang" lagi tidak mengunduh 54 MB dari nol.

### Sisi Dart

```
lib/core/apk/info_apk.dart        model + parser jawaban server
lib/core/apk/apk_repository.dart   cek info, unduh + verifikasi hash
lib/core/apk/apk_installer.dart  ungkus MethodChannel
lib/core/apk/update_provider.dart  semua state dan alur
lib/core/apk/view/update_card.dart kartu, dipakai Home saja (30 Sep)
```

- `UpdateProvider` di-*inject* lewat `main.dart`; pengecekan versi dipicu dari
  `DashboardPage` `addPostFrameCallback`, **bukan** dari `initState` (yang tidak
  boleh memanggil Future tanpa await) dan bukan dari provider itu sendiri
  (supaya tidak jalan sebelum pengguna login).
- Perbandingan: `versionCode` server `>` milik sendiri. Kalau server lebih tua,
  tidak ada yang ditawarkan — itu mencegah Android ditolak karena downgrade.
- ⚠️ **Kalau nomor versi tidak terbaca, `adaPembaruan` WAJIB false** dan
  `alasanTidakBisaDicek` menjelaskan kenapa. Menebak "ada pembaruan" saat tidak
  ada buktinya menghasilkan penanda permanen yang tidak bisa dibersihkan. Ada test
  khusus untuk ini.
- Unduhan: `_api.raw.download` (bukan `Dio()` baru) supaya interceptor token ikut;
  `receiveTimeout` dinaikkan ke 15 menit karena bawaannya 20 detik dan berkasnya
  54 MB. Timeout bawaan juga harus **dinaikkan di `Options`**, bukan hanya di
  `BaseOptions`.
- **Hash dicek dua kali**: ukuran dari `content-length`/field `ukuranBytes`, lalu
  `sha256` dari berkas. Unduhan yang terpotong tidak akan pernah diserahkan ke
  installer. Berkas ditulis `.part` lalu di-`rename` hanya setelah lolos — kalau
  prosesnya mati di tengah, berkas sisa tidak akan terbaca sebagai "siap dipasang".
- Indikator: titik merah kecil di pojok ikon tab **Profile** (`_Badge` di
  `app_shell.dart`, dibuat sendiri karena `Badge` bawaan tidak bisa `const` di
  dalam `const` list) + kartu di Home (`UpdateCard(ringkas: true)`).
- ⚠️ **Kartu pembaruan di Profile DIHAPUS 30 Sep, hanya di Home sekarang.**
  Alasannya Notification, bukan tampilan: kartu itu memunculkan "Pembaruan
  tersedia" + tombol **Perbarui sekarang** di dua halaman yang berdekatan
  (Home dan Profile), jadi kasir yang membuka Profile endoscopy punya dua salinan
  dari hal yang sama. Yang tersisa di Profile cuma baris **Status** di kartu info
  (`Ada versi 1.0.18` / `Siap dipasang` / `Terbaru`) plus titik merah di tab —
  kasir tetap tahu ada versi baru, dan tetap bisa mengetuk Home untuk memasang.
  Import `update_card.dart` di `profile_page.dart` ikut dibuang; `update_provider.dart`
  masih dipakai (untuk `context.select` versi + `TahapPembaruan`).
  Tes: `test/profile_page_test.dart` "halaman Profile tidak menampilkan kartu
  pembaruan" — memakai `versionCode` server yang **lebih besar** dari terpasang,
  karena dengan versi sama kartu memang tidak muncul juga sehingga tesnya tidak
  membuktikan apa pun.
- Halaman Profile menampilkan versi dari `package_info_plus`, bukan teks
  hardcode. Sebelumnya tertulis `'1.0.0'` yang sudah basi sejak build pertama.

### Verifikasi 30 Sep

- 36 test lulus (`./fl test`), `analyze` bersih. 11 test `update_provider_test.dart`
  (versi lebih baru/sama/lama/tidak terbaca/gagal, semua jalur installer) dan 3
  test `update_card_test.dart` yang **wajib di lebar HP 390 px** — `flutter test`
  memakai permukaan 800×600 yang terlalu lebar untuk menangkap `RenderFlex
  overflowed`.
- Build `aapt2 dump badging`: `versionCode='15' versionName='1.0.15'`, permission
  dan FileProvider ada, `xml/file_paths` terdaftar di resource table (nama
  berkasnya di-obfuscate jadi `res/8K.xml` oleh resource shrinking — itu normal).
- Tanda tangan `CN=v3Netbill`, sertifikat SHA-256 `d38e3993…7d880e` — **identik**
  dengan APK yang sudah terpasang di HP kasir. Ini yang membuat update in-place
  dari `versionCode 1` ke `15` diterima Android, bukan ditolak
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. Kalau sertifikatnya berbeda, semua HP
  harus uninstall dulu dan kasir harus login ulang.
- Upload ke server → `apk_meta` terisi `versionCode 15`, `sha256` cocok dengan
  `sha256sum` yang dihitung terpisah.
- ✅ **TERBUKTI DI HP SUNGGUHAN, 30 Sep.** Dua kali berturut-turut: 15→16 lalu
  16→17, keduanya lewat tombol "Perbarui" di dalam aplikasi tanpa peramban.
  Setelah dipasang, Profile menampilkan versi baru dan penanda menghilang
  dengan sendirinya. Jadi unduhan 54 MB, verifikasi sha256, layar izin
  "Pasang aplikasi tidak dikenal", dan installer Android **semuanya bekerja**.
  Ini menutup bagian yang tadinya mustahil dibuktikan dari Linux.
- APK aktif di server per 2 Okt: `versionCode 1023` (`1.0.1023`), universal,
  55.527.893 byte, `sha256 2e854f2b…`, dari artifact CI run `37026237394`.
  Sertifikat `CN=v3Netbill` SHA-256 `d38e3993…` — identik dengan keystore
  rilis dan dengan APK yang sudah terpasang di HP kasir.
  ⚠️ Nomor itu adalah `1000 + run_number`. **Rilas selalu dari artifact
  CI** — build lokal selalu bernomor `1`, dan mengunggahnya merusak pembaruan
  untuk semua HP. Pelajaran no. 22.

### Perbaikan input dari pemakaian nyata (30 Sep, versi 1.0.17)

Empat masalah yang dilaporkan setelah dipakai di HP, bukan dari baca kode:

1. **Tombol "Voucher"/"Member" di dialog Mulai Sesi** punya huruf terakhir yang
   turun ke baris kedua ("Vouche", "Membe") pada 390 px. Penyebabnya **dua lapis**,
   dan lapis kedua sama sekali tidak terlihat tanpa mengukur:
   - `Expanded` di dalam `Row` memaksa kedua tombol selebar sama, dan lebar itu
     tidak cukup untuk ikon + teks.
   - `Column` di dalam `AlertDialog` memakai `crossAxisAlignment: center`, jadi
     anaknya dapat batasan longgar. Akibatnya `Wrap` **hanya dapat 139px dari
     262px yang tersedia** — ia menyusut jadi selebar anaknya yang terlebar.
   Solusinya: `Wrap` + `maxLines: 1, softWrap: false`, dibungkus
   `SizedBox(width: double.infinity)`, padding 8, ikon 15, spasi 8. Dihitung:
   130 + 8 + 117 = 255px dari 262px. **Angkanya ditulis di komentar kode** supaya
   tidak perlu diukur ulang.
2. **Kolom nominal terisi `10000` sejak awal.** Kasir bisa menekan Simpan tanpa
   membaca lalu membuat handout Rp 10.000 padahal maksudnya mungkin Rp 1.000.
   Sekarang kosong dengan petunjuk format.
3. **Pembatas nama member dan nominal.** Nama dibatasi 40 karakter **di level
   input, bukan dipotong saat dikirim** — nama member adalah kredensial sesi
   (`session.service.ts` mencocokkan `nama`), jadi memotongnya membuat pelanggan
   gagal login dengan nama yang berbeda dari yang tertulis di kartunya.
4. **Pemisah ribuan** di semua form nominal: buat voucher, buat member, topup,
   dan tarik. Semuanya lewat satu formatter.

⚠️ **Batas nama 40 dan nominal 8 digit itu penjaga tampilan, BUKAN aturan
server.** Sudah diperiksa ke DTO: `nominal` hanya `@IsInt() @Min(500)` tanpa
batas atas, dan `nama` hanya `@IsString() @IsNotEmpty()` dengan kolom bertipe
`text`. Jadi API tetap menerima nilai yang lebih besar kalau ada yang mengirim
langsung. Kalau nanti mau jadi aturan server, itu perubahan backend terpisah.

⚠️ **`maxLength` pada `TextField` tidak bisa dipakai untuk membatasi digit.**
`maxLength` menghitung karakter, sedangkan "10.000.000" berisi 10 karakter tapi
8 digit — `maxLength: 8` akan membuat kasir berhenti di "10.000" padahal
angkanya belum selesai. Batas digit harus ditegakkan di dalam
`TextInputFormatter` (`FormatRibuan` di `lib/shared/utils/rupiah_input.dart`).

⚠️ **Pemisah ribuan membuat `int.tryParse` gagal.** Kolomnya berisi "10.000",
jadi harus lewat `parseNominal()` yang membuang pemisah dulu. Lupa hal ini menghasilkan "Nominal tidak valid" padahal kasir mengetik angka yang benar.

Semua ada tesnya: `test/rupiah_input_test.dart` (11) dan
`test/mulai_sesi_dialog_test.dart` (3, semuanya di lebar HP 390 px).

### Perataan baris info di halaman Profile (30 Sep, setelah 1.0.17)

Baris **Server / Versi aplikasi / Status** di kartu info Profile dilaporkan
tidak sejajar: nilai yang lebih pendek ("Terbaru") berhenti 18.5 px sebelum tepi
kanan, sementara yang lain sampai di tepi.

Penyebabnya **bukan styling, tapi cara Flutter membagi ruang**:
`Spacer()` + `Flexible()` di `Row`. Keduanya punya `flex: 1`, jadi ruang sisa
**dibagi 50/50** — bukan `Spacer` yang memakan seluruh sisa seperti yang
tersirat dari namanya. Nilai yang lebih pendek dari bagiannya lalu berhenti di
tengah dan tidak pernah sampai tepi kanan. Terukur di lebar 390 px:

| nilai | sebelum | sesudah |
|---|---|---|
| `v3netbill.bilmary.my.id` | right 357.0 | right 357.0 |
| `1.0.17` | right 357.0 | right 357.0 |
| `Terbaru` | **right 338.5** | right 357.0 |

Solusinya `Spacer()` dibuang, nilai jadi `Expanded` dengan `textAlign: right`.
`Expanded` (tight) memakai seluruh sisa ruang, lalu `textAlign` menaruh teksnya
di tepi kanan kotak itu. Efek sampingnya bagus: URL server yang sebelumnya
terpotong ellipsis karena cuma dapat setengah ruang, sekarang dapat seluruh sisa.

⚠️ **Jangan memakai `Spacer()` + `Flexible()` untuk "label kiri, nilai kanan".**
Polanya sangat menggoda dan kelihatan benar, tapi nilai yang pendek tidak
pernah sampai tepi kanan. Pola yang benar: label non-flex, nilai `Expanded`
+ `textAlign: right`.

Tes: `test/profile_page_test.dart` — 3 tes perataan (390/360/320 px) +
1 tes ketiadaan kartu pembaruan. Semua memakai `tester.view.physicalSize` 390 px
karena `flutter test` memakai permukaan 800×600 yang terlalu lebar untuk
menangkap masalah perataan. Tes perataan **sudah dibuktikan menangkap bug**:
dikembalikan ke kode `Spacer` + `Flexible` → gagal (`Expected: 357.0,
Actual: 338.5`).

⚠️ **Font di `flutter test` bukan Roboto.** Tiap glyph digambar selebar ukuran
font, jadi teks 14 px diuji jadi **2× lebih lebar** dari aslinya di HP
("Versi aplikasi" 199.5 px, di HP sekitar 62 px). Untuk asserts posisi tepi
tidak masalah, tapi jangan pernah memakai angka lebar teks dari test untuk
menyesuaikan ukuran layout di HP.

### Dialog "Mulai Sesi" hanya menerima angka — member tidak bisa dipakai (2 Okt)

Dilaporkan dari pemakaian nyata: dari kartu PC, dialog "Mulai Sesi" menampilkan
keyboard yang **hanya punya tombol angka**, jadi member dengan nama berhuruf
tidak bisa diinput.

Field `kodeCtrl` di `lib/features/pcs/view/widgets/pc_card.dart` menerima kode
voucher **dan** nama member, tapi dikonfigurasi seolah voucher saja:

```dart
maxLength: 6,
keyboardType: TextInputType.number,   // keyboard hanya angka
```

Jadi ada **dua cacat di satu field**, dan yang kedua lebih halus karena tidak
menolak — memotong. Nama member seperti "Budi Santoso" jadi "Budi S", lalu
server menjawab "Akun tidak ditemukan" tanpa petunjuk kenapa.

Mengapa member bisa lebih dari 6 karakter: member **tidak punya `kodeUnik`
sama sekali** (17 dari 17 member di server punya kolom itu kosong), jadi backend
mencari lewat `nama` (`session.service.ts`), dan `nama` boleh huruf, spasi,
sampai `maksKarakterNama` (40) — sama dengan batas di form "Buat Member".

⚠️ **Jangan tambahkan `textCapitalization` di field ini.** Backend
mencocokkan `nama` **tanpa** `mode: 'insensitive'` (`cariAkunAktif()` cuma
`where: { nama }`), jadi mengubah huruf saat diketik berisiko membuat nama yang
diketik berbeda dari yang tertulis di kartu pelanggan — gejalanya "Akun tidak
ditemukan" untuk nama yang dari sekilas jelas benar.

### ⚠️ Tes yang menyalin konfigurasi produksi bisa menutupi bug yang sama

`test/mulai_sesi_dialog_test.dart` menyalin field itu **apa adanya** dari
`pc_card.dart` — termasuk `maxLength: 6` dan `keyboardType: number`. Jadi
tiga tes di berkas itu lulus sementara aplikasinya tidak bisa menerima nama
member sama sekali.

Ini memperluas pelajaran no. 7 ("jangan percaya kode yang sudah dibaca") ke arah
sebaliknya: **tes yang menyalin nilai dari produksi tanpa memverifikasinya hanya
mengulang nilai itu.** Kalau nilai itu salah, tesnya mengabadikan kesalahannya
dan bersertifikat hijau.

Dua tes baru, dan keduanya **sudah dibuktikan menangkap bug** — dikembalikan
ke kode lama:

```
Expected: 'Budi Santoso'
Actual:   'Budi S'
Expected: not TextInputType.number
Actual:   TextInputType.number
```

Cara membuktikannya: kembalikan field ke `maxLength: 6` +
`TextInputType.number`, jalankan `./fl test test/mulai_sesi_dialog_test.dart`, dan
lihat kedua tes gagal dengan pesan di atas.

### Menonaktifkan akun harus menghentikan sesi yang sedang berjalan (30 Sep)

Dilaporkan dari pemakaian nyata: kasir membuat member, memulai sesinya di
sebuah PC, lalu menonaktifkan member itu dari halaman Member — **PC-nya tetap
jalan** sampai waktunya habis.

Penyebabnya bukan styling, tapi dua hal yang tidak terhubung:

1. `revoke()` hanya menulis `status: REVOKED`. Ia **tidak pernah menyentuh
   sesi** yang sedang berjalan.
2. Penolakan `account.status !== ACTIVE` di `loginRequest` hanya melindungi
   sesi **BARU**. Sesi yang sudah jalan tidak pernah dicek ulang statusnya —
   tidak di `revoke()` maupun di tick 1-detiknya.

Perbaikannya dua lapis, keduanya wajib:

- `SessionService.stopSessionsOfAccount(accountId)` dipanggil dari
  `accounts.service.ts#revoke()`. Ini yang membuat PC terkunci **seketika**,
  bukan menunggu giliran tick.
- Tick di `session.service.ts#startSessionTick()` memeriksa
  `session.account.status !== AccountStatus.ACTIVE`. Ini **pengaman** untuk
  perubahan status dari jalur lain, termasuk ubahan langsung di database.

Alasan barunya `akun_nonaktif`. ⚠️ **TIDAK butuh migrasi** — `Session` tidak
punya kolom `alasan` sama sekali; nilainya hanya ikut di payload
`ActivityLog.detail`. Yang perlu diperbarui hanya tipe di backend dan peta
`STOP_REASON` di `DashboardPage.tsx`.

Sisa waktu **dikembalikan** seperti penghentian manual. Akunnya
dinonaktifkan, bukan dibuang, jadi sisa yang sudah dibayar tidak boleh hilang.
Terbukti: saldo 12000 detik, dipakai 3 detik, revoke → `sisaWaktuDetik`
11997 dan baris sesi jadi `SELESAI`.

⚠️ **Bug kedua yang ketahuan waktu menguji yang pertama:** `createMember`
**mengizinkan** nama member yang sama kalau yang lama sudah `REVOKED` — tapi
`findAccountByKode` mencari tanpa memfilter status, jadi ia menemukan yang
lama dan menolak dengan "Akun tidak aktif". Member yang barusan dibuat jadi
**tidak akan pernah bisa login**. Perbaikannya `cariAkunAktif()`: cari yang
`ACTIVE` dulu, baru jatuh ke akun nonaktif kalau tidak ada. Fallback itu
sengaja dijaga supaya pesannya tetap "Akun tidak aktif", bukan "Akun tidak
ditemukan" — yang pertama jauh lebih berguna bagi operator.

### ⚠️ Tes TIDAK BOLEH memakai PC sungguhan

`registerAgent` **memutus** socket lama yang punya `agentToken` sama. Jadi
socket uji dan agent asli akan saling menendang, grace period habis, dan sesi
uji berakhir `disconnect_timeout` — bukan karena logika yang diuji. Selama
sesi pengujian notifikasi FCM, PC001 sungguhan sempat ditendang **13 kali
dalam 2 menit**. Buat PC uji sendiri dengan `agentToken` acak, lalu hapus
setelah selesai.

### ⚠️ Nama member adalah KREDENSIAL, jadi panjangnya dibatasi dua arah (4 Okt)

`session.service.ts` mencari akun dengan mencocokkan kolom `nama` **persis**
(`cariAkunAktif` tidak memakai `mode: 'insensitive'`). Jadi nama member bukan
sekadar tampilan — dia **kredensial login**-nya, dan nama 1-3 karakter terlalu
mudah ditebak orang lain di warnet.

`src/accounts/nama-member.ts` jadi satu-satunya sumber angka:

| Konstanta | Nilai | Arti |
|---|---|---|
| `MIN_KARAKTER_NAMA` | 4 | ditolak dengan pesan "Nama member minimal 4 karakter" |
| `MAKS_KARAKTER_NAMA` | 40 | mengikuti panjang kolom di database & form aplikasi |

⚠️ **Member yang sudah terlanjur dibuat tidak disentuh.** Validasi ini hanya
berlaku untuk pembuatan baru, jadi nama lama yang lebih pendek tetap login
seperti biasa. Men_chipbulk tidak ikut — hanya endpoint create yang membaca.

⚠️ **Batas bawah hanya di BACKEND, belum di form Flutter.** Kalau nanti form
"Buat Member" di APK masih menerima 1-3 karakter, kasir akan melihat pesan dari
server — bukan validation sebelum kirim. Itu tidak merusak apa pun, tapi lebih
baik ditegakkan juga di `TextField` APK (minimal 4) supaya umpan balik cepat.

## Cara upload APK dari aplikasi (30 Sep, versi 1.0.22) ✅

Voucher/Member sekarang punya tombol **Mulai di PC** di bar aksi, jadi kasir
tidak perlu naik ke Home hanya untuk mencari PC.

### ⚠️ Kredensial yang dikirim berbeda antara voucher dan member

Kode yang dikirim adalah `account.displayName`, yang untuk voucher berarti
`kodeUnik` dan untuk member berarti **`nama`**. Ini bukan pilihan gaya:
member **tidak punya `kodeUnik` sama sekali** (17 dari 17 member di server
memiliki kolom itu kosong), jadi kalau mengirim kode, `findAccountByKode`
tidak akan pernah menemukannya. Backend mencari `kodeUnik` dulu, lalu jatuh ke
pencocokan `nama`.

### Tiga penjaga yang ditegakkan SEBELUM memanggil server

| Kondisi | Kenapa menolak lebih awal |
|---|---|
| Dipilih ≠ 1 akun | Satu sesi memakai tepat satu akun |
| Akun dinonaktifkan | Backend juga menolak, tapi "Akun tidak aktif" dari server tidak menjelaskan bahwa masalahnya sudah terlihat sejak tadi di daftar |
| Saldo waktu habis | Sama |

Di sheet pemilihan PC **hanya PC `IDLE`** yang ditawarkan. PC yang sedang
berjalan ditolak backend dengan "PC sudah memiliki sesi berjalan", dan PC
offline tidak punya layar untuk dikunci. Menawarkan keduanya berarti kasir
memilih lalu gagal — lebih buruk daripada tidak menawarkannya.

⚠️ **Bar aksi jadi 6 ikon.** Wajib diuji di lebar HP; `flutter test` memakai
permukaan 800×600 yang terlalu lebar untuk menangkap `RenderFlex overflowed`.
`test/mulai_dari_akun_test.dart` (10 tes) mengujinya di 360 px.

⚠️ **Jangan menggabungkan dua kasus penolakan dalam satu widget test.** SnackBar
dari penolakan pertama masih menempel dan membuat pengetikan kedua tidak
menemukan tombolnya. Itu kegagalan tes, bukan perilaku aplikasi — tapi waktu
terbuang kalau tidak diketahui.

## Build APK & GitHub Actions

Workflow `.github/workflows/build-apk.yml`: Java 17, Flutter 3.44.4, analyze + test, lalu
build. Commit `ff366d8` menambah build **universal** (`flutter build apk --release` tanpa
`--split-per-abi`) sebagai Artifact `v3netbill-apk-universal`, sementara build per-ABI tetap
dipertahankan untuk yang mau unduh lebih kecil. Retensi artifact 60 hari.

⚠️ **Signing di CI bergantung pada 4 secret repo** — `KEYS_BASE64` (keystore `.jks` di
base64), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`. Kalau kosong, workflow **tetap
jalan** dengan fallback debug key, dan hasilnya **tidak layak dibagikan** (Android
menandainya "tidak dari sumber tepercaya"). Jadi `gh secret list` harus dicek sebelum
menganggap APK CI siap pakai. Secret sudah terpasang 27 Sep.

Keystore rilis ada di mesin ini (di-gitignore, **jangan di-commit**):
`android/app/v3netbill-release.jks` + `android/key.properties`. Kehilangan keystore =
tidak bisa menerbitkan update APK tanpa uninstall.

### Cara set secret GitHub dari host

`gh` **tidak terinstall** di host dan tidak ada `~/.netrc`. Yang berhasil: unduh binary `gh`
ke dalam container playwright, lalu `gh secret set` (dijalankan lewat `GH_TOKEN`).
⚠️ **Janganenkripsi sendiri lewat API** — `POST .../actions/secrets/{name}` minta
sealed box libsodium; implementasi tweetnacl ditolak GitHub dengan
`"improperly encrypted secret"` meski panjang ciphertext sudah benar 81 byte. Pakai `gh`.
Token cukup disimpan di `/tmp/opencode` dengan `umask 077`, lalu **wajib dihapus** setelah
selesai.

⚠️ **Download artifact GitHub selalu butuh token**, meski repo public. Zip artifact selalu
belum lengkap saat curl pertama — pakai `curl -C - --retry 5 --retry-all-errors` untuk
lanjutkan. Ukuran artifact GitHub **tidak** sama dengan jumlah byte APK di dalamnya
(49.9 MB artifact → 53.3 MB APK + 3 APK per-ABI), jangan dipakai untuk sanity check.

### Distribusi lewat Settings web ✅

Backend `308cd02` — `POST /api/settings/apk` (ADMIN, multipart, filter `.apk`, maks 200 MB)
menyimpan ke `/data/apk/` + Setting `apk_meta`; `GET /api/settings/apk` **`res.download`**
`v3netbill.apk`. **Dua endpoint ini wajib JWT** (bukan `@Public()`), jadi `curl` tanpa token
balas `401` — itu normal, bukan bug.

Frontend `39fa0f6` — tombol `Download APK` di card `Aplikasi Android`
(`SettingsPage.tsx` → `TabInstalasi.tsx`), lewat `downloadAuth`
(`src/lib/api.ts:230`).

⚠️ **`downloadAuth` memakai header `Authorization`, BUKAN token sebagai query string.**
Versi catatan sebelumnya salah dan membuat saya coba `?token=…` yang dijawab `401`.
Kodenya: `fetch('/api' + path, { headers: { Authorization: 'Bearer ' + token } })`,
lalu hasilnya diubah jadi blob dan diunduh lewat `a.download`. Konsekuensinya **tidak
bisa** diunduh lewat `curl` dengan token di query string — harus header, sama seperti
endpoint lain.

⚠️ **Upload lewat domain dari host kadang putus di ~18 MB** (`HTTP 000`, Cloudflare).
Always upload lewat `http://localhost:3000/api/settings/apk` (53 MB lolos). Setelah upload,
verifikasi dengan download ulang + bandingkan `sha256sum` — bukan cuma cek HTTP 200.

⚠️ **Upload tidak pernah menghapus berkas lama.** Tiap upload menambah satu berkas di
`/data/apk/`, jadi versi lama menumpuk dan ada kasir yang bisa mengunduh yang salah.
Sampai 29 Sep sudah 9 APK (460 MB) dihapus manual, dan `/data/installer/` 11 berkas
(560 MB). Pembersihan manual: baca nama aktif dari Setting `apk_meta` / `installer_meta`,
lalu `rm` semua selain nama itu — **jangan hardcode**, karena file yang tidak
dijaga ikut terhapus dan tombol unduh langsung rusak.

APK aktif di server: `v3netbill-1790641833108.apk`, 53.956.267 byte, universal,
release-signed `CN=v3Netbill` (sertifikat SHA-256 `d38e3993…7d880e`, identik dengan
keystore `android/app/v3netbill-release.jks`), dari artifact GitHub run `36502489756`
yang build commit `f1457cc`.

⚠️ **Ukuran APK tidak selalu berubah antar build.** Build `c71f250` dan `f1457cc` dua
duanya 53.956.267 byte, tapi `sha256sum`-nya berbeda. Jadi **ukuran bukan bukti** bahwa
berkas baru — yang menentukan selalu `sha256sum`.

### Cara verifikasi APK yang di-build CI

`gh` tidak ada di host, tapi **tidak perlu** — `curl` ke API GitHub cukup, dengan token
dari `v3netbill-mobile/github-token.txt` (40 karakter, izin `600`, sudah gitignore):

```bash
TOKEN="$(cat v3netbill-mobile/github-token.txt)"
# daftar run terakhir
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/41zz-2807/v3netbill-mobile/actions/workflows/build-apk.yml/runs?per_page=5"
# artifact
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/41zz-2807/v3netbill-mobile/actions/runs/<id>/artifacts"
# unduh (WAJIB -C - --retry: artifact sering terpotong di unduhan pertama)
curl -L -C - --retry 5 --retry-all-errors -H "Authorization: Bearer $TOKEN" \
  -o artifact.zip "https://api.github.com/repos/.../actions/artifacts/<id>/zip"
```

Artifact berisi 4 APK: `app-release.apk` (universal, yang dipakai) + 3 per-ABI.
**Ukuran artifact ≠ ukuran APK** di dalamnya.

Tanda tangan & namespace bisa dicek tanpa tooling Android di host:

```bash
# tanda tangan + sertifikat (image Flutter punya Android SDK)
docker run --rm -v /tmp/apk:/w --entrypoint bash mobiledevops/flutter-sdk-image:3.44.4 -c \
  '/opt/android-sdk-linux/build-tools/35.0.1/apksigner verify --print-certs /w/app-release.apk'
# bandingkan dengan keystore lokal
keytool -list -v -keystore android/app/v3netbill-release.jks -storepass "…"
# namespace WebSocket harus /session, bukan /socket.io
python3 -c "import zipfile;d=zipfile.ZipFile('app-release.apk').read('lib/arm64-v8a/libapp.so');print(b'/session' in d)"
```

## Halaman login + daftar status PC (4 Okt) ✅

Kartu login **satu kartu besar**: kiri = daftar PC, kanan = form login.
Tepat sesuai mockup yang disetujui (concept 5 yang disederhanakan).

```
src/pages/LoginPage.tsx     layout 2 kolom, tombol lihat sandi, DaftarPc
src/index.css                .login-container--pc, .login-split, .login-pc__*
                             .login-form-side, .login-form-side__logo
src/lib/api.ts               fetchStatusPcRingkas()  -> /pcs/ringkas
```

Data diambil lewat **REST polling 10 detik**, bukan WebSocket — `dashboard:subscribe`
butuh JWT, sedangkan halaman login belum punya. `PcService.ringkas()` yang
menghitung, jadi angka di layar login tidak mungkin berbeda dari dashboard.
Gagal ambil status **tidak boleh** menghalangi login; errornya sengaja diamkan saja.

**Indikator:** 🟢 hijau **berdenyut** = sedang dipakai · 🟡 kuning diam =
tersedia · 🔴 merah diam = offline. Hanya hijau yang berdenyut supaya operator
bisa membedakan "dipakai" dari sekadar "tersedia" dalam sekali lihat. Sudah ada
`@media (prefers-reduced-motion: reduce)` untuk mematikan denyut.

⚠️ **Tinggi daftar PC TIDAK boleh menyesuaikan isi.** Kalau ikut tinggi, kartu
ikut memanjang setiap kali jumlah PC bertambah — terukur: 7 PC = 429px, **14 PC =
694px**. Jadi tingginya dikunci (`height: 274px`) + `overflow-y: auto`. Di bawah
720px layout jadi satu kolom dengan form login **di atas** (`order: -1`), dan
tinggi daftar diturunkan ke 168px.

### ⚠️ Logo v3Netbill menggantikan tulisan "LOGIN" (4 Okt)

Judul kolom form **bukan teks "Login"** - tapi logo. Alasannya kolom form kini
sangat pendek (dua field + tombol), jadi judul teks cuma menambah tinggi dan
ruang kosong di atas. Logo ada di dalam `.login-form-side__logo`, **bukan** lagi
di kolom kiri seperti versi pertama.

Atribut `width`/`height` asli (411×144) tetap ditulis di `<img>` supaya browser
tahu rasionya. Yang berubah cuma `align-self`:

```css
.login-form-side__logo { height: 40px; width: auto; max-width: none; align-self: center; }
```

⚠️ **`align-self` tetap wajib, hanya nilainya berubah jadi `center`.** Kedua kolom
adalah flex column dan default `align-items` = stretch, jadi tanpa itu `<img>`
ikut diregangkan selebar kolom (terukur **299px**) sementara `height` dikunci 40px
— hasilnya logo melebar dan gepeng. Di bawah 720px `.login-form-side` jadi anak
pertama, jadi logo otomatis muncul paling atas dan tetap ter-center.

⚠️ **Tombol Login tidak boleh pakai animasi loading.** Semula isinya
`<ProgressBar>` (komponen `src/components/ui/ProgressBar.tsx`) saat `loading`.
Dihapus — yang tersisa cuma kelas `.is-memproses` yang mengubah warna tombol
samar (`#334155`, opacity 0.85). Alasannya `ProgressBar` membuat tombol melompat
tinggi dan terlihat seperti elemen lain yang tidak sengaja muncul, dan di aplikasi
billing animasi yang tidak terkait data sumber hanya menambah gangguan.

⚠️ **`key={namaPc}` di `DaftarPc` boleh dipakai sekarang** — server sudah
menolak nama duplikat dengan 409, jadi dua kunci itu tidak mungkin bentrok. Kalau
nama duplikat suatu saat diizinkan, key itu harus diganti.

## Sesi web terkunci otomatis (30 Sep) ✅

Dua lapis, dua alasan berbeda:

| Lapis | Kapan terjadi | Kenapa |
|---|---|---|
| `sessionStorage` (bukan `localStorage`) | browser/tab ditutup | `localStorage` bertahan setelah browser ditutup, jadi komputer kasir yang ditinggal masih bisa dibuka siapa pun tanpa password |
| `useIdleLogout` 5 menit | tidak ada aktivitas | kasir menggeser halaman lalu pergi, tidak ada yang mengunci sendiri |

⚠️ **`sessionStorage`, bukan `localStorage`** (`src/lib/api.ts`, fungsi `store()`).
Reload (F5) **tidak** mengosongkannya — sesi tetap aman dari refresh biasa — tapi
menutup tab/browser langsung menghabisi sesi. Tab baru selalu mulai dari layar login,
karena `sessionStorage` bersifat per-tab. Ini konsekuensi yang **disengaja** untuk
kasir warnet, jangan diubah ke `localStorage` tanpa diminta user.

- Hook: `src/hooks/useIdleLogout.ts`. Dipakai di `Layout.tsx` supaya berlaku di semua
  halaman, bukan cuma dashboard. Ambang `IDLE_MS = 5 * 60 * 1000`.
- Cara kerjanya **bukan** reset `setTimeout` di setiap aktivitas. `pointermove` bisa
  ratusan kali per detik, jadi satu `setInterval` 1 detik memeriksa satu variabel
  `batas`; setiap event aktivitas hanya menulis ulang variabel itu.
- `onIdle` dibaca lewat `ref` yang ditulis di dalam `useEffect` — bukan `cb.current =
  onIdle` langsung saat render, karena `react-refs` lint itu menolak, dan nilainya
  baru dipakai 1 detik kemudian.
- Event aktivitas: `pointerdown`, `pointermove`, `keydown`, `wheel`, `touchstart`,
  `scroll`. `focus` sengaja **tidak** dipakai: berpindah tab lalu kembali bukan
  pekerjaan, hanya menahan timer tanpa alasan.
- Setelah terkunci: `logout(PESAN_SESI_BERAKHIR)` → `App.tsx` merender `LoginPage`
  (tanpa reload, jadi WebSocket `DashboardPage` ikut `disconnect()` lewat cleanup).

⚠️ **Pesan yang ditampilkan HARUS general** — `PESAN_SESI_BERAKHIR` di
`AuthContext.tsx` = "Sesi berakhir. Silakan login kembali." Ini permintaan eksplisit
user: **dilarang** menampilkan "tidak ada kegiatan selama 5 menit" atau sebut
duranya. Kasir cukup tahu harus login ulang. Kalau nanti ditambah teks penghitung
mundur, teks itu tetap tidak boleh menyebut penyebab.

- `notice` (`string | null`) ditambahkan ke `AuthContext`; `logout(notice?)` menerima
  argumen opsional. Tombol Keluar di `Layout.tsx` memanggil `logout()` tanpa argumen
  → **tidak** memunculkan pesan. Karena `logout` sekarang menerima string, `onClick`
  tidak boleh `onClick={logout}` lagi — `MouseEvent` akan terbaca sebagai pesan.
  Sudah `onClick={() => logout()}`.

Verifikasi (Playwright, 30 Sep, 8 tes lolos di domain produksi): token hanya di
`sessionStorage`; aktivitas menahan timer; geser jam 12 menit tanpa aktivitas → layar
login; teks layar tidak memuat kata `menit`/`idle`/`aktivitas`/`kegiatan`/`tidak ada`;
tab baru langsung ke login; reload tetap login; tombol Keluar tidak memunculkan pesan.
Cara menguji idle 5 menit **tanpa menunggu 5 menit**: suntik `addInitScript` yang
menambah offset ke `Date.now()` (mis. `Date.now = () => asli() + geser`), lalu
`page.evaluate(() => window.__geser(12 * 60 * 1000))` untuk melompat melewati ambang.
Skrip uji-nya sengaja **tidak** disimpan di repo — butuh `playwright-core` yang bukan
dependensi project, dan file di `/tmp` hilang sendiri.

## Latar belakang gambar seluruh aplikasi (1 Okt) ✅

Semua halaman (termasuk layar login) punya latar foto `/bg-globe.jpg` —
motif jaringan/bumi yang sama dengan logo — dengan **`LAPIS_PUTIH = 0.5`**
di atasnya, jadi gambarnya terlihat 50% dan kesan light tetap terjaga.

### ⚠️ Menurunkan `LAPIS_PUTIH` meredupkan seluruh aplikasi

Jadi yang menentukan seberapa terang layar adalah `LAPIS_PUTIH`, **bukan**
opacity gambarnya. Foto aslinya gelap, jadi layer putih itu yang menahan
terang. Kontras diukur dari piksel yang benar-benar ter-render:

| `LAPIS_PUTIH` | foto | warna latar | judul (slate-900) | teks isi (slate-600) |
|---|---|---|---|---|
| 0.7 | 30% | `#b3cbdd` | 10.63 | 4.51 |
| 0.6 | 40% | `#9abad1` | 8.77 | 3.72 |
| **0.5** | **50%** | **`#81a9c6`** | **7.16** | **3.04** |

Yang membuat perubahan ini **aman** ternyata struktur halamannya: hampir
semua teks kecil duduk di dalam kartu putih, jadi tidak ikut gelap. Satu-
satunya teks yang benar-benar di atas latar adalah judul halaman, dan itu
teks besar — syaratnya contrast 3.0, bukan 4.5.

Jadi kalau nanti `LAPIS_PUTIH` diturunkan lagi, **yang harus diukur ulang
bukan cuma kontrasnya, tapi teks apa saja yang berada di luar kartu.**
Teks `slate-400` sudah contrast 1.03 di setting sekarang — kalau suatu saat
ada teks seperti itu diletakkan langsung di atas latar, dia praktis tak
terbaca.

```
src/components/LatarBelakang.tsx   <img> fixed + veil putih (LAPIS_PUTIH), z-index -10
src/App.tsx                        dipasang di sini, bukan di Layout
public/bg-globe.jpg                1920x1200 q75 = 77 KB (aslinya 8,5 MB)
```

⚠️ **Dibuat sebagai komponen React, BUKAN `background-image` di CSS —
karena `url()` sama sekali tidak bisa dipakai di `index.css`.**

Di kombinasi **Tailwind v4 + Vite 8 (Rolldown)** yang dipakai project ini,
satu deklarasi `url(...)` apa pun bikin build gagal:

```
[plugin vite:css] /app/src/index.css:2:36262
CssSyntaxError: [postcss] Missed semicolon
```

Sudah diuji satu per satu dan **semuanya gagal**: `url()`, `url("...")`,
`url('...')`, path absolut `/bg-globe.jpg`, path relatif, data URI,
di `background-image`, di `list-style-image`, di `::before`, dan di custom
property. Yang aman: `background-color` dan `linear-gradient`.

Masalah ini tidak pernah terlihat sebelumnya karena **tidak ada satu pun
`url()` di `index.css`** — semua warna dan gradien. Begitu latar ini butuh
berkas gambar, masalahnya langsung ke depan. Cara yang dipakai sekarang:
`<img>` + `object-cover` + `pointer-events-none`, karena referensi aset di JSX
diproses Vite dengan benar dan `public/` disajikan apa adanya.

⚠️ **Jangan memindahkan latar ini ke CSS tanpa mengulang uji build.** Error-nya
menyebut `index.css:2:36262` — nomor baris itu menunjuk ke CSS **setelah**
ekspansi Tailwind, bukan ke baris aturan yang menulis. Jadi posisinya sama sekali
tidak membantu menemukan penyebabnya, dan `background-color` yang harmlessly
letakkan di file yang sama tetap bisa membuat build gagal.

**Dua lapis, jangan cuma satu.** Gambar memakai `opacity: 0.3` dan di atasnya
ada `div` putih `opacity: 0.7` — bukan gambar 30% di atas warna solid. Alasannya
`body` hanya bisa punya satu `background-color`, dan warna itulah yang terlihat
di sela-sela gambar.

⚠️ **Dipasang di `App.tsx`, bukan di `Layout`.** `LoginPage` tidak memakai
`Layout`, jadi latar yang ditaruh di sana tidak akan muncul di layar login.
`Layout.tsx` juga harus **tanpa** warna latar solid (`bg-gray-100` sudah
dihapus) — kalau masih ada, latar gambarnya tertutupi tanpa error.

Ukuran 1920x1200 dipilih karena foto hanya 30% dan dibungkus veil putih, jadi
penurunan ukuran hampir tidak terlihat. Rasio aspek 1,6 dijaga sama dengan
aslinya supaya `object-cover` tidak memotong.

## Modal popup — panel pastel + tombol X (1 Okt) ✅

Popup **Tambah PC** (`PcPage.tsx`) dan **Buat Voucher / Buat Member**
(`AccountsPage.tsx`) memakai panel putih dengan header pastel cyan, sama seperti
kartu PC dashboard. Ditambah tombol **X** di kanan header untuk keluar.

```
src/components/ui/PastelCard.tsx         header cyan + X + body putih
src/components/ui/pastelCardStyles.ts    cardClass, inputClass, buttonClass, ...
```

`GradientCard.tsx` + `gradientCardStyles.ts` **dihapus**, bukan diedit. Keduanya
cuma dipakai oleh dua modal itu, dan namanya sudah tidak benar (gradien ungu
gone, sekarang putih). `inputClass`/`buttonClass` yang tadinya gelap
(`bg-white/5`, teks putih) diganti terang (`border-slate-300`).

⚠️ **X diletakkan di header, bukan di bawah konten.** Alasannya panel ini punya
dua tahap — form lalu layar hasil — dan "Selesai" hanya ada di tahap hasil. Di
tahap form satu-satunya jalan keluar selain X adalah klik backdrop atau Escape,
dan klik backdrop mudah tidak disengaja saat mengisi form. `closeDisabled`
memakai disable, bukan sembunyikan, supaya posisi tombol tidak bergeser di
tengah proses.

### ⚠️ Tiga pengecualian tombol, dan hanya satu yang boleh "cukup"

Aturan `html[data-ui-buttons="uiverse"] button:not(...)` sekarang punya
`.modal-x` **dan** `.pastel-card button`:

- `.pcc__act` — tombol aksi kartu PC (32px)
- `.modal-x` — tombol tutup (28px)
- `.pastel-card button` — semua tombol di dalam panel modal, otomatis berlaku
  untuk tombol baru apa pun yang ditambahkan
- `.login-button`, `.navmenu__exit`

⚠️ **Jangan mengandalkan `.pastel-card button` saja untuk `.modal-x`.** Popup
"Mulai Sesi" di `DashboardPage.tsx` adalah satu-satunya dialog inline di repo
ini — panelnya `rounded-xl bg-white` sendiri, **bukan** `PastelCard`. Waktu
`.modal-x` baru dipasang di sana, `.modal-x` masih kena
`border-radius: 1.5rem !important` dan **terukur 24px, bukan 8px**. Karena itu
`.modal-x` wajib ada sebagai `:not()` tersendiri, bukan hanya lewat
`.pastel-card`.

Verifikasi (Playwright, 1280px & 390px): ketiga modal panel radius 16px, header
`rgb(224,247,250)`, X 28px bg putih radius 8px `aria-label="Tutup"`, X menutup,
Escape menutup, overflow 390px = 0 px, konsol bersih.

## Kartu PC dashboard — Soft Pastel Header (1 Okt) ✅

Kartu PC di dashboard web digantitotal ke desain "Soft Pastel Header":
header pastel cyan (`#e0f7fa`) memuat hitung mundur + tombol aksi, body putih
memuat nama PC dan Status/Tipe.

**Namespace CSS berubah dari `.uui-card*` jadi `.pcc*`.** Bukan rename tanpa
alasan — desain lama itu Uiverse "Universe of UI" (navy + gradien + notch) dan
sudah tidak dipakai. Kalau suatu saat `.uui-card` muncul lagi, berarti ada
sisa yang lupa diganti.

- `.pcc` — radius 16, bg putih, `box-shadow 0 4px 20px rgba(0,0,0,.06)`, `max-width 340px`
- `.pcc__head` — cyan, `min-height: 90px` (HP: 76px), `justify-between`
- `.pcc__time` — 32px/700, `tabular-nums`; `--teks` 20px untuk status;
  `--warn` merah kalau sisa <= 300 detik
- `.pcc__act` — 32x32, radius 8, fill `currentColor`
- `.pcc__body` / `.pcc__name` / `.pcc__info*`

### ⚠️ `.pcc__act` WAJIB dikecualikan dari aturan tombol global

`html[data-ui-buttons="uiverse"] button:not(...)` memberi `border-radius: 1.5rem
!important` + `background-image` gradient navy ke **semua** tombol. Dua
pengecualian yang sudah ada (`button.pcc__act`, `button.login-button`) ditambahkan
karena keduanya punya desain sendiri. Tanpa pengecualian, tombol 32px ini dapat
latar navy dan warna pastel-nya hilang. Kalau menambah kelas tombol bespoke
baru, **tambahkan juga ke ketiga selector `button:not(...)` itu**.

### ⚠️ `min-height` header bukan hiasan

Tanpa itu, header dengan hitung mundur (font 32px) = 90px sedangkan header
teks status (font 20px) = 77px. Grid meregangkan card sehingga **tinggi card
sama**, tapi isi mulai pada tinggi berbeda — baris "PC001" dan "PC-UJI-AKTIF"
tidak sejajar. Angka 90px/76px hasil pengukuran, bukan tebakan.

### ⚠️ "Sedang berjalan" dipakai untuk SEMUA yang ditampilkan

```tsx
const sedangBerjalan = sesi !== null && pc.status === 'ACTIVE'
```

Dulu hanya dipakai untuk milih tombol. Sekarang juga untuk hitung mundur, label
SISA WAKTU, dan Tipe. Alasannya `sesi` saja tidak bisa dipercaya: setelah agent
putus, `Session` masih ada beberapa detik (grace period) sementara `Pc.status`
sudah OFFLINE. Kalau hanya `sesi` yang dipakai, card menampilkan hitung mundur
yang **sudah tidak jalan** berdampingan dengan tombol Start.

Ini ketahuan karena screenshot menunjukkan `9j 59:27 SISA WAKTU` + tombol
`start` di card yang sama — dua informasi yang saling bertentangan. Di aplikasi
billing, angka yang tidak lagi benar lebih buruk daripada tidak ditampilkan.

### ⚠️ `transform: translateY(-1px)` di hover, bukan `scale()`

Ikon hanya 16px di dalam tombol 32px. `scale(1.15)` bikin ikon meleset dari
tengah kotak. `translateY(-1px)` aman karena tidak mengubah ukuran. Efeknya
dimatikan lagi di `@media (hover: none)` supaya card tidak bergeser saat disentuh.

### Tombol: dua, bukan tiga

Sama seperti kartu PC di aplikasi Android:

| Keadaan | Tombol |
|---|---|
| Idle / Offline | Start (hijau) + Matikan (merah) |
| Sedang berjalan | Kunci (kuning) + Matikan (merah) |

Dulu ketiga tombol selalu tampil, jadi ada tombol Start pada PC yang sedang
berjalan — backend menolaknya dengan "PC sudah memiliki sesi berjalan".
`IconTrophy` (pada notch kartu lama) ikut dihapus karena tidak ada di desain
baru.

## Menu header web — glass pill (27 Sep) ✅ `af4f250`

- Dari Uiverse.io (mymiamo). Selector di-prefix `.navmenu` supaya tidak bentrok dengan
  `.ui.dropdown .menu` yang dipakai `AccountsPage`.
- **Bug di CSS sumber yang sudah diperbaiki:**
  | Asli | Masalah |
  |---|---|
  | `transform: rotate(2.2)` | Tidak ada satuan `deg` → **tidak valid, diabaikan browser** |
  | `rgba(255,255,255,90%)` | Alpha persen **tidak sah** di `rgba()` |
  | `rgba(0,122,255,70%)` | Sama |
  | `--glass-border` | Tidak pernah didefinisikan → border hilang |
  | `--ease-spring` | Tidak pernah didefinisikan → timing jatuh ke default |
  | `color` biru di hover | Teks biru di atas kaca biru, kontras rendah → diganti putih |
- **Tombol Keluar masuk ke dalam pill** sebagai item terakhir + ikon logout, warna merah
  lewat `.navmenu__exit`. Karena itu ia `<button>`, bukan `<a>`, dan **wajib dikecualikan
  dari aturan tombol global** `html[data-ui-buttons="uiverse"] button:...` yang memakai
  `border-radius: 1.5rem !important` + `background-image` gradient — kalau tidak, tombolnya
  dapat latar navy di dalam pill kaca. Selektor `.navmenu` juga harus mencakup `button`,
  bukan hanya `a`.
- Brand di kiri: `v3netbill - {username}`.
- **Mobile (< 1024px): hamburger + drawer DIHAPUS TOTAL.** Pill selalu tampil, label
  disembunyikan jadi ikon saja. Padding vertikal 11px supaya tinggi area sentuh tetap
  di atas 44px. Efek `rotate()` dimatikan lewat `@media (hover: none)`.
- Lebar pill `max-width: 620px` (nilai Uiverse 520px tidak cukup untuk 7 item).

## Audit UI/UX 27 Sep + perbaikan ✅ (4 file, belum commit)

Diaudit dengan merender SPA-nya sungguhan (lihat "Kemampuan verifikasi visual").
Temuan dari **data nyata** (71 voucher, 9 sisa 0, 3 di antaranya `ACTIVE`):

1. **Label menu terpotong** (`Dash...`, `Trans...`, `Lapo...`) — `flex: 1 1 0` memaksa
   semua item sama lebar dan ikut menyusut. Diubah ke `flex: 0 1 auto` **hanya di
   `@media (min-width: 1024px)`**; di bawah itu tetap `flex: 1 1 0` supaya ikon evenly
   membagi pill yang `w-full`. *User minta HP jangan terganggu.*
2. **Nama event internal bocor ke user** — `logEventLabel()` jatuh ke `?? event` kalau
   nama tidak ada di peta. Data nyata memakai `voucher:created_dashboard` yang **tidak ada**
   di peta. Sekarang dipetakan: "Voucher Dibuat". Ditambah juga `pc_locked` / `pc_unlocked`
   (peta lama hanya punya `pc_lock`, padahal `AGENTS.md` menyebut `pc_locked`).
   "Sesi Mulai" → "Sesi Berjalan", "Sesi Stop" → "Sesi Berakhir".
3. **Alasan stop diterjemahkan** lewat peta `STOP_REASON`: `habis` → "Waktu habis",
   `manual` → "Dihentikan manual", `disconnect_timeout` → "Koneksi terputus".
4. **`formatDuration`**: `H:MM:SS` (`2:00:00`) → `2j 00:00` supaya tidak terlihat seperti
   dua format berbeda dalam satu kolom.
5. **`formatWaktu`**: tahun dihilangkan (`27 Sep 05.17`), tapi **dikembalikan lagi kalau
   bedanya tahun** — log retensi 30 hari, jadi aman, kecuali kalau melintasi pergantian tahun.
6. **Voucher `ACTIVE` dengan sisa 0** — diberi label kecil "Habis" **di kolom waktu saja**.
   ⚠️ Status **tidak** diubah ke `TERPAKAI`: berdasarkan `AGENTS.md`, session stop dengan
   alasan `habis` sengaja me-reset `sisaWaktuDetik` ke 0 **tanpa** mengubah status —
   itu siklus hidup akun di sisi server. Mengubahnya = perubahan logika bisnis backend.
   Data mengonfirmasi 3 voucher itu memang sudah terpakai (`lastUsedAt` terisi).

## Skrip uninstall agent (`.bat`) — urutan & jebakan registry

⚠️ **`Installer/uninstall-old-agent.bat` yang versi LAMA menghapus registry
sendiri** lewat `reg delete "HKLM\Software\v3Netbill" /f`. Di dalam key itu
ada `Agent` berisi `ServerUrl`, `PcId`, `AgentToken`. Efeknya berantai: agent
masih konek ke server tapi handshake-nya kosong sehingga
`session.gateway.ts` menolaknya dengan *"tanpa pcId/agentToken di handshake
query — tidak didaftarkan ke map"*, PC jadi offline di kasir, dan skrip uninstall
versi berikutnya tidak bisa memverifikasi PIN karena tidak punya data untuk
melakukan. Jadi **uninstall tidak boleh bergantung pada data yang justru
dihapus oleh proses uninstall**.

Urutan yang benar (`f941c8b`): **PIN diverifikasi ke server lebih dulu, baru
service boleh disentuh.** Semua jalur gagal — PIN salah, PIN belum diset, server
tidak terjangkau, identitas PC tidak ada — berhenti sebelum perintah
`sc stop`/`taskkill`/`msiexec` dijalankan. Verifikasi lewat
`POST /api/settings/verify-pin` (public, pakai `pcId`+`agentToken`+`pin`).

⚠️ **Jalur penolakan yang bikin pengguna buntu juga itu celah** (`089d097`).
Versi pertama berhenti total kalau registry kosong — padahal itu justru kondisi
yang paling sering terjadi. Sekarang operator diminta mengisi `PcId`,
`AgentToken`, dan URL server sendiri; kalau URL di registry tidak terjangkau,
operator diminta URL lain lalu PIN diverifikasi ulang tanpa diminta lagi.

**Di mana dapat `pcId` + `agentToken`** (nilainya **tidak** boleh ditulis di
dokumen ini — repo publik, dan token itu mengizinkan `create_password` serta
`stop_session`):

```
GET /api/pcs            → field id + agentToken (halaman PC di web)
HKLM\Software\v3Netbill\Agent  → ditulis MSI saat instalasi
```

Nilai di bawah ini sengaja tidak dicatat. Kalau registry sudah hilang, jalankan
`.bat` lalu isi ketiga nilai tersebut saat diminta.

## Pelajaran proses (penting untuk sesi berikutnya)

1. **Karakter asing nyasar di commit message — sudah 5 kali.** CJK, Korea, dan Rusia
   muncul tanpa sengaja. Karena commit message masuk repo **public**, ini tidak boleh
   terjadi.
   **Prosedur wajib:** tulis pesan ke file terpisah → scan karakter non-ASCII dengan
   skrip → **baru** `git commit`. Contoh:
   ```bash
   python3 -c "
   t=open('/tmp/msg.txt').read()
   s=[c for c in t if 0x2E80<=ord(c)<=0xFFEF or 0xAC00<=ord(c)<=0xD7AF]
   print('bersih' if not s else sorted(set(s)))"
   ```
   Hal sama bisa terjadi di **komentar kode** — scan `src/` sebelum commit juga.
2. **`git add -A src` menyapu pekerjaan lain yang belum di-commit.** Pernah ikut
   membawa 4 file (SettingsPage 295 baris) dari sesi sebelumnya ke commit yang tidak
   related. **Stage eksplisit per file**; kalau ada uncommitted lain, commit terpisah.
3. **Jangan pernah menaruh file sensitif di `frontend/dist`.** Itu langsung publik tanpa
   autentikasi (lihat bagian DEPLOYMENT). Screenshot yang memuat IP server / kode voucher
   / riwayat sesi **tidak boleh** di-onlinekan tanpa peringatan eksplisit ke user lebih dulu.
   Bila perlu, simpan di `/tmp` saja dan kirim lewat cara lain.
4. **Verifikasi visual selalu mungkin** lewat Playwright image — jangan lagi bilang
   "saya tidak bisa melihat tampilan" tanpa mencoba dulu. `curl` tidak cukup untuk SPA.
5. **Jangan menyimpulkan apa pun tanpa memeriksa output.** `curl` yang gagal diam-diam
   (exit != 0) bikin `&&` berhenti tanpa pesan, dan `unzip` yang tidak terpasang bikin
   `unzip -tq` salah mengira "zip rusak". Sebelum menyimpulkan: print ukuran file, dan
   pastikan tool-nya benar-benar ada.
6. **Kerjakan dari host, lalu hapus jejaknya.** Setelah pakai token atau password untuk
   satu operasi, langsung `rm` file-nya, lalu `grep -rI` untuk memastikan tidak ada sisa
   di `/tmp/opencode`. Sesi ini menemukan `dl4.sh` berisi token rusak dari 2 hari
   sebelumnya — tidak sengaja, tapi bukti bahwa scan itu perlu.
7. **"Fiturnya belum ada" dan "fiturnya ada tapi rusak" itu dua hal berbeda.** User
   melaporkan halaman voucher/member tidak menampilkan daftar dan tidak ada tombol aksi.
   Halaman itu **sudah ada** dari awal, tapi gagal total diam-diam karena
   `LocaleDataException`. Dua cara menemukan ini:
   - Jangan percaya kode yang "sudah dibaca". `accounts_page.dart` memang sudah
     menampilkan daftar dan SelectionBar secara lengkap.
   - **Render halamannya sungguhan dengan data nyata.** `test/accounts_page_test.dart`
     memompa `AccountsPage` dengan 97 akun asli dari server, dan exception-nya langsung
     terlihat. Fixture-nya disimpan sebagai `test/fixture_accounts.json`.
   Widget test dengan data nyata juga menangkap hal yang tak terlihat dari kode saja:
   mengetuk `Text` tidak selalu merambat ke `GestureDetector`, sementara mengetuk
   `Checkbox` langsung bekerja.
8. **Uji asumsi ke server, jangan ke asumsi sendiri.** Untuk fitur "buat member lalu mulai
   sesi" saya menulis kode yang memakai `kodeUnik` untuk dua tipe akun. Baru dicoba ke
   server, `POST /api/accounts/member` ternyata mengembalikan `kodeUnik` bernilai `null`.
   Setelah dicek di DB: **17 dari 17 member punya kolom `kodeUnik` kosong**, jadi
   `session.service.ts` mencari member lewat `nama`. Kalau tidak diuji ke server, alurnya
   gagal total di tangan user. Pola yang sama terulang dua kali pada sesi ini: `rupiah`
   dan `duration` aman, `dateShort` justru yang meledak. **Selalu panggil endpointnya
   sekali dengan `curl` sebelum menulis kode yang bergantung pada bentuk jawabannya.**
9. **Jangan menebak skema tool — validasi lokal lebih dulu.** Build MSI gagal **3 siklus CI**
   berturut-turut karena menebak di mana `WixVariable` harus diletakkan di WiX v4. Yang
   akhirnya membantu: pasang wix di container Linux, generate ulang fragment dependensi,
   lalu jalankan `wix build` dan grep hanya `WIX0005` — hasilnya keluar dalam ~1 menit,
   sedangkan satu siklus CI memakan ~4 menit. Pelajaran yang lebih umum berlaku untuk tool
   apa pun: kalau sebuah tool menolak input dengan pesan "unexpected child element",
   **berhenti menebak posisi dan cari sumber kebenarannya** (reflection API, berkas skema,
   atau dokumentasi). Enam percobaan berurutan di sini semuanya salah karena tidak ada satu
   pun yang berbasis bukti.
10. **Mengira "semua jalur sudah sama" adalah asumsi — telusuri satu per satu.** Setelah password
   diperbaiki seragam, saya mengira semua pembuatan akun sudah ikut. ternyata
   `createVoucherAndStart()` — jalur buat voucher dari kartu PC di dashboard — masih
   `Math.floor(1000 + Math.random() * 9000)`, jalur terakhir yang tidak ikut berubah. Cara
   menangkapnya: `grep -rn "Math.random\|randomInt\|PASSWORD" src/`, bukan cuma membaca file
   yang *"telah diubah"*.
11. **Perbaikan tanpa verifikasi bisa membuka lubang baru.** `client:create_password` versi
   pertama sengaja tidak menanyakan password lama — dengan asumsi "password awal sudah
   diketahui umum". Setelah tombolnya dipindah ke mini window (hanya tampil saat sesi berjalan),
   asumsi itu jadi salah: tidak ada lagi alasan menoleransi password yang salah, dan siapa pun
   yang duduk di komputer bisa mengganti password akun orang lain. Verifikasi ditambahkan.
   **Uji dulu "kenapa tidak diamankan?", baru putuskan boleh-tidaknya.**
12. **Kode yang "sudah dipanggil" belum tentu terlihat.** Tombol GANTI PASSWORD diklik
    benar-benar jalan, handler jalan, `Visibility` pun berubah — tapi dialognya diletakkan
    di dalam panel yang sedang di-collapse, jadi pengguna tidak melihat apa pun.
    Pelajaran: saat menambah elemen UI, **cek pohonnya, bukan cuma nilai propertinya**, dan
    pastikan induknya benar-benar tampil pada kondisi yang diharapkan. Untuk WPF,
    `UpdateVisibility()` adalah peta visibility yang perlu dibaca sebelum menaruh apa pun.
13. **Jalur penolakan yang membuat pengguna buntu juga merupakan celah.**
    `uninstall-old-agent.bat` versi pertama berhenti total saat registry agent
    hilang — padahal itu kondisi paling sering terjadi, karena `.bat` versi lama
    menghapus registry itu sendiri. Hasilnya operator terkunci: tidak bisa
    uninstall, tapi juga tidak ada PIN yang salah. Aturan: **setiap jalan keluar
    dari penolakan harus punya jalan keluar lagi.** Untuk dialog WPF aturannya sama —
    jangan andalkan satu tombol; untuk skrip, jangan andalkan satu sumber data.
14. **Uji otomatis yang menyentuh form bisa merusak data produksi.** Sesi ini
    sempat mematikan **seluruh server**. Rantainya: refactor halaman Pengaturan
    memindahkan `harga` & `grace` jadi state lokal tab tanpa memuat nilai dari
    server, jadi form tampil kosong; lalu uji fungsional saya klik "Simpan"
    pada form kosong itu dan menimpa `harga_per_menit` + `grace_period_detik`
    dengan string kosong; `parseInt('')` jadi `NaN`; `checkGracePeriodExpired`
    tidak punya `try/catch`; proses Node crash; seluruh PC kehilangan billing.
    Tiga aturan dari sini:
    - **Form yang nilainya berasal dari server tidak boleh diuji dengan
      mengklik Simpan** kalau belum dipastikan nilainya termuat. Cek isi field
      lebih dulu, atau pakai pengujian yang tidak mengubah apa pun.
    - **State awal dari server jangan dideklarasikan ulang di komponen anak.**
      Taruh di induk lalu oper masuk.
    - Kerusakan data produksi diperbaiki **langsung di DB** lewat container
      (`docker exec postgres-15 psql`), bukan lewat API yang sedang mati.
15. **Jangan pakai `2>/dev/null` pada perintah yang hasilnya harus dicek.**
    `git add` saya jalankan dengan `2>/dev/null` sambil menyebut dua path yang
    sudah dihapus — `git add` menolak **seluruh** daftar itu, tapi errornya
    disembunyikan sehingga commit hanya berisi 2 file terhapus dan 12 file lain
    tertinggal. Baru ketahuan setelah `git show --stat`. Ini memperluas no. 5:
    menyembunyikan output sama dengan tidak memeriksa output.
16. **Pecah file menurut ukuran, bukan asal bagi.** `SettingsPage.tsx` 897 baris
    dipecah jadi 5 tab. Yang bermasalah bukan panjangnya, tapi kartunya tidak
    sebanding: tinggi baris mengikuti kartu tertinggi sehingga muncul ratusan px
    ruang kosong. **Ukur tinggi halaman sebelum dan sesudah** lewat Playwright
    (`document.body.scrollHeight`) — angka yang membuat keputusan, bukan kesan
    visual.
17. **Pindah lokasi repo: periksa dulu, baru `mv`.** Repo mobile dipindah dari
    `/home/warnet/mobile/` ke dalam `/home/warnet/docker/v3netbill/`. Yang diperiksa
    sebelum pindah: `df` dan `stat` untuk memastikan satu filesystem (kalau beda, `mv`
    jadi salin lalu hapus, butuh 2x ruang disk sementara), `grep -rI` path lama di dalam
    repo **dan** di luar (cron, systemd, `docker inspect`), `key.properties` (kalau
    `storeFile`-nya absolut, signing langsung rusak), lalu checksum daftar file sebelum dan
    sesudah. Hasilnya nol dependensi, kecuali dua skrip `dk` dan `fl` yang memang
    hardcode path. Verifikasi akhir: `flutter build apk --release` dari path baru menghasilkan
    APK **53.955.947 byte**, ukuran identik dengan artifact CI, dan tetap release-signed.
18. **Build di dalam image bisa ditimpa bind mount — verifikasi hasilnya, bukan cuma
    exit code-nya.** `docker compose up -d --build v3netbill-backend` keluar **sukses
    penuh** (build di-cache, container "Recreated/Started"), tapi bundle frontend
    yang disajikan domain **masih versi lama** — karena `./frontend/dist` di-bind mount
    ke `/app/frontend-dist`, jadi hasil `npm run build` di dalam image tidak pernah
    dibaca. Baru ketahuan karena tes Playwright di domain menunjukkan perilaku
    storage yang **lama**, padahal tes yang sama di dev server sudah lulus.
    Perintah yang benar: `docker compose exec v3netbill-frontend npm run build`
    (langsung menulis ke `frontend/dist` di host, tanpa restart backend).
    Pelajaran yang lebih umum: **"build sukses" bukan bukti "deploy sukses"** kalau
    ada lapisan mount di antaranya. Cek yang benar-benar disajikan server — di sini
    lewat `ls -la frontend/dist/assets` (nama file berehash berubah saat build) lalu
    jalankan ulang tes yang sama terhadap domain.
19. **Jangan jalankan `dk format lib test` di repo yang belum ter-format.**
    Perintah itu memformat seluruh folder, termasuk file yang tidak sedang
    dikerjakan.
    Repo mobile ternyata punya 3 file tes yang belum mengikuti `dart format`,
    jadi perintah itu diam-diam ikut mengubah 6 file dan `git status` jadi
    berisik — persis masalah no. 2 ("menyapu pekerjaan lain"). Format **hanya
    file yang kamu ubah**, lalu `git status` untuk memastikan tidak ada lain
    yang ikut berubah.
20. **`try/catch` untuk "file tidak ada" tidak boleh menelan error validasi.**
    Pola `try { readFile(path) } catch { return kosong }` kelihatan aman, tapi
    `path` biasanya dihitung di dalam `try` itu juga — sehingga error validasi
    dari perhitungan path ikut dianggap "file tidak ada". Gejalanya tidak dramatis:
    server membalas `200` dengan hasil kosong untuk input yang seharusnya ditolak,
    jadi tes fungsi yang hanya memeriksa "tidak bocor" tetap lulus.
    **Hitung dan validasi path DI LUAS `try`, baru `try` hanya untuk `readFile`.**
    Dan jangan pernah membangun nilai header dari input mentah — `filename="log-billing-${tanggal}.txt"`
    rusak begitu input berisi satu tanda kutip. Lihat bagian "Log billing berkas".
21. ⚠️ **Uji keamanan pakai serangan nyata, bukan `curl` biasa.** curl menormalkan
    `../` sebelum request dikirim, jadi request-nya tidak pernah sampai ke
    controller dan yang terlihat adalah `200` HTML dari SPA fallback — yang
    membuat validate-nya **tampak** bekerja padahal tidak diuji sama sekali.
    Gunakan `curl --path-as-is` supaya path mentah benar-benar dikirim.
    Dan **bikin berkas umpan ada** sebelum menguji: berkas umpan di luar folder log
    yang afterward harus terbukti utuh, bukan sekadar "dijawab 200 kosong".
22. ⚠️ **Build APK lokal SELALU bernomor `versionCode 1`, dan mengunggahnya
    merusak pembaruan untuk semua HP kasir.** `./fl build apk --release` tidak
    mengoper `--build-name`/`--build-number`, jadi hasilnya memakai `pubspec.yaml`
    yang masih `version: 1.0.0+1`. Saya mengunggahnya, dan `apk_meta` berubah
    dari `versionCode 24` jadi `1` — itu **penurunan versi**.

    Akibatnya bukan cuma satu HP: `UpdateProvider` membandingkan nomor server
    dengan nomor miliknya, jadi seluruh HP kasir yang sudah di `24` akan
    melihat "server lebih tua" dan **berhenti menampilkan pembaruan sama sekali**.
    Gejalanya muncul di HP orang lain, sementara penyebabnya di mesin ini.

    Pemulihan tanpa mengedit database: **unggah ulang berkas APK lama** ke
    `POST /api/settings/apk`. `saveApk()` membaca versi dan `sha256` dari berkas
    itu, jadi `apk_meta` kembali persis seperti sebelumnya — lalu hapus berkas
    baru yang salah unggah. (`UPDATE apk_meta` manual berisiko membuat meta dan hash
    tidak sinkron dengan berkas yang benar-benar ada.)

    Aturan yang berlaku: **rilis selalu dari artifact CI.** Build lokal hanya
    untuk menguji, dan kalau harus diuji mekanismenya, jangan pernah
    menyentuh `POST /api/settings/apk`.

23. ⚠️ **`-d` build hanya membuat variabel, tidak menimpa `Property`.** Dan
    "hijau di GitHub" tidak berarti apa-apa kalau step upload-nya diam-diam
    dilewati. Keduanya hampir membuat PC kasir mati: MSI terpasang dengan
    `ServerUrl = http://localhost:3000`, agent mencoba konek ke localhost di
    PC-nya sendiri, tidak pernah sampai ke server. Gejalanya (PC OFFLINE +
    wallpaper tidak berubah) jauh dari penyebabnya, dan log server sama sekali
    tidak menunjukkan apa-apa karena agent tidak pernah sampai.
    Tiga aturan yang sekarang ditegakkan:
    - **Periksa isi build, bukan exit code-nya.** `grep 'http://localhost:3000'
      <file>.msi` harus kosong. Dan "Verify MSI contents" sekarang membaca
      tabel Property dan gagal keras kalau nilainya salah.
    - **Unduh ulang dari server lalu bandingkan `sha256`, bukan ukuran.**
      Dua MSI berturut-turut bisa sama-sama 64822192 byte padahal isinya beda.
    - **Upload lewat `localhost:3000`, bukan lewat domain** — Cloudflare
      memotong di ~18 MB dan MSI-nya 62 MB.
    Pelajaran yang lebih umum berlaku untuk tool apa pun: kalau sebuah tool
    menolak input dengan pesan "unexpected child element", **berhenti menebak
    posisi dan cari sumber kebenarannya** (reflection API, berkas skema, atau
    dokumentasi). Enam percobaan berurutan di sini semuanya salah karena tidak
    ada satu pun yang berbasis bukti.

## Notifikasi push FCM — pelanggan login di komputer warnet (30 Sep) ✅

Admin diberi tahu di HP kalau ada pelanggan yang memulai sesi, supaya tahu
kasir sedang dipakai, meskipun admin sedang tidak di meja. Notifikasi FCM, **bukan**
WebSocket, karena hanya FCM yang bisa membangunkan aplikasi yang sudah mati.

### Yang sudah ada sebelumnya, dan dipakai ulang

Event loginya sudah ada. `SessionService.loginRequest()` sudah memanggil
`broadcastActivityLog('session:started', { sessionId, pcId, akun, durasiDetik })`,
dan itu juga sudah disimpan ke `ActivityLog`. Yang ditambahkan hanya
penyiarannya ke perangkat admin. `SessionService` **tidak disentuh sama sekali**;
semuanya di dalam `SessionGateway.handleLoginRequest()`.

### Renyawannya

- `prisma/schema.prisma` → model `Perangkat`, migration
  `20260930100153_add_perangkat_notifikasi`.
- `src/notifikasi/notifikasi.controller.ts` → `POST` + `DELETE /api/notifikasi/token`.
- `src/notifikasi/notifikasi.service.ts` → `daftarToken`, `hapusToken`, `kirimSesiMulai`.
- `src/notifikasi/fcm.service.ts` → pengirim FCM HTTP v1 tanpa `firebase-admin`.
- `src/session/session.gateway.ts` → `kabarPemakaiNotifikasi()` dipanggil di
  cabang sukses `handleLoginRequest`.

### ⚠️ Role SELALU dari JWT, tidak pernah dari body

`DaftarTokenDto` sengaja tidak punya field `role`. Kalau ada, kasir cukup
mengirim `role: "ADMIN"` untuk mendaftarkan dirinya sebagai penerima notifikasi
admin. Server juga tidak pernah mengirim apa pun soal identitas akun ke notifikasi
(lihat di bawah).

### ⚠️ Identitas akun tidak boleh masuk notifikasi — dan nama member diSENSOR

Nama member adalah **kredensial login**-nya (`session.service.ts` mencocokkan
`nama`), dan notifikasi Android terlihat di **layar kunci HP yang bisa dilihat
siapa saja**. Jadi nama member tidak pernah dikirim penuh — hanya **dua karakter
pertama**, sisanya `***`: `"Budi Santoso"` → `bu***`.

Fungsi `sensorNama()` di `notifikasi.service.ts` (diekspor supaya bisa diuji).
Kode **voucher** boleh tampil utuh karena bukan kredensial.

Contoh isi notifikasi (4 Okt):

```
Member bu*** · PC001 (PC)          <- pelanggan login di komputer
Member bu*** · PC003 (Dashboard)   <- kasir menekan Start di dashboard
Voucher 500344 · PC005 (Dashboard) <- kasir membuat voucher & Start
```

⚠️ **Sumbernya wajib ditulis** karena ketiganyakc diarahkan ke admin, dan
tanpa keterangan itu admin tidak tahu apakah itu pelanggan atau kasir yang
memulai sesi. Ada **tiga** pemanggil `kabarPemakaiNotifikasi()` — `PC` dari
`client:login_request`, `Dashboard` dari `dashboard:start_pc` dan
`dashboard:start_voucher`.

Tes: `backend/test/notifikasi-nama.spec.ts` (7 kasus) — sudah dibuktikan
**gagal** kalau `sensorNama` dikembalikan tanpa sensor.

### ⚠️ Channel notifikasi harus importance TINGGI, dan namanya harus sama di tiga tempat

Kalau `channel_id` tidak dikirim, FCM memakai channel bawaannya yang
importance-nya rendah: notifikasi tetap muncul tapi **tanpa suara dan tanpa
getaran** — persis bagian yang paling dibutuhkan di warnet. Nama channel
`sesi_dimulai` ada di **tiga** tempat yang harus tetap sama:

| Tempat | Yang ditulis |
|---|---|
| `backend/src/notifikasi/notifikasi.service.ts` | `const CHANNEL_ID` |
| `mobile/android/.../MainActivity.kt` | `const val ID_CHANNEL_NOTIF` |
| `mobile/lib/core/notifikasi/notifikasi_lokal.dart` | `static const idChannel` |

⚠️ **`requestPermissions` jawabannya ke `onRequestPermissionsResult`, bukan
`onActivityResult`.** Kalau diletakkan di `onActivityResult`, hasilnya tidak
pernah sampai dan Dart menunggu selamanya. Dan `onActivityResult` yang sudah ada
memulai dengan `if (hasilMenunggu == null) return` — itu untuk installer APK,
jadi jangan dipakai untuk yang lain.

### ⚠️ `private_key` dari JSON Firebase berisi `\n` sebagai dua karakter

Bukan baris baru. Kalau tidak diganti (`raw.replace(/\\n/g, '\n')`), `createSign`
membaca kunci yang rusak dan errornya tidak mendekati penyebabnya.

### Aturan daftar/cabut token (sudah diuji)

| Keadaan | Yang harus terjadi |
|---|---|
| Login sebagai ADMIN, sakelar nyala | daftar token |
| Login sebagai ADMIN, sakelar mati | cabut token |
| **Login sebagai KASIR** | **cabut token, jangan daftar** |
| Logout | cabut token |
| Izin notifikasi ditolak | jangan daftar, dan dilaporkan ke kasir |
| Token berubah (setelah uninstall) | daftar ulang, hanya kalau sesi admin |

Baris KASIR dan logout adalah yang paling penting. Tanpa keduanya, HP yang
pernah dipakai admin lalu dipakai kasir akan **tetap menerima notifikasi admin**
hanya karena token-nya masih tersimpan di server.

⚠️ **Urutan di `AuthProvider.logout()` penting**: `sebelumLogout()` harus
jalan **sebelum** `_repo.logout()`, karena penghapusan token memakai JWT dan
`logout()` membersihkan token itu dari penyimpanan. Kalau urutannya dibalik,
permintaannya terkirim tanpa autentikasi dan tokennya tertinggal.

Token yang ditolak FCM (`UNREGISTERED`, `INVALID_ARGUMENT`,
`SENDER_ID_MISMATCH`) **dihapus sendiri** dari database — itulah yang membersihkan
HP yang sudah di-uninstall. Kalau tidak, satu permintaan ke token mati per notifikasi.

### Sisi mobile

```
lib/core/notifikasi/push_client.dart         wrapper Firebase (bisa dikTes)
lib/core/notifikasi/notifikasi_provider.dart aturan daftar/cabut + sakelar
lib/core/notifikasi/notifikasi_repository.dart daftar/hapus token
lib/core/notifikasi/notifikasi_lokal.dart    channel + izin lewat MethodChannel
```

- **FCM tidak menampilkan notifikasi otomatis saat aplikasi sedang terbuka.**
  Pesannya datang ke `NotifikasiProvider.banner`, lalu `AppShell` menampilkannya
  sebagai SnackBar. Notifikasi sistem yang muncul di atas aplikasi yang sedang
  dibaca justru mengganggu.
- `SecureStore._kNotifikasiSesi` **sengaja tidak ikut `clear()`**. Kalau ikut,
  setiap logout mengembalikan sakelarnya ke default dan kasir yang sengaja
  mematikannya akan melihat sakelarnya nyala lagi.
- Sakelar di Profile **hanya tampil untuk akun admin**. Baris yang tidak pernah
  berubah akan membuat orang mengira ada yang salah.
- `push_client.dart` ada supaya provider bisa diuji tanpa Firebase sama sekali.

⚠️ **`muat()` mengembalikan Future, bukan void, dan `setAktif()` harus
`await muat()` lebih dulu.** Pembacaan penyimpanan itu async; kalau `setAktif`
jalan lebih dulu, nilai dari storage akan menimpa pilihan pengguna. Ini ditemukan
karena tes "sakelar mati: token tidak didaftarkan" gagal.

### `.env` dan CI

`FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` di `.env` root, dan tiga
baris yang sama sudah ditambahkan ke `docker-compose.yml`.

Kalau ketiganya kosong, backend **tetap jalan normal**: pengiriman jadi no-op
yang dilog sekali, bukan server gagal start.

`android/app/google-services.json` **tidak masuk repo** (`.gitignore`), dan CI
mengambilnya dari secret `GOOGLE_SERVICES_JSON_BASE64`. ⚠️ Kalau secret itu
kosong, workflow **gagal dengan pesan jelas** — berbeda dari `KEYS_BASE64` yang
sengaja jatuh ke debug key. Alasannya plugin `com.google.gms.google-services`
membangun build kalau file tidak ada, dan tidak ada fallback yang sah: aplikasi
tanpa project id Firebase tidak bisa mengirim push sama sekali.

### Batasan yang harusSelalu diingat

1. **Butuh Google Play Services aktif.** HP degoogled atau ROM China tidak akan
   pernah menerima notifikasi.
2. **Token FCM terikat ke keystore rilis.** Kehilangan `v3netbill-release.jks`
   bukan hanya membuat APK tidak bisa diterbitkan — push ikut mati untuk semua
   perangkat yang sudah terdaftar.
3. **Kalau Google mati, push ikut mati.** Tidak ada satu pun mekanisme yang
   menutup tiga hal di atas.

### ⚠️ Dua bug yang keduanya salah dari kode, bukan dari constexpr Google

Keduanya baru ketahuan waktu mengirim sungguhan, bukan dari membaca dokumentasi.
Kalau feature ini ditulis ulang, dua hal ini yang pertama harus dicek.

**1. `message.android.notification` TIDAK punya field `channel_name`.** Nama
channel hanya dipakai saat channel dibuat di perangkat, bukan per-pesan.
Mengirim field tak dikenal membuat FCM membalas `400 Unknown name
"channel_name"` untuk **setiap** notifikasi. Verifikasi: kirim langsung ke
`fcm.googleapis.com` dan baca jawabannya. Jangan menebak nama field dari
kebiasaan.

**2. Kode error FCM ada di `error.details[].errorCode`, bukan di
`error.status`.** Untuk token yang sudah tidak berlaku, `status` menuliskan
`NOT_FOUND` sedangkan `errorCode` menuliskan `UNREGISTERED`. Versi lama membaca
`status`, dan `INVALID_ARGUMENT` langsung dianggap "token mati".

Yang kedua lebih berbahaya: `INVALID_ARGUMENT` juga dipakai FCM ketika
**request kita sendiri** yang salah. Jadi satu field yang tidak dikenal
menghapus **semua token yang sah** — termasuk token HP yang sedang aktif.
Sekarang `tokenMati` hanya true untuk `UNREGISTERED` dan `SENDER_ID_MISMATCH`, dan
log ikut menampilkan `errorCode` supaya kejadian serupa tidak bisa diam-diam.

⚠️ **Pelajaran yang lebih umum: klasifikasi "token mati" adalah tindakan
destructive.** Kalau salah klasifikasi, satu kesalahan kode mematikan notifikasi
untuk semua orang dan gejalanya muncul jauh dari tempat penyebabnya (kasir
merasa "notifikasi mati" sementara serverhanya log "1 token dihapus").
Aturan: kalau kodenya ambigu, jangan hapus.

### 🔬 Cara menguji FCM tanpa perangkat

Tidak perlu HP untuk membuktikan payload dan kredensialnya benar:

1. Ambil `FCM_*` dari `.env` ke file sementara **di dalam container** saja
2. Tanda tangani JWT RS256, tukar di `oauth2.googleapis.com`
3. Kirim ke `projects/{id}/messages:send` dengan token asal-asalan
4. Jawaban yang diharapkan: `404` + `UNREGISTERED`, bukan `400`

Kalau jawabannya `400`, payload-nya salah — dan itu persis yang terjadi. Hapus
file itu setelah selesai: isinya private key.

## Log billing berkas (1 Okt) ✅

Semua aktivitas billing ditulis sebagai **berkas teks**, satu hari satu berkas, di
folder yang sudah bind-mount ke host — bukan tabel database.

```
LOG_BILLING_DIR   default /data/logs   ->  host: data/logs/
nama berkas       billing-YYYY-MM-DD.log
retensi           30 hari (cron 03:00 + dijalankan sekali saat start)
```

Aksesnya lewat tab **Pengaturan -> Log Billing** (khusus admin): pilih tanggal,
cari isi, unduh `.txt` per tanggal. Endpointnya tiga, semuanya `ADMIN`:
`GET /api/log-billing`, `GET /api/log-billing/:tanggal?cari=`,
`GET /api/log-billing/:tanggal/unduh`.

`src/log-billing/` berisi `log-billing.service.ts`, `log-billing.controller.ts`,
`log-billing.cron.ts`, `log-billing.module.ts`.

### ⚠️ Satu titik masuk, bukan tersebar di banyak modul

Penulisan dipanggil dari **satu tempat saja**: `broadcastActivityLog()` di
`session.gateway.ts`. Semua aktivitas yang sudah lewat situ — sesi mulai/berakhir,
setiap jenis transaksi akun, kunci/matikan/buka PC, akun dinonaktifkan — otomatis
tercatat. Jadi menambah event baru cukup lewat situ.

Tiga aktivitas **tidak** lewat situ dan sengaja ditambahkan terpisah:
`auth:login` (di `auth.controller.ts`, memakai `loginDto.username` supaya bentuk
jawaban `POST /auth/login` tidak berubah), `pc_unlock` (di gateway, hanya kalau
`unlockPc` benar-benar berhasil), dan `account:password_changed` (di
`accounts.service.ts#changePassword` — jejak aktivitas lama tidak pernah memuatnya).

⚠️ **`tulis()` tidak pernah melempar, dan itu disengaja.** Ia mengantrekan
penulisan lewat rantai Promise supaya dua baris tidak saling menimpa di tengah
satu baris. Kegagalan menulis berkas **tidak boleh** mengganggu operasi yang
sedang berjalan — bayangkan kasir menekan "matikan PC" lalu seluruh halaman
hilang dari dashboard karena folder log sedang tidak bisa ditulis.

### ⚠️ Isi berkas memakai allow-list, bukan `JSON.stringify(payload)`

`payload` asli memuat `id` (UUID), `kasirId`, dan `sessionId`. Yang ditulis hanya
field yang sudah dipetakan: `akun`, `pc` (dari cache nama PC, bukan UUID),
`kasir` (dari `by` atau `username`), `jenis`, `nominal`, `durasi`, `dipakai`,
`sisaKembali`, `alasan`, `tipe`, `sandiDiubah`, `sesiDihentikan`, `keterangan`.
Field lain **tidak pernah** masuk berkas, termasuk password.

Bentuk satu baris:
`2026-10-01T02:15:55.484Z | Sesi Berjalan | pc=PC001 akun=VCH-1234 durasi=3600`

### ⚠️ Dua bug yang keduanya berasal dari `try` yang terlalu luas

Keduanya baru ketahuan karena pengujiannya memakai serangan nyata, bukan hanya
membaca kode. Dua-duanya soal hal yang sama: **nama berkas dibangun dari input
yang belum tentu sah.**

**1. Validasi tanggal tertelan `catch` "file tidak ada".** `baca()` menulis
`readFile(this.jalurBerkas(tanggal))` di dalam `try`, lalu `catch` mengembalikan
hasil kosong untuk "berkas tidak ada". Tapi `jalurBerkas()` juga melempar
`TanggalLogTidakSahError` di titik yang sama — jadi error validasi ikut tertelan
dan dijawab **`200` dengan hasil kosong** untuk `?tanggal=../../.env`. Isinya
memang tidak bocor (`readFile` tidak pernah terpanggil karena validasi melompat
lebih dulu), tapi jawabannya berbohong dan tidak ada yang bisa mempercayai
`400`-nya. Perbaikan: validasi dilakukan **di luar** `try` yang menangkap
"tidak ada".

**2. `Content-Disposition` bisa dirusak dari input pengguna.** `unduh()` memakai
`nama: log-billing-${tanggal}.txt` dari input mentah. Input berisi tanda kutip
menghasilkan `attachment; filename="log-billing-.." x.txt"` — header sudah rusak
sebelum diunduh. Perbaikan: nama berkas dibangun dari tanggal yang sudah lolos
validasi.

Hasil pengujian setelah diperbaiki: path traversal mentah (`../`) ditolak `404`
oleh Express sebelum sampai ke controller, path ter-encode (`%2F`, `%2e%2e%2f`)
ditolak `400` oleh validasi, dan berkas rahasia di luar folder log tetap utuh.
Otorisasi `401` tanpa token, `403` untuk kasir, `200` untuk admin.

⚠️ **Uji path traversal lewat `curl` biasa tidak trustworthy.** curl menormalkan
`../` sebelum mengirim, sehingga request-nya tidak pernah sampai ke controller dan
yang terlihat adalah `200` HTML dari SPA fallback — yang membuat validate-nya
tampak tidak bekerja. Serangan sesungguhnya harus memakai `curl --path-as-is`.

### Berkas log dibuat sebagai root

Container backend berjalan sebagai `root`, jadi berkas log di host di
`data/logs/` bernilai root-owned seperti `/data/apk/` dan `/data/installer/`.
Bisa dibaca bebas dari host, tapi untuk menghapus manual harus lewat
`docker exec v3netbill-backend rm -f /data/logs/<nama>`. Mengosongkan log untuk
memulai dari nol sebaiknya lewat container, bukan `rm` dari host.

- `GET /api/activity-log?limit&cursor` (paginate) dan `GET /api/activity-log/today`.
- Dicatat dari `session.gateway.ts#broadcastActivityLog` untuk event `session:started`, `session:stopped`,
  `pc_locked`, `pc_unlocked`, `pc_shutdown`, `transaction:created`.
- Field `by` = nama user JWT, `kasirId` = id user. `by` diisi dari `client.data.username`
  (diisi saat verifikasi JWT di handshake, `session.gateway.ts:55`).
- Cron `cleanup-activity-logs` tiap 02:00 — retensi 30 hari.

## Diagnosa agent otomatis (2 Okt) + perbaikan bug agent offline 8 jam

### Insidennya

PC001 terputus **03:28:58 WIB** dan baru konek lagi **11:35 WIB** — 8 jam 7 menit.
Server **tidak pernah restart, tidak crash, dan semua cron-nya normal**. Yang rusak
sep entirety ada di agent Windows.

Penyebabnya bukan service yang mati. `SocketIOClient.Connected` **macet di `true`**
waktu WebSocket-nya sebenarnya sudah mati: middlebox (Cloudflare tunnel/NAT) drop flow
tanpa FIN/RST, jadi client tidak pernah diberi tahu. Supervisor reconnect
(`MaintainConnectionAsync`) memeriksa flag itu, jadi **tidak pernah memanggil
`ConnectAsync` lagi**. Bukti di `agent.log`: **318 kegagalan heartbeat berturut-turut
semuanya dengan `connected=True`**, dan `catch`-nya hanya menulis ke log.

Tigacacat ditemukan dari log PC (`C:\ProgramData\v3NetbillAgent\logs\`):

| Temuan | Perbaikan |
|---|---|
| `IsConnected` hanya percaya `SocketIO.Connected` | `IsConnected` sekarang `c.Connected && !_socketMati && !SudahStale` |
| Heartbeat gagal cuma dilog | 2x gagal beruntun (30 dtk) -> `TandaiSocketMati()` -> supervisor buat **instance Socket.IO baru** |
| Tidak ada jaring kalau heartbeat diam | `SudahStale`: 60 dtk tanpa bukti hidup -> dianggap mati (juga menutup kelas bug timer 1.0.8.0) |
| `SendStopSessionAsync` tanpa `try/catch` | Ditambah guard + try/catch. **Ini yang membuat pipeitus 26 ms setelah tombol STOP ditekan** (`11:30:56.532` stop diterima, `11:30:56.558` pipe putus) |
| `PipeListenerAsync` satu catch untuk semua | Try/catch **per pesan** — satu perintah gagal tidak lagi membuang pipa |
| `_registered` di-set setelah `await` | Di-set **sebelum** `await` — hilangkan 2-3x `agent:register` per koneksi |
| `agent:register` fire-and-forget | Dibungkus `RegisterAsyncAman()` supaya tidak jadi unobserved task exception |

### Bug tambahan yang ditemukan saat membaca kode

⚠️ **`CountdownText` memakai `mm:ss` yang SALAH untuk sesi >= 1 jam.**
`TimeSpan.ToString(@"mm\:ss")` memakai komponen menit-dalam-sejam, jadi sesi
member 10 jam **selalu tampil "00:00"**. Di aplikasi billing angka yang salah lebih
buruk daripada tidak ditampilkan. Sekarang memakai format dashboard web (`Xj HH:MM`).

⚠️ **`AgentLog.TrimIfNeeded()` memakai `fs.SetLength(250_000)`** — memotong 75%
log **di tengah baris, tanpa penanda**. Itulah yang menghapus jendela 26 Sep 11:17
sampai 2 Okt 10:14, yaitu persis periode yang dibutuhkan saat insiden. Batas potongnya
terlihat sebagai dua baris tertimpa: `Heartbeat tick #42026-10-02 10:14:29.020 ...`.

### Log sekarang satu berkas per tanggal

```
C:\ProgramData\v3NetbillAgent\logs\agent-2026-10-02.log
C:\ProgramData\v3NetbillAgent\logs\overlay-2026-10-02.log
retensi 30 hari, dihapus otomatis sekali per hari
```

`fs.SetLength` **sudah dihapus**. Batas 20 MB/hari: setelah itu hanya baris "tick
sehat" yang dilewati, **kegagalan tetap dicatat**. Tick sehat cukup dicatat tiap 20
tick (5 menit) lewat `AgentLog.WriteRutin` — dulu tiap 15 detik, itu sendiri 5.760
baris sehari.

### Kartu mini meniru kartu PC dashboard

Mini window sekarang memakai identitas visual yang sama dengan `.pcc` di dashboard
web: panel putih radius 16, header pastel `#E0F7FA` min-height 90, hitung mundur 32px,
body berisi **nama akun + STATUS (BERJALAN) + TIPE (Voucher/Member)**.

Tombol STOP dan GANTI PASSWORD jadi **ikon saja 32x32 radius 8 dengan ToolTip**
(minimize, ganti password, stop). Warna diambil apa adanya dari `.pcc__act--power`.
Ditambah indikator **`SERVER TERPUTUS` merah** dengan angka countdown yang jadi redup:
kalau server tak terjangkau, hitung mundur memang tidak bergerak dan itu wajib terlihat.
Timeline progress bar **dihapus** — tidak ada di kartu web.

⚠️ **Veil putih DI ATAS wallpaper sudah dihapus (2 Okt).** Dulu ada Border putih
`Opacity="0.62"` yang membuat wallpaper hanya tampil sekitar 40 persen, jadi
operator tidak bisa melihat layar PC. Kelemahannya jauh lebih besar dari
gunaannya: kartu putih punya border 1px slate sehingga tetap terbatas dari
wallpaper dan tidak "tempel". `WallpaperVeil` + `SinkronkanVeil()` +
`_wallpaperDimuat` ikut dibuang supaya tidak ada elemen tak terpakai. Kalau
nanti kartu putih ternyata sulit dibaca di wallpaper tertentu, penanganannya
`Border` kartu — **jangan** membuat seluruh layar pucat lagi.

### `.bat` diagnosa yang dikirim otomatis

`Agent.Service/kumpul-log.bat` ikut ter-install MSI (terbukti ada di hasil
`dotnet publish`, jadi masuk `SvcDepComponents` otomatis). Dipicu dari
`TandaiSocketMati`, dijeda 45 detik supaya log ikut memuat prosesKesembuhannya.
Cooldown 30 menit, maks 4/hari, zip <= 4 MB.

Isinya: log 7 hari, `sc qc`/`sc query`, state scheduled task watchdog, tasklist,
Event Log 7031/7034/1000.

⚠️ **Yang SENGAJA tidak dikumpulkan: registry dan `appsettings.json`.**
`HKLM\Software\v3Netbill\Agent` memuat `AgentToken` (mengizinkan `create_password`
+ `stop_session`), `OtpBotToken` yang merupakan **token bot Telegram aktif**
(ditulis `OtpService.SimpanConfig`), `OtpChatId`, dan `BypassPinHash`. `diagnosa.bat`
yang lama di root repo **melakukan `reg query` ke key itu** — jangan dipakai untuk
dikirim ke server.

Sisi server: `POST /api/diagnosa` (`@Public()`, identitas `pcId`+`agentToken`),
`GET /api/diagnosa` + `GET /api/diagnosa/:nama` (ADMIN), cron `cleanup-diagnosa`
04:00 hapus > 14 hari. Disimpan di `/data/diagnosa/` — di luar `frontend-dist`, jadi
tidak bisa diakses publik (sudah diuji: jalur publik mengembalikan SPA fallback).

Sudah diuji dengan serangan nyata: 401 tanpa token, 403 kasir, 401 `agentToken` salah,
400 bukan zip, traversal mentah & ter-encode 404 dengan berkas umpan tetap utuh, dan
sha256 berkas unduhan identik dengan aslinya.

### 🔴 Tiga bug yang ketahuan dari screenshot PC, bukan dari kode (2 Okt)

Semuanya **lolos `dotnet build`**, dan tiga di antaranya kode yang tulis sendiri
di sesi yang sama. Yang ketiga hampir tidak mungkin ketahuan tanpa-installed MSI.

**1. Hitung mundur kosong untuk setiap sesi di bawah 1 jam.** Di dalam *verbatim
string* `@"..."` tidak ada escaping, jadi `@"mm\\:ss"` berarti **dua backslash**
dan `TimeSpan.ToString` melempar `FormatException`. Binding WPF yang melempar
tidak menampilkan apa pun — jadi yang tampil cuma label "SISA WAKTU" dengan
angka kosong. Terbukti dengan eksekusi .NET:

```
verbatim 1 backslash (lama)     -> "18:01"              OK
verbatim 2 backslash (yang ditulis) -> FormatException   GAGAL
```

Sekarang `@"mm\:ss"` + dibungkus `try/catch` dengan cadangan `${SisaDetik}s`.
Regresinya ada di `.verify/CountdownTest/` (11 kasus, termasuk `600` detik =
voucher 500 yang memang jadi kasus di lapangan).

⚠️ **Jangan pakai `hh` di format itu.** `hh` adalah jam-DALAM-SEHARI, jadi
3600 detik jadi `1j 01:00` — jamnya dobel dengan angka jam total yang sudah
dicetak di depannya. Yang dipakai hanya `mm` dan `ss`.

**2. `Registry.CurrentUser` tidak pernah memblokir Task Manager.**
`Worker.cs` menulis `DisableTaskMgr` ke `CurrentUser`, tapi service jalan sebagai
LocalSystem, jadi `CurrentUser` = `HKEY_USERS\S-1-5-18`. Nilai itu hanya
berlaku untuk akun SYSTEM dan tidak pernah sampai ke akun pelanggan.
Fitur ini sudah ada sejak awal tetapi **tidak pernah berfungsi**.
Sekarang ditulis ke setiap profil di `HKEY_USERS` (lewat `_Classes` dan key
berawalan titik), plus `WM_SETTINGCHANGE` disiarkan supaya tidak baru berlaku
setelah Task Manager ditutup.

**3. Flag stop dibaca dari path BERBEDA oleh service dan overlay.**
`Environment.SpecialFolder.CommonDocuments` bernilai
`C:\Users\Public\Documents` untuk user interaktif, tapi
`C:\Windows\System32\config\systemprofile\Documents` untuk LocalSystem.
Jadi flag yang ditulis overlay tidak pernah terlihat service — watchdog akan
membangunkan overlay terus-menerus sepanjang mode maintenance.
Sekarang satu definisi di `Agent.Core/FlagPaths.cs`, dipakai service, overlay,
`watchdog.cmd`, dan `uninstall-old-agent.bat`. Pola yang sama seperti nama
channel FCM: satu nama, wajib sama di semua pihak.

### Nomor versi MSI — bisa dibaca, dan tidak bisa lagi basi (2 Okt)

`Product/@Version` sudah **1.0.9.0 sejak versi 1.0.9.0**, padahal MSI dibangun
ulang belasan kali sejak itu. Semuanya tercatat `1.0.9.0`, jadi mustahil
diketahui mana yang benar-benar terpasang di PC kasir.

Sekarang:

| Yang | Nilai |
|---|---|
| `Product/@Version` | `1.0.17.0` |
| `HKLM\...\Agent\AgentVersion` | `[ProductVersion]` — otomatis, tidak diketik |
| `HKLM\...\Agent\InstalledBuildUtc` | `[InstallDate]` — properti MSI bawaan |

WAJIB menaikkan `Product/@Version` di setiap perubahan MSI. Ini satu-satunya
tempat yang harus diedit manual; `AgentVersion` di registry dan nomor versi di
halaman Pengaturan ikut dari sini, jadi kalau lupa, seluruh nomor versi yang
tampil di web ikut bohong.

Lintasan 2 Okt: `1.0.9.0` (terbaca di semua build sebelumnya) -> `1.0.10.0`
(nomor versi jadi terbaca) -> `1.0.11.0` (`lpDesktop` + watchdog session 0) ->
`1.0.12.0` (flag path seragam + log mode maintenance).

Cek langsung di PC:

```cmd
reg query "HKLM\SOFTWARE\v3Netbill\Agent" /v AgentVersion
reg query "HKLM\SOFTWARE\v3Netbill\Agent" /v InstalledBuildUtc
```

Step "Verify MSI contents" membaca `ProductVersion` dari MSI dan **GAGAL** kalau
masih `1.0.9.0` **atau kosong**. Lupa menaikkan tidak bisa lagi lolos ke artifact.

⚠️ **Tiga jebakan yang sudah dilewati di sini — semuanya lolos build lokal.**

**1. `wix build -d` HANYA membuat preprocessor variable, bukan properti MSI.**
`<Property Id="X" Value="$(var.X)" />` dengan `-d X=...` merusak build di CI:
nilainya kosong sampai `WIX0006`. Diganti `[InstallDate]`, properti MSI
bawaan yang selalu terisi dan tidak butuh apa pun dari luar.

**2. `<Property>` tanpa `Value` dan tanpa Admin/Secure/Hidden diabaikan WiX
(`WIX1006`).** `V3PINVERIFIED` yang ditambahkan untuk "PIN hanya diminta
sekali" **tidak pernah dipakai** — uninstall-old-agent.bat mengirim
`V3PINVERIFIED=1` tapi MSI tidak memperhatikannya. Public property yang dikirim
baris perintah dibuat otomatis oleh installer, jadi **tidak perlu
dideklarasikan sama sekali**.

**3. Nama property versi MSI adalah `ProductVersion`, bukan `Version`.**
Check yang membaca `Version` selalu dapat string kosong, dan karena itu
**tidak pernah gagal sama sekali** — persis jenis bug yang seharusnya diceknya.
Karena itu versi kosong juga harus dianggap gagal.

### ⚠️ Satu koneksi agent = DUA kali register (2 Okt)

Agent menaruh `pcId`+`agentToken` di **handshake query** Socket.IO (dibaca
`handleConnection`) **dan** mengirim event `agent:register`. Keduanya bertemu di
`registerAgent()`, jadi tanpa penjaga tiap koneksi:

- menulis `lastHeartbeatAt` dua kali,
- mendorong `dashboard:pc_update` dua kali,
- mengirim `agent:otp_config` + `agent:bypass_config` dua kali ke socket yang sama.

Terlihat sebagai dua baris `registered with socket` berselang satu detik.
**Gejalanya tidak merusak apa pun**, jadi mudah lolos — hanya pekerjaan yang
terlipat ganda dan config OTP terkirim ganda.

Penjaga ada di `session.gateway.ts#registerAgent()`:
`if (this.socketPcMap.get(client.id) === pcId) return true;`

⚠️ Jangan menghapus handshake query `pcId`/`agentToken` dengan alasan "cukup pakai
event saja". Justru handshake yang membuat daemon reconnect pulih sendiri —
`agent:register` cuma jaring pengaman.

### 🔴 Overlay tidak muncul: ternyata FLAG MAINTENANCE (2 Okt)

Penyebab sebenarnya, terbukti dari `overlay-2026-10-02.log`:

```
Stop flag 'C:\Users\Public\v3netbill-agent-stop.flag' ada
— overlay keluar (mode maintenance)
```

Overlay **MELETAK, lalu LANGSUNG KELUAR** — setiap kali, berulang. Jadi
.launch `CreateProcessAsUser` selalu sukses dan proses selalu ada di tasklist
sesaat. Semua perbaikan sebelumnya (termasuk yang saya buat) hanya menggeser
gejalanya tanpa menyentuh penyebabnya.

**Akhirnya**: hapus `%PUBLIC%\v3netbill-agent-stop.flag`, `sc start v3NetbillAgent`.

### ⚠️ Tiga jebakan yang membuat masalah ini sulit

**1. Path flag TIDAK SERAGAM, dan dokumentasi yang salah justru memperburuk.**
`Agent.Core/FlagPaths.cs` mengambilnya dari environment variable `PUBLIC`, jadi
nilainya `C:\Users\Public\...` — **tanpa** `Documents`. Tapi `watchdog.cmd`
dan `uninstall-old-agent.bat` masih memakai `%PUBLIC%\Documents\...` dan
`%USERPROFILE%\Documents\...`, dan `HANDOFF.md` mendokumentasikan path yang
SALAH. Dua konsekuensi:
- `watchdog.cmd` tidak pernah melihat flag yang ditulis overlay.
- Setiap kali mencari penyebab, dokumentasi mengarahkan ke path yang tidak ada
  isinya — termasuk petunjuk yang saya berikan ke user. Sudah diperbaiki di
  `a0e631f` (kode, `.cmd`, `.bat`, dan dua dokumen).

**2. Mode maintenance BISU di `agent.log`.** `WatchdogCallback()` menulis ke
`_logger.LogInformation` saja, bukan `AgentLog`. Dari `agent.log` terlihat
watchdog **tidak pernah jalan**, padahal justru sedang menahan pelepasan.
Sekarang ditulis ke `AgentLog` beserta path flagnya.

**3. "Proses ada" ≠ "overlay terlihat".** Kalau proses overlay sudah ada,
watchdog tidak meluncur ulang — jadi overlay tak terlihat bisa menggantung
selamanya. Tapi kriteria SessionId yang terlalu longgar justru lebih buruk:
 begitu operator memakai RDP, `WTSGetActiveConsoleSessionId()` mengembalikan
sesi konsol sementara overlay berjalan di sesi RDP, sehingga overlay yang
**benar-benar tampil** dibunuh tiap 5 detik. Yang aman hanya session 0.

⚠️ Pelajaran: sebelum mengejar penyebab, **baca log yang diberikan sampai
sampai**. Baris pertama file itu sudah menjawab pertanyaan, dan saya
membuild dua MSI sebelum menyadarinya.

### Nomor versi MSI tampil di halaman Pengaturan (2 Okt)

Kartu **Installer Agent** di tab Instalasi sekarang menampilkan
`Versi 1.0.12.0`, sejajar dengan versi APK. Sebelumnya hanya nama berkas dan
ukuran — dan keduanya **tidak bisa membedakan build**:

- nama berkas selalu `installer-<timestamp>.msi`, bentuknya sama persis;
- ukuran juga tidak berubah antar build (dua MSI berturut-turut bisa sama-sama
  64.867.608 byte padahal isinya berbeda).

Jadi halaman ini sebelumnya tidak bisa menjawab pertanyaan yang paling sering
muncul: *installer versi berapa yang ada di server sekarang?*

Pola yang sama dengan `apk_meta` + `GET /apk/info`, diterapkan ke
`installer_meta` + `GET /settings/installer/info` (lima field aman, JWT wajib).

⚠️ **MSI bukan berkas teks, dan string pool-nya tidak punya byte panjang.**
Byte di sebelah `ProductVersion` **langsung** adalah versinya:

```
ProductVersion1.0.12.0UpgradeCode{7F3A9B1E-...
```

Entri string diletakkan berdampingan tanpa pemisah. Versi pertama dari
`bacaVersiMsi()` mengira ada satu byte panjang seperti reader tabel biasa, dan
**selalu mengembalikan `null`** — yang terlihat seperti "MSI-nya rusak", padahal
MSI-nya baik-baik saja. Pola ini diverifikasi langsung terhadap berkas MSI asli,
bukan dari dokumentasi.

Karena tidak ada pemisah, versi yang lebih panjang bisa **terpotong**
(`1.0.12.05` terbaca `1.0.12.0`). Jadi karakter setelahnya wajib dicek bukan
angka dan bukan titik sebelum nilainya dipakai — kalau tidak, halaman ini akan
menampilkan nomor versi yang **salah**, dan justru itu yang paling berbahaya
karena orang akan mempercayainya.

### 🔴 Watermark PASSWORD tidak hilang — `PasswordBox.Password` tidak mengikat (3 Okt)

Dilaporkan dari pemakaian nyata: teks "PASSWORD" tetap menempel di atas
teks yang diketik di kolom password.

Penyebabnya bukan layout/CSS: watermark dikendalikan `DataTrigger` yang
mengikat ke `PasswordBox.Password`, dan **property itu tidak memberi
notifikasi ke binding WPF**. Jadi trigger-nya tidak pernah berubah dan
placeholder tetap tampil.

`TextBox.Text` tidak terkena masalah yang sama — tapi keduanya sekarang
dikendalikan dari code-behind (`TextChanged` + `PasswordChanged` di
`MainWindow.xaml.cs`), supaya tidak ada dua mekanisme berbeda di file yang
sama.

⚠️ Pola "watermark pakai DataTrigger ke Password/PasswordBox" **tidak
bisa dipakai**. Sudah gagal sekali dan gejalanya sangat menyesatkan, karena
layar terlihat benar — hanya ada teks yang tidak hilang.

### Konfigurasi Nextcloud pindah ke halaman Pengaturan (3 Okt, 1.0.15.0)

Empat nilai (URL, username, password, folder) diatur dari tab **Agent &
Keamanan**, bukan dari dialog installer. Alasannya installer hanya dipakai
sekali, sedangkan kredensial ini perlu bisa berubah kapan saja.

Dialog installer **tetap ada** sebagai nilai awal untuk PC yang belum pernah
konek, tapi begitu PC itu register, konfigurasi di web yang berlaku.

Pola yang dipakai persis sama dengan token bot Telegram: `patchValue`
mendorong ke agent yang sedang terhubung, jadi mengorbankan password saja
sudah langsung berlaku di semua PC tanpa menunggu agent konek ulang.

⚠️ **Password tidak pernah dimuat ke form.** Field itu kosong dengan
placeholder "sudah tersimpan" — persis seperti Bot Token. Alasannya
`GET /api/settings` mengembalikan nilai aslinya apa adanya, jadi memuatnya ke
state cuma memindahkannya ke DOM tempat skrip browser bisa membacanya.

Password yang **dikosongkan tidak berarti dihapus**; kalau dihapus, admin
tidak bisa menyimpan username/folder tanpa mengetik ulang password yang memang
tidak pernah ditampilkan lagi. Tombol "Matikan" yang benar-benar mengosongkan
semuanya.

### 🔴 Nama berkas log di Nextcloud: UUID, bukan nama PC (3 Okt, 1.0.17.0)

Upload ke Nextcloud **berhasil end-to-end** diuji pertama kalimdash\)- tapi
nama berkasnya berupa UUID:

```
16edfa47-4c1a-4bb6-b4e5-5e9607e655bd-agent-2026-10-03.log
```

Yang bisa dibaca manusia cuma `PC001`. Dan justru folder itu dibuat supaya
kasir **tidak perlu naik ke PC klien** — nama UUID membuat seluruh advantages itu
gugur, karena orang tidak tahu berkas itu milik PC yang sedang ia perbaiki.

`pcId` memang UUID, jadi agent tidak bisa menebaknya sendiri; **server yang
mengetahuinya**. Karena itu `namaPc` ikut dikirim dalam
`agent:nextcloud_config`, disimpan ke registry sebagai `PcName`, lalu dipakai
sebagai nama berkas.

Dua detail yang mudah terlewat:

- Nama PC harus diambil **per `pcId`** saat broadcast. Mengambilnya sekali untuk
  semua agent akan memberi nama yang sama ke semuanya.
- Fallback ke `pcId` tetap dipakai, supaya nama berkas tidak pernah kosong kalau
  config-nya belum pernah sampai.

### Kolom Nextcloud di installer — sudah DIHAPUS (3 Okt, 1.0.16.0)

Awalnya dialog installer punya kolom URL/username/password/folder Nextcloud.
Setelah ditelusuri ulang, **tidak ada skenario yang diselamatkan kolom itu**:

- Agent membaca config dari **registry**, bukan dari server tiap kali upload —
  server hanya menulis ke registry saat register atau saat admin mengubahnya.
  Jadi begitu PC register sekali, config tersimpan dan upload tetap jalan walau
  server mati.
- PC yang **belum pernah register** tidak punya config dari kolom itu; tapi PC
  seperti itu juga **tidak bisa billing**, karena tanpa ServerUrl/PcId/
  AgentToken dia tidak pernah konek sama sekali.
- Kalau operator mengisinya di installer tapi admin tidak pernah mengaturnya di
  web, agent punya config sementara halaman web menampilkan "belum diisi" —
  dualisme yang tidak perlu ada.
- Kalau setting di server hilang, memulihkannya berarti memasang ulang MSI di
  **setiap** PC — persis seperti kasus PcId hilang, dan tidak lebih murah.

Installer sekarang hanya menanyakan tiga hal: **Server URL, PC ID, Agent
Token**. Web jadi satu-satunya sumber konfigurasi Nextcloud.

### 🔴 Task Manager justru DIBUKA saat pelanggan mulai sesi (3 Okt)

Dilaporkan dari pemakaian nyata: saat login member/voucher, Task Manager masih
bisa diklik. Seharusnya tidak boleh.

Penyebabnya **satu baris** di `OnSessionStarted` yang memanggil
`SetTaskManagerBlocked(false)` — jadi **membuka** Task Manager tepat di saat
pelanggan mulai sesi berbayar. Baris itu sudah ada sejak commit `5f75dd3`
(fitur idle-lock), **bukan regresi hari ini**.

Yang membuatnya bertahan lama: tidak ada yang gagal. `dotnet build` lolos, log
bersih, dan service tetap heartbeat — task manager-nya diam-diam boleh dibuka
saja. Akibatnya selama sesi berjalan pelanggan bisa mematikan agent, jadi
hitung mundur berhenti tanpa tercatat dan PC tetap bisa dipakai.

Semua pemanggil diaudit ulang setelah perbaikan:

| Pemanggil | Nilai |
|---|---|
| start service | `!maintenance` |
| **sesi mulai** | **`true`** (dulu `false` — salah) |
| sesi berhenti | `true` |
| admin lock | `true` |
| service berhenti | `false` |

### Mode maintenance pindah ke registry + installer mengakhirinya (3 Okt, 1.0.13.0)

Penyebab "PC tidak terkunci setelah install berikutnya" adalah skema, bukan
kelalaian: **tidak ada komponen pun yang menghapus flag maintenance.** Satu-satunya
jalan adalah `del` manual di cmd.

Tiga alasan file diganti registry (`HKLM\Software\v3Netbill\Agent\MaintenanceMode`):

1. Tidak ada penghapus — registry punya jalur: installer membersihkannya.
2. MSI **tidak bisa** menghapus file di `%PUBLIC%`. `<RemoveFile>` hanya bisa di
   Directory milik komponennya, dan pohon Directory MSI ini tidak punya
   `%PUBLIC%` karena WiX tidak punya standard directory untuk itu.
3. `SpecialFolder.CommonDocuments` **berbeda** antara user interaktif dan
   LocalSystem — itu sebabnya pembaca tidak pernah sinkron.

Karena itu mode maintenance berarti **PC TERBUKA tanpa penagihan**: service
berhenti dan overlay tidak jalan, dan mode ini tidak boleh dibiarkan senyap.

**Installer mengakhirinya**, dan urutannya penting: `MajorUpgrade
Schedule="afterInstallInitialize"` + `ServiceControl Stop="both"` berarti service
sudah berhenti di awal instalasi dan baru nyala di `StartServices`. Menghapus
flag di tengah install tidak membuat lock screen muncul mendadak — lock kembali
**tepat saat instalasi selesai**.

Kotak **"Jaga mode maintenance"** di dialog untuk teknisi yang sedang repair.
Default **TIDAK dicentang** = instalasi biasa selalu mengakhiri maintenance
(itulah yang memperbaiki PC terjebak). `Condition="NOT KEEPMAINT"` — jadi
property kosong berarti "akhiri".

⚠️ **Mode maintenance tidak boleh memblokir Task Manager.** Penjaganya
diletakkan **di dalam** `SetTaskManagerBlocked()`, bukan di tiap pemanggil —
satu tempat menutup semua jalur.

### 🔴 Kredensial Nextcloud: jangan pernah di source (3 Okt)

Log agent + overlay dikirim ke Nextcloud tiap 5 menit lewat WebDAV
(`Agent.Core/NextcloudLogUploader.cs`), supaya kasir tidak perlu Remote Desktop
ke PC klien.

Kredensialnya diisi **installer** lewat `Agent.Overlay.exe --set-nextcloud` dan
disimpan di `HKLM`. Repo agent **publik** — URL, username, maupun password yang
ditaruh di source atau `appsettings.json` akan terbaca seluruh dunia. Pola yang
sama seperti `AgentToken`.

⚠️ **Kenapa bukan `RegistryValue` di Product.wxs** — padahal itu cara
paling wajar: nilai properti MSI **tidak bertahan antar instalasi**. Field dialog
yang dikosongkan — keadaan normal saat operator sok upgrade — akan menulis string
kosong dan **menimpa nilai lama**. Persis pola yang dulu menghapus `PcId` dan
membuat agent jatuh ke default `PC001` (terlihat di log PC 2 Okt 17:04). Jadi
penulisan dipindah ke custom action yang **tidak menulis apa pun kalau
argumennya kosong**.

### 🔴 Login card mengikuti mockup — dan mockup-nya greyscale (3 Okt)

Mockup `form_login_webdanpc.jpg` (4001×4001) **diekspor dalam GREYSCALE**:
0 dari 4000 piksel sampel punya selisih channel warna. Jadi tidak ada warna yang
bisa diambil darinya — struktur yang diikuti, palet dipetakan ke slate yang
sudah dipakai aplikasi.

- Web: field garis bawah + ikon amplop/gembok inline SVG, tombol pil gelap
  kapital. **"Remember me" dan "Forgot Password?" tidak diimplementasikan** — tidak ada
  implementasinya, dan "Remember me" bertentangan dengan `sessionStorage` yang
  sengaja dipakai supaya sesi kasir ikut terkunci.
- Desktop: `UnderlineFieldTemplate` / `UnderlinePasswordTemplate` di `App.xaml`
  (WPF butuh `PART_ContentHost`, dan border built-in harus dibuang). Radius
  kartu 16→28 = 6,7% lebar kartu, hasil **mengukur** mockup. Watermark pakai
  `DataTrigger Text=""` supaya placeholder hilang begitu ada isian.
- Aksen teal pindah dari tombol ke **garis bawah + caret**; kalau tombol juga
  memakainya, tombol tidak lagi jadi satu-satunya hal gelap di kartu.
- Latar belakang **tidak** diubah — menggradien abu akan membatalkan pengukuran
  kontras yang sudah tercatat di bagian "Latar belakang gambar".

### Pelajaran: `<Property>` tanpa `Value` — dan satu siklus CI terbuang

`WixUIBmp_Banner` (tanpa `_`) menggagalkan build dengan `WIX0094`. Terlewat
karena dialog itu ditulis ulang, dan **hanya ketahuan dari log CI** — build lokal
memang tidak bisa menangkap `WIX0094` (Butuh Windows).

### ⚠️ Uninstall: PIN diminta DUA KALI, dan cancel = agent kehilangan identitas (2 Okt)

Kejadian nyata. `uninstall-old-agent.bat` memverifikasi PIN ke server dengan
benar, lalu memanggil `msiexec /x`. MSI itu sendiri punya `UninstallGuardAction`
yang **menanyakan PIN lagi**. Membatalkan dialog kedua membuat `msiexec` keluar
dengan error, dan skrip lalu

```
echo [WARN] msiexec selesai dengan kode error - lanjut hapus manual.
```

lalu menghapus semuanya, termasuk `reg delete "HKLM\Software\v3Netbill"`.
Akibatnya `PcId` dan `AgentToken` terhapus sementara produk MSI **masih
terdaftar** — agent tidak bisa menemukan server lagi, dan tidak ada jalan
memperbaikinya selain memasang ulang.

Tiga perbaikan:

| Yang | Perbaikan |
|---|---|
| PIN dua kali | Condition `UninstallGuardAction` jadi `... AND NOT V3PINVERIFIED`; `.bat` memanggil `msiexec /x {code} V3PINVERIFIED=1` |
| `msiexec` gagal tapi skrip lanjut hapus | `if errorlevel 1` sekarang `goto :abort`. Service, folder, dan registry **tidak** disentuh |
| Registry bisa berubah di tengah jalan | Sebelum langkah destruktif, `PcId` di registry dibandingkan dengan `PcId` yang PIN-nya baru diverifikasi |

⚠️ **`V3PINVERIFIED` sengaja TIDAK diberi `Secure="yes"`.** Nilai ini bukan
rahasia, dan `Secure` mensyaratkan juga mendaftarkan property itu di
`SecureCustomProperties` agar diteruskan — satu langkah lagi yang bisa
menggagalkan seluruh mekanisme.

⚠️ **Jalan keluar (`:jalan_keluar`) wajib ada di SETIAP cabang penolakan.**
Versi pertama hanya menunjukkannya untuk satu kasus, dan teksnya **tidak
menyebut penghapusan task watchdog** — jadi service akan hidup lagi dalam satu
menit. Urutannya wajib: hapus task watchdog DULU, baru `sc stop`/`sc delete`.

**Pemulihan ketika registry sudah hilang:** produk MSI masih terdaftar karena
uninstall-nya dibatalkan, jadi **pasang MSI baru** — jalur upgrade tidak meminta
PIN (`NOT UPGRADINGPRODUCTCODE`) dan `ConfigComponents` menulis ulang `PcId`,
`AgentToken`, serta `ServerUrl`. Itu jalan tercepat dan tidak perlu `.bat`.

⚠️ **`uninstall-old-agent.bat` tidak ikut ter-install MSI.** Skrip itu hanya ada
di repo, jadi operator harus menyimpan salinannya sendiri. Ini perilaku lama,
bukan regresi — tapi rapuh, karena `.bat` adalah jalur uninstall utama.

### Notifikasi Telegram saat uninstall / kill paksa

Service **tidak bisa** mengirim peringatan tentang kematiannya sendiri. Yang
bisa adalah `watchdog.cmd` — scheduled task yang jalan tiap menit sebagai SYSTEM
dan tidak bergantung pada agent. Di situlah deteksinya.

```
Agent.Service/watchdog.cmd     deteksi + hidupkan lagi
Agent.Service/kirim-alert.ps1  kirim ke Telegram, cooldown 6 jam
```

Tiga keadaan: service tidak ada → *di-uninstall*; ada tapi STOPPED → *dihentikan
paksa* (lalu dihidupkan lagi); tidak bisa start → *exenya hilang*.

⚠️ **Dua hal yang TIDAK boleh ikut dilaporkan:** operator menekan STOP AGENT
(ada flag-nya), dan uninstall dengan PIN admin yang diterima
(`UninstallGuardWindow` menulis penanda `…uninstall-sah.flag` yang dibaca
watchdog lalu dihapus). Tanpa pembeda itu, tiap uninstall resmi akan mengirim
peringatan palsu.

Token bot dibaca dari registry PC dan langsung dipakai ke `api.telegram.org` —
tidak pernah ditulis ke berkas dan tidak pernah dikirim ke server v3netbill.

### Cara menguji fitur kirim-log tanpa PC Windows

`Agent.Core` menyasar **net8.0** (bukan `net8.0-windows`), jadi
`AgentDiagnostics` bisa dijalankan dari Linux. Harness di
`.verify/DiagTest/` memanggil server sungguhan:

```
salah-token -> ditolak          benar     -> terkirim
file-besar  -> log 3 MB DILEWATI  cooldown -> panggilan ke-2 ditolak
```

⚠️ **Setiap kasus harus proses terpisah.** Cooldown disimpan di `static field`,
jadi dua kasus dalam satu proses saling menutupi — dan hasil ujinya
menyesatkan: kasus "file giantsa" pernah gagal **hanya karena** diblokir
cooldown dari kasus sebelumnya, bukan karena log besarnya.

Bukti bahwa batas ukuran benar-benar bekerja: zip kasus normal berisi 3 berkas
(487 byte), zip kasus file-besar berisi **2 berkas** (365 byte) — log 3 MB-nya
tidak ikut. Yang **tidak** bisa diuji dari sini adalah isi `kumpul-log.bat`
itu sendiri; itu baru terbukti setelah MSI terpasang.

### Halaman Pengaturan — sidebar (2 Okt)

Tujuh tab yang tadinya deretan horizontal dipindah jadi **sidebar di kiri mulai
`lg` (1024px)**, isi halaman di kanan. Di bawah `lg` sidebar menjadi satu
pemicu yang **tertutup secara bawaan** dan menutup sendiri begitu ada bagian
yang dipilih — supaya tidak memakan layar HP yang sempit.

```
src/pages/settings/TabNav.tsx   navigasi dua tata letak dalam satu komponen
```

Dua tata letak dipilih dalam SATU komponen, bukan dua komponen terpisah —
dipisah berarti daftar label dan perilaku buka-tutup harus dijaga sinkron di dua
tempat. `aria-expanded` dipakai karena daftar mobile benar-benar bisa
dibuka-tutup; membacanya sebagai "kotak yang terpotong" akan menghitung
kolaps yang disengaja sebagai kegagalan.

## Laporan tutup hari (LaporanModule) ✅

- Cron `tutup-hari-laporan` tiap 23:30 WIB (`timeZone: Asia/Jakarta`) → agregasi hari sebelumnya,
  generate PDF (`pdfkit`), kirim email (`nodemailer`) + Telegram.
- Batas hari bisnis: 23:30 WIB. Endpoint manual `POST /api/laporan/kirim-tutup-hari` (ADMIN).
- Kredensial SMTP/Telegram hanya di `.env` — jangan ditulis ke dokumen.

## Status repository & perubahan per 2026-09-27 (sesi terakhir)

Empat repo, tidak ada repo root terpisah. **Dokumentasi project (`AGENTS.md`,
`CONVERSATION_LOG.md`, `docs/`, `docker-compose.yml`) berada di repo frontend ini.**

| Repo | Isi | Remote | Visibilitas | Checkout di host |
|---|---|---|---|---|
| repo ini (frontend) | Dashboard React + dokumentasi project | `git@github.com:41zz-2807/v3netbill-frontend.git` | **PUBLIC** | `/home/warnet/docker/v3netbill/frontend` |
| backend | API NestJS + Prisma | `git@github.com:41zz-2807/v3netbill-server.git` | **PUBLIC** | `/home/warnet/docker/v3netbill/backend` |
| agent | Agent Client Windows (.NET) | `git@github.com:41zz-2807/v3netbill-agent.git` | **PUBLIC** | `/home/warnet/docker/v3netbill/v3NetbillAgent` |
| mobile | Aplikasi Android (Flutter) | `git@github.com:41zz-2807/v3netbill-mobile.git` | **PUBLIC** | `/home/warnet/docker/v3netbill/v3netbill-mobile` |

Keempat repo **public** (dikonfirmasi via GitHub API). GitHub free tier hanya izinkan 1 repo
private → dipakai untuk memindahkan repo yang paling sensitif (kandidat: backend).
Rencana user: pindah ke **self-hosted Gitea** (deferred, belum dikerjakan).
⚠️ Kalau pindah, **4 secret keystore APK harus di-set ulang** di hosting yang baru.

### Commit terakhir (1 Okt)

- **frontend** `511e291` — **panel pastel + tombol X untuk popup**: Tambah PC,
  Buat Voucher, Buat Member memakai `PastelCard` (panel putih, header cyan)
  dengan tombol X di header. `GradientCard` + `gradientCardStyles.ts` **dihapus**
  karena cuma dipakai dua modal itu dan namanya tidak benar lagi. Tombol X juga
  dipasang di popup "Mulai Sesi" di dashboard. Detail: bagian "Modal popup".
- **frontend** `db12ccd` — **tab Log Billing** + **kartu PC redesigned Soft Pastel
  Header** (`aa0aee3` backend untuk lognya). Kartu PC dari `.uui-card*` (Uiverse
  navy + gradien + notch) jadi `.pcc*` (putih, header cyan); tombol jadi dua —
  Start saat idle, Kunci saat berjalan, Matikan selalu. Detail: bagian
  "Kartu PC dashboard" dan "Log billing berkas".
- **backend** `aa0aee3` — **log aktivitas billing harian sebagai berkas teks**
  (`src/log-billing/`), retensi 30 hari. Dua bug keamanan ditemukan waktu
  pengujian memakai serangan nyata: validasi tanggal tertelan `catch` "file tidak
  ada" (traversal dijawab 200, bukan 400) dan `Content-Disposition` dirusak dari
  input mentah. Detail: bagian "Log billing berkas" + pelajaran no. 20–21.
- **frontend** `19167ea` —


- **mobile** — **kartu PC punya tepat dua tombol**: tombol pertama bergantian
  ("Mulai Sesi" / "Akhiri Sesi"), tombol kedua "Matikan" selalu ada.
  Dulu keduanya tampil bersamaan, dan itu menyesatkan karena dua aksi
  yang bertentangan — kasir bisa menekan "Mulai Sesi" di PC yang sedang
  berjalan lalu ditolak backend. Syarat "sedang berjalan" memakai
  `hasSession` **dan** `status == active`, karena `session` bisa `null`
  walau statusnya masih `ACTIVE` sesaat setelah sisi server berubah.
  Tombolnya berdampingan, bukan bertumpuk, karena satu baris per tombol
  menambah tinggi card sekitar 50 px per PC. Tinggi card **diukur**:
  idle 178 → 120 px, dengan sesi 228 → 166 px (padding card 16 → 12 dan
  dua celah dalam dikecilkan). Label tombol dibungkus `Flexible` +
  ellipsis karena dua tombol berbagi lebar card. 9 tes di
  `test/pc_card_test.dart`, termasuk yang memverifikasi posisi `Top` dan
  `Left` kedua tombol, bukan cuma bentuk kodenya. 89 test lulus.
  APK 1.0.24 aktif di server.
- **mobile** — **tombol "Mulai di PC" di bar aksi Voucher/Member** + sheet
  pemilihan PC + perataan baris info Profile + perbaikan pesan login salah
  password + hapus teks petunjuk di halaman login. 13 test baru, 80 test
  lulus, `analyze` bersih. APK 1.0.22 aktif di server. Detail panjang: bagian
  "Cara upload APK dari aplikasi".
- **backend** — **dua bug yang menjatuhkan seluruh server**, ditemukan tidak
  sengaja waktu menguji notifikasi FCM. `startSessionTick()` punya callback
  `async` tanpa `try/catch`, jadi `P2025` dari `session.update()` menjadi
  unhandled rejection dan proses Node mati; `broadcastPcUpdate()` juga dipanggil
  tanpa `await` dari beberapa tempat sehingga penolakan di sana ikut bisa
  menjatuhkan proses. Ketiga `setInterval` sekarang dijaga, dan `P2025`
  dikenali sebagai kondisi wajar. ⚠️ Ini **bukan** bug dari fitur notifikasi —
  bom waktunya sudah tertanam sejak awal, hanya pemicunya yang baru.
- **mobile** + **backend** — **notifikasi push FCM saat pelanggan login di
  komputer warnet**. `com.google.gms.google-services` 4.5.0 + `firebase_core` +
  `firebase_messaging`; model `Perangkat` + migration ke-5; `FcmService` HTTP v1
  tanpa `firebase-admin`; `POST`/`DELETE /api/notifikasi/token`; channel
  notifikasi importance tinggi; sakelar di Profile; `GOOGLE_SERVICES_JSON_BASE64`
  jadi secret CI. 8 test baru, 65 test lulus, `analyze` bersih. APK 1.0.20 aktif
  di server. ✅ **TERBUKTI DI HP SUNGGUHAN**: notifikasi tiba dengan suara saat
  aplikasi ditutup. Detail panjang: bagian "Notifikasi push FCM".
- **mobile** — **perataan baris info di Profile** (kartu Server / Versi aplikasi /
  Status) + **kartu pembaruan dihapus dari Profile**. 4 test baru di
  `test/profile_page_test.dart` (3 perataan di 390/360/320 px + 1 ketiadaan kartu
  pembaruan), dua-duanya sudah dibuktikan menangkap bugnya. 54 test lulus,
  `analyze` bersih. Detail: bagian "Perataan baris info di halaman Profile".
  Commit sebelumnya:
- **mobile** `6f23b3c` — **perbaikan input dari pemakaian nyata** (versi 1.0.17):
  tombol Voucher/Member tidak lagi turun baris di 390 px, kolom nominal tidak
  lagi terisi 10000, nama dibatasi 40 karakter di level input, nominal
  diformat ribuan di semua form. 14 test baru. Commit sebelumnya: `3035793`
  (pisah ruang nomor versi CI dan lokal), `8f9e514` (**pembaruan diri aplikasi**:
  CI memberi nomor versi dari `github.run_number` + step verifikasi `versionCode`;
  backend baca dari dalam APK; `GET /api/settings/apk/info`; Kotlin installer
  sendiri ~170 baris; `UpdateProvider` + kartu Home (versi ringkas) + titik merah
  di tab Profile). Detail panjang: bagian "Pembaruan diri aplikasi Android".
- **frontend** `c312175` —
- **backend** `5fde92d` — `ApkMeta` menambah `versionCode`/`versionName`/`sha256`
  yang dibaca dari berkas saat upload, `GET /api/settings/apk/info`. Dependensi
  baru `app-info-parser` + deklarasi tipe manual.
- **frontend** — sesi web terkunci otomatis: `sessionStorage` (logout saat browser ditutup)
  + `useIdleLogout` 5 menit + pesan general "Sesi berakhir. Silakan login kembali."
  (`src/hooks/useIdleLogout.ts`, `AuthContext`, `Layout`, `LoginPage`, `lib/api.ts`).
  Verifikasi 8 tes Playwright di domain produksi. Card "Aplikasi Android" kini
  menampilkan "Versi 1.0.17 (build 17)". Sebelumnya `7453c8f` (dokumentasi),
  `1f7cd40` (loader dashboard), `8726294` — form buat member tanpa kolom password.
- **backend** `a695c77` — `client:create_password` **mewajibkan + memverifikasi `passwordLama`**,
  dan `createVoucherAndStart()` (jalur buat voucher dari kartu PC di dashboard) ikut `PASSWORD_DEFAULT`
  — sebelumnya masih `Math.floor(1000 + Math.random()*9000)`, jadi itu satu-satunya jalur pembuatan
  akun yang masih menghasilkan password acak. `7e41e1d` sebelumnya: password akun baru `0000` +
  hapus field password dari `CreateMemberDto`. `bd6c900`: `Pc.status` di DB tidak pernah `OFFLINE`.
  `308cd02`: endpoint APK.
- **agent** `f7de14e` — dialog ganti password jadi **Window terpisah**
  (`BuatPasswordDialogWindow.xaml`) karena memperbesar window overlay tidak
  berhasil: `UpdateWindowState()` memaksa ukuran `340x268` lagi setiap
  `StateUpdate` dari service. Dialog ditutup otomatis saat sesi berakhir, dan
  3 resource (`FieldInsetBrush`, `FieldCaptionStyle`, `PillPasswordTemplate`)
  dipindah ke `App.xaml`. Sebelumnya `908c1c8` — perbaikan kedua dialog ganti
  password: saat sesi berjalan overlay hanya
  340x268, sedangkan dialog 380x373, jadi field ulangan + tombol terpotong di tepi bawah dan
  pengguna **terkunci** (tidak bisa ditutup/diminimalkan). Window dibesar sementara selama dialog
  terbuka; dialog dapat tombol tutup + `Key.Escape`. Sebelumnya `39c6504` — dialognya tersembunyi
  di dalam `ContentPanel` yang di-collapse saat sesi berjalan, jadi tombolnya terlihat "tidak
  bereaksi"; dipindah jadi anak langsung `RootGrid` dan diletakkan paling akhir.
  Sebelumnya `a1e5211` — tombol **Ganti Password** dipindah dari layar login ke **mini window**
  (hanya saat sesi berjalan), dialog jadi 3 isian + verifikasi password lama di server, dan
  PC ID dihapus dari mini window. Di-chain: `29f8dec`/`b64beda`/`49fc6a9`/`0344aec` (logo,
  ikon MSI, perbaikan build MSI, fitur awal). CI sukses, artifact `v3NetbillAgentSetup`
  64,8 MB (run `36369623986`).
- **mobile** `c71f250` — aksi **Ganti Password** untuk voucher & member di baris aksi
  (tepat satu akun terpilih), memakai `PATCH /accounts/:id/password` yang sudah ada.
- **mobile** `c71f250` — aksi Ganti Password untuk voucher & member. `b169f92` sebelumnya:
  form buat member tanpa kolom password. Sebelumnya `0615ef4`
  (heartbeat jadi warna icon PC yang sudah ada), `9c8de73` (**perbaikan bug daftar
  voucher/member kosong** karena `initializeDateFormatting` tidak pernah dipanggil),
  `36c382d` (buat voucher/member dari dialog Mulai Sesi), `e910090` + `ff366d8` (build
  universal di CI, `API_WS_URL` dikoreksi ke `/session`). APK aktif di server:
  `v3netbill-1790526912990.apk`, 53.955.947 byte, universal, release-signed `CN=v3Netbill`,
  dari artifact run `36333233467`.
- Repo mobile **dipindahkan** dari `/home/warnet/mobile/v3netbill-mobile` ke
  `/home/warnet/docker/v3netbill/v3netbill-mobile` supaya semua dalam satu folder project.
  Rename atomik (satu filesystem, `/dev/sda3`), 2968 file, checksum sebelum-sesudah sama,
  tidak ada path absolut di dalam repo. Build release dari path baru menghasilkan APK
  **53.955.947 byte** — ukuran identik dengan artifact CI, dan tetap release-signed.


### Temuan audit keamanan (26 Sep, sudah di-scan ke repo public)

**Tidak ada credential asli terekspos** — `.env.example` pakai `<password>`,
`docker-compose.yml` pakai `${JWT_SECRET}`.

⚠️ **Fallback JWT hardcoded ada di 3 file (bukan 1 seperti catatan lama):**
- `backend/src/auth/auth.module.ts:14`
- `backend/src/auth/jwt.strategy.ts:13`
- `backend/src/session/session.module.ts:13`

Ketiganya `process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'`.
Karena repo backend public, string ini **terbaca publik**. Kalau `JWT_SECRET` di `.env` kosong,
JWT bisa dipalsukan siapa saja yang bisa internet → login sebagai admin. Fix: throw saat
startup kalau env kosong (bukan fallback string). **Prioritas tinggi.**

⚠️ **Peta infrastruktur juga publik** (di `docs/DEPLOYMENT.md` + `docs/DETEKSI-IP.md`):
IP LAN host, port `3000` terbuka langsung di LAN, nama container `postgres-15`, topologi
Cloudflare Tunnel. Tidak berbahaya pada jaringan privat, tapi sangat berguna
untuk attacker yang menyisir.

⚠️ **IP LAN host per 3 Okt 2026 = `192.168.1.59`** (interface `enp2s0`). Semula
`192.168.1.65` — nilai itu sudah muncul di beberapa dokumen tapi **salah**, dan
`docs/DEPLOYMENT.md:45` masih memuatnya. Kalau IP berganti lagi (DHCP), tiga
dokumen itu harus diperbarui bersama: `AGENTS.md`, `docs/DEPLOYMENT.md`,
`docs/DETEKSI-IP.md`, plus `v3NetbillAgent/HANDOFF.md`. Cara memastikan cepat:
`hostname -I | cut -d' ' -f1`.

### Pending (per 28 Sep, sesi terakhir)

- ~~**Frontend jadi .apk Android**~~ — **SELESAI 27 Sep**, tapi bukan lewat Capacitor.
  Yang dipakai adalah aplikasi Flutter native penuh (repo `v3netbill-mobile`), hasilnya
  dikirim lewat Settings web. Lihat bagian "FASE 8".
- ~~**Rapi halaman Pengaturan**~~ — **SELESAI** (`97082bd`): tab per kelompok + kartu kecil per
  fitur, `SettingsPage.tsx` 897 → 151 baris, sudah dicek di 1440px dan 390px.
  Halaman Informasi Produk & Security Report dihapus sekalian.
- ~~**Upload MSI baru ke `/data/installer/`**~~ — **SELESAI**, diunggah manual dari artifact
  run `36362214580` (64,8 MB, hash domain = GitHub identik). ⚠️ Upload otomatis di CI masih
  **tidak jalan** karena secret `V3NETBILL_ADMIN_USER`/`PASSWORD`/`BACKEND_URL` belum diisi,
  dan step itu keluar OK padahal melewati. Detail + cara isi: bagian "Build MSI & WiX".
- **Hapus fallback JWT** (lihat di atas) — belum dikerjakan. Masih prioritas tinggi.
- **Tampilan log aktivitas di HP** — kolom Detail terpotong di layar sempit sempit.
  **Pola yang sudah berhasil dipakai** di tab Data Pengaturan: di bawah `sm` tabel
  diganti jadi kartu bertumpuk (`sm:hidden` + `hidden sm:block`). Tabel yang
  `min-w-max` membuat kolom terakhir terdorong keluar layar tanpa petunjuk
  bisa digeser. Terapkan pola yang sama di log aktivitas.
- **Status voucher sisa 0** — 3 voucher `ACTIVE` dengan sisa 0 ditampilkan dengan
  label "Habis" (perkampilan tampilan saja). Kalau user mau statusnya benar-benar
  jadi `TERPAKAI`, itu **perubahan logika bisnis di backend** + enum, bukan
  front-end. Belum dikerjakan.
- **Pindah repo ke private / Gitea** — deferred oleh user. Kalau jadi dilakukan, jangan
  lupa set ulang 4 secret keystore APK.
- **Simpan bundel 28 Sep di luar mesin ini** — `/home/warnet/bundle_project/` (89,4 MB)
  berisi dump DB yang memuat **token bot Telegram yang aktif** plus hash PIN. Sudah
  dikirim 2 PDF ke Telegram, tapi zip lengkapnya masih di disk server. Kalau mesin ini
  hilang, **cabik token lewat @BotFather** lalu isi ulang di Pengaturan, dan ganti kedua PIN.
- ~~**Rapi `/data/apk/`**~~ — **SELESAI 29 Sep**: 8 APK lama (460 MB) + 10 installer lama
  (560 MB) dihapus manual, total hemat ~906 MB. ⚠️ Penyebabnya **belum diperbaiki di backend**:
  tiap upload hanya menambah berkas, jadi masih akan menumpuk.
  Pembersihan manual: **baca nama aktif dari Setting `apk_meta`**, lalu `rm` berkas lain —
  jangan hardcode. Berkas di `/data/apk/` **root-owned** (dibuat container sebagai root),
  jadi `rm` dari host biasa gagal `Permission denied`; harus lewat
  `docker exec v3netbill-backend rm -f /data/apk/<nama>`.
- ~~**Uji pembaruan diri di HP sungguhan**~~ — **SELESAI 30 Sep**: dua kali
  berturut-turut (15→16 lalu 16→17) lewat tombol di dalam aplikasi, keduanya
  berhasil. Tidak ada yang tersisa di sini.
- ~~**Duplikasi nomor versi lokal vs CI**~~ — **SELESAI 30 Sep**: CI sekarang
  memakai `1000 + run_number` (run 14 → 1014), build lokal tetap di bawah 1000.
  Detail di bagian "Pembaruan diri aplikasi Android".
- **Upload otomatis dari CI untuk APK** — masih manual. Tidak ada step upload di
  `build-apk.yml` (yang ada di workflow agent, tapi secret-nya belum diisi).
- **Hapus fallback JWT** (lihat di atas) — belum dikerjakan. Masih prioritas tinggi.
- **Skrip uji koneksi Windows (.bat)** — belum dikerjakan, masih diskusi. Yang sudah teruji dari
  Linux: `dotnet build` + 8 uji alur password lewat socket.io. Yang **belum** pernah tersentuh:
  named pipe service↔overlay, benar-benar bertayinya Tampilan XAML di layar, apakah `.exe` jalan,
  dan benar/tidaknya `ServerUrl`+`agentToken` di registry. Empat hal terakhir itu yang paling
  sering jadi penyebab "agent tidak jalan", dan hanya bisa dicek di PC Windows asli — kedua
  project agent menyasar `net8.0-windows` jadi tidak bisa dijalankan di Linux.
- **Isi secret upload CI agent** — `V3NETBILL_BACKEND_URL`, `V3NETBILL_ADMIN_USER`,
  `V3NETBILL_ADMIN_PASSWORD` di repo `v3netbill-agent`. Tanpa itu, MSI tidak pernah naik
  ke server padahal log hijau.
- **`/home/warnet/mobile/`** — sekarang kosong setelah repo mobile dipindah ke dalam
  `/home/warnet/docker/v3netbill/`. Boleh dihapus kalau mau.
- **`/tmp/opencode/pw`** — sisa `node_modules` playwright-core (8.6 MB, owner `root`,
  hasil `npm i` di dalam container). Perlu `sudo rm -rf` manual. Tidak ada kredensial
  di dalamnya, hilang sendiri saat reboot.


---

## DEPLOYMENT — bagaimana situs benar-benar disajikan

⚠️ **Bagian ini tidak ada di versi lama dan sering disalahpahami. Baca sebelum
menaruh file apa pun.**

Rantai: `https://v3netbill.bilmary.my.id` → `cloudflared` (host) → **`localhost:3000`**
→ **container `v3netbill-backend`** (BUKAN frontend di 5173).

- `backend/src/app.module.ts:23` — `ServeStaticModule.forRoot({ rootPath: join(process.cwd(),
  'frontend-dist'), exclude: ['/api/{*splat}', '/session/{*splat}', '/socket.io/{*splat}'] })`.
  Jadi backend menyajikan **bundle frontend yang sudah di-build**.
- Bundle itu di-build di tahap pertama `backend/Dockerfile` (`COPY frontend/ ./` +
  `npm run build`) lalu di-copy ke `/app/frontend-dist` pada tahap kedua — **tapi hasil
  build itu praktis tidak pernah terpakai**, karena `/app/frontend-dist` di-timpa bind
  mount (lihat kotak peringatan di bawah).
- ⚠️ **Cara deploy frontend yang benar: build lewat container frontend, BUKAN build image
  backend.** `docker compose up -d --build v3netbill-backend` **tidak** memperbarui
  bundle yang disajikan domain, karena `./frontend/dist` di-bind mount ke
  `/app/frontend-dist`. Yang benar:
  ```bash
  docker compose exec v3netbill-frontend npm run build
  ```
  Bundle langsung tersimpan ke `frontend/dist` di host, jadi **tidak perlu restart
  backend**. Verified 30 Sep: habis `up -d --build` domain masih menyajikan bundle lama
  (`localStorage` token), setelah `npm run build` lewat container frontend langsung
  bundle baru aktif tanpa restart.

### ⚠️ `frontend/dist` adalah bind mount di KEDUA container

```
backend  : ./frontend/dist -> /app/frontend-dist
frontend : ./frontend      -> /app          (jadi /app/dist = frontend/dist)
```

Konsekuensi penting:

1. **File apa pun yang ditaruh di `frontend/dist` langsung bisa diakses publik tanpa
   autentikasi** di `https://v3netbill.bilmary.my.id/<namafile>`. Hanya `/api`,
   `/session`, `/socket.io` yang dikecualikan. Ini sempat dipakai untuk menyajikan
   screenshot mockup berisi data produksi (IP server, kode voucher, riwayat sesi) —
   **berbahaya**, sudah dihapus. Jangan ulangi tanpa peringatan eksplisit ke user.
2. **Build image backend tidak mengubah isi `frontend/dist`.** Build di dalam image
   memang membuat `/app/frontend-dist` baru, tapi bind mount menimpanya dengan isi
   folder di host. Sumber kebenaran tetap `docker compose exec v3netbill-frontend
   npm run build`.
3. Isi host `/app/dist` **root-owned** (dibuat saat `npm run build` di container), jadi
   user non-root tidak bisa menulis. Pakai `docker cp` ke dalam container.
4. File yang ditaruh manual **hilang** saat container di-recreate atau image di-rebuild.
   Untuk aset permanen harus lewat `frontend/public/` lalu build ulang image (tetapi
   berarti ikut masuk repo).

### ⚠️ ServeStaticModule jatuh ke SPA fallback

Path yang tidak ada **tidak** mengembalikan 404, melainkan `index.html` dengan
**HTTP 200** dan `content-type: text/html`. Jadi jangan memakai kode HTTP untuk
memeriksa apakah sebuah file publik benar-benar ada — periksa `content-type` atau
ukuran body. Contoh setelah mockup dihapus: `/moc-1.png` tetap `HTTP 200` tapi isinya
HTML 503 B, bukan PNG.

## Kunci sessionStorage frontend

 bukan `token`/`role`/`username` — kalau salah, inject token saat tes akan gagal diam-diam
dan halaman jatuh ke login:

```
v3netbill_token      (src/lib/api.ts:16)
v3netbill_role       (src/lib/api.ts:17)
v3netbill_username   (src/lib/api.ts:18)
```

⚠️ Ketiganya berada di **`sessionStorage`**, bukan `localStorage` (sejak 30 Sep).
Jadi saat inject token untuk tes, pakai `sessionStorage.setItem(...)` — kalau
`localStorage`, halaman tetap jatuh ke login karena tidak ada yang membacanya.

## Kemampuan verifikasi visual

Host ini **tidak** punya browser, tapi ada image Playwright yang sudah ter-cache:

```
mcr.microsoft.com/playwright:v1.55.0-noble
```

Chromium ada di `/ms-playwright/chromium-1187/chrome-linux/chrome`. Cara termudah
screenshot **halaman SPA** (React butuh JS, `curl` tidak cukup):

```bash
# 1. ambil token
curl -s -X POST https://v3netbill.bilmary.my.id/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
# kunci respons: access_token  (BUKAN accessToken)

# 2. inject sessionStorage + screenshot lewat playwright-core
docker run --rm --network host \
  -v /tmp/shot:/w -v /tmp/pw/node_modules:/w/node_modules:ro \
  --entrypoint node mcr.microsoft.com/playwright:v1.55.0-noble /w/cap.mjs
```

`playwright-core` perlu `npm i playwright-core@1.55.0` di dalam container (pakai Chromium
yang sudah ada lewat `executablePath`, tidak perlu download browser). Storage per origin,
jadi suntik lewat `addInitScript` **sebelum** `goto`.

⚠️ **Dua jebakan menjalankan Playwright dari container** (bikin 3 percobaan gagal
berturut-turut, 30 Sep):
- `node_modules` harus di-mount ke `/w/node_modules`, bukan `/pw`. ESM mencari paket
  relatif terhadap letak file skrip (`/w/cap.mjs`), jadi `/pw/node_modules` tidak
  ditemukan.
- Butuh `--network host` **dan** URL pakai IP LAN (`http://192.168.1.59:5173`), bukan
  `localhost`. Tanpa itu: `ERR_CONNECTION_REFUSED`. Conversely, kalau memakai nama
  service compose (`v3netbill-frontend:5173`), Vite membalas **403** karena
  `allowedHosts` tidak memuatnya.

Stub HTML di `file://` tidak bisa menulis storage untuk origin https — itu sebabnya
stub pertama gagal.

### Membuat PDF dari HTML (tanpa pdfkit, tanpa Chromium lewat Playwright)

Untuk dokumen (dokumentasi, manual), **HTML + inline SVG** lalu dicetak dengan Chromium
headless. Diagramnya jadi vektor, jadi tetap tajam ukuran berapa pun, dan Chromium sudah
ada di image Playwright — tidak perlu `npm i` apa pun:

```bash
docker run --rm -v /path/ke/docs:/w -w /w --entrypoint bash \
  mcr.microsoft.com/playwright:v1.55.0-noble -c '
  /ms-playwright/chromium-1187/chrome-linux/chrome --headless --no-sandbox \
    --disable-gpu --no-pdf-header-footer \
    --print-to-pdf=/w/nama.pdf file:///w/nama.html'
```

⚠️ Pesan "N bytes written to file" Chromium menulis ke **stderr**. Kalau pipe-nya
`2>/dev/null`, **`2>/dev/null` menyembunyikan keberhasilannya** — PDF-nya

tetap tercipta, hanya log "N bytes written" yang hilang. Verifikasi dengan
`pdfinfo nama.pdf` (boleh di host), jangan percaya log.

⚠️ Berkas yang ditulis Chromium jadi **root-owned** (container berjalan sebagai root),
jadi tidak bisa di-overwrite dari host tanpa `sudo`, dan `sudo` di host ini butuh
password. Untuk menimpa: `docker cp` dari container, atau tulis lewat `docker run -v`.

⚠️ Gambar relatif (`img/…`) **harus ikut di-mount** bersama HTML-nya.

### Cek isi PDF tanpa membuka Acrobat

```bash
pdfinfo nama.pdf              # jumlah halaman, ukuran, A4?
pdftoppm -r 70 -png nama.pdf /tmp/qa/p    # jadi PNG per halaman
```

`/usr/share/dict/american-english` + skrip Python kecil sangat berguna untuk **menangkap
kata Inggris asing** di dokumen Indonesia. Tetap tidak menangkap katasampah yang
**terlihat seperti** bahasa Inggris (`confiscated`, `acutely`), dan **tidak** menangkap
huruf-homoglyph. Untuk itu tetap perlu baca teksnya sendiri.

⚠️ Kesalahan yang berulang di sesi 28 Sep: karakter CJK (Han) muncul **sendiri** di teks
yang sedang ditulis, bahkan di file yang sama dalam satu menit. Selalu jalankan
pemindaian setelah menulis, dan **paste output-nya, jangan langsung percaya** (lihat
pelajaran no. 1 & 5).

⚠️ Fitur CSS counter menomori ulang tiap `<ol>`, jadi atribut `start="5"` **diabaikan**
dan langkah terakhir tampil sebagai "1". Perbaiki dengan kelas turunan, bukan `start`:

```css
.langkah.lanjut { counter-reset: langkah 4; }   /* jadi mulai dari 5 */
```

## Bundel serah terima (28 Sep 2026)

Artefak lengkap ada di `/home/warnet/bundle_project/v3netbill-warnet-bundle-20260928-145520.zip`
(89,4 MB, 22 berkas) + foldernya (`SHA256SUMS` 21 berkas, `README.md` sebagai pintu
masuk). Isinya: source 4 repo, dump DB 28 Sep, MSI Agent fresh (CI `36394454560`), APK
rilis (`c71f250`), plus **dokumentasi teknis** (21 hal) dan **manual pengguna** (21 hal)
dalam PDF + HTML. Sesi ini **tidak mengubah kode aplikasi** (4 repo tetap di commit
`88dac8c`/`547642b`/`d084786`/`c71f250`).

⚠️ **Jangan pernah mencetak nilai dari `GET /api/settings` ke dokumen mana pun.** Endpoint
itu mengembalikan `agent_otp_bot_token` (token bot Telegram **aktif**), `agent_otp_chat_id`,
`pin_bypass_hash`, dan `pin_uninstall_hash` dalam bentuk jelas. Semuanya ikut ter-copy ke
dump DB karena berada di tabel `Setting` — itu **wajar** untuk backup, tapi berarti bundel
memuat kredensial nyata. Untuk kirim PDF ke Telegram, **ambil token dari DB di dalam
perintah**, jangan diketik di baris perintah.

⚠️ **`docker-compose.yml` memakai jaringan eksternal `war-nt-web_default`**, yang dibuat
otomatis oleh compose PostgreSQL dan **namanya mengikuti nama folder** project itu. Kalau
folder PostgreSQL tidak persis `war-nt-web`, `docker compose up` gagal dengan
`network war-nt-web_default not found`. Root `docker-compose.yml` **tidak ada di dalam
salah satu repo** — ada di root project, jadi harus disalin eksplisit saat membuat bundel
source.


