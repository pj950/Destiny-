import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Button, Card, Section, Container, Heading, Text } from '../components/ui'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import FortuneAnimationStage from '../components/FortuneAnimationStage'
import FortuneCard from '../components/FortuneCard'
import {
  categories,
  categoryGradients,
  categoryIcons,
} from '../lib/fortuneConstants'
import type {
  FortuneCategory,
} from '../lib/fortuneConstants'

// Re-export for backward compatibility
export type { FortuneCategory }
export { categories, categoryIcons, categoryGradients }
export { levelColors } from '../lib/fortuneConstants'

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
  const [showInterpretation, setShowInterpretation] = useState(false)

  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusLiveRef = useRef<HTMLDivElement>(null)

  const showCachedFortune = useCallback((message?: string) => {
    const cached = readFortuneCache()
    if (cached) {
      setTodayFortune(cached)
      setShowInterpretation(false)
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
          setShowInterpretation(false)
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
      const timer = setTimeout(() => {
        setState('select')
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [state, loading])

  const handleCategorySelect = (category: FortuneCategory) => {
    if (loading) return

    if (todayFortune) {
      setStatusMessage('今日已抽签，请明天再来')
      setNotice('已为您保留今日之签，明日可再次求签')
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
      setNotice('已为您保留今日之签，明日可再次求签')
      setState('result')
      return
    }

    setError('')
    setNotice('')
    setShowInterpretation(false)
    setStatusMessage('开始为您摇动金色签筒...')
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
    setShowInterpretation(false)
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
          setShowInterpretation(false)
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
        setShowInterpretation(false)
        setNotice(data.message || '今日已抽签，请明天再来')
        setStatusMessage(data.message || '今日已抽签，请明天再来')
        setState('result')
        return
      }

      if (data.fortune) {
        setTodayFortune(data.fortune)
        storeFortuneCache(data.fortune)
        setShowInterpretation(false)
        setStatusMessage('签文已出，正在为您呈现...')
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
    setShowInterpretation(false)
  }

  const handleDrawAgain = () => {
    setShowInterpretation(false)
    setSelectedCategory(null)
    setStatusMessage('')
    setError('')
    setNotice('已为您保留今日之签，再次求签将呈现相同指引')
    setTodayFortune(null)
    setState('select')
  }

  const handleRevealInterpretation = () => {
    setShowInterpretation(true)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-mystical-hero text-mystical-gold-500">
      <Navbar />

      {/* Accessibility: Skip navigation link */}
      <a href="#fortune-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-mystical-purple-950 focus:px-4 focus:py-2 focus:text-mystical-gold-500">
        跳到主要内容
      </a>

      <main className="flex-1">
        <Section id="fortune-section" background="mystical" spacing="spacious" className="relative overflow-hidden">
          <div className="mystical-grid-pattern" />
          <div className="mystical-fog" />
          <div className="mystical-stars" />
          <div className="floating-lantern floating-lantern--one" aria-hidden="true" />
          <div className="floating-lantern floating-lantern--two" aria-hidden="true" />
          <div className="floating-lantern floating-lantern--three" aria-hidden="true" />

          <Container size="xl" className="relative z-10" id="fortune-main">
            <div className="text-center max-w-3xl mx-auto">
              <Heading level={1} gradient className="font-serif mb-6">
                每日一签 · 神秘占卜殿堂
              </Heading>
              <Text size="xl" className="mb-4 text-mystical-gold-500/90">
                沉浸在深紫与金光之间，虔心向神灵请示今日的吉凶祸福
              </Text>
              <Text size="sm" className="text-mystical-gold-600/70">
                <span className="font-semibold text-mystical-gold-500">提示：</span>每天仅可摇签一次，金色签文已为您留存
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
              <div className="mx-auto mt-10 max-w-3xl animate-slide-up">
                <div className="rounded-2xl border border-mystical-gold-700/30 bg-mystical-purple-950/60 px-6 py-4 text-center text-sm text-mystical-gold-500 shadow-gold-glow">
                  {notice}
                </div>
              </div>
            )}

            {/* Select Category State */}
            {state === 'select' && (
              <div className="mx-auto mt-14 max-w-6xl space-y-6">
                <Heading level={2} weight="semibold" gradient className="text-3xl font-serif text-center">
                  选择您想求取的智慧领域
                </Heading>
                <Text size="md" className="text-center text-mystical-gold-600/80">
                  每一类签文都对应不同的福祉，请带着明确的问题与期待前来
                </Text>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 mt-8">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      disabled={loading}
                      aria-label={`求签类别：${category}`}
                      aria-disabled={loading}
                      className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-mystical-gold-700/30 bg-mystical-purple-950/40 px-4 py-6 text-center text-mystical-gold-500 shadow-mystical-soft transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-mystical-gold-500 focus-visible:ring-offset-mystical-purple-950 disabled:cursor-not-allowed disabled:opacity-60 hover:-translate-y-1 hover:shadow-gold-glow`}
                    >
                      <div className={`absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-70`}>
                        <div className={`h-full w-full bg-gradient-to-br ${categoryGradients[category]} blur-2xl`} aria-hidden="true" />
                      </div>
                      <span className="relative text-3xl sm:text-4xl mb-3 drop-shadow" aria-hidden="true">
                        {categoryIcons[category]}
                      </span>
                      <span className="relative text-xs sm:text-sm font-semibold tracking-[0.35em] uppercase">
                        {category}
                      </span>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="mx-auto max-w-3xl animate-slide-up" role="alert">
                    <div className="rounded-2xl border border-mystical-rose-700/40 bg-mystical-rose-700/10 px-6 py-4 text-center text-sm text-mystical-gold-500">
                      <span className="font-semibold">错误：</span> {error}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Selected Category - Show CTA to start shaking */}
            {state === 'selected' && selectedCategory && (
              <div className="mx-auto mt-16 max-w-4xl animate-slide-up">
                <Card variant="mystical-gold" className="p-10">
                  <div className="text-center">
                    <Heading level={2} className="font-serif text-mystical-gold-500 mb-6">
                      {selectedCategory} · 准备接受指引
                    </Heading>

                    <div className="mb-10 inline-flex items-center rounded-full border border-mystical-gold-700/40 bg-mystical-purple-950/40 px-10 py-5 shadow-gold-glow">
                      <span className="text-4xl mr-4" aria-hidden="true">
                        {categoryIcons[selectedCategory]}
                      </span>
                      <span className="text-xl font-semibold tracking-[0.45em] uppercase text-mystical-gold-500">
                        {selectedCategory}
                      </span>
                    </div>

                    <Text size="lg" className="mb-12 text-mystical-gold-500/90 max-w-2xl mx-auto">
                      双手合十，闭目祈念。点击下方按钮，金色签筒将随您的心念轻摇，为您取出独属于今日的签文。
                    </Text>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                      <Button
                        onClick={handleStartShaking}
                        disabled={loading}
                        aria-label="开始摇签求卜"
                        size="lg"
                        variant="gold"
                        className="px-10 py-4 text-lg font-bold text-mystical-purple-950 bg-gradient-to-br from-mystical-gold-700 via-mystical-gold-500 to-mystical-rose-700 hover:from-mystical-gold-600 hover:via-mystical-gold-500 hover:to-mystical-rose-700 shadow-gold-glow hover:shadow-gold-glow-lg"
                      >
                        {loading ? '处理中...' : '🌟 开启摇签'}
                      </Button>
                      <Button
                        variant="mystical"
                        onClick={reset}
                        disabled={loading}
                        aria-label="返回类别选择"
                        size="lg"
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
              <div className="mx-auto mt-16 max-w-4xl animate-slide-up">
                <FortuneAnimationStage
                  state="shake"
                  selectedCategory={selectedCategory}
                  statusMessage={statusMessage}
                />
              </div>
            )}

            {/* Fallen State */}
            {state === 'fallen' && selectedCategory && (
              <div className="mx-auto mt-16 max-w-4xl animate-slide-up">
                <FortuneAnimationStage
                  state="fallen"
                  selectedCategory={selectedCategory}
                  statusMessage={statusMessage}
                />
              </div>
            )}

            {/* Result State */}
            {state === 'result' && todayFortune && (
              <div className="mx-auto mt-16 max-w-5xl space-y-12 animate-slide-up">
                <div>
                  <FortuneCard
                    stick_id={todayFortune.stick_id}
                    stick_level={todayFortune.stick_level}
                    stick_text={todayFortune.stick_text}
                    category={todayFortune.category as FortuneCategory}
                    isRevealing={true}
                  />
                </div>

                {todayFortune.ai_analysis && (
                  <div className="space-y-6">
                    {!showInterpretation && (
                      <div className="text-center">
                        <p className="fortune-hint-pulse text-sm text-mystical-gold-500/80">
                          点击开启智慧，聆听灵光与AI的深度解读
                        </p>
                        <Button
                          variant="mystical"
                          size="lg"
                          className="mt-4 bg-gradient-to-r from-mystical-purple-700 to-mystical-purple-900 hover:from-mystical-purple-600 hover:to-mystical-purple-800 text-mystical-gold-500 shadow-mystical-medium"
                          onClick={handleRevealInterpretation}
                        >
                          点击开启智慧
                        </Button>
                      </div>
                    )}

                    {showInterpretation && (
                      <Card variant="mystical-gold" className="p-10">
                        <div className="space-y-6">
                          <div>
                            <Heading level={3} className="mb-2 font-serif text-mystical-gold-500">
                              签文解读
                            </Heading>
                            <Text className="whitespace-pre-wrap text-mystical-gold-500/90 leading-relaxed">
                              {todayFortune.ai_analysis}
                            </Text>
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                )}

                <Card variant="mystical" className="p-10">
                  <div className="flex flex-col items-center gap-6 text-center">
                    <Text size="sm" className="text-mystical-gold-500/80">
                      抽签时间：{new Date(todayFortune.created_at).toLocaleString('zh-CN')}
                    </Text>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <Button
                        variant="gold"
                        size="lg"
                        className="bg-gradient-to-br from-mystical-gold-700 via-mystical-gold-500 to-mystical-rose-700 text-mystical-purple-950 shadow-gold-glow hover:shadow-gold-glow-lg"
                        onClick={handleDrawAgain}
                        disabled={loading}
                      >
                        再抽一签
                      </Button>
                      <Link
                        href="/dashboard"
                        className="text-sm font-semibold text-mystical-gold-500 underline decoration-transparent underline-offset-4 transition hover:text-mystical-gold-600 hover:decoration-mystical-gold-600"
                      >
                        查看历史
                      </Link>
                    </div>

                    <Text size="xs" className="text-mystical-gold-500/70">
                      ✓ 已为您保留今日之签，灵光将在明日再次照拂
                    </Text>
                  </div>
                </Card>
              </div>
            )}
          </Container>
        </Section>
      </main>

      <Footer />
    </div>
  )
}
