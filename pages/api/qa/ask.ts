import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { getGeminiClient, parseGeminiJsonResponse, buildQaPrompt } from '../../../lib/gemini'
import { searchSimilarChunks } from '../../../lib/rag'
import { QaAnswerPayloadSchema } from '../../../lib/gemini/schemas'
import type { BaziReport, QAConversation, QAUsageTracking, SubscriptionTier, ConversationMessage } from '../../../types/database'

const QUOTA_LIMITS: Record<SubscriptionTier, number | null> = {
  free: 0,
  basic: 20,
  premium: 20,
  vip: null,
}

const MAX_CONVERSATION_HISTORY = 20
const MAX_CONTEXT_CHUNKS = 5
const GEMINI_TIMEOUT_MS = 30000
const GEMINI_RETRY_COUNT = 3

interface QARequestBody {
  report_id: string
  question: string
  subscription_tier?: SubscriptionTier
}

interface QAResponseData {
  ok: boolean
  answer?: string
  citations?: Array<{
    chunk_id: number
    content: string
    section?: string
  }>
  followUps?: string[]
  remaining_quota?: number
  message?: string
}

/**
 * Validate request body and required fields
 */
function validateRequest(body: unknown): body is QARequestBody {
  if (!body || typeof body !== 'object') return false

  const req = body as Record<string, unknown>
  return (
    typeof req.report_id === 'string' &&
    req.report_id.length > 0 &&
    typeof req.question === 'string' &&
    req.question.length > 0 &&
    (!req.subscription_tier || ['free', 'basic', 'premium', 'vip'].includes(req.subscription_tier as string))
  )
}

/**
 * Retry logic with exponential backoff for Gemini calls
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = GEMINI_RETRY_COUNT,
  delay: number = 1000,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      const isLastAttempt = i === retries - 1
      const isRetryableError =
        error.code === 'RESOURCE_EXHAUSTED' ||
        error.code === 'DEADLINE_EXCEEDED' ||
        error.message?.includes('timeout') ||
        error.message?.includes('rate_limit')

      if (isLastAttempt || !isRetryableError) {
        throw error
      }

      const backoffDelay = delay * Math.pow(2, i)
      console.log(
        `[QA Ask] Retry attempt ${i + 1}/${retries} after ${backoffDelay}ms due to: ${error.message}`,
      )
      await new Promise(resolve => setTimeout(resolve, backoffDelay))
    }
  }

  throw new Error('Max retries exceeded')
}

/**
 * Load or create conversation for the report
 */
async function loadOrCreateConversation(
  reportId: string,
  subscriptionTier: SubscriptionTier,
): Promise<QAConversation> {
  const { data: existing, error: selectError } = await supabaseService
    .from('qa_conversations')
    .select('*')
    .eq('report_id', reportId)
    .limit(1)

  if (!selectError && existing && existing.length > 0) {
    return existing[0] as QAConversation
  }

  // Create new conversation
  const { data: created, error: insertError } = await supabaseService
    .from('qa_conversations')
    .insert([
      {
        report_id: reportId,
        user_id: null,
        subscription_tier: subscriptionTier,
        messages: [],
      },
    ])
    .select()
    .single()

  if (insertError || !created) {
    throw new Error(`Failed to create conversation: ${insertError?.message}`)
  }

  return created as QAConversation
}

/**
 * Check and update quota usage
 */
async function checkAndUpdateQuota(
  reportId: string,
  subscriptionTier: SubscriptionTier,
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = QUOTA_LIMITS[subscriptionTier]

  // VIP has unlimited questions
  if (limit === null) {
    return { allowed: true, remaining: -1 }
  }

  // Free tier has no questions
  if (limit === 0) {
    return { allowed: false, remaining: 0 }
  }

  // Get or create usage tracking for current month
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const { data: existing, error: selectError } = await supabaseService
    .from('qa_usage_tracking')
    .select('*')
    .eq('report_id', reportId)
    .eq('plan_tier', subscriptionTier)
    .gte('period_start', periodStart.toISOString())
    .lte('period_end', periodEnd.toISOString())
    .single()

  let usage: QAUsageTracking

  if (selectError?.code === 'PGRST116') {
    // No record found, create new one
    const { data: created, error: insertError } = await supabaseService
      .from('qa_usage_tracking')
      .insert([
        {
          user_id: null,
          report_id: reportId,
          plan_tier: subscriptionTier,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          questions_used: 0,
          extra_questions: 0,
        },
      ])
      .select()
      .single()

    if (insertError || !created) {
      throw new Error(`Failed to create usage tracking: ${insertError?.message}`)
    }

    usage = created as QAUsageTracking
  } else if (selectError) {
    throw new Error(`Failed to query usage tracking: ${selectError.message}`)
  } else if (existing) {
    usage = existing as QAUsageTracking
  } else {
    throw new Error('Failed to load or create usage tracking')
  }

  const totalUsed = usage.questions_used + usage.extra_questions
  const allowed = totalUsed < limit

  if (allowed) {
    // Update usage
    const { error: updateError } = await supabaseService
      .from('qa_usage_tracking')
      .update({
        questions_used: usage.questions_used + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', usage.id)

    if (updateError) {
      console.error('[QA Ask] Warning: Failed to update usage tracking:', updateError)
      // Continue anyway - don't fail the entire request
    }
  }

  const remaining = Math.max(0, limit - totalUsed - 1)
  return { allowed, remaining }
}

/**
 * Retrieve context chunks from vector search
 */
async function retrieveContextChunks(reportId: string, question: string) {
  try {
    const results = await searchSimilarChunks(reportId, question, MAX_CONTEXT_CHUNKS)

    return results.map(r => ({
      id: r.chunk_id || r.id,
      content: r.content,
      metadata: (r as any).metadata,
      similarity: r.similarity,
    }))
  } catch (error) {
    console.error('[QA Ask] Error retrieving context chunks:', error)
    return []
  }
}

/**
 * Truncate conversation history to keep only recent messages
 */
function truncateHistory(messages: ConversationMessage[]): ConversationMessage[] {
  if (messages.length <= MAX_CONVERSATION_HISTORY) {
    return messages
  }

  return messages.slice(-MAX_CONVERSATION_HISTORY)
}

/**
 * Main handler
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<QAResponseData>) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  // Validate request
  if (!validateRequest(req.body)) {
    return res.status(400).json({
      ok: false,
      message: 'Missing required fields: report_id (string) and question (string)',
    })
  }

  const { report_id, question, subscription_tier = 'free' } = req.body

  try {
    // Stage 1: Verify report exists
    const { data: report, error: reportError } = await supabaseService
      .from('bazi_reports')
      .select('*')
      .eq('id', report_id)
      .single()

    if (reportError || !report) {
      return res.status(404).json({
        ok: false,
        message: 'Report not found',
      })
    }

    const typedReport = report as BaziReport

    // Stage 2: Check quota
    const quotaCheck = await checkAndUpdateQuota(report_id, subscription_tier)

    if (!quotaCheck.allowed) {
      return res.status(429).json({
        ok: false,
        message: `Quota limit reached for subscription tier: ${subscription_tier}. Please upgrade your subscription.`,
        remaining_quota: quotaCheck.remaining,
      })
    }

    // Stage 3: Load or create conversation
    const conversation = await loadOrCreateConversation(report_id, subscription_tier)

    // Stage 4: Retrieve context chunks from RAG
    const contextChunks = await retrieveContextChunks(report_id, question)

    // Stage 5: Call Gemini with QA prompt
    const geminiClient = getGeminiClient()
    const truncatedMessages = truncateHistory(conversation.messages || [])

    const prompt = buildQaPrompt(contextChunks, { messages: truncatedMessages }, question)

    const response = await withRetry(() =>
      geminiClient.generateText({
        prompt,
        timeoutMs: GEMINI_TIMEOUT_MS,
      }),
    )

    // Stage 6: Parse response
    const payload = parseGeminiJsonResponse(response, QaAnswerPayloadSchema)

    // Stage 7: Format citations
    const citations = payload.citations
      .map(citationId => {
        const chunk = contextChunks.find(c => c.id === citationId || c.id === Number(citationId))
        return chunk
          ? {
              chunk_id: typeof citationId === 'string' ? Number(citationId) : citationId,
              content: chunk.content,
              section: chunk.metadata?.section || 'general',
            }
          : null
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)

    // Stage 8: Update conversation history
    const newMessages: ConversationMessage[] = [
      ...truncatedMessages,
      {
        role: 'user',
        content: question,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content: payload.answer,
        timestamp: new Date().toISOString(),
        sources: citations.map(c => ({
          chunk_id: c.chunk_id,
          similarity: contextChunks.find(x => x.id === c.chunk_id)?.similarity || 0,
        })),
      },
    ]

    const { error: updateError } = await supabaseService
      .from('qa_conversations')
      .update({
        messages: newMessages,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)

    if (updateError) {
      console.error('[QA Ask] Warning: Failed to update conversation:', updateError)
      // Don't fail the request - conversation update is non-critical
    }

    // Return success response
    return res.json({
      ok: true,
      answer: payload.answer,
      citations,
      followUps: payload.followUps || [],
      remaining_quota: quotaCheck.remaining === -1 ? -1 : Math.max(0, quotaCheck.remaining),
    })
  } catch (error: any) {
    console.error('[QA Ask] Error:', error)

    // Handle specific error cases
    if (error.message?.includes('Quota limit')) {
      return res.status(429).json({
        ok: false,
        message: error.message,
        remaining_quota: 0,
      })
    }

    return res.status(500).json({
      ok: false,
      message: error.message || 'Internal server error',
    })
  }
}
