import type { ReactNode } from 'react'

/**
 * Kartu pengaturan. Gaya sengaja mengikuti `<section>` yang sebelumnya dipakai
 * langsung di SettingsPage (palet slate, radius-lg) supaya perpindahan ke tab
 * tidak mengubah tampilan sama sekali.
 *
 * Deskripsi memakai margin atas negatif supaya tetap menempel di bawah judul
 * dan isi kartu mulai pada jarak yang sama seperti sebelumnya.
 */
export function SettingsCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 font-semibold text-slate-800">{title}</h2>
      {description && (
        <p className="-mt-2 mb-3 text-xs leading-relaxed text-slate-500">{description}</p>
      )}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {footer && <div className="mt-3">{footer}</div>}
    </section>
  )
}
