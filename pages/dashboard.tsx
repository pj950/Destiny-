import { useEffect, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface Job {
  id: string
  chart_id: string
  job_type: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  result_url: string | null
  metadata: {
    checkout_session_id?: string
    payment_confirmed?: boolean
    error?: string
  }
  created_at: string
  updated_at: string
}

interface Chart {
  id: string
  profile_id: string
  chart_json: any
  wuxing_scores: any
  ai_summary: string | null
  created_at: string
}

export default function Dashboard() {
  const { data: chartsData } = useSWR('/api/my/charts', fetcher)
  const [jobs, setJobs] = useState<Record<string, Job>>({})
  const [polling, setPolling] = useState<Set<string>>(new Set())

  const charts: Chart[] = chartsData?.charts || []

  // Fetch jobs for all charts
  useEffect(() => {
    if (!charts.length) return

    const fetchJobs = async () => {
      try {
        const response = await fetch('/api/my/jobs')
        const data = await response.json()
        
        if (data.ok && data.jobs) {
          const jobsMap: Record<string, Job> = {}
          data.jobs.forEach((job: Job) => {
            jobsMap[job.chart_id] = job
          })
          setJobs(jobsMap)

          // Start polling for pending/processing jobs
          const newPolling = new Set<string>()
          data.jobs.forEach((job: Job) => {
            if (job.status === 'pending' || job.status === 'processing') {
              newPolling.add(job.id)
            }
          })
          setPolling(newPolling)
        }
      } catch (err) {
        console.error('Failed to fetch jobs:', err)
      }
    }

    fetchJobs()
  }, [charts.length])

  // Poll for job status updates
  useEffect(() => {
    if (polling.size === 0) return

    const interval = setInterval(async () => {
      const updatedJobs: Record<string, Job> = { ...jobs }
      const stillPolling = new Set<string>()

      for (const jobId of polling) {
        try {
          const response = await fetch(`/api/jobs/${jobId}`)
          const data = await response.json()
          
          if (data.ok && data.job) {
            const job: Job = data.job
            updatedJobs[job.chart_id] = job

            // Continue polling if still in progress
            if (job.status === 'pending' || job.status === 'processing') {
              stillPolling.add(jobId)
            }
          }
        } catch (err) {
          console.error(`Failed to poll job ${jobId}:`, err)
        }
      }

      setJobs(updatedJobs)
      setPolling(stillPolling)
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
  }, [polling.size, jobs])

  const getJobStatus = (chartId: string) => {
    const job = jobs[chartId]
    if (!job) return null

    switch (job.status) {
      case 'pending':
        return (
          <span className="text-yellow-600 flex items-center gap-2">
            <span className="animate-pulse">⏳</span> 等待生成报告...
          </span>
        )
      case 'processing':
        return (
          <span className="text-blue-600 flex items-center gap-2">
            <span className="animate-spin">⚙️</span> 正在生成报告...
          </span>
        )
      case 'done':
        return (
          <a 
            href={job.result_url || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-green-600 hover:text-green-700 underline flex items-center gap-2"
          >
            ✓ 查看深度报告
          </a>
        )
      case 'failed':
        return (
          <span className="text-red-600 flex items-center gap-2" title={job.metadata?.error}>
            ✗ 生成失败
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900">我的命盘</h2>
          <Link href="/" className="text-blue-600 hover:text-blue-700 underline">
            创建新命盘
          </Link>
        </div>

        {!charts.length && (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-600 mb-4">您还没有创建任何命盘</p>
            <Link href="/" className="text-blue-600 hover:text-blue-700 underline">
              立即创建
            </Link>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {charts.map((chart) => (
            <div key={chart.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  命盘 #{chart.id.slice(0, 8)}
                </h3>
                <p className="text-sm text-gray-500">
                  创建于: {new Date(chart.created_at).toLocaleString('zh-CN')}
                </p>
              </div>

              {chart.ai_summary && (
                <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm text-gray-700 line-clamp-3">
                    {chart.ai_summary}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Link 
                  href={`/chart/${chart.id}`}
                  className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
                >
                  查看命盘
                </Link>

                <div className="pt-2 border-t border-gray-200">
                  {getJobStatus(chart.id) || (
                    <Link 
                      href={`/chart/${chart.id}#report`}
                      className="text-sm text-gray-600 hover:text-gray-900 underline"
                    >
                      购买深度报告
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
