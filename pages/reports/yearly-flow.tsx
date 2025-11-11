import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { Button, Card, Container, Heading, Input, Section, Text } from '../../components/ui'
import type { BaziReport, SubscriptionTier } from '../../types/database'
import type { YearlyFlowPayload } from '../../lib/gemini/schemas'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface ChartSummary {
  id: string
  profile_id: string
  chart_json: any
  wuxing_scores?: Record<string, number>
  ai_summary?: string | null
  created_at: string
}

interface ChartsResponse {
  ok: boolean
  charts?: ChartSummary[]
  message?: string
}

type JobStatus = 'pending' | 'processing' | 'done' | 'failed'

interface JobMetadata {
  stage?: string
  estimated_time?: number
  report_id?: string
  target_year?: number
  error?: string
  [key: string]: any
}

interface JobData {
  id: string
  chart_id: string
  status: JobStatus
  progress?: number | null
  result_url?: string | null
  metadata?: JobMetadata | null
  report_id?: string | null
  error?: string | null
}

interface JobApiResponse {
  ok?: boolean
  job?: JobData
  jobs?: JobData[]
  message?: string
}

const YEAR_RANGE = 5

const STAGES = [
  { key: 'load', label: '命盘加载', icon: '📜' },
  { key: 'analysis', label: '运势分析', icon: '🔮' },
  { key: 'deep', label: '详细解读', icon: '🧭' },
  { key: 'refine', label: '内容优化', icon: '✨' },
] as const

const STAGE_ALIAS_MAP: Record<string, number> = {
  '命盘加载': 0,
  '加载命盘': 0,
  'chart loading': 0,
  '运势分析': 1,
  '分析运势': 1,
  'luck analysis': 1,
  '详细解读': 2,
  '深度解读': 2,
  'detailed insights': 2,
  '内容优化': 3,
  '优化润色': 3,
  'content polish': 3,
}

const SECTOR_CONFIG = {
  career: {
    label: '事业版块',
    emoji: '🏢',
    gradient: 'from-blue-900/60 via-blue-800/40 to-blue-900/60',
    border: 'border-blue-400/40',
  },
  wealth: {
    label: '财运版块',
    emoji: '💰',
    gradient: 'from-green-900/60 via-emerald-800/40 to-green-900/60',
    border: 'border-green-400/40',
  },
  relationship: {
    label: '感情版块',
    emoji: '💗',
    gradient: 'from-rose-900/60 via-pink-800/40 to-rose-900/60',
    border: 'border-rose-400/40',
  },
  health: {
    label: '健康版块',
    emoji: '🏥',
    gradient: 'from-purple-900/60 via-purple-800/40 to-purple-900/60',
    border: 'border-purple-400/40',
  },
} as const

type SectorKey = keyof typeof SECTOR_CONFIG

const TABS: { key: string; label: string; description: string }[] = [
  { key: 'overview', label: '总体概览', description: '原局与流年核心解读' },
  { key: 'domains', label: '四大板块', description: '事业、财运、感情、健康' },
  { key: 'timeline', label: '月度时间线', description: '十二个月运势脉络' },
  { key: 'checklist', label: 'Do & Don\'t', description: '行动建议与提醒' },
  { key: 'decisions', label: '决策指南', description: '常见关键问题分析' },
  { key: 'scores', label: '评分卡', description: '整体指数与幸运月份' },
]

function clampYear(year: number, minYear: number, maxYear: number) {
  return Math.min(Math.max(year, minYear), maxYear)
}

function resolveStageIndex(stage: string | undefined, status: JobStatus | null): number {
  if (status === 'done') {
    return STAGES.length - 1
  }
  if (stage) {
    const normalized = stage.trim().toLowerCase()
    const matchedKey = Object.keys(STAGE_ALIAS_MAP).find(alias => alias.toLowerCase() === normalized)
    if (matchedKey) {
      return STAGE_ALIAS_MAP[matchedKey]
    }
    // Fallback: try to match by inclusion
    const partialMatch = Object.entries(STAGE_ALIAS_MAP).find(([alias]) => normalized.includes(alias.toLowerCase()))
    if (partialMatch) {
      return partialMatch[1]
    }
  }
  if (status === 'processing') {
    return 1
  }
  return 0
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  } catch (error) {
    return value
  }
}

function formatEstimatedTime(ms?: number) {
  if (!ms || ms <= 0) return null
  const seconds = Math.ceil(ms / 1000)
  if (seconds < 60) {
    return `约 ${seconds} 秒`
  }
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  if (minutes >= 10) {
    return `约 ${minutes} 分钟`
  }
  return `约 ${minutes} 分 ${remaining} 秒`
}

function createStarArray(score?: number | null, total: number = 5) {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return Array.from({ length: total }, () => 'empty')
  }
  const filled = Math.round(Math.max(0, Math.min(score, 100)) / (100 / total))
  return Array.from({ length: total }, (_, index) => (index < filled ? 'full' : 'empty'))
}

async function fetchJobStatus(jobId: string): Promise<JobData | null> {
  const endpoints = [`/api/my/jobs/${jobId}`, `/api/jobs/${jobId}`]

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint)
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')
      const data: JobApiResponse | null = isJson ? await response.json() : null

      if (response.ok && data?.job) {
        return data.job
      }

      if (data?.ok && data.job) {
        return data.job
      }

      if (Array.isArray(data?.jobs) && data.jobs.length > 0) {
        const job = data.jobs.find(item => item.id === jobId) || data.jobs[0]
        return job
      }
    } catch (error) {
      // Try next endpoint
      continue
    }
  }

  return null
}

export default function YearlyFlowReportPage() {
  const router = useRouter()
  const { data: chartsData } = useSWR<ChartsResponse>('/api/my/charts', fetcher)

  const charts = chartsData?.charts ?? []
  const chartIdParam = typeof router.query.chart_id === 'string' ? router.query.chart_id : ''
  const yearParam = typeof router.query.year === 'string' ? parseInt(router.query.year, 10) : NaN

  const currentYear = new Date().getFullYear()
  const minYear = currentYear - YEAR_RANGE
  const maxYear = currentYear + YEAR_RANGE
  const yearOptions = useMemo(() => (
    Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, index) => currentYear - YEAR_RANGE + index)
  ), [currentYear])

  const [selectedChartId, setSelectedChartId] = useState<string>('')
  const [targetYear, setTargetYear] = useState<number>(currentYear)
  const [yearError, setYearError] = useState('')
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free')
  const [subscriptionLoading, setSubscriptionLoading] = useState(true)

  const [jobId, setJobId] = useState('')
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [jobMetadata, setJobMetadata] = useState<JobMetadata | null>(null)
  const [jobProgress, setJobProgress] = useState<number | null>(null)
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const [jobError, setJobError] = useState('')

  const [reportId, setReportId] = useState<string | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [report, setReport] = useState<BaziReport | null>(null)
  const [reportPayload, setReportPayload] = useState<YearlyFlowPayload | null>(null)
  const [payloadError, setPayloadError] = useState<string | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(TABS[0].key)
  const [shareFeedback, setShareFeedback] = useState('')

  useEffect(() => {
    if (chartIdParam) {
      setSelectedChartId(chartIdParam)
    }
  }, [chartIdParam])

  useEffect(() => {
    if (!Number.isNaN(yearParam)) {
      setTargetYear(clampYear(yearParam, minYear, maxYear))
    }
  }, [yearParam, minYear, maxYear])

  useEffect(() => {
    if (!selectedChartId && charts.length) {
      setSelectedChartId(charts[0].id)
    }
  }, [charts, selectedChartId])

  useEffect(() => {
    let isCancelled = false

    const loadSubscription = async () => {
      try {
        const response = await fetch('/api/subscriptions/current?user_id=current-user')
        const contentType = response.headers.get('content-type') || ''
        const data = contentType.includes('application/json') ? await response.json() : null

        if (!isCancelled && data?.ok && data?.data?.tier) {
          setSubscriptionTier(data.data.tier as SubscriptionTier)
        }
      } catch (error) {
        console.warn('[Yearly Flow] Failed to fetch subscription tier')
      } finally {
        if (!isCancelled) {
          setSubscriptionLoading(false)
        }
      }
    }

    loadSubscription()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!report) {
      setReportPayload(null)
      setPayloadError(null)
      return
    }

    if (!report.body) {
      setReportPayload(null)
      setPayloadError(null)
      return
    }

    try {
      const parsed = JSON.parse(report.body) as YearlyFlowPayload
      setReportPayload(parsed)
      setPayloadError(null)
    } catch (error) {
      console.error('[Yearly Flow] Failed to parse payload:', error)
      setReportPayload(null)
      setPayloadError('解析报告内容时出现问题，请稍后重试。')
    }
  }, [report])

  useEffect(() => {
    if (!jobId) return

    let isActive = true
    let delay = 1500
    let timeout: NodeJS.Timeout | null = null

    const schedule = () => {
      if (!isActive) return
      timeout = setTimeout(poll, delay)
    }

    const poll = async () => {
      try {
        const job = await fetchJobStatus(jobId)

        if (!isActive) return

        if (!job) {
          delay = Math.min(delay * 1.3, 15000)
          schedule()
          return
        }

        setJobStatus(job.status)
        setJobMetadata(job.metadata || null)

        if (typeof job.progress === 'number') {
          setJobProgress(job.progress)
          setAnimatedProgress(job.progress)
        }

        if (job.metadata?.report_id || job.report_id) {
          setReportId(prev => prev || job.metadata?.report_id || job.report_id || null)
        }

        if (job.status === 'done') {
          setJobProgress(job.progress ?? 100)
          setAnimatedProgress(100)
          return
        }

        if (job.status === 'failed') {
          const errorMessage = job.metadata?.error || job.error || '报告生成失败，请稍后再试。'
          setJobError(errorMessage)
          setAnimatedProgress(prev => prev > 0 ? prev : 12)
          return
        }

        delay = Math.min(delay * 1.4, 15000)
        if (typeof job.progress !== 'number') {
          setAnimatedProgress(prev => Math.min(prev + Math.random() * 6 + 4, 93))
        }
        schedule()
      } catch (error) {
        console.error('[Yearly Flow] Polling error:', error)
        delay = Math.min(delay * 1.8, 20000)
        schedule()
      }
    }

    poll()

    return () => {
      isActive = false
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [jobId])

  useEffect(() => {
    if (!jobId) return
    if (jobStatus !== 'processing' || typeof jobProgress === 'number') return

    const interval = setInterval(() => {
      setAnimatedProgress(prev => Math.min(prev + Math.random() * 5 + 3, 92))
    }, 2000)

    return () => clearInterval(interval)
  }, [jobId, jobStatus, jobProgress])

  useEffect(() => {
    if (!reportId) return

    let isCancelled = false
    setReportLoading(true)

    const loadReport = async () => {
      try {
        const response = await fetch(`/api/reports/${reportId}?subscription_tier=${subscriptionTier}`)
        const data = await response.json()

        if (isCancelled) return

        if (response.ok && data?.ok && data.report) {
          setReport(data.report)
        } else {
          setJobError(data?.message || '获取报告内容失败')
        }
      } catch (error) {
        if (!isCancelled) {
          setJobError('获取报告内容失败，请稍后重试。')
        }
      } finally {
        if (!isCancelled) {
          setReportLoading(false)
        }
      }
    }

    loadReport()

    return () => {
      isCancelled = true
    }
  }, [reportId, subscriptionTier])

  const activeChartId = report?.chart_id || selectedChartId
  const activeChart = useMemo(() => charts.find(chart => chart.id === activeChartId) || null, [charts, activeChartId])

  const highlightedMonths = useMemo(() => {
    if (!reportPayload?.energyIndex?.length) return new Set<string>()
    const topNodes = [...reportPayload.energyIndex]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(3, reportPayload.energyIndex.length))
    return new Set(topNodes.map(node => node.month))
  }, [reportPayload])

  const canGenerate = subscriptionTier !== 'free'

  const handleYearInputChange = (value: string) => {
    const numeric = parseInt(value, 10)
    if (Number.isNaN(numeric)) {
      setYearError('请输入有效年份')
      return
    }
    const clamped = clampYear(numeric, minYear, maxYear)
    setTargetYear(clamped)
    if (clamped !== numeric) {
      setYearError(`只支持 ${minYear} - ${maxYear} 年范围`)
    } else {
      setYearError('')
    }
  }

  const handleGenerateReport = async () => {
    if (!selectedChartId) {
      setJobError('请先选择一个命盘')
      return
    }

    if (!canGenerate) {
      setJobError('当前订阅等级无法生成流年报告，请升级到 Basic 或更高等级。')
      return
    }

    if (!Number.isInteger(targetYear)) {
      setYearError('请选择有效年份')
      return
    }

    setIsGenerating(true)
    setJobError('')
    setReportId(null)
    setReport(null)
    setReportPayload(null)
    setPayloadError(null)
    setJobId('')
    setJobStatus('pending')
    setJobMetadata(null)
    setJobProgress(null)
    setAnimatedProgress(0)
    setActiveTab(TABS[0].key)

    try {
      const response = await fetch('/api/reports/yearly-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart_id: selectedChartId,
          target_year: targetYear,
          subscription_tier: subscriptionTier,
          user_id: 'current-user',
        }),
      })

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || '报告生成请求失败，请稍后再试。')
      }

      setJobId(data.job_id)
      setJobStatus('pending')
      setJobMetadata({ target_year: data.target_year })
      setJobProgress(0)
      setAnimatedProgress(5)
    } catch (error: any) {
      const message = error?.message || '报告生成失败，请稍后再试。'
      setJobError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportPDF = () => {
    if (!reportPayload || typeof window === 'undefined') return
    const element = document.getElementById('yearly-flow-report-content')
    if (!element) return

    const targetChart = activeChartId ? activeChartId.slice(0, 8) : 'chart'
    const fileName = `yearly_flow_${targetChart}_${targetYear}_${new Date().toISOString().split('T')[0]}`

    const printWindow = window.open('', '', 'width=1080,height=720')
    if (!printWindow) {
      alert('浏览器阻止了打印窗口，请检查设置。')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="zh-CN">
        <head>
          <meta charSet="utf-8" />
          <title>${fileName}</title>
          <style>
            body {
              font-family: '宋体', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              padding: 32px;
              color: #1a0f2e;
              background: #faf5ff;
            }
            h1, h2, h3 {
              color: #5b21b6;
            }
            .section {
              border: 1px solid rgba(139, 92, 246, 0.2);
              border-radius: 18px;
              padding: 24px;
              margin-bottom: 24px;
              background: rgba(255, 255, 255, 0.92);
            }
            .section + .section {
              margin-top: 16px;
            }
            ul {
              padding-left: 20px;
            }
          </style>
        </head>
        <body>
          ${element.innerHTML}
        </body>
      </html>
    `)

    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const handleShare = () => {
    if (!report) return

    if (typeof window === 'undefined') return

    const shareUrl = `${window.location.origin}/share/reports/${report.id}`
    const nav = window.navigator

    if (nav.share) {
      nav.share({
        title: `${report.title}`,
        text: '和我一起查看这份流年运势报告吧！',
        url: shareUrl,
      }).catch(error => {
        console.warn('分享失败:', error)
      })
      return
    }

    if (nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(shareUrl).then(() => {
        setShareFeedback('分享链接已复制到剪贴板')
        setTimeout(() => setShareFeedback(''), 3000)
      }).catch(() => {
        setShareFeedback('复制失败，请手动复制链接')
        setTimeout(() => setShareFeedback(''), 3000)
      })
      return
    }

    setShareFeedback(`请手动复制链接：${shareUrl}`)
    setTimeout(() => setShareFeedback(''), 3000)
  }

  const stageIndex = resolveStageIndex(jobMetadata?.stage, jobStatus)

  const renderStageStatus = (index: number) => {
    if (jobStatus === 'failed') {
      if (index === stageIndex) return 'failed'
      if (index < stageIndex) return 'done'
      return 'pending'
    }

    if (index < stageIndex) return 'done'
    if (index === stageIndex) {
      if (jobStatus === 'done') return 'done'
      return 'active'
    }
    return 'pending'
  }

  const renderStars = (score?: number | null) => {
    const stars = createStarArray(score)
    return (
      <div className="flex items-center gap-1" aria-hidden="true">
        {stars.map((type, index) => (
          <span
            key={index}
            className={type === 'full' ? 'text-mystical-gold-500' : 'text-mystical-gold-700/40'}
          >
            {type === 'full' ? '✨' : '☆'}
          </span>
        ))}
      </div>
    )
  }

  const renderScoreGauge = (label: string, score?: number | null, accent: string = 'from-mystical-purple-900 to-mystical-purple-700') => {
    const value = typeof score === 'number' ? Math.min(Math.max(score, 0), 100) : 0
    return (
      <div className="p-4 rounded-2xl bg-mystical-purple-900/40 border border-mystical-gold-700/20" key={label}>
        <div className="flex items-center justify-between mb-3">
          <Text className="font-semibold text-mystical-gold-400">{label}</Text>
          <Text className="text-mystical-gold-500 font-bold">{value}/100</Text>
        </div>
        <div className="h-2.5 w-full rounded-full bg-mystical-purple-950/60 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${accent}`}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    )
  }

  const renderOverviewTab = () => {
    if (!reportPayload) {
      return (
        <Card variant="mystical" className="p-8 text-center border border-mystical-gold-700/30">
          <Heading level={3} className="text-mystical-gold-500 mb-4">暂未获取完整内容</Heading>
          <Text className="text-mystical-gold-300">请确认您的订阅等级或稍后重试。</Text>
        </Card>
      )
    }

    return (
      <div className="space-y-6">
        <Card variant="mystical-gold" className="p-8">
          <Heading level={3} className="text-2xl text-mystical-gold-500 mb-4">您的命盘基础</Heading>
          <Text className="text-white leading-relaxed whitespace-pre-line">{reportPayload.natalAnalysis}</Text>
        </Card>

        <Card variant="mystical" className="p-8 border border-mystical-gold-700/30">
          <Heading level={3} className="text-2xl text-mystical-gold-500 mb-4">当前大运周期</Heading>
          <Text className="text-mystical-gold-100 leading-relaxed whitespace-pre-line">{reportPayload.decadeLuckAnalysis}</Text>
        </Card>

        <Card variant="mystical-gold" className="p-8">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="lg:w-2/3">
              <Heading level={3} className="text-2xl text-mystical-gold-500 mb-4">{`${reportPayload.targetYear} 年整体运势`}</Heading>
              <Text className="text-white leading-relaxed whitespace-pre-line mb-6">{reportPayload.annualFlowAnalysis}</Text>
            </div>
            <div className="lg:w-1/3 space-y-4">
              <div className="rounded-2xl border border-mystical-gold-700/40 p-4 bg-mystical-purple-950/40">
                <Text className="text-sm text-mystical-gold-400 mb-2">能量指数</Text>
                <div className="h-24 relative">
                  <div className="absolute inset-0 bg-mystical-purple-950/40 rounded-xl" />
                  <div className="absolute inset-1 rounded-lg bg-gradient-to-br from-mystical-purple-800/60 to-mystical-cyan-900/40 p-4">
                    <Heading level={3} className="text-3xl text-mystical-gold-400">
                      {typeof reportPayload.scorecard?.overall === 'number'
                        ? Math.round(reportPayload.scorecard.overall / 10)
                        : '—'}
                      <span className="text-base text-mystical-gold-200 ml-2">/10</span>
                    </Heading>
                    <Text className="text-xs text-mystical-gold-300 mt-2">
                      根据综合指数换算，吉祥度评分越高代表整体顺遂度越强。
                    </Text>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {renderScoreGauge('事业', reportPayload.scorecard?.career, 'from-blue-500 to-blue-300')}
                {renderScoreGauge('财运', reportPayload.scorecard?.wealth, 'from-emerald-500 to-emerald-300')}
                {renderScoreGauge('感情', reportPayload.scorecard?.relationship, 'from-rose-500 to-rose-300')}
                {renderScoreGauge('健康', reportPayload.scorecard?.health, 'from-purple-500 to-purple-300')}
              </div>
            </div>
          </div>
        </Card>

        {reportPayload.energyIndex?.length ? (
          <Card variant="mystical" className="p-8 border border-mystical-gold-700/30">
            <Heading level={3} className="text-2xl text-mystical-gold-500 mb-6">年度能量波动</Heading>
            <div className="grid gap-4 md:grid-cols-2">
              {reportPayload.energyIndex.map(node => (
                <div key={node.month} className="p-4 rounded-2xl bg-mystical-purple-950/40 border border-mystical-gold-700/20">
                  <div className="flex items-center justify-between mb-2">
                    <Text className="font-semibold text-mystical-gold-300">{node.month}</Text>
                    <Text className="text-mystical-gold-400 font-bold">{node.score}</Text>
                  </div>
                  <div className="h-2 rounded-full bg-mystical-purple-900/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-mystical-gold-500 via-mystical-gold-600 to-mystical-gold-700"
                      style={{ width: `${node.score}%` }}
                    />
                  </div>
                  <Text className="text-xs text-mystical-gold-200 mt-3 leading-relaxed">{node.narrative}</Text>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    )
  }

  const renderDomainCard = (sector: SectorKey) => {
    if (!reportPayload) return null
    const domain = reportPayload.keyDomains?.[sector]
    if (!domain) return null

    const config = SECTOR_CONFIG[sector]
    const score = reportPayload.scorecard?.[sector]
    const keywords = domain.theme ? domain.theme.split(/[,，、\s]/).filter(Boolean).slice(0, 4) : []

    return (
      <div
        key={sector}
        className={`rounded-3xl p-6 border ${config.border} bg-gradient-to-br ${config.gradient} shadow-mystical-soft`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <Heading level={3} className="text-xl text-mystical-gold-400 flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">{config.emoji}</span>
              {config.label}
            </Heading>
            <Text className="text-sm text-mystical-gold-200 mt-2">{domain.theme}</Text>
          </div>
          <div className="flex flex-col items-end">
            <Text className="text-sm text-mystical-gold-300">运势评分</Text>
            {renderStars(score)}
            <Text className="text-xs text-mystical-gold-500 mt-1">{typeof score === 'number' ? `${Math.round(score / 20)} / 5` : '—'}</Text>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
            <Text className="text-sm text-mystical-gold-500 font-semibold mb-2">机遇方向</Text>
            <Text className="text-sm text-mystical-gold-100 leading-relaxed">{domain.opportunity}</Text>
          </div>
          <div className="rounded-2xl bg-black/10 border border-white/10 p-4">
            <Text className="text-sm text-mystical-gold-500 font-semibold mb-2">需要留意</Text>
            <Text className="text-sm text-mystical-gold-100 leading-relaxed">{domain.precaution}</Text>
          </div>
          <div className="rounded-2xl bg-black/5 border border-mystical-gold-700/30 p-4">
            <Text className="text-sm text-mystical-gold-500 font-semibold mb-2">建议仪式</Text>
            <Text className="text-sm text-mystical-gold-100 leading-relaxed">{domain.ritual}</Text>
          </div>
        </div>

        {keywords.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {keywords.map(keyword => (
              <span key={keyword} className="px-3 py-1 rounded-full text-xs bg-mystical-gold-700/20 text-mystical-gold-200">
                {keyword}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const renderDomainsTab = () => {
    if (!reportPayload) return null

    return (
      <div className="grid gap-6 md:grid-cols-2">
        {(Object.keys(SECTOR_CONFIG) as SectorKey[]).map(renderDomainCard)}
      </div>
    )
  }

  const renderTimelineTab = () => {
    if (!reportPayload?.monthlyTimeline?.length) {
      return (
        <Card variant="mystical" className="p-8 text-center border border-mystical-gold-700/30">
          <Heading level={3} className="text-mystical-gold-500 mb-3">暂无月度信息</Heading>
          <Text className="text-mystical-gold-300">生成报告后将展示每个月的重点提示。</Text>
        </Card>
      )
    }

    return (
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {reportPayload.monthlyTimeline.map(item => {
          const isHighlighted = highlightedMonths.has(item.month)
          return (
            <div
              key={item.month}
              className={`rounded-3xl border p-5 transition-all duration-300 ${
                isHighlighted
                  ? 'border-mystical-gold-500 shadow-gold-glow bg-gradient-to-br from-mystical-purple-900/80 to-mystical-cyan-900/60'
                  : 'border-mystical-gold-700/20 bg-mystical-purple-950/40'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <Text className="text-sm text-mystical-gold-400 font-semibold">{item.month}</Text>
                {isHighlighted && (
                  <span className="text-xs text-mystical-gold-300 px-3 py-1 rounded-full bg-mystical-gold-700/20">重点</span>
                )}
              </div>
              <Heading level={3} className="text-lg text-white mb-2">{item.headline}</Heading>
              <Text className="text-sm text-mystical-gold-200 mb-3 leading-relaxed">{item.action}</Text>
              {item.warning ? (
                <div className="text-xs text-rose-200 bg-rose-900/20 border border-rose-500/40 rounded-xl px-3 py-2">
                  ⚠️ {item.warning}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  }

  const renderChecklistTab = () => {
    if (!reportPayload) return null
    const ritualTips = reportPayload.keyDomains
      ? Object.values(reportPayload.keyDomains)
          .map(domain => domain.ritual)
          .filter(Boolean)
      : []

    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Card variant="mystical-gold" className="p-6">
          <Heading level={3} className="text-xl text-mystical-gold-500 mb-4">✓ Do</Heading>
          <ul className="space-y-3 text-mystical-gold-100">
            {reportPayload.doList?.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-mystical-gold-400 mt-0.5">✨</span>
                <Text className="text-sm leading-relaxed">{item}</Text>
              </li>
            ))}
          </ul>
        </Card>

        <Card variant="mystical" className="p-6 border border-mystical-gold-700/30">
          <Heading level={3} className="text-xl text-mystical-gold-500 mb-4">✗ Don&apos;t</Heading>
          <ul className="space-y-3 text-mystical-gold-100">
            {reportPayload.dontList?.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-rose-300 mt-0.5">⚠️</span>
                <Text className="text-sm leading-relaxed">{item}</Text>
              </li>
            ))}
          </ul>
        </Card>

        <Card variant="mystical-gold" className="p-6">
          <Heading level={3} className="text-xl text-mystical-gold-500 mb-4">💡 贴士</Heading>
          <ul className="space-y-3 text-mystical-gold-100">
            {ritualTips.slice(0, 5).map((tip, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-mystical-gold-400 mt-0.5">🌟</span>
                <Text className="text-sm leading-relaxed">{tip}</Text>
              </li>
            ))}
            {!ritualTips.length && (
              <li className="text-sm text-mystical-gold-200">暂无额外贴士。</li>
            )}
          </ul>
        </Card>
      </div>
    )
  }

  const renderDecisionsTab = () => {
    if (!reportPayload?.decisionTree?.length) {
      return (
        <Card variant="mystical" className="p-8 text-center border border-mystical-gold-700/30">
          <Heading level={3} className="text-mystical-gold-500 mb-3">暂未生成决策指南</Heading>
          <Text className="text-mystical-gold-300">生成报告后将提供常见问题的引导建议。</Text>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {reportPayload.decisionTree.map(node => (
          <div key={node.id} className="rounded-3xl border border-mystical-gold-700/30 bg-mystical-purple-950/40 p-6">
            <Heading level={3} className="text-lg text-mystical-gold-400 mb-3">{node.scenario}</Heading>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-center">
              <div className="p-4 rounded-2xl bg-mystical-purple-900/40">
                <Text className="text-xs text-mystical-gold-300 uppercase tracking-widest">建议</Text>
                <Text className="text-sm text-white leading-relaxed mt-1">{node.choice}</Text>
              </div>
              <div className="text-center text-2xl text-mystical-gold-500" aria-hidden="true">→</div>
              <div className="p-4 rounded-2xl bg-mystical-purple-900/20 border border-mystical-gold-700/20">
                <Text className="text-xs text-mystical-gold-300 uppercase tracking-widest">结果</Text>
                <Text className="text-sm text-mystical-gold-100 leading-relaxed mt-1">{node.outcome}</Text>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderScoresTab = () => {
    if (!reportPayload?.scorecard) {
      return null
    }

    const favoriteMonths = reportPayload.energyIndex
      ? [...reportPayload.energyIndex]
          .sort((a, b) => b.score - a.score)
          .slice(0, 2)
          .map(node => node.month)
      : []

    return (
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card variant="mystical-gold" className="p-8">
          <Heading level={3} className="text-2xl text-mystical-gold-500 mb-4">综合评分</Heading>
          <div className="grid gap-4 md:grid-cols-2">
            {renderScoreGauge('总体吉凶', reportPayload.scorecard.overall, 'from-mystical-gold-500 to-mystical-gold-300')}
            {renderScoreGauge('事业指数', reportPayload.scorecard.career, 'from-blue-500 to-blue-300')}
            {renderScoreGauge('财运指数', reportPayload.scorecard.wealth, 'from-emerald-500 to-emerald-300')}
            {renderScoreGauge('感情指数', reportPayload.scorecard.relationship, 'from-rose-500 to-rose-300')}
            {renderScoreGauge('健康指数', reportPayload.scorecard.health, 'from-purple-500 to-purple-300')}
            {renderScoreGauge('心态指数', reportPayload.scorecard.mindset, 'from-cyan-500 to-cyan-300')}
          </div>
        </Card>

        <Card variant="mystical" className="p-8 border border-mystical-gold-700/30">
          <Heading level={3} className="text-xl text-mystical-gold-400 mb-4">幸运月份</Heading>
          {favoriteMonths.length ? (
            <ul className="space-y-3 text-mystical-gold-100">
              {favoriteMonths.map(month => (
                <li key={month} className="flex items-center gap-3">
                  <span className="text-mystical-gold-400">🌟</span>
                  <Text className="text-sm">{month}</Text>
                </li>
              ))}
            </ul>
          ) : (
            <Text className="text-sm text-mystical-gold-300">暂无突出月份，建议把握整体节奏。</Text>
          )}
        </Card>
      </div>
    )
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab()
      case 'domains':
        return renderDomainsTab()
      case 'timeline':
        return renderTimelineTab()
      case 'checklist':
        return renderChecklistTab()
      case 'decisions':
        return renderDecisionsTab()
      case 'scores':
        return renderScoresTab()
      default:
        return null
    }
  }

  const quotaHint = subscriptionLoading
    ? '正在检测订阅状态...'
    : canGenerate
      ? '您当前订阅已解锁流年报告功能。'
      : '流年报告属于收费功能，请升级到 Basic / Premium / VIP 以解锁。'

  const stageEstimatedTime = formatEstimatedTime(jobMetadata?.estimated_time)

  const hasReportContent = !!reportPayload || (!!report && !payloadError)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-mystical-purple-950 to-mystical-cyan-950">
      <Navbar />

      <main className="flex-grow">
        <Section background="mystical" className="py-10">
          <Container size="lg" className="max-w-6xl">
            <div className="mb-10 text-center">
              <Heading level={1} className="text-4xl md:text-5xl text-mystical-gold-500 font-serif mb-3">
                {targetYear} 年流年运势报告
              </Heading>
              <Text className="text-mystical-gold-300">
                结合命盘原局、大运趋势与流年能量，为您梳理下一年的关键节奏与战略行动。
              </Text>
            </div>

            <Card variant="mystical-gold" className="p-8 mb-8">
              <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
                <div className="space-y-6">
                  <div>
                    <Text className="text-sm text-mystical-gold-400 uppercase tracking-[0.3em]">命盘选择</Text>
                    {charts.length ? (
                      <div className="mt-3 space-y-3">
                        <select
                          className="w-full rounded-2xl bg-mystical-purple-950/40 border border-mystical-gold-700/40 px-4 py-3 text-mystical-gold-200 focus:outline-none focus:ring-2 focus:ring-mystical-gold-500"
                          value={selectedChartId}
                          onChange={(event) => setSelectedChartId(event.target.value)}
                          aria-label="选择命盘"
                        >
                          {charts.map(chart => (
                            <option key={chart.id} value={chart.id}>
                              命盘 #{chart.id.slice(0, 8)} · {new Date(chart.created_at).toLocaleDateString('zh-CN')}
                            </option>
                          ))}
                        </select>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {charts.slice(0, 4).map(chart => {
                            const isActive = selectedChartId === chart.id
                            return (
                              <button
                                key={chart.id}
                                type="button"
                                onClick={() => setSelectedChartId(chart.id)}
                                className={`text-left rounded-2xl border px-4 py-3 transition-all ${
                                  isActive
                                    ? 'border-mystical-gold-500 bg-mystical-purple-900/60 shadow-gold-glow'
                                    : 'border-mystical-gold-700/20 bg-mystical-purple-950/40 hover:border-mystical-gold-500/60'
                                }`}
                              >
                                <Text className="text-sm text-mystical-gold-300">命盘 #{chart.id.slice(0, 8)}</Text>
                                <Text className="text-xs text-mystical-gold-500 mt-1">
                                  创建于 {new Date(chart.created_at).toLocaleString('zh-CN')}
                                </Text>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-mystical-gold-300">暂无命盘，请先在仪表板创建。</div>
                    )}
                  </div>

                  <div>
                    <Text className="text-sm text-mystical-gold-400 uppercase tracking-[0.3em]">目标年份</Text>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr,auto] md:items-center">
                      <Input
                        type="number"
                        value={targetYear}
                        onChange={(event) => handleYearInputChange(event.target.value)}
                        min={minYear}
                        max={maxYear}
                        className="text-lg"
                        aria-label="目标年份"
                        helperText={yearError || `可选范围：${minYear} - ${maxYear}`}
                      />
                      <div className="flex flex-wrap gap-2">
                        {yearOptions.map(year => (
                          <Button
                            key={year}
                            variant={year === targetYear ? 'gold' : 'mystical'}
                            size="sm"
                            onClick={() => {
                              setTargetYear(year)
                              setYearError('')
                            }}
                          >
                            {year}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl bg-mystical-purple-950/40 border border-mystical-gold-700/30 p-5">
                    <Text className="text-sm text-mystical-gold-400 mb-2">订阅状态</Text>
                    <Text className="text-base text-mystical-gold-200 leading-relaxed">{quotaHint}</Text>
                    {!canGenerate && !subscriptionLoading && (
                      <Link href="/pricing" className="inline-flex mt-4">
                        <Button variant="gold" size="sm">立即升级</Button>
                      </Link>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Button
                      variant="gold"
                      size="lg"
                      fullWidth
                      onClick={handleGenerateReport}
                      disabled={!selectedChartId || isGenerating || !canGenerate}
                      loading={isGenerating}
                    >
                      {isGenerating ? '生成中...' : '生成流年报告'}
                    </Button>
                    <Link href="/dashboard" className="block">
                      <Button variant="mystical" size="md" fullWidth>
                        返回仪表板
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>

            {jobError && (
              <Card variant="mystical" className="p-6 mb-8 border border-red-400/40 bg-red-900/20">
                <div className="flex items-start gap-4">
                  <span className="text-2xl" aria-hidden="true">⚠️</span>
                  <div>
                    <Heading level={3} className="text-lg text-red-200 mb-1">生成失败</Heading>
                    <Text className="text-sm text-red-100 mb-3">{jobError}</Text>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="gold" size="sm" onClick={handleGenerateReport} disabled={isGenerating}>
                        重试生成
                      </Button>
                      <Link href="/pricing">
                        <Button variant="secondary" size="sm">查看订阅方案</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {(jobId && jobStatus !== 'done') && (
              <Card variant="mystical" className="p-8 mb-8 border border-mystical-gold-700/30">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div>
                    <Heading level={2} className="text-2xl text-mystical-gold-500">报告生成中</Heading>
                    <Text className="text-sm text-mystical-gold-300 mt-2">
                      {jobStatus === 'pending' && '正在排队等待处理...'}
                      {jobStatus === 'processing' && '正在解析命盘并生成流年内容...'}
                    </Text>
                    {stageEstimatedTime && (
                      <Text className="text-xs text-mystical-gold-400 mt-1">预计剩余时间：{stageEstimatedTime}</Text>
                    )}
                  </div>
                  <div className="text-right">
                    <Text className="text-sm text-mystical-gold-400">进度</Text>
                    <Heading level={3} className="text-3xl text-mystical-gold-500">{Math.round(animatedProgress)}%</Heading>
                  </div>
                </div>

                <div className="relative h-3 rounded-full bg-mystical-purple-950/50 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(animatedProgress)}>
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-mystical-gold-600 via-mystical-gold-500 to-mystical-gold-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(animatedProgress, 5))}%` }}
                  />
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  {STAGES.map((stage, index) => {
                    const status = renderStageStatus(index)
                    const isCompleted = status === 'done'
                    const isActive = status === 'active'
                    return (
                      <div
                        key={stage.key}
                        className={`rounded-2xl border px-4 py-3 transition-all ${
                          isCompleted
                            ? 'border-mystical-gold-500 bg-mystical-purple-900/60 shadow-gold-glow'
                            : isActive
                              ? 'border-mystical-gold-500/60 bg-mystical-purple-900/40'
                              : 'border-mystical-gold-700/20 bg-mystical-purple-950/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-xl ${isCompleted ? 'text-mystical-gold-400' : isActive ? 'motion-safe:animate-spin text-mystical-gold-300' : 'text-mystical-gold-700/60'}`} aria-hidden="true">
                            {status === 'done' ? '✓' : status === 'failed' ? '⚠️' : status === 'active' ? '⟳' : stage.icon}
                          </span>
                          <Text className={`text-sm font-medium ${isCompleted || isActive ? 'text-mystical-gold-300' : 'text-mystical-gold-600'}`}>{stage.label}</Text>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {reportLoading && (
              <Card variant="mystical" className="p-8 mb-8 border border-mystical-gold-700/30">
                <div className="animate-pulse space-y-6">
                  <div className="h-6 bg-mystical-purple-900/40 rounded w-1/3"></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="h-32 bg-mystical-purple-900/40 rounded-3xl"></div>
                    <div className="h-32 bg-mystical-purple-900/40 rounded-3xl"></div>
                  </div>
                  <div className="h-48 bg-mystical-purple-900/40 rounded-3xl"></div>
                </div>
              </Card>
            )}

            {hasReportContent && (
              <Card variant="mystical-gold" className="p-8 mb-8" id="yearly-flow-report-content">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <Heading level={2} className="text-3xl text-mystical-gold-500 font-serif">{report?.title || `${targetYear} 年流年运势报告`}</Heading>
                      <Text className="text-sm text-mystical-gold-300 mt-2">
                        生成时间：{formatDateTime(report?.created_at)}
                      </Text>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="gold" size="sm" onClick={handleExportPDF}>📥 导出 PDF</Button>
                      <Button variant="mystical" size="sm" onClick={handleShare}>📤 分享</Button>
                      <Button
                        variant="mystical"
                        size="sm"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.print()
                          }
                        }}
                      >
                        🖨️ 打印
                      </Button>
                    </div>
                  </div>

                  {shareFeedback && (
                    <div className="rounded-xl bg-mystical-purple-950/50 border border-mystical-gold-700/30 px-4 py-3 text-sm text-mystical-gold-200">
                      {shareFeedback}
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-mystical-gold-700/30 bg-mystical-purple-950/40 p-6">
                      <Text className="text-sm text-mystical-gold-400 uppercase tracking-[0.3em]">命盘编号</Text>
                      <Heading level={3} className="text-lg text-mystical-gold-200 mt-2">{activeChartId || '—'}</Heading>
                      {activeChart?.chart_json?.bazi && (
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-mystical-gold-200">
                          <div>日柱：{activeChart.chart_json.bazi.day}</div>
                          <div>月柱：{activeChart.chart_json.bazi.month}</div>
                          <div>年柱：{activeChart.chart_json.bazi.year}</div>
                          <div>时柱：{activeChart.chart_json.bazi.hour}</div>
                        </div>
                      )}
                    </div>
                    <div className="rounded-3xl border border-mystical-gold-700/30 bg-mystical-purple-950/40 p-6">
                      <Text className="text-sm text-mystical-gold-400 uppercase tracking-[0.3em]">目标年份</Text>
                      <Heading level={3} className="text-lg text-mystical-gold-200 mt-2">{reportPayload?.targetYear || targetYear} 年</Heading>
                      {report?.prompt_version && (
                        <Text className="text-xs text-mystical-gold-300 mt-3">
                          模型版本：{report.model || '未知模型'} · Prompt {report.prompt_version}
                        </Text>
                      )}
                    </div>
                  </div>

                  {report?.summary?.key_insights?.length ? (
                    <div className="rounded-3xl border border-mystical-gold-700/40 bg-mystical-purple-900/40 p-6">
                      <Heading level={3} className="text-xl text-mystical-gold-400 mb-3">关键信息</Heading>
                      <ul className="space-y-2 text-sm text-mystical-gold-100">
                        {report.summary.key_insights.map((insight, index) => (
                          <li key={index} className="flex items-start gap-3">
                            <span className="mt-0.5 text-mystical-gold-400">✶</span>
                            <span className="leading-relaxed">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="rounded-3xl border border-mystical-gold-700/40 bg-mystical-purple-950/40 p-4">
                    <div className="flex flex-wrap gap-3">
                      {TABS.map(tab => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveTab(tab.key)}
                          className={`flex-1 min-w-[120px] px-4 py-3 rounded-2xl border text-sm transition-all ${
                            activeTab === tab.key
                              ? 'border-mystical-gold-500 bg-mystical-purple-900/60 text-mystical-gold-200 shadow-gold-glow'
                              : 'border-mystical-gold-700/20 text-mystical-gold-400 hover:border-mystical-gold-500/40'
                          }`}
                        >
                          <div className="font-semibold">{tab.label}</div>
                          <div className="text-xs opacity-70 mt-1">{tab.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 space-y-6">
                    {renderActiveTab()}
                  </div>

                  {payloadError && (
                    <div className="rounded-2xl border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm text-red-100">
                      {payloadError}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {!reportLoading && !hasReportContent && !jobId && !jobError && (
              <Card variant="mystical" className="p-12 text-center border border-mystical-gold-700/20">
                <div className="text-5xl mb-4" aria-hidden="true">🪄</div>
                <Heading level={2} className="text-2xl text-mystical-gold-400 mb-3">准备好迎接新一年的能量了吗？</Heading>
                <Text className="text-mystical-gold-300 mb-6">
                  选择命盘和年份，生成一份属于您的流年运势指南。
                </Text>
                <div className="flex justify-center">
                  <Button variant="gold" size="lg" onClick={handleGenerateReport} disabled={!canGenerate || charts.length === 0}>
                    立即生成
                  </Button>
                </div>
              </Card>
            )}
          </Container>
        </Section>
      </main>

      <Footer />
    </div>
  )
}
