import { supabaseService } from '../lib/supabase'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function processJobs() {
  const { data: jobs } = await supabaseService
    .from('jobs')
    .select('*')
    .eq('status', 'pending')
    .limit(5)
    
  for (const job of jobs || []) {
    try {
      await supabaseService
        .from('jobs')
        .update({ status: 'processing' })
        .eq('id', job.id)
        
      const { data: chartRow } = await supabaseService
        .from('charts')
        .select('*')
        .eq('id', job.chart_id)
        .single()
        
      const prompt = `请根据命盘数据生成一份1200字左右的深度报告：${JSON.stringify(chartRow.chart_json)}`
      
      const completion = await openai.chat.completions.create({ 
        model: 'gpt-4o', 
        messages: [{ role: 'user', content: prompt }], 
        max_tokens: 2000 
      })
      
      const text = completion.choices?.[0]?.message?.content || ''
      
      const path = `${job.id}.txt`
      const upload = await supabaseService.storage
        .from('reports')
        .upload(path, Buffer.from(text), { upsert: true })
        
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reports/${path}`
      
      await supabaseService
        .from('jobs')
        .update({ status: 'done', result_url: publicUrl })
        .eq('id', job.id)
        
    } catch (err: any) {
      await supabaseService
        .from('jobs')
        .update({ status: 'failed' })
        .eq('id', job.id)
        
      console.error('job failed', err)
    }
  }
}

processJobs().catch(console.error)
