import React, { useState, useEffect } from 'react'
import QuotaCard from './QuotaCard'
import Button from '../ui/Button'
import { SUBSCRIPTION_PLANS } from '../../lib/subscription'
import type { SubscriptionTier } from '../../types/database'

interface QuotaData {
  tier: SubscriptionTier
  quota: {
    yearly_flow: { used: number; limit: number | null; reset_at?: string }
    qa: { used: number; limit: number | null; reset_at?: string }
  }
  limits: {
    yearly_flow: number | null
    qa: number | null
  }
}

interface QuotaSectionProps {
  userId: string
  className?: string
}

export default function QuotaSection({ userId, className = '' }: QuotaSectionProps) {
  const [data, setData] = useState<QuotaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchQuotaData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/subscriptions/quota?user_id=${userId}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (!result.ok) {
          throw new Error(result.error || 'Failed to fetch quota data')
        }
        
        setData(result.data)
      } catch (err) {
        console.error('[QuotaSection] Error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load quota data')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchQuotaData()
    }
  }, [userId])

  const handleUpgrade = () => {
    // Navigate to subscription page or open upgrade modal
    window.location.href = '/subscription'
  }

  const plan = data ? SUBSCRIPTION_PLANS[data.tier] : null

  const quotaFeatures = data && plan ? [
    {
      title: '性格简报',
      used: 0, // Not tracked in quota system
      limit: null,
      enabled: plan.features.character_profile,
      period: null,
      resetAt: null
    },
    {
      title: '流年报告',
      used: data.quota.yearly_flow.used,
      limit: data.quota.yearly_flow.limit,
      enabled: plan.features.yearly_flow.enabled,
      period: plan.features.yearly_flow.period,
      resetAt: data.quota.yearly_flow.reset_at
    },
    {
      title: '智能问答',
      used: data.quota.qa.used,
      limit: data.quota.qa.limit,
      enabled: plan.features.qa.enabled,
      period: plan.features.qa.period,
      resetAt: data.quota.qa.reset_at
    },
    {
      title: '家人对比',
      used: 0, // Not tracked in quota system
      limit: plan.features.family_comparison ? null : 0,
      enabled: plan.features.family_comparison,
      period: null,
      resetAt: null
    },
    {
      title: '导出报告',
      used: 0, // Not tracked in quota system
      limit: plan.features.export.enabled ? null : 0,
      enabled: plan.features.export.enabled,
      period: null,
      resetAt: null
    }
  ] : []

  return (
    <div className={className}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">功能配额</h2>
        <p className="text-gray-600">
          {data && plan ? `当前套餐: ${plan.name}` : '展示用户在各个功能上的配额使用情况'}
        </p>
      </div>
      
      {loading && (
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-xl h-32" />
            ))}
          </div>
        </div>
      )}
      
      {error && (
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>重试</Button>
        </div>
      )}
      
      {data && !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quotaFeatures.map((feature, index) => (
            <QuotaCard
              key={index}
              title={feature.title}
              used={feature.used}
              limit={feature.limit}
              enabled={feature.enabled}
              period={feature.period || undefined}
              resetAt={feature.resetAt || undefined}
              onUpgrade={handleUpgrade}
            />
          ))}
        </div>
      )}
    </div>
  )
}