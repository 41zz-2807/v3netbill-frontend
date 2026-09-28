# AGENTS.md — v3Netbill (Warnet Billing System)

Panduan untuk AI agent (opencode) mengerjakan project ini. Baca penuh sebelum mulai.

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

## Akses test yang sudah dibuat

- Admin: `admin` / `admin123` (Role ADMIN)
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
- **`Pc.status` di database TIDAK PERNAH berisi `OFFLINE`.** Kolom itu hanya ditulis
  `ACTIVE`/`IDLE` di `registerPc` dan saat sesi start/stop, jadi PC yang dimatikan
  akan menampilkan status lamanya selamanya. Status yang ditampilkan selalu dihitung
  ulang dari `lastHeartbeatAt` lewat `statusPcEfektif()` di `backend/src/pc/pc-status.ts`,
  dipakai bersama oleh `GET /api/pcs` (mobile) dan `getDashboardData()` (dashboard web).
  `lastHeartbeatAt: null` juga berarti OFFLINE, bukan IDLE. Ambang **30 detik** mengikuti
  `HEARTBEAT_INTERVAL_DETIK = 15` di agent (`Agent.Core/ServerConnection.cs:31`).
  `SessionService.checkPcOffline()` tiap 10 detik menulis OFFLINE ke DB lalu broadcast,
  karena `broadcastPcUpdate()` sebelumnya hanya jalan saat register/start/stop.

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
- Login JWT + AuthContext (localStorage token/role/username); interceptor 401 → redirect login.

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
  **Server URL / PC ID / Agent Token**. Default property `SERVER_URL` diisi saat build MSI
  (lihat `Installer/Product.wxs`); nilai aslinya tidak disimpan di repo.
- **WAJIB isi `ServerUrl` dengan skema lengkap** (`http://192.168.1.65:3000`), karena
  `Agent.Core/ServerConnection.cs:74` memanggil `new Uri(...)` — string tanpa skema gagal.

### Build MSI & WiX — jebakan yang sudah dilewati

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
  (anti flapping) → `1.0.8.0` heartbeatimer bug → `1.0.9.0` heartbeat self-diagnosing + tick log.
  Commit terbaru `86a4b87`. Riwayat detail: `v3NetbillAgent/HANDOFF.md`.
- Detail arsitektur & prosedur deploy: `v3NetbillAgent/README.md`.

### Redesign UI Agent Client (27 Sep) ✅ `e0c1908`

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


### Build APK & GitHub Actions

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

Frontend `39fa0f6` — link `Download APK (Android)` di card `Installer Aplikasi`
(`SettingsPage.tsx`), lewat `downloadAuth` yang menempelkan token sebagai query string.

⚠️ **Upload lewat domain dari host kadang putus di ~18 MB** (`HTTP 000`, Cloudflare).
Always upload lewat `http://localhost:3000/api/settings/apk` (53 MB lolos). Setelah upload,
verifikasi dengan download ulang + bandingkan `sha256sum` — bukan cuma cek HTTP 200.

APK aktif di server: `v3netbill-1790515676761.apk`, 53.303.412 byte, universal,
release-signed `CN=v3Netbill`, dari artifact GitHub run `36321151526`.

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
13. **Pindah lokasi repo: periksa dulu, baru `mv`.** Repo mobile dipindah dari
   `/home/warnet/mobile/` ke dalam `/home/warnet/docker/v3netbill/`. Yang diperiksa
   sebelum pindah: `df` dan `stat` untuk memastikan satu filesystem (kalau beda, `mv`
   jadi salin lalu hapus, butuh 2x ruang disk sementara), `grep -rI` path lama di dalam
   repo **dan** di luar (cron, systemd, `docker inspect`), `key.properties` (kalau
   `storeFile`-nya absolut, signing langsung rusak), lalu checksum daftar file sebelum dan
   sesudah. Hasilnya nol dependensi, kecuali dua skrip `dk` dan `fl` yang memang
   hardcode path. Verifikasi akhir: `flutter build apk --release` dari path baru menghasilkan
   APK **53.955.947 byte**, ukuran identik dengan artifact CI, dan tetap release-signed.




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

### Commit terakhir (27 Sep, sesi terakhir — semua ter-push)

- **frontend** `8726294` — form buat member tanpa kolom password (kolom dihapus, diganti
  catatan password awal 0000). Sebelumnya `01c419c`/`39fa0f6` — link `Download APK (Android)`
  di card `Installer Aplikasi` (`SettingsPage.tsx`) pakai `downloadAuth`.
- **backend** `a695c77` — `client:create_password` **mewajibkan + memverifikasi `passwordLama`**,
  dan `createVoucherAndStart()` (jalur buat voucher dari kartu PC di dashboard) ikut `PASSWORD_DEFAULT`
  — sebelumnya masih `Math.floor(1000 + Math.random()*9000)`, jadi itu satu-satunya jalur pembuatan
  akun yang masih menghasilkan password acak. `7e41e1d` sebelumnya: password akun baru `0000` +
  hapus field password dari `CreateMemberDto`. `bd6c900`: `Pc.status` di DB tidak pernah `OFFLINE`.
  `308cd02`: endpoint APK.
- **agent** `39c6504` — perbaikan: dialog ganti password tersembunyi di dalam `ContentPanel`
  yang di-collapse saat sesi berjalan, jadi tombolnya terlihat "tidak bereaksi". Dipindah jadi
  anak langsung `RootGrid` dan diletakkan paling akhir. Sebelumnya `a1e5211` — tombol **Ganti
  Password** dipindah dari layar login ke **mini window**
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

### Pending (per 27 Sep, sesi terakhir)

- ~~**Frontend jadi .apk Android**~~ — **SELESAI 27 Sep**, tapi bukan lewat Capacitor.
  Yang dipakai adalah aplikasi Flutter native penuh (repo `v3netbill-mobile`), hasilnya
  dikirim lewat Settings web. Lihat bagian "FASE 8".
- ~~**Upload MSI baru ke `/data/installer/`**~~ — **SELESAI**, diunggah manual dari artifact
  run `36362214580` (64,8 MB, hash domain = GitHub identik). ⚠️ Upload otomatis di CI masih
  **tidak jalan** karena secret `V3NETBILL_ADMIN_USER`/`PASSWORD`/`BACKEND_URL` belum diisi,
  dan step itu keluar OK padahal melewati. Detail + cara isi: bagian "Build MSI & WiX".
- **Hapus fallback JWT** (lihat di atas) — belum dikerjakan. Masih prioritas tinggi.
- **Tampilan log aktivitas di HP** — kolom Detail terpotong di layar sempit. Usulan:
  ubah tiap baris jadi kartu bertumpuk, atau pindahkan Detail ke bawah Event.
  Belum dikerjakan, menunggu keputusan user.
- **Status voucher sisa 0** — 3 voucher `ACTIVE` dengan sisa 0 ditampilkan dengan
  label "Habis" (perkampilan tampilan saja). Kalau user mau statusnya benar-benar
  jadi `TERPAKAI`, itu **perubahan logika bisnis di backend** + enum, bukan
  front-end. Belum dikerjakan.
- **Pindah repo ke private / Gitea** — deferred oleh user. Kalau jadi dilakukan, jangan
  lupa set ulang 4 secret keystore APK.
- **Rapi `/data/apk/`** — APK & MSI lama menumpuk karena tiap upload tidak menghapus yang lama.
  Aktif sekarang `v3netbill-1790563269411.apk` (53.956.267 byte) dan
  `installer-1790563268983.msi` (64.805.555 byte). Tidak mendesak, disk masih longgar.
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
  `npm run build`) lalu di-copy ke `/app/frontend-dist` pada tahap kedua.
- Dev server Vite di 5173 **tidak** dipakai langsung oleh user. Mengubah kode frontend tidak
  langsung terlihat di domain: harus `docker compose up -d --build v3netbill-backend`
  supaya bundle di-build ulang.

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
2. Isi host `/app/dist` **root-owned** (dibuat saat `docker build`), jadi user non-root
   tidak bisa menulis. Pakai `docker cp` ke dalam container.
3. File yang ditaruh manual **hilang** saat container di-recreate atau image di-rebuild.
   Untuk aset permanen harus lewat `frontend/public/` lalu build ulang image (tetapi
   berarti ikut masuk repo).

### ⚠️ ServeStaticModule jatuh ke SPA fallback

Path yang tidak ada **tidak** mengembalikan 404, melainkan `index.html` dengan
**HTTP 200** dan `content-type: text/html`. Jadi jangan memakai kode HTTP untuk
memeriksa apakah sebuah file publik benar-benar ada — periksa `content-type` atau
ukuran body. Contoh setelah mockup dihapus: `/moc-1.png` tetap `HTTP 200` tapi isinya
HTML 503 B, bukan PNG.

## Kunci localStorage frontend

 bukan `token`/`role`/`username` — kalau salah, inject token saat tes akan gagal diam-diam
dan halaman jatuh ke login:

```
v3netbill_token      (src/lib/api.ts:16)
v3netbill_role       (src/lib/api.ts:17)
v3netbill_username   (src/lib/api.ts:18)
```

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

# 2. inject localStorage + screenshot lewat playwright-core
docker run --rm -v /tmp/shot:/w -v /tmp/pw:/pw --entrypoint node \
  mcr.microsoft.com/playwright:v1.55.0-noble /w/cap.mjs
```

`playwright-core` perlu `npm i playwright-core@1.55.0` di dalam container (pakai Chromium
yang sudah ada lewat `executablePath`, tidak perlu download browser). Cookie/localStorage
per origin, jadi suntik lewat `addInitScript` **sebelum** `goto`.

Stub HTML di `file://` tidak bisa menulis localStorage untuk origin https — itu sebabnya
stub pertama gagal.


