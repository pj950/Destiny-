import React, { useState, useEffect } from 'react'
import { Container, Section, Heading } from '../components/ui'
import { SubscriptionActions } from '../components/subscription'
import { UserSubscription, SubscriptionTier } from '../types/database'

export default function SubscriptionActionsDemo() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<SubscriptionTier>('basic')
  const userId = 'demo-user-123'

  // Create a mock subscription for demo
  useEffect(() => {
    const mockSubscription: UserSubscription = {
      id: 'mock-sub-1',
      user_id: userId,
      tier,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      auto_renew: true,
      external_subscription_id: null,
      payment_method: 'stripe',
      cancel_at: null,
      canceled_at: null,
      metadata: null,
      stripe_customer_id: 'cus_demo123',
      stripe_subscription_id: 'sub_demo123',
      external_payment_id: 'pi_demo123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    setSubscription(mockSubscription)
    setLoading(false)
  }, [tier])

  const handleSubscriptionChange = () => {
    console.log('[Demo] Subscription changed, reloading...')
    // In real app, this would refetch subscription data
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-mystical-purple-950 via-mystical-purple-900 to-mystical-purple-950">
      <Container>
        <Section className="py-12">
          <div className="text-center mb-12">
            <Heading level={1} className="mb-4">
              订阅管理演示
            </Heading>
            <p className="text-mystical-gold-600/80 text-lg">
              SubscriptionActions 组件功能展示
            </p>
          </div>

          {/* Tier Selector for Demo */}
          <div className="max-w-2xl mx-auto mb-8 bg-mystical-purple-900/50 border border-mystical-gold-700/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-mystical-gold-400 mb-4">
              选择当前订阅等级（演示用）:
            </h3>
            <div className="flex flex-wrap gap-3">
              {(['free', 'basic', 'premium', 'vip'] as SubscriptionTier[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    tier === t
                      ? 'bg-mystical-gold-600 text-mystical-purple-950'
                      : 'bg-mystical-purple-950/50 text-mystical-gold-500 hover:bg-mystical-purple-950'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* SubscriptionActions Component */}
          <div className="max-w-2xl mx-auto">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-8 w-8 text-mystical-gold-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span className="text-mystical-gold-500 font-semibold">
                    加载中...
                  </span>
                </div>
              </div>
            ) : subscription ? (
              <SubscriptionActions
                subscription={subscription}
                userId={userId}
                onSubscriptionChange={handleSubscriptionChange}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-red-400">无法加载订阅信息</p>
              </div>
            )}
          </div>

          {/* Usage Notes */}
          <div className="max-w-4xl mx-auto mt-12 bg-mystical-purple-900/50 border border-mystical-gold-700/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-mystical-gold-400 mb-4">
              📝 功能说明
            </h3>
            <ul className="space-y-2 text-mystical-gold-500">
              <li className="flex items-start">
                <span className="mr-2">✅</span>
                <span>
                  <strong>升级流程:</strong> 点击升级按钮 → 确认对话框显示价格差异 →
                  调用 checkout API → 跳转到 Razorpay 支付页面
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✅</span>
                <span>
                  <strong>取消流程:</strong> 点击取消订阅 → 显示功能损失警告 →
                  选择立即/期末取消 → 调用 cancel API
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✅</span>
                <span>
                  <strong>续期设置:</strong> Toggle 开关切换自动续费 → 立即调用
                  update API → 显示成功提示
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✅</span>
                <span>
                  <strong>错误处理:</strong> API 调用失败时显示错误消息和重试提示
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✅</span>
                <span>
                  <strong>加载状态:</strong> 所有操作都有相应的加载指示器
                </span>
              </li>
            </ul>
          </div>
        </Section>
      </Container>
    </div>
  )
}
