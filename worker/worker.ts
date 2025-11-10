import { supabaseService } from '../lib/supabase'
import { getGeminiClient } from '../lib/gemini/client'
import { buildYearlyFlowPrompt } from '../lib/gemini/prompts'
import { parseGeminiJsonResponse } from '../lib/gemini/parser'
import { YearlyFlowPayloadSchema } from '../lib/gemini/schemas'
import { analyzeBaziInsights } from '../lib/bazi-insights'
import type { BaziReport, BaziReportChunk, Job } from '../types/database'
import type { BaziChart } from '../lib/bazi'
import type { YearlyFlowPayload } from '../lib/gemini/schemas'

// Enforce server-only execution
if (typeof window !== 'undefined') {
  throw new Error('Worker must run in Node.js environment, not in the browser')
}

// Validate required environment variables
const requiredEnvVars = [
  'GOOGLE_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 
  'NEXT_PUBLIC_SUPABASE_URL'
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
}

// Configuration
const BATCH_SIZE = 5
const DELAY_BETWEEN_JOBS_MS = 1000
const CHUNK_SIZE = 500 // ~500 Chinese characters per chunk
const GEMINI_REPORT_MODEL = process.env.GEMINI_MODEL_REPORT ?? 'gemini-2.5-pro'

console.log('[Worker] Starting worker...')
console.log(`[Worker] Using Gemini model: ${GEMINI_REPORT_MODEL}`)

// ============================================================================
// Utility Functions
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return String(error)
}

// ============================================================================
// Database Functions
// ============================================================================

async function fetchPendingJobs(jobType?: string): Promise<Job[]> {
  console.log(`[Worker] Fetching pending jobs${jobType ? ` of type: ${jobType}` : ''}...`)
  
  let query = supabaseService
    .from('jobs')
    .select('*')
    .eq('status', 'pending')
    .limit(BATCH_SIZE)
    
  if (jobType) {
    query = query.eq('job_type', jobType)
  }
  
  const { data: jobs, error } = await query
  
  if (error) {
    console.error('[Worker] Error fetching jobs:', error)
    throw error
  }

  if (!jobs || jobs.length === 0) {
    console.log('[Worker] No pending jobs found')
    return []
  }

  console.log(`[Worker] Found ${jobs.length} pending job(s)`)
  return jobs
}

async function markJobStatus(jobId: string, status: 'processing' | 'done' | 'failed', metadata?: Record<string, any>): Promise<void> {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString()
  }
  
  if (metadata) {
    updateData.metadata = metadata
  }
  
  const { error } = await supabaseService
    .from('jobs')
    .update(updateData)
    .eq('id', jobId)
    
  if (error) {
    console.error(`[Worker] Error updating job ${jobId} to ${status}:`, error)
    throw error
  }
  
  console.log(`[Worker] Job ${jobId} marked as ${status}`)
}

async function loadChartWithInsights(chartId: string): Promise<{ chart: BaziChart, insights: any }> {
  console.log(`[Worker] Fetching chart ${chartId}...`)
  
  const { data: chartRow, error: chartError } = await supabaseService
    .from('charts')
    .select('*')
    .eq('id', chartId)
    .single()
    
  if (chartError || !chartRow) {
    console.error(`[Worker] Error fetching chart ${chartId}:`, chartError)
    throw new Error(`Chart not found: ${chartId}`)
  }
  
  const chart: BaziChart = chartRow.chart_json
  const birthYear = chart.meta?.lunar?.cYear ? parseInt(chart.meta.lunar.cYear) : new Date().getFullYear()
  const insights = analyzeBaziInsights(chart, birthYear)
  
  console.log(`[Worker] Chart ${chartId} and insights loaded successfully`)
  return { chart, insights }
}

async function persistReport(
  chartId: string,
  reportType: 'character_profile' | 'yearly_flow',
  title: string,
  structured: any,
  body: string | null = null,
  summary: any = null
): Promise<string> {
  console.log(`[Worker] Persisting ${reportType} report...`)
  
  const reportData: Partial<BaziReport> = {
    chart_id: chartId,
    user_id: null, // MVP: no user authentication
    report_type: reportType,
    title,
    summary,
    structured,
    body,
    model: GEMINI_REPORT_MODEL,
    prompt_version: structured.promptVersion,
    tokens: null, // Could be calculated if needed
    status: 'completed',
    completed_at: new Date().toISOString()
  }
  
  const { data: report, error } = await supabaseService
    .from('bazi_reports')
    .insert(reportData)
    .select('id')
    .single()
    
  if (error || !report) {
    console.error('[Worker] Error persisting report:', error)
    throw error
  }
  
  console.log(`[Worker] Report persisted with ID: ${report.id}`)
  return report.id
}

// ============================================================================
// Text Chunking and Embedding Functions
// ============================================================================

function chunkReportContent(content: string, chunkSize: number = CHUNK_SIZE): string[] {
  console.log(`[Worker] Chunking content (${content.length} chars) into pieces of ~${chunkSize} chars...`)
  
  const chunks: string[] = []
  const sentences = content.match(/[^。！？.!?]+[。！？.!?]/g) || [content]
  
  let currentChunk = ''
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += sentence
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  console.log(`[Worker] Created ${chunks.length} chunks`)
  return chunks
}

async function storeEmbeddings(reportId: string, chunks: string[]): Promise<void> {
  console.log(`[Worker] Generating and storing embeddings for ${chunks.length} chunks...`)
  
  const geminiClient = getGeminiClient()
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    
    try {
      const embedding = await geminiClient.generateEmbedding({
        input: chunk
      })
      
      const chunkData: Partial<BaziReportChunk> = {
        report_id: reportId,
        chunk_index: i,
        content: chunk,
        embedding,
        metadata: {
          section: 'yearly_flow_report',
          chunk_count: chunks.length,
          chunk_index: i
        }
      }
      
      const { error } = await supabaseService
        .from('bazi_report_chunks')
        .insert(chunkData)
        
      if (error) {
        console.error(`[Worker] Error storing chunk ${i}:`, error)
        throw error
      }
      
      console.log(`[Worker] Chunk ${i + 1}/${chunks.length} stored successfully`)
      
      // Rate limiting for embeddings
      if (i < chunks.length - 1) {
        await sleep(200) // 200ms delay between embedding requests
      }
      
    } catch (error) {
      console.error(`[Worker] Error generating embedding for chunk ${i}:`, error)
      throw error
    }
  }
  
  console.log(`[Worker] All embeddings stored successfully`)
}

// ============================================================================
// Job Type Handlers
// ============================================================================

async function handleDeepReportJob(job: Job): Promise<string> {
  console.log(`[Worker] Processing deep_report job ${job.id}...`)
  
  const { chart } = await loadChartWithInsights(job.chart_id)
  
  // Generate report with Gemini (legacy format)
  const geminiClient = getGeminiClient()
  const prompt = `请根据命盘数据生成一份1200字左右的深度报告：${JSON.stringify(chart)}`
  
  const reportText = await geminiClient.generateText({
    prompt,
    model: GEMINI_REPORT_MODEL
  })
  
  if (!reportText) {
    throw new Error('Gemini returned empty response')
  }
  
  console.log(`[Worker] Report generated (${reportText.length} characters)`)
  
  // Upload report to Supabase Storage (legacy approach)
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
  
  return publicUrl
}

async function handleYearlyFlowReportJob(job: Job): Promise<string> {
  console.log(`[Worker] Processing yearly_flow_report job ${job.id}...`)
  
  // Extract metadata
  const targetYear = job.metadata?.target_year || new Date().getFullYear()
  const subscriptionTier = job.metadata?.subscription_tier || 'free'
  
  console.log(`[Worker] Target year: ${targetYear}, Subscription tier: ${subscriptionTier}`)
  
  const { chart, insights } = await loadChartWithInsights(job.chart_id)
  
  // Generate structured report using new prompt system
  const geminiClient = getGeminiClient()
  const prompt = buildYearlyFlowPrompt(chart, insights, targetYear)
  
  console.log(`[Worker] Generating yearly flow report with Gemini...`)
  const rawResponse = await geminiClient.generateText({
    prompt,
    model: GEMINI_REPORT_MODEL
  })
  
  if (!rawResponse) {
    throw new Error('Gemini returned empty response')
  }
  
  console.log(`[Worker] Raw response received (${rawResponse.length} characters)`)
  
  // Parse structured response
  const structuredReport = parseGeminiJsonResponse(
    rawResponse,
    YearlyFlowPayloadSchema,
    { responseLabel: 'Yearly flow report' }
  )
  
  console.log(`[Worker] Structured report parsed successfully`)
  
  // Create report body text for chunking
  const reportBody = JSON.stringify(structuredReport, null, 2)
  
  // Persist report to database
  const reportId = await persistReport(
    job.chart_id,
    'yearly_flow',
    `${targetYear}年流年导航`,
    structuredReport,
    reportBody
  )
  
  // Chunk the content and generate embeddings
  const chunks = chunkReportContent(reportBody)
  await storeEmbeddings(reportId, chunks)
  
  // Generate frontend-accessible URL
  const reportUrl = `/reports/${reportId}`
  console.log(`[Worker] Report URL: ${reportUrl}`)
  
  return reportUrl
}

// ============================================================================
// Main Processing Logic
// ============================================================================

async function processJob(job: Job): Promise<string> {
  const startTime = Date.now()
  
  try {
    // Mark job as processing
    await markJobStatus(job.id, 'processing')
    
    let resultUrl: string
    
    // Route to appropriate handler based on job type
    switch (job.job_type) {
      case 'deep_report':
        resultUrl = await handleDeepReportJob(job)
        break
        
      case 'yearly_flow_report':
        resultUrl = await handleYearlyFlowReportJob(job)
        break
        
      default:
        throw new Error(`Unsupported job type: ${job.job_type}`)
    }
    
    // Mark job as done with result
    const processingTime = Date.now() - startTime
    await markJobStatus(job.id, 'done', {
      ...job.metadata,
      result_url: resultUrl,
      processing_time_ms: processingTime,
      completed_at: new Date().toISOString()
    })
    
    // Update result_url field separately for compatibility
    await supabaseService
      .from('jobs')
      .update({ result_url: resultUrl })
      .eq('id', job.id)
    
    console.log(`[Worker] Job ${job.id} completed successfully in ${processingTime}ms ✓`)
    return resultUrl
    
  } catch (err: any) {
    const processingTime = Date.now() - startTime
    const errorMessage = extractErrorMessage(err)
    
    console.error(`[Worker] Job ${job.id} failed after ${processingTime}ms:`, err)
    
    // Mark job as failed with error details
    await markJobStatus(job.id, 'failed', {
      ...job.metadata,
      error: errorMessage,
      processing_time_ms: processingTime,
      failed_at: new Date().toISOString()
    })
    
    throw err
  }
}

async function processJobs(): Promise<number> {
  const jobs = await fetchPendingJobs()
  
  if (jobs.length === 0) {
    return 0
  }
  
  for (const job of jobs) {
    try {
      await processJob(job)
    } catch (err) {
      // Error is already handled in processJob
      console.error(`[Worker] Failed to process job ${job.id}:`, err)
    }
    
    // Rate limiting: delay between jobs
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
    } else {
      console.log('[Worker] No jobs to process')
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