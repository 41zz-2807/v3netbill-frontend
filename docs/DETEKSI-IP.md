# Deteksi IP PC — Mekanisme & Batasannya

Dokumen ini menjelaskan bagaimana `Pc.ipClient` diisi otomatis, kenapa itu penting, dan —
yang lebih penting — **kenapa untuk PC di jaringan LAN nilainya belum akurat** serta apa saja
pilihan perbaikannya.

> Ditulis setelah investigasi 26 Sep 2026. Semua temuan di sini sudah diverifikasi terhadap kode
> dan kondisi server saat itu.

---

## TL;DR

- `ipClient` = **data tampilan saja**. Bukan identitas, bukan kunci unik, tidak dipakai routing,
  auth, atau lock. Identitas PC selalu `pcId` + `agentToken`.
- Didiagno otomatis dari koneksi agent, **bukan** diisi manual lagi di form PC.
- Untuk **PC di luar jaringan (lewat Cloudflare Tunnel)** → **akurat**. PC001 tercatat
  `180.178.96.34` (IP publik asli).
- Untuk **PC satu jaringan LAN dengan server** → **belum akurat**. Semua PC akan tercatat
  `172.18.0.1` (bridge Docker), tidak bisa dibedakan. **Belum ada perbaikan** — lihat §7.
- Dedusaan ini **tidak** mengganggu fungsi apa pun: agent tetap online, sesi tetap jalan, auth
  tetap aman. Hanya kolom IP di dashboard yang tidak informatif untuk kasus LAN.

---

## 1. Konteks: Kenapa Auto-Deteksi?

Awalnya `ipClient` diisi manual oleh admin saat menambah PC. Itu tidak aman terhadap DHCP: kalau
IP PC berubah (berganti subnet, DHCP lease habis, admin salah ketik), data di dashboard jadi
salah dan tidak ada yang memperbarui.

**Keputusan user: Opsi B** — form PC tidak lagi meminta IP; server ambil sendiri dari koneksi
agent yang sedang connect.

Pertanyaan aslinya: "kalau PC-nya DHCP, gimana?" Jawabannya: aman, karena server observing
koneksi socket yang benar-benar dipakai.

---

## 2. Fakta Penting: `ipClient` Bukan Identitas

Sebelum mengubah apa pun, dipastikan dulu bahwa `ipClient` aman dipakai sebagai data observasi:

| Pertanyaan | Jawaban |
|---|---|
| Dipakai lookup / routing? | **Tidak.** Routing PC selalu `pcId` + `pcSocketMap` |
| Dipakai autentikasi? | **Tidak.** Auth agent = validasi `agentToken` per `pcId` |
| Ada unique constraint? | **Tidak.** `Pc.ipClient` = `String`, bukan `@unique` |
| Dipakai fitur lain (RDP/ping/SSH)? | **Tidak ada fitur yang memakainya di v2 maupun v3** |

Artinya: mengisinya otomatis dari koneksi **tidak berisiko** menggeser identifikasi PC. Yang
mengidentifikasi PC selalu `pcId` (UUID) + `agentToken`.

---

## 3. Implementasi

### Backend

| File | Perubahan |
|---|---|
| `dto/create-pc.dto.ts` | `ipClient` opsional (`@IsOptional` + `@IsIP`) |
| `pc.service.ts` | `create()` memakai `ipClient ?? ''` — kolom tetap `NOT NULL`, **tanpa migrasi** |
| `session.gateway.ts#alamatIp()` | Ambil IP dari koneksi, bersihkan `::ffff:`, validasi `isIP()` |
| `session.gateway.ts#sumberIp()` | Log header mana yang dipakai (diagnostik) |
| `session.service.ts#registerPc(pcId, ipTerlihat?)` | **Hanya menulis ke DB kalau IP berubah** (cegah tulis berulang tiap reconnect) |

Kapan IP diisi? **Hanya saat agent register/reconnect** (`registerAgent`). Tidak setiap heartbeat.
Kalau DHCP ganti IP → agent reconnect → IP terupdate.

### Prioritas sumber IP

`alamatIp()` mencoba kandidat berurutan, ambil yang pertama yang valid (`isIP`):

1. `cf-connecting-ip` — IP asli dari Cloudflare (kasus PC di luar jaringan)
2. `x-real-ip` — beberapa reverse proxy
3. `x-forwarded-for` (entri pertama) — proxy umum
4. `handshake.address` — alamat socket langsung (koneksi LAN/lokal)

Nilai `::ffff:` (IPv6-mapped IPv4) dibersihkan sebelum validasi.

### Log

```
PC <uuid> registered with socket <id> (ip 180.178.96.34 via cf-connecting-ip)
```

Bagian `via ...` sangat berguna untuk diagnosa topologi.

### Frontend

- `PcPage.tsx` — form tambah PC **hanya minta nama**; tabel menampilkan kolom "IP (otomatis)"
  dengan `— belum connect` bila belum terisi.
- `api.ts` — `createPc(namaPc)` tanpa parameter IP.
- `InformasiProdukPage.tsx` — teks dokumentasi diperbarui.

---

## 4. Kenapa `handshake.address` Tidak Bisa Dipakai Mentah

Dua sebab, keduanya nyata di server ini.

### (a) Cloudflare Tunnel (untuk PC di luar jaringan)

PC001 **tidak** satu jaringan dengan server. Koneksinya:

```
PC001 (internet) → Cloudflare edge → cloudflared (host) → localhost:3000 → docker → container
```

Cloudflare mem-proxy koneksi. `cloudflared` di host yang membuat koneksi ke backend, jadi
`handshake.address` = IP tunnel connector (`172.18.0.1`), **bukan** IP PC001.

IP asli PC001 ada di header `CF-Connecting-IP` yang ditambahkan Cloudflare. Setelah `alamatIp()`
membaca header itu, hasilnya benar: `180.178.96.34`.

### (b) `docker-proxy` / userland proxy (untuk PC di jaringan LAN)

Port `3000:3000` dipublish dengan **userland proxy aktif** (`docker-proxy`):

```bash
docker-proxy -proto tcp -host-ip 0.0.0.0 -host-port 3000 \
  -container-ip 172.18.0.2 -container-port 3000
```

`docker-proxy` adalah proxy TCP di userspace: ia **menerima** koneksi di host, lalu membuka
**koneksi baru dari host** ke container. Akibatnya, dari sudut pandang container, sumber koneksi
selalu adalah alamat host di bridge Docker = `172.18.0.1`.

Jadi untuk PC LAN yang konek ke `http://192.168.1.65:3000`:

```
PC-LAN (192.168.1.x) → host:3000 → docker-proxy → container
                                          └── container melihat 172.18.0.1
```

**Akibatnya: semua PC di LAN akan tercatat `172.18.0.1`.** Tidak bisa dibedakan satu sama lain.

> Mekanisme ini juga menjelaskan kenapa uji lokal (dari dalam container) memberi `127.0.0.1` — itu
> konek loopback di dalam container, bukan lewat docker-proxy.

---

## 5. Hasil Verifikasi

| Skenario | Sumber IP | Nilai |
|---|---|---|
| PC001 via Cloudflare (asli) | `cf-connecting-ip` | `180.178.96.34` ✅ |
| PC uji, koneksi langsung tanpa header CF | `handshake.address` | `127.0.0.1` (via `socket`) ✅ |
| PC LAN ke `192.168.1.65:3000` | — | akan jadi `172.18.0.1` ⚠️ (belum diuji langsung, disimpulkan dari mekanisme `docker-proxy`) |

Jalur `cf-connecting-ip` dan jalur fallback keduanya sudah diuji end-to-end.

---

## 6. Dampak & Batasan (Sementara Ini)

- **Tidak ada risiko fungsional.** Auth tetap `agentToken`, sesi tetap jalan, tidak ada yang
  memakai `ipClient` untuk keputusan bisnis.
- **Sedikit risiko cosmetic spoofing**: karena port `3000` terbuka di LAN, PC lain di jaringan
  bisa mengirim header `CF-Connecting-IP` palsu. Dampanya hanya kolom tampilan.
- Untuk PC LAN, kolom IP **tidak informatif** (semua `172.18.0.1`).
- PC di luar jaringan (lewat Cloudflare) — yang merupakan kasus PC001 saat ini — **akurat**.

---

## 7. Opsi Perbaikan (Kalau Dibutuhkan — belum dikerjakan)

> **Status**: user memutuskan **berhenti dulu** di sini dan lanjut ke tahap design. Kedua opsi
> di bawah **belum diimplementasikan**. Bagian ini hanya catatan untuk sesi berikutnya.

### Opsi A — Agent mengirim IP-nya sendiri (paling andal)

Backend menerima field `ip` opsional di payload `agent:register`; agent mengirim IP adapter yang
dipakai ke server. Prioritas `alamatIp()` jadi: `ip dari agent` → `cf-connecting-ip` → `x-real-ip`
→ `x-forwarded-for` → `handshake.address`.

- **Kelebihan**: akurat untuk LAN maupun Cloudflare, tidak bergantung Docker/NAT/proxy sama
  sekali. Tidak perlu ubah infrastruktur server.
- **Kekurangan**: perlu build + deploy MSI baru ke semua PC klien.
- **Catatan**: agent sebaiknya baca `LocalEndPoint` socket yang dipakai (persis adapter yang
  terkonek), agar akurat meski PC punya WiFi + Ethernet + VPN sekaligus.

### Opsi B — Matikan userland proxy (tanpa redeploy MSI)

Set `"userland-proxy": false` di `/etc/docker/daemon.json`, sehingga Docker memakai iptables
DNAT murni dan IP sumber terjaga.

- **Kelebihan**: tidak perlu redeploy MSI ke PC klien.
- **Kekurangan**: restart Docker daemon **mematikan semua container** (termasuk PostgreSQL dan
  sesi yang sedang berjalan). Konsistensi berubah untuk semua service di host. Sebaiknya hanya
  saat jam tutup. Memengaruhi juga service lain di VPS ini (pgadmin, Portainer, dll).

### Opsi C (kombinasi)

Opsi A sebagai sumber utama + Opsi B sebagai lapisan cadangan, untuk agent versi lama yang
belum mengirim IP.

---

## 8. Kalau Ingin Ubah Sesuatu

Baca `session.gateway.ts#alamatIp()` dan `#sumberIp()` dulu. Kalau mengubah urutan prioritas,
**perbarui logika di `docs/DEPLOYMENT.md` §"Dua Skenario Koneksi Agent"** juga.

Jangan lupa: perubahan `ipClient` **tidak** butuh migrasi DB (kolom tetap `String NOT NULL`,
kosong = belum connect).
