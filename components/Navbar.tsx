import Link from 'next/link'
import { useState } from 'react'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">🌟</span>
              <span className="text-xl font-bold bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
                Eastern Destiny
              </span>
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <Link href="/" className="hover:text-yellow-300 transition-colors px-3 py-2 rounded-md text-sm font-medium">
                首页
              </Link>
              <Link href="/tools" className="hover:text-yellow-300 transition-colors px-3 py-2 rounded-md text-sm font-medium">
                占卜工具
              </Link>
              <Link href="/pricing" className="hover:text-yellow-300 transition-colors px-3 py-2 rounded-md text-sm font-medium">
                价格
              </Link>
              <Link href="/dashboard" className="hover:text-yellow-300 transition-colors px-3 py-2 rounded-md text-sm font-medium">
                我的命盘
              </Link>
            </div>
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md hover:text-yellow-300 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-indigo-950/50 backdrop-blur-sm">
            <Link href="/" className="hover:text-yellow-300 block px-3 py-2 rounded-md text-base font-medium">
              首页
            </Link>
            <Link href="/tools" className="hover:text-yellow-300 block px-3 py-2 rounded-md text-base font-medium">
              占卜工具
            </Link>
            <Link href="/pricing" className="hover:text-yellow-300 block px-3 py-2 rounded-md text-base font-medium">
              价格
            </Link>
            <Link href="/dashboard" className="hover:text-yellow-300 block px-3 py-2 rounded-md text-base font-medium">
              我的命盘
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
