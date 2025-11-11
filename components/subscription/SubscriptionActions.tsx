import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { UserSubscription } from '../../types/database'
import { SubscriptionPlan, SUBSCRIPTION_PLANS } from '../../lib/subscription'

interface SubscriptionActionsProps {
  subscription: UserSubscription
  userId: string
  onSubscriptionChange?: () => void
}

export default function SubscriptionActions({
  subscription,
  userId,
  onSubscriptionChange,
}: SubscriptionActionsProps) {
  const router = useRouter()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelAtEnd, setCancelAtEnd] = useState(true)
  const [autoRenewLoading, setAutoRenewLoading] = useState(false)

  const currentPlan = SUBSCRIPTION_PLANS[subscription.tier]
  const availableUpgrades = Object.values(SUBSCRIPTION_PLANS).filter(
    (plan) => {
      const tierOrder = ['free', 'basic', 'premium', 'vip']
      return tierOrder.indexOf(plan.id) > tierOrder.indexOf(subscription.tier)
    }
  )

  // Handle upgrade click
  const handleUpgradeClick = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan)
    setShowUpgradeModal(true)
    setError(null)
  }

  // Confirm upgrade
  const confirmUpgrade = async () => {
    if (!selectedPlan) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/subscriptions/checkout?user_id=${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tier: selectedPlan.id,
            billing_cycle: 'monthly', // Default to monthly for upgrades
          }),
        }
      )

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Failed to create checkout session')
      }

      // Redirect to payment URL
      if (result.data?.payment_url) {
        window.location.href = result.data.payment_url
      } else {
        throw new Error('No payment URL received')
      }
    } catch (err) {
      console.error('[SubscriptionActions] Upgrade error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upgrade')
      setLoading(false)
    }
  }

  // Handle cancel click
  const handleCancelClick = () => {
    setShowCancelModal(true)
    setError(null)
  }

  // Confirm cancel
  const confirmCancel = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/subscriptions/cancel?user_id=${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cancel_at_end: cancelAtEnd,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Failed to cancel subscription')
      }

      // Close modal and refresh
      setShowCancelModal(false)
      if (onSubscriptionChange) {
        onSubscriptionChange()
      } else {
        router.reload()
      }
    } catch (err) {
      console.error('[SubscriptionActions] Cancel error:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setLoading(false)
    }
  }

  // Toggle auto-renew
  const toggleAutoRenew = async () => {
    try {
      setAutoRenewLoading(true)
      setError(null)

      const response = await fetch(
        `/api/subscriptions/update?user_id=${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auto_renew: !subscription.auto_renew,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Failed to update subscription')
      }

      // Refresh subscription data
      if (onSubscriptionChange) {
        onSubscriptionChange()
      } else {
        router.reload()
      }
    } catch (err) {
      console.error('[SubscriptionActions] Auto-renew toggle error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update auto-renewal')
    } finally {
      setAutoRenewLoading(false)
    }
  }

  // Get features that will be lost on cancellation
  const getLostFeatures = () => {
    const features = []
    
    if (currentPlan.features.yearly_flow.limit === null) {
      features.push('无限流年分析')
    }
    
    if (currentPlan.features.qa.enabled) {
      if (currentPlan.features.qa.limit === null) {
        features.push('无限QA咨询')
      } else {
        features.push(`每月${currentPlan.features.qa.limit}条QA`)
      }
    }
    
    if (currentPlan.features.export.enabled) {
      features.push(`导出功能 (${currentPlan.features.export.formats.join(', ')})`)
    }
    
    if (currentPlan.features.family_comparison) {
      features.push('家族对比分析')
    }
    
    return features
  }

  // Calculate price difference for upgrade
  const getPriceDifference = (targetPlan: SubscriptionPlan) => {
    const currentPrice = currentPlan.price.monthly
    const targetPrice = targetPlan.price.monthly
    return targetPrice - currentPrice
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Current Plan Info */}
      <div className="bg-mystical-purple-900/50 border border-mystical-gold-700/30 rounded-xl p-6">
        <h3 className="text-lg font-bold text-mystical-gold-400 mb-2">
          当前计划: {currentPlan.name}
        </h3>
        <p className="text-mystical-gold-600/80 text-sm mb-4">
          {currentPlan.description}
        </p>
        <p className="text-2xl font-bold text-mystical-gold-500">
          ₹{currentPlan.price.monthly}/月
        </p>
      </div>

      {/* Auto-Renew Toggle */}
      <div className="bg-mystical-purple-900/50 border border-mystical-gold-700/30 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-md font-semibold text-mystical-gold-400 mb-1">
              自动续费
            </h4>
            <p className="text-sm text-mystical-gold-600/80">
              订阅到期时自动续订
            </p>
          </div>
          <button
            onClick={toggleAutoRenew}
            disabled={autoRenewLoading}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              subscription.auto_renew
                ? 'bg-mystical-gold-600'
                : 'bg-mystical-gold-700/50'
            } ${autoRenewLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-mystical-purple-950 transition-transform ${
                subscription.auto_renew ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Upgrade Options */}
      {availableUpgrades.length > 0 && (
        <div className="bg-mystical-purple-900/50 border border-mystical-gold-700/30 rounded-xl p-6">
          <h4 className="text-md font-semibold text-mystical-gold-400 mb-4">
            升级到更高计划
          </h4>
          <div className="space-y-3">
            {availableUpgrades.map((plan) => (
              <button
                key={plan.id}
                onClick={() => handleUpgradeClick(plan)}
                className="w-full flex items-center justify-between p-4 bg-mystical-purple-950/50 hover:bg-mystical-purple-950 border border-mystical-gold-700/30 hover:border-mystical-gold-700/50 rounded-lg transition-all"
              >
                <div className="text-left">
                  <p className="font-semibold text-mystical-gold-400">
                    {plan.name}
                  </p>
                  <p className="text-sm text-mystical-gold-600/80">
                    ₹{plan.price.monthly}/月
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-mystical-gold-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Subscription */}
      {subscription.tier !== 'free' && (
        <div className="bg-mystical-purple-900/50 border border-mystical-gold-700/30 rounded-xl p-6">
          <Button
            variant="danger"
            size="md"
            fullWidth
            onClick={handleCancelClick}
          >
            取消订阅
          </Button>
        </div>
      )}

      {/* Upgrade Modal */}
      <Modal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="确认升级"
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowUpgradeModal(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              variant="gold"
              onClick={confirmUpgrade}
              loading={loading}
            >
              确认升级
            </Button>
          </div>
        }
      >
        {selectedPlan && (
          <div className="space-y-4">
            <div>
              <p className="text-mystical-gold-600/80 mb-2">
                您将从 <strong>{currentPlan.name}</strong> 升级到{' '}
                <strong>{selectedPlan.name}</strong>
              </p>
            </div>

            <div className="bg-mystical-purple-950/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-mystical-gold-600/80">当前价格:</span>
                <span className="text-mystical-gold-500">
                  ₹{currentPlan.price.monthly}/月
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-mystical-gold-600/80">新价格:</span>
                <span className="text-mystical-gold-500">
                  ₹{selectedPlan.price.monthly}/月
                </span>
              </div>
              <div className="border-t border-mystical-gold-700/20 pt-2 flex justify-between">
                <span className="text-mystical-gold-400 font-semibold">
                  差价:
                </span>
                <span className="text-mystical-gold-400 font-semibold">
                  +₹{getPriceDifference(selectedPlan)}/月
                </span>
              </div>
            </div>

            <div className="bg-mystical-gold-700/10 rounded-lg p-4">
              <p className="text-sm text-mystical-gold-500">
                💡 升级后您将立即获得新计划的所有功能和配额
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="确认取消订阅"
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowCancelModal(false)}
              disabled={loading}
            >
              不，保留订阅
            </Button>
            <Button
              variant="danger"
              onClick={confirmCancel}
              loading={loading}
            >
              确认取消
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-400 font-semibold mb-2">⚠️ 警告</p>
            <p className="text-red-400/80 text-sm">
              取消订阅后，您将失去以下功能：
            </p>
          </div>

          <ul className="space-y-2">
            {getLostFeatures().map((feature, idx) => (
              <li key={idx} className="flex items-start">
                <svg
                  className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-mystical-gold-500">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="bg-mystical-purple-950/50 rounded-lg p-4 space-y-3">
            <p className="text-mystical-gold-400 font-semibold mb-2">
              选择取消时间：
            </p>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="cancel_timing"
                checked={cancelAtEnd}
                onChange={() => setCancelAtEnd(true)}
                className="w-4 h-4 text-mystical-gold-600 focus:ring-mystical-gold-500"
              />
              <span className="text-mystical-gold-500">
                在当前周期结束时取消 (推荐)
              </span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="cancel_timing"
                checked={!cancelAtEnd}
                onChange={() => setCancelAtEnd(false)}
                className="w-4 h-4 text-mystical-gold-600 focus:ring-mystical-gold-500"
              />
              <span className="text-mystical-gold-500">立即取消</span>
            </label>
          </div>

          {cancelAtEnd && subscription.current_period_end && (
            <div className="bg-mystical-gold-700/10 rounded-lg p-4">
              <p className="text-sm text-mystical-gold-500">
                💡 您的订阅将在{' '}
                <strong>
                  {new Date(subscription.current_period_end).toLocaleDateString('zh-CN')}
                </strong>{' '}
                到期后自动取消
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
