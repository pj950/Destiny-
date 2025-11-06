import { ReactNode } from 'react'

interface HeadingProps {
  children: ReactNode
  level?: 1 | 2 | 3 | 4 | 5 | 6
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl'
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold'
  gradient?: boolean
  className?: string
}

export default function Heading({ 
  children, 
  level = 2, 
  size,
  weight = 'bold',
  gradient = false,
  className = '',
}: HeadingProps) {
  const defaultSizes = {
    1: 'text-4xl md:text-6xl',
    2: 'text-3xl md:text-5xl',
    3: 'text-2xl md:text-4xl',
    4: 'text-xl md:text-3xl',
    5: 'text-lg md:text-2xl',
    6: 'text-base md:text-lg'
  }
  
  const weights = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
  }
  
  const gradientClasses = gradient 
    ? 'bg-gradient-to-r from-brand-primary-300 via-brand-secondary-300 to-brand-accent-300 bg-clip-text text-transparent'
    : 'text-gray-900 dark:text-white'
  
  const finalSize = size || defaultSizes[level]
  const combinedClassName = `${weights[weight]} ${finalSize} ${gradientClasses} ${className} animate-slide-up`
  
  if (level === 1) {
    return <h1 className={combinedClassName}>{children}</h1>
  } else if (level === 2) {
    return <h2 className={combinedClassName}>{children}</h2>
  } else if (level === 3) {
    return <h3 className={combinedClassName}>{children}</h3>
  } else if (level === 4) {
    return <h4 className={combinedClassName}>{children}</h4>
  } else if (level === 5) {
    return <h5 className={combinedClassName}>{children}</h5>
  } else {
    return <h6 className={combinedClassName}>{children}</h6>
  }
}