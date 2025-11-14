import { supabaseService } from '@/lib/supabase'
import type {
  BaziReport,
  BaziReportInsert,
  Chart,
  ReportType,
} from '@/src/types/database'
import { ReportServiceError } from './errors'

export async function getChartById(chartId: string): Promise<Chart> {
  const { data, error } = await supabaseService
    .from('charts')
    .select('*')
    .eq('id', chartId)
    .single()

  if (error || !data) {
    throw new ReportServiceError(404, 'Chart not found')
  }

  return data as Chart
}

export async function getLatestReport(
  chartId: string,
  reportType: ReportType,
): Promise<BaziReport | null> {
  const { data, error } = await supabaseService
    .from('bazi_reports')
    .select('*')
    .eq('chart_id', chartId)
    .eq('report_type', reportType)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new ReportServiceError(500, error.message)
  }

  if (!data || data.length === 0) {
    return null
  }

  return data[0] as BaziReport
}

export async function createReport(report: BaziReportInsert): Promise<BaziReport> {
  const { data, error } = await supabaseService
    .from('bazi_reports')
    .insert([report])
    .select()
    .single()

  if (error || !data) {
    throw new ReportServiceError(500, error?.message ?? 'Failed to create report')
  }

  return data as BaziReport
}

export async function getReportById(reportId: string): Promise<BaziReport> {
  const { data, error } = await supabaseService
    .from('bazi_reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (error || !data) {
    throw new ReportServiceError(404, 'Report not found')
  }

  return data as BaziReport
}

interface ListReportsOptions {
  limit?: number
  chartId?: string
  reportType?: ReportType
}

export async function listCompletedReports({
  limit = 50,
  chartId,
  reportType,
}: ListReportsOptions = {}): Promise<BaziReport[]> {
  let query = supabaseService
    .from('bazi_reports')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (chartId) {
    query = query.eq('chart_id', chartId)
  }

  if (reportType) {
    query = query.eq('report_type', reportType)
  }

  const { data, error } = await query

  if (error) {
    throw new ReportServiceError(500, error.message)
  }

  return (data ?? []) as BaziReport[]
}
