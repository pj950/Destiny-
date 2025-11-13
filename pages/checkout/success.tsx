import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Container, Section, Heading, Text, Button, Card } from '../../components/ui'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'

export default function CheckoutSuccess() {
  const router = useRouter()
  const { session_id } = router.query
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading state
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <Section background="mystical" className="pt-20 flex-1">
        <Container size="md">
          <div className="text-center">
            {loading ? (
              <Card className="p-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-mystical-gold-500 mx-auto mb-6"></div>
                <Heading level={2} className="mb-4">
                  正在确认支付...
                </Heading>
                <Text className="text-mystical-gold-600/80">
                  请稍候，我们正在验证您的支付信息
                </Text>
              </Card>
            ) : (
              <Card className="p-12" variant="mystical-gold">
                <div className="text-6xl mb-6">✅</div>
                <Heading level={1} gradient className="mb-4">
                  支付成功！
                </Heading>
                <Text size="xl" className="mb-6 text-mystical-gold-400">
                  感谢您的订阅，您的账户已成功升级
                </Text>
                
                <div className="bg-mystical-purple-900/30 rounded-lg p-6 mb-8 border border-mystical-gold-700/30">
                  <Text className="text-mystical-gold-600/80 mb-4">
                    订单信息
                  </Text>
                  {session_id && (
                    <Text size="sm" className="text-mystical-gold-700/60 font-mono break-all">
                      订单号: {session_id}
                    </Text>
                  )}
                </div>

                <div className="space-y-4">
                  <Text className="text-mystical-gold-600/80">
                    您现在可以享受订阅计划的所有功能：
                  </Text>
                  <ul className="text-left space-y-2 max-w-md mx-auto">
                    <li className="flex items-start">
                      <span className="text-mystical-gold-500 mr-2">✓</span>
                      <Text size="sm" className="text-mystical-gold-700/80">
                        无限制生成流年运势报告
                      </Text>
                    </li>
                    <li className="flex items-start">
                      <span className="text-mystical-gold-500 mr-2">✓</span>
                      <Text size="sm" className="text-mystical-gold-700/80">
                        AI 智能问答功能
                      </Text>
                    </li>
                    <li className="flex items-start">
                      <span className="text-mystical-gold-500 mr-2">✓</span>
                      <Text size="sm" className="text-mystical-gold-700/80">
                        导出报告为 PDF 格式
                      </Text>
                    </li>
                    <li className="flex items-start">
                      <span className="text-mystical-gold-500 mr-2">✓</span>
                      <Text size="sm" className="text-mystical-gold-700/80">
                        优先客服支持
                      </Text>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/pricing">
                    <Button variant="gold" size="lg">
                      查看订阅详情
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline" size="lg">
                      返回首页
                    </Button>
                  </Link>
                </div>
              </Card>
            )}
          </div>
        </Container>
      </Section>

      <Footer />
    </div>
  )
}
