import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'
import { supabaseService } from '../../../lib/supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  
  const { chart_id, question } = req.body
  
  const { data: chartRow, error } = await supabaseService
    .from('charts')
    .select('*')
    .eq('id', chart_id)
    .single()
    
  if (error || !chartRow) return res.status(400).json({ ok: false, message: 'chart not found' })
  
  const chart = chartRow.chart_json
  const systemPrompt = `你是一位"东方命盘分析师"。基于下面的结构化命盘数据，生成150-200字中文解读。\n`
  const userPrompt = `命盘：${JSON.stringify(chart)}\n问题：${question}`
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 400
    })
    
    const text = completion.choices?.[0]?.message?.content || ''
    
    await supabaseService
      .from('charts')
      .update({ ai_summary: text })
      .eq('id', chart_id)
      
    res.json({ ok: true, summary: text })
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message })
  }
}
