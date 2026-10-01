import type { ReactNode } from 'react'
import { cardClass, labelClass, titleClass } from './pastelCardStyles'

export interface PastelCardProps {
  /** Label kecil di atas judul, mis. "VOUCHER" atau "PC BARU". */
  label: string
  title: string
  icon?: ReactNode
  onClose: () => void
  /** Saat proses berjalan, tombol X dimatikan supaya tidak menutup di tengah. */
  closeDisabled?: boolean
  children: ReactNode
}

/**
 * Panel modal dengan header pastel, sama seperti kartu PC dashboard.
 *
 * Tombol X ada di header, bukan di bawah konten. Alasannya: panel ini punya
 * dua tahap (form lalu layar hasil), dan "Selesai" hanya ada di tahap hasil.
 * Di tahap form satu-satunya jalan keluar selain X adalah klik backdrop atau
 * Escape — dan klik backdrop itu mudah tidak disengaja saat mengisi form.
 *
 * `closeDisabled` sengaja dihormati, bukan hanya disables:X tetap ada supaya
 * posisi tombol tidak bergeser di tengah proses.
 */
export function PastelCard({
  label,
  title,
  icon,
  onClose,
  closeDisabled,
  children,
}: PastelCardProps) {
  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3 bg-[#e0f7fa] px-5 py-4">
        <div className="min-w-0">
          <p className={labelClass}>{label}</p>
          <p className={titleClass}>{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {icon && <span className="text-slate-500">{icon}</span>}
          <button
            type="button"
            className="modal-x"
            onClick={onClose}
            disabled={closeDisabled}
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
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
    </div>
  )
}

