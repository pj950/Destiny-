import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Card, Section, Container, Heading, Text } from '../components/ui'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

type FortuneState = 'select' | 'shake' | 'fallen' | 'result'
type FortuneCategory = '事业' | '财富' | '感情' | '健康' | '学业'

interface Fortune {
  id: string
  category: string
  stick_id: number
  stick_text: string
  stick_level: string
  ai_analysis: string | null
  created_at: string
}

const categories: FortuneCategory[] = ['事业', '财富', '感情', '健康', '学业']

const categoryIcons = {
  '事业': '💼',
  '财富': '💰', 
  '感情': '❤️',
  '健康': '🏥',
  '学业': '📚'
}

const levelColors = {
  '上上': 'text-red-600',
  '上吉': 'text-orange-600', 
  '中吉': 'text-yellow-600',
  '下吉': 'text-blue-600',
  '凶': 'text-gray-600'
}

const STORAGE_KEY = 'daily_fortune_cache_v1'

const getTodayDate = () => new Date().toISOString().split('T')[0]

const storeFortuneCache = (fortune: Fortune) => {
  if (typeof window === 'undefined') return
  try {
    const createdAt = new Date(fortune.created_at)
    const date = Number.isNaN(createdAt.getTime()) ? getTodayDate() : createdAt.toISOString().split('T')[0]
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date, fortune })
    )
  } catch (err) {
    console.warn('Failed to cache daily fortune', err)
  }
}

const readFortuneCache = (): Fortune | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as { date?: string; fortune?: Fortune }
    if (!cached || !cached.date || !cached.fortune) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (cached.date !== getTodayDate()) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return cached.fortune
  } catch (err) {
    console.warn('Failed to read cached fortune', err)
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export default function Fortune() {
  const [state, setState] = useState<FortuneState>('select')
  const [selectedCategory, setSelectedCategory] = useState<FortuneCategory | null>(null)
  const [todayFortune, setTodayFortune] = useState<Fortune | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showCachedFortune = useCallback((message?: string) => {
    const cached = readFortuneCache()
    if (cached) {
      setTodayFortune(cached)
      setState('result')
      setNotice(message ?? '')
    } else if (message) {
      setNotice(message)
    }
  }, [])

  const checkTodayFortune = useCallback(async () => {
    try {
      const res = await fetch('/api/fortune/today')
      const data = await res.json()
      
      if (res.ok && data.ok) {
        if (data.hasFortune && data.fortune) {
          setTodayFortune(data.fortune)
          storeFortuneCache(data.fortune)
          setState('result')
          setNotice('')
        } else {
          showCachedFortune()
        }
      } else {
        showCachedFortune(data?.message)
      }
    } catch (err) {
      console.error('Failed to check today fortune:', err)
      showCachedFortune('网络暂时不可用，已为您展示本地保存的签文')
    }
  }, [showCachedFortune])

  // Check if already has fortune today
  useEffect(() => {
    void checkTodayFortune()

    return () => {
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current)
        shakeTimeoutRef.current = null
      }
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current)
        revealTimeoutRef.current = null
      }
    }
  }, [checkTodayFortune])

  const handleCategorySelect = (category: FortuneCategory) => {
    if (loading) return

    if (todayFortune) {
      setNotice('今日已抽签，请明天再来')
      setState('result')
      return
    }

    setSelectedCategory(category)
    setError('')
    setNotice('')
    setState('shake')
    
    if (shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current)
    }
    shakeTimeoutRef.current = setTimeout(() => {
      shakeTimeoutRef.current = null
      void drawFortune(category)
    }, 2000)
  }

  const drawFortune = async (category: FortuneCategory) => {
    setLoading(true)
    setError('')
    setNotice('')
    
    try {
      const res = await fetch('/api/fortune/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      })
      
      const data = await res.json()
      
      if (!res.ok || !data.ok) {
        if (data?.fortune) {
          setTodayFortune(data.fortune)
          storeFortuneCache(data.fortune)
          setNotice(data?.message || '今日已抽签，请明天再来')
          setState('result')
          return
        }
        setError(data?.message || '抽签失败，请重试')
        setState('select')
        return
      }

      if (data.alreadyDrawn && data.fortune) {
        setTodayFortune(data.fortune)
        storeFortuneCache(data.fortune)
        setNotice(data.message || '今日已抽签，请明天再来')
        setState('result')
        return
      }

      if (data.fortune) {
        setTodayFortune(data.fortune)
        storeFortuneCache(data.fortune)
        setState('fallen')
        if (revealTimeoutRef.current) {
          clearTimeout(revealTimeoutRef.current)
        }
        revealTimeoutRef.current = setTimeout(() => {
          setState('result')
          revealTimeoutRef.current = null
        }, 1500)
        return
      }

      setError('未获取到签文，请重试')
      setState('select')
    } catch (err) {
      console.error('Failed to draw fortune:', err)
      setError('网络错误，请稍后重试')
      showCachedFortune('网络暂时不可用，已为您展示本地保存的签文')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setState('select')
    setSelectedCategory(null)
    setError('')
    setNotice('')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <Section background="gradient" className="pt-20" spacing="spacious">
        <Container size="lg">
          <div className="text-center">
            <Heading level={1} className="mb-4">
              每日一签
            </Heading>
            <Text size="xl" color="secondary" className="mb-8">
              求签问卜，知吉凶祸福，得人生指引
            </Text>
          </div>

          {notice && (
            <div className="max-w-3xl mx-auto mb-6">
              <div className="bg-brand-primary-50 border border-brand-primary-100 text-brand-primary-700 px-4 py-3 rounded-xl text-sm text-center">
                {notice}
              </div>
            </div>
          )}

          {/* Select Category State */}
          {state === 'select' && (
            <div className="max-w-4xl mx-auto">
              <Card className="p-8">
                <Heading level={2} className="mb-6 text-center">请选择求签类别</Heading>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      disabled={loading}
                      className="flex flex-col items-center p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-brand-primary-500 hover:bg-brand-primary-50 transition-all duration-200 cursor-pointer group disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                        {categoryIcons[category]}
                      </div>
                      <Text weight="semibold" className="text-gray-900">
                        {category}
                      </Text>
                    </button>
                  ))}
                </div>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-center">
                    {error}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Shake State */}
          {state === 'shake' && (
            <div className="max-w-2xl mx-auto">
              <Card className="p-12 text-center">
                <div className="mb-8">
                  <div className="inline-block fortune-shake">
                    <div className="text-6xl mb-4">🎯</div>
                  </div>
                </div>
                
                <Heading level={2} className="mb-4">正在为您求签...</Heading>
                <Text size="lg" color="secondary">
                  诚心祈祷，静待佳音
                </Text>
                
                {selectedCategory && (
                  <div className="mt-6 inline-flex items-center px-4 py-2 bg-brand-primary-100 text-brand-primary-700 rounded-full">
                    <span className="text-2xl mr-2">{categoryIcons[selectedCategory]}</span>
                    <Text weight="semibold">{selectedCategory}</Text>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Fallen State */}
          {state === 'fallen' && (
            <div className="max-w-2xl mx-auto">
              <Card className="p-12 text-center">
                <div className="mb-8">
                  <div className="inline-block fortune-fall">
                    <div className="text-6xl mb-4">📜</div>
                  </div>
                </div>
                
                <Heading level={2} className="mb-4">签文已出</Heading>
                <Text size="lg" color="secondary">
                  正在为您解读...
                </Text>
              </Card>
            </div>
          )}

          {/* Result State */}
          {state === 'result' && todayFortune && (
            <div className="max-w-4xl mx-auto">
              <Card className="p-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center px-4 py-2 bg-brand-primary-100 text-brand-primary-700 rounded-full mb-4">
                    <span className="text-2xl mr-2">{categoryIcons[todayFortune.category as FortuneCategory]}</span>
                    <Text weight="semibold">{todayFortune.category}</Text>
                  </div>
                  
                  <div className="text-4xl mb-4">📜</div>
                  
                  <Heading level={2} className="mb-2">第 {todayFortune.stick_id} 签</Heading>
                  <Text size="xl" weight="bold" className={`${levelColors[todayFortune.stick_level as keyof typeof levelColors]} mb-4`}>
                    {todayFortune.stick_level}
                  </Text>
                  
                  <div className="bg-gradient-to-r from-brand-primary-50 to-brand-secondary-50 rounded-xl p-6 mb-6 fortune-glow">
                    <Text size="xl" weight="semibold" className="text-gray-900">
                      {todayFortune.stick_text}
                    </Text>
                  </div>
                </div>
                
                {todayFortune.ai_analysis && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                    <Heading level={3} className="mb-4 flex items-center">
                      <span className="text-2xl mr-2">🤖</span>
                      AI 解签
                    </Heading>
                    <div className="prose prose-gray max-w-none">
                      <Text className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                        {todayFortune.ai_analysis}
                      </Text>
                    </div>
                  </div>
                )}
                
                <div className="text-center">
                  <Text size="sm" color="muted" className="mb-4">
                    抽签时间：{new Date(todayFortune.created_at).toLocaleString('zh-CN')}
                  </Text>
                  
                  <Button variant="outline" onClick={reset} disabled={loading}>
                    重新选择
                  </Button>
                </div>
              </Card>
              
              <div className="text-center mt-8">
                <Text color="muted">
                  每日仅可抽签一次，请明日再来
                </Text>
              </div>
            </div>
          )}
        </Container>
      </Section>

      <Footer />
    </div>
  )
}