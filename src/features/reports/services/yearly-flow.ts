import { YEARLY_FLOW_PROMPT_VERSION } from '@/src/features/ai/gemini'
import { supabaseService } from '@/lib/supabase'
import { checkQuota, upgradePrompt } from '@/lib/subscription'
import { ReportServiceError } from './errors'

interface YearlyFlowRequestOptions {
  chartId: string
  targetYear?: number
  subscriptionTier?: string
  userId?: string | null
}

export interface YearlyFlowRequestResult {
  jobId: string
  targetYear: number
}

function normalizeYear(year?: number): number {
  return year ?? new Date().getFullYear()
}

export async function requestYearlyFlowReport({
  chartId,
  targetYear,
  subscriptionTier = 'free',
  userId,
}: YearlyFlowRequestOptions): Promise<YearlyFlowRequestResult> {
  if (!chartId || typeof chartId !== 'string') {
    throw new ReportServiceError(400, 'chart_id is required')
  }

  const year = normalizeYear(targetYear)

  if (typeof year !== 'number' || year < 1900 || year > 2100) {
    throw new ReportServiceError(400, 'target_year must be a valid year')
  }

  if (userId) {
    const quotaCheck = await checkQuota(userId, 'yearly_flow')

    if (!quotaCheck.available) {
      throw new ReportServiceError(429, upgradePrompt(subscriptionTier, 'yearly_flow_unlimited'))
    }
  }

  const { data: chart, error: chartError } = await supabaseService
    .from('charts')
    .select('id')
    .eq('id', chartId)
    .single()

  if (chartError || !chart) {
    throw new ReportServiceError(404, 'Chart not found')
  }

  const { data: job, error: jobError } = await supabaseService
    .from('jobs')
    .insert([
      {
        user_id: userId ?? null,
        chart_id: chartId,
        job_type: 'yearly_flow_report',
        status: 'pending',
        result_url: null,
        metadata: {
          target_year: year,
          prompt_version: YEARLY_FLOW_PROMPT_VERSION,
          subscription_tier: subscriptionTier,
          requester_timestamp: new Date().toISOString(),
        },
      },
    ])
    .select()
    .single()

  if (jobError || !job) {
    throw new ReportServiceError(500, 'Failed to create job')
  }

  return {
    jobId: job.id as string,
    targetYear: year,
  }
}
