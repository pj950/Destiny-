import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import PlanCard from './PlanCard'
import type { SubscriptionPlan } from '../../lib/subscription'
import type { SubscriptionTier } from '../../types/database'

interface PlansSectionProps {
  userId?: string
  onSelectPlan?: (planId: SubscriptionTier) => void
  className?: string
}

export default function PlansSection({
  userId,
  onSelectPlan,
  className = ''
}: PlansSectionProps) {
  const router = useRouter()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentPlan, setCurrentPlan] = useState<SubscriptionTier | null>(null)
  const [isBillingMonthly, setIsBillingMonthly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState<SubscriptionTier | null>(null)

  // Fetch plans
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/subscriptions/plans')
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (!result.ok) {
          throw new Error(result.error || 'Failed to fetch plans')
        }
        
        setPlans(result.data)
      } catch (err) {
        console.error('[PlansSection] Error fetching plans:', err)
        setError(err instanceof Error ? err.message : 'Failed to load plans')
      } finally {
        setLoading(false)
      }
    }

    fetchPlans()
  }, [])

  // Fetch current subscription
  useEffect(() => {
    if (!userId) return

    const fetchCurrentSubscription = async () => {
      try {
        const response = await fetch(`/api/subscriptions/current?user_id=${userId}`)
        
        if (!response.ok) {
          console.warn('Failed to fetch current subscription')
          return
        }
        
        const result = await response.json()
        
        if (result.ok && result.data?.tier) {
          setCurrentPlan(result.data.tier)
        }
      } catch (err) {
        console.error('[PlansSection] Error fetching current subscription:', err)
      }
    }

    fetchCurrentSubscription()
  }, [userId])

  const handleUpgrade = async (planId: SubscriptionTier) => {
    if (planId === 'free') {
      router.push('/')
      return
    }

    if (onSelectPlan) {
      onSelectPlan(planId)
      return
    }

    // Default behavior: call checkout API and redirect to Stripe
    try {
      setUpgradeLoading(planId)
      
      // Find the plan details
      const plan = plans.find(p => p.id === planId)
      if (!plan) {
        alert('计划不存在')
        return
      }

      // Call checkout API
      const billingCycle = isBillingMonthly ? 'monthly' : 'yearly'
      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: planId,
          billing_cycle: billingCycle,
          user_id: userId || 'demo-user',
          customer_email: 'demo@example.com', // In production, use real user email
        }),
      })

      const result = await response.json()

      if (!result.ok || !result.url) {
        throw new Error(result.error || 'Failed to create checkout')
      }

      // Redirect to Stripe Checkout
      window.location.href = result.url
    } catch (err) {
      console.error('[PlansSection] Error handling upgrade:', err)
      alert('升级失败，请稍后重试')
      setUpgradeLoading(null)
    }
  }

  if (loading) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="inline-flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-mystical-gold-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-mystical-gold-500 font-semibold">加载中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-red-500 font-semibold">无法加载计划：{error}</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Billing Toggle */}
      <div className="flex justify-center items-center gap-4 mb-12">
        <span className={`text-sm font-medium ${isBillingMonthly ? 'text-mystical-gold-400' : 'text-mystical-gold-600/80'}`}>
          按月计费
        </span>
        <button
          onClick={() => setIsBillingMonthly(!isBillingMonthly)}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
            isBillingMonthly 
              ? 'bg-mystical-gold-700' 
              : 'bg-mystical-gold-600'
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-mystical-purple-950 transition-transform ${
              isBillingMonthly ? 'translate-x-1' : 'translate-x-7'
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${!isBillingMonthly ? 'text-mystical-gold-400' : 'text-mystical-gold-600/80'}`}>
          按年计费
          <span className="ml-2 inline-block bg-mystical-gold-700/30 text-mystical-gold-400 text-xs px-2 py-1 rounded-full">
            省15%
          </span>
        </span>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={currentPlan === plan.id}
            isBillingMonthly={isBillingMonthly}
            onUpgrade={() => handleUpgrade(plan.id)}
            loading={upgradeLoading === plan.id}
          />
        ))}
      </div>

      {/* Additional Info */}
      <div className="mt-12 text-center">
        <p className="text-mystical-gold-600/80 text-sm">
          💳 支持所有主流支付方式 | 🔒 交易加密保护 | ✨ 随时取消订阅
        </p>
      </div>
    </div>
  )
}
