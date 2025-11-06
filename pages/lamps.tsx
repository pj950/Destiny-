import { useState, useEffect } from 'react'
import Head from 'next/head'
import Navbar from '../components/Navbar'
import { useRouter } from 'next/router'

interface LampStatus {
  lamp_key: string
  status: 'unlit' | 'lit'
}

interface Lamp {
  key: string
  name: string
  image: string
  price: number
}

const LAMPS: Lamp[] = [
  { key: 'p1', name: '福运灯', image: '/images/p1.jpg', price: 19.9 },
  { key: 'p2', name: '安康灯', image: '/images/p2.jpg', price: 19.9 },
  { key: 'p3', name: '财源灯', image: '/images/p3.jpg', price: 19.9 },
  { key: 'p4', name: '事业灯', image: '/images/p4.jpg', price: 19.9 },
]

export default function LampsPage() {
  const router = useRouter()
  const [lampStatuses, setLampStatuses] = useState<Record<string, 'unlit' | 'lit'>>({})
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  // Fetch lamp statuses on mount and when returning from Stripe
  useEffect(() => {
    fetchLampStatuses()
  }, [])

  // Check for session_id in URL query params (return from Stripe)
  useEffect(() => {
    if (router.isReady && router.query.session_id) {
      // User returned from Stripe, refresh statuses
      fetchLampStatuses()
    }
  }, [router.isReady, router.query])

  const fetchLampStatuses = async () => {
    try {
      const response = await fetch('/api/lamps/status')
      if (!response.ok) {
        throw new Error('Failed to fetch lamp statuses')
      }
      const data: LampStatus[] = await response.json()
      
      // Convert array to object for easier lookup
      const statusMap: Record<string, 'unlit' | 'lit'> = {}
      data.forEach(lamp => {
        statusMap[lamp.lamp_key] = lamp.status
      })
      
      setLampStatuses(statusMap)
    } catch (error) {
      console.error('Error fetching lamp statuses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBuyLamp = async (lampKey: string) => {
    if (purchasing) return
    
    setPurchasing(lampKey)
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
      // Redirect to Stripe Checkout
      window.location.href = url
    } catch (error) {
      console.error('Error purchasing lamp:', error)
      alert('购买失败，请重试')
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <>
      <Head>
        <title>祈福点灯 - 东方命理</title>
        <meta name="description" content="点燃祈福灯，为您和家人祈求福运安康" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
        <Navbar />
        
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

            {/* Loading State */}
            {loading && (
              <div className="flex justify-center items-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            )}

            {/* Lamps Grid */}
            {!loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {LAMPS.map((lamp) => {
                  const isLit = lampStatuses[lamp.key] === 'lit'
                  const isPurchasing = purchasing === lamp.key
                  
                  return (
                    <div
                      key={lamp.key}
                      className={`relative group bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl ${
                        isLit ? 'ring-4 ring-orange-200 ring-opacity-50' : ''
                      }`}
                    >
                      {/* Lamp Image Container */}
                      <div className="relative aspect-square overflow-hidden">
                        <img
                          src={lamp.image}
                          alt={lamp.name}
                          className={`w-full h-full object-cover transition-all duration-500 ${
                            isLit ? 'brightness-110' : 'brightness-75'
                          }`}
                        />
                        
                        {/* Lit Effect Overlay */}
                        {isLit && (
                          <>
                            {/* Glow Effect */}
                            <div className="absolute inset-0 bg-gradient-to-t from-orange-400/30 via-yellow-300/20 to-transparent pointer-events-none" />
                            
                            {/* Pulse Animation */}
                            <div className="absolute inset-0 animate-pulse">
                              <div className="absolute inset-0 bg-orange-300/20 rounded-full blur-xl" />
                            </div>
                            
                            {/* Flicker Effect */}
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-200 rounded-full animate-ping" />
                              <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-orange-200 rounded-full animate-ping animation-delay-1000" />
                              <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-yellow-100 rounded-full animate-ping animation-delay-2000" />
                            </div>
                            
                            {/* Lit Badge */}
                            <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg">
                              已点亮
                            </div>
                          </>
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
                          className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                            isLit
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isPurchasing
                              ? 'bg-gray-200 text-gray-600 cursor-wait'
                              : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 transform hover:-translate-y-0.5 hover:shadow-lg'
                          }`}
                        >
                          {isLit ? '已点亮' : isPurchasing ? '处理中...' : '点亮'}
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
                  <p className="text-sm text-gray-600">通过安全的Stripe支付系统完成购买</p>
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

      <style jsx>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </>
  )
}
