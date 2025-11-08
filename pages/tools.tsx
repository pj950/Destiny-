import { useRouter } from 'next/router'
import { Button, Card, Section, Container, Heading, Text } from '../components/ui'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

interface Tool {
  name: string
  description: string
  icon: string
  link: string
  comingSoon?: boolean
  featured?: boolean
}

export default function Tools() {
  const router = useRouter()

  const tools: Tool[] = [
    {
      name: '八字排盘',
      description: '输入出生信息，快速计算您的四柱八字，了解命盘结构和五行平衡',
      icon: '📅',
      link: '/',
      featured: true
    },
    {
      name: 'AI智能解读',
      description: '基于您的八字命盘，AI智能分析您的性格特质、运势走向',
      icon: '🤖',
      link: '/',
      featured: true
    },
    {
      name: '深度命理报告',
      description: '专业级详细报告，涵盖事业、财运、感情、健康等多个维度',
      icon: '📊',
      link: '/pricing'
    },
    {
      name: '流年运势',
      description: '查看年度运势变化，把握每年的机遇与挑战',
      icon: '📆',
      link: '#',
      comingSoon: true
    },
    {
      name: '合婚配对',
      description: '分析两人八字的契合度，提供婚姻感情建议',
      icon: '💑',
      link: '#',
      comingSoon: true
    },
    {
      name: '择日择吉',
      description: '根据八字选择适合的日期，用于婚嫁、开业、搬家等重要事宜',
      icon: '🗓️',
      link: '#',
      comingSoon: true
    },
    {
      name: '姓名分析',
      description: '结合八字五行，分析姓名的吉凶和能量',
      icon: '✍️',
      link: '#',
      comingSoon: true
    },
    {
      name: '风水指南',
      description: '根据八字提供个性化的风水布局建议',
      icon: '🏠',
      link: '#',
      comingSoon: true
    },
    {
      name: '事业规划',
      description: '基于命盘分析最适合的职业方向和发展时机',
      icon: '💼',
      link: '#',
      comingSoon: true
    },
    {
      name: '财运分析',
      description: '深度解读财运走势，把握投资理财的最佳时机',
      icon: '💰',
      link: '#',
      comingSoon: true
    },
    {
      name: '健康提示',
      description: '根据五行平衡，提供健康养生建议',
      icon: '🏥',
      link: '#',
      comingSoon: true
    },
    {
      name: '运势查询',
      description: '查询每日、每周、每月的运势变化和注意事项',
      icon: '🔮',
      link: '#',
      comingSoon: true
    }
  ]

  const handleToolClick = (tool: Tool) => {
    if (tool.comingSoon) {
      alert('此功能即将推出，敬请期待！')
      return
    }
    router.push(tool.link)
  }

  const featuredTools = tools.filter(t => t.featured)
  const otherTools = tools.filter(t => !t.featured)

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <Section background="mystical" className="pt-20">
        <Container>
          <div className="text-center">
            <Heading level={1} gradient className="mb-6">
              占卜工具
            </Heading>
            <Text size="xl" className="mb-4 max-w-3xl mx-auto text-mystical-gold-400">
              探索东方智慧，洞察命运玄机
            </Text>
            <Text size="lg" className="max-w-2xl mx-auto text-mystical-gold-600/80">
              我们提供全方位的命理分析工具，从基础排盘到深度解读，满足您的各种需求
            </Text>
          </div>
        </Container>
      </Section>

      <Section background="mystical-dark">
        <Container>
          <div className="text-center mb-12">
            <Heading level={2} className="mb-4 text-mystical-gold-400">核心功能</Heading>
            <Text size="xl" className="text-mystical-gold-600/80">立即开始使用我们的核心服务</Text>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            {featuredTools.map((tool) => (
              <Card 
                key={tool.name} 
                className="p-8 cursor-pointer transform transition-all duration-300 hover:scale-105"
                hover
                onClick={() => handleToolClick(tool)}
                variant="mystical-gold"
              >
                <div className="text-center">
                  <div className="text-6xl mb-4">{tool.icon}</div>
                  <Heading level={3} size="2xl" className="mb-3 text-mystical-gold-400">{tool.name}</Heading>
                  <Text className="mb-6 text-mystical-gold-600/80">{tool.description}</Text>
                  <Button variant="gold" size="md" fullWidth>
                    立即使用
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section background="mystical-gradient">
        <Container>
          <div className="text-center mb-12">
            <Heading level={2} className="mb-4 text-mystical-gold-400">更多工具</Heading>
            <Text size="xl" className="text-mystical-gold-600/80">更多精彩功能即将推出</Text>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {otherTools.map((tool) => (
              <Card 
                key={tool.name} 
                className="p-6 cursor-pointer relative overflow-hidden"
                hover={!tool.comingSoon}
                onClick={() => handleToolClick(tool)}
                variant="mystical"
              >
                {tool.comingSoon && (
                  <div className="absolute top-2 right-2">
                    <span className="bg-mystical-rose-900/50 text-mystical-gold-400 text-xs font-semibold px-2 py-1 rounded border border-mystical-gold-700/50">
                      即将推出
                    </span>
                  </div>
                )}
                
                <div className="text-center">
                  <div className="text-5xl mb-3">{tool.icon}</div>
                  <Heading level={3} size="lg" className="mb-2 text-mystical-gold-400">{tool.name}</Heading>
                  <Text size="sm" className="text-mystical-gold-600/80">{tool.description}</Text>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section background="gradient">
        <Container size="lg">
          <div className="text-center mb-12">
            <Heading level={2} className="mb-4">为什么选择我们的工具？</Heading>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-5xl mb-4">⚡</div>
              <Heading level={3} size="xl" className="mb-3">快速准确</Heading>
              <Text color="secondary">
                采用先进算法，毫秒级计算，确保结果准确可靠
              </Text>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">🎓</div>
              <Heading level={3} size="xl" className="mb-3">专业权威</Heading>
              <Text color="secondary">
                基于正宗的传统命理理论，结合现代科技创新
              </Text>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">🌟</div>
              <Heading level={3} size="xl" className="mb-3">易于使用</Heading>
              <Text color="secondary">
                简洁直观的界面设计，无需专业知识即可上手
              </Text>
            </div>
          </div>
        </Container>
      </Section>

      <Section background="mystical">
        <Container>
          <div className="text-center">
            <Heading level={2} className="mb-6 text-mystical-gold-400">开始您的命运探索之旅</Heading>
            <Text size="xl" className="mb-8 max-w-2xl mx-auto text-mystical-gold-600/80">
              免费试算八字命盘，体验AI智能解读
            </Text>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="gold" size="lg" onClick={() => router.push('/')}>
                免费试算
              </Button>
              <Button variant="mystical" size="lg" onClick={() => router.push('/pricing')}>
                查看价格
              </Button>
            </div>
          </div>
        </Container>
      </Section>

      <Footer />
    </div>
  )
}
