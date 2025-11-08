import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'mystical' | 'gold'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  children: ReactNode
  fullWidth?: boolean
  loading?: boolean
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth = false,
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed relative'
  
  const variants = {
    primary: 'bg-gradient-to-r from-brand-primary-500 to-brand-primary-600 hover:from-brand-primary-600 hover:to-brand-primary-700 text-white shadow-soft hover:shadow-medium focus:ring-brand-primary-500',
    secondary: 'bg-gradient-to-r from-brand-secondary-500 to-brand-secondary-600 hover:from-brand-secondary-600 hover:to-brand-secondary-700 text-white shadow-soft hover:shadow-medium focus:ring-brand-secondary-500',
    outline: 'border-2 border-brand-primary-500 text-brand-primary-600 hover:bg-brand-primary-50 focus:ring-brand-primary-500 bg-white',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 bg-white',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-soft hover:shadow-medium focus:ring-red-500',
    mystical: 'bg-gradient-to-r from-mystical-purple-700 to-mystical-purple-900 hover:from-mystical-purple-600 hover:to-mystical-purple-800 text-mystical-gold-500 shadow-mystical-soft hover:shadow-mystical-medium focus:ring-mystical-gold-700 border border-mystical-gold-700/30',
    gold: 'bg-gradient-to-r from-mystical-gold-700 to-mystical-gold-600 hover:from-mystical-gold-600 hover:to-mystical-gold-500 text-mystical-purple-950 shadow-gold-glow hover:shadow-gold-glow-lg font-bold focus:ring-mystical-gold-500',
  }
  
  const sizes = {
    xs: 'px-3 py-1.5 text-xs',
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
    xl: 'px-10 py-5 text-xl'
  }
  
  const widthClass = fullWidth ? 'w-full' : ''
  const isDisabled = disabled || loading
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  )
}