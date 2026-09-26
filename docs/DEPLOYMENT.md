# Deployment & Topologi v3Netbill

Dokumen ini menjelaskan bagaimana v3Netbill dijalankan di VPS: komponen apa saja yang hidup,
bagaimana trafik masuk, dan di mana letak jaringan masing-masing bagian.

> Untuk mekanisme deteksi IP PC (yang sangat bergantung pada topologi ini), baca
> [`DETEKSI-IP.md`](./DETEKSI-IP.md).

---

## Ringkasan Satu Paragraf

Backend & frontend berjalan sebagai container Docker Compose di satu VPS. PostgreSQL berjalan
di container terpisah yang sudah ada sebelumnya dan bergabung ke network eksternal. **Tidak ada
nginx di host** — semua domain publik melewati **Cloudflare Tunnel**, di mana `cloudflared`
berjalan sebagai proses di host dan meneruskan trafik ke port lokal. Agent Client (Windows)
menghubungi backend lewat domain tunnel (untuk PC di luar jaringan) atau IP LAN server (untuk PC
satu jaringan).

---

## Komponen

| Komponen | Bentuk | Port | Catatan |
|---|---|---|---|
| `v3netbill-backend` | Container | `3000` | NestJS API + WebSocket |
| `v3netbill-frontend` | Container | `5173` | Vite dev server (HMR) |
| `postgres-15` | Container (existing) | `5432` | PostgreSQL 15, DB `v3netbill` |
| `cloudflared` | Proses di **host** | — | Cloudflare Tunnel, config `/etc/cloudflared/config.yml` |
| `v3NetbillAgent` | MSI di PC Windows | — | Agent Client, koneksi ke backend |

---

## Alamat IP Host

Penting untuk memahami kenapa deteksi IP PC tidak sesederhana yang terlihat:

| Alamat | Interface | Peran |
|---|---|---|
| `192.168.1.65` | `enp2s0` | **IP LAN host** — dipakai PC satu jaringan & Cloudflare tunnel |
| `127.0.0.1` | `lo` | Loopback |
| `172.17.0.1` | `docker0` | Bridge default Docker |
| `172.18.0.1` | `br-2a789053939d` | Bridge network Compose v3Netbill |
| `100.65.44.23` | `tailscale0` | Tailscale (VPN) |

> Container backend berada di `172.18.0.2` (bridge Compose). PostgreSQL di `172.18.0.3`.

---

## Network

| Network | Nama Compose | Peran |
|---|---|---|
| `war-nt-web_default` | `postgres-network` (external) | Menghubungkan backend ke PostgreSQL existing |
| `v3netbill_default` | — | Jaringan internal Compose (backend ↔ frontend) |

Hostname PostgreSQL dari dalam container backend = `postgres-15`.

---

## Docker Compose

Definisi ada di `docker-compose.yml`. Ringkasan:

- **Backend** build dari `backend/Dockerfile` (node:20, `npm install`, `prisma generate`,
  `start:dev` dengan hot reload). Bind mount `./backend:/app`. Port `3000:3000`.
- **Frontend** build dari `frontend/Dockerfile`. Bind mount `./frontend:/app`. Port `5173:5173`.
- **Named volume** `v3netbill-node-modules` & `v3netbill-frontend-node-modules` — menjaga
  `node_modules` di dalam image tidak tertimpa bind mount.
- **Env** diambil dari `.env` di root (lihat `.env.example`).

> Instalasi package **hanya** lewat `docker compose exec … npm i …` di dalam container — jangan
> pernah install di host lalu menyalin.

---

## Cloudflare Tunnel

Tidak ada reverse proxy di host. `cloudflared` berjalan langsung di host:

```bash
/usr/bin/cloudflared --no-autoupdate --config /etc/cloudflared/config.yml tunnel run
```

Config saat ini (`/etc/cloudflared/config.yml`) meneruskan hostname berikut. Nilai hostname
sesungguhnya ada di file lokal itu saja dan **tidak disimpan di repo**:

| Hostname | Service lokal |
|---|---|
| `v3netbill.<domain>` | `http://localhost:3000` (backend) |
| `pg.<domain>` | `tcp://localhost:5432` (PostgreSQL) |
| `pgadmin.<domain>` | `http://localhost:5050` |
| `netbill.<domain>` | `http://localhost:8002` |
| `ssh.<domain>` | `ssh://localhost:22` |
| `docker.<domain>` | `https://localhost:9443` (Portainer, `noTLSVerify`) |

Jadi **PC001** (di luar jaringan) memakai `https://v3netbill.<domain>` untuk sinyal.

> **Konsekuensi untuk deteksi IP**: karena `cloudflared` mem-proxy koneksi, backend tidak pernah
> melihat IP asli PC001 lewat `handshake.address`. Cloudflare menaruhnya di header
> `CF-Connecting-IP`. Detail: [`DETEKSI-IP.md`](./DETEKSI-IP.md).

---

## Ports TerpPublish di Host

| Port | Untuk | Caller |
|---|---|---|
| `3000` | Backend | `cloudflared` (localhost), PC LAN, agent (via tunnel) |
| `5173` | Frontend (dev) | Browser (localhost/LAN) |
| `5432` | PostgreSQL | Dari luar via `pg.<domain>` (opsional) |
| `8000`, `8002`, `8003`, `9443`, `5050` | Service lain di host (project lain) | — |

> Port `3000` **terbuka langsung di LAN** (`192.168.1.65:3000`). PC satu jaringan boleh konek
> langsung ke sana. Tapi lihat [`DETEKSI-IP.md`](./DETEKSI-IP.md) soal konsekuensi IP-nya.

---

## Dua Skenario Koneksi Agent

| Skenario | `ServerUrl` di wizard | IP yang tercatat di `ipClient` |
|---|---|---|
| **PC di luar jaringan** (PC001) | `https://v3netbill.<domain>` | IP publik asli (dari `cf-connecting-ip`) ✅ |
| **PC satu jaringan LAN** | `http://192.168.1.65:3000` | `172.18.0.1` untuk semua PC ⚠️ (batasan `docker-proxy`) |

Nilai `ServerUrl` **wajib** memakai skema lengkap (`http://` atau `https://`).

---

## K resiliency & Update

- **Restart container** (hot reload dev):
  ```bash
  docker compose restart v3netbill-backend
  ```
  Agent yang terhubung akan reconnect otomatis dalam ~45 detik; sesi yang sedang berjalan tetap
  aman karena server adalah sumber kebenaran waktu dan ada grace period
  (`grace_period_detik`, default 180 detik).

- **Image rebuild** (setelah tambah dependency / ubah Prisma):
  ```bash
  docker compose build v3netbill-backend
  docker compose up -d --force-recreate v3netbill-backend
  ```

- **Log**:
  ```bash
  docker compose logs -f v3netbill-backend
  docker compose logs -f v3netbill-frontend
  ```

---

## Backup & Restore

Backup database otomatis tiap **01:00** (`auto-backup`), file disimpan di `/data/backup/`
(bind mount di host), retensi **30 hari**.

| Aksi | Cara |
|---|---|
| Backup manual | `POST /api/settings/backup` (dashboard → Pengaturan → Backup) |
| Lihat daftar | `GET /api/settings/backup/list` |
| Backup terakhir | `GET /api/settings/backup/last` |
| Unduh file | `GET /api/settings/backup/download` |
| Restore | `docker cp <file.sql> postgres-15:/tmp/restore.sql` lalu `psql -U billing_user -d v3netbill -f /tmp/restore.sql` di dalam container PostgreSQL |

> `pg_dump` dijalankan **tanpa** `?schema=public` (query string di-strip dari API URL) — lihat
> `settings.service.ts`.

---

## Data Persisten (Kenset)

| Path di container | Isi | Lokasi di host |
|---|---|---|
| `/data/installer/` | File installer `.exe/.msi` | bind mount `data/installer` |
| `/data/wallpaper/` | Wallpaper lockscreen | bind mount `data/wallpaper` |
| `/data/backup/` | Hasil `pg_dump` | bind mount `data/backup` |

---

## Deploy Agent ke PC Windows

Ringkas; detail lengkap di `v3netbill-agent` (repo agent).

1. Download MSI dari GitHub Actions run terbaru.
2. Jalankan MSI → isi **Server URL**, **PC ID**, **Agent Token** dari dashboard.
3. Reboot PC.
4. Overlay login fullscreen muncul; coba login voucher.

> Ganti versi agent = jalankan MSI baru (upgrade). Uninstall dilindungi PIN admin.

---

## Link Dokumentasi Lain

| Dokumen | Isi |
|---|---|
| [`DETEKSI-IP.md`](./DETEKSI-IP.md) | Mekanisme deteksi IP PC & batasan topologi |
| `../AGENTS.md` | Aturan kerja agent AI, status fase |
| `v3netbill-server` (repo backend) | Arsitektur backend, endpoint, cron |
| README.md (repo ini) | Halaman & routing frontend |
| `../CONVERSATION_LOG.md` | Log kerja kronologis |
| `v3netbill-agent` (repo agent) | Arsitektur agent, deploy |
