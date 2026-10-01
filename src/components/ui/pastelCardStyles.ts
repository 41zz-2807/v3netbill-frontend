/**
 * Gaya ringan untuk panel modal, mengikuti kartu PC dashboard (Soft Pastel
 * Header): panel putih, header pastel cyan.
 *
 * ⚠️ `cardClass` memuat `pastel-card` — nama itu bukan hiasan. Aturan tombol
 * global uiverse di `index.css` mengecualikan `button:not(.pastel-card button)`,
 * jadi setiap tombol di dalam panel ini otomatis lepas dari gradient navy.
 * Kalau `pastel-card` dihapus, tombol-tombolnya dapat latar navy yang
 *bertentangan dengan panel putih.
 */

export const cardClass =
  'pastel-card w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]'

export const labelClass = 'text-[11px] font-medium tracking-wide text-slate-500'

export const titleClass = 'text-[15px] font-semibold text-slate-900'

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100'

export const fieldLabelClass = 'mb-1.5 block text-xs font-medium text-slate-600'

export const buttonClass =
  'w-full cursor-pointer rounded-lg border-0 bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-50'

export const buttonSecondaryClass =
  'w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50'

export const hintClass = 'text-xs leading-relaxed text-slate-500'

export const errorClass = 'rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700'

/** Nilai yang perlu dicatat_operator sebelum menutup: kode & password. */
export const secretClass =
  'mt-1 block break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-3xl font-bold tracking-[0.3em] text-slate-900'
