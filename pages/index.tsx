import { useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Button from '../components/Button'
import Section from '../components/Section'
import Card from '../components/Card'

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
      
      <Section background="dark" className="pt-20 pb-32">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            探索命运的奥秘
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto">
            结合千年东方智慧与现代AI技术
          </p>
          <p className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto">
            输入您的出生信息，获取专业的八字命盘分析和AI解读
          </p>
          
          <div className="max-w-2xl mx-auto">
            <Card className="p-8 md:p-10" gradient>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">免费试算您的命盘</h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-left text-sm font-medium text-gray-700 mb-2">
                    姓名 <span className="text-gray-400">(可选)</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="请输入您的姓名"
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label htmlFor="birth" className="block text-left text-sm font-medium text-gray-700 mb-2">
                    出生日期和时间 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="birth"
                    type="datetime-local"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900"
                    value={birth}
                    onChange={e => setBirth(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="timezone" className="block text-left text-sm font-medium text-gray-700 mb-2">
                    时区 <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="timezone"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900"
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
                        className="mr-2 text-purple-600 focus:ring-purple-500"
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
                        className="mr-2 text-purple-600 focus:ring-purple-500"
                        disabled={loading}
                      />
                      <span className="text-gray-700">女</span>
                    </label>
                  </div>
                </div>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleCompute}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      计算中...
                    </span>
                  ) : (
                    '立即开始试算'
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </Section>

      <Section background="white">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">为什么选择我们？</h2>
          <p className="text-xl text-gray-600">专业、准确、值得信赖的命理服务</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card hover className="p-8 text-center">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">精准计算</h3>
            <p className="text-gray-600">
              基于正宗的八字命理算法，精确计算您的四柱八字和五行属性
            </p>
          </Card>
          
          <Card hover className="p-8 text-center">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">AI智能解读</h3>
            <p className="text-gray-600">
              运用先进的人工智能技术，提供深入浅出的命运解析
            </p>
          </Card>
          
          <Card hover className="p-8 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">隐私保护</h3>
            <p className="text-gray-600">
              严格保护您的个人信息，所有数据加密存储，安全可靠
            </p>
          </Card>
        </div>
      </Section>

      <Section background="gradient">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">我们的服务</h2>
          <p className="text-xl text-gray-600">多维度的命理分析，助您了解自我</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="text-4xl mb-3">📅</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">八字排盘</h3>
            <p className="text-sm text-gray-600">
              计算您的年月日时四柱，展示完整的八字命盘
            </p>
          </Card>
          
          <Card className="p-6">
            <div className="text-4xl mb-3">🌊</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">五行分析</h3>
            <p className="text-sm text-gray-600">
              分析金木水火土五行平衡，了解您的命理特质
            </p>
          </Card>
          
          <Card className="p-6">
            <div className="text-4xl mb-3">💼</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">事业运势</h3>
            <p className="text-sm text-gray-600">
              解读事业发展方向，把握职场机遇
            </p>
          </Card>
          
          <Card className="p-6">
            <div className="text-4xl mb-3">❤️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">感情分析</h3>
            <p className="text-sm text-gray-600">
              了解感情运势，助您收获美满姻缘
            </p>
          </Card>
        </div>
      </Section>

      <Section background="dark">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-6">立即开始您的命运探索</h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            免费试算，深度报告，一站式命理服务
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
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
