import type { HTMLAttributes } from 'react'
import { forwardRef } from 'react'

export type CardVariant = 'default' | 'bordered' | 'elevated'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: CardPadding
  hover?: boolean
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white border border-neutral-200',
  bordered: 'bg-white border border-neutral-300',
  elevated: 'bg-white shadow-lg border border-neutral-100',
}

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', hover = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-xl
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${hover ? 'hover:shadow-md transition-shadow duration-200 cursor-pointer' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mb-4 pb-3 border-b border-neutral-200 ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

CardHeader.displayName = 'CardHeader'

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  subtitle?: string
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ subtitle, className = '', children, ...props }, ref) => {
    return (
      <div {...props} ref={ref} className={className}>
        <h3 className="text-lg font-semibold text-neutral-900">{children}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>
    )
  }
)

CardTitle.displayName = 'CardTitle'

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {}

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={className} {...props}>
        {children}
      </div>
    )
  }
)

CardBody.displayName = 'CardBody'

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mt-4 pt-3 border-t border-neutral-200 flex items-center gap-3 ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

CardFooter.displayName = 'CardFooter'