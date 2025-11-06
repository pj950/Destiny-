import { ReactNode } from 'react'
import Link from 'next/link'

interface FooterProps {
  children?: ReactNode
}

export default function Footer({ children }: FooterProps) {
  const currentYear = new Date().getFullYear()
  
  const footerLinks = {
    product: [
      { name: '八字排盘', href: '/' },
      { name: 'AI解读', href: '/' },
      { name: '深度报告', href: '/pricing' },
      { name: '使用工具', href: '/tools' },
    ],
    company: [
      { name: '关于我们', href: '#' },
      { name: '联系方式', href: '#' },
      { name: '隐私政策', href: '#' },
      { name: '服务条款', href: '#' },
    ],
    resources: [
      { name: '命理知识', href: '#' },
      { name: '使用指南', href: '#' },
      { name: '常见问题', href: '/pricing#faq' },
      { name: '客户支持', href: '#' },
    ]
  }
  
  const socialLinks = [
    { name: '微信', icon: '💬', href: '#' },
    { name: '微博', icon: '📱', href: '#' },
    { name: '邮箱', icon: '📧', href: 'mailto:contact@example.com' },
  ]
  
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Brand Section */}
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-2 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-brand-primary-500 to-brand-secondary-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">命</span>
                </div>
                <span className="text-2xl font-bold">东方命理</span>
              </div>
              <p className="text-gray-400 mb-6 leading-relaxed">
                结合千年东方智慧与现代AI技术，为您提供专业、准确、值得信赖的命理分析服务。
              </p>
              <div className="flex space-x-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    className="w-10 h-10 bg-gray-800 hover:bg-brand-primary-600 rounded-lg flex items-center justify-center transition-colors duration-200"
                    aria-label={social.name}
                  >
                    <span className="text-lg">{social.icon}</span>
                  </a>
                ))}
              </div>
            </div>
            
            {/* Product Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4">产品服务</h3>
              <ul className="space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.name}>
                    <Link 
                      href={link.href}
                      className="text-gray-400 hover:text-brand-primary-400 transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Company Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4">公司</h3>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.name}>
                    <a 
                      href={link.href}
                      className="text-gray-400 hover:text-brand-primary-400 transition-colors duration-200"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Resources Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4">资源</h3>
              <ul className="space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link.name}>
                    <Link 
                      href={link.href}
                      className="text-gray-400 hover:text-brand-primary-400 transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        
        {/* Bottom Section */}
        <div className="border-t border-gray-800 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-400 text-sm">
              © {currentYear} 东方命理. 保留所有权利.
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <a href="#" className="hover:text-brand-primary-400 transition-colors">
                隐私政策
              </a>
              <a href="#" className="hover:text-brand-primary-400 transition-colors">
                服务条款
              </a>
              <a href="#" className="hover:text-brand-primary-400 transition-colors">
                Cookie设置
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}