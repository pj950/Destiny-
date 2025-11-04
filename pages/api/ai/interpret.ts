import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'
import { supabaseService } from '../../../lib/supabase'

// Guard: Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not configured. Please set it in your .env.local file.')
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000 // 30 second timeout
})

// Use environment variable for model selection, default to gpt-4o-mini
const MODEL = process.env.OPENAI_MODEL_SUMMARY || 'gpt-4o-mini'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  
  const { chart_id, question } = req.body
  
  // Input validation
  if (!chart_id || typeof chart_id !== 'string') {
    return res.status(400).json({ ok: false, message: 'chart_id is required' })
  }
  
  try {
    const { data: chartRow, error } = await supabaseService
      .from('charts')
      .select('*')
      .eq('id', chart_id)
      .single()
      
    if (error || !chartRow) {
      return res.status(404).json({ ok: false, message: 'Chart not found' })
    }
    
    const chart = chartRow.chart_json
    const systemPrompt = `你是一位"东方命盘分析师"。基于下面的结构化命盘数据，生成150-200字中文解读。\n`
    const userPrompt = `命盘：${JSON.stringify(chart)}\n问题：${question || '请解读此命盘'}`
    
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 400,
      temperature: 0.7
    })
    
    const text = completion.choices?.[0]?.message?.content || ''
    
    if (!text) {
      return res.status(500).json({ ok: false, message: 'OpenAI returned empty response' })
    }
    
    await supabaseService
      .from('charts')
      .update({ ai_summary: text })
      .eq('id', chart_id)
      
    res.json({ ok: true, summary: text })
  } catch (err: any) {
    // Better error handling for different error types
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return res.status(504).json({ 
        ok: false, 
        message: 'OpenAI request timed out after 30 seconds. Please try again.' 
      })
    }
    
    if (err.status === 401) {
      return res.status(500).json({ 
        ok: false, 
        message: 'OpenAI authentication failed. Please verify your OPENAI_API_KEY is valid.' 
      })
    }
    
    if (err.status === 429) {
      return res.status(429).json({ 
        ok: false, 
        message: 'OpenAI rate limit exceeded. Please try again later or upgrade your OpenAI plan.' 
      })
    }
    
    if (err.status === 500) {
      return res.status(500).json({ 
        ok: false, 
        message: 'OpenAI service error. Please try again later.' 
      })
    }
    
    return res.status(500).json({ 
      ok: false, 
      message: `AI interpretation failed: ${err.message || 'Unknown error'}` 
    })
  }
}
