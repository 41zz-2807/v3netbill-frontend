import React, { useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { DashboardPc, Account } from '../lib/types.ts'
import { formatDuration, formatWaktu, formatRupiah, getToken, getRole, fetchAccounts, topup, koreksi, createVoucher, createMember } from '../lib/api.ts'
import { StatusBadge, Modal } from '../components/ui'

const WS_URL = window.location.origin

/** Nominal cepat yang dipakai sebagai tombol, supaya kasir tidak perlu ketik. */
const NOMINAL_TOPUP_CEPAT = [1000, 2000, 3000, 4000, 5000]

export default function DashboardPage() {
  const [pcs, setPcs] = useState<DashboardPc[]>([])
  /** Waktu saat payload `dashboard:pc_update` terakhir diterima. */
  const [payloadMs, setPayloadMs] = useState(() => Date.now())
  /** Jam lokal, satu tick per detik untuk seluruh halaman. */
  const [sekarangMs, setSekarangMs] = useState(() => Date.now())
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [startPc, setStartPc] = useState<DashboardPc | null>(null)
  const [kodeStart, setKodeStart] = useState('')
  const [startMode, setStartMode] = useState<'kode' | 'baru'>('kode')
  const [nominal, setNominal] = useState(0)
  const [startBusy, setStartBusy] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [createdVoucher, setCreatedVoucher] = useState<{ kodeUnik: string; password: string; nominal: number } | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const role = getRole()

  // ---- Panel Input Cepat (voucher / member) ----
  // ⚠️ Backend `GET /accounts` HANYA bisa filter `tipe` & `status` (lihat
  // `AccountsQueryDto`) — tidak ada parameter pencarian teks. Jadi daftar akun
  // diambil sekali lalu dicocokkan di browser. Konsekuensinya: panel ini tidak
  // bisa mencari di tengah database yang sangat besar, dan "kode" harus
  // dicocokkan tolerant-huruf (voucher & nama bisa mengandung huruf/spasi).
  const [qakun, setQakun] = useState<Account | null>(null)
  const [qcari, setQcari] = useState('')
  const [qaksi, setQaksi] = useState<'topup' | 'tarik' | null>(null)
  const [qnominal, setQnominal] = useState(0)
  const [qnominalLain, setQnominalLain] = useState('')
  const [qbusy, setQbusy] = useState(false)
  const [qerror, setQerror] = useState<string | null>(null)
  const [qkonfirmasi, setQkonfirmasi] = useState<{ jenis: 'topup' | 'tarik'; nominal: number } | null>(null)
  const qinputRef = useRef<HTMLInputElement | null>(null)
  /** Daftar akun ACTIVE, diambil sekali lalu difilter di browser. */
  const [daftarAkun, setDaftarAkun] = useState<Account[]>([])

  // ---- Topup cepat dari baris PC yang sedang tersesi ----
  //
  // ⚠️ Berbeda dengan panel Input Cepat, di sini akun TIDAK dicari lewat kode:
  // PC yang sedang tersesi sudah tahu akunnya (`pc.session.accountId`), jadi
  // kasir cukup satu klik tanpa mengetik apa pun.
  const [topupPc, setTopupPc] = useState<DashboardPc | null>(null)
  const [topupNominal, setTopupNominal] = useState(0)
  const [topupLain, setTopupLain] = useState('')
  const [topupBusy, setTopupBusy] = useState(false)
  const [topupError, setTopupError] = useState<string | null>(null)

  // ---- Buat Voucher / Member baru ----
  //
  // ⚠️ Password semua akun baru adalah `0000` (`PASSWORD_DEFAULT` di backend),
  // jadi tidak perluinput password. Yang WAJIB ditampilkan setelah pembuatan
  // adalah kredensial login: kode voucher, atau NAMA member — nama itu adalah
  // cara member masuk ke komputer, jadi kalau tidak dicatat kasir, akunnya
  // tidak bisa dipakai.
  const [buatModal, setBuatModal] = useState(false)
  const [buatTipe, setBuatTipe] = useState<'voucher' | 'member'>('voucher')
  const [buatNama, setBuatNama] = useState('')
  const [buatNominal, setBuatNominal] = useState(0)
  const [buatLain, setBuatLain] = useState('')
  const [buatBusy, setBuatBusy] = useState(false)
  const [buatError, setBuatError] = useState<string | null>(null)
  const [buatHasil, setBuatHasil] = useState<{
    tipe: 'voucher' | 'member'
    kodeUnik: string | null
    nama: string | null
    password: string
    sisaWaktuDetik: number
  } | null>(null)

  function bukaBuat(tipe: 'voucher' | 'member') {
    setBuatTipe(tipe)
    setBuatModal(true)
    setBuatNama('')
    setBuatNominal(0)
    setBuatLain('')
    setBuatError(null)
    setBuatHasil(null)
  }

  function tutupBuat() {
    setBuatModal(false)
    setBuatHasil(null)
    setBuatError(null)
  }

  function pilihBuatNominal(n: number) {
    setBuatNominal(n)
    setBuatLain('')
    setBuatError(null)
  }

  function pilihBuatLain() {
    const n = bacaNominalTopup(buatLain)
    if (n === null) {
      setBuatError('Nominal harus kelipatan 500 dan minimal 500')
      return
    }
    setBuatNominal(n)
    setBuatError(null)
  }

  async function kirimBuat() {
    if (buatNominal <= 0) {
      setBuatError('Pilih nominal dulu')
      return
    }
    const nama = buatNama.trim()

    // ⚠️ Nama member adalah kredensial login-nya (`session.service.ts`
    // mencocokkan `nama`), jadi nama 1-3 karakter terlalu mudah ditebak orang
    // lain. Dicek di sini agar operator dapat pesan langsung berbahasa Indonesia,
    // bukan pesan validate bawaan yang mengikuti setelan browser.
    if (buatTipe === 'member') {
      if (nama.length === 0) {
        setBuatError('Nama member belum diisi')
        return
      }
      if (nama.length < 4) {
        setBuatError(`Nama member harus minimal 4 karakter (baru ${nama.length})`)
        return
      }
      if (nama.length > 40) {
        setBuatError('Nama member maksimal 40 karakter')
        return
      }
    }

    setBuatBusy(true)
    setBuatError(null)
    try {
      if (buatTipe === 'voucher') {
        const dibuat = await createVoucher(buatNominal)
        setBuatHasil({
          tipe: 'voucher',
          kodeUnik: dibuat.kodeUnik,
          nama: null,
          password: dibuat.password,
          sisaWaktuDetik: dibuat.sisaWaktuDetik,
        })
        setBuatNominal(0)
      } else {
        const dibuat = await createMember(nama, buatNominal)
        setBuatHasil({
          tipe: 'member',
          kodeUnik: dibuat.kodeUnik,
          nama: dibuat.nama,
          password: '0000',
          sisaWaktuDetik: dibuat.sisaWaktuDetik,
        })
        setBuatNama('')
        setBuatNominal(0)
        // Muat ulang daftar supaya suggestion di panel Input Cepat ikut
        // memuat akun yang baru dibuat.
        void muatDaftarAkun()
      }
    } catch (err) {
      setBuatError(pesanError(err, `Gagal membuat ${buatTipe === 'voucher' ? 'voucher' : 'member'}`))
    } finally {
      setBuatBusy(false)
    }
  }

  async function muatDaftarAkun() {
    try {
      setDaftarAkun(await fetchAccounts(undefined, 'ACTIVE'))
    } catch {
      /* diamkan: gagal memuat daftar tidak boleh menghalangi dashboard */
    }
  }

  function bukaTopupPc(pc: DashboardPc) {
    setTopupPc(pc)
    setTopupNominal(0)
    setTopupLain('')
    setTopupError(null)
  }

  function pilihTopupPc(n: number) {
    setTopupNominal(n)
    setTopupLain('')
    setTopupError(null)
  }

  function pilihTopupPcLain() {
    const n = bacaNominalTopup(topupLain)
    if (n === null) {
      setTopupError('Nominal harus kelipatan 500 dan minimal 500')
      return
    }
    setTopupNominal(n)
    setTopupError(null)
  }

  async function kirimTopupPc() {
    const pc = topupPc
    // ⚠️ `accountId` hanya ada kalau sesi benar-benar berjalan. PC yang sedang
    // dipakai teknisi TIDAK punya baris Session, jadi tombolnya tidak muncul
    // untuk mereka — tapi penjaga ini tetap wajib supaya request tanpa akun
    // tidak pernah terkirim.
    const accountId = pc?.session?.accountId
    if (!pc || !accountId || topupNominal <= 0) return

    setTopupBusy(true)
    setTopupError(null)
    try {
      const setelah = await topup(accountId, topupNominal)
      // Sisa waktu sesi yang sedang berjalan ikut bertambah — server membaca
      // ulang saldo akun tiap detik, jadi angka di baris PC ini berubah sendiri
      // pada broadcast berikutnya tanpa perlu kita sentuh.
      setTopupPc(null)
      setTopupNominal(0)
      setTopupLain('')
      const namaAkun = setelah.kodeUnik ?? setelah.nama ?? 'akun'
      setActionResult(
        `Topup ${formatRupiah(topupNominal)} untuk ${namaAkun} (${pc.namaPc}) berhasil. Saldo: ${formatDuration(setelah.sisaWaktuDetik)}`,
      )
      window.setTimeout(() => setActionResult(null), 8000)
    } catch (err) {
      setTopupError(pesanError(err, 'Topup gagal'))
    } finally {
      setTopupBusy(false)
    }
  }

  // Fokus otomatis ke kolom pencarian saat halaman dibuka — supaya operator
  // bisa langsung mengetik tanpa klik dulu (sembilan puluh persen pemakaian).
  useEffect(() => {
    qinputRef.current?.focus()
  }, [])

  /** Ambil satu pesan dari error axios supaya operator lihat alasan sebenarnya. */
  function pesanError(err: unknown, fallback: string): string {
    const m = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
    if (Array.isArray(m)) return m[0] ?? fallback
    return m ?? fallback
  }

  /** Cocokkan teks input ke kode voucher ATAU nama member. */
  function cocokkanAkun(daftar: Account[], teks: string): Account[] {
    const q = teks.trim().toLowerCase()
    if (!q) return []
    return daftar
      .filter((a) => {
        const kode = a.kodeUnik?.toLowerCase() ?? ''
        const nama = a.nama?.toLowerCase() ?? ''
        return kode.includes(q) || nama.includes(q)
      })
      .slice(0, 6)
  }

  // Muat daftar akun sekali saat panel dibuka (bukan tiap ketikan) supaya
  // mengetik tetap ringan dan tidak membanjiri server dengan request.
  useEffect(() => {
    void muatDaftarAkun()
  }, [])

  // Saran dihitung saat render, bukan disimpan di state lalu diisi dari
  // `useEffect` — aturan react-hooks menolak `setState` sinkron di dalam efek
  // (`set-state-in-effect`), dan di sini tidak ada yang perlu effector: daftar
  // akun sudah ada di memory.
  //
  // ⚠️ Penjaga kedua wajib. `pilihAkun()` mengisi input dengan kode/nama akun
  // yang dipilih, jadi tanpa penjaga ini akun itu langsung tercocokkan lagi dan
  // dropdown-nya muncul TEPAT DI ATAS kartu "AKUN DIPILIH" — nama yang sama
  // tampil dua kali dan terbaca rusak.
  const qsuggest = useMemo(() => {
    const terpilih = qakun ? (qakun.kodeUnik ?? qakun.nama ?? '') : ''
    if (qcari.trim() === '') return []
    if (terpilih && qcari === terpilih) return []
    return cocokkanAkun(daftarAkun, qcari)
  }, [qcari, qakun, daftarAkun])

  function pilihAkun(a: Account) {
    setQakun(a)
    setQcari(a.kodeUnik ?? a.nama ?? '')
    setQerror(null)
  }

  function resetPanel() {
    setQakun(null)
    setQcari('')
    setQaksi(null)
    setQnominal(0)
    setQnominalLain('')
    setQerror(null)
  }

  // Backend menolak nominal yang bukan kelipatan 500 dan < 500; cek di sini
  // supaya tidak pernah mengirim request yang pasti ditolak (sama seperti
  // `bacaNominal()` di AccountsPage).
  function bacaNominal(input: string): number | null {
    const nilai = Number(input)
    if (input.trim() === '' || Number.isNaN(nilai) || nilai < 500 || nilai % 500 !== 0) {
      return null
    }
    return nilai
  }

  function aksiTopup() {
    if (!qakun) {
      setQerror('Masukkan kode voucher atau member terlebih dahulu')
      qinputRef.current?.focus()
      return
    }
    setQaksi('topup')
    setQerror(null)
  }

  function aksiTarik() {
    if (!qakun) {
      setQerror('Masukkan kode voucher atau member terlebih dahulu')
      qinputRef.current?.focus()
      return
    }
    setQaksi('tarik')
    setQerror(null)
  }


  function pilihNominalCepat(n: number) {
    if (qaksi !== 'topup' && qaksi !== 'tarik') return
    setQnominal(n)
    setQnominalLain('')
    setQkonfirmasi({ jenis: qaksi, nominal: n })
  }

  function pilihNominalLain() {
    if (qaksi !== 'topup' && qaksi !== 'tarik') return
    const n = bacaNominal(qnominalLain)
    if (n === null) {
      setQerror('Nominal harus kelipatan 500 dan minimal 500')
      return
    }
    setQnominal(n)
    setQkonfirmasi({ jenis: qaksi, nominal: n })
  }

  async function kirimKonfirmasi() {
    if (!qkonfirmasi || !qakun) return
    const { jenis, nominal: n } = qkonfirmasi
    setQbusy(true)
    setQerror(null)
    try {
      const setelah = jenis === 'topup' ? await topup(qakun.id, n) : await koreksi(qakun.id, n)
      setQkonfirmasi(null)
      setActionResult(
        `${jenis === 'topup' ? 'Topup' : 'Penarikan'} ${formatRupiah(n)} untuk ${setelah.kodeUnik ?? setelah.nama} berhasil. Sisa waktu: ${formatDuration(setelah.sisaWaktuDetik)}`,
      )
      window.setTimeout(() => setActionResult(null), 8000)
      resetPanel()
      setDaftarAkun((lama) => lama.map((a) => (a.id === setelah.id ? setelah : a)))
    } catch (err) {
      setQkonfirmasi(null)
      setQerror(pesanError(err, `${jenis === 'topup' ? 'Topup' : 'Penarikan'} gagal`))
    } finally {
      setQbusy(false)
    }
  }


  useEffect(() => {
    const socket = io(`${WS_URL}/session`, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: { token: getToken() },
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setConnectionError(null)
      socket.emit('dashboard:subscribe')
    })
    socket.on('disconnect', (reason) => {
      setConnected(false)
      setConnectionError(`Terputus: ${reason}`)
    })
    socket.on('connect_error', (err) => {
      setConnectionError(`Gagal koneksi: ${err.message}`)
    })

    // ⚠️ SATU interval untuk seluruh halaman, bukan satu per kartu.
    // `pcs.map()` berjalan di dalam callback, jadi `useState`/`useEffect`
    // tidak boleh dipanggil di sana (violations `rules-of-hooks`). Selain itu,
    // satu interval per kartu berarti 20 timer berjalan bersamaan untuk 20 PC.
    const jam = setInterval(() => setSekarangMs(Date.now()), 1000)

    socket.on('dashboard:pc_update', (data: { pcs: DashboardPc[]; at?: string }) => {
      setPcs(data.pcs)
      // Jangkar hitung mundur auto-matikan. Nilai `matiDalamDetik` dihitung
      // server pada saat payload dikirim, jadi untuk melanjutkan hitungannya
      // lokal kita harus tahu payload itu berumur berapa detik.
      setPayloadMs(Date.parse(data.at ?? '') || Date.now())
    })

    return () => {
      clearInterval(jam)
      socket.disconnect()
    }
  }, [])

  const bukaModalStart = (pc: DashboardPc) => {
    setStartPc(pc)
    setStartMode('kode')
    setKodeStart('')
    setNominal(0)
    setStartError(null)
    setCreatedVoucher(null)
  }

  const kirimStart = () => {
    const socket = socketRef.current
    if (!socket || !socket.connected) {
      setStartError('Koneksi realtime terputus')
      return
    }
    setStartBusy(true)
    setStartError(null)
    setCreatedVoucher(null)

    const ack = (res: { success: boolean; message?: string; voucher?: { kodeUnik: string; password: string; nominal: number } }) => {
      setStartBusy(false)
      if (res?.success) {
        if (startMode === 'baru' && res.voucher) {
          setCreatedVoucher(res.voucher)
        } else {
          setActionResult(`Sesi dimulai di ${startPc?.namaPc}`)
          setStartPc(null)
          window.setTimeout(() => setActionResult(null), 5000)
        }
      } else {
        setStartError(res?.message ?? 'Gagal start sesi')
      }
    }

    if (startMode === 'baru') {
      socket.emit('dashboard:start_voucher', { pcId: startPc?.id, nominal }, ack)
    } else {
      socket.emit('dashboard:start_pc', { pcId: startPc?.id, kode: kodeStart }, ack)
    }
  }

  const kirimPerintah = (pc: DashboardPc, aksi: 'lock' | 'shutdown') => {
    const socket = socketRef.current
    if (!socket || !socket.connected) {
      setActionResult(`PC ${pc.namaPc}: koneksi terputus`)
      return
    }
    const jenis = aksi === 'lock' ? 'kunci' : 'matikan'
    if (!window.confirm(`${jenis} PC ${pc.namaPc}?`)) return
    const event = aksi === 'lock' ? 'dashboard:lock_pc' : 'dashboard:shutdown_pc'
    socket.emit(event, { pcId: pc.id }, (res: { success: boolean; message?: string }) => {
      const msg = res?.success ? `Perintah ${jenis} terkirim ke ${pc.namaPc}` : `Gagal ${jenis} ${pc.namaPc}: ${res?.message ?? '?'}`
      setActionResult(msg)
      window.setTimeout(() => setActionResult(null), 5000)
    })
  }

  return (
    <React.Fragment>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              connected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}
            title={connectionError ?? undefined}
          >
            {connected ? 'Terkoneksi (realtime)' : connectionError ? 'Masalah koneksi' : 'Menghubungkan...'}
          </span>
        </div>

        <PanelInputCepat
          kode={qcari}
          onKode={setQcari}
          akun={qakun}
          suggest={qsuggest}
          onPilih={pilihAkun}
          aksi={qaksi}
          onTopup={aksiTopup}
          onTarik={aksiTarik}
          onBuat={bukaBuat}
          nominal={qnominal}
          onNominalCepat={pilihNominalCepat}
          nominalLain={qnominalLain}
          onNominalLain={setQnominalLain}
          onKirimNominalLain={pilihNominalLain}
          error={qerror}
          onReset={resetPanel}
          inputRef={qinputRef}
        />

        <Modal
          open={qkonfirmasi !== null}
          onClose={() => !qbusy && (setQkonfirmasi(null), resetPanel())}
          locked={qbusy}
          label="Konfirmasi"
        >
          <div className="pastel-card w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <div className="flex items-start justify-between gap-3 bg-[#e0f7fa] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-wide text-slate-500">KONFIRMASI</p>
                <p className="text-[15px] font-semibold text-slate-900">
                  {qkonfirmasi?.jenis === 'topup' ? 'Topup' : 'Penarikan'}
                </p>
              </div>
              <button
                type="button"
                className="modal-x"
                onClick={() => { setQkonfirmasi(null); resetPanel(); }}
                disabled={qbusy}
                aria-label="Tutup"
                title="Tutup"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-4 px-5 py-5">
              <p className="text-base text-slate-700">
                {qkonfirmasi?.jenis === 'topup' ? 'Tambah' : 'Tarik'}{' '}
                <span className="font-semibold text-slate-900">
                  {formatRupiah(qkonfirmasi?.nominal ?? 0)}
                </span>{' '}
                untuk akun{' '}
                <span className="font-semibold text-slate-900">
                  {qakun?.kodeUnik ?? qakun?.nama}
                </span>
                ?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setQkonfirmasi(null); resetPanel(); }}
                  disabled={qbusy}
                  className="h-14 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={kirimKonfirmasi}
                  disabled={qbusy}
                  className={`h-14 cursor-pointer rounded-xl px-4 text-base font-semibold text-white transition disabled:opacity-50 ${
                    qkonfirmasi?.jenis === 'topup'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  {qbusy ? 'Memproses...' : 'Ya, Lanjutkan'}
                </button>
              </div>
            </div>
          </div>
        </Modal>

        {/* Topup cepat untuk akun yang SEDANG dipakai sebuah PC. Berbeda dengan
            panel Input Cepat, di sini kasir tidak mengetik kode apa pun — akun
            sudah diketahui dari `session` PC tersebut. */}
        <Modal
          open={topupPc !== null}
          onClose={() => !topupBusy && setTopupPc(null)}
          locked={topupBusy}
          label="Topup akun PC"
        >
          <div className="pastel-card w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <div className="flex items-start justify-between gap-3 bg-[#e0f7fa] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-wide text-slate-500">TOPUP CEPAT</p>
                <p className="text-[15px] font-semibold text-slate-900">
                  {topupPc?.namaPc} — {topupPc?.session?.kodeUnik ?? topupPc?.session?.nama}
                </p>
              </div>
              <button
                type="button"
                className="modal-x"
                onClick={() => setTopupPc(null)}
                disabled={topupBusy}
                aria-label="Tutup"
                title="Tutup"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 px-5 py-5">
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">SISA WAKTU SEKARANG</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">
                  {formatDuration(topupPc?.session?.sisaDetik ?? 0)}
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Pilih Nominal</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {NOMINAL_TOPUP_CEPAT.map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={topupBusy}
                      onClick={() => pilihTopupPc(n)}
                      className={`qbtn h-12 cursor-pointer rounded-xl border text-base font-semibold transition disabled:opacity-50 ${
                        topupNominal === n
                          ? 'border-green-600 bg-green-600 text-white'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-green-500 hover:bg-green-50'
                      }`}
                    >
                      {formatRupiah(n)}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={topupLain}
                    onChange={(e) => setTopupLain(e.target.value.replace(/[^\d]/g, ''))}
                    inputMode="numeric"
                    disabled={topupBusy}
                    placeholder="Nominal lain"
                    aria-label="Nominal lain"
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 disabled:opacity-50 sm:flex-1"
                  />
                  <button
                    type="button"
                    onClick={pilihTopupPcLain}
                    disabled={topupBusy}
                    className="qbtn h-12 shrink-0 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Pakai
                  </button>
                </div>
              </div>

              {topupError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {topupError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTopupPc(null)}
                  disabled={topupBusy}
                  className="h-14 cursor-pointer rounded-xl border border-slate-300 bg-white text-base font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={kirimTopupPc}
                  disabled={topupBusy || topupNominal <= 0}
                  className="h-14 cursor-pointer rounded-xl bg-green-600 text-base font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  {topupBusy
                    ? 'Memproses...'
                    : topupNominal > 0
                      ? `Topup ${formatRupiah(topupNominal)}`
                      : 'Pilih Nominal'}
                </button>
              </div>
            </div>
          </div>
        </Modal>

        {/* ---- Buat Voucher / Member baru ---- */}
        <Modal open={buatModal} onClose={tutupBuat} locked={buatBusy} label="Buat akun baru">
          <div className="pastel-card w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <div className="flex items-start justify-between gap-3 bg-[#e0f7fa] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-wide text-slate-500">BUAT AKUN</p>
                <p className="text-[15px] font-semibold text-slate-900">
                  {buatHasil
                    ? buatHasil.tipe === 'voucher'
                      ? 'Voucher berhasil dibuat'
                      : 'Member berhasil dibuat'
                    : buatTipe === 'voucher'
                      ? 'Buat Voucher Baru'
                      : 'Buat Member Baru'}
                </p>
              </div>
              <button
                type="button"
                className="modal-x"
                onClick={tutupBuat}
                disabled={buatBusy}
                aria-label="Tutup"
                title="Tutup"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 px-5 py-5">
              {buatHasil ? (
                <>
                  {/* ⚠️ Layar hasil. Kredensial login WAJIB_BEGINI ditampilkan
                      lengkap dan besar: kode voucher dipakai sebagai username,
                      sedangkan NAMA member adalah cara dia login
                      (`session.service.ts` mencocokkan `nama`). Kalau ini
                      terpotong atau kecil, kasir menulis ulang di kartu dengan
                      salah dan pelanggan tidak bisa masuk. */}
                  <div>
                    <p className="text-xs font-medium text-slate-600">
                      {buatHasil.tipe === 'voucher' ? 'Kode Voucher' : 'Nama Member'}
                    </p>
                    <p className="mt-1 select-all break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-3xl font-bold tracking-[0.2em] text-slate-900">
                      {buatHasil.kodeUnik ?? buatHasil.nama}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600">Password</p>
                    <p className="mt-1 select-all rounded-md bg-slate-50 px-3 py-2 font-mono text-3xl font-bold tracking-[0.3em] text-slate-900">
                      {buatHasil.password}
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">
                    Sisa waktu {formatDuration(buatHasil.sisaWaktuDetik)}. Catat dulu di
                    kartu, baru tutup. Password bisa diganti pelanggan sendiri dari
                    komputer.
                  </p>
                  <button
                    type="button"
                    onClick={tutupBuat}
                    className="h-14 w-full cursor-pointer rounded-xl bg-[#1b233d] text-base font-semibold text-white transition hover:bg-slate-800"
                  >
                    Sudah Dicatat
                  </button>
                </>
              ) : (
                <>
                  {buatTipe === 'member' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Nama Member (cara dia login)
                      </label>
                      <input
                        value={buatNama}
                        onChange={(e) => setBuatNama(e.target.value)}
                        placeholder="Contoh: Budi Santoso"
                        autoFocus
                        maxLength={40}
                        aria-label="Nama member"
                        className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Minimal 4 karakter. Ini yang diketik pelanggan di komputer.
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-700">Pilih Nominal</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {NOMINAL_TOPUP_CEPAT.map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={buatBusy}
                          onClick={() => pilihBuatNominal(n)}
                          className={`qbtn h-12 cursor-pointer rounded-xl border text-base font-semibold transition disabled:opacity-50 ${
                            buatNominal === n
                              ? 'border-sky-700 bg-sky-700 text-white'
                              : 'border-slate-300 bg-white text-slate-800 hover:border-sky-500 hover:bg-sky-50'
                          }`}
                        >
                          {formatRupiah(n)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={buatLain}
                        onChange={(e) => setBuatLain(e.target.value.replace(/[^\d]/g, ''))}
                        inputMode="numeric"
                        disabled={buatBusy}
                        placeholder="Nominal lain"
                        aria-label="Nominal lain"
                        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 disabled:opacity-50 sm:flex-1"
                      />
                      <button
                        type="button"
                        onClick={pilihBuatLain}
                        disabled={buatBusy}
                        className="qbtn h-12 shrink-0 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Pakai
                      </button>
                    </div>
                  </div>

                  {buatError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {buatError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={kirimBuat}
                    disabled={buatBusy || buatNominal <= 0}
                    className="h-14 w-full cursor-pointer rounded-xl bg-sky-700 text-base font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50"
                  >
                    {buatBusy
                      ? 'Membuat...'
                      : buatNominal > 0
                        ? `Buat ${buatTipe === 'voucher' ? 'Voucher' : 'Member'} ${formatRupiah(buatNominal)}`
                        : 'Pilih Nominal'}
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>

        {actionResult && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
            {actionResult}
          </div>
        )}

        {/*
          ⚠️ Tabel, bukan kartu — tapi JANGAN pakai komponen `<Table>` milik app.
          Komponen itu memakai `min-w-max`, yang memaksa tabel selebar isinya di
          layar sempit; itu persis penyebab tabel Log Aktivitas melebar 688px di
          layar 292px dan kolom "PC mana" jatuh ke luar layar tanpa petunjuk bisa
          digeser. Di sini tabel WAJIB muat 390px, jadi dipakai `table-fixed`
          dengan lebar kolom dalam persen — pola yang sama seperti `PcPage.tsx`.

          Kolom IP / Mulai / Koneksi disembunyikan di bawah `lg` (lewat
          `hidden lg:table-cell` pada header DAN sel — kalau hanya selnya,
          header ikut bergeser dan kolom jadi tidak sejajar).
        */}
        <div className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Daftar PC</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs lg:text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th scope="col" className="w-[15%] px-1.5 py-2.5 font-medium lg:px-3">PC</th>
                  <th scope="col" className="w-[15%] px-1.5 py-2.5 font-medium lg:px-3">Status</th>
                  {/* ⚠️ Kolom Sisa Waktu diberi lebar ekstra karena isinya angka
                      besar — "SHUTDOWN 4:32" di 15% ikut terpotong jadi
                      "SHUTDOWN…", padahal justru bagian itu yang paling penting
                      dibaca kasir. */}
                  <th scope="col" className="w-[22%] px-1.5 py-2.5 font-medium lg:px-3">Sisa Waktu</th>
                  {/* ⚠️ Pelanggan disembunyikan di bawah `lg`. Di 390px lima kolom
                      tidak mungkin muat: tiga tombol KUNCI/TOPUP/MATI saja sudah
                      butuh 143px, sedangkan "PC001" butuh 37px tapi hanya mendapat
                      31px — hasilnya semua kolom terpotong ("PC…", "1j 2…",
                      "Bu…"). Lima kolom yang muat tapi tidak terbaca lebih buruk
                      dari empat kolom yang terbaca. Nama pelanggan tetap terlihat
                      di modal TOPUP. */}
                  <th scope="col" className="hidden w-[12%] px-1.5 py-2.5 font-medium lg:px-3 lg:table-cell">Pelanggan</th>
                  <th scope="col" className="hidden w-[10%] px-1.5 py-2.5 font-medium lg:px-3 lg:table-cell">IP</th>
                  <th scope="col" className="hidden w-[8%] px-1.5 py-2.5 font-medium lg:px-3 lg:table-cell">Mulai</th>
                  <th scope="col" className="hidden w-[9%] px-1.5 py-2.5 font-medium lg:px-3 lg:table-cell">Koneksi</th>
                  {/* ⚠️ Lebarnya BERBEDA per ukuran layar, dan itu disengaja:
                      di `lg` kolom ini 19% supaya tiga tombol muat satu baris;
                      di HP cukup 48% (15+15+22+48) karena hanya empat kolom
                      yang tampil. Kalau dipaksa 19% juga di HP, isinya jadi
                      374px di layar 358px — kolom AKSI terpotong dan operator
                      tidak bisa menekan MATI. */}
                  <th scope="col" className="w-[48%] px-1.5 py-2.5 font-medium lg:px-3 lg:w-[19%]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pcs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                      Belum ada PC terdaftar. Tambah PC lewat menu PC Management.
                    </td>
                  </tr>
                )}
                {pcs.map((pc) => {
                  const sesi = pc.session
                  const sisa = sesi?.sisaDetik ?? 0
                  const tipe = sesi ? (sesi.tipe === 'MEMBER' ? 'Member' : 'Voucher') : '—'

                  // ⚠️ PC yang sedang dipakai teknisi TIDAK boleh tampil "Idle".
                  // Teknisi tidak punya sesi, jadi `pc.status` memang IDLE — tapi
                  // operator akan mengira PC itu kosong dan menyalakan voucher di
                  // atas orang yang sedang memperbaiki.
                  const sedangTeknisi = pc.teknisi != null
                  const statusLabel = sedangTeknisi
                    ? 'Teknisi'
                    : pc.status === 'ACTIVE'
                      ? 'Aktif'
                      : pc.status === 'IDLE'
                        ? 'Idle'
                        : 'Offline'
                  const bolehAksi = role === 'ADMIN' || role === 'KASIR'

                  // "Sedang berjalan" dipakai untuk SEMUA yang ditampilkan, bukan
                  // cuma untuk milih tombol: hitung mundur, sisa waktu, tipe
                  // akun, dan tombolnya.
                  //
                  // Alasannya `sesi` saja tidak bisa dipercaya. Setelah agent
                  // putus, session masih ada beberapa detik sementara status PC
                  // sudah OFFLINE. Kalau hanya `sesi` yang dipakai, baris ini
                  // menampilkan sisa waktu yang sudah tidak jalan berdampingan
                  // dengan tombol Start — dan di aplikasi billing, angka yang
                  // tidak lagi benar lebih buruk daripada tidak ditampilkan.
                  const sedangBerjalan = sesi !== null && pc.status === 'ACTIVE'

                  // Hitung mundur auto-matikan. Nilai mulainya datang dari
                  // server, lalu dikurangi lokal setiap detik — server hanya
                  // menyiarkan ulang tiap ~10 detik, jadi tanpa penghitung
                  // lokal angkanya terlihat macet.
                  //
                  // ⚠️ Server tetap satu-satunya pihak yang benar-benar
                  // mematikan PC; angka ini murni informatif.
                  // PC OFFLINE: di-pin ke 0 dan TIDAK dikurangi, karena server
                  // tidak akan pernah bisa mengirim `admin:shutdown` ke PC yang
                  // agentnya offline.
                  const pcOffline = pc.status === 'OFFLINE'
                  let sisaMati: number | null = null
                  if (!sedangBerjalan && pc.matiDalamDetik !== null) {
                    sisaMati = pcOffline
                      ? 0
                      : Math.max(
                          0,
                          pc.matiDalamDetik - Math.floor((sekarangMs - payloadMs) / 1000),
                        )
                  }

                  const badgeStatus = sedangTeknisi ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      <span className="h-2 w-2 rounded-full bg-slate-500" aria-hidden="true" />
                      Teknisi
                    </span>
                  ) : (
                    <div className="scale-[0.92] whitespace-nowrap lg:scale-100">
                      <StatusBadge status={pc.status} />
                    </div>
                  )

                  return (
                    <tr key={pc.id} className="align-middle hover:bg-slate-50/70">
                      <td className="px-1.5 py-2 lg:px-3">
                        <p className="truncate font-semibold text-slate-900">{pc.namaPc}</p>
                      </td>

                      <td className="px-1.5 py-2 lg:px-3">
                        <span
                          title={
                            sedangTeknisi
                              ? `PC sedang dipakai teknisi ${pc.teknisi!.username} — tidak ada penagihan`
                              : undefined
                          }
                        >
                          {badgeStatus}
                        </span>
                      </td>

                      <td className="px-1.5 py-2 lg:px-3">
                        {sedangBerjalan ? (
                          <>
                            <div
                              className={`pcc__time pcc__time--teks${
                                sisa <= 300 ? ' pcc__time--warn' : ''
                              }`}
                            >
                              {formatDuration(sisa)}
                            </div>
                            <p className="pcc__time-label">SISA WAKTU</p>
                          </>
                        ) : (
                          <>
                            {/*
                              ⚠️ Kata "SHUTDOWN" sengaja TIDAK digabung ke
                              angka besar. Digabung, "SHUTDOWN 4:32" butuh
                              145px sementara kolom hanya dapat 49px di 390px —
                              jadi tampil "SH…" dan kasir justru tidak tahu
                              PC itu akan dimatikan. Dengan kata itu turun ke
                              label kecil, angka besar hanya berisi hitungan
                              ("4:32") dan labelnya menjadi "SHUTDOWN DALAM".
                            */}
                            <div className="pcc__time pcc__time--teks">
                              {sisaMati !== null
                                ? formatHitungMundur(sisaMati)
                                : statusLabel}
                            </div>
                            <p className="pcc__time-label">
                              {/* ⚠️ Teks label dipendekkan di HP: "SHUTDOWN DALAM"
                                  butuh 69px, kolom hanya dapat 67px di 390px, jadi
                                  tampil "SHUTDOWN DAL…". "MATI" tetap terbaca dan
                                  maknanya sama. */}
                              {sisaMati !== null ? 'MATI DALAM' : 'TIDAK ADA SESI'}
                            </p>
                          </>
                        )}
                      </td>

                      <td className="hidden px-1.5 py-2 lg:table-cell lg:px-3">
                        {sedangTeknisi ? (
                          <>
                            <p className="truncate font-medium text-slate-700">Teknisi</p>
                            <p className="truncate text-xs text-slate-500">{pc.teknisi!.username}</p>
                          </>
                        ) : sesi ? (
                          <>
                            <p className="truncate font-medium text-slate-800">
                              {sesi.kodeUnik ?? sesi.nama}
                            </p>
                            <p className="truncate text-xs text-slate-500">{tipe}</p>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="hidden truncate px-2 py-2 text-slate-600 lg:table-cell lg:px-3" title={pc.ipClient || 'belum connect'}>
                        {pc.ipClient || '—'}
                      </td>

                      <td className="hidden px-2 py-2 text-slate-600 lg:table-cell lg:px-3">
                        {sesi ? formatJamWib(sesi.waktuMulai) : '—'}
                      </td>

                      <td className="hidden px-2 py-2 text-slate-600 lg:table-cell lg:px-3">
                        {formatSejak(pc.lastHeartbeatAt)}
                      </td>

                      <td className="px-1.5 py-2 lg:px-3">
                        {bolehAksi ? (
                          <div className="flex flex-wrap items-center gap-1 lg:flex-nowrap">
                            {sedangBerjalan ? (
                              <>
                                <button
                                  type="button"
                                  className="qbtn h-9 cursor-pointer rounded-lg bg-amber-500 px-1.5 text-[11px] font-semibold lg:px-2.5 lg:text-xs text-white transition hover:bg-amber-600"
                                  onClick={() => kirimPerintah(pc, 'lock')}
                                  title="Akhiri sesi dan kunci layar"
                                >
                                  KUNCI
                                </button>
                                {/* ⚠️ Hanya untuk sesi yang benar-benar berjalan.
                                    `accountId` ada di dalam `session`, jadi teknisi
                                    (yang tidak punya baris Session) tidak akan pernah
                                    punya tombol ini — dan kalau tetap diklik, aksi
                                    di bawahnya menolak dengan pesan jelas. */}
                                <button
                                  type="button"
                                  className="qbtn h-9 cursor-pointer rounded-lg bg-green-600 px-1.5 text-[11px] font-semibold lg:px-2.5 lg:text-xs text-white transition hover:bg-green-700"
                                  onClick={() => bukaTopupPc(pc)}
                                  title="Topup akun yang sedang dipakai"
                                >
                                  TOPUP
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="qbtn h-9 cursor-pointer rounded-lg bg-green-600 px-1.5 text-[11px] font-semibold lg:px-2.5 lg:text-xs text-white transition hover:bg-green-700"
                                onClick={() => bukaModalStart(pc)}
                                title="Mulai sesi"
                              >
                                MULAI
                              </button>
                            )}
                            <button
                              type="button"
                              className="qbtn h-9 cursor-pointer rounded-lg bg-red-600 px-1.5 text-[11px] font-semibold lg:px-2.5 lg:text-xs text-white transition hover:bg-red-700"
                              onClick={() => kirimPerintah(pc, 'shutdown')}
                              title="Matikan PC"
                            >
                              MATI
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {startPc && (
        <React.Fragment>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !startBusy && setStartPc(null)}>
            <div
              className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Start PC {startPc.namaPc}</h2>
                {/* `modal-x` dipakai supaya sama persis dengan tombol X di
                    modal Tambah PC / Buat Voucher. Versi sebelumnya cuma
                    `rounded-md px-2 py-1`, sehingga kena aturan tombol global
                    uiverse: dapat gradient navy dan border-radius 1.5rem. */}
                <button
                  type="button"
                  className="modal-x"
                  onClick={() => !startBusy && setStartPc(null)}
                  disabled={startBusy}
                  aria-label="Tutup"
                  title="Tutup"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setStartMode('kode')}
                  className={`flex-1 rounded-md px-2 py-1.5 text-sm font-semibold transition ${
                    startMode === 'kode' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Pakai Kode
                </button>
                <button
                  onClick={() => setStartMode('baru')}
                  className={`flex-1 rounded-md px-2 py-1.5 text-sm font-semibold transition ${
                    startMode === 'baru' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Buat Voucher Baru
                </button>
              </div>

              {startMode === 'kode' ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Kode Member / Voucher
                  </label>
                  <input
                    value={kodeStart}
                    onChange={(e) => setKodeStart(e.target.value)}
                    placeholder="Contoh: 123456 atau nama member"
                    autoFocus
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Sesi langsung jalan di PC ini tanpa password.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Nominal Rupiah (kelipatan 500)
                  </label>
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={nominal || ''}
                    onChange={(e) => setNominal(Number(e.target.value))}
                    placeholder="Contoh: 10000"
                    autoFocus
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Voucher dibuat langsung + sesi jalan di PC ini. Kode & password muncul setelah dibuat.
                  </p>
                </div>
              )}

              {startError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {startError}
                </div>
              )}

              {createdVoucher && (
                <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
                  <div className="font-semibold text-green-800">Voucher dibuat & sesi jalan!</div>
                  <div className="mt-1 text-slate-700">
                    Kode: <b className="tabular-nums">{createdVoucher.kodeUnik}</b>
                    <span className="mx-2">•</span>
                    Password: <b className="tabular-nums">{createdVoucher.password}</b>
                    <span className="mx-2">•</span>
                    Rp {createdVoucher.nominal.toLocaleString('id-ID')}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Salin kode & password sebelum menutup popup ini.
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setStartPc(null)}
                  disabled={startBusy}
                  className="flex-1 rounded-md bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={kirimStart}
                  disabled={startBusy || (startMode === 'kode' && !kodeStart.trim()) || (startMode === 'baru' && !nominal)}
                  className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {startBusy
                    ? 'Memproses...'
                    : startMode === 'baru'
                      ? 'Buat & Start'
                      : 'Start Sesi'}
                </button>
              </div>
            </div>
          </div>
        </React.Fragment>
      )}
    </React.Fragment>
  )
}

// ---------------------------------------------------------------------------
// Panel Input Cepat Voucher / Member
// ---------------------------------------------------------------------------
// ⚠️ Semua target sentuh dibuat besar (h-14/h-16, text-lg) karena panel ini
// dipakai operator usia 60+ — ketukan kecil adalah sumber salah input, bukan
// sekadar soal Kenyamanan.
//
// ⚠️ Grid nominal memakai `grid-cols-2 sm:grid-cols-5`, bukan `grid-cols-5`
// polos: di HP lima kolom memaksa tiap tombol jadi ~60px sehingga nominal
// "Rp 5.000" terpotong. Dua kolom di layar sempit jauh lebih mudah diklik.

interface PanelInputCepatProps {
  kode: string
  onKode: (v: string) => void
  akun: Account | null
  suggest: Account[]
  onPilih: (a: Account) => void
  aksi: 'topup' | 'tarik' | null
  onTopup: () => void
  onTarik: () => void
  onBuat: (tipe: 'voucher' | 'member') => void
  nominal: number
  onNominalCepat: (n: number) => void
  nominalLain: string
  onNominalLain: (v: string) => void
  onKirimNominalLain: () => void
  error: string | null
  onReset: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

function PanelInputCepat({
  kode,
  onKode,
  akun,
  suggest,
  onPilih,
  aksi,
  onTopup,
  onTarik,
  onBuat,
  nominal,
  onNominalCepat,
  nominalLain,
  onNominalLain,
  onKirimNominalLain,
  error,
  onReset,
  inputRef,
}: PanelInputCepatProps) {
  return (
    <section className="mb-6 rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Input Cepat Voucher / Member</h2>
        {akun && (
          <button
            type="button"
            onClick={onReset}
            className="qbtn rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Ganti Akun
          </button>
        )}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          value={kode}
          onChange={(e) => onKode(e.target.value)}
          placeholder="Ketik kode voucher atau member..."
          autoComplete="off"
          aria-label="Kode voucher atau member"
          className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#1b233d] focus:ring-2 focus:ring-slate-200"
        />

        {suggest.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {suggest.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onPilih(a)}
                  className="qbtn flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="truncate font-medium text-slate-900">
                    {a.kodeUnik ?? a.nama}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-sm text-slate-500">
                      {a.tipe === 'MEMBER' ? 'Member' : 'Voucher'}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      {formatDuration(a.sisaWaktuDetik)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {akun && (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-slate-500">AKUN DIPILIH</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-xl font-semibold text-slate-900">{akun.kodeUnik ?? akun.nama}</p>
            <p className="text-sm font-medium text-slate-600">
              {akun.tipe === 'MEMBER' ? 'Member' : 'Voucher'}
            </p>
            <p className="text-sm font-medium text-emerald-700">
              Sisa {formatDuration(akun.sisaWaktuDetik)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={onTopup}
          aria-pressed={aksi === 'topup'}
          className={`qbtn h-16 cursor-pointer rounded-xl text-lg font-semibold text-white transition disabled:opacity-50 ${
            aksi === 'topup' ? 'bg-green-700 ring-2 ring-green-300' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          TOPUP
        </button>
        <button
          type="button"
          onClick={onTarik}
          aria-pressed={aksi === 'tarik'}
          className={`qbtn h-16 cursor-pointer rounded-xl text-lg font-semibold text-white transition disabled:opacity-50 ${
            aksi === 'tarik' ? 'bg-amber-600 ring-2 ring-amber-300' : 'bg-amber-500 hover:bg-amber-600'
          }`}
        >
          TARIK
        </button>
        {/* ⚠️ BUAT VOUCHER & MEMBER. Dua aksi dibuat sebagai DUA tombol terpisah,
            bukan satu tombol lalu memilih jenis di dalam modal. Alasannya: nama
            member adalah kredensial login dan kode voucher juga kredensial —
            kasir yang sedang buru tidak sempat memilih jenis dulu, dan salah
            pilih jenis berarti akun yang terbuang. Satu klik = satu jenis.
            assinado: tombol ini TIDAK butuh kode/akun terpilih, jadi tetap aktif
            walau kolom pencarian kosong. */}
        {/* ⚠️ Teksnya "VOUCHER BARU" / "MEMBER BARU", bukan "VOUCHER" /
            "MEMBER". Kasir sudah tidak punya menu Voucher di navbar, jadi
            tombol ini satu-satunya jalan membuat akun — dan label lama
            terdengar seperti membuka daftar, bukan membuat yang baru. */}
        <button
          type="button"
          onClick={() => onBuat('voucher')}
          className="qbtn h-16 cursor-pointer rounded-xl bg-[#1b233d] text-lg font-semibold text-white transition hover:bg-slate-800"
        >
          VOUCHER BARU
        </button>
        <button
          type="button"
          onClick={() => onBuat('member')}
          className="qbtn h-16 cursor-pointer rounded-xl bg-sky-700 text-lg font-semibold text-white transition hover:bg-sky-800"
        >
          MEMBER BARU
        </button>
      </div>

      {(aksi === 'topup' || aksi === 'tarik') && (
        <div className="mt-5 border-t border-slate-200 pt-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">
            {aksi === 'topup' ? 'Topup Cepat' : 'Nominal Penarikan'}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {NOMINAL_TOPUP_CEPAT.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onNominalCepat(n)}
                className={`qbtn h-12 cursor-pointer rounded-xl border text-base font-semibold transition ${
                  nominal === n
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-slate-300 bg-white text-slate-800 hover:border-green-500 hover:bg-green-50'
                }`}
              >
                {formatRupiah(n)}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={nominalLain}
              onChange={(e) => onNominalLain(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              placeholder="Nominal lain (kelipatan 500)"
              aria-label="Nominal lain"
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#1b233d] focus:ring-2 focus:ring-slate-200 sm:flex-1"
            />
            <button
              type="button"
              onClick={onKirimNominalLain}
              className="qbtn h-12 shrink-0 cursor-pointer rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Nominal Lain
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  )
}

/**
 * Format hitung mundur auto-matikan: `M:SS`, atau `H:MM:SS` kalau lewat 1 jam.
 *
 * ⚠️ BUKAN `formatDuration()` dari `lib/api.ts` — fungsi itu untuk sisa waktu
 * sesi, jadi 149 detik di sana terbaca "2j 29:29" (jam didahulukan 0, jadi
 * "0j 29:29" yang tampil sebagai "2j"). Untuk hitung mundur, yang dipakai
 * cuma menit dan detik.
 */
function formatHitungMundur(detik: number): string {
  const d = Math.max(0, Math.floor(detik))
  const jam = Math.floor(d / 3600)
  const menit = Math.floor((d % 3600) / 60)
  const sec = d % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (jam > 0) return `${jam}:${pad(menit)}:${pad(sec)}`
  return `${menit}:${pad(sec)}`
}

/**
 * "5 dtk lalu" / "12 mnt lalu" / "3 jam lalu" — untuk kolom Koneksi.
 *
 * ⚠️ PC yang OFFLINE menampilkan kapan heartbeat terakhirnya diterima. Ini
 * bukan indikator yang bisa dipercaya sebagai "PC hidup": server menandai
 * OFFLINE dari heartbeat yang lebih tua dari 30 detik, jadi angka yang tampil
 * kehabisan hitungan justru menandakan koneksi yang memang sudah tidak ada.
 * Gunanya untuk kasir melihat PC mana yang sering bolak-balik konek.
 */
function formatSejak(waktu: string | null): string {
  if (!waktu) return '—'
  const ms = Date.now() - new Date(waktu).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const detik = Math.floor(ms / 1000)
  if (detik < 60) return `${detik} dtk lalu`
  const menit = Math.floor(detik / 60)
  if (menit < 60) return `${menit} mnt lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  return formatWaktu(waktu)
}

/**
 * Backend menolak nominal yang bukan kelipatan 500 (dan menerima 0), jadi
 * dicek di sini agar request yang pasti ditolak tidak pernah terkirim.
 * Sama seperti `bacaNominal()` di AccountsPage.
 */
function bacaNominalTopup(input: string): number | null {
  const nilai = Number(input)
  if (input.trim() === '' || Number.isNaN(nilai) || nilai < 500 || nilai % 500 !== 0) {
    return null
  }
  return nilai
}

/**
 * Jam saja ("19:02") untuk kolom Mulai.
 *
 * ⚠️ `timeZone` WAJIB. Tanpa itu `toLocaleTimeString` ikut zona PC kasir, jadi
 * PC kasir yang disetel UTC akan melihat jamnya meleset 7 jam — dan di aplikasi
 * billing angka yang salah lebih buruk daripada tidak ditampilkan.
 */
function formatJamWib(waktu: string): string {
  const d = new Date(waktu)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}
