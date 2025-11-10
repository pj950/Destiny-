import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import useSWR from 'swr'
import Link from 'next/link'
import { Button, Card, Section, Container, Heading, Text } from '../../components/ui'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import type { BaziReport } from '../../types/database'
import type { CharacterProfilePayload } from '../../lib/gemini/schemas'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface TraitItem {
  title: string
  detail?: string
  upgradeHint?: string
  locked?: boolean
}

interface ApiResponse {
  ok: boolean
  report?: BaziReport
  cached?: boolean
  topTraits?: TraitItem[]
  message?: string
}

interface ChartsResponse {
  ok: boolean
  charts?: Array<{
    id: string
    profile_id: string
    chart_json: any
    ai_summary?: string
    created_at: string
  }>
}

export default function CharacterProfilePage() {
  const router = useRouter()
  const { chart_id } = router.query
  const [selectedChartId, setSelectedChartId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isPremium, setIsPremium] = useState(false)

  const { data: chartsData } = useSWR<ChartsResponse>('/api/my/charts', fetcher)
  
  // Fetch report data - note: the API uses POST, so we can't use GET with SWR
  // Instead, we'll handle this in the component state
  const [reportData, setReportData] = useState<ApiResponse | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Set initial chart ID from query params and auto-load report
  useEffect(() => {
    if (chart_id && typeof chart_id === 'string') {
      setSelectedChartId(chart_id)
      // Auto-load report when chart_id is in query params
      setReportLoading(true)
      fetch('/api/reports/character-profile?chart_id=' + chart_id)
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setReportData(data)
          } else {
            setError(data.message || '加载报告失败')
          }
        })
        .catch(err => setError(err.message || '网络错误'))
        .finally(() => setReportLoading(false))
    } else if (chartsData?.charts?.[0]?.id) {
      setSelectedChartId(chartsData.charts[0].id)
    }
  }, [chart_id, chartsData])

  // Check subscription tier
  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const res = await fetch('/api/subscriptions/current?user_id=current-user')
        const data = await res.json()
        if (data.ok && (data.data?.tier === 'premium' || data.data?.tier === 'vip')) {
          setIsPremium(true)
        }
      } catch (err) {
        console.error('Failed to check subscription:', err)
      }
    }
    checkSubscription()
  }, [])

  const handleGenerateReport = async () => {
    if (!selectedChartId) {
      setError('请选择一个命盘')
      return
    }
    setReportLoading(true)
    setError('')
    
    try {
      const res = await fetch('/api/reports/character-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart_id: selectedChartId })
      })
      const data = await res.json()
      
      if (data.ok) {
        setReportData(data)
      } else {
        setError(data.message || '生成报告失败')
      }
    } catch (err: any) {
      setError(err.message || '网络错误')
    } finally {
      setReportLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (!reportData?.report) return
    
    const element = document.getElementById('report-content')
    if (!element) return
    
    // Use browser's print-to-PDF functionality
    const printWindow = window.open('', '', 'height=600,width=800')
    if (!printWindow) {
      alert('打开打印窗口失败，请检查浏览器设置')
      return
    }
    
    const content = element.innerHTML
    const fileName = `character_profile_${selectedChartId}_${new Date().toISOString().split('T')[0]}`
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${fileName}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
          }
          @media print {
            body { margin: 0; padding: 10mm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const handleShare = () => {
    if (!reportData?.report) return
    
    const shareUrl = `${window.location.origin}/share/character/${reportData.report.id}`
    
    if (navigator.share) {
      navigator.share({
        title: '性格简报',
        text: '看看我的性格简报吧！',
        url: shareUrl
      }).catch(err => console.error('分享失败:', err))
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('分享链接已复制到剪贴板')
      }).catch(() => {
        alert('复制链接失败，请手动复制')
      })
    }
  }

  const charts = chartsData?.charts || []
  const report = reportData?.report
  let payload: CharacterProfilePayload | null = null

  if (report?.body) {
    try {
      payload = JSON.parse(report.body)
    } catch (e) {
      console.error('Failed to parse report body:', e)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-mystical-purple-950 to-mystical-cyan-950">
      <Navbar />
      
      <div className="flex-grow">
        <Section background="mystical" className="py-8">
          <Container size="lg">
            <Heading level={1} gradient className="mb-2">
              性格简报
            </Heading>
            <Text className="text-mystical-gold-400 mb-8">
              发现您独特的人格特质和超能力
            </Text>

            {/* Chart Selection Section */}
            {!chart_id && (
              <Card variant="mystical-gold" className="p-6 mb-8">
                <div className="space-y-4">
                  <label className="block">
                    <Text size="sm" className="font-semibold mb-2">选择命盘</Text>
                    <select
                      value={selectedChartId}
                      onChange={(e) => setSelectedChartId(e.target.value)}
                      disabled={loading || reportLoading}
                      className="w-full px-4 py-3 bg-mystical-purple-900/50 border border-mystical-gold-700/40 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-mystical-gold-500 transition-all"
                    >
                      <option value="">-- 请选择 --</option>
                      {charts.map(chart => (
                        <option key={chart.id} value={chart.id}>
                          命盘 #{chart.id.slice(0, 8)} - {new Date(chart.created_at).toLocaleDateString('zh-CN')}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex gap-4">
                    <Button
                      onClick={handleGenerateReport}
                      disabled={!selectedChartId || loading || reportLoading}
                      className="flex-1"
                    >
                      {loading || reportLoading ? '生成中...' : '生成简报'}
                    </Button>
                    {!selectedChartId && (
                      <Link href="/dashboard" className="flex-1">
                        <Button variant="secondary" className="w-full">
                          返回仪表板
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Error State */}
            {error && (
              <Card className="p-6 mb-8 border-l-4 border-red-500 bg-red-50/10">
                <div className="flex items-start gap-4">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <Heading level={3} size="lg" className="text-red-400 mb-2">
                      生成失败
                    </Heading>
                    <Text className="text-red-300 mb-4">
                      {error || '生成报告时出现错误'}
                    </Text>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleGenerateReport}
                        size="sm"
                        variant="secondary"
                      >
                        重试
                      </Button>
                      <Link href="/dashboard">
                        <Button size="sm" variant="secondary">
                          返回仪表板
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Loading State */}
            {(loading || reportLoading) && !report && (
              <div className="space-y-8">
                <Card variant="mystical-gold" className="p-8 animate-pulse">
                  <div className="h-8 bg-mystical-gold-700/20 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-mystical-gold-700/20 rounded w-full mb-2"></div>
                  <div className="h-4 bg-mystical-gold-700/20 rounded w-5/6"></div>
                </Card>
                <div className="text-center">
                  <div className="text-2xl mb-3 animate-bounce">✨</div>
                  <Text className="text-mystical-gold-400">
                    正在生成您的性格简报...
                  </Text>
                </div>
              </div>
            )}

            {/* Report Content */}
            {report && payload && (
              <div id="report-content" className="space-y-8">
                {/* Core Persona Section */}
                <Card variant="mystical-gold" className="p-8">
                  <div className="text-center">
                    <Heading level={2} className="text-3xl md:text-4xl text-mystical-gold-500 mb-2">
                      {payload.corePersona.archetype}
                    </Heading>
                    <Text className="text-mystical-gold-400 text-lg">
                      {payload.corePersona.description}
                    </Text>
                    <div className="mt-4 inline-block px-4 py-2 bg-mystical-gold-700/20 rounded-full">
                      <Text size="sm" className="text-mystical-gold-400">
                        五行焦点: {payload.corePersona.elementFocus}
                      </Text>
                    </div>
                  </div>
                </Card>

                {/* Top Traits Section */}
                <div>
                  <Heading level={2} size="xl" className="text-white mb-6">
                    🎯 核心特质
                  </Heading>
                  <div className="grid md:grid-cols-2 gap-6">
                    {payload.topTraits.map((trait, index) => {
                      const isLocked = trait.locked && !isPremium
                      return (
                        <div key={index}>
                          {isLocked ? (
                            <Card variant="mystical" className="p-6 h-full flex flex-col justify-between border-2 border-mystical-gold-700/30 opacity-75">
                              <div>
                                <Heading level={3} className="text-mystical-gold-500 mb-3 flex items-start gap-2">
                                  <span className="text-xl">🔒</span> {trait.title}
                                </Heading>
                                <Text className="text-mystical-gold-300 mb-4">
                                  {trait.upgradeHint || '此特质仅限高级用户解锁'}
                                </Text>
                              </div>
                              <div className="flex gap-2 mt-4">
                                <Link href="/pricing" className="flex-1">
                                  <Button size="sm" className="w-full">
                                    升级解锁
                                  </Button>
                                </Link>
                              </div>
                            </Card>
                          ) : (
                            <Card variant="mystical-gold" className="p-6 h-full">
                              <Heading level={3} className="text-mystical-gold-500 mb-3 flex items-start gap-2">
                                <span className="text-xl">
                                  {index === 0 ? '⭐' : index === 1 ? '💫' : '🌟'}
                                </span>
                                {trait.title}
                              </Heading>
                              <Text className="text-white leading-relaxed">
                                {trait.detail}
                              </Text>
                            </Card>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Super Power Section */}
                <Card variant="mystical-gold" className="p-8">
                  <div className="flex items-start gap-6">
                    <div className="text-5xl flex-shrink-0">⚡</div>
                    <div>
                      <Heading level={2} className="text-mystical-gold-500 mb-4">
                        Your Superpower
                      </Heading>
                      <Text className="text-white leading-relaxed text-lg mb-4">
                        <strong>{payload.superPower.title}</strong>
                      </Text>
                      <Text className="text-mystical-gold-300 leading-relaxed">
                        {payload.superPower.activation}
                      </Text>
                    </div>
                  </div>
                </Card>

                {/* Master's Insight Section */}
                <Card variant="mystical" className="p-8 border border-mystical-gold-700/30">
                  <div className="flex items-start gap-6">
                    <div className="text-5xl flex-shrink-0">🧙</div>
                    <div className="flex-1">
                      <Heading level={2} className="text-mystical-gold-500 mb-4">
                        Master's Insight
                      </Heading>
                      <Text className="text-white leading-relaxed">
                        {payload.mastersInsight}
                      </Text>
                    </div>
                  </div>
                </Card>

                {/* Opportunity Preview Section */}
                <Card variant="mystical-gold" className="p-8">
                  <div className="flex items-start gap-6">
                    <div className="text-5xl flex-shrink-0">🌱</div>
                    <div className="flex-1">
                      <Heading level={2} className="text-mystical-gold-500 mb-4">
                        Opportunity Preview
                      </Heading>
                      <Text className="text-white leading-relaxed">
                        {payload.opportunityPreview}
                      </Text>
                    </div>
                  </div>
                </Card>

                {/* Action Buttons */}
                <Card className="p-6 bg-transparent border-t border-mystical-gold-700/30">
                  <div className="flex flex-wrap gap-4 justify-center">
                    <Button onClick={handleExportPDF} size="lg" variant="secondary">
                      📥 导出 PDF
                    </Button>
                    <Button onClick={handleShare} size="lg" variant="secondary">
                      📤 分享
                    </Button>
                    {chart_id && (
                      <Link href="/dashboard">
                        <Button size="lg" variant="secondary">
                          🏠 返回仪表板
                        </Button>
                      </Link>
                    )}
                  </div>
                </Card>

                {/* Generated Info */}
                <div className="text-center pt-4 border-t border-mystical-gold-700/30">
                  <Text size="sm" className="text-mystical-gold-600">
                    生成于 {new Date(report.created_at).toLocaleString('zh-CN')}
                    {reportData?.cached && <span className="ml-2">（缓存）</span>}
                  </Text>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!report && !loading && !reportLoading && !error && (
              <Card variant="mystical" className="p-12 text-center">
                <div className="text-6xl mb-4">📋</div>
                <Heading level={2} className="mb-4">准备好发现自己吗？</Heading>
                <Text className="text-mystical-gold-400 mb-6">
                  选择一个命盘，生成您独特的性格简报
                </Text>
                {!charts.length && (
                  <Link href="/">
                    <Button>创建第一个命盘</Button>
                  </Link>
                )}
              </Card>
            )}
          </Container>
        </Section>
      </div>

      <Footer />
    </div>
  )
}
