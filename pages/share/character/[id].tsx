import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Card, Section, Container, Heading, Text } from '../../../components/ui'
import Navbar from '../../../components/Navbar'
import Footer from '../../../components/Footer'
import type { BaziReport } from '../../../types/database'
import type { CharacterProfilePayload } from '../../../lib/gemini/schemas'

interface TraitItem {
  title: string
  detail?: string
  upgradeHint?: string
  locked?: boolean
}

interface ShareResponse {
  ok: boolean
  report?: BaziReport
  message?: string
}

export default function ShareCharacterPage() {
  const router = useRouter()
  const { id } = router.query
  const [report, setReport] = useState<BaziReport | null>(null)
  const [payload, setPayload] = useState<CharacterProfilePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id || typeof id !== 'string') return

    const fetchReport = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/reports/${id}`)
        const data = await res.json()

        if (data.ok && data.report) {
          setReport(data.report)
          
          try {
            const parsed = JSON.parse(data.report.body)
            setPayload(parsed)
          } catch (e) {
            console.error('Failed to parse report body:', e)
            setError('报告格式无效')
          }
        } else {
          setError(data.message || '报告不存在')
        }
      } catch (err: any) {
        console.error('Failed to fetch report:', err)
        setError(err.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-mystical-purple-950 to-mystical-cyan-950">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-bounce">✨</div>
            <Text className="text-mystical-gold-400">加载中...</Text>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-mystical-purple-950 to-mystical-cyan-950">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <Card variant="mystical" className="p-8 max-w-md text-center">
            <div className="text-4xl mb-4">❌</div>
            <Heading level={2} className="mb-4">加载失败</Heading>
            <Text className="text-mystical-gold-400 mb-6">
              {error || '无法加载报告'}
            </Text>
            <a href="/" className="text-mystical-gold-500 hover:text-mystical-gold-400 underline">
              返回首页
            </a>
          </Card>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-mystical-purple-950 to-mystical-cyan-950">
      <Navbar />
      
      <div className="flex-grow">
        <Section background="mystical" className="py-8">
          <Container size="lg">
            <Heading level={1} gradient className="mb-2">
              性格简报分享
            </Heading>
            <Text className="text-mystical-gold-400 mb-8">
              查看这个独特的性格分析
            </Text>

            <div className="space-y-8">
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
                  {payload.topTraits.map((trait, index) => (
                    <Card key={index} variant="mystical-gold" className="p-6 h-full">
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
                  ))}
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

              {/* CTA Section */}
              <Card className="p-8 bg-transparent border-t border-mystical-gold-700/30 text-center">
                <Heading level={2} className="mb-4">想要生成您的性格简报？</Heading>
                <Text className="text-mystical-gold-400 mb-6">
                  立即开始探索您独特的人格特质
                </Text>
                <a href="/" className="inline-block px-8 py-3 bg-gradient-to-r from-mystical-gold-700 to-mystical-gold-600 hover:from-mystical-gold-600 hover:to-mystical-gold-500 text-mystical-purple-950 rounded-xl font-semibold transition-all">
                  开始分析
                </a>
              </Card>
            </div>
          </Container>
        </Section>
      </div>

      <Footer />
    </div>
  )
}
