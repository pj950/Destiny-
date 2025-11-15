import type { NextApiRequest, NextApiResponse } from 'next'
import { getGeminiClient } from '../../../lib/gemini/client'
import { buildQaPrompt, type QaContextChunk, type QaConversationSnapshot } from '../../../lib/gemini/prompts'
import { parseGeminiJsonResponse } from '../../../lib/gemini/parser'
import { QaAnswerPayloadSchema } from '../../../lib/gemini/schemas'
import { supabaseService } from '../../../lib/supabase'
import { 
  searchQaContextChunks, 
  extractQaContextChunks, 
  formatCitations,
  generateFollowUpQuestions,
  validateSearchResults 
} from '../../../lib/rag'
import {
  getOrCreateConversation,
  addMessageToConversation,
  trimConversationMessages,
  checkQuestionQuota,
  incrementQuestionUsage,
  type SubscriptionTier
} from '../../../lib/qa-conversation'
import type { ConversationMessage, BaziReport } from '../../../types/database'

// Configuration
const MAX_CONTEXT_MESSAGES = 10
const DEFAULT_CHUNK_LIMIT = 5
const SIMILARITY_THRESHOLD = 0.5

interface AskRequest {
  report_id: string
  question: string
  subscription_tier?: SubscriptionTier
  user_id?: string
  metadata?: Record<string, any>
}

interface AskResponse {
  ok: boolean
  answer?: string
  citations?: number[]
  followUps?: string[]
  conversationId?: string
  quotaUsed?: {
    used: number
    limit: number
    remaining: number
  }
  upgradeHint?: string
  paymentLink?: string
  message?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  try {
    const { report_id, question, subscription_tier = 'free', user_id, metadata } = req.body as AskRequest

    // Validate request
    if (!report_id || typeof report_id !== 'string') {
      return res.status(400).json({ ok: false, message: 'report_id is required' })
    }

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ ok: false, message: 'question is required and cannot be empty' })
    }

    if (question.length > 500) {
      return res.status(400).json({ ok: false, message: 'question must be 500 characters or less' })
    }

    // Verify report exists
    const { data: report, error: reportError } = await supabaseService
      .from('bazi_reports')
      .select('*')
      .eq('id', report_id)
      .single()

    if (reportError || !report) {
      return res.status(404).json({ ok: false, message: 'Report not found' })
    }

    const typedReport = report as BaziReport

    // Check question quota
    const quotaCheck = await checkQuestionQuota(user_id || 'anonymous', report_id, subscription_tier)
    
    if (!quotaCheck.hasQuota) {
      const upgradeMessage = subscription_tier === 'free' 
        ? '升级到基础版或更高版本以获得更多提问次数'
        : '您已达到本周期的提问限制，可以购买额外次数或升级套餐'

      return res.status(429).json({
        ok: false,
        message: upgradeMessage,
        quotaUsed: {
          used: quotaCheck.questionsUsed,
          limit: quotaCheck.questionsLimit,
          remaining: 0
        },
        upgradeHint: upgradeMessage,
        // TODO: Implement payment link generation when Razorpay integration is ready
        // paymentLink: await createPaymentLink(user_id, report_id, subscription_tier)
      } as AskResponse)
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(user_id || null, report_id, subscription_tier)

    // Search for relevant chunks using RAG
    console.log(`[QA] Searching chunks for report ${report_id}, question: "${question}"`)
    const searchResults = await searchQaContextChunks(
      report_id,
      question,
      DEFAULT_CHUNK_LIMIT,
      SIMILARITY_THRESHOLD
    )

    const validatedResults = validateSearchResults(searchResults)
    const contextChunks = extractQaContextChunks(validatedResults, DEFAULT_CHUNK_LIMIT)

    if (contextChunks.length === 0) {
      // No relevant content found
      const noContentResponse: AskResponse = {
        ok: true,
        answer: '抱歉，我在您的命盘报告中没有找到与您问题相关的内容。请尝试用不同的方式提问，或者上传更详细的命盘资料。',
        citations: [],
        followUps: [
          '能详细说明一下您想了解的方面吗？',
          '您希望了解事业、财运、感情还是其他方面？',
          '可以提供更多背景信息吗？'
        ],
        conversationId: conversation.id,
        quotaUsed: {
          used: quotaCheck.questionsUsed,
          limit: quotaCheck.questionsLimit,
          remaining: quotaCheck.questionsLimit - quotaCheck.questionsUsed - 1
        }
      }

      // Still increment usage since we processed the question
      await incrementQuestionUsage(user_id || 'anonymous', report_id, subscription_tier)

      // Add messages to conversation
      const userMessage: ConversationMessage = {
        role: 'user',
        content: question,
        timestamp: new Date().toISOString()
      }

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: noContentResponse.answer!,
        timestamp: new Date().toISOString(),
        sources: []
      }

      await addMessageToConversation(conversation.id, userMessage, subscription_tier)
      await addMessageToConversation(conversation.id, assistantMessage, subscription_tier)

      return res.json(noContentResponse)
    }

    // Prepare conversation history for context
    const trimmedMessages = trimConversationMessages(
      conversation.messages as ConversationMessage[],
      MAX_CONTEXT_MESSAGES
    )

    const conversationSnapshot: QaConversationSnapshot = {
      messages: trimmedMessages
    }

    // Convert context chunks to the format expected by the prompt
    const qaContextChunks: QaContextChunk[] = contextChunks.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      metadata: chunk.metadata,
      similarity: chunk.similarity
    }))

    // Build QA prompt
    const prompt = buildQaPrompt(qaContextChunks, conversationSnapshot, question)
    console.log(`[QA] Generated prompt (${prompt.length} chars) with ${contextChunks.length} context chunks`)

    // Call Gemini
    const startTime = Date.now()
    const client = getGeminiClient()
    const response = await client.generateText({
      prompt,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
      timeoutMs: 30000,
    })

    const responseText = response
    const responseTime = Date.now() - startTime

    console.log(`[QA] Gemini response received (${responseTime}ms, ${responseText.length} chars)`)

    // Parse response
    const qaAnswer = parseGeminiJsonResponse(responseText, QaAnswerPayloadSchema, {
      responseLabel: 'QA Answer'
    })

    // Format citations
    const citations = formatCitations(contextChunks)

    // Generate follow-up questions
    const followUps = generateFollowUpQuestions(question, qaAnswer.answer)

    // Increment usage
    await incrementQuestionUsage(user_id || 'anonymous', report_id, subscription_tier)

    // Add messages to conversation
    const userMessage: ConversationMessage = {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString()
    }

    const assistantMessage: ConversationMessage = {
      role: 'assistant',
      content: qaAnswer.answer,
      timestamp: new Date().toISOString(),
      sources: contextChunks.map(chunk => ({
        chunk_id: chunk.id,
        similarity: chunk.similarity
      }))
    }

    await addMessageToConversation(conversation.id, userMessage, subscription_tier)
    await addMessageToConversation(conversation.id, assistantMessage, subscription_tier)

    // Prepare response
    const response_data: AskResponse = {
      ok: true,
      answer: qaAnswer.answer,
      citations: citations.length > 0 ? citations : qaAnswer.citations as number[],
      followUps: followUps.length > 0 ? followUps : qaAnswer.followUps,
      conversationId: conversation.id,
      quotaUsed: {
        used: quotaCheck.questionsUsed + 1,
        limit: quotaCheck.questionsLimit,
        remaining: quotaCheck.questionsLimit - quotaCheck.questionsUsed - 1
      }
    }

    // Add upgrade hint for free users approaching limit
    if (subscription_tier === 'free' && response_data.quotaUsed!.remaining <= 2) {
      response_data.upgradeHint = '您的免费提问次数即将用完，升级到基础版获得更多咨询机会'
    }

    console.log(`[QA] Question answered successfully for report ${report_id}`)

    return res.json(response_data)

  } catch (error: any) {
    console.error('[QA] Error processing question:', error)
    
    // Return appropriate error response
    const errorMessage = error.message || 'An unexpected error occurred'
    const statusCode = errorMessage.includes('not found') ? 404 : 
                      errorMessage.includes('quota') ? 429 : 500

    return res.status(statusCode).json({
      ok: false,
      message: errorMessage
    } as AskResponse)
  }
}