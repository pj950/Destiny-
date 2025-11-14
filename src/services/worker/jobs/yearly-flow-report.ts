import type { Job } from '../types'
import { markJobStatus } from '../database'
import { loadChartWithInsights, persistReport } from '../charts'
import { generateYearlyFlowReport, getGeminiReportModelName } from '../ai'
import { processRagChunks } from '../rag'
import { withRetry, logJobProgress } from '../utils'
import type { BaziReportInsert } from '../../../../../types/database'
import { YEARLY_FLOW_PROMPT_VERSION } from '../../../../../lib/gemini/schemas'

export async function processYearlyFlowReport(job: Job): Promise<void> {
  const startTime = Date.now()
  logJobProgress(job.id, `[Stage 1/5] Processing yearly_flow_report for chart ${job.chart_id}`)
  
  // ===== Stage 1: Extract metadata =====
  const targetYear = job.metadata?.target_year || new Date().getFullYear()
  const subscriptionTier = job.metadata?.subscription_tier || 'free'
  logJobProgress(job.id, `[Stage 1] Metadata extracted - Year: ${targetYear}, Tier: ${subscriptionTier}`)
  
  // ===== Stage 2: Load chart and compute insights =====
  logJobProgress(job.id, `[Stage 2/5] Loading chart and computing insights...`)
  const { chart, baziChart, insights, birthYear } = await loadChartWithInsights(job.chart_id)
  logJobProgress(job.id, `[Stage 2] Chart loaded - Birth year: ${birthYear}`)
  
  // ===== Stage 3: Build prompt and call Gemini =====
  logJobProgress(job.id, `[Stage 3/5] Building Gemini prompt...`)
  logJobProgress(job.id, `[Stage 3] Prompt built, calling Gemini model: ${getGeminiReportModelName()}`)
  
  const payload = await withRetry(
    async () => generateYearlyFlowReport(baziChart, insights, targetYear),
    `Gemini generateText for yearly_flow_report job ${job.id}`
  )
  
  logJobProgress(job.id, `[Stage 3] Response received`)
  
  // ===== Stage 4: Parse and validate response =====
  logJobProgress(job.id, `[Stage 4/5] Response validated - Target year: ${payload.targetYear}, Energy nodes: ${payload.energyIndex.length}`)
  
  // ===== Stage 5: Persist to database =====
  logJobProgress(job.id, `[Stage 5/5] Persisting report to database...`)
  const reportData: BaziReportInsert = {
    chart_id: job.chart_id,
    user_id: job.user_id,
    report_type: 'yearly_flow',
    title: `${targetYear}年流年运势报告`,
    summary: {
      key_insights: payload.doList.slice(0, 3),
      strengths: [
        `事业运: ${payload.scorecard.career}分`,
        `财运: ${payload.scorecard.wealth}分`,
      ],
      areas_for_growth: payload.dontList.slice(0, 3),
      lucky_elements: payload.keyDomains.career.theme ? [payload.keyDomains.career.theme] : [],
      unlucky_elements: [],
    },
    structured: {
      sections: [
        {
          title: '原局结构解析',
          content: payload.natalAnalysis,
        },
        {
          title: '大运与交替提示',
          content: payload.decadeLuckAnalysis,
        },
        {
          title: '流年结构与核心命题',
          content: payload.annualFlowAnalysis,
        },
      ],
    },
    body: JSON.stringify(payload),
    model: getGeminiReportModelName(),
    prompt_version: YEARLY_FLOW_PROMPT_VERSION,
    tokens: null,
    status: 'completed',
    completed_at: new Date().toISOString(),
  }
  
  const report = await persistReport(reportData)
  logJobProgress(job.id, `[Stage 5] Report persisted - Report ID: ${report.id}`)

  // ===== Stage 6: Process chunks and embeddings for RAG =====
  logJobProgress(job.id, `[Stage 6/6] Processing text chunks and generating embeddings for RAG...`)
  try {
    // Extract report body for chunking - use structured payload for complete content
    const reportBodyForChunking = `${payload.natalAnalysis}\n\n${payload.decadeLuckAnalysis}\n\n${payload.annualFlowAnalysis}`
    await processRagChunks(report.id, reportBodyForChunking)
    logJobProgress(job.id, `[Stage 6] RAG chunks processed successfully`)
  } catch (ragError: any) {
    console.error(`[Worker] Non-fatal error processing RAG chunks for report ${report.id}:`, ragError)
    logJobProgress(job.id, `[Stage 6] RAG chunk processing skipped due to error: ${ragError.message}`)
    // Don't fail the entire job - chunking is a nice-to-have feature
  }

  // ===== Update job metadata and mark complete =====
  const generationTimeMs = Date.now() - startTime
  const updatedMetadata = {
    ...job.metadata,
    report_id: report.id,
    target_year: targetYear,
    completed_at: new Date().toISOString(),
    generation_time_ms: generationTimeMs,
    tokens_used: null, // TODO: Extract from Gemini API response when available
  }

  await markJobStatus(job.id, 'done', { metadata: updatedMetadata })
  logJobProgress(job.id, `✓ Completed successfully in ${generationTimeMs}ms - Report: ${report.id}`)
}