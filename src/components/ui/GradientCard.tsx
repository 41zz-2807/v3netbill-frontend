import type { HTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'
import { cardGradientClass } from './gradientCardStyles'

export interface GradientCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string
  title: string
  icon?: ReactNode
  children: ReactNode
}

export const GradientCard = forwardRef<HTMLDivElement, GradientCardProps>(
  ({ label, title, icon, children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`${cardGradientClass} w-full max-w-sm rounded-[32px] p-1 shadow-lg ${className}`}
        {...props}
      >
        <div className="flex items-center justify-between rounded-t-[28px] px-4 py-3.5 text-white">
          <p className="text-sm font-semibold italic [text-shadow:2px_2px_6px_#2975ee]">{label}</p>
          {icon && <span className="flex shrink-0 items-center">{icon}</span>}
        </div>
        <div className="flex flex-col gap-3.5 rounded-b-[28px] bg-[#161a20] px-4 py-4 text-xs text-neutral-400">
          <p className="font-semibold text-[#bab9b9]">{title}</p>
          {children}
        </div>
      </div>
    )
  }
)

GradientCard.displayName = 'GradientCard'
