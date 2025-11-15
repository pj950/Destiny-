/**
 * QA Conversation Management Utilities
 * 
 * Handles conversation persistence, usage tracking, quota management,
 * and message trimming for context limits.
 */

import { supabaseService } from './supabase'
import type { 
  QAConversation, 
  QAConversationInsert, 
  QAConversationUpdate,
  QAUsageTracking,
  QAUsageTrackingInsert,
  QAUsageTrackingUpdate,
  SubscriptionTier,
  ConversationMessage 
} from '../types/database'

// Re-export SubscriptionTier for convenience
export type { SubscriptionTier } from '../types/database'

// Configuration constants
const DEFAULT_CONTEXT_LIMIT = 10 // Maximum messages to keep in context
const FREE_TIER_QUESTION_LIMIT = 5 // Questions per report per billing period
const BASIC_TIER_QUESTION_LIMIT = 15
const PREMIUM_TIER_QUESTION_LIMIT = 50
const VIP_TIER_QUESTION_LIMIT = 999 // Unlimited for practical purposes

const RETENTION_DAYS = {
  free: 30,
  basic: 90,
  premium: 365,
  vip: 999, // Forever for practical purposes
} as const

/**
 * Get question limit based on subscription tier
 */
export function getQuestionLimit(tier: SubscriptionTier): number {
  switch (tier) {
    case 'free':
      return FREE_TIER_QUESTION_LIMIT
    case 'basic':
      return BASIC_TIER_QUESTION_LIMIT
    case 'premium':
      return PREMIUM_TIER_QUESTION_LIMIT
    case 'vip':
      return VIP_TIER_QUESTION_LIMIT
    default:
      return FREE_TIER_QUESTION_LIMIT
  }
}

/**
 * Get retention period in days based on subscription tier
 */
export function getRetentionDays(tier: SubscriptionTier): number {
  return RETENTION_DAYS[tier] || RETENTION_DAYS.free
}

/**
 * Calculate retention until date for a conversation
 */
export function calculateRetentionUntil(tier: SubscriptionTier): string {
  const days = getRetentionDays(tier)
  const retentionDate = new Date()
  retentionDate.setDate(retentionDate.getDate() + days)
  return retentionDate.toISOString()
}

/**
 * Get or create usage tracking record for a user and report
 */
export async function getOrCreateUsageTracking(
  userId: string,
  reportId: string,
  tier: SubscriptionTier
): Promise<QAUsageTracking> {
  try {
    // First, try to find existing usage tracking for current period
    const periodStart = new Date()
    periodStart.setDate(1) // Start of current month
    periodStart.setHours(0, 0, 0, 0)
    
    const periodEnd = new Date(periodStart)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    periodEnd.setDate(0) // End of current month
    periodEnd.setHours(23, 59, 59, 999)

    const { data: existing, error: fetchError } = await supabaseService
      .from('qa_usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('report_id', reportId)
      .eq('period_start', periodStart.toISOString())
      .single()

    if (existing && !fetchError) {
      return existing as QAUsageTracking
    }

    // Create new usage tracking record
    const newTracking: QAUsageTrackingInsert = {
      user_id: userId,
      report_id: reportId,
      plan_tier: tier,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      questions_used: 0,
      extra_questions: 0,
      last_reset_at: periodStart.toISOString(),
    }

    const { data: created, error: createError } = await supabaseService
      .from('qa_usage_tracking')
      .insert(newTracking)
      .select()
      .single()

    if (createError || !created) {
      console.error('[QA] Error creating usage tracking:', createError)
      throw new Error('Failed to create usage tracking record')
    }

    return created as QAUsageTracking
  } catch (error) {
    console.error('[QA] Error in getOrCreateUsageTracking:', error)
    throw error
  }
}

/**
 * Check if user has remaining questions for the report
 */
export async function checkQuestionQuota(
  userId: string,
  reportId: string,
  tier: SubscriptionTier
): Promise<{ hasQuota: boolean; questionsUsed: number; questionsLimit: number; canPurchase: boolean }> {
  try {
    const usage = await getOrCreateUsageTracking(userId, reportId, tier)
    const limit = getQuestionLimit(tier)
    const totalUsed = usage.questions_used + usage.extra_questions
    const hasQuota = totalUsed < limit

    return {
      hasQuota,
      questionsUsed: usage.questions_used,
      questionsLimit: limit,
      canPurchase: tier !== 'vip', // VIP users don't need to purchase
    }
  } catch (error) {
    console.error('[QA] Error checking question quota:', error)
    // Default to allowing the question if we can't check quota
    return {
      hasQuota: true,
      questionsUsed: 0,
      questionsLimit: getQuestionLimit(tier),
      canPurchase: tier !== 'vip',
    }
  }
}

/**
 * Increment question usage for a user and report
 */
export async function incrementQuestionUsage(
  userId: string,
  reportId: string,
  tier: SubscriptionTier
): Promise<void> {
  try {
    const usage = await getOrCreateUsageTracking(userId, reportId, tier)
    
    const updateData: QAUsageTrackingUpdate = {
      questions_used: usage.questions_used + 1,
    }

    const { error } = await supabaseService
      .from('qa_usage_tracking')
      .update(updateData)
      .eq('id', usage.id)

    if (error) {
      console.error('[QA] Error incrementing question usage:', error)
      throw new Error('Failed to increment question usage')
    }
  } catch (error) {
    console.error('[QA] Error in incrementQuestionUsage:', error)
    throw error
  }
}

/**
 * Add extra questions to usage tracking (for purchases)
 */
export async function addExtraQuestions(
  userId: string,
  reportId: string,
  extraQuestions: number
): Promise<void> {
  try {
    const usage = await getOrCreateUsageTracking(userId, reportId, 'free') // Tier doesn't matter for existing record
    
    const updateData: QAUsageTrackingUpdate = {
      extra_questions: usage.extra_questions + extraQuestions,
    }

    const { error } = await supabaseService
      .from('qa_usage_tracking')
      .update(updateData)
      .eq('id', usage.id)

    if (error) {
      console.error('[QA] Error adding extra questions:', error)
      throw new Error('Failed to add extra questions')
    }
  } catch (error) {
    console.error('[QA] Error in addExtraQuestions:', error)
    throw error
  }
}

/**
 * Get or create conversation for a report
 */
export async function getOrCreateConversation(
  userId: string | null,
  reportId: string,
  tier: SubscriptionTier
): Promise<QAConversation> {
  try {
    // Try to find existing conversation
    const { data: existing, error: fetchError } = await supabaseService
      .from('qa_conversations')
      .select('*')
      .eq('report_id', reportId)
      .eq('user_id', userId)
      .single()

    if (existing && !fetchError) {
      return existing as QAConversation
    }

    // Create new conversation
    const retentionUntil = calculateRetentionUntil(tier)
    
    const newConversation: QAConversationInsert = {
      report_id: reportId,
      user_id: userId,
      subscription_tier: tier,
      messages: [],
      last_message_at: new Date().toISOString(),
      retention_until: retentionUntil,
      metadata: {
        total_questions: 0,
        average_response_time_ms: 0,
        satisfaction_rating: 0,
        topics: [],
      },
    }

    const { data: created, error: createError } = await supabaseService
      .from('qa_conversations')
      .insert(newConversation)
      .select()
      .single()

    if (createError || !created) {
      console.error('[QA] Error creating conversation:', createError)
      throw new Error('Failed to create conversation')
    }

    return created as QAConversation
  } catch (error) {
    console.error('[QA] Error in getOrCreateConversation:', error)
    throw error
  }
}

/**
 * Trim conversation messages to fit context limit
 */
export function trimConversationMessages(
  messages: ConversationMessage[],
  contextLimit: number = DEFAULT_CONTEXT_LIMIT
): ConversationMessage[] {
  if (messages.length <= contextLimit) {
    return messages
  }

  // Keep the most recent messages, but always keep the first message if it's from user
  const firstMessage = messages[0]
  const recentMessages = messages.slice(-(contextLimit - 1))

  if (firstMessage.role === 'user' && !recentMessages.includes(firstMessage)) {
    return [firstMessage, ...recentMessages]
  }

  return recentMessages
}

/**
 * Add message to conversation and update it
 */
export async function addMessageToConversation(
  conversationId: string,
  message: ConversationMessage,
  tier: SubscriptionTier
): Promise<QAConversation> {
  try {
    // Get current conversation
    const { data: current, error: fetchError } = await supabaseService
      .from('qa_conversations')
      .select('messages')
      .eq('id', conversationId)
      .single()

    if (fetchError || !current) {
      throw new Error('Conversation not found')
    }

    const currentMessages = current.messages as ConversationMessage[]
    const updatedMessages = [...currentMessages, message]

    // Update conversation
    const updateData: QAConversationUpdate = {
      messages: updatedMessages,
      last_message_at: new Date().toISOString(),
      metadata: {
        total_questions: updatedMessages.filter(m => m.role === 'user').length,
        topics: [], // TODO: Extract topics from messages
      },
    }

    const { data: updated, error: updateError } = await supabaseService
      .from('qa_conversations')
      .update(updateData)
      .eq('id', conversationId)
      .select()
      .single()

    if (updateError || !updated) {
      console.error('[QA] Error updating conversation:', updateError)
      throw new Error('Failed to update conversation')
    }

    return updated as QAConversation
  } catch (error) {
    console.error('[QA] Error in addMessageToConversation:', error)
    throw error
  }
}

/**
 * Get conversations for a report with retention filtering
 */
export async function getConversationsForReport(
  userId: string | null,
  reportId: string,
  tier: SubscriptionTier = 'free'
): Promise<QAConversation[]> {
  try {
    const retentionDays = getRetentionDays(tier)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    let query = supabaseService
      .from('qa_conversations')
      .select('*')
      .eq('report_id', reportId)
      .order('last_message_at', { ascending: false })

    if (userId) {
      query = query.eq('user_id', userId)
    } else {
      query = query.is('user_id', null)
    }

    // Apply retention filter for non-VIP users
    if (tier !== 'vip') {
      query = query.or(`retention_until.is.null,retention_until.gte.${cutoffDate.toISOString()}`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[QA] Error fetching conversations:', error)
      return []
    }

    return (data as QAConversation[]) || []
  } catch (error) {
    console.error('[QA] Error in getConversationsForReport:', error)
    return []
  }
}

/**
 * Clean up expired conversations (maintenance function)
 */
export async function cleanupExpiredConversations(): Promise<number> {
  try {
    const { data: deleted, error } = await supabaseService
      .from('qa_conversations')
      .delete()
      .lt('retention_until', new Date().toISOString())
      .select('id')

    if (error) {
      console.error('[QA] Error cleaning up expired conversations:', error)
      return 0
    }

    const deletedCount = deleted?.length || 0
    if (deletedCount > 0) {
      console.log(`[QA] Cleaned up ${deletedCount} expired conversations`)
    }

    return deletedCount
  } catch (error) {
    console.error('[QA] Error in cleanupExpiredConversations:', error)
    return 0
  }
}