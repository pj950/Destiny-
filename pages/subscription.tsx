import React, { useState, useEffect } from 'react'
import { Container, Section, Heading, Text } from '../components/ui'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { 
  SubscriptionStatusCard, 
  QuotaSection, 
  PlansSection, 
  SubscriptionActions 
} from '@/features/subscriptions/components'
import { UserSubscription, SubscriptionTier } from '../types/database'

export default function SubscriptionManagement() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // For demo purposes, using a test user ID
  // In a real app, this would come from authentication
  const userId = 'demo-user-123'

  // Fetch subscription data
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/subscriptions/current?user_id=${userId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            // User has no subscription (free tier)
            setSubscription(null)
            return
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (!result.ok) {
          throw new Error(result.error || 'Failed to fetch subscription')
        }
        
        setSubscription(result.data.subscription)
      } catch (err) {
        console.error('[SubscriptionManagement] Error:', err)
        // For demo purposes, create a mock subscription if API fails
        const mockSubscription: UserSubscription = {
          id: 'mock-sub-1',
          user_id: userId,
          tier: 'basic' as SubscriptionTier,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          auto_renew: true,
          external_subscription_id: null,
          payment_method: 'stripe',
          cancel_at: null,
          canceled_at: null,
          metadata: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          external_payment_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setSubscription(mockSubscription)
      } finally {
        setLoading(false)
      }
    }

    fetchSubscription()
  }, [refreshKey, userId])

  // Handle subscription changes (upgrade, cancel, etc.)
  const handleSubscriptionChange = () => {
    console.log('[SubscriptionManagement] Subscription changed, refreshing...')
    setRefreshKey(prev => prev + 1)
  }

  // Handle plan selection from PlansSection
  const handlePlanSelect = (planId: SubscriptionTier) => {
    console.log('[SubscriptionManagement] Plan selected:', planId)
    // For paid plans, this would typically trigger the upgrade flow through SubscriptionActions
    // For free plan, navigate to home
    if (planId === 'free') {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Page Header */}
      <Section background="mystical" className="pt-20">
        <Container>
          <div className="text-center">
            <Heading level={1} gradient className="mb-4">
              订阅管理
            </Heading>
            <Text size="xl" className="max-w-2xl mx-auto text-mystical-gold-400">
              管理您的订阅计划、查看使用配额、升级或取消服务
            </Text>
          </div>
        </Container>
      </Section>

      {/* Main Content */}
      <Section background="mystical-dark">
        <Container size="xl">
          {loading ? (
            <div className="text-center py-16">
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
          ) : (
            <div className="space-y-12">
              {/* 1. Current Subscription Area */}
              <div>
                <Heading level={2} className="mb-6 text-mystical-gold-400">
                  当前订阅状态
                </Heading>
                <div className="max-w-4xl mx-auto">
                  <SubscriptionStatusCard userId={userId} />
                </div>
              </div>

              {/* 2. Feature Quota Area */}
              <div>
                <Heading level={2} className="mb-6 text-mystical-gold-400">
                  功能配额
                </Heading>
                <QuotaSection userId={userId} />
              </div>

              {/* 3. Subscription Plans Area */}
              <div>
                <Heading level={2} className="mb-6 text-mystical-gold-400">
                  订阅计划
                </Heading>
                <PlansSection 
                  userId={userId}
                  onSelectPlan={handlePlanSelect}
                />
              </div>

              {/* 4. Subscription Actions (integrated for users with active subscriptions) */}
              {subscription && subscription.tier !== 'free' && (
                <div>
                  <Heading level={2} className="mb-6 text-mystical-gold-400">
                    订阅操作
                  </Heading>
                  <div className="max-w-2xl mx-auto">
                    <SubscriptionActions
                      subscription={subscription}
                      userId={userId}
                      onSubscriptionChange={handleSubscriptionChange}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </Container>
      </Section>

      <Footer />
    </div>
  )
}
