import type { Job } from '../types'
import { markJobStatus } from '../database'
import { loadChartWithInsights, persistReport, uploadReportToStorage } from '../charts'
import { generateDeepReport } from '../ai'
import { processRagChunks } from '../rag'
import { withRetry, logJobProgress } from '../utils'
import type { BaziReportInsert } from '../../../../../types/database'

export async function processDeepReport(job: Job): Promise<void> {
  const startTime = Date.now()
  logJobProgress(job.id, `Processing deep_report for chart ${job.chart_id}`)
  
  // Fetch chart data
  logJobProgress(job.id, `Fetching chart ${job.chart_id}...`)
  const { chart } = await loadChartWithInsights(job.chart_id)
  logJobProgress(job.id, `Chart fetched successfully`)
  
  // Generate report with Gemini (with retry)
  const geminiModelName = process.env.GEMINI_MODEL_REPORT ?? 'gemini-2.5-pro'
  logJobProgress(job.id, `Generating report with Gemini (model: ${geminiModelName})...`)
  
  const reportText = await withRetry(
    async () => generateDeepReport(chart.chart_json),
    `Gemini generateContent for job ${job.id}`
  )
  
  logJobProgress(job.id, `Report generated (${reportText.length} characters)`)

   // Persist report to bazi_reports for consistency
   const reportData: BaziReportInsert = {
     chart_id: job.chart_id,
     user_id: job.user_id,
     report_type: 'character_profile',
     title: '深度命盘分析报告',
     summary: {
       key_insights: ['详细命盘分析已生成'],
     },
     structured: {
       sections: [{
         title: '命盘分析',
         content: reportText,
       }],
     },
     body: reportText,
     model: geminiModelName,
     prompt_version: 'v1',
     tokens: null,
     status: 'completed',
     completed_at: new Date().toISOString(),
   }

   const report = await persistReport(reportData)
   logJobProgress(job.id, `Report persisted to database - Report ID: ${report.id}`)

   // Process chunks and embeddings for RAG
   logJobProgress(job.id, `Processing text chunks and generating embeddings for RAG...`)
   try {
     await processRagChunks(report.id, reportText)
     logJobProgress(job.id, `RAG chunks processed successfully`)
   } catch (ragError: any) {
     console.error(`[Worker] Non-fatal error processing RAG chunks for report ${report.id}:`, ragError)
     logJobProgress(job.id, `RAG chunk processing skipped due to error: ${ragError.message}`)
   }

   // Upload report to Supabase Storage (for backward compatibility)
   const publicUrl = await uploadReportToStorage(job.id, reportText)

   // Mark job as done
   await markJobStatus(job.id, 'done', { result_url: publicUrl })

   const duration = Date.now() - startTime
   logJobProgress(job.id, `Completed successfully in ${duration}ms ✓`)
}