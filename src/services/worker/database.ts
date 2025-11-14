import { supabaseService } from '../../../lib/supabase'
import type { Job } from './types'

const BATCH_SIZE = 5

export async function fetchPendingJobs(jobTypes: string[]): Promise<Job[]> {
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

export async function markJobStatus(
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
  
  console.log(`[Worker][${new Date().toISOString()}][Job ${jobId}] Status updated to: ${status}`)
}