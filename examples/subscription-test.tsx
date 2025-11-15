import type { NextPage } from 'next'
import Head from 'next/head'
import SubscriptionStatusCard from '../components/subscription/SubscriptionStatusCard'

const SubscriptionTestPage: NextPage = () => {
  // For testing purposes, using a test user ID
  // In a real app, this would come from authentication
  const testUserId = 'test-user-123'

  return (
    <>
      <Head>
        <title>订阅状态测试 - 东方命理</title>
        <meta name="description" content="订阅状态卡片组件测试页面" />
      </Head>

      <main className="min-h-screen bg-gradient-to-br from-mystical-purple-950 via-mystical-cyan-950 to-mystical-purple-950">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-serif text-mystical-gold-400 text-center mb-8">
            订阅状态卡片测试
          </h1>
          
          <div className="max-w-2xl mx-auto">
            <SubscriptionStatusCard userId={testUserId} />
          </div>
        </div>
      </main>
    </>
  )
}

export default SubscriptionTestPage