import React from 'react'
import Card from '../Card'
import Button from '../ui/Button'
import { SubscriptionPlan } from '../../lib/subscription'

interface PlanCardProps {
  plan: SubscriptionPlan
  isCurrentPlan: boolean
  isBillingMonthly: boolean
  onUpgrade: () => void
  loading?: boolean
  className?: string
}

export default function PlanCard({
  plan,
  isCurrentPlan,
  isBillingMonthly,
  onUpgrade,
  loading = false,
  className = ''
}: PlanCardProps) {
  const price = isBillingMonthly ? plan.price.monthly : plan.price.yearly
  const billingPeriod = isBillingMonthly ? '月' : '年'
  
  // Get key features to display
  const getKeyFeatures = () => {
    const features = []
    
    // Yearly Flow feature
    if (plan.features.yearly_flow.enabled) {
      if (plan.features.yearly_flow.limit === null) {
        features.push('无限流年分析')
      } else if (plan.features.yearly_flow.limit === 1) {
        features.push('每月1次流年分析')
      }
    }
    
    // QA feature
    if (plan.features.qa.enabled) {
      if (plan.features.qa.limit === null) {
        features.push('无限QA咨询')
      } else {
        features.push(`每月${plan.features.qa.limit}条QA`)
      }
    }
    
    // Export feature
    if (plan.features.export.enabled) {
      features.push(`导出: ${plan.features.export.formats.join('/')}`  )
    }
    
    // Family comparison
    if (plan.features.family_comparison) {
      features.push('家族对比分析')
    }
    
    // Return at most 3-4 features
    return features.slice(0, 4)
  }
  
  const keyFeatures = getKeyFeatures()
  const isRecommended = plan.id === 'premium'
  const isBudgetFriendly = plan.id === 'basic'
  
  // Determine card variant based on plan
  let variant: 'default' | 'elevated' | 'outlined' | 'mystical' | 'mystical-gold' = 'outlined'
  if (isCurrentPlan) {
    variant = 'mystical-gold'
  } else if (isRecommended) {
    variant = 'mystical'
  }

  return (
    <div className={`relative ${className}`}>
      {/* Recommended Badge */}
      {isRecommended && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
          <span className="bg-gradient-to-r from-mystical-gold-700 to-mystical-gold-500 text-mystical-purple-950 px-4 py-1 rounded-full text-sm font-semibold shadow-gold-glow whitespace-nowrap">
            推荐
          </span>
        </div>
      )}

      <Card
        className={`p-6 h-full flex flex-col ${
          isCurrentPlan 
            ? 'border-2 border-mystical-gold-700 shadow-gold-glow-lg' 
            : isRecommended 
            ? 'border-2 border-mystical-gold-700/50 shadow-mystical-medium transform md:scale-105' 
            : ''
        }`}
        hover={!isCurrentPlan}
        variant={variant}
      >
        {/* Header Section */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-mystical-gold-400 mb-2">
            {plan.name}
          </h3>
          <p className="text-sm text-mystical-gold-600/80 mb-4">
            {plan.description}
          </p>
          
          {/* Price Section */}
          <div className="mb-2">
            {plan.id === 'free' ? (
              <span className="text-4xl font-bold text-mystical-gold-500">免费</span>
            ) : (
              <div>
                <span className="text-4xl font-bold text-mystical-gold-500">
                  ₹{price}
                </span>
                <span className="text-mystical-gold-600/80 ml-2">/{billingPeriod}</span>
              </div>
            )}
          </div>
          
          {/* Billing Period Info */}
          {plan.id !== 'free' && !isBillingMonthly && (
            <p className="text-xs text-mystical-gold-600/80">
              年度节省 ₹{(plan.price.monthly * 12 - plan.price.yearly).toFixed(0)}
            </p>
          )}
        </div>

        {/* Current Plan Badge */}
        {isCurrentPlan && (
          <div className="mb-4 bg-mystical-gold-700/20 border border-mystical-gold-700/50 text-mystical-gold-400 px-4 py-2 rounded-xl text-sm text-center font-semibold">
            当前计划
          </div>
        )}

        {/* Features List */}
        <ul className="space-y-3 mb-8 flex-grow">
          {keyFeatures.map((feature, idx) => (
            <li key={idx} className="flex items-start">
              <svg className="w-5 h-5 text-mystical-gold-600 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-mystical-gold-500">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Action Button */}
        <Button
          variant={isCurrentPlan ? 'mystical' : isRecommended ? 'gold' : 'mystical'}
          size="lg"
          fullWidth
          onClick={onUpgrade}
          loading={loading}
          disabled={isCurrentPlan || loading}
        >
          {isCurrentPlan ? '当前计划' : '立即升级'}
        </Button>
      </Card>
    </div>
  )
}
