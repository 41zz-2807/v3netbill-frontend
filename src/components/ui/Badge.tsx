import type { HTMLAttributes } from 'react'
import { forwardRef } from 'react'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral'
export type BadgeSize = 'sm' | 'md' | 'lg'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  dotColor?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-100 text-neutral-700 border border-neutral-200',
  success: 'bg-success-light text-success-text border border-success-border',
  warning: 'bg-warning-light text-warning-text border border-warning-border',
  danger: 'bg-danger-light text-danger-text border border-danger-border',
  info: 'bg-primary-light text-primary-text border border-primary-border',
  primary: 'bg-primary text-white border border-primary',
  neutral: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1 text-sm gap-2',
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', dot = false, dotColor, className = '', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center font-medium rounded-full border
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {dot && (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: dotColor || 'currentColor' }}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

export const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig: Record<string, { variant: BadgeVariant; label: string; dot: boolean }> = {
    ACTIVE: { variant: 'success', label: 'Aktif', dot: true },
    IDLE: { variant: 'neutral', label: 'Idle', dot: true },
    OFFLINE: { variant: 'danger', label: 'Offline', dot: true },
    BERJALAN: { variant: 'primary', label: 'Berjalan', dot: true },
    SELESAI: { variant: 'neutral', label: 'Selesai', dot: false },
    DISTOP: { variant: 'warning', label: 'Distop', dot: false },
    REVOKED: { variant: 'danger', label: 'Direvoke', dot: false },
    EXPIRED: { variant: 'warning', label: 'Expired', dot: false },
    VOUCHER: { variant: 'info', label: 'Voucher', dot: false },
    MEMBER: { variant: 'primary', label: 'Member', dot: false },
    BELI_BARU: { variant: 'success', label: 'Beli Baru', dot: false },
    TOPUP: { variant: 'primary', label: 'Topup', dot: false },
    KOREKSI: { variant: 'warning', label: 'Koreksi', dot: false },
  }

  const config = statusConfig[status] || { variant: 'default', label: status, dot: false }

  return (
    <Badge variant={config.variant} dot={config.dot} size="sm">
      {config.label}
    </Badge>
  )
}