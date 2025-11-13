import { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { Section, Container, Heading, Text, Button, Card } from '../components/ui'
import {
  PlansSection,
  SubscriptionStatusCard,
  QuotaSection,
  SubscriptionActions,
} from '../components/subscription'
import { SUBSCRIPTION_PLANS } from '../lib/subscription'
import type { SubscriptionStatusData } from '../components/subscription/SubscriptionStatusCard'
import type { QuotaSectionData } from '../components/subscription/QuotaSection'
import type { SubscriptionTier, UserSubscription } from '../types/database'

const DEMO_USER_ID = 'demo-user-123'

interface QuickAction {
  title: string
  description: string
  icon: string
  href: string
  locked: boolean
}

const FEATURE_HIGHLIGHTS = [
  {
    title: '📊 流年分析',
    description: '从基础月度趋势到 VIP 深度预测，随时掌握未来走向。',
  },
  {
    title: '🤖 AI 问答',
    description: '智能命理顾问实时解答疑问，额度随套餐升级而增加。',
  },
  {
    title: '📄 专业导出',
    description: '支持 PDF / Excel 等多种格式导出，方便收藏与分享。',
  },
  {
    title: '👨‍👩‍👧‍👦 家人对比',
    description: 'Premium 及以上套餐可对比家人命盘，助力家庭决策。',
  },
]

const FAQ_ITEMS = [
  {
    question: '如何升级或取消订阅？',
    answer:
      '登录后，在页面上方的「订阅操作」区域即可一键升级、降级或取消。所有操作都会立即生效，并通过邮件同步确认。',
  },
  {
    question: '免费用户能看到哪些内容？',
    answer:
      '即使处于免费套餐，也可以查看当前配额使用情况、体验年度流年报告与基础问答。当额度不足时，系统会提示并指引升级。',
  },
  {
    question: '升级后多久生效？',
    answer:
      '升级成功后新的配额与高级功能会即时解锁，无需等待下个周期。历史数据也会自动保留，方便接续使用。',
  },
  {
    question: '支付遇到问题怎么办？',
    answer:
      '若支付失败或遇到扣款问题，请联系 support@easterndestiny.com，我们会在 1 个工作日内协助处理，确保服务不中断。',
  },
]

export default function Pricing() {
  const [userId, setUserId] = useState<string | null>(null)
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionStatusData | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const isAuthenticated = Boolean(userId)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedId = window.localStorage.getItem('demo_user_id')
    if (storedId) {
      setUserId(storedId)
    }
  }, [])

  const fetchSubscription = useCallback(async () => {
    if (!userId) return
    try {
      setLoadingSubscription(true)
      setSubscriptionError(null)

      const response = await fetch(`/api/subscriptions/current?user_id=${userId}`)
      if (response.status === 404) {
        setSubscriptionData(null)
        return
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.ok) {
        throw new Error(result.error || 'Failed to fetch subscription data')
      }

      setSubscriptionData(result.data ?? null)
    } catch (error) {
      console.error('[Pricing] Failed to load subscription:', error)
      setSubscriptionError(error instanceof Error ? error.message : '加载订阅信息失败')
      setSubscriptionData(null)
    } finally {
      setLoadingSubscription(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setSubscriptionData(null)
      setSubscriptionError(null)
      setLoadingSubscription(false)
      return
    }

    fetchSubscription()
  }, [userId, fetchSubscription, refreshToken])

  const refreshSubscription = useCallback(() => {
    setRefreshToken(prev => prev + 1)
  }, [])

  const handleSubscriptionChange = useCallback(() => {
    refreshSubscription()
  }, [refreshSubscription])

  const scrollToPlans = useCallback(() => {
    if (typeof window === 'undefined') return
    const plansSection = document.getElementById('plans')
    if (plansSection) {
      plansSection.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.location.hash = 'plans'
    }
  }, [])

  const handleToggleAuth = useCallback(() => {
    if (typeof window === 'undefined') return
    if (userId) {
      window.localStorage.removeItem('demo_user_id')
      setUserId(null)
      setSubscriptionData(null)
      setSubscriptionError(null)
      setLoadingSubscription(false)
      return
    }

    window.localStorage.setItem('demo_user_id', DEMO_USER_ID)
    setUserId(DEMO_USER_ID)
    setSubscriptionData(null)
    setSubscriptionError(null)
  }, [userId])

  const currentTier: SubscriptionTier | null = subscriptionData
    ? subscriptionData.tier
    : userId
    ? 'free'
    : null

  const quotaData = useMemo<QuotaSectionData | null>(() => {
    if (!subscriptionData) return null
    const plan = SUBSCRIPTION_PLANS[subscriptionData.tier]

    return {
      tier: subscriptionData.tier,
      quota: {
        yearly_flow: {
          used: subscriptionData.quota.yearly_flow.used,
          limit: subscriptionData.quota.yearly_flow.limit,
          reset_at: subscriptionData.quota.yearly_flow.reset_at,
        },
        qa: {
          used: subscriptionData.quota.qa.used,
          limit: subscriptionData.quota.qa.limit,
          reset_at: subscriptionData.quota.qa.reset_at,
        },
      },
      limits: {
        yearly_flow: plan.features.yearly_flow.limit ?? null,
        qa: plan.features.qa.limit ?? null,
      },
    }
  }, [subscriptionData])

  const subscriptionRecord = useMemo<UserSubscription | null>(() => {
    if (!userId || !subscriptionData?.subscription) {
      return null
    }

    const detail = subscriptionData.subscription

    return {
      id: `${userId}-active-subscription`,
      user_id: userId,
      tier: subscriptionData.tier,
      status: detail.status,
      current_period_start: detail.current_period_start,
      current_period_end: detail.current_period_end,
      auto_renew: detail.auto_renew,
      external_subscription_id: null,
      payment_method: 'razorpay',
      cancel_at: detail.cancel_at,
      canceled_at: null,
      metadata: null,
      created_at: detail.current_period_start,
      updated_at: detail.current_period_end,
    }
  }, [subscriptionData, userId])

  const quickActions = useMemo<QuickAction[]>(() => {
    const plan = SUBSCRIPTION_PLANS[subscriptionData?.tier ?? 'free']
    const yearly = subscriptionData?.quota.yearly_flow
    const qa = subscriptionData?.quota.qa

    const yearlyDescription = plan.features.yearly_flow.enabled
      ? yearly
        ? yearly.limit === null
          ? '无限额度，随时生成'
          : `本月已用 ${yearly.used}/${yearly.limit}`
        : '生成年度运势解读'
      : '升级即可解锁年度运势报告'

    const qaDescription = plan.features.qa.enabled
      ? qa
        ? qa.limit === null
          ? '无限问答额度'
          : `剩余 ${Math.max(qa.limit - qa.used, 0)} 次`
        : '升级即可开始与 AI 对话'
      : '升级即可开启 AI 智能问答'

    const exportDescription = plan.features.export.enabled
      ? `支持 ${plan.features.export.formats.map(format => format.toUpperCase()).join(' / ')} 导出`
      : '升级以开启报告导出功能'

    const familyDescription = plan.features.family_comparison
      ? '对比家人命盘，洞察家庭关系'
      : 'Premium 及以上计划可用'

    return [
      {
        title: '生成流年报告',
        description: yearlyDescription,
        icon: '🧭',
        href: plan.features.yearly_flow.enabled ? '/reports/yearly-flow' : '#plans',
        locked: !plan.features.yearly_flow.enabled,
      },
      {
        title: 'AI 智能问答',
        description: qaDescription,
        icon: '🤖',
        href: plan.features.qa.enabled ? '/fortune' : '#plans',
        locked: !plan.features.qa.enabled,
      },
      {
        title: '导出报告',
        description: exportDescription,
        icon: '📄',
        href: plan.features.export.enabled ? '/reports/yearly-flow' : '#plans',
        locked: !plan.features.export.enabled,
      },
      {
        title: '家人对比',
        description: familyDescription,
        icon: '👨‍👩‍👧‍👦',
        href: plan.features.family_comparison ? '/tools' : '#plans',
        locked: !plan.features.family_comparison,
      },
    ]
  }, [subscriptionData])

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      if (typeof window === 'undefined') return

      if (action.locked) {
        scrollToPlans()
        return
      }

      if (action.href.startsWith('#')) {
        const target = document.querySelector(action.href)
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' })
        } else {
          window.location.href = action.href
        }
        return
      }

      window.location.href = action.href
    },
    [scrollToPlans],
  )

  const statusLoading = loadingSubscription && !subscriptionData && !subscriptionError
  const quotaLoading = loadingSubscription && !quotaData && !subscriptionError

  return (
    <div className="min-h-screen flex flex-col bg-mystical-purple-950">
      <Navbar />
      <main className="flex-1">
        <Section background="mystical" className="pt-24 pb-16">
          <Container size="lg">
            <div className="text-center space-y-6">
              <Heading level={1} gradient className="mb-2">
                订阅计划
              </Heading>
              <Text size="xl" className="max-w-3xl mx-auto text-mystical-gold-400">
                将价格展示与订阅管理融为一体，随时了解当前状态并升级体验。
              </Text>
              <Text size="lg" className="max-w-2xl mx-auto text-mystical-gold-600/80">
                从免费体验到 VIP 专属，全套八字命理能力一站掌握。
              </Text>
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-2">
                <Button variant="gold" size="lg" onClick={scrollToPlans}>
                  浏览所有方案
                </Button>
                <Button variant="mystical" size="lg" onClick={handleToggleAuth}>
                  {isAuthenticated ? '退出演示登录' : '模拟登录体验管理功能'}
                </Button>
              </div>
              <Text size="sm" className="text-mystical-gold-600/70">
                {isAuthenticated ? `当前体验账号：${userId}` : '未登录状态下仅展示公开的订阅与价格信息'}
              </Text>
            </div>
          </Container>
        </Section>

        {isAuthenticated && (
          <Section background="mystical-dark" spacing="spacious">
            <Container size="xl">
              <div className="space-y-12">
                <div className="grid gap-8 lg:grid-cols-[1.7fr_1.3fr]">
                  <SubscriptionStatusCard
                    userId={userId!}
                    initialData={subscriptionData ?? null}
                    loading={statusLoading}
                    className="h-full"
                  />

                  <Card variant="mystical" className="p-6 h-full border border-mystical-gold-700/30">
                    <Heading level={3} className="text-mystical-gold-400 mb-4">
                      快速操作
                    </Heading>
                    <div className="space-y-4">
                      {quickActions.map(action => (
                        <div
                          key={action.title}
                          className="rounded-xl border border-mystical-gold-700/20 bg-mystical-purple-950/40 p-4"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex gap-3">
                              <span className="text-2xl leading-none">{action.icon}</span>
                              <div>
                                <p className="text-mystical-gold-400 font-semibold mb-1">{action.title}</p>
                                <p className="text-sm text-mystical-gold-600/80">{action.description}</p>
                              </div>
                            </div>
                            <Button
                              variant={action.locked ? 'gold' : 'mystical'}
                              size="sm"
                              className="sm:shrink-0"
                              onClick={() => handleQuickAction(action)}
                            >
                              {action.locked ? '升级解锁' : '立即前往'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {subscriptionError && (
                  <Card variant="mystical" className="p-6 border border-red-500/30">
                    <Text className="text-red-400 text-sm mb-4">加载订阅信息失败：{subscriptionError}</Text>
                    <Button variant="gold" size="sm" onClick={refreshSubscription}>
                      重试加载
                    </Button>
                  </Card>
                )}

                <QuotaSection
                  userId={userId ?? undefined}
                  initialData={quotaData ?? null}
                  loading={quotaLoading}
                  className="mt-2"
                />

                {subscriptionRecord && (
                  <div className="space-y-4">
                    <Heading level={3} className="text-mystical-gold-400">
                      订阅操作
                    </Heading>
                    <div className="max-w-3xl">
                      <SubscriptionActions
                        subscription={subscriptionRecord}
                        userId={userId!}
                        onSubscriptionChange={handleSubscriptionChange}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Container>
          </Section>
        )}

        <Section background="mystical-dark" spacing="spacious" id="plans">
          <Container size="xl">
            <div className="text-center mb-12">
              <Heading level={2} className="text-mystical-gold-400 mb-4">
                选择适合您的计划
              </Heading>
              <Text size="lg" className="text-mystical-gold-600/80 max-w-3xl mx-auto">
                根据所需功能和配额自由选择，随时升级或降级，所有变化都会即时同步。
              </Text>
            </div>
            <PlansSection
              userId={userId ?? undefined}
              currentTier={currentTier ?? undefined}
              className="mt-8"
            />
          </Container>
        </Section>

        <Section background="mystical">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {FEATURE_HIGHLIGHTS.map(item => (
                <Card key={item.title} variant="mystical" className="p-6 border border-mystical-gold-700/30">
                  <p className="text-lg font-semibold text-mystical-gold-400 mb-2">{item.title}</p>
                  <Text size="sm" className="text-mystical-gold-600/80 leading-relaxed">
                    {item.description}
                  </Text>
                </Card>
              ))}
            </div>
          </Container>
        </Section>

        <Section background="mystical-gradient" id="faq">
          <Container size="md">
            <div className="text-center mb-12">
              <Heading level={2} className="text-mystical-gold-400 mb-4">
                常见问题
              </Heading>
              <Text size="lg" className="text-mystical-gold-600/80">
                关于订阅管理的常见解答
              </Text>
            </div>
            <div className="space-y-6">
              {FAQ_ITEMS.map(item => (
                <Card key={item.question} variant="mystical" className="p-6 border border-mystical-gold-700/20">
                  <Heading level={3} className="text-mystical-gold-400 mb-3">
                    {item.question}
                  </Heading>
                  <Text className="text-mystical-gold-600/80 leading-relaxed">{item.answer}</Text>
                </Card>
              ))}
            </div>
          </Container>
        </Section>

        <Section background="mystical">
          <Container>
            <Card variant="mystical-gold" className="p-10 text-center border border-mystical-gold-600/60">
              <Heading level={2} className="text-mystical-purple-950 mb-4">
                准备好升级体验了吗？
              </Heading>
              <Text className="text-mystical-purple-900/80 mb-6">
                立即选择适合的订阅方案，解锁更全面的八字洞察与智能服务。
              </Text>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="gold" size="lg" onClick={scrollToPlans}>
                  查看订阅计划
                </Button>
                <Button variant="mystical" size="lg" onClick={handleToggleAuth}>
                  {isAuthenticated ? '退出演示登录' : '模拟登录体验'}
                </Button>
              </div>
            </Card>
          </Container>
        </Section>
      </main>
      <Footer />
    </div>
  )
}
