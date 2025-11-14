export interface Job {
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

export type SupportedJobType = 'deep_report' | 'yearly_flow_report'

export const SUPPORTED_JOB_TYPES = ['deep_report', 'yearly_flow_report'] as const