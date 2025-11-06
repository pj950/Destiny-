import { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  hover?: boolean
  gradient?: boolean
  variant?: 'default' | 'elevated' | 'outlined'
}

export default function Card({ 
  children, 
  className = '', 
  hover = false, 
  gradient = false,
  variant = 'default',
  ...props 
}: CardProps) {
  const baseStyles = 'rounded-xl overflow-hidden transition-all duration-300'
  
  const variants = {
    default: 'bg-white shadow-soft',
    elevated: 'bg-white shadow-medium',
    outlined: 'bg-white border border-gray-200'
  }
  
  const hoverStyles = hover 
    ? 'hover:shadow-xl hover:-translate-y-1 cursor-pointer' 
    : ''
  
  const gradientStyles = gradient 
    ? 'bg-gradient-to-br from-white via-brand-primary-50 to-brand-secondary-50 border border-brand-primary-100' 
    : ''
  
  return (
    <div 
      className={`${baseStyles} ${variants[variant]} ${hoverStyles} ${gradientStyles} ${className}`} 
      {...props}
    >
      {children}
    </div>
  )
}