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
    { name: '每日一签', path: '/fortune' },
    { name: '祈福点灯', path: '/lamps' },
    { name: '订阅计划', path: '/pricing' },
  ]
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-mystical-purple-950/95 to-mystical-cyan-950/80 backdrop-blur-md border-b border-mystical-gold-700/30 shadow-mystical-medium">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-mystical-gold-700 to-mystical-gold-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform group-hover:shadow-gold-glow">
              <span className="text-mystical-purple-950 font-bold text-sm">命</span>
            </div>
            <span className="text-xl font-bold text-mystical-gold-500 group-hover:text-mystical-gold-400 transition-colors">
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
                    ? 'text-mystical-gold-400'
                    : 'text-mystical-gold-600 hover:text-mystical-gold-400'
                }`}
              >
                {item.name}
                {isActive(item.path) && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-mystical-gold-700 to-mystical-gold-600 rounded-full animate-slide-up shadow-gold-glow" />
                )}
              </Link>
            ))}
          </div>
          
          {/* CTA Button */}
          <div className="hidden md:block">
            <Link href="/">
              <button className="bg-gradient-to-r from-mystical-gold-700 to-mystical-gold-600 text-mystical-purple-950 px-6 py-2 rounded-xl text-sm font-semibold hover:shadow-gold-glow-lg transform hover:-translate-y-0.5 transition-all duration-200">
                免费试算
              </button>
            </Link>
          </div>
          
          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button className="p-2 rounded-lg text-mystical-gold-600 hover:bg-mystical-purple-900/50">
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
