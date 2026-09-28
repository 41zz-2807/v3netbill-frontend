import type { ReactNode } from 'react'

export interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

/**
 * Tombol tab yang dipakai di beberapa halaman (Voucher & Member, Pengaturan).
 *
 * Di layar sempit, deretan tab dibuat bisa digeser horizontal supaya tidak
 * memaksajudul dan isi halaman melebar ke samping. `min-w-max` mencegah tiap
 * tombol terpotong jadi dua baris saat layar sempit.
 */
export function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`min-w-max rounded-md px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}
