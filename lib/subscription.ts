/**
 * Subscription System
 * 
 * Manages subscription tiers, quotas, features, and user access control
 */

import { SubscriptionTier, UserSubscription } from '../types/database'
import { supabaseService } from './supabase'

// ============================================================================
// Subscription Plan Definitions
// ============================================================================

export interface SubscriptionPlan {
  id: SubscriptionTier
  name: string
  description: string
  price: {
    monthly: number
    yearly: number
  }
  billing_cycles: Array<'monthly' | 'yearly'>
  features: {
    character_profile: boolean
    yearly_flow: {
      enabled: boolean
      limit?: number | null
      period: 'monthly' | 'yearly' | null
    }
    qa: {
      enabled: boolean
      limit?: number | null
      period: 'monthly' | 'yearly' | null
    }
    family_comparison: boolean
    export: {
      enabled: boolean
      formats: ('pdf' | 'excel' | 'csv' | 'docx')[]
    }
  }
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Basic features, perfect for getting started',
    price: {
      monthly: 0,
      yearly: 0,
    },
    billing_cycles: ['monthly'],
    features: {
      character_profile: true,
      yearly_flow: {
        enabled: true,
        limit: 1,
        period: 'monthly',
      },
      qa: {
        enabled: false,
        limit: 0,
        period: 'monthly',
      },
      family_comparison: false,
      export: {
        enabled: false,
        formats: [],
      },
    },
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    description: 'Ideal for casual users and enthusiasts',
    price: {
      monthly: 299,
      yearly: 2999,
    },
    billing_cycles: ['monthly', 'yearly'],
    features: {
      character_profile: true,
      yearly_flow: {
        enabled: true,
        limit: null,
        period: null,
      },
      qa: {
        enabled: true,
        limit: 20,
        period: 'monthly',
      },
      family_comparison: false,
      export: {
        enabled: true,
        formats: ['pdf'],
      },
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Advanced features for dedicated users',
    price: {
      monthly: 699,
      yearly: 6999,
    },
    billing_cycles: ['monthly', 'yearly'],
    features: {
      character_profile: true,
      yearly_flow: {
        enabled: true,
        limit: null,
        period: null,
      },
      qa: {
        enabled: true,
        limit: 100,
        period: 'monthly',
      },
      family_comparison: true,
      export: {
        enabled: true,
        formats: ['pdf', 'excel'],
      },
    },
  },
  vip: {
    id: 'vip',
    name: 'VIP',
    description: 'Ultimate access with priority support',
    price: {
      monthly: 1499,
      yearly: 14999,
    },
    billing_cycles: ['monthly', 'yearly'],
    features: {
      character_profile: true,
      yearly_flow: {
        enabled: true,
        limit: null,
        period: null,
      },
      qa: {
        enabled: true,
        limit: null,
        period: null,
      },
      family_comparison: true,
      export: {
        enabled: true,
        formats: ['pdf', 'excel', 'csv', 'docx'],
      },
    },
  },
}

// ============================================================================
// Feature Access Control
// ============================================================================

export interface QuotaInfo {
  [feature: string]: {
    used: number
    limit: number | null
    period?: string
    reset_at?: string
  }
}

/**
 * Get user's current subscription
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  try {
    let subscription, error
    
    try {
      const result = await supabaseService
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      subscription = result.data
      error = result.error
    } catch (dbError: any) {
      console.error('[Subscription] Database connection error:', dbError.message)
      return null // Return null for connection errors (defaults to free tier)
    }

    if (error) {
      console.error('[Subscription] Error fetching subscription:', error)
      return null
    }

    // Check if subscription is expired
    if (subscription) {
      const now = new Date()
      const periodEnd = new Date(subscription.current_period_end)
      
      if (now > periodEnd) {
        // Subscription has expired
        await supabaseService
          .from('user_subscriptions')
          .update({ status: 'expired' })
          .eq('id', subscription.id)
        
        return null
      }
    }

    return subscription
  } catch (error) {
    console.error('[Subscription] Unexpected error in getUserSubscription:', error)
    return null
  }
}

/**
 * Get user's subscription tier (defaults to 'free' if no active subscription)
 */
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const subscription = await getUserSubscription(userId)
  return subscription?.tier || 'free'
}

/**
 * Check if user has a feature enabled
 */
export async function hasFeature(
  userId: string,
  feature: 'character_profile' | 'yearly_flow' | 'qa' | 'family_comparison' | 'export'
): Promise<boolean> {
  try {
    const tier = await getUserTier(userId)
    const plan = SUBSCRIPTION_PLANS[tier]

    if (feature === 'character_profile') return plan.features.character_profile
    if (feature === 'yearly_flow') return plan.features.yearly_flow.enabled
    if (feature === 'qa') return plan.features.qa.enabled
    if (feature === 'family_comparison') return plan.features.family_comparison
    if (feature === 'export') return plan.features.export.enabled

    return false
  } catch (error) {
    console.error('[Subscription] Error checking feature:', error)
    return false
  }
}

/**
 * Check if user has quota for a feature
 */
export async function checkQuota(
  userId: string,
  feature: 'yearly_flow' | 'qa'
): Promise<{ available: boolean; current: number; limit: number | null; resets_at?: string }> {
  try {
    const tier = await getUserTier(userId)
    const plan = SUBSCRIPTION_PLANS[tier]

    if (feature === 'yearly_flow') {
      const { limit, period } = plan.features.yearly_flow
      
      // Unlimited quota
      if (limit === null) {
        return { available: true, current: 0, limit: null }
      }

      // Get usage for current period
      const usage = await getUsage(userId, feature, period || 'monthly')
      const available = usage.used < (limit || 0)

      return {
        available,
        current: usage.used,
        limit: limit || 0,
        resets_at: usage.resets_at,
      }
    }

    if (feature === 'qa') {
      const { limit, period } = plan.features.qa
      
      if (!plan.features.qa.enabled) {
        return { available: false, current: 0, limit: 0 }
      }

      // Unlimited quota
      if (limit === null) {
        return { available: true, current: 0, limit: null }
      }

      // Get usage for current period
      const usage = await getUsage(userId, feature, period || 'monthly')
      const available = usage.used < (limit || 0)

      return {
        available,
        current: usage.used,
        limit: limit || 0,
        resets_at: usage.resets_at,
      }
    }

    return { available: false, current: 0, limit: 0 }
  } catch (error) {
    console.error('[Subscription] Error checking quota:', error)
    return { available: false, current: 0, limit: 0 }
  }
}

/**
 * Get current usage for a feature
 */
async function getUsage(
  userId: string,
  feature: 'yearly_flow' | 'qa',
  period: 'monthly' | 'yearly'
): Promise<{ used: number; resets_at?: string }> {
  try {
    const now = new Date()
    let periodStart: Date
    let periodEnd: Date

    if (period === 'monthly') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    } else {
      periodStart = new Date(now.getFullYear(), 0, 1)
      periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
    }

    if (feature === 'qa') {
      // Query qa_usage_tracking
      let usage, error
      
      try {
        const result = await supabaseService
          .from('qa_usage_tracking')
          .select('questions_used, extra_questions')
          .eq('user_id', userId)
          .gte('period_start', periodStart.toISOString())
          .lte('period_end', periodEnd.toISOString())
        usage = result.data
        error = result.error
      } catch (dbError: any) {
        console.error('[Subscription] Database connection error in QA usage:', dbError.message)
        return { used: 0, resets_at: periodEnd.toISOString() }
      }

      if (error) {
        console.error('[Subscription] Error getting QA usage:', error)
        return { used: 0, resets_at: periodEnd.toISOString() }
      }

      const totalUsed = usage.reduce(
        (sum, u) => sum + (u.questions_used || 0) + (u.extra_questions || 0),
        0
      )

      return { used: totalUsed, resets_at: periodEnd.toISOString() }
    }

    if (feature === 'yearly_flow') {
      // Query bazi_reports with yearly_flow type
      let reports, error
      
      try {
        const result = await supabaseService
          .from('bazi_reports')
          .select('id')
          .eq('user_id', userId)
          .eq('report_type', 'yearly_flow')
          .gte('created_at', periodStart.toISOString())
          .lte('created_at', periodEnd.toISOString())
          .eq('status', 'completed')
        reports = result.data
        error = result.error
      } catch (dbError: any) {
        console.error('[Subscription] Database connection error in yearly flow usage:', dbError.message)
        return { used: 0, resets_at: periodEnd.toISOString() }
      }

      if (error) {
        console.error('[Subscription] Error getting yearly flow usage:', error)
        return { used: 0, resets_at: periodEnd.toISOString() }
      }

      return { used: reports.length, resets_at: periodEnd.toISOString() }
    }

    return { used: 0, resets_at: periodEnd.toISOString() }
  } catch (error) {
    console.error('[Subscription] Error in getUsage:', error)
    return { used: 0 }
  }
}

/**
 * Track usage for a feature
 */
export async function trackUsage(
  userId: string,
  feature: 'yearly_flow' | 'qa',
  amount: number = 1,
  reportId?: string
): Promise<boolean> {
  try {
    if (feature === 'qa' && reportId) {
      const now = new Date()
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

      // Upsert usage record
      const { error } = await supabaseService
        .from('qa_usage_tracking')
        .upsert(
          {
            user_id: userId,
            report_id: reportId,
            plan_tier: (await getUserTier(userId)) || 'free',
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            questions_used: amount,
          },
          {
            onConflict: 'user_id,report_id,period_start',
          }
        )

      if (error) {
        console.error('[Subscription] Error tracking QA usage:', error)
        return false
      }

      return true
    }

    // For yearly_flow, just log (usage is tracked by report creation)
    return true
  } catch (error) {
    console.error('[Subscription] Error in trackUsage:', error)
    return false
  }
}

/**
 * Get current quota usage for all limited features
 */
export async function getQuotaUsage(userId: string): Promise<QuotaInfo> {
  try {
    const quotaInfo: QuotaInfo = {}
    
    // Check yearly_flow quota
    const flowQuota = await checkQuota(userId, 'yearly_flow')
    quotaInfo.yearly_flow = {
      used: flowQuota.current,
      limit: flowQuota.limit,
      reset_at: flowQuota.resets_at,
    }

    // Check QA quota
    const qaQuota = await checkQuota(userId, 'qa')
    quotaInfo.qa = {
      used: qaQuota.current,
      limit: qaQuota.limit,
      reset_at: qaQuota.resets_at,
    }

    return quotaInfo
  } catch (error) {
    console.error('[Subscription] Error in getQuotaUsage:', error)
    return {
      yearly_flow: { used: 0, limit: 0 },
      qa: { used: 0, limit: 0 },
    }
  }
}

/**
 * Generate upgrade prompt
 */
export function upgradePrompt(currentTier: SubscriptionTier, requiredFeature: string): string {
  const upgradePath: Record<string, SubscriptionTier> = {
    qa: 'basic',
    yearly_flow_unlimited: 'basic',
    family_comparison: 'premium',
    export_excel: 'premium',
    export_advanced: 'vip',
  }

  const nextTier = upgradePath[requiredFeature] || 'basic'
  const currentPlan = SUBSCRIPTION_PLANS[currentTier]
  const nextPlan = SUBSCRIPTION_PLANS[nextTier]

  return `You've reached your quota limit. Upgrade from ${currentPlan.name} to ${nextPlan.name} for unlimited access to this feature.`
}

/**
 * Create or update subscription
 */
export async function createOrUpdateSubscription(
  userId: string,
  tier: SubscriptionTier,
  externalSubscriptionId?: string,
  paymentMethod?: string
): Promise<UserSubscription | null> {
  try {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    const { data: subscription, error } = await supabaseService
      .from('user_subscriptions')
      .upsert(
        {
          user_id: userId,
          tier,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          auto_renew: true,
          external_subscription_id: externalSubscriptionId,
          payment_method: paymentMethod,
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single()

    if (error) {
      console.error('[Subscription] Error creating/updating subscription:', error)
      return null
    }

    return subscription
  } catch (error) {
    console.error('[Subscription] Error in createOrUpdateSubscription:', error)
    return null
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  userId: string,
  cancelAtEnd: boolean = true
): Promise<boolean> {
  try {
    const subscription = await getUserSubscription(userId)
    
    if (!subscription) {
      return false
    }

    const update: any = {
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    }

    if (cancelAtEnd) {
      update.cancel_at = subscription.current_period_end
    }

    const { error } = await supabaseService
      .from('user_subscriptions')
      .update(update)
      .eq('id', subscription.id)

    if (error) {
      console.error('[Subscription] Error canceling subscription:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[Subscription] Error in cancelSubscription:', error)
    return false
  }
}
