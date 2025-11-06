import { ReactNode } from 'react'

interface SectionProps {
  children: ReactNode
  className?: string
  background?: 'white' | 'gray' | 'gradient' | 'dark' | 'brand'
  id?: string
  spacing?: 'compact' | 'normal' | 'spacious'
}

export default function Section({ 
  children, 
  className = '', 
  background = 'white', 
  id,
  spacing = 'normal'
}: SectionProps) {
  const backgrounds = {
    white: 'bg-white',
    gray: 'bg-gray-50',
    gradient: 'bg-gradient-to-br from-brand-primary-50 via-brand-secondary-50 to-brand-accent-50',
    dark: 'bg-gradient-to-br from-gray-900 via-brand-primary-900 to-brand-secondary-900 text-white',
    brand: 'bg-gradient-to-br from-brand-primary-500 to-brand-secondary-600 text-white'
  }
  
  const spacings = {
    compact: 'py-12 md:py-16',
    normal: 'py-16 md:py-24',
    spacious: 'py-20 md:py-32'
  }
  
  return (
    <section 
      id={id} 
      className={`${spacings[spacing]} ${backgrounds[background]} ${className} animate-fade-in`}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </section>
  )
}