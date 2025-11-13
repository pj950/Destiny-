import Link from 'next/link'
import { Container, Section, Heading, Text, Button, Card } from '../../components/ui'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'

export default function CheckoutCancel() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <Section background="mystical" className="pt-20 flex-1">
        <Container size="md">
          <div className="text-center">
            <Card className="p-12">
              <div className="text-6xl mb-6">⚠️</div>
              <Heading level={1} className="mb-4">
                支付已取消
              </Heading>
              <Text size="xl" className="mb-6 text-mystical-gold-600/80">
                您已取消支付流程
              </Text>
              
              <div className="bg-mystical-purple-900/30 rounded-lg p-6 mb-8 border border-mystical-gold-700/30">
                <Text className="text-mystical-gold-600/80 mb-4">
                  需要帮助？
                </Text>
                <Text size="sm" className="text-mystical-gold-700/60">
                  如果您在支付过程中遇到任何问题，请联系我们的客服团队。
                  我们将竭诚为您提供帮助。
                </Text>
              </div>

              <div className="space-y-4 mb-8">
                <Text className="text-mystical-gold-600/80">
                  您可以：
                </Text>
                <ul className="text-left space-y-2 max-w-md mx-auto">
                  <li className="flex items-start">
                    <span className="text-mystical-gold-500 mr-2">•</span>
                    <Text size="sm" className="text-mystical-gold-700/80">
                      重新选择适合您的订阅计划
                    </Text>
                  </li>
                  <li className="flex items-start">
                    <span className="text-mystical-gold-500 mr-2">•</span>
                    <Text size="sm" className="text-mystical-gold-700/80">
                      继续使用免费版功能
                    </Text>
                  </li>
                  <li className="flex items-start">
                    <span className="text-mystical-gold-500 mr-2">•</span>
                    <Text size="sm" className="text-mystical-gold-700/80">
                      查看常见问题了解更多信息
                    </Text>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/pricing">
                  <Button variant="primary" size="lg">
                    重新选择计划
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" size="lg">
                    返回首页
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </Container>
      </Section>

      <Footer />
    </div>
  )
}
