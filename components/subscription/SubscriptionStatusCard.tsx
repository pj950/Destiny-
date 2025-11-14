import React, { useState, useEffect } from 'react'
import type { SubscriptionTier, SubscriptionStatus } from '../../types/database'

interface SubscriptionData {
  tier: SubscriptionTier
  plan: string
  subscription: {
    status: SubscriptionStatus
    current_period_start: string
    current_period_end: string
    auto_renew: boolean
    cancel_at: string | null
  } | null
  quota: {
    yearly_flow: { used: number; limit: number | null }
    qa: { used: number; limit: number | null }
  }
}

interface SubscriptionStatusCardProps {
  userId: string
  className?: string
}

export default function SubscriptionStatusCard({ userId, className = '' }: SubscriptionStatusCardProps) {
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/subscriptions/current?user_id=${userId}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (!result.ok) {
          throw new Error(result.error || 'Failed to fetch subscription data')
        }
        
        setData(result.data)
      } catch (err) {
        console.error('[SubscriptionStatusCard] Error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load subscription data')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchSubscriptionData()
    }
  }, [userId])

  const getStatusText = (status: SubscriptionStatus) => {
    const statusMap = {
      active: '有效',
      past_due: '逾期',
      canceled: '已取消',
      expired: '过期'
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: SubscriptionStatus) => {
    const colorMap = {
      active: 'text-green-400',
      past_due: 'text-yellow-400',
      canceled: 'text-red-400',
      expired: 'text-gray-400'
    }
    return colorMap[status] || 'text-gray-400'
  }

  const getTierColor = (tier: SubscriptionTier) => {
    const colorMap = {
      free: 'text-gray-400',
      basic: 'text-blue-400',
      premium: 'text-purple-400',
      vip: 'text-yellow-400'
    }
    return colorMap[tier] || 'text-gray-400'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getAutoRenewText = (autoRenew: boolean) => {
    return autoRenew ? '开启' : '关闭'
  }

  const getAutoRenewColor = (autoRenew: boolean) => {
    return autoRenew ? 'text-green-400' : 'text-red-400'
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-mystical-purple-900/80 to-mystical-cyan-950/80 rounded-xl border border-mystical-gold-700/40 p-6 shadow-gold-glow animate-pulse ${className}`}>
        <div className="space-y-4">
          <div className="h-6 bg-mystical-gold-700/20 rounded w-1/3"></div>
          <div className="h-4 bg-mystical-gold-700/20 rounded w-1/2"></div>
          <div className="h-4 bg-mystical-gold-700/20 rounded w-2/3"></div>
          <div className="h-4 bg-mystical-gold-700/20 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-gradient-to-br from-mystical-purple-900/80 to-mystical-cyan-950/80 rounded-xl border border-red-700/40 p-6 shadow-mystical-medium ${className}`}>
        <div className="text-red-400 text-center">
          <div className="text-lg font-serif mb-2">加载失败</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    )
  }

  // No data state
  if (!data) {
    return (
      <div className={`bg-gradient-to-br from-mystical-purple-900/80 to-mystical-cyan-950/80 rounded-xl border border-mystical-gold-700/40 p-6 shadow-mystical-medium ${className}`}>
        <div className="text-mystical-gold-500 text-center">
          <div className="text-lg font-serif mb-2">暂无订阅信息</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-br from-mystical-purple-900/80 to-mystical-cyan-950/80 rounded-xl border border-mystical-gold-700/40 p-6 shadow-gold-glow animate-gold-glow-pulse ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h3 className="text-xl font-serif text-mystical-gold-400 mb-1">订阅状态</h3>
          <div className="flex items-center space-x-3">
            <span className={`text-2xl font-bold ${getTierColor(data.tier)}`}>
              {data.plan}
            </span>
            {data.subscription && (
              <span className={`text-sm px-2 py-1 rounded-full border ${getStatusColor(data.subscription.status)} border-current/20`}>
                {getStatusText(data.subscription.status)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Details */}
      {data.subscription ? (
        <div className="space-y-4">
          {/* Current Period */}
          <div className="flex flex-col sm:flex-row sm:justify-between">
            <span className="text-mystical-gold-600 text-sm mb-1 sm:mb-0">当前周期</span>
            <span className="text-mystical-gold-400 text-sm font-sans">
              {formatDate(data.subscription.current_period_start)} - {formatDate(data.subscription.current_period_end)}
            </span>
          </div>

          {/* Next Renewal Date */}
          {data.subscription.status === 'active' && (
            <div className="flex flex-col sm:flex-row sm:justify-between">
              <span className="text-mystical-gold-600 text-sm mb-1 sm:mb-0">下次续费</span>
              <span className="text-mystical-gold-400 text-sm font-sans">
                {formatDate(data.subscription.current_period_end)}
              </span>
            </div>
          )}

          {/* Auto Renew Status */}
          <div className="flex flex-col sm:flex-row sm:justify-between">
            <span className="text-mystical-gold-600 text-sm mb-1 sm:mb-0">自动续费</span>
            <span className={`text-sm font-sans ${getAutoRenewColor(data.subscription.auto_renew)}`}>
              {getAutoRenewText(data.subscription.auto_renew)}
            </span>
          </div>

          {/* Cancellation Info */}
          {data.subscription.cancel_at && (
            <div className="flex flex-col sm:flex-row sm:justify-between">
              <span className="text-mystical-gold-600 text-sm mb-1 sm:mb-0">取消生效日期</span>
              <span className="text-red-400 text-sm font-sans">
                {formatDate(data.subscription.cancel_at)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-mystical-gold-400 text-sm">
          <p>您正在使用免费版本</p>
        </div>
      )}

      {/* Quota Usage */}
      <div className="mt-6 pt-6 border-t border-mystical-gold-700/20">
        <h4 className="text-sm font-serif text-mystical-gold-500 mb-3">本月使用情况</h4>
        <div className="space-y-3">
          {/* Yearly Flow Quota */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-mystical-gold-600">年度流年报告</span>
              <span className="text-mystical-gold-400">
                {data.quota.yearly_flow.used}/{data.quota.yearly_flow.limit === null ? '无限' : data.quota.yearly_flow.limit}
              </span>
            </div>
            {data.quota.yearly_flow.limit !== null && (
              <div className="w-full bg-mystical-purple-800/50 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-mystical-gold-600 to-mystical-gold-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((data.quota.yearly_flow.used / data.quota.yearly_flow.limit) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* QA Quota */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-mystical-gold-600">问答次数</span>
              <span className="text-mystical-gold-400">
                {data.quota.qa.used}/{data.quota.qa.limit === null ? '无限' : data.quota.qa.limit}
              </span>
            </div>
            {data.quota.qa.limit !== null && (
              <div className="w-full bg-mystical-purple-800/50 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-mystical-gold-600 to-mystical-gold-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((data.quota.qa.used / data.quota.qa.limit) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}