import { supabaseService } from '../lib/supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Enforce server-only execution
if (typeof window !== 'undefined') {
  throw new Error('Worker must run in Node.js environment, not in the browser')
}

// Validate required environment variables
if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY environment variable is required')
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required')
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
const GEMINI_REPORT_MODEL = process.env.GEMINI_MODEL_REPORT ?? 'gemini-2.5-pro'
const BATCH_SIZE = 5
const DELAY_BETWEEN_JOBS_MS = 1000 // 1 second delay to avoid hammering Gemini

console.log('[Worker] Starting worker...')
console.log(`[Worker] Using Gemini model: ${GEMINI_REPORT_MODEL}`)

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function processJobs() {
  console.log('[Worker] Fetching pending jobs...')
  
  const { data: jobs, error: fetchError } = await supabaseService
    .from('jobs')
    .select('*')
    .eq('status', 'pending')
    .eq('job_type', 'deep_report')
    .limit(BATCH_SIZE)
    
  if (fetchError) {
    console.error('[Worker] Error fetching jobs:', fetchError)
    throw fetchError
  }

  if (!jobs || jobs.length === 0) {
    console.log('[Worker] No pending jobs found')
    return 0
  }

  console.log(`[Worker] Found ${jobs.length} pending job(s)`)
    
  for (const job of jobs) {
    console.log(`[Worker] Processing job ${job.id}...`)
    
    try {
      // Mark job as processing
      const { error: updateError } = await supabaseService
        .from('jobs')
        .update({ 
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
        
      if (updateError) {
        console.error(`[Worker] Error updating job ${job.id} to processing:`, updateError)
        throw updateError
      }
      
      console.log(`[Worker] Job ${job.id} marked as processing`)
      
      // Fetch chart data
      console.log(`[Worker] Fetching chart ${job.chart_id}...`)
      const { data: chartRow, error: chartError } = await supabaseService
        .from('charts')
        .select('*')
        .eq('id', job.chart_id)
        .single()
        
      if (chartError || !chartRow) {
        console.error(`[Worker] Error fetching chart ${job.chart_id}:`, chartError)
        throw new Error(`Chart not found: ${job.chart_id}`)
      }
      
      console.log(`[Worker] Chart ${job.chart_id} fetched successfully`)
      
      // Generate report with Gemini
      console.log(`[Worker] Generating report with Gemini (model: ${GEMINI_REPORT_MODEL})...`)
      const prompt = `请根据命盘数据生成一份1200字左右的深度报告：${JSON.stringify(chartRow.chart_json)}`
      
      const model = genAI.getGenerativeModel({ model: GEMINI_REPORT_MODEL })
      const result = await model.generateContent(prompt)
      const reportText = result.response.text()
      
      if (!reportText) {
        throw new Error('Gemini returned empty response')
      }
      
      console.log(`[Worker] Report generated (${reportText.length} characters)`)
      
      // Upload report to Supabase Storage
      const reportPath = `${job.id}.txt`
      console.log(`[Worker] Uploading report to storage bucket 'reports' as ${reportPath}...`)
      
      const { error: uploadError } = await supabaseService.storage
        .from('reports')
        .upload(reportPath, Buffer.from(reportText), { upsert: true })
        
      if (uploadError) {
        console.error(`[Worker] Error uploading report:`, uploadError)
        throw uploadError
      }
      
      console.log(`[Worker] Report uploaded successfully`)
      
      // Generate public URL
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reports/${reportPath}`
      console.log(`[Worker] Public URL: ${publicUrl}`)
      
      // Mark job as done
      const { error: doneError } = await supabaseService
        .from('jobs')
        .update({ 
          status: 'done', 
          result_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
        
      if (doneError) {
        console.error(`[Worker] Error marking job ${job.id} as done:`, doneError)
        throw doneError
      }
      
      console.log(`[Worker] Job ${job.id} completed successfully ✓`)
      
    } catch (err: any) {
      // Mark job as failed with error message
      console.error(`[Worker] Job ${job.id} failed:`, err)
      
      const errorMessage = err?.message || String(err)
      
      const { error: failError } = await supabaseService
        .from('jobs')
        .update({ 
          status: 'failed',
          metadata: {
            ...job.metadata,
            error: errorMessage,
            failed_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
        
      if (failError) {
        console.error(`[Worker] Error marking job ${job.id} as failed:`, failError)
      } else {
        console.log(`[Worker] Job ${job.id} marked as failed ✗`)
      }
    }
    
    // Rate limiting: delay between jobs to avoid hammering Gemini
    if (jobs.indexOf(job) < jobs.length - 1) {
      console.log(`[Worker] Waiting ${DELAY_BETWEEN_JOBS_MS}ms before next job...`)
      await sleep(DELAY_BETWEEN_JOBS_MS)
    }
  }
  
  return jobs.length
}

async function runWorker() {
  try {
    const processedCount = await processJobs()
    
    if (processedCount > 0) {
      console.log(`[Worker] Processed ${processedCount} job(s)`)
    }
    
    console.log('[Worker] Worker finished successfully')
    process.exit(0)
  } catch (err) {
    console.error('[Worker] Worker failed with error:', err)
    process.exit(1)
  }
}

// Run the worker
runWorker()
