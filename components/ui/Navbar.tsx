import { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

interface NavbarProps {
  children?: ReactNode
}

export default function Navbar({ children }: NavbarProps) {
  const router = useRouter()
  
  const isActive = (path: string) => router.pathname === path
  
  const navItems = [
    { name: '首页', path: '/' },
    { name: '工具', path: '/tools' },
    { name: '价格', path: '/pricing' },
  ]
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-primary-500 to-brand-secondary-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-white font-bold text-sm">命</span>
            </div>
            <span className="text-xl font-bold text-gray-900 group-hover:text-brand-primary-600 transition-colors">
              东方命理
            </span>
          </Link>
          
          {/* Navigation Items */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'text-brand-primary-600'
                    : 'text-gray-700 hover:text-brand-primary-600'
                }`}
              >
                {item.name}
                {isActive(item.path) && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary-600 rounded-full animate-slide-up" />
                )}
              </Link>
            ))}
          </div>
          
          {/* CTA Button */}
          <div className="hidden md:block">
            <Link href="/">
              <button className="bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:shadow-medium transform hover:-translate-y-0.5 transition-all duration-200">
                免费试算
              </button>
            </Link>
          </div>
          
          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button className="p-2 rounded-lg text-gray-700 hover:bg-gray-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}