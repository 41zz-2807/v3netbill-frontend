# Migrasi v3Netbill ke PC Baru

Status: **RENCANA** — belum diimplementasikan
Tanggal: 1 Okt 2026

## Tujuan

Memindahkan aplikasi v3Netbill dari PC lama ke PC baru dengan **hanya dua
berkas** yang dipindah: satu skrip bash dan satu dump database.

## Dua berkas

| Berkas | Ukuran | Dibuat di | Dipakai di |
|---|---|---|---|
| `setup-v3netbill.sh` | 1 skrip, 2 mode | — | PC lama **dan** PC baru |
| `v3netbill-<tanggal>.sql.gz` | **10,6 KB** | PC lama | PC baru |

Dua perintah dari satu skrip, supaya benar-benar hanya dua berkas:

```bash
./setup-v3netbill.sh dump    # di PC LAMA  -> menghasilkan .sql.gz
./setup-v3netbill.sh setup   # di PC BARU -> membangun semuanya dari nol
```

## Keputusan yang sudah diambil

- **Keempat repo ikut** di-clone: `backend`, `frontend`, `v3netbill-mobile`,
  `v3NetbillAgent`. Semuanya public, jadi clone HTTPS tanpa SSH key.
- **Clone pakai `--depth 1`.** Isi `.git` keempat repo hanya ~12 MB. Yang
  1,2 GB di mobile itu `build/` dan `.dart_tool/` lokal, tidak ikut git.
- **Port 5173 dilewati.** `docker-compose.yml` menyalakan `v3netbill-frontend`
  juga, padahal di produksi SPA disajikan backend dari `dist`. Setelah
  `frontend/dist` selesai dibangun, frontend tidak perlu jalan.
- **Tunnel tidak ikut.** Cloudflare tunnel dibuat sendiri di PC baru.

## Temuan yang membentuk rencana

**PC ini bukan khusus v3Netbill.** Satu network `war-nt-web_default` dipakai
bersama oleh 7 container dari beberapa proyek lain, dan satu PostgreSQL
melayani 8 database. Jadi migrasi ini berarti memisahkan satu proyek dari host
bersama, bukan memindahkan seluruh host.

```
yearly-book-dev · v3netbill-backend · giis-grade6-kas · v3netbill-frontend
ikannya-baba-backend · postgres-15 · tunnel-cloudflared
```

Database di `postgres-15`: `v3netbill`, `dashboard`, `yearlybook_db`, `billing`,
`grade6_db`, `Ikannya_Baba`, `Ikannya_Baba_test`.

**Yang harus ikut dan TIDAK ada di GitHub.** Root project bukan git repo:

| Yang perlu | Alasan |
|---|---|
| `docker-compose.yml` | Root project tidak ada di repo mana pun |
| `.env` | Berisi `JWT_SECRET`, `FCM_PRIVATE_KEY`, token bot, SMTP |
| `data/` (119 MB) | `installer/` 62 MB, `apk/` 53 MB, `wallpaper/` 3,4 MB |
| Dump DB | 10,6 KB |

**Kabar baik.** Agent PC dan aplikasi Android sama-sama mengarah ke
`https://v3netbill.bilmary.my.id`. Kalau nama domain tidak berubah, tidak ada
PC warnet yang perlu diinstal ulang dan tidak perlu APK baru.

## Isi dump

10 tabel, 43.505 byte polos / **10.861 byte gzip**:

```
Account · ActivityLog · DailyReport · Pc · Perangkat · Session
Setting · Transaction · User · _prisma_migrations
```

`Setting` ikut, jadi token bot Telegram dan hash PIN ikut. `Perangkat` ikut,
jadi token FCM HP kasir ikut.

Jumlah baris saat dump diambil — dipakai sebagai pembanding di phase 9:

```
Pc=1  User=3  Account=11  Transaction=12  Session=14
Setting=10  Perangkat=1  ActivityLog=75
```

⚠️ **Dump berisi kredensial nyata.** Beri izin `600` dan jangan dikirim lewat
saluran yang tidak aman.

## Tahapan `setup`

| # | Phase | Isi |
|---|---|---|
| 0 | Prasyarat | docker, compose, git, ≥2 GB kosong, port 3000 & 5432 bebas |
| 1 | Folder & config | Tulis `docker-compose.yml` + `.env`; JWT & password di-generate; 3 nilai FCM ditanyakan |
| 2 | Jaringan | `docker network create war-nt-web_default` |
| 3 | PostgreSQL | Container `postgres-15`, volume `war-nt-web_postgres_data` |
| 4 | Restore DB | `psql < dump`; **tidak** menjalankan migrate atau seed |
| 5 | Source | `git clone --depth 1` keempat repo |
| 6 | Build frontend | Build `frontend/dist` lewat container |
| 7 | Jalankan | `docker compose up -d v3netbill-backend` |
| 8 | Aset | Salin `installer/`, `apk/`, `wallpaper/`, `backup/` dari PC lama |
| 9 | Verifikasi | Login via curl + bandingkan 8 tabel dengan isi dump |

## Dua jebakan urutan yang harus dijaga

**Phase 2 — jaringan eksternal.** `docker-compose.yml` memakai
`external: true`. Di PC baru network itu tidak ada, jadi `docker compose up`
langsung gagal dengan `network war-nt-web_default not found`.

**Phase 6 — build frontend sebelum backend.** `./frontend/dist` di-bind-mount
ke `/app/frontend-dist`. Kalau backend jalan sebelum dist dibangun, Docker
membuat folder kosong dan domain menyajikan 404 **tanpa error sama sekali**.
Build lewat container frontend, **bukan** `docker compose up --build backend`,
karena hasil build di dalam image ditimpa bind mount.

## Pengaman

- Default **dry-run**; perlu `--jalankan` untuk benar-benar mengubah apa pun
- `set -euo pipefail`, dan `bash -n` diperiksa sebelum dipakai
- Port 3000/5432 sudah dipakai → berhenti dengan pesan, bukan menimpa
- DB sudah berisi tabel → tidak di-restore menimpa tanpa `--timpa`
- `war-nt-web_default` yang sudah dipakai container lain → dibiarkan, tidak disentuh
- Dump `chmod 600`
- Password DB & `JWT_SECRET` di-generate baru, bukan disalin dari PC lama
- Volume DB tidak pernah di-`down -v`

## ⚠️ Yang TIDAK ikut clone dan wajib disalin terpisah

**`v3netbill-mobile/android/app/v3netbill-release.jks`**
**`v3netbill-mobile/android/key.properties`**

Keduanya di-gitignore (`android/.gitignore:12` dan `:14`), jadi **tidak akan
pernah ada di clone**. Kehilangan keystore berarti dua hal sekaligus:

1. Tidak bisa menerbitkan update APK — semua HP kasir tersangkut di versi lama.
2. Token FCM terikat keystore rilis, jadi **notifikasi push ke HP kasir mati
   untuk semua perangkat yang sudah terdaftar**, bukan cuma perangkat baru.

Karena keempat repo tetap ikut, PC baru memang siap meneruskan rilis aplikasi
— tapi hanya kalau keystore ikut disalin.

## Yang dikerjakan manual oleh pemilik

- Cloudflare tunnel untuk `v3netbill.bilmary.my.id`
- Firewall / buka port 3000
- Login ulang di browser & HP kasir, karena `JWT_SECRET` diganti

## Angka acuan

```
Dump DB        10,6 KB gzip
data/          119 MB  (installer 62 + apk 53 + wallpaper 3,4 + backup 0,7)
Clone 4 repo   ~12 MB   (dengan --depth 1)
Docker host    29.8.1
Prisma         5.22.x  (JANGAN naik ke 7.x)
```

## Alur cutover yang disarankan

1. Siapkan skrip + ambil dump di PC lama (tidak ada yang berubah di sana)
2. Jalankan `setup` di PC baru dengan `--jalankan`
3. **Matikan** aplikasi di PC lama **setelah** PC baru lolos verifikasi phase 9
4. Arahkan tunnel ke PC baru
5. Login ulang di kasir

Kalau ternyata ada yang salah, PC lama masih utuh karena tidak ada yang
diubah di sana sampai langkah 4.