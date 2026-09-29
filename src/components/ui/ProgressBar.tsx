export interface ProgressBarProps {
  /**
   * Kemajuan 0..100. Beri `null` kalau besarannya belum diketahui — misalnya
   * saat server belum mengirim header `content-length`, atau untuk aksi yang
   * memang tidak punya ukuran (menyimpan pengaturan, membuat backup).
   *
   * Penting: `null` sengaja ditampilkan berbeda dari angka. Menampilkan
   * persen palsu untuk proses yang tidak bisa diukur sama dengan menampilkan
   * informasi yang salah.
   */
  value: number | null
  label?: string
  /** Baris kedua berisi ukuran berkas, misal "38,2 MB / 51,5 MB". */
  detail?: string
  /** Tampilkan angka persen di sisi kanan. Diabaikan kalau `value` null. */
  showPercent?: boolean
  size?: 'sm' | 'md'
  /** `light` untuk diletakkan di dalam tombol/dark, `dark` untuk di atas kartu putih. */
  tone?: 'dark' | 'light'
  className?: string
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(100, Math.max(0, n))
}

/**
 * Garis waktu kemajuan — pengganti animasi loader yang menutup layar.
 *
 * Dua mode:
 * - `value` berupa angka: garis terisi sesuai persen, jadi user tahu IRA
 *   sudah berapa persen dan berapa lama lagi kira-kira.
 * - `value` null: garis berjalan tanpa ujung yang jelas, menandakan "sibuk
 *   tapi belum bisa diukur". Angka persen sengaja TIDAK ditampilkan di mode
 *   ini supaya tidak memberi kesan presisi yang tidak ada.
 */
export default function ProgressBar({
  value,
  label,
  detail,
  showPercent = true,
  size = 'md',
  tone = 'dark',
  className = '',
}: ProgressBarProps) {
  const pasti = value !== null
  const persen = pasti ? Math.round(clamp(value)) : null
  const tinggi = size === 'sm' ? 'h-1' : 'h-1.5'
  const track = tone === 'light' ? 'bg-white/25' : 'bg-slate-200'
  const fill = tone === 'light' ? 'bg-white' : 'bg-slate-900'
  const teks = tone === 'light' ? 'text-white/90' : 'text-slate-700'
  const teksRedup = tone === 'light' ? 'text-white/70' : 'text-slate-500'

  return (
    <div className={`w-full ${className}`}>
      {(label || persen !== null) && (
        <div className={`mb-1 flex items-baseline justify-between gap-2 text-xs ${teks}`}>
          <span className="truncate">{label}</span>
          {persen !== null && showPercent && (
            <span className="shrink-0 font-semibold tabular-nums">{persen}%</span>
          )}
        </div>
      )}

      <div
        className={`w-full overflow-hidden rounded-full ${tinggi} ${track}`}
        role="progressbar"
        aria-valuenow={pasti ? persen ?? undefined : undefined}
        aria-valuemin={pasti ? 0 : undefined}
        aria-valuemax={pasti ? 100 : undefined}
        aria-label={label}
        aria-busy={!pasti}
      >
        {pasti ? (
          <div
            className={`h-full rounded-full transition-[width] duration-200 ease-out ${fill}`}
            style={{ width: `${persen}%` }}
          />
        ) : (
          <div className={`indeterminate h-full w-1/3 rounded-full ${fill}`} />
        )}
      </div>

      {detail && <div className={`mt-1 text-[11px] ${teksRedup}`}>{detail}</div>}
    </div>
  )
}
