import { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  hover?: boolean
  gradient?: boolean
  variant?: 'default' | 'elevated' | 'outlined' | 'mystical' | 'mystical-gold'
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
    outlined: 'bg-white border border-gray-200',
    mystical: 'bg-gradient-to-br from-mystical-purple-900/80 to-mystical-cyan-950/80 shadow-mystical-medium border border-mystical-gold-700/20 text-mystical-gold-500',
    'mystical-gold': 'bg-gradient-to-br from-mystical-purple-900/60 to-mystical-cyan-950/60 shadow-gold-glow border border-mystical-gold-700/40 text-mystical-gold-500',
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