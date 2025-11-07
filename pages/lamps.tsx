import { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import Navbar from '../components/Navbar'
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

interface LampStatus {
  lamp_key: string
  status: 'unlit' | 'lit'
  last_updated?: string
}

interface Lamp {
  key: string
  name: string
  image: string
  price: number
}

type LampState = 'unlit' | 'purchasing' | 'lit'

const LAMPS: Lamp[] = [
  { key: 'p1', name: '福运灯', image: '/images/p1.jpg', price: 19.9 },
  { key: 'p2', name: '安康灯', image: '/images/p2.jpg', price: 19.9 },
  { key: 'p3', name: '财源灯', image: '/images/p3.jpg', price: 19.9 },
  { key: 'p4', name: '事业灯', image: '/images/p4.jpg', price: 19.9 },
]

export default function LampsPage() {
  const router = useRouter()
  const [lampStates, setLampStates] = useState<Record<string, LampState>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingCache, setUsingCache] = useState(false)
  const lampRefs = useRef<Record<string, HTMLDivElement>>({})
  const performanceMonitor = useRef(AnimationPerformanceMonitor.getInstance())

  // Initialize performance monitoring
  useEffect(() => {
    performanceMonitor.current.startMonitoring()
    return () => performanceMonitor.current.stopMonitoring()
  }, [])

  // Fetch lamp statuses on mount and when returning from payment gateway
  useEffect(() => {
    fetchLampStatuses()
  }, [])

  // Check for Razorpay callback parameters in URL query params (return from Razorpay)
  useEffect(() => {
    if (router.isReady) {
      const { razorpay_payment_id, razorpay_payment_link_id, session_id } = router.query
      if (razorpay_payment_id || razorpay_payment_link_id || session_id) {
        // User returned from payment gateway (Razorpay or legacy Stripe)
        // Attempt to confirm the payment first, then refresh statuses
        confirmPaymentAndRefresh(razorpay_payment_id as string | undefined, razorpay_payment_link_id as string | undefined)
      }
    }
  }, [router.isReady, router.query])

  // Apply animations when lamp states change
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
    
    // Try to get cached data first for immediate UI
    let cachedData: LampStatus[] | null = null
    if (isLocalStorageAvailable()) {
      cachedData = getLampStatesFromStorage()
    }
    
    // If we have cached data, show it immediately
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
      // Fetch fresh data from API
      const response = await fetch('/api/lamps/status')
      if (!response.ok) {
        throw new Error('Failed to fetch lamp statuses')
      }
      const apiData: LampStatus[] = await response.json()
      
      // Merge API data with cache (cache takes precedence for recent updates)
      if (cachedData) {
        finalData = mergeLampStates(apiData, cachedData)
      } else {
        finalData = apiData
      }
      
      // Convert to object for easier lookup
      const statusMap: Record<string, LampState> = {}
      finalData.forEach(lamp => {
        statusMap[lamp.lamp_key] = lamp.status
      })
      
      setLampStates(statusMap)
      
      // Save fresh data to cache
      if (isLocalStorageAvailable()) {
        saveLampStatesToStorage(finalData)
      }
      
      setUsingCache(false)
    } catch (error) {
      console.error('Error fetching lamp statuses:', error)
      setError('无法加载祈福灯状态，请稍后重试')
      
      // If we have cached data, keep using it
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
      // If we have payment confirmation params, confirm the payment
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
      
      // Refresh all lamp statuses after a small delay to allow backend to process
      setTimeout(() => {
        fetchLampStatuses()
        toast.success('支付成功', '祈福灯已点亮')
      }, 500)
    } catch (error: any) {
      console.error('[Lamps] Error confirming payment:', error)
      // Still try to refresh even if confirmation fails
      setTimeout(() => {
        fetchLampStatuses()
      }, 500)
    }
  }, [fetchLampStatuses])

  const handleBuyLamp = useCallback(async (lampKey: string) => {
    if (lampStates[lampKey] === 'purchasing') return
    
    // Set purchasing state immediately for UI feedback
    setLampStates(prev => ({ ...prev, [lampKey]: 'purchasing' }))
    
    // Update cache to reflect purchasing state
    if (isLocalStorageAvailable()) {
      updateLampStateInStorage(lampKey, 'unlit') // Keep as unlit until payment confirmed
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
      
      // Show success message before redirect
      toast.info('正在跳转', '即将跳转到支付页面...')
      
      // Small delay to allow toast to show
      setTimeout(() => {
        window.location.href = url
      }, 1000)
      
    } catch (error: any) {
      console.error('Error purchasing lamp:', error)
      
      // Reset state on error
      setLampStates(prev => ({ ...prev, [lampKey]: 'unlit' }))
      
      // Show user-friendly error message
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

      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
        <Navbar />
        <ToastContainer />
        
        <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                祈福点灯
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                点亮祈福明灯，为您和家人祈求福运安康、财源广进、事业顺利
              </p>
            </div>

            {/* Status Messages */}
            {usingCache && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                <span className="text-yellow-800 text-sm">
                  ⚡ 使用缓存数据 - 网络连接恢复后将自动更新
                </span>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                <span className="text-red-800 text-sm">
                  ❌ {error}
                </span>
                <button
                  onClick={fetchLampStatuses}
                  className="ml-4 text-red-600 underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  重试
                </button>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex justify-center items-center py-16" role="status" aria-label="加载中">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                <span className="sr-only">正在加载祈福灯状态...</span>
              </div>
            )}

            {/* Lamps Grid */}
            {!loading && (
              <div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
                role="region"
                aria-label="祈福灯列表"
              >
                {LAMPS.map((lamp) => {
                  const state = lampStates[lamp.key] || 'unlit'
                  const isLit = state === 'lit'
                  const isPurchasing = state === 'purchasing'
                  
                  return (
                    <div
                      key={lamp.key}
                      ref={(el) => {
                        if (el) lampRefs.current[lamp.key] = el
                      }}
                      className={`
                        relative group bg-white rounded-2xl shadow-lg overflow-hidden 
                        transition-all duration-300 hover:shadow-xl lamp-container
                        ${isLit ? 'ring-4 ring-orange-200 ring-opacity-50' : ''}
                        lamp-state-transition
                      `}
                      data-lamp-key={lamp.key}
                      data-lamp-state={state}
                    >
                      {/* Lamp Image Container */}
                      <div className="relative aspect-square overflow-hidden">
                        <img
                          src={lamp.image}
                          alt={`${lamp.name}祈福灯`}
                          className={`
                            w-full h-full object-cover transition-all duration-500
                            ${isLit ? 'brightness-110' : 'brightness-75'}
                          `}
                        />
                        
                        {/* Enhanced Lit Effect Overlay */}
                        {isLit && (
                          <>
                            {/* Soft Glow Effect */}
                            <div className="absolute inset-0 bg-gradient-to-t from-orange-300/40 via-yellow-200/30 to-transparent pointer-events-none lamp-overlay-lit" />
                            
                            {/* Pulsing Aura */}
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="absolute inset-0 bg-orange-400/20 rounded-full blur-2xl lamp-overlay-lit" />
                            </div>
                            
                            {/* Candle Flicker Particles */}
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="glow-particle candle-flicker" />
                              <div className="glow-particle candle-flicker" />
                              <div className="glow-particle candle-flicker" />
                            </div>
                            
                            {/* Lit Badge */}
                            <div 
                              className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg"
                              role="status"
                              aria-label={`${lamp.name}已点亮`}
                            >
                              已点亮
                            </div>
                          </>
                        )}

                        {/* Purchasing State Overlay */}
                        {isPurchasing && (
                          <div className="absolute inset-0 bg-gray-900/30 flex items-center justify-center">
                            <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 text-center">
                              <div className="lamp-spinner text-orange-500 mx-auto mb-2" />
                              <span className="text-sm text-gray-700">处理中...</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Lamp Info */}
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{lamp.name}</h3>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-2xl font-bold text-orange-600">
                            ${lamp.price}
                          </span>
                        </div>
                        
                        {/* Action Button */}
                        <button
                          onClick={() => handleBuyLamp(lamp.key)}
                          disabled={isLit || isPurchasing}
                          className={`
                            w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500
                            lamp-button
                            ${isLit
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isPurchasing
                              ? 'bg-gray-200 text-gray-600 cursor-wait'
                              : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 transform hover:-translate-y-0.5 hover:shadow-lg'
                            }
                          `}
                          aria-label={
                            isLit 
                              ? `${lamp.name}已点亮，无法再次购买`
                              : isPurchasing
                              ? `正在购买${lamp.name}，请稍候`
                              : `购买${lamp.name}祈福灯，价格${lamp.price}美元`
                          }
                        >
                          {isLit ? (
                            <>
                              <svg className="w-4 h-4 inline-block mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              已点亮
                            </>
                          ) : isPurchasing ? (
                            <>
                              <div className="lamp-spinner w-4 h-4 inline-block mr-2" />
                              处理中...
                            </>
                          ) : (
                            '点亮'
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Instructions */}
            <div className="mt-16 bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-md">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">如何祈福点灯</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-orange-600 font-bold">1</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">选择祈福灯</h3>
                  <p className="text-sm text-gray-600">选择您想要点亮的祈福灯，每盏灯都有特殊的寓意</p>
                </div>
                <div>
                   <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-orange-600 font-bold">2</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">完成支付</h3>
                  <p className="text-sm text-gray-600">通过安全的支付系统完成购买</p>
                </div>
                <div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-orange-600 font-bold">3</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">灯亮祈福</h3>
                  <p className="text-sm text-gray-600">支付成功后，祈福灯将被点亮，状态永久保存</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
