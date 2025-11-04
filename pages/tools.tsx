import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Button from '../components/Button'
import Section from '../components/Section'
import Card from '../components/Card'

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
      
      <Section background="dark" className="pt-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            占卜工具
          </h1>
          <p className="text-xl text-gray-300 mb-4 max-w-3xl mx-auto">
            探索东方智慧，洞察命运玄机
          </p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            我们提供全方位的命理分析工具，从基础排盘到深度解读，满足您的各种需求
          </p>
        </div>
      </Section>

      <Section background="gradient">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">核心功能</h2>
          <p className="text-xl text-gray-600">立即开始使用我们的核心服务</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {featuredTools.map((tool) => (
            <Card 
              key={tool.name} 
              className="p-8 cursor-pointer transform transition-all duration-300 hover:scale-105"
              hover
              onClick={() => handleToolClick(tool)}
            >
              <div className="text-center">
                <div className="text-6xl mb-4">{tool.icon}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{tool.name}</h3>
                <p className="text-gray-600 mb-6">{tool.description}</p>
                <Button variant="primary" size="md" fullWidth>
                  立即使用
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section background="white">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">更多工具</h2>
          <p className="text-xl text-gray-600">更多精彩功能即将推出</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {otherTools.map((tool) => (
            <Card 
              key={tool.name} 
              className="p-6 cursor-pointer relative overflow-hidden"
              hover={!tool.comingSoon}
              onClick={() => handleToolClick(tool)}
            >
              {tool.comingSoon && (
                <div className="absolute top-2 right-2">
                  <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">
                    即将推出
                  </span>
                </div>
              )}
              
              <div className="text-center">
                <div className="text-5xl mb-3">{tool.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{tool.name}</h3>
                <p className="text-sm text-gray-600">{tool.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section background="gradient">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">为什么选择我们的工具？</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="text-5xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">快速准确</h3>
            <p className="text-gray-600">
              采用先进算法，毫秒级计算，确保结果准确可靠
            </p>
          </div>

          <div className="text-center">
            <div className="text-5xl mb-4">🎓</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">专业权威</h3>
            <p className="text-gray-600">
              基于正宗的传统命理理论，结合现代科技创新
            </p>
          </div>

          <div className="text-center">
            <div className="text-5xl mb-4">🌟</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">易于使用</h3>
            <p className="text-gray-600">
              简洁直观的界面设计，无需专业知识即可上手
            </p>
          </div>
        </div>
      </Section>

      <Section background="dark">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-6">开始您的命运探索之旅</h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            免费试算八字命盘，体验AI智能解读
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg" onClick={() => router.push('/')}>
              免费试算
            </Button>
            <Button variant="secondary" size="lg" onClick={() => router.push('/pricing')}>
              查看价格
            </Button>
          </div>
        </div>
      </Section>

      <Footer />
    </div>
  )
}
