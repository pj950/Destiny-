import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../../lib/supabase'
import { getConversationsForReport, getRetentionDays } from '../../../../lib/qa-conversation'
import type { QAConversation, SubscriptionTier } from '../../../../types/database'

interface HistoryRequest {
  report_id?: string
  subscription_tier?: SubscriptionTier
  user_id?: string
  limit?: number
}

interface HistoryResponse {
  ok: boolean
  conversations?: Array<{
    id: string
    messages: Array<{
      role: 'user' | 'assistant'
      content: string
      timestamp: string
      sources?: Array<{
        chunk_id: number
        similarity: number
      }>
    }>
    last_message_at: string
    total_questions: number
    retention_until?: string
  }>
  report_id?: string
  retention_days?: number
  message?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  try {
    const { 
      report_id, 
      subscription_tier = 'free',
      user_id,
      limit = 10 
    } = req.query as HistoryRequest

    // Validate report_id
    if (!report_id || typeof report_id !== 'string') {
      return res.status(400).json({ ok: false, message: 'report_id is required' })
    }

    // Validate limit
    const parsedLimit = parseInt(String(limit), 10)
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return res.status(400).json({ ok: false, message: 'limit must be between 1 and 50' })
    }

    // Verify report exists
    const { data: report, error: reportError } = await supabaseService
      .from('bazi_reports')
      .select('id, title, report_type')
      .eq('id', report_id)
      .single()

    if (reportError || !report) {
      return res.status(404).json({ ok: false, message: 'Report not found' })
    }

    // Get conversations with retention filtering
    const conversations = await getConversationsForReport(
      user_id || null,
      report_id,
      subscription_tier
    )

    // Apply limit and format response
    const limitedConversations = conversations.slice(0, parsedLimit)
    
    const formattedConversations = limitedConversations.map(conv => {
      const messages = conv.messages as any[]
      const totalQuestions = messages.filter(m => m.role === 'user').length

      return {
        id: conv.id,
        messages: messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.timestamp,
          sources: msg.sources || undefined
        })),
        last_message_at: conv.last_message_at,
        total_questions: totalQuestions,
        retention_until: conv.retention_until || undefined
      }
    })

    const retentionDays = getRetentionDays(subscription_tier)

    const response: HistoryResponse = {
      ok: true,
      conversations: formattedConversations,
      report_id,
      retention_days: retentionDays
    }

    // Add retention notice for non-VIP users
    if (subscription_tier !== 'vip' && retentionDays < 999) {
      response.message = `历史记录保留 ${retentionDays} 天，升级到 VIP 可永久保存所有对话`
    }

    console.log(`[QA] Retrieved ${formattedConversations.length} conversations for report ${report_id}`)

    return res.json(response)

  } catch (error: any) {
    console.error('[QA History] Error:', error)
    
    return res.status(500).json({
      ok: false,
      message: error.message || 'Failed to retrieve conversation history'
    } as HistoryResponse)
  }
}