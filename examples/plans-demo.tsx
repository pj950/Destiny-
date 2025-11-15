import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { PlansSection } from '../components/subscription'
import Container from '../components/ui/Container'
import Section from '../components/ui/Section'
import Heading from '../components/ui/Heading'
import Text from '../components/ui/Text'
import { SubscriptionTier } from '../types/database'

export default function PlansDemo() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | undefined>()
  
  useEffect(() => {
    // In a real app, this would come from auth context
    const uid = localStorage.getItem('user_id')
    setUserId(uid || undefined)
  }, [])

  const handleSelectPlan = (planId: SubscriptionTier) => {
    console.log('User selected plan:', planId)
    // Redirect to checkout with selected plan
    router.push(`/checkout?plan=${planId}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <Section background="mystical" className="pt-20">
        <Container>
          <div className="text-center">
            <Heading level={1} gradient className="mb-6">
              选择您的订阅计划
            </Heading>
            <Text size="xl" className="mb-4 max-w-3xl mx-auto text-mystical-gold-400">
              升级您的订阅，解锁更多功能
            </Text>
            <Text size="lg" className="max-w-2xl mx-auto text-mystical-gold-600/80">
              从免费试用到VIP专享，满足您的所有需求
            </Text>
          </div>
        </Container>
      </Section>

      {/* Plans Section */}
      <Section background="mystical-dark" spacing="spacious">
        <Container size="xl">
          <PlansSection 
            userId={userId}
            onSelectPlan={handleSelectPlan}
          />
        </Container>
      </Section>

      {/* Features Comparison Info */}
      <Section background="mystical">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h3 className="text-mystical-gold-400 font-semibold mb-2">📊 流年分析</h3>
              <p className="text-mystical-gold-600/80 text-sm">
                从基础的月度分析到完整的流年预测
              </p>
            </div>
            <div>
              <h3 className="text-mystical-gold-400 font-semibold mb-2">💬 AI咨询</h3>
              <p className="text-mystical-gold-600/80 text-sm">
                从免费到每月100条的智能问答服务
              </p>
            </div>
            <div>
              <h3 className="text-mystical-gold-400 font-semibold mb-2">📥 数据导出</h3>
              <p className="text-mystical-gold-600/80 text-sm">
                支持PDF、Excel等多种格式导出
              </p>
            </div>
            <div>
              <h3 className="text-mystical-gold-400 font-semibold mb-2">👨‍👩‍👧‍👦 家族对比</h3>
              <p className="text-mystical-gold-600/80 text-sm">
                Premium及以上计划支持家族成员对比
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Footer />
    </div>
  )
}
