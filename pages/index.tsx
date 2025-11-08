import { useState } from 'react'
import { useRouter } from 'next/router'
import { Button, Card, Section, Container, Heading, Text, Input } from '../components/ui'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function Home() {
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('1990-01-01T08:00')
  const [tz, setTz] = useState('Asia/Shanghai')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleCompute = async () => {
    setError('')
    
    if (!birth) {
      setError('请输入出生日期和时间')
      return
    }
    
    if (!tz) {
      setError('请选择时区')
      return
    }
    
    setLoading(true)
    
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, birth_local: birth, birth_timezone: tz, gender })
      })
      const j = await res.json()
      
      if (j.ok) {
        router.push(`/compute?profile_id=${j.profile_id}`)
      } else {
        setError(j.error || '创建失败，请重试')
      }
    } catch (err) {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <Section background="mystical" className="pt-20" spacing="spacious">
        <Container size="lg">
          <div className="text-center">
            <Heading level={1} gradient className="mb-6">
              探索命运的奥秘
            </Heading>
            <Text size="xl" className="mb-4 max-w-3xl mx-auto text-mystical-gold-400">
              结合千年东方智慧与现代AI技术
            </Text>
            <Text size="lg" className="mb-12 max-w-2xl mx-auto text-mystical-gold-600/80">
              输入您的出生信息，获取专业的八字命盘分析和AI解读
            </Text>
            
            <Card className="p-8 md:p-10 mx-auto max-w-2xl" variant="mystical-gold">
              <Heading level={2} size="2xl" className="mb-6">免费试算您的命盘</Heading>
              
              <div className="space-y-4">
                <Input
                  id="name"
                  label="姓名"
                  helperText="(可选)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="请输入您的姓名"
                  disabled={loading}
                />
                
                <Input
                  id="birth"
                  type="datetime-local"
                  label="出生日期和时间"
                  required
                  value={birth}
                  onChange={e => setBirth(e.target.value)}
                  disabled={loading}
                />
                
                <div>
                  <label htmlFor="timezone" className="block text-left text-sm font-medium text-gray-700 mb-2">
                    时区 <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="timezone"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary-500 focus:border-transparent transition-all text-gray-900 bg-white"
                    value={tz}
                    onChange={e => setTz(e.target.value)}
                    disabled={loading}
                    required
                  >
                    <option value="Asia/Shanghai">中国标准时间 (CST)</option>
                    <option value="Asia/Hong_Kong">香港时间 (HKT)</option>
                    <option value="Asia/Taipei">台北时间 (CST)</option>
                    <option value="Asia/Singapore">新加坡时间 (SGT)</option>
                    <option value="Asia/Tokyo">东京时间 (JST)</option>
                    <option value="America/New_York">纽约时间 (EST/EDT)</option>
                    <option value="America/Los_Angeles">洛杉矶时间 (PST/PDT)</option>
                    <option value="Europe/London">伦敦时间 (GMT/BST)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                    性别
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="male"
                        checked={gender === 'male'}
                        onChange={e => setGender(e.target.value as 'male')}
                        className="mr-2 text-brand-primary-600 focus:ring-brand-primary-500"
                        disabled={loading}
                      />
                      <span className="text-gray-700">男</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="female"
                        checked={gender === 'female'}
                        onChange={e => setGender(e.target.value as 'female')}
                        className="mr-2 text-brand-primary-600 focus:ring-brand-primary-500"
                        disabled={loading}
                      />
                      <span className="text-gray-700">女</span>
                    </label>
                  </div>
                </div>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}
                
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleCompute}
                  loading={loading}
                >
                  立即开始试算
                </Button>
              </div>
            </Card>
          </div>
        </Container>
      </Section>

      <Section background="mystical-gradient">
        <Container>
          <div className="text-center mb-16">
            <Heading level={2} className="mb-4 text-mystical-gold-400">为什么选择我们？</Heading>
            <Text size="xl" className="text-mystical-gold-600/80">专业、准确、值得信赖的命理服务</Text>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card hover className="p-8 text-center" variant="mystical">
              <div className="text-5xl mb-4">🎯</div>
              <Heading level={3} size="xl" className="mb-3 text-mystical-gold-400">精准计算</Heading>
              <Text className="text-mystical-gold-600/80">
                基于正宗的八字命理算法，精确计算您的四柱八字和五行属性
              </Text>
            </Card>
            
            <Card hover className="p-8 text-center" variant="mystical">
              <div className="text-5xl mb-4">🤖</div>
              <Heading level={3} size="xl" className="mb-3 text-mystical-gold-400">AI智能解读</Heading>
              <Text className="text-mystical-gold-600/80">
                运用先进的人工智能技术，提供深入浅出的命运解析
              </Text>
            </Card>
            
            <Card hover className="p-8 text-center" variant="mystical">
              <div className="text-5xl mb-4">🔒</div>
              <Heading level={3} size="xl" className="mb-3 text-mystical-gold-400">隐私保护</Heading>
              <Text className="text-mystical-gold-600/80">
                严格保护您的个人信息，所有数据加密存储，安全可靠
              </Text>
            </Card>
          </div>
        </Container>
      </Section>

      <Section background="mystical-dark">
        <Container>
          <div className="text-center mb-16">
            <Heading level={2} className="mb-4 text-mystical-gold-400">我们的服务</Heading>
            <Text size="xl" className="text-mystical-gold-600/80">多维度的命理分析，助您了解自我</Text>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6" variant="mystical-gold">
              <div className="text-4xl mb-3">📅</div>
              <Heading level={3} size="lg" className="mb-2 text-mystical-gold-400">八字排盘</Heading>
              <Text size="sm" className="text-mystical-gold-600/80">
                计算您的年月日时四柱，展示完整的八字命盘
              </Text>
            </Card>
            
            <Card className="p-6" variant="mystical-gold">
              <div className="text-4xl mb-3">🌊</div>
              <Heading level={3} size="lg" className="mb-2 text-mystical-gold-400">五行分析</Heading>
              <Text size="sm" className="text-mystical-gold-600/80">
                分析金木水火土五行平衡，了解您的命理特质
              </Text>
            </Card>
            
            <Card className="p-6" variant="mystical-gold">
              <div className="text-4xl mb-3">💼</div>
              <Heading level={3} size="lg" className="mb-2 text-mystical-gold-400">事业运势</Heading>
              <Text size="sm" className="text-mystical-gold-600/80">
                解读事业发展方向，把握职场机遇
              </Text>
            </Card>
            
            <Card className="p-6" variant="mystical-gold">
              <div className="text-4xl mb-3">❤️</div>
              <Heading level={3} size="lg" className="mb-2 text-mystical-gold-400">感情分析</Heading>
              <Text size="sm" className="text-mystical-gold-600/80">
                了解感情运势，助您收获美满姻缘
              </Text>
            </Card>
          </div>
        </Container>
      </Section>

      <Section background="mystical">
        <Container>
          <div className="text-center">
            <Heading level={2} className="mb-6 text-mystical-gold-400">立即开始您的命运探索</Heading>
            <Text size="xl" className="mb-8 max-w-2xl mx-auto text-mystical-gold-600/80">
              免费试算，深度报告，一站式命理服务
            </Text>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="gold" size="lg" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
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
