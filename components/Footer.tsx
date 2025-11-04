import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl">🌟</span>
              <span className="text-xl font-bold bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
                Eastern Destiny
              </span>
            </div>
            <p className="text-sm text-gray-400 max-w-md">
              探索古老东方智慧，揭示命运奥秘。结合传统八字命理与现代AI技术，为您提供精准的命运解读。
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">快速链接</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm hover:text-yellow-300 transition-colors">
                  首页
                </Link>
              </li>
              <li>
                <Link href="/tools" className="text-sm hover:text-yellow-300 transition-colors">
                  占卜工具
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm hover:text-yellow-300 transition-colors">
                  价格方案
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm hover:text-yellow-300 transition-colors">
                  我的命盘
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">关于</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm hover:text-yellow-300 transition-colors">
                  关于我们
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-yellow-300 transition-colors">
                  联系方式
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-yellow-300 transition-colors">
                  隐私政策
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-yellow-300 transition-colors">
                  服务条款
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Eastern Destiny. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
