import React, { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { DashboardPc, DashboardLog } from '../lib/types.ts'
import { formatDuration, formatWaktu, getToken, getRole, fetchActivityLogs, type ActivityLogItem } from '../lib/api.ts'
import { Card, CardBody, Badge, Table, Pagination } from '../components/ui'
import { PER_HALAMAN } from '../hooks/usePagination.ts'

const WS_URL = window.location.origin

export default function DashboardPage() {
  const [pcs, setPcs] = useState<DashboardPc[]>([])
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

    socket.on('dashboard:pc_update', (data: { pcs: DashboardPc[] }) => {
      setPcs(data.pcs)
    })

    socket.on('dashboard:log', () => {
      if (logPageRef.current === 1) {
        void loadLogs()
      } else {
        setLogTotal((t) => t + 1)
      }
    })

    return () => {
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
        {formatLogDetail(log, log.pcId ? pcs.find((p) => p.id === log.pcId)?.namaPc : undefined)}
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
            const statusLabel = pc.status === 'ACTIVE' ? 'Aktif' : pc.status === 'IDLE' ? 'Idle' : 'Offline'
            const bolehAksi = role === 'ADMIN' || role === 'KASIR'
            return (
              <div key={pc.id} className={`uui-card uui-card--${pc.status.toLowerCase()}`}>
                <div className="uui-card__top">
                  <div className="uui-card__notch" />
                  <div className="uui-card__bar">
                    <span className="uui-card__logo">
                      <IconTrophy />
                    </span>
                    {bolehAksi ? (
                      <div className="uui-card__actions">
                        <button
                          type="button"
                          className="uui-card__act uui-card__act--start"
                          onClick={() => bukaModalStart(pc)}
                          title="Start sesi"
                          aria-label={`Start sesi ${pc.namaPc}`}
                        >
                          <IconStart />
                        </button>
                        <button
                          type="button"
                          className="uui-card__act uui-card__act--lock"
                          onClick={() => kirimPerintah(pc, 'lock')}
                          title="Kunci layar"
                          aria-label={`Kunci ${pc.namaPc}`}
                        >
                          <IconKunci />
                        </button>
                        <button
                          type="button"
                          className="uui-card__act uui-card__act--shutdown"
                          onClick={() => kirimPerintah(pc, 'shutdown')}
                          title="Matikan PC"
                          aria-label={`Matikan ${pc.namaPc}`}
                        >
                          <IconMatikan />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="uui-card__hero">
                    <span
                      className={`uui-card__hero-value${
                        sesi ? (sisa <= 300 ? ' uui-card__hero-value--warn' : '') : ' uui-card__hero-value--sm'
                      }`}
                    >
                      {sesi ? formatDuration(sisa) : statusLabel}
                    </span>
                    <span className="uui-card__hero-label">{sesi ? 'Sisa Waktu' : 'Tidak ada sesi'}</span>
                  </div>
                </div>
                <div className="uui-card__bottom">
                  <span className="uui-card__title">
                    {pc.namaPc}
                    <span className="uui-card__title-ip"> - {pc.ipClient || '—'}</span>
                  </span>
                  <div className="uui-card__row">
                    <div className="uui-card__item">
                      <span
                        className={`uui-card__big ${
                          pc.status === 'ACTIVE'
                            ? 'uui-card__big--ok'
                            : pc.status === 'IDLE'
                              ? 'uui-card__big--warn'
                              : 'uui-card__big--danger'
                        }`}
                      >
                        {statusLabel}
                      </span>
                      <span className="uui-card__regular">Status</span>
                    </div>
                    <div className="uui-card__item">
                      <span className={`uui-card__big ${sesi ? '' : 'uui-card__big--muted'}`}>{tipe}</span>
                      <span className="uui-card__regular">Tipe</span>
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
                <button
                  onClick={() => !startBusy && setStartPc(null)}
                  className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
                >
                  ✕
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

function IconTrophy() {
  return (
    <svg viewBox="0 0 94 94" aria-hidden="true">
      <path d="M38.0481 4.82927C38.0481 2.16214 40.018 0 42.4481 0H51.2391C53.6692 0 55.6391 2.16214 55.6391 4.82927V40.1401C55.6391 48.8912 53.2343 55.6657 48.4248 60.4636C43.6153 65.2277 36.7304 67.6098 27.7701 67.6098C18.8099 67.6098 11.925 65.2953 7.11548 60.6663C2.37183 56.0036 0 49.2967 0 40.5456V4.82927C0 2.16213 1.96995 0 4.4 0H13.2405C15.6705 0 17.6405 2.16214 17.6405 4.82927V39.1265C17.6405 43.7892 18.4805 47.2018 20.1605 49.3642C21.8735 51.5267 24.4759 52.6079 27.9678 52.6079C31.4596 52.6079 34.0127 51.5436 35.6268 49.4149C37.241 47.2863 38.0481 43.8399 38.0481 39.0758V4.82927Z" />
      <path d="M86.9 61.8682C86.9 64.5353 84.9301 66.6975 82.5 66.6975H73.6595C71.2295 66.6975 69.2595 64.5353 69.2595 61.8682V4.82927C69.2595 2.16214 71.2295 0 73.6595 0H82.5C84.9301 0 86.9 2.16214 86.9 4.82927V61.8682Z" />
      <path d="M0 83.2195C0 80.5524 1.96995 78.3902 4.4 78.3902H83.6C86.0301 78.3902 88 80.5524 88 83.2195V89.1707C88 91.8379 86.0301 94 83.6 94H4.4C1.96995 94 0 91.8379 0 89.1707L0 83.2195Z" />
    </svg>
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

const LOG_EVENT_LABEL: Record<string, string> = {
  'session:started_dashboard': 'Sesi Berjalan',
  'session:started': 'Sesi Berjalan',
  'session:stopped': 'Sesi Berakhir',
  'transaction:created': 'Transaksi',
  'voucher:created_dashboard': 'Voucher Dibuat',
  'voucher:created': 'Voucher Dibuat',
  'account:revoked': 'Akun Dinonaktifkan',
  pc_lock: 'PC Dikunci',
  pc_locked: 'PC Dikunci',
  pc_unlock: 'PC Dibuka',
  pc_unlocked: 'PC Dibuka',
  pc_shutdown: 'PC Dimatikan',
}

const LOG_EVENT_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  'session:started_dashboard': 'success',
  'session:started': 'success',
  'session:stopped': 'warning',
  'transaction:created': 'info',
  'voucher:created_dashboard': 'success',
  'voucher:created': 'success',
  'account:revoked': 'danger',
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
      return `${alasan}, sisa kembali ${formatDuration(log.sisaWaktuKembali ?? 0)}`
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
    default:
      return ''
  }
}
