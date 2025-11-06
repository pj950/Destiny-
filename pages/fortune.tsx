import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Card, Section, Container, Heading, Text } from '../components/ui'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

type FortuneState = 'idle' | 'select' | 'shake' | 'fallen' | 'result'
type FortuneCategory = 
  | '事业运' | '财富运' | '感情运' | '婚姻运' | '家庭运' 
  | '健康运' | '考试运' | '官司诉讼' | '旅行出行' | '求子育儿' 
  | '置业投资' | '买房置业' | '风水运势' | '寻物失物' | '综合运途'

interface Fortune {
  id: string
  category: string
  stick_id: number
  stick_text: string
  stick_level: string
  ai_analysis: string | null
  created_at: string
}

const categories: FortuneCategory[] = [
  '事业运', '财富运', '感情运', '婚姻运', '家庭运',
  '健康运', '考试运', '官司诉讼', '旅行出行', '求子育儿',
  '置业投资', '买房置业', '风水运势', '寻物失物', '综合运途'
]

const categoryIcons: Record<FortuneCategory, string> = {
  '事业运': '💼',
  '财富运': '💰',
  '感情运': '❤️',
  '婚姻运': '💑',
  '家庭运': '👨‍👩‍👧‍👦',
  '健康运': '🏥',
  '考试运': '📚',
  '官司诉讼': '⚖️',
  '旅行出行': '✈️',
  '求子育儿': '👶',
  '置业投资': '📈',
  '买房置业': '🏠',
  '风水运势': '🏮',
  '寻物失物': '🔍',
  '综合运途': '🌟'
}

const categoryGradients: Record<FortuneCategory, string> = {
  '事业运': 'from-blue-500 to-blue-600',
  '财富运': 'from-yellow-500 to-yellow-600',
  '感情运': 'from-red-500 to-pink-600',
  '婚姻运': 'from-pink-500 to-rose-600',
  '家庭运': 'from-orange-500 to-orange-600',
  '健康运': 'from-green-500 to-green-600',
  '考试运': 'from-purple-500 to-purple-600',
  '官司诉讼': 'from-indigo-500 to-indigo-600',
  '旅行出行': 'from-cyan-500 to-cyan-600',
  '求子育儿': 'from-amber-500 to-amber-600',
  '置业投资': 'from-emerald-500 to-emerald-600',
  '买房置业': 'from-stone-500 to-stone-600',
  '风水运势': 'from-violet-500 to-violet-600',
  '寻物失物': 'from-lime-500 to-lime-600',
  '综合运途': 'from-fuchsia-500 to-fuchsia-600'
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
  const [state, setState] = useState<FortuneState>('idle')
  const [selectedCategory, setSelectedCategory] = useState<FortuneCategory | null>(null)
  const [todayFortune, setTodayFortune] = useState<Fortune | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusLiveRef = useRef<HTMLDivElement>(null)

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

  // Transition to select state after initial check
  useEffect(() => {
    if (state === 'idle' && !loading) {
      setTimeout(() => {
        setState('select')
      }, 300)
    }
  }, [state, loading])

  const handleCategorySelect = (category: FortuneCategory) => {
    if (loading) return

    if (todayFortune) {
      setStatusMessage('今日已抽签，请明天再来')
      setState('result')
      return
    }

    setSelectedCategory(category)
    setError('')
    setNotice('')
    setStatusMessage(`开始为您求签...`)
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
    setStatusMessage('正在与神灵沟通...')
    
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
          setStatusMessage('')
          setState('result')
          return
        }
        const errorMsg = data?.message || '抽签失败，请重试'
        setError(errorMsg)
        setStatusMessage(`错误：${errorMsg}`)
        setState('select')
        return
      }

      if (data.alreadyDrawn && data.fortune) {
        setTodayFortune(data.fortune)
        storeFortuneCache(data.fortune)
        setNotice(data.message || '今日已抽签，请明天再来')
        setStatusMessage(data.message || '今日已抽签，请明天再来')
        setState('result')
        return
      }

      if (data.fortune) {
        setTodayFortune(data.fortune)
        storeFortuneCache(data.fortune)
        setStatusMessage('签文已出，正在为您解读...')
        setState('fallen')
        if (revealTimeoutRef.current) {
          clearTimeout(revealTimeoutRef.current)
        }
        revealTimeoutRef.current = setTimeout(() => {
          setStatusMessage('')
          setState('result')
          revealTimeoutRef.current = null
        }, 1500)
        return
      }

      setError('未获取到签文，请重试')
      setStatusMessage('未获取到签文，请重试')
      setState('select')
    } catch (err) {
      console.error('Failed to draw fortune:', err)
      const errorMsg = '网络错误，请稍后重试'
      setError(errorMsg)
      setStatusMessage(`错误：${errorMsg}`)
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
    setStatusMessage('')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Accessibility: Skip navigation link */}
      <a href="#fortune-main" className="sr-only focus:not-sr-only">
        跳到主要内容
      </a>
      
      <Section background="gradient" className="pt-20" spacing="spacious">
        <Container size="lg" id="fortune-main">
          <div className="text-center">
            <Heading level={1} className="mb-4">
              每日一签
            </Heading>
            <Text size="xl" color="secondary" className="mb-8">
              求签问卜，知吉凶祸福，得人生指引
            </Text>
            <Text size="sm" color="muted" className="mb-8">
              <span className="font-semibold">特别提示：</span>每天限制抽签一次，请明天再来
            </Text>
          </div>

          {/* Accessibility: Live region for status updates */}
          <div
            ref={statusLiveRef}
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {statusMessage}
          </div>

          {notice && (
            <div className="max-w-3xl mx-auto mb-6 animate-slide-up">
              <div className="bg-brand-primary-50 border border-brand-primary-100 text-brand-primary-700 px-4 py-3 rounded-xl text-sm text-center">
                {notice}
              </div>
            </div>
          )}

          {/* Select Category State */}
          {state === 'select' && (
            <div className="max-w-6xl mx-auto fortune-fade-in">
              <Card className="p-8">
                <Heading level={2} className="mb-6 text-center">请选择求签类别</Heading>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-6">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      disabled={loading}
                      aria-label={`求签类别：${category}`}
                      aria-disabled={loading}
                      className={`flex flex-col items-center p-4 rounded-xl border-2 border-gray-200 hover:border-transparent hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary-500 transition-all duration-200 cursor-pointer group disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-br ${categoryGradients[category]} hover:opacity-90`}
                    >
                      <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">
                        {categoryIcons[category]}
                      </div>
                      <Text weight="semibold" className="text-white text-center text-xs md:text-sm">
                        {category}
                      </Text>
                    </button>
                  ))}
                </div>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-center animate-slide-up" role="alert">
                    <span className="font-semibold">错误：</span> {error}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Shake State */}
          {state === 'shake' && (
            <div className="max-w-2xl mx-auto fortune-fade-in">
              <Card className="p-12 text-center">
                <div className="mb-8" aria-hidden="false">
                  <div className="inline-block fortune-shake">
                    <div className="text-6xl mb-4">🎯</div>
                  </div>
                </div>
                
                <Heading level={2} className="mb-4">正在为您求签...</Heading>
                <div className="flex items-center justify-center gap-2">
                  <Text size="lg" color="secondary">
                    诚心祈祷，静待佳音
                  </Text>
                  <span className="inline-flex gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
                
                {selectedCategory && (
                  <div className="mt-6 inline-flex items-center px-4 py-2 bg-brand-primary-100 text-brand-primary-700 rounded-full">
                    <span className="text-2xl mr-2" aria-hidden="true">{categoryIcons[selectedCategory]}</span>
                    <Text weight="semibold">{selectedCategory}</Text>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Fallen State */}
          {state === 'fallen' && (
            <div className="max-w-2xl mx-auto fortune-fade-in">
              <Card className="p-12 text-center">
                <div className="mb-8">
                  <div className="inline-block fortune-fall">
                    <div className="text-6xl mb-4">📜</div>
                  </div>
                </div>
                
                <Heading level={2} className="mb-4">签文已出</Heading>
                <div className="flex items-center justify-center gap-2">
                  <Text size="lg" color="secondary">
                    正在为您解读...
                  </Text>
                  <span className="inline-flex gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
              </Card>
            </div>
          )}

          {/* Result State */}
          {state === 'result' && todayFortune && (
            <div className="max-w-4xl mx-auto fortune-fade-in">
              <Card className="p-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center px-4 py-2 bg-brand-primary-100 text-brand-primary-700 rounded-full mb-4">
                    <span className="text-2xl mr-2" aria-hidden="true">{categoryIcons[todayFortune.category as FortuneCategory]}</span>
                    <Text weight="semibold">{todayFortune.category}</Text>
                  </div>
                  
                  <div className="text-4xl mb-4" aria-hidden="true">📜</div>
                  
                  <Heading level={2} className="mb-2">第 {todayFortune.stick_id} 签</Heading>
                  <Text size="xl" weight="bold" className={`${levelColors[todayFortune.stick_level as keyof typeof levelColors]} mb-4`}>
                    {todayFortune.stick_level}
                  </Text>
                  
                  <div className="bg-gradient-to-r from-brand-primary-50 to-brand-secondary-50 rounded-xl p-6 mb-6">
                    <Text size="xl" weight="semibold" className="text-gray-900">
                      {todayFortune.stick_text}
                    </Text>
                  </div>
                </div>
                
                {todayFortune.ai_analysis && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                    <Heading level={3} className="mb-4 flex items-center">
                      <span className="text-2xl mr-2" aria-hidden="true">🤖</span>
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
                  
                  <Button 
                    variant="outline" 
                    onClick={reset} 
                    disabled={loading}
                    aria-label="返回类别选择页面"
                  >
                    重新选择
                  </Button>
                </div>
              </Card>
              
              <div className="text-center mt-8">
                <Text color="muted" className="font-semibold">
                  ✓ 每日仅可抽签一次，请明日再来
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