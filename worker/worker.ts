import { supabaseService } from '../lib/supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiClient, parseGeminiJsonResponse, buildYearlyFlowPrompt } from '../lib/gemini'
import { analyzeBaziInsights } from '../lib/bazi-insights'
import { YearlyFlowPayloadSchema, YEARLY_FLOW_PROMPT_VERSION } from '../lib/gemini/schemas'
import type { Chart, BaziReport, BaziReportInsert } from '../types/database'
import type { BaziChart } from '../lib/bazi'

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
const MAX_RETRIES = 3
const RETRY_BACKOFF_BASE_MS = 2000

// Supported job types
const SUPPORTED_JOB_TYPES = ['deep_report', 'yearly_flow_report'] as const
type SupportedJobType = typeof SUPPORTED_JOB_TYPES[number]

interface Job {
  id: string
  user_id: string | null
  chart_id: string
  job_type: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  result_url: string | null
  metadata: Record<string, any> | null
  created_at: string
  updated_at?: string
}

console.log('[Worker] Starting worker...')
console.log(`[Worker] Using Gemini model: ${GEMINI_REPORT_MODEL}`)
console.log(`[Worker] Supported job types: ${SUPPORTED_JOB_TYPES.join(', ')}`)

// ============================================================================
// Utility Functions
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function logJobProgress(jobId: string, message: string): void {
  const timestamp = new Date().toISOString()
  console.log(`[Worker][${timestamp}][Job ${jobId}] ${message}`)
}

async function fetchPendingJobs(jobTypes: string[]): Promise<Job[]> {
  console.log(`[Worker] Fetching pending jobs for types: ${jobTypes.join(', ')}...`)
  
  const { data: jobs, error: fetchError } = await supabaseService
    .from('jobs')
    .select('*')
    .eq('status', 'pending')
    .in('job_type', jobTypes)
    .limit(BATCH_SIZE)
    
  if (fetchError) {
    console.error('[Worker] Error fetching jobs:', fetchError)
    throw fetchError
  }

  return (jobs || []) as Job[]
}

async function markJobStatus(
  jobId: string,
  status: Job['status'],
  updates: { result_url?: string; metadata?: Record<string, any> } = {}
): Promise<void> {
  const payload: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (updates.result_url !== undefined) {
    payload.result_url = updates.result_url
  }

  if (updates.metadata !== undefined) {
    payload.metadata = updates.metadata
  }

  const { error: updateError } = await supabaseService
    .from('jobs')
    .update(payload)
    .eq('id', jobId)
    
  if (updateError) {
    console.error(`[Worker] Error updating job ${jobId} to ${status}:`, updateError)
    throw updateError
  }
  
  logJobProgress(jobId, `Status updated to: ${status}`)
}

interface ChartWithInsights {
  chart: Chart
  baziChart: BaziChart
  insights: ReturnType<typeof analyzeBaziInsights>
  birthYear: number
}

async function loadChartWithInsights(chartId: string): Promise<ChartWithInsights> {
  logJobProgress(chartId, `Loading chart and computing insights...`)
  
  const { data: chartRow, error: chartError } = await supabaseService
    .from('charts')
    .select('*')
    .eq('id', chartId)
    .single()
    
  if (chartError || !chartRow) {
    console.error(`[Worker] Error fetching chart ${chartId}:`, chartError)
    throw new Error(`Chart not found: ${chartId}`)
  }
  
  const chart = chartRow as Chart
  const baziChart = chart.chart_json as BaziChart
  const birthYear = baziChart?.meta?.lunar?.cYear || new Date().getFullYear()
  const insights = analyzeBaziInsights(baziChart, birthYear)
  
  logJobProgress(chartId, `Chart loaded successfully`)
  
  return {
    chart,
    baziChart,
    insights,
    birthYear,
  }
}

async function persistReport(data: BaziReportInsert): Promise<BaziReport> {
  const { data: insertedReport, error: insertError } = await supabaseService
    .from('bazi_reports')
    .insert([data])
    .select()
    .single()

  if (insertError || !insertedReport) {
    console.error('[Worker] Failed to insert report:', insertError)
    throw new Error('Failed to persist report to database')
  }

  return insertedReport as BaziReport
}

function isRetryableError(error: any): boolean {
  const message = error?.message || ''
  const status = error?.status || error?.code
  
  // Check for rate limit or temporary errors
  if (typeof status === 'number' && [408, 409, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true
  }
  
  // Check error message for rate limit indicators
  return /rate limit|quota|temporarily unavailable|timeout|ECONNRESET/i.test(message)
}

async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: any
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      
      if (!isRetryableError(error) || attempt >= maxRetries) {
        throw error
      }
      
      const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt - 1)
      console.log(`[Worker] ${context} failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms...`)
      console.log(`[Worker] Error: ${error.message}`)
      await sleep(backoffMs)
    }
  }
  
  throw lastError
}

// ============================================================================
// Job Processors
// ============================================================================

async function processDeepReport(job: Job): Promise<void> {
  const startTime = Date.now()
  logJobProgress(job.id, `Processing deep_report for chart ${job.chart_id}`)
  
  // Fetch chart data
  logJobProgress(job.id, `Fetching chart ${job.chart_id}...`)
  const { data: chartRow, error: chartError } = await supabaseService
    .from('charts')
    .select('*')
    .eq('id', job.chart_id)
    .single()
    
  if (chartError || !chartRow) {
    console.error(`[Worker] Error fetching chart ${job.chart_id}:`, chartError)
    throw new Error(`Chart not found: ${job.chart_id}`)
  }
  
  logJobProgress(job.id, `Chart fetched successfully`)
  
  // Generate report with Gemini (with retry)
  logJobProgress(job.id, `Generating report with Gemini (model: ${GEMINI_REPORT_MODEL})...`)
  const prompt = `请根据命盘数据生成一份1200字左右的深度报告：${JSON.stringify(chartRow.chart_json)}`
  
  const reportText = await withRetry(
    async () => {
      const model = genAI.getGenerativeModel({ model: GEMINI_REPORT_MODEL })
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      
      if (!text) {
        throw new Error('Gemini returned empty response')
      }
      
      return text
    },
    `Gemini generateContent for job ${job.id}`
  )
  
  logJobProgress(job.id, `Report generated (${reportText.length} characters)`)
  
  // Upload report to Supabase Storage
  const reportPath = `${job.id}.txt`
  logJobProgress(job.id, `Uploading report to storage bucket 'reports' as ${reportPath}...`)
  
  const { error: uploadError } = await supabaseService.storage
    .from('reports')
    .upload(reportPath, Buffer.from(reportText), { upsert: true })
    
  if (uploadError) {
    console.error(`[Worker] Error uploading report:`, uploadError)
    throw uploadError
  }
  
  logJobProgress(job.id, `Report uploaded successfully`)
  
  // Generate public URL
  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reports/${reportPath}`
  logJobProgress(job.id, `Public URL: ${publicUrl}`)
  
  // Mark job as done
  await markJobStatus(job.id, 'done', { result_url: publicUrl })
  
  const duration = Date.now() - startTime
  logJobProgress(job.id, `Completed successfully in ${duration}ms ✓`)
}

async function processYearlyFlowReport(job: Job): Promise<void> {
  const startTime = Date.now()
  logJobProgress(job.id, `Processing yearly_flow_report for chart ${job.chart_id}`)
  
  // Extract target year from metadata
  const targetYear = job.metadata?.target_year || new Date().getFullYear()
  logJobProgress(job.id, `Target year: ${targetYear}`)
  
  // Load chart with insights
  const { chart, baziChart, insights, birthYear } = await loadChartWithInsights(job.chart_id)
  
  // Build prompt
  const prompt = buildYearlyFlowPrompt(baziChart, insights, targetYear)
  logJobProgress(job.id, `Generating yearly flow report with Gemini...`)
  
  // Call Gemini with retry
  const response = await withRetry(
    async () => {
      const geminiClient = getGeminiClient()
      return await geminiClient.generateText({ prompt })
    },
    `Gemini generateText for yearly_flow_report job ${job.id}`
  )
  
  logJobProgress(job.id, `Response received (${response.length} characters)`)
  
  // Parse and validate response
  const payload = parseGeminiJsonResponse(response, YearlyFlowPayloadSchema)
  logJobProgress(job.id, `Response parsed and validated`)
  
  // Persist report to bazi_reports table
  const reportData: BaziReportInsert = {
    chart_id: job.chart_id,
    user_id: job.user_id,
    report_type: 'yearly_flow',
    title: `Yearly Flow ${targetYear} - ${chart.id}`,
    summary: {
      key_insights: payload.doList.slice(0, 3),
      strengths: [payload.scorecard.career.toString(), payload.scorecard.wealth.toString()],
      areas_for_growth: payload.dontList.slice(0, 3),
    },
    structured: {
      sections: [
        {
          title: 'Natal Analysis',
          content: payload.natalAnalysis,
        },
        {
          title: 'Decade Luck Analysis',
          content: payload.decadeLuckAnalysis,
        },
        {
          title: 'Annual Flow Analysis',
          content: payload.annualFlowAnalysis,
        },
      ],
    },
    body: JSON.stringify(payload),
    model: GEMINI_REPORT_MODEL,
    prompt_version: YEARLY_FLOW_PROMPT_VERSION,
    tokens: null,
    status: 'completed',
    completed_at: new Date().toISOString(),
  }
  
  const report = await persistReport(reportData)
  logJobProgress(job.id, `Report persisted with id: ${report.id}`)
  
  // Update job metadata with report_id
  const updatedMetadata = {
    ...job.metadata,
    report_id: report.id,
    target_year: targetYear,
    completed_at: new Date().toISOString(),
  }
  
  // Mark job as done
  await markJobStatus(job.id, 'done', { metadata: updatedMetadata })
  
  const duration = Date.now() - startTime
  logJobProgress(job.id, `Completed successfully in ${duration}ms ✓`)
}

// ============================================================================
// Main Job Router
// ============================================================================

async function processJob(job: Job): Promise<void> {
  logJobProgress(job.id, `Routing job type: ${job.job_type}`)
  
  // Mark as processing
  await markJobStatus(job.id, 'processing')
  
  switch (job.job_type as SupportedJobType) {
    case 'deep_report':
      return await processDeepReport(job)
    
    case 'yearly_flow_report':
      return await processYearlyFlowReport(job)
    
    default:
      throw new Error(`Unknown job type: ${job.job_type}`)
  }
}

// ============================================================================
// Main Processing Loop
// ============================================================================

async function processJobs(): Promise<number> {
  const jobs = await fetchPendingJobs([...SUPPORTED_JOB_TYPES])

  if (!jobs || jobs.length === 0) {
    console.log('[Worker] No pending jobs found')
    return 0
  }

  console.log(`[Worker] Found ${jobs.length} pending job(s)`)
    
  for (const job of jobs) {
    try {
      await processJob(job)
    } catch (err: any) {
      // Mark job as failed with error message
      console.error(`[Worker] Job ${job.id} failed:`, err)
      
      const errorMessage = err?.message || String(err)
      const errorStack = err?.stack || ''
      
      const failedMetadata = {
        ...job.metadata,
        error: errorMessage,
        error_stack: errorStack,
        failed_at: new Date().toISOString(),
      }
      
      try {
        await markJobStatus(job.id, 'failed', { metadata: failedMetadata })
        logJobProgress(job.id, `Marked as failed ✗`)
      } catch (failError) {
        console.error(`[Worker] Error marking job ${job.id} as failed:`, failError)
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

// ============================================================================
// Worker Entry Point
// ============================================================================

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
