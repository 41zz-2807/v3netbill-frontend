# v3Netbill — Frontend

Dashboard kasir/admin untuk sistem billing warnet. React 19 + TypeScript + Vite + Tailwind CSS v4.

> Semua perintah npm **wajib** dijalankan di dalam container — lihat [Cara Menjalankan](#cara-menjalankan).

---

## Deskripsi Singkat

Frontend ini adalah antarmuka web yang dipakai kasir dan admin untuk memonitor dan mengelola warnet:
dashboard real-time status PC, transaksi voucher/member, dan laporan. Berkomunikasi dengan backend
via REST (`/api`) dan WebSocket (namespace `/session`).

---

## Stack

| Komponen | Versi |
|---|---|
| React | 19 |
| TypeScript | — |
| Vite | — |
| Tailwind CSS | v4 (via `@tailwindcss/vite`) |
| axios | — |
| react-router-dom | — |
| socket.io-client | — |
| Lint | oxlint |

---

## Halaman & Routing

| Route | Halaman | Keterangan |
|---|---|---|
| `/` | `DashboardPage.tsx` | Dashboard real-time: kartu PC (Uiverse), log aktivitas |
| `/pcs` | `PcPage.tsx` | Management PC (tambah/hapus/unlock) |
| `/accounts` | `AccountsPage.tsx` | Voucher & Member (beli, topup, koreksi, void, password, revoke) |
| `/transactions` | `TransactionsPage.tsx` | Riwayat transaksi |
| `/reports` | `ReportsPage.tsx` | Laporan keuangan, pemakaian PC, voucher & member |
| `/settings` | `SettingsPage.tsx` | Pengaturan (ADMIN only) |
| `/info-produk` | `InformasiProdukPage.tsx` | Dokumentasi produk (usage & API) |
| `/security-report` | `SecurityReportPage.tsx` | Laporan audit keamanan |
| — | `LoginPage.tsx` | Login (di luar layout, tanpa nav) |

> Rute `/settings` hanya untuk **ADMIN** — non-admin di-redirect ke login/dashboard.

Sidebar/nav (`src/components/Layout.tsx`): Dashboard, PC Management, Voucher & Member, Transaksi,
Laporan, + **Pengaturan** (khusus ADMIN).

---

## Arsitektur

### Autentikasi
- `src/context/AuthContext.tsx` — simpan `token`, `role`, `username` di `localStorage`.
- `src/lib/api.ts` — axios instance dengan `baseURL: '/api'`.
  - Request interceptor: sisipkan `Authorization: Bearer <token>`.
  - Response interceptor: `401` → hapus session & redirect ke halaman login.

### REST
Semua panggilan lewat instance `api` di `src/lib/api.ts` (baseURL relatif `/api`, saat development
melewati Vite proxy ke backend). Tipe data berada di `src/lib/types.ts`.

### WebSocket (dashboard real-time)
`DashboardPage.tsx` konek ke `window.location.origin` + `/session` (port sama, via Vite proxy
`/socket.io` dengan `ws: true`) — **bukan** langsung ke `:3000`.

Event yang dipakai di frontend:
- Kirim: `dashboard:subscribe`, `dashboard:start_pc`, `dashboard:start_voucher`, `dashboard:lock_pc`,
  `dashboard:shutdown_pc`
- Terima: `dashboard:pc_update` (array `pcs`), `dashboard:log`, `session:*` (tak dipakai langsung di
  dashboard)

> **Kalau dashboard stuck di "Menghubungkan…"**, periksa proxy `/socket.io` di `vite.config.ts`
> lebih dulu. Lihat bagian [Proxy Vite](#proxy-vite).

### Format durasi
`formatDuration()` di `src/lib/api.ts` mengubah detik → `HH:MM:SS` untuk countdown sesi.

---

## Proxy Vite

`vite.config.ts`:

```ts
server: {
  host: '0.0.0.0',
  port: 5173,
  allowedHosts: ['v3netbill.<domain>'],
  proxy: {
    '/api':       { target: 'http://v3netbill-backend:3000', changeOrigin: true },
    '/socket.io': { target: 'http://v3netbill-backend:3000', changeOrigin: true, ws: true },
  },
}
```

- `allowedHosts` berisi domain tunnel agar Vite tidak menolak request dari domain publik.
- `/api` dan `/socket.io` di-proxy ke container backend. WebSocket **harus** lewat proxy
  (`ws: true`), bukan konek langsung ke `:3000` dari browser.

---

## Konvensi CSS — Uiverse

Tema antarmuka memakai gaya "Uiverse".

- Aktif lewat atribut di `index.html`:
  ```html
  <html lang="id" data-ui-buttons="uiverse">
  ```
- Style global ada di `src/index.css`.
- **Gotcha**: tombol global Uiverse (selector `html[data-ui-buttons="uiverse"] button`) menimpa
  gradien tombol di dalam kartu. Karena itu selector global **harus mengecualikan** kelas khusus
  kartu, contoh:
  ```css
  html[data-ui-buttons="uiverse"] button:not(.uui-card__act) { ... }
  ```
  (varian normal, `:hover`, dan `:disabled` juga dikecualikan).
- Kartu PC memakai class ter-namespase `.uui-card` (lihat `DashboardPage.tsx` + `index.css`).

### Rollback tema tombol
Hapus atribut `data-ui-buttons="uiverse"` dari `index.html` + blok CSS terkait di `index.css`.

---

## Cara Menjalankan

Semua perintah lewat Docker Compose dari root project — jangan jalankan npm/npx di host.

```bash
# build
docker compose exec -T v3netbill-frontend npm run build

# lint
docker compose exec -T v3netbill-frontend npm run lint

# log
docker compose logs -f v3netbill-frontend
```

Akses (dev): http://localhost:5173 — Vite HMR aktif.

---

## Catatan

- `frontend` adalah service terpisah di `docker-compose.yml` (port 5173) dengan named volume
  `node_modules` sendiri agar tidak tertimpa bind mount.
- Lint saat ini melaporkan **12 warning, 0 error** — warning tersebut sudah ada sejak awal
  (terkait `exhaustive-deps` di `DashboardPage.tsx`) dan bukan hal baru.

---

## Link Dokumentasi Lain

| Dokumen | Isi |
|---|---|
| `../AGENTS.md` | Aturan kerja agent AI, status fase |
| `../backend/README.md` | Arsitektur backend, endpoint, WS event, cron |
| `../CONVERSATION_LOG.md` | Log kerja kronologis |
| `../docs/DEPLOYMENT.md` | Topologi & deploy |
| `../docs/DETEKSI-IP.md` | Mekanisme deteksi IP PC |
