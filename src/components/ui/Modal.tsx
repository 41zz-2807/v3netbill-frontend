import type { ReactNode } from 'react'
import { useEffect } from 'react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Cegah popup tertutup (mis. sedang submit) */
  locked?: boolean
  label?: string
}

export function Modal({ open, onClose, children, locked = false, label }: ModalProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !locked) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, locked, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      onClick={() => !locked && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // w-full + max-w-fit: modal selebar isinya, tapi tidak pernah melebihi lebar
        // induk (backdrop yg sudah punya p-4) — jadi aman di layar HP.
        // max-h + overflow-y: isi yang tinggi (mis. form panjang) bisa di-scroll
        // di dalam modal, bukan membuat halaman ikut memanjang.
        className="max-h-[90vh] w-full max-w-fit overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
