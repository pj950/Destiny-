import type { NextApiRequest, NextApiResponse } from 'next'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseService } from '../../../lib/supabase'

// Guard: Check for required environment variables
if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY environment variable is not configured. Please set it in your .env.local file.')
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

// Use environment variable for model selection, default to gemini-2.5-pro
const MODEL = process.env.GEMINI_MODEL_SUMMARY || 'gemini-2.5-pro'

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
    
    const model = genAI.getGenerativeModel({ model: MODEL })
    const prompt = `${systemPrompt}\n${userPrompt}`
    
    // Create abort controller for timeout (30 seconds)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    try {
      const result = await model.generateContent(prompt)
      clearTimeout(timeoutId)
      
      const text = result.response.text()
      
      if (!text) {
        return res.status(500).json({ ok: false, message: 'Gemini returned empty response' })
      }
      
      await supabaseService
        .from('charts')
        .update({ ai_summary: text })
        .eq('id', chart_id)
        
      res.json({ ok: true, summary: text })
    } catch (genErr: any) {
      clearTimeout(timeoutId)
      throw genErr
    }
  } catch (err: any) {
    // Better error handling for different error types
    if (err.name === 'AbortError' || err.message?.includes('abort')) {
      return res.status(504).json({ 
        ok: false, 
        message: 'Gemini request timed out after 30 seconds. Please try again.' 
      })
    }
    
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return res.status(504).json({ 
        ok: false, 
        message: 'Gemini request timed out after 30 seconds. Please try again.' 
      })
    }
    
    if (err.status === 401 || err.message?.includes('API key')) {
      return res.status(500).json({ 
        ok: false, 
        message: 'Gemini authentication failed. Please verify your GOOGLE_API_KEY is valid.' 
      })
    }
    
    if (err.status === 429) {
      return res.status(429).json({ 
        ok: false, 
        message: 'Gemini rate limit exceeded. Please try again later or check your quota.' 
      })
    }
    
    if (err.status === 500 || err.status === 503) {
      return res.status(500).json({ 
        ok: false, 
        message: 'Gemini service error. Please try again later.' 
      })
    }
    
    return res.status(500).json({ 
      ok: false, 
      message: `AI interpretation failed: ${err.message || 'Unknown error'}` 
    })
  }
}
