interface LoaderProps {
  text?: string
  className?: string
}

export default function Loader({ text = 'loading', className = '' }: LoaderProps) {
  return (
    <div className={`loader ${className}`} role="status" aria-live="polite">
      <span className="loader-text">{text}</span>
      <span className="load"></span>
    </div>
  )
}