import { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import ToastContainer from '../components/Toast'
import { useRouter } from 'next/router'
import { toast } from '../lib/toast'
import {
  getLampAnimationClasses,
  toggleAnimationClasses,
  AnimationPerformanceMonitor
} from '../lib/lamp-animations'
import {
  saveLampStatesToStorage,
  getLampStatesFromStorage,
  mergeLampStates,
  updateLampStateInStorage,
  isLocalStorageAvailable
} from '../lib/lamp-storage'
import { Button, Heading, Text } from '../components/ui'
import { FALLBACK_LAMPS, type Lamp } from '../lib/lamps.client'

interface LampStatus {
  lamp_key: string
  status: 'unlit' | 'lit'
  last_updated?: string
}

type LampState = 'unlit' | 'purchasing' | 'lit'

export default function LampsPage() {
  const router = useRouter()
  const [lampStates, setLampStates] = useState<Record<string, LampState>>({})
  const [lamps, setLamps] = useState<Lamp[]>(FALLBACK_LAMPS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingCache, setUsingCache] = useState(false)
  const lampRefs = useRef<Record<string, HTMLDivElement>>({})
  const performanceMonitor = useRef(AnimationPerformanceMonitor.getInstance())

  const litCount = Object.values(lampStates).filter(state => state === 'lit').length

  useEffect(() => {
    performanceMonitor.current.startMonitoring()
    return () => performanceMonitor.current.stopMonitoring()
  }, [])

  useEffect(() => {
    fetchLampStatuses()
    fetchLampsConfig()
  }, [])

  useEffect(() => {
    if (router.isReady) {
      const { razorpay_payment_id, razorpay_payment_link_id, session_id } = router.query
      if (razorpay_payment_id || razorpay_payment_link_id || session_id) {
        confirmPaymentAndRefresh(
          razorpay_payment_id as string | undefined,
          razorpay_payment_link_id as string | undefined
        )
      }
    }
  }, [router.isReady, router.query])

  useEffect(() => {
    Object.entries(lampStates).forEach(([lampKey, state]) => {
      const element = lampRefs.current[lampKey]
      if (element) {
        const classes = getLampAnimationClasses(state)
        toggleAnimationClasses(element, classes)
      }
    })
  }, [lampStates])

  const fetchLampStatuses = useCallback(async () => {
    setLoading(true)
    setError(null)
    setUsingCache(false)

    let cachedData: LampStatus[] | null = null
    if (isLocalStorageAvailable()) {
      cachedData = getLampStatesFromStorage()
    }

    if (cachedData) {
      const statusMap: Record<string, LampState> = {}
      cachedData.forEach(lamp => {
        statusMap[lamp.lamp_key] = lamp.status
      })
      setLampStates(statusMap)
      setUsingCache(true)
    }

    let finalData: LampStatus[] = []

    try {
      const response = await fetch('/api/lamps/status')
      if (!response.ok) {
        throw new Error('Failed to fetch lamp statuses')
      }
      const apiData: LampStatus[] = await response.json()

      if (cachedData) {
        finalData = mergeLampStates(apiData, cachedData)
      } else {
        finalData = apiData
      }

      const statusMap: Record<string, LampState> = {}
      finalData.forEach(lamp => {
        statusMap[lamp.lamp_key] = lamp.status
      })

      setLampStates(statusMap)

      if (isLocalStorageAvailable()) {
        saveLampStatesToStorage(finalData)
      }

      setUsingCache(false)
    } catch (error) {
      console.error('Error fetching lamp statuses:', error)
      setError('无法加载祈福灯状态，请稍后重试')

      if (!finalData.length && isLocalStorageAvailable()) {
        const fallbackData = getLampStatesFromStorage()
        if (fallbackData) {
          const statusMap: Record<string, LampState> = {}
          fallbackData.forEach(lamp => {
            statusMap[lamp.lamp_key] = lamp.status
          })
          setLampStates(statusMap)
          setUsingCache(true)
          toast.info('使用缓存数据', '网络连接异常，显示上次保存的状态')
        }
      } else {
        toast.error('加载失败', '无法获取祈福灯状态')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const confirmPaymentAndRefresh = useCallback(async (razorpayPaymentId?: string, razorpayPaymentLinkId?: string) => {
    try {
      if (razorpayPaymentLinkId || razorpayPaymentId) {
        const response = await fetch('/api/lamps/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            razorpay_payment_link_id: razorpayPaymentLinkId,
            razorpay_payment_id: razorpayPaymentId,
          }),
        })

        if (!response.ok) {
          console.warn('[Lamps] Payment confirmation failed, will try to refresh from cache')
        }
      }

      setTimeout(() => {
        fetchLampStatuses()
        toast.success('支付成功', '祈福灯已点亮')
      }, 500)
    } catch (error: any) {
      console.error('[Lamps] Error confirming payment:', error)
      setTimeout(() => {
        fetchLampStatuses()
      }, 500)
    }
  }, [fetchLampStatuses])

  const fetchLampsConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/lamps/config')
      if (response.ok) {
        const data = await response.json()
        if (data.lamps && data.lamps.length > 0) {
          setLamps(data.lamps)
          console.log('Loaded lanterns from API:', data.lamps.length)
        }
      } else {
        console.log('API not available, using fallback lanterns')
      }
    } catch (error) {
      console.log('Failed to fetch lanterns config, using fallback:', error)
    }
  }, [])

  const handleBuyLamp = useCallback(async (lampKey: string) => {
    if (lampStates[lampKey] === 'purchasing') return

    setLampStates(prev => ({ ...prev, [lampKey]: 'purchasing' }))

    if (isLocalStorageAvailable()) {
      updateLampStateInStorage(lampKey, 'unlit')
    }

    try {
      const response = await fetch('/api/lamps/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lamp_key: lampKey }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()

      toast.info('正在跳转', '即将跳转到支付页面...')

      setTimeout(() => {
        window.location.href = url
      }, 1000)

    } catch (error: any) {
      console.error('Error purchasing lamp:', error)

      setLampStates(prev => ({ ...prev, [lampKey]: 'unlit' }))

      const errorMessage = error.message || '购买失败，请重试'
      toast.error('购买失败', errorMessage)
    }
  }, [lampStates])

  return (
    <>
      <Head>
        <title>祈福点灯 - 东方命理</title>
        <meta name="description" content="点燃祈福灯，为您和家人祈求福运安康" />
        <link rel="stylesheet" href="/lamp-animations.css" />
      </Head>

      <div className="relative min-h-screen overflow-hidden bg-gradient-mystical-hero text-mystical-gold-500">
        <div className="mystical-grid-pattern" />
        <div className="mystical-fog" />
        <div className="mystical-stars" />
        <div className="floating-lantern floating-lantern--one" aria-hidden="true" />
        <div className="floating-lantern floating-lantern--two" aria-hidden="true" />
        <div className="floating-lantern floating-lantern--three" aria-hidden="true" />

        <Navbar />
        <ToastContainer />

        <main className="relative z-10 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {/* Header Image */}
            <div className="mb-12">
              <div className="relative w-full h-[300px] sm:h-[350px] lg:h-[400px] overflow-hidden rounded-3xl border border-mystical-gold-700/30 shadow-mystical-deep">
                <img
                  src="/images/祈福点灯.png"
                  alt="祈福点灯"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Try SVG fallback if PNG doesn't exist
                    const target = e.target as HTMLImageElement
                    target.src = "/images/祈福点灯.svg"
                    target.onerror = () => {
                      // Final fallback to gradient background
                      target.style.display = 'none'
                      target.parentElement?.classList.add('bg-gradient-mystical-hero')
                    }
                  }}
                />
                {/* Overlay text for better readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-mystical-purple-950/80 via-mystical-purple-950/40 to-transparent flex items-end justify-center pb-8">
                  <div className="text-center">
                    <Heading level={1} gradient className="font-serif mb-2">
                      祈福点灯
                    </Heading>
                    <Text size="lg" className="text-mystical-gold-400/90">
                      点亮一份祝愿，守护一份心愿
                    </Text>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center max-w-3xl mx-auto mb-8">
              <Text size="lg" className="text-mystical-gold-500/85 mb-3">
                深紫夜幕下的金色灯笼，承载着真诚的祝福与光明
              </Text>
              <Text size="sm" className="text-mystical-gold-600/80">
                选择一盏灯，为自己或挚爱点亮心愿之光
              </Text>
            </div>

            {usingCache && (
              <div className="mx-auto mt-8 max-w-3xl animate-slide-up">
                <div className="rounded-2xl border border-mystical-gold-700/40 bg-mystical-purple-950/50 px-6 py-4 text-center text-sm text-mystical-gold-500 shadow-gold-glow">
                  ⚡ 当前显示缓存状态，网络恢复后将自动同步
                </div>
              </div>
            )}

            {error && (
              <div className="mx-auto mt-8 max-w-3xl animate-slide-up">
                <div className="rounded-2xl border border-mystical-rose-700/40 bg-mystical-rose-700/10 px-6 py-5 text-center text-sm text-mystical-gold-500">
                  <span className="font-semibold">❌ {error}</span>
                  <button
                    onClick={fetchLampStatuses}
                    className="ml-3 inline-flex items-center rounded-full border border-mystical-gold-700/40 px-3 py-1 text-xs text-mystical-gold-500 transition hover:bg-mystical-purple-900/60"
                  >
                    重新加载
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center py-20" role="status" aria-label="加载祈福灯状态">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-transparent border-t-mystical-gold-500"></div>
              </div>
            ) : (
              <div
                className="mt-14 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4"
                role="region"
                aria-label="祈福灯列表"
              >
                {lamps.map((lamp) => {
                  const state = lampStates[lamp.key] || 'unlit'
                  const isLit = state === 'lit'
                  const isPurchasing = state === 'purchasing'

                  return (
                    <div
                      key={lamp.key}
                      ref={(el) => {
                        if (el) lampRefs.current[lamp.key] = el
                      }}
                      className={`lamp-container lamp-state-transition relative overflow-hidden rounded-xl border border-mystical-gold-700/30 bg-gradient-to-br from-mystical-purple-950/75 via-mystical-cyan-950/60 to-mystical-purple-900/70 shadow-mystical-medium transition-all duration-300 ${isLit ? 'ring-2 ring-mystical-gold-600/60 shadow-gold-glow-lg animate-gold-glow-pulse' : 'hover:-translate-y-1 hover:shadow-gold-glow'} ${isPurchasing ? 'opacity-80 saturate-75' : ''}`}
                      data-lamp-key={lamp.key}
                      data-lamp-state={state}
                    >
                      <div className="lamp-card-layer" aria-hidden="true" />
                      <div className="lamp-card-shimmer" aria-hidden="true" />

                      <div className="relative aspect-square overflow-hidden">
                        <img
                          src={lamp.image}
                          alt={`${lamp.name}祈福灯`}
                          className={`h-full w-full object-cover transition-all duration-500 ${isLit ? 'brightness-110 saturate-110' : 'brightness-85'}`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-mystical-purple-950/70 via-transparent to-transparent" aria-hidden="true" />

                        {isLit && (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-br from-mystical-gold-700/35 via-transparent to-transparent mix-blend-screen" />
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="absolute inset-0 rounded-full blur-2xl bg-mystical-gold-700/35" />
                            </div>
                            <div className="absolute top-1 right-1 rounded-full border border-mystical-gold-700/40 bg-mystical-purple-950/60 px-1 py-0.5 text-xs font-semibold text-mystical-gold-500 shadow-gold-glow" role="status" aria-label={`${lamp.name}已点亮`}>
                              已点
                            </div>
                          </>
                        )}

                        {isPurchasing && (
                          <div className="absolute inset-0 bg-mystical-purple-950/60 backdrop-blur-sm flex items-center justify-center">
                            <div className="rounded-xl border border-mystical-gold-700/30 bg-mystical-purple-900/70 px-3 py-2 text-xs text-mystical-gold-500 shadow-gold-glow">
                              处理中...
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="relative p-2 sm:p-3 space-y-2">
                        {/* Lamp name */}
                        <div className="text-center">
                          <Text size="xs" weight="semibold" className="text-mystical-gold-400 font-serif leading-tight">
                            {lamp.name}
                          </Text>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-mystical-gold-500">
                            ${lamp.price}
                          </span>
                        </div>

                        <Button
                          fullWidth
                          size="sm"
                          variant={isLit ? 'mystical' : 'gold'}
                          loading={isPurchasing}
                          disabled={isLit || isPurchasing}
                          onClick={() => handleBuyLamp(lamp.key)}
                          className={
                            isLit
                              ? 'bg-mystical-purple-900/60 text-mystical-gold-500 border border-mystical-gold-700/40 shadow-gold-glow cursor-default'
                              : 'bg-gradient-to-r from-mystical-gold-700 via-mystical-gold-500 to-mystical-rose-700 text-mystical-purple-950 shadow-gold-glow hover:shadow-gold-glow-lg'
                          }
                          aria-label={
                            isLit
                              ? `${lamp.name}已点亮，感谢您的祈福`
                              : isPurchasing
                                ? `正在为${lamp.name}创建支付链接`
                                : `为${lamp.name}点灯，价格${lamp.price}美元`
                          }
                        >
                          {isLit ? '已点 ✨' : isPurchasing ? '...' : '点亮'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-16 rounded-3xl border border-mystical-gold-700/30 bg-mystical-purple-950/50 p-10 shadow-mystical-medium">
              <Heading level={2} className="mb-6 font-serif text-center text-mystical-gold-500">
                如何点亮祈福灯
              </Heading>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-mystical-gold-700/40 bg-mystical-purple-900/60 text-mystical-gold-500 font-bold">1</div>
                  <Text weight="semibold" className="text-mystical-gold-500/90">选择祈福灯</Text>
                  <Text size="sm" className="text-mystical-gold-500/70">挑选寓意契合的灯笼，将心愿注入光芒之中。</Text>
                </div>
                <div className="space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-mystical-gold-700/40 bg-mystical-purple-900/60 text-mystical-gold-500 font-bold">2</div>
                  <Text weight="semibold" className="text-mystical-gold-500/90">完成支付</Text>
                  <Text size="sm" className="text-mystical-gold-500/70">通过安全通道完成支付，系统将自动为您点灯。</Text>
                </div>
                <div className="space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-mystical-gold-700/40 bg-mystical-purple-900/60 text-mystical-gold-500 font-bold">3</div>
                  <Text weight="semibold" className="text-mystical-gold-500/90">灯光守护</Text>
                  <Text size="sm" className="text-mystical-gold-500/70">点灯成功后，灯笼将持续发光，守护您的心愿。</Text>
                </div>
              </div>
            </div>

            <div className="mt-14 text-center space-y-3">
              <Text size="sm" className="text-mystical-gold-500/75 italic">
                每一盏灯都承载一份祝福与守候，愿光芒伴随您与家人。
              </Text>
              <Text size="xs" className="text-mystical-gold-500/60">
                当前共有 {litCount} 盏灯持续闪耀。
              </Text>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}
