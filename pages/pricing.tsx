import { useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Button from '../components/Button'
import Section from '../components/Section'
import Card from '../components/Card'

interface PricingTier {
  name: string
  nameEn: string
  price: string
  priceDetail: string
  features: string[]
  icon: string
  recommended?: boolean
  comingSoon?: boolean
}

export default function Pricing() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const pricingTiers: PricingTier[] = [
    {
      name: '基础版',
      nameEn: 'Basic',
      price: '免费',
      priceDetail: '永久免费',
      icon: '🌱',
      features: [
        '基础八字排盘',
        '五行分析',
        'AI智能简要解读',
        '保存3个命盘',
        '基础运势分析',
      ]
    },
    {
      name: '专业版',
      nameEn: 'Professional',
      price: '¥199',
      priceDetail: '一次性付费',
      icon: '⭐',
      recommended: true,
      features: [
        '✨ 所有基础版功能',
        '深度命盘分析报告',
        '详细运势解读',
        '事业与财运分析',
        '感情与健康指导',
        '终身报告访问',
        '保存无限命盘',
        '优先客服支持',
      ]
    },
    {
      name: '大师版',
      nameEn: 'Master',
      price: '¥599',
      priceDetail: '年度订阅',
      icon: '👑',
      comingSoon: true,
      features: [
        '✨ 所有专业版功能',
        '每月详细运势预测',
        '流年流月分析',
        '合婚配对分析',
        '择日择吉建议',
        '一对一大师咨询',
        '定制化解方案',
        '线下活动优先权',
      ]
    }
  ]

  const handleSelectPlan = async (tier: PricingTier) => {
    if (tier.comingSoon) {
      alert('此套餐即将推出，敬请期待！')
      return
    }

    if (tier.price === '免费') {
      router.push('/')
      return
    }

    setLoading(tier.nameEn)

    try {
      const chartId = router.query.chart_id || 'demo-chart-id'
      
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart_id: chartId })
      })
      
      const data = await res.json()
      
      if (data.ok && data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        alert(data.error || '创建支付失败，请重试')
      }
    } catch (err) {
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <Section background="dark" className="pt-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            选择适合您的方案
          </h1>
          <p className="text-xl text-gray-300 mb-4 max-w-3xl mx-auto">
            从免费试算到专业深度报告，满足不同需求
          </p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            所有方案均基于正宗八字命理算法，结合AI智能分析
          </p>
        </div>
      </Section>

      <Section background="gradient" className="pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingTiers.map((tier, index) => (
            <div key={tier.nameEn} className="relative">
              {tier.recommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                    最受欢迎
                  </span>
                </div>
              )}
              
              <Card 
                className={`p-8 h-full flex flex-col ${tier.recommended ? 'border-2 border-purple-500 shadow-2xl transform md:scale-105' : ''}`}
                hover={!tier.comingSoon}
              >
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">{tier.icon}</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{tier.nameEn}</p>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                  </div>
                  <p className="text-sm text-gray-600">{tier.priceDetail}</p>
                </div>

                {tier.comingSoon && (
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg text-sm text-center">
                    即将推出
                  </div>
                )}

                <ul className="space-y-3 mb-8 flex-grow">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={tier.recommended ? 'primary' : 'outline'}
                  size="lg"
                  fullWidth
                  onClick={() => handleSelectPlan(tier)}
                  disabled={loading === tier.nameEn || tier.comingSoon}
                >
                  {loading === tier.nameEn ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      处理中...
                    </span>
                  ) : tier.comingSoon ? (
                    '敬请期待'
                  ) : tier.price === '免费' ? (
                    '立即开始'
                  ) : (
                    '立即购买'
                  )}
                </Button>
              </Card>
            </div>
          ))}
        </div>
      </Section>

      <Section background="white">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">常见问题</h2>
          <p className="text-xl text-gray-600">关于我们服务的常见疑问解答</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">🤔 八字命理准确吗？</h3>
            <p className="text-gray-600">
              八字命理是中国传统文化的重要组成部分，历经千年验证。我们使用正宗的算法，结合现代AI技术，提供准确的分析和解读。
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">💳 支付安全吗？</h3>
            <p className="text-gray-600">
              我们使用国际领先的Stripe支付平台，采用银行级加密技术，保障您的支付安全。支持多种支付方式，安全便捷。
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">📊 深度报告包含什么内容？</h3>
            <p className="text-gray-600">
              深度报告包括详细的八字分析、五行平衡、性格特质、事业运势、财运分析、感情运势、健康建议等多个维度，长达数千字的专业解读。
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">🔄 可以退款吗？</h3>
            <p className="text-gray-600">
              由于报告为数字化产品，一经生成即视为完成交付。如有质量问题，请联系客服，我们将根据具体情况提供解决方案。
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">⏰ 报告多久能生成？</h3>
            <p className="text-gray-600">
              付款成功后，系统会自动开始生成深度报告。通常在5-10分钟内完成，您可以在"我的命盘"页面查看进度并下载报告。
            </p>
          </Card>
        </div>
      </Section>

      <Section background="dark">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-6">还有疑问？</h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            我们的客服团队随时为您解答
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg" onClick={() => router.push('/')}>
              免费试算
            </Button>
            <Button variant="secondary" size="lg" onClick={() => alert('客服功能即将推出')}>
              联系客服
            </Button>
          </div>
        </div>
      </Section>

      <Footer />
    </div>
  )
}
