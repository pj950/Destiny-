// 示例：如何在页面中集成订阅状态卡片
// 这个文件展示了在现有页面中使用 SubscriptionStatusCard 的方法

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Card from '../components/Card'
import { SubscriptionStatusCard } from '../components/subscription'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// 模拟获取用户ID的函数 - 在实际应用中，这会从认证系统获取
const getCurrentUserId = () => {
  // 这里应该从你的认证系统（如Supabase Auth、NextAuth等）获取用户ID
  // 为了示例，我们返回一个测试ID
  return 'test-user-123'
}

export default function DashboardWithSubscription() {
  const { data: chartsData } = useSWR('/api/my/charts', fetcher)
  const [jobs, setJobs] = useState<Record<string, any>>({})
  const [polling, setPolling] = useState<Set<string>>(new Set())
  
  // 获取当前用户ID
  const userId = getCurrentUserId()

  const charts: any[] = chartsData?.charts || []

  // Fetch jobs for all charts
  useEffect(() => {
    if (!charts.length) return

    const fetchJobs = async () => {
      try {
        const response = await fetch('/api/my/jobs')
        const data = await response.json()
        
        if (data.ok) {
          setJobs(data.jobs || {})
        }
      } catch (error) {
        console.error('Failed to fetch jobs:', error)
      }
    }

    fetchJobs()
  }, [charts])

  return (
    <div className="min-h-screen bg-gradient-to-br from-mystical-purple-950 via-mystical-cyan-950 to-mystical-purple-950">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif text-mystical-gold-400 mb-4">
            我的命理仪表板
          </h1>
          <p className="text-mystical-gold-600">
            管理您的八字图表和订阅服务
          </p>
        </div>

        {/* 订阅状态卡片 - 新增 */}
        <div className="max-w-2xl mx-auto mb-8">
          <SubscriptionStatusCard userId={userId} />
        </div>

        {/* 其余内容 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 我的图表 */}
          <Card className="p-6">
            <h2 className="text-xl font-serif text-mystical-gold-400 mb-4">
              我的八字图表
            </h2>
            {charts.length > 0 ? (
              <div className="space-y-3">
                {charts.map((chart) => (
                  <div
                    key={chart.id}
                    className="p-3 bg-mystical-purple-800/30 rounded-lg border border-mystical-gold-700/20"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-mystical-gold-500">
                        图表 #{chart.id.slice(0, 8)}
                      </span>
                      <span className="text-mystical-gold-600 text-sm">
                        {new Date(chart.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-mystical-gold-600">
                您还没有创建任何八字图表
              </p>
            )}
            <div className="mt-4">
              <Link href="/compute">
                <button className="w-full bg-gradient-to-r from-mystical-gold-600 to-mystical-gold-500 text-mystical-purple-950 font-semibold py-2 px-4 rounded-lg hover:from-mystical-gold-700 hover:to-mystical-gold-600 transition-colors">
                  创建新图表
                </button>
              </Link>
            </div>
          </Card>

          {/* 快速操作 */}
          <Card className="p-6">
            <h2 className="text-xl font-serif text-mystical-gold-400 mb-4">
              快速操作
            </h2>
            <div className="space-y-3">
              <Link href="/reports/character">
                <button className="w-full bg-mystical-purple-800/50 text-mystical-gold-400 py-3 px-4 rounded-lg hover:bg-mystical-purple-700/50 transition-colors text-left">
                  性格分析报告
                </button>
              </Link>
              <Link href="/reports/yearly-flow">
                <button className="w-full bg-mystical-purple-800/50 text-mystical-gold-400 py-3 px-4 rounded-lg hover:bg-mystical-purple-700/50 transition-colors text-left">
                  年度流年运势
                </button>
              </Link>
              <Link href="/fortune">
                <button className="w-full bg-mystical-purple-800/50 text-mystical-gold-400 py-3 px-4 rounded-lg hover:bg-mystical-purple-700/50 transition-colors text-left">
                  每日一签
                </button>
              </Link>
              <Link href="/pricing">
                <button className="w-full bg-gradient-to-r from-mystical-gold-600 to-mystical-gold-500 text-mystical-purple-950 font-semibold py-3 px-4 rounded-lg hover:from-mystical-gold-700 hover:to-mystical-gold-600 transition-colors">
                  升级订阅
                </button>
              </Link>
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}