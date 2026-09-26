import Loader from './Loader'

interface LoadingOverlayProps {
  text?: string
}

export default function LoadingOverlay({ text = 'Memproses' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
      <Loader text={text} />
    </div>
  )
}