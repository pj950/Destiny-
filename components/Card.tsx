import { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  hover?: boolean
  gradient?: boolean
}

export default function Card({ children, className = '', hover = false, gradient = false, ...props }: CardProps) {
  const baseStyles = 'rounded-xl shadow-lg overflow-hidden transition-all duration-300'
  const hoverStyles = hover ? 'hover:shadow-2xl hover:-translate-y-1 cursor-pointer' : ''
  const gradientStyles = gradient 
    ? 'bg-gradient-to-br from-white to-indigo-50 border border-indigo-100' 
    : 'bg-white'
  
  return (
    <div className={`${baseStyles} ${hoverStyles} ${gradientStyles} ${className}`} {...props}>
      {children}
    </div>
  )
}
