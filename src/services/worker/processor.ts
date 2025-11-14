import type { Job, SupportedJobType } from './types'
import { fetchPendingJobs } from './database'
import { processDeepReport, processYearlyFlowReport } from './jobs'
import { markJobStatus } from './database'
import { sleep, logJobProgress } from './utils'

const DELAY_BETWEEN_JOBS_MS = 1000 // 1 second delay to avoid hammering Gemini

export async function processJob(job: Job): Promise<void> {
  logJobProgress(job.id, `Routing job type: ${job.job_type}`)
  
  // Mark as processing
  await markJobStatus(job.id, 'processing')
  
  try {
    switch (job.job_type as SupportedJobType) {
      case 'deep_report':
        return await processDeepReport(job)
      
      case 'yearly_flow_report':
        return await processYearlyFlowReport(job)
      
      default:
        throw new Error(`Unknown job type: ${job.job_type}`)
    }
  } catch (err: any) {
    // Re-throw to let the main processJobs handler deal with it
    throw err
  }
}

export async function processJobs(): Promise<number> {
  const { SUPPORTED_JOB_TYPES } = await import('./types')
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
      const isNotFound = err?.isNotFound === true
      
      const failedMetadata = {
        ...job.metadata,
        error: errorMessage,
        error_stack: errorStack,
        failed_at: new Date().toISOString(),
        is_non_retryable: isNotFound, // Mark chart not found as non-retryable
      }
      
      try {
        await markJobStatus(job.id, 'failed', { metadata: failedMetadata })
        if (isNotFound) {
          logJobProgress(job.id, `Marked as failed (non-retryable: chart not found) ✗`)
        } else {
          logJobProgress(job.id, `Marked as failed ✗`)
        }
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