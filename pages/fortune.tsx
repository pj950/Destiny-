import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Card, Section, Container, Heading, Text } from '../components/ui'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import FortuneAnimationStage from '../components/FortuneAnimationStage'
import FortuneCard from '../components/FortuneCard'
import {
  categories,
  categoryGradients,
  categoryIcons,
  levelColors,
  type FortuneCategory,
} from '../lib/fortuneConstants'

// Re-export for backward compatibility
export type { FortuneCategory }
export { categories, categoryIcons, categoryGradients, levelColors }

interface Fortune {
  id: string
  category: string
  stick_id: number
  stick_text: string
  stick_level: string
  ai_analysis: string | null
  created_at: string
}

type FortuneState = 'idle' | 'select' | 'selected' | 'shake' | 'fallen' | 'result'

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
    setState('selected')
  }

  const handleStartShaking = () => {
    if (loading || !selectedCategory) return

    if (todayFortune) {
      setStatusMessage('今日已抽签，请明天再来')
      setState('result')
      return
    }

    setError('')
    setNotice('')
    setStatusMessage(`开始为您求签...`)
    setState('shake')

    if (shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current)
    }
    shakeTimeoutRef.current = setTimeout(() => {
      shakeTimeoutRef.current = null
      void drawFortune(selectedCategory)
    }, 3100)
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
        setState('selected')
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
        }, 2000)
        return
      }

      setError('未获取到签文，请重试')
      setStatusMessage('未获取到签文，请重试')
      setState('selected')
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
          {/* Header */}
          <div className="text-center mb-12">
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
                <Heading level={2} className="mb-8 text-center">请选择求签类别</Heading>

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

          {/* Selected Category - Show CTA to start shaking */}
          {state === 'selected' && selectedCategory && (
            <div className="max-w-4xl mx-auto fortune-fade-in">
              <Card className="p-8">
                <div className="text-center">
                  <Heading level={2} className="mb-8">已选择求签类别</Heading>

                  {/* Category badge */}
                  <div className={`mb-8 inline-flex items-center px-8 py-4 rounded-full shadow-xl bg-gradient-to-br ${categoryGradients[selectedCategory]}`}>
                    <span className="text-4xl mr-3" aria-hidden="true">
                      {categoryIcons[selectedCategory]}
                    </span>
                    <span className="text-white font-bold text-xl">{selectedCategory}</span>
                  </div>

                  {/* Description */}
                  <Text size="lg" color="secondary" className="mb-10">
                    诚心祈祷，虔心向神灵请求指引，让我们开始摇签吧
                  </Text>

                  {/* CTA Button */}
                  <div className="flex gap-4 justify-center">
                   <Button
                     onClick={handleStartShaking}
                     disabled={loading}
                     aria-label="开始摇签求卜"
                     className={`px-8 py-4 text-lg font-bold text-white shadow-lg hover:shadow-xl transition-all bg-gradient-to-br ${categoryGradients[selectedCategory]}`}
                   >
                     {loading ? '处理中...' : '🎯 开始摇签'}
                   </Button>
                    <Button
                      variant="outline"
                      onClick={reset}
                      disabled={loading}
                      aria-label="返回类别选择"
                    >
                      返回选择
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Shake State */}
          {state === 'shake' && selectedCategory && (
            <div className="max-w-4xl mx-auto fortune-fade-in">
              <FortuneAnimationStage
                state="shake"
                selectedCategory={selectedCategory}
                statusMessage={statusMessage}
              />
            </div>
          )}

          {/* Fallen State */}
          {state === 'fallen' && selectedCategory && (
            <div className="max-w-4xl mx-auto fortune-fade-in">
              <FortuneAnimationStage
                state="fallen"
                selectedCategory={selectedCategory}
                statusMessage={statusMessage}
              />
            </div>
          )}

          {/* Result State */}
          {state === 'result' && todayFortune && (
            <div className="max-w-5xl mx-auto fortune-fade-in">
              <div className="mb-8">
                <FortuneCard
                  stick_id={todayFortune.stick_id}
                  stick_level={todayFortune.stick_level}
                  stick_text={todayFortune.stick_text}
                  category={todayFortune.category as FortuneCategory}
                  isRevealing={true}
                />
              </div>

              {/* AI Analysis */}
              {todayFortune.ai_analysis && (
                <div className="max-w-4xl mx-auto mb-8">
                  <Card className="p-8">
                    <Heading level={3} className="mb-6 flex items-center">
                      <span className="text-2xl mr-3" aria-hidden="true">🤖</span>
                      AI 解签
                    </Heading>
                    <div className="prose prose-gray max-w-none">
                      <Text className="whitespace-pre-wrap text-gray-700 leading-relaxed text-base">
                        {todayFortune.ai_analysis}
                      </Text>
                    </div>
                  </Card>
                </div>
              )}

              {/* Actions */}
              <div className="max-w-4xl mx-auto">
                <Card className="p-8 bg-gradient-to-r from-brand-primary-50 to-brand-secondary-50">
                  <div className="text-center">
                    <Text size="sm" color="muted" className="mb-6">
                      抽签时间：{new Date(todayFortune.created_at).toLocaleString('zh-CN')}
                    </Text>

                    <Button
                      variant="outline"
                      onClick={reset}
                      disabled={loading}
                      aria-label="返回类别选择页面"
                    >
                      返回选择
                    </Button>

                    <Text size="xs" color="muted" className="mt-6 font-semibold">
                      ✓ 每日仅可抽签一次，请明日再来
                    </Text>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </Container>
      </Section>

      <Footer />
    </div>
  )
}
