import React, { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { DashboardPc, DashboardLog } from '../lib/types.ts'
import { formatDuration, formatWaktu, getToken, getRole, fetchActivityLogs, type ActivityLogItem } from '../lib/api.ts'
import { Card, CardBody, Badge, Table, Pagination } from '../components/ui'
import { PER_HALAMAN } from '../hooks/usePagination.ts'

const WS_URL = window.location.origin

export default function DashboardPage() {
  const [pcs, setPcs] = useState<DashboardPc[]>([])
  /** Waktu saat payload `dashboard:pc_update` terakhir diterima. */
  const [payloadMs, setPayloadMs] = useState(() => Date.now())
  /** Jam lokal, satu tick per detik untuk seluruh halaman. */
  const [sekarangMs, setSekarangMs] = useState(() => Date.now())
  const [logs, setLogs] = useState<DashboardLog[]>([])
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

  // Logs pagination
  const [logPage, setLogPage] = useState(1)
  const [logTotalPages, setLogTotalPages] = useState(1)
  const [logTotal, setLogTotal] = useState(0)
  const [logLoading, setLogLoading] = useState(false)
  const logPageRef = useRef(1)

  useEffect(() => {
    logPageRef.current = logPage
  }, [logPage])

  // Load initial logs from API
  useEffect(() => {
    loadLogs()
  }, [logPage])

  async function loadLogs() {
    setLogLoading(true)
    try {
      const res = await fetchActivityLogs(logPage, PER_HALAMAN)
      const convertedLogs: DashboardLog[] = res.data.map((item: ActivityLogItem) => {
        let detail: Record<string, unknown> = {}
        try {
          detail = item.detail ? JSON.parse(item.detail) : {}
        } catch {
          detail = {}
        }
        return {
          event: item.event,
          at: item.createdAt,
          sessionId: detail.sessionId as string | undefined,
          pcId: item.pcId as string | undefined,
          accountId: item.accountId as string | undefined,
          kasirId: item.kasirId as string | undefined,
          alasan: detail.alasan as string | undefined,
          sisaWaktuKembali: detail.sisaWaktuKembali as number | undefined,
          akun: detail.akun as string | undefined,
          durasiDetik: detail.durasiDetik as number | undefined,
          durasiMenit: detail.durasiMenit as number | undefined,
          nominal: detail.nominal as number | undefined,
          jenis: detail.jenis as string | undefined,
          kodeUnik: detail.kodeUnik as string | undefined,
          nama: detail.nama as string | undefined,
          // Nama pelaku aksi (kunci/matikan/start). Disimpan backend di dalam
          // `detail` JSON; tanpa baris ini log menampilkan "-".
          by: detail.by as string | undefined,
          // ⚠️ Tiga field di bawah WAJIB ikut di allow-list ini. Pemetaan dari
          // `ActivityLogItem` ke `DashboardLog`_memilih field secara manual, jadi
          // field yang tidak disebut di sini HILANG diam-diam — gejalanya
          // "idle - menit", bukan error.
          pc: detail.pc as string | undefined,
          keterangan: detail.detail as string | undefined,
          menit: detail.menit as number | undefined,
        }
      })
      setLogs(convertedLogs)
      setLogTotalPages(res.totalPages)
      setLogTotal(res.total)
    } catch (err) {
      console.error('Failed to load logs:', err)
    } finally {
      setLogLoading(false)
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

    socket.on('dashboard:log', () => {
      if (logPageRef.current === 1) {
        void loadLogs()
      } else {
        setLogTotal((t) => t + 1)
      }
    })

    return () => {
      clearInterval(jam)
      socket.disconnect()
    }
  }, [])

  const aktif = pcs.filter((p) => p.status === 'ACTIVE').length
  const idle = pcs.filter((p) => p.status === 'IDLE').length
  const offline = pcs.filter((p) => p.status === 'OFFLINE').length
  const totalPcs = aktif + idle + offline

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

  const logColumns = [
    { key: 'at', header: 'Waktu', render: (log: DashboardLog) => formatWaktu(log.at) },
    { key: 'event', header: 'Event', render: (log: DashboardLog) => (
      <Badge variant={logEventVariant(log.event)} size="sm">
        {logEventLabel(log.event)}
      </Badge>
    )},
    { key: 'detail', header: 'Detail', render: (log: DashboardLog) => (
      <span className="text-slate-600">
        {formatLogDetail(log, log.pc ?? (log.pcId ? pcs.find((p) => p.id === log.pcId)?.namaPc : undefined))}
      </span>
    )},
  ]

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

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard label="PC Aktif" value={String(aktif)} percent={totalPcs ? Math.round((aktif / totalPcs) * 100) : 0} color="#10B981" />
          <StatCard label="PC Idle" value={String(idle)} percent={totalPcs ? Math.round((idle / totalPcs) * 100) : 0} color="#F59E0B" />
          <StatCard label="PC Offline" value={String(offline)} percent={totalPcs ? Math.round((offline / totalPcs) * 100) : 0} color="#EF4444" />
        </div>

        {actionResult && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
            {actionResult}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pcs.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-400">
              Belum ada PC terdaftar. Tambah PC lewat menu PC Management.
            </div>
          )}
          {pcs.map((pc) => {
            const sesi = pc.session
            const sisa = sesi?.sisaDetik ?? 0
            const tipe = sesi ? (sesi.tipe === 'MEMBER' ? 'Member' : 'Voucher') : '—'
            const statusLabel =
              pc.status === 'ACTIVE' ? 'Aktif' : pc.status === 'IDLE' ? 'Idle' : 'Offline'
            const bolehAksi = role === 'ADMIN' || role === 'KASIR'

            // "Sedang berjalan" dipakai untuk SEMUA yang ditampilkan, bukan
            // cuma untuk milih tombol: hitung mundur, label SISA WAKTU, tipe
            // akun, dan tombolnya.
            //
            // Alasannya `sesi` saja tidak bisa dipercaya. Setelah agent
            // putus, session masih ada beberapa detik (grace period) sementara
            // status PC sudah berubah ke OFFLINE. Kalau hanya `sesi` yang
            // dipakai, card menampilkan hitung mundur yang sudah tidak
            // jalan berdampingan dengan tombol Start — dan di aplikasi
            // billing, angka yang tidak lagi benar lebih buruk daripada tidak
            // ditampilkan sama sekali.
            const sedangBerjalan = sesi !== null && pc.status === 'ACTIVE'

            // Hitung mundur auto-matikan. Nilai mulainya datang dari server,
            // lalu dikurangi lokal setiap detik supaya angka ikut bergerak —
            // server hanya menyiarkan ulang tiap ~10 detik, jadi kalau tidak
            // ada penghitung lokal angkanya terlihat macet.
            //
            // ⚠️ Server tetap satu-satunya pihak yang benar-benar mematikan PC.
            // Hitung mundur ini murni informatif; kalau frontend yang matikan,
            // kasir yang menutup tab akan membuat PC tidak pernah mati.
            // Dihitung dari jam lokal dikurangi umur payload, BUKAN dari
            // penghitung yang dikurangi satu per detik. Alasannya: tiap
            // broadcast baru (~10 detik) mengirim `matiDalamDetik` yang sudah
            // berkurang, jadi kalau penghitung lokal ikut berkurang, keduanya
            // saling meniadakan dan angkanya terlihat macet lalu melompat.
            // PC OFFLINE: hitung mundur di-pin ke 0 dan TIDAK dikurangi.
            //
            // ⚠️ Server tidak akan pernah bisa mengirim `admin:shutdown` ke PC
            // yang agentnya offline — `checkAutoShutdown()` melewatinya dan
            // sengaja tidak disenapkan timer, supaya tidak ada perintah kedua
            // yang menggantung. Jadi angka yang turun di kartu offline bukan
            // prognosis, cuma angka yang tidak akan sampai.
            //
            // Gejalanya tanpa penjaga ini: tiap broadcast baru (~10 detik)
            // mengirim `matiDalamDetik` yang dihitung ulang dari
            // `terakhirAktifAt`, dan nilai itu ikut bertambah karena waktu
            // terus berjalan, sementara penghitung lokal terus mengurangi.
            // Dua sumber itu saling meniadakan, jadi angkanya terlihat hidup
            // (00:01 -> 00:00 -> 00:01) padahal tidak ada yang terjadi.
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

            const warnaStatus =
              pc.status === 'ACTIVE'
                ? 'ok'
                : pc.status === 'IDLE'
                  ? 'warn'
                  : 'danger'

            return (
              <div key={pc.id} className="pcc">
                <div className="pcc__head">
                  <div className="min-w-0">
                    <div
                      className={`pcc__time${
                        sedangBerjalan
                          ? sisa <= 300
                            ? ' pcc__time--warn'
                            : ''
                          : ' pcc__time--teks'
                      }`}
                    >
                      {sedangBerjalan ? formatDuration(sisa) : statusLabel}
                    </div>
                    <div className="pcc__time-label">
                      {sedangBerjalan
                        ? 'SISA WAKTU'
                        : sisaMati !== null
                          ? // ⚠️ Warna makin mencolok di detik-detik terakhir.
                            // Kalau tetap abu-abu, kasir tidak sempat bereaksi
                            // dan PC mati tepat saat dia melihat.
                            `SHUTDOWN DALAM ${formatHitungMundur(sisaMati)}`
                          : 'TIDAK ADA SESI'}
                    </div>
                  </div>

                  {/* Dua tombol, sama seperti kartu PC di aplikasi Android:
                      yang pertama bergantian Start / Kunci, dan Matikan
                      selalu ada. Dua-duanya ditampilkan berdampingan —
                      satu tombol per baris menambah tinggi card. */}
                  {bolehAksi && (
                    <div className="pcc__actions">
                      {sedangBerjalan ? (
                        <button
                          type="button"
                          className="pcc__act pcc__act--lock"
                          onClick={() => kirimPerintah(pc, 'lock')}
                          title="Akhiri sesi dan kunci layar"
                          aria-label={`Kunci ${pc.namaPc}`}
                        >
                          <IconKunci />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="pcc__act pcc__act--start"
                          onClick={() => bukaModalStart(pc)}
                          title="Mulai sesi"
                          aria-label={`Start sesi ${pc.namaPc}`}
                        >
                          <IconStart />
                        </button>
                      )}
                      <button
                        type="button"
                        className="pcc__act pcc__act--power"
                        onClick={() => kirimPerintah(pc, 'shutdown')}
                        title="Matikan PC"
                        aria-label={`Matikan ${pc.namaPc}`}
                      >
                        <IconMatikan />
                      </button>
                    </div>
                  )}
                </div>

                <div className="pcc__body">
                  <div className="pcc__name">
                    {pc.namaPc}
                    <span className="pcc__name-ip"> - {pc.ipClient || '—'}</span>
                  </div>

                  <div className="pcc__info">
                    <div>
                      <span className="pcc__info-label">Status</span>
                      <span className={`pcc__info-value pcc__info-value--${warnaStatus}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div>
                      <span className="pcc__info-label">Tipe</span>
                      <span
                        className={`pcc__info-value${sedangBerjalan ? '' : ' pcc__info-value--muted'}`}
                      >
                        {tipe}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

        </div>

        <Card className="mt-6">
          <CardBody className="p-0">
            <div className="p-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-slate-900">Log Aktivitas</h2>
            </div>
            <div className="p-4">
              {logLoading ? (
                <div className="flex justify-center p-4">Memuat log...</div>
              ) : logs.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-400">Belum ada aktivitas.</div>
              ) : (
                <React.Fragment>
                  <Table
                    columns={logColumns}
                    data={logs}
                    keyExtractor={(log) => `${log.at}-${log.event}`}
                    striped
                    hoverable
                  />
                  {logTotalPages > 1 && (
                    <Pagination
                      currentPage={logPage}
                      totalPages={logTotalPages}
                      onPageChange={setLogPage}
                      showTotal={true}
                      totalItems={logTotal}
                      itemsPerPage={PER_HALAMAN}
                    />
                  )}
                </React.Fragment>
              )}
            </div>
          </CardBody>
        </Card>
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

function StatCard({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return (
    <div className="w-full max-w-[320px] rounded-[20px] bg-white px-4 py-3 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-700">{label}</p>
        <p className="text-2xl font-bold leading-7 text-slate-800 tabular-nums">{value}</p>
      </div>
      <div className="relative mt-3 h-1.5 w-full rounded bg-gray-200">
        <div
          className="absolute left-0 top-0 h-full rounded transition-all duration-500"
          style={{ backgroundColor: color, width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  )
}

function IconStart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  )
}

function IconKunci() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 9V7A5 5 0 0 0 7 7v2H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-2ZM9 7a3 3 0 1 1 6 0v2H9V7Zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
    </svg>
  )
}

function IconMatikan() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.01 7 16 3h-2v4h-4V3H8v4h-.01A2 2 0 0 0 6 8.99v5.49L9.5 18v3h5v-3l3.5-3.51V8.99A2 2 0 0 0 16.01 7Z" />
    </svg>
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

const LOG_EVENT_LABEL: Record<string, string> = {
  'session:started_dashboard': 'Sesi Berjalan',
  'session:started': 'Sesi Berjalan',
  'session:stopped': 'Sesi Berakhir',
  'transaction:created': 'Transaksi',
  'voucher:created_dashboard': 'Voucher Dibuat',
  'voucher:created': 'Voucher Dibuat',
  'account:revoked': 'Akun Dinonaktifkan',
  'account:password_changed': 'Password Diubah',
  pc_lock: 'PC Dikunci',
  pc_locked: 'PC Dikunci',
  pc_unlock: 'PC Dibuka',
  pc_unlocked: 'PC Dibuka',
  pc_shutdown: 'PC Dimatikan',
  pc_shutdown_auto: 'PC Mati Otomatis',
}

const LOG_EVENT_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  'session:started_dashboard': 'success',
  'session:started': 'success',
  'session:stopped': 'warning',
  'transaction:created': 'info',
  'voucher:created_dashboard': 'success',
  'voucher:created': 'success',
  'account:revoked': 'danger',
  'account:password_changed': 'warning',
  pc_lock: 'warning',
  pc_locked: 'warning',
  pc_unlock: 'info',
  pc_unlocked: 'info',
  pc_shutdown: 'danger',
}

/** Alasan berhenti sesi, dari kode internal ke bahasa yang dimengerti kasir. */
const STOP_REASON: Record<string, string> = {
  habis: 'Waktu habis',
  manual: 'Dihentikan manual',
  disconnect_timeout: 'Koneksi terputus',
  akun_nonaktif: 'Akun dinonaktifkan',
}

function logEventLabel(event: string): string {
  return LOG_EVENT_LABEL[event] ?? event
}

function logEventVariant(event: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  return LOG_EVENT_VARIANT[event] ?? 'default'
}

function formatLogDetail(log: DashboardLog, pcName?: string): string {
  const pc = pcName ?? 'PC'
  switch (log.event) {
    case 'session:started_dashboard':
    case 'session:started':
      return `${pc} mulai dipakai akun ${log.akun ?? '-'}${log.by ? ` oleh ${log.by}` : ''}`
    case 'session:stopped': {
      const alasan = STOP_REASON[log.alasan ?? ''] ?? log.alasan ?? '-'
      // ⚠️ `akun` WAJIB ikut di sini. Versi lama hanya menulis alasan dan
      // sisa waktu, jadi kolom Detail menampilkan "Waktu habis, sisa kembali
      // 0j 00:00" untuk sesi APAPUN — kasir tidak pernah tahu akun mana yang
      // barusan berakhir. Payload backend ikut dikasih `akun` di fix yang sama;
      // kalau hanya sisi frontend yang diubah, kolomnya tetap kosong.
      return (
        `${pc} — akun ${log.akun ?? '-'}: ${alasan}, ` +
        `sisa kembali ${formatDuration(log.sisaWaktuKembali ?? 0)}`
      )
    }
    case 'transaction:created':
      return `${log.jenis ?? '-'} ${log.kodeUnik ?? log.nama ?? '-'} — Rp ${log.nominal?.toLocaleString('id-ID') ?? '-'}`
    case 'pc_lock':
    case 'pc_locked':
      return `${pc} dikunci oleh ${log.by ?? '-'}`
    case 'pc_unlock':
    case 'pc_unlocked':
      return `${pc} dibuka oleh ${log.by ?? '-'}`
    case 'pc_shutdown':
      return `${pc} dimatikan oleh ${log.by ?? '-'}`
    // ⚠️ Case ini sebelumnya TIDAK ADA sama sekali, jadi event-nya jatuh ke
    // `default: return ''` — badge menulis "PC Mati Otomatis" tapi kolom
    // Detail kosong. Peta label sudah ada sejak awal; yang hilang justru
    // pemetaan detail-nya.
    case 'pc_shutdown_auto':
      return `${pc} dimatikan otomatis — ${log.keterangan ?? `idle ${log.menit ?? '-'} menit tanpa aktivitas login`}`
    default:
      return ''
  }
}
