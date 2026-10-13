import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPcs, createPc, deletePc, unlockPc, gantiNamaPc, setPcRusak, setWattPc } from '../lib/api.ts'
import type { Pc } from '../lib/types.ts'
import { useAuth } from '../context/AuthContext.tsx'
import ProgressBar from '../components/ui/ProgressBar.tsx'
import { Modal } from '../components/ui/Modal.tsx'
import { PastelCard } from '../components/ui/PastelCard.tsx'
import { DropdownAksi } from '../components/ui/DropdownAksi.tsx'
import {
  inputClass,
  buttonClass,
  buttonSecondaryClass,
  errorClass,
  fieldLabelClass,
  hintClass,
} from '../components/ui'
import { Pagination } from '../components/ui/Pagination.tsx'
import { BadgeUpdate, PanelUpdateAuto, usePollingAutoUpdate } from './pc/PanelUpdateAuto.tsx'
import {
  PER_HALAMAN,
  usePagination,
  urutkanTerbaru,
} from '../hooks/usePagination.ts'

function IsiPcPage() {
  const { role } = useAuth()

  const [pcs, setPcs] = useState<Pc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [namaPc, setNamaPc] = useState('')
  const [created, setCreated] = useState<Pc | null>(null)
  const [creating, setCreating] = useState(false)
  const [modal, setModal] = useState(false)
  /** PC yang dicentang untuk pembaruan otomatis. Kumpulan, bukan satu nilai:
   *  daftar kosong = tidak ada yang akan tersentuh sama sekali. */
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set())

  const terurut = useMemo(() => urutkanTerbaru(pcs, (pc) => pc.createdAt), [pcs])
  const {
    data: baris,
    halaman,
    totalHalaman,
    total,
    setHalaman,
  } = usePagination(terurut)

  /**
   * ⚠️ `sepi` membedakan muat pertama dari pemutakhiran latar.
   *
   * Tanpa itu, polling tiap 5 detik akan mem-flash baris "Memuat PC" dan
   * menggantinya dengan tabel kosong setiap putaran — dan karena polling hanya
   * jalan saat ada PC yang berflag, layar akan berkedip tepat ketika operator
   * sedang memperhatikannya.
   */
  /**
   * ⚠️ `load` harus `useCallback`, bukan fungsi biasa.
   *
   * Polling progres memanggilnya lewat `usePollingAutoUpdate`, dan fungsi
   * yang dibuat ulang tiap render membuat `useEffect` di dalamnya ikut
   * di-restart — timer 5 detik tidak pernah sampai ia dibakar, dan gejalanya
   * "progress tidak pernah bergerak" padahal server sudah mengirim angka baru.
   *Versi pertama membungkusnya di `useCallback` tapi tetap tidak stabil karena
   * `load` sendiri di luar daftar dependensi — sudah diperbaiki di sini.
   */
  const load = useCallback(async (sepi = false) => {
    try {
      if (!sepi) setLoading(true)
      // ⚠️ `termasukRusak` hanya berlaku untuk ADMIN. Kalau kasir yang membuka
      // halaman ini, PC yang ditandai memang tidak akan terlihat — dan itu
      // benar, karena hanya ADMIN yang boleh mengubah flag itu.
      setPcs(await fetchPcs(role === 'ADMIN'))
      setError(null)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      if (!sepi) setLoading(false)
    }
  }, [role])

  /**
   * ⚠️ `load` TIDAK boleh dipasang langsung ke hook.
   *
   * `load` punya parameter `sepi`, jadi kalau dipasang apa adanya, `jalankan()`
   * memanggilnya tanpa argumen dan `sepi` jatuh ke `false` — polling memuat
   * penuh setiap 5 detik, dan layar berkedip menampilkan "Memuat PC" tepat
   * ketika operator sedang memantau progres. Pembungkus ini yang memanggilnya
   * dengan `true`.
   */
  const pollSepi = useCallback(() => {
    void load(true)
  }, [load])

  const adaYangDiperbarui = useMemo(() => pcs.some((p) => p.autoUpdate), [pcs])
  usePollingAutoUpdate(adaYangDiperbarui, pollSepi)

  useEffect(() => {
    void load()
  }, [load])

  function bukaModal() {
    setError(null)
    setCreated(null)
    setModal(true)
  }

  function tutupModal() {
    if (creating) return
    setModal(false)
    setCreated(null)
    setError(null)
  }

  /* ---------- tandai PC rusak ---------- */
  const [rusakTarget, setRusakTarget] = useState<Pc | null>(null)
  const [alasanRusak, setAlasanRusak] = useState('')
  const [rusakError, setRusakError] = useState<string | null>(null)
  const [rusakInfo, setRusakInfo] = useState<string | null>(null)
  const [menyimpanRusak, setMenyimpanRusak] = useState(false)

  function bukaRusak(pc: Pc) {
    setRusakTarget(pc)
    setAlasanRusak(pc.alasanRusak ?? '')
    setRusakError(null)
  }

  function tutupRusak() {
    if (menyimpanRusak) return
    setRusakTarget(null)
    setAlasanRusak('')
    setRusakError(null)
  }

  async function handleSetRusak(rusak: boolean) {
    if (!rusakTarget) return
    setMenyimpanRusak(true)
    setRusakError(null)
    try {
      const hasil = await setPcRusak(rusakTarget.id, rusak, alasanRusak.trim() || undefined)
      setRusakTarget(null)
      setAlasanRusak('')
      await load()
      // Sesi yang dihentikan berarti ada sisa waktu yang dikembalikan ke
      // pelanggan. Kasir perlu tahu itu terjadi, bukan mengira PC ini idle.
      if (hasil.sesiDihentikan) {
        setRusakInfo(
          `${hasil.namaPc} ditandai rusak. Sesi yang sedang berjalan dihentikan dan sisa waktu dikembalikan.`,
        )
      }
    } catch (err: unknown) {
      const pesan = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
      setRusakError(Array.isArray(pesan) ? pesan[0] : (pesan ?? 'Gagal menyimpan flag PC rusak'))
    } finally {
      setMenyimpanRusak(false)
    }
  }

  /* ---------- ganti nama PC ---------- */
  const [editId, setEditId] = useState<string | null>(null)
  const [editNama, setEditNama] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)

  function bukaEdit(pc: Pc) {
    setEditId(pc.id)
    setEditNama(pc.namaPc)
    setEditError(null)
  }

  function tutupEdit() {
    if (menyimpan) return
    setEditId(null)
    setEditNama('')
    setEditError(null)
  }

  async function handleGantiNama(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    const nama = editNama.trim()
    if (!nama) {
      setEditError('Nama PC tidak boleh kosong.')
      return
    }
    setMenyimpan(true)
    setEditError(null)
    try {
      await gantiNamaPc(editId, nama)
      setEditId(null)
      setEditNama('')
      // Muat ulang supaya label di seluruh halaman ikut berubah.
      await load()
    } catch (err: unknown) {
      const pesan = (err as { response?: { data?: { message?: string } } }).response?.data?.message
      setEditError(pesan ?? 'Gagal mengganti nama PC')
    } finally {
      setMenyimpan(false)
    }
  }

  /**
   * Ubah daya listrik PC.
   *
   * ⚠️ Input TIDAK dikunci ke daftar preset, tapi tetap berupa angka 1-1000.
   * Alasannya: operator punya PC 150 W dan ada satu 300 W; memaksa memilih dari
   * daftar tetap akan salah untuk kasus yang belum dipikirkan. Validasi tetap
   * ditegakkan server — kolom ini jadi angka rupiah.
   */
  async function handleWatt(pc: Pc, mentah: string) {
    const watt = Number.parseInt(mentah, 10)
    if (!Number.isFinite(watt) || watt < 1 || watt > 1000) {
      setError('Daya harus angka antara 1 dan 1000 watt.')
      return
    }
    if (watt === pc.watt) return
    setError(null)
    try {
      await setWattPc(pc.id, watt)
      await load()
    } catch (err: unknown) {
      const pesan = (err as { response?: { data?: { message?: string } } }).response?.data?.message
      setError(pesan ?? 'Gagal menyimpan daya listrik PC')
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const pc = await createPc(namaPc)
      setCreated(pc)
      setNamaPc('')
      await load()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'Gagal membuat PC',
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus PC ini?')) return
    try {
      await deletePc(id)
      await load()
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  async function handleUnlock(id: string) {
    if (!confirm('Buka kunci PC ini? Sesi aktif akan dihentikan.')) return
    try {
      setError(null)
      await unlockPc(id)
      await load()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'Gagal membuka kunci',
      )
    }
  }

  /**
   * Salin teks ke clipboard.
   *
   * ⚠️ `navigator.clipboard` HANYA ADA di secure context (HTTPS atau localhost).
   * Aplikasi ini juga dibuka lewat IP LAN sebagai HTTP biasa
   * (`http://192.168.1.71:3000`), dan di sana `navigator.clipboard` adalah
   * `undefined` — pemanggilan `navigator.clipboard.writeText(...)` langsung
   * melempar `TypeError` dan berakhir "Gagal menyalin ke clipboard" meskipun
   * tombolnya sehat. Terbukti lewat Playwright (10 Okt 2026).
   *
   * Karena itu ada fallback ke `document.execCommand('copy')` + `<textarea>`,
   * yang tetap jalan di konteks non-secure.
   *
   * ⚠️ Fallback-nya HARUS dipanggil tanpa `await` lebih dulu. Kalau
   * `execCommand` baru dipanggil setelah menunggu Promise lain, *user
   * activation*-nya sudah habis dan browser akan menolaknya — persis seperti
   * kasus yang dicatat di AGENTS.md.
   */
  async function copyToClipboard(text: string, label: string) {
    // Secure context (HTTPS / localhost): pakai Clipboard API modern.
    if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text)
        alert(`${label} berhasil disalin: ${text}`)
        return
      } catch {
        // API ada tapi menolak (mis. dokumen tidak fokus) — lanjut ke fallback.
      }
    }

    // Fallback untuk HTTP / browser tanpa Clipboard API.
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-1000px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(textarea)
    alert(
      ok
        ? `${label} berhasil disalin: ${text}`
        : 'Gagal menyalin ke clipboard. Salin manual: tekan Ctrl+C / Cmd+C di kolom teks.',
    )
  }

  function formatShortId(id: string): string {
    return `${id.slice(0, 8)}…`
  }

  function formatShortToken(token: string): string {
    return `${token.slice(0, 8)}…`
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">PC Management</h1>
        {role === 'ADMIN' && (
          <button
            type="button"
            onClick={bukaModal}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            + Tambah PC
          </button>
        )}
      </div>

      <Modal open={modal} onClose={tutupModal} locked={creating} label="Tambah PC Baru">
        <form onSubmit={handleCreate}>
          <PastelCard
            label="PC BARU"
            title={created ? 'PC berhasil dibuat' : 'Tambah PC Baru'}
            onClose={tutupModal}
            closeDisabled={creating}
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            }
          >
            {created ? (
              <>
                <div>
                  <p className={fieldLabelClass}>agentToken</p>
                  <code className="mt-1 block break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
                    {created.agentToken}
                  </code>
                </div>
                <div>
                  <p className={fieldLabelClass}>PC ID</p>
                  <p className="break-all font-mono text-sm text-slate-800">{created.id}</p>
                </div>
                <p className={hintClass}>
                  agentToken dipakai agent untuk konek ke server. Salin sebelum menutup.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(created.agentToken, 'agentToken')}
                    className={buttonClass}
                  >
                    Salin agentToken
                  </button>
                  <button type="button" onClick={tutupModal} className={buttonSecondaryClass}>
                    Selesai
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={fieldLabelClass}>Nama PC</label>
                  <input
                    type="text"
                    value={namaPc}
                    onChange={(e) => setNamaPc(e.target.value)}
                    placeholder="Contoh: PC-01"
                    required
                    autoFocus
                    className={inputClass}
                  />
                </div>
                <p className={hintClass}>
                  IP tidak perlu diisi — server mencatatnya otomatis dari koneksi agent, jadi
                  tetap akurat walau IP PC berubah-ubah (DHCP).
                </p>
                {error && <p className={errorClass}>{error}</p>}
                <button type="submit" disabled={creating} className={buttonClass}>
                  {creating ? 'Membuat...' : 'Tambah PC'}
                </button>
              </>
            )}
          </PastelCard>
        </form>
      </Modal>

      {/* Modal ganti nama PC. Nama PC hanya label — PC ID, Agent Token, dan
          sesi yang sedang jalan tidak tersentuh. */}
      {editId && (
        <Modal open onClose={tutupEdit} locked={menyimpan} label="Ganti nama PC">
          <PastelCard
            label="PC"
            title="Ganti Nama PC"
            onClose={tutupEdit}
            closeDisabled={menyimpan}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            }
          >
            <p className={hintClass}>
              Nama PC hanya label tampilan. PC ID, Agent Token, dan sesi yang sedang
              berjalan tidak berubah — jadi aman dipakai saat PC sedang dipakai pelanggan.
            </p>
            <form onSubmit={handleGantiNama}>
              <div>
                <label className={fieldLabelClass} htmlFor="nama-pc-baru">Nama baru</label>
                <input
                  id="nama-pc-baru"
                  className={inputClass}
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  maxLength={30}
                  autoFocus
                  placeholder="Contoh: PC001"
                />
              </div>
              {editError && <p className={errorClass}>{editError}</p>}
              <button type="submit" disabled={menyimpan} className={buttonClass}>
                {menyimpan ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          </PastelCard>
        </Modal>
      )}

      {error && !modal && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {rusakInfo && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {rusakInfo}
          <button
            type="button"
            onClick={() => setRusakInfo(null)}
            className="ml-2 underline hover:no-underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Modal tandai PC rusak.
          ⚠️ Bunyinya: PC ini TIDAK rusak, hanya ditandai agar tidak dipakai.
          Operator sering memakai ini saat PC sedang diservis — jadi kalimatnya
          harus jelas supaya tidak disalahartikan sebagai "PC ini mati". */}
      {rusakTarget && (
        <Modal open onClose={tutupRusak} locked={menyimpanRusak} label="Tandai PC rusak">
          <PastelCard
            label={rusakTarget.namaPc}
            title={rusakTarget.rusak ? 'Batalkan Tanda Rusak' : 'Tandai PC Rusak'}
            onClose={tutupRusak}
            closeDisabled={menyimpanRusak}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            }
          >
            {rusakTarget.rusak ? (
              <>
                <p className={hintClass}>
                  Setelah flag dibatalkan, <strong>{rusakTarget.namaPc}</strong> muncul lagi di
                  dashboard, halaman login, dan aplikasi mobile, lalu bisa dipakai seperti biasa.
                </p>
                {rusakError && <p className={errorClass}>{rusakError}</p>}
                <button
                  type="button"
                  disabled={menyimpanRusak}
                  onClick={() => void handleSetRusak(false)}
                  className={buttonClass}
                >
                  {menyimpanRusak ? 'Menyimpan...' : `Ya, pakai lagi ${rusakTarget.namaPc}`}
                </button>
              </>
            ) : (
              <>
                <p className={hintClass}>
                  Ini <strong>bukan</strong> berarti {rusakTarget.namaPc} rusak. Tanda ini dipakai
                  supaya PC tidak bisa dipakai dan tidak muncul di dashboard, halaman login, dan
                  aplikasi mobile.
                </p>
                <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  Kalau sedang dipakai pelanggan, sesinya langsung dihentikan dan sisa
                  waktunya dikembalikan.
                </p>
                <form
                  className="mt-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleSetRusak(true)
                  }}
                >
                  <div>
                    <label className={fieldLabelClass} htmlFor="alasan-pc-rusak">
                      Alasan (opsional)
                    </label>
                    <input
                      id="alasan-pc-rusak"
                      className={inputClass}
                      value={alasanRusak}
                      onChange={(e) => setAlasanRusak(e.target.value)}
                      maxLength={200}
                      placeholder="Contoh: ganti hard disk, mouse rusak"
                    />
                  </div>
                  {rusakError && <p className={errorClass}>{rusakError}</p>}
                  <button type="submit" disabled={menyimpanRusak} className={buttonClass}>
                    {menyimpanRusak ? 'Menyimpan...' : `Tandai ${rusakTarget.namaPc} rusak`}
                  </button>
                </form>
              </>
            )}
          </PastelCard>
        </Modal>
      )}

      {role === 'ADMIN' && !loading && (
        <PanelUpdateAuto
          pcs={baris}
          dipilih={terpilih}
          setDipilih={setTerpilih}
          onSelesai={() => void load(true)}
        />
      )}

      <div className="rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <div className="p-4"><ProgressBar label="Memuat PC" value={null} /></div>
        ) : pcs.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">Belum ada PC.</div>
          // ⚠️ TIDAK pakai `min-w-max` di sini. Lebar minimum itu memaksa
          // tabel melebar melebihi wadahnya, jadi halaman harus digeser
          // horizontal — dan kolom paling penting (Status, Last Heartbeat)
          // justru berada paling kanan, di luar layar. Diganti `table-fixed`
          // + lebar per kolom + ikon di header.
        ) : (
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {/* ⚠️ Header pakai NAMA, bukan ikon. Versi lama memakai ikon,
                    padahal ikon menulis nol kata di kolom yang sama dengan data
                    dan cuma menyisakan `sr-only` untuk pembaca layar. "Listrik"
                    sebagai ikon membuat pembaca berhenti menebak artinya.
                    Lebar kolom ikut diambil ulang supaya teks header muat. */}
                <th className="px-3 py-2 w-[14%]" scope="col">Nama</th>
                <th className="px-3 py-2 w-[12%]" scope="col">IP</th>
                <th className="px-3 py-2 w-[11%]" scope="col">PC-ID</th>
                <th className="px-3 py-2 w-[11%]" scope="col">TokenID</th>
                <th className="px-3 py-2 w-[9%]" scope="col">Listrik</th>
                <th className="px-3 py-2 w-[10%]" scope="col">Status</th>
                <th className="px-3 py-2 w-[9%]" scope="col">Versi</th>
                <th className="px-3 py-2 w-[11%]" scope="col">Heart</th>
                {role === 'ADMIN' && <th className="px-3 py-2 w-[13%]" scope="col">Rustdesk</th>}
                {role === 'ADMIN' && <th className="px-3 py-2 w-[10%]" scope="col"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {baris.map((pc) => (
                <tr key={pc.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900 truncate" title={pc.namaPc}>
                    <span className="flex items-center gap-2">
                      {role === 'ADMIN' && (
                        <input
                          type="checkbox"
                          checked={terpilih.has(pc.id)}
                          disabled={pc.autoUpdate}
                          onChange={() => {
                            const next = new Set(terpilih)
                            if (next.has(pc.id)) next.delete(pc.id)
                            else next.add(pc.id)
                            setTerpilih(next)
                          }}
                          aria-label={`Pilih ${pc.namaPc} untuk pembaruan otomatis`}
                          title={
                            pc.autoUpdate
                              ? `${pc.namaPc} sedang ditandai untuk pembaruan`
                              : `Pilih ${pc.namaPc}`
                          }
                          className="h-4 w-4 shrink-0 rounded border-slate-300 disabled:opacity-40"
                        />
                      )}
                      <span className="truncate">{pc.namaPc}</span>
                      {role === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => bukaEdit(pc)}
                          className="p-1 text-slate-400 hover:text-slate-700 transition"
                          title={`Ganti nama ${pc.namaPc}`}
                          aria-label={`Ganti nama ${pc.namaPc}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 truncate" title={pc.ipClient || 'belum connect'}>
                    {pc.ipClient || '— belum connect'}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-slate-500 truncate" title={pc.id}>
                        {formatShortId(pc.id)}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(pc.id, 'PC ID')}
                        className="p-1 text-slate-400 hover:text-slate-600 transition"
                        title="Salin PC ID"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-slate-500 truncate" title={pc.agentToken}>
                        {formatShortToken(pc.agentToken)}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(pc.agentToken, 'Agent Token')}
                        className="p-1 text-slate-400 hover:text-slate-600 transition"
                        title="Salin Agent Token"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={1000}
                      defaultValue={pc.watt}
                      disabled={role !== 'ADMIN'}
                      onBlur={(e) => void handleWatt(pc, e.target.value)}
                      aria-label={`Daya listrik ${pc.namaPc} dalam watt`}
                      title={
                        role === 'ADMIN'
                          ? 'Daya PC dalam watt. Meter 2.200 VA itu kapasitas sambungan, bukan watt PC — pakai 150-300 W.'
                          : 'Hanya admin yang bisa mengubah daya listrik'
                      }
                      className="w-16 rounded border border-slate-300 px-1.5 py-1 text-right text-xs tabular-nums text-slate-700 disabled:border-transparent disabled:bg-transparent disabled:px-0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {/* ⚠️ Status ditampilkan sebagai titik berwarna + label
                        singkat, bukan badge teks penuh. Titik menyala
                        (`animate-pulse`) hanya saat ACTIVE, supaya "sedang
                        dipakai" langsung terbaca tanpa membaca nama statusnya.
                        `prefers-reduced-motion` sudah dimatikan di index.css. */}
                    <span
                      className="inline-flex items-center gap-2"
                      title={`Status PC: ${pc.status}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          pc.status === 'ACTIVE'
                            ? 'bg-emerald-500 animate-pulse'
                            : pc.status === 'IDLE'
                              ? 'bg-slate-400'
                              : 'bg-red-500'
                        }`}
                      />
                      <span className="text-xs font-medium text-slate-700">{pc.status}</span>
                    </span>
                    {/* ⚠️ Badge "Rusak" ditampilkan DI BAWAH status, bukan
                        menggantikannya. Status koneksi masih informasi berguna —
                        PC yang ditandai masih heartbeat, jadi kasir bisa
                        membedakan "PC nyala tapi ditandai" dari "PC mati". */}
                    {pc.rusak && (
                      <span
                        className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200"
                        title={pc.alasanRusak || 'Ditandai rusak oleh admin'}
                      >
                        <IkonPalu />
                        Rusak
                      </span>
                    )}
                  </td>
                  {/* ⚠️ "—" BUKAN tanda agent rusak. PC ini hanya belum pernah
                      melaporkan versi: agent versi lama tidak mengirim field itu.
                      Menandai merah akan membuat operator terburu-buru memperbarui
                      PC yang justru sudah paling baru. */}
                  <td
                    className="px-3 py-2"
                    title={
                      pc.versiAgent
                        ? `Versi agent: ${pc.versiAgent}`
                        : 'Agent belum melaporkan versi — normal untuk agent versi lama'
                    }
                  >
                    {pc.versiAgent ? (
                      <span className="font-mono text-xs font-medium text-slate-700">{pc.versiAgent}</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                    {/* ⚠️ Badge progress TUMPAT di bawah versi, bukan
                        menggantikannya. Angka versi masih dibutuhkan operator
                        untuk deciding PC ini perlu update atau belum — dan saat
                        update berjalan, itulah justru yang sedang diukur. */}
                    <div className="block">
                      <BadgeUpdate pc={pc} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600 truncate" title={pc.lastHeartbeatAt ?? ''}>
                    {pc.lastHeartbeatAt
                      ? new Date(pc.lastHeartbeatAt).toLocaleTimeString('id-ID', {
                          timeZone: 'Asia/Jakarta',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : '—'}
                  </td>
                  {role === 'ADMIN' && (
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          // ⚠️ `min-w-0` WAJIB, bukan tambahan gaya. Span ini
                          // anak flex, dan min-width default-nya `auto` = isi
                          // teks, jadi `truncate` tidak pernah benar-benar
                          // memotong — kolom justru dipaksa selebar 10 digit.
                          // Terukur di 390px: tanpa min-w-0 scrollWidth 368px
                          // vs clientWidth 356px.
                          className="min-w-0 font-mono text-xs text-slate-700 tracking-wide truncate"
                          title={pc.rustdeskId || 'RustDesk belum melaporkan ID'}
                        >
                          {pc.rustdeskId || '—'}
                        </span>
                        {/* ⚠️ Tombol copy disembunyikan kalau ID kosong, bukan
                            dinonaktifkan. PC yang belum punya RustDesk akan
                            punya satu tombol mati per baris, dan itu menambah
                            kebisingan di tabel yang justru sedang dibuat
                            lebih ringkas. */}
                        {pc.rustdeskId && (
                          <button
                            type="button"
                            onClick={() => void copyToClipboard(pc.rustdeskId!, 'RustDesk ID')}
                            title={`Salin RustDesk ID ${pc.namaPc}`}
                            aria-label={`Salin RustDesk ID ${pc.namaPc}`}
                            // ⚠️ `hidden sm:inline-flex` bukan sekadar biar
                            // rapi di HP. Tombol 24px itu lebih lebar dari sisa
                            // kolom 12% di layar 390px, dan `table-fixed` tetap
                            // memakai min-content sel sebagai batas bawah — jadi
                            // tabel melebar 12px melewati wadahnya. Terukur:
                            // scrollWidth 368px vs clientWidth 356px. Dengan
                            // tombol disembunyikan, keduanya kembali 356px.
                            className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:inline-flex"
                          >
                            <IkonSalin />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  {role === 'ADMIN' && (
                    /* ⚠️ `px-0 sm:px-3`: di 390px kolom ini hanya ~32px, dan
                       padding `px-3` memakan 24px darinya — jadi tombol 32px
                       selalu men spills keluar kartu sebesar 12px. Tabel ini
                       sengaja TIDAK memakai `overflow-x-auto` (lihat catatan
                       di atas tabelnya), jadi itu benar-benar merusak tampilan,
                       bukan cuma bisa digeser. Di lebar normal ruangnya cukup
                       lagi, jadi padding normal lagi dari `sm` ke atas. */
                    <td className="px-0 py-2 text-right sm:px-3">
                      {/* ⚠️ Tiga tombol ikon (tanda rusak, buka kunci, hapus)
                          diganti jadi satu tombol + dropdown. Alasannya lebar:
                          kolom ini hanya 10% tabel, dan tiga tombol 32px di
                          dalamnya menggabung ke dua baris di lebar tablet
                          sehingga tiap baris ikut meninggi. Ruang yang hilang
                          itu dikembalikan ke kolom data, dan nama aksinya jadi
                          terbaca penuh di dalam menu. */}
                      <DropdownAksi
                        labelAksesibel={`Aksi untuk ${pc.namaPc}`}
                        items={[
                          {
                            key: 'rusak',
                            label: pc.rusak ? 'Batalkan tanda rusak' : 'Tandai rusak',
                            warna: 'warn',
                            icon: pc.rusak ? <IkonPulih /> : <IkonPalu />,
                            onClick: () => bukaRusak(pc),
                          },
                          // ⚠️ "Buka kunci" hanya muncul kalau PC sedang
                          // dipakai. Memconditionally di dalam array, bukan
                          // filter — filter di sini bikin kunci `key` ikut
                          // bergeser saat status berubah.
                          ...(pc.status === 'ACTIVE'
                            ? [
                                {
                                  key: 'unlock',
                                  label: 'Buka kunci',
                                  icon: <IkonGembokBuka />,
                                  onClick: () => void handleUnlock(pc.id),
                                },
                              ]
                            : []),
                          {
                            key: 'hapus',
                            label: 'Hapus PC',
                            warna: 'danger',
                            icon: <IkonSampah />,
                            disabled: pc.rusak,
                            alasanDisabled:
                              'PC yang ditandai rusak tidak bisa dihapus — batalkan tandanya dulu',
                            onClick: () => void handleDelete(pc.id),
                          },
                        ]}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && totalHalaman > 1 && (
          <Pagination
            currentPage={halaman}
            totalPages={totalHalaman}
            onPageChange={setHalaman}
            totalItems={total}
            itemsPerPage={PER_HALAMAN}
          />
        )}
      </div>
    </div>
  )
}

/**
 * ADMIN saja.
 *
 * ⚠️ Menu-nya disembunyikan di `Layout.tsx`, tapi itu BELUM cukup — kasir bisa
 * tetap sampai ke sini dengan mengetik `/pcs` atau bookmark lama. Kalau hanya
 * disembunyikan, jaminannya nol.
 *
 * ⚠️ Guard TIDAK ditulis di atas hook milik halaman ini. `return` sebelum
 * `useState`/`useEffect` membuat seluruh hook jadi bersyarat, dan itu ditolak
 * aturan `react-hooks/rules-of-hooks` — semuanya jadi error, bukan warning.
 * `SettingsPage` lolos hanya karena guard-nya diletakkan SETELAH semua hook.
 * Memisahkan komponen lebih bersih: kasir tidak sampai memanggil API sama sekali.
 *
 * ⚠️ Pesan penolakan WAJIB memberi jalan keluar. Tanpa tautan, kasir tiba-tiba
 * kehilangan akses tanpa tahu harus pindah ke mana.
 */
export default function PcPage() {
  const { role } = useAuth()

  if (role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="font-medium text-slate-800">Halaman PC Management hanya untuk ADMIN.</p>
        <p className="mt-1 text-sm text-slate-600">
          Memulai, mengunci, dan mematikan sesi PC tetap bisa dari halaman Dashboard.
        </p>
        <a
          href="/"
          className="mt-4 inline-block rounded-md bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          Kembali ke Dashboard
        </a>
      </div>
    )
  }

  return <IsiPcPage />
}

/*
 * Ikon header tabel PC.
 *
 * ⚠️ Ditulis lokal di file ini, bukan di komponen bersama, karena ada tiga
 * halaman lain yang punya tabel dengan gaya sama tapi berbeda ikon — memaksakan
 * satu komponen berarti setiap tabel harus menerima daftar ikon, dan yang
 * terjadi hanya ada kolom yang dibiarkan kosong.
 *
 * Semua `aria-hidden` + `sr-only` teks, supaya nama kolom tetap terbaca
 * pembaca layar walaupun header-nya cuma ikon.
 */





/** Kolom versi agent — Reports/paket upload icon. */
/*
 * Segitiga peringatan, bukan palu.
 *
 * ⚠️ Versi palu yang dipakai pertama kali ter-render jadi goresan kecil
 * kemerahan — pada 32px ukurannya tidak terbaca sebagai "tandai rusak", dan
 * operator jadi tidak tahu tombol itu melakukan apa. Segitiga + tanda seru
 * lazim berarti "bahaya/peringatan" di mana saja.
 */

function IkonSalin() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function IkonPalu() {
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    </svg>
  )
}

function IkonPulih() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0113.7-5.7L20 6M20 14a8 8 0 01-13.7 5.7L4 18" />
    </svg>
  )
}

function IkonGembokBuka() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7A5 5 0 007 7v2H5a1 1 0 00-1 1v11a1 1 0 001 1h14a1 1 0 001-1V10a1 1 0 00-1-1h-2M8 9h8a4 4 0 010 8H8" />
    </svg>
  )
}


function IkonSampah() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  )
}
