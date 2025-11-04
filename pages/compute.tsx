import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Card from '../components/Card'

export default function Compute() {
  const router = useRouter()
  const { profile_id } = router.query
  const [chart, setChart] = useState<any>(null)
  const [summary, setSummary] = useState('')

  useEffect(()=>{
    if (!profile_id) return
    ;(async ()=>{
      const res = await fetch('/api/charts/compute', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ profile_id }) })
      const j = await res.json()
      if (j.ok) {
        setChart(j.chart)
        const r2 = await fetch('/api/ai/interpret', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ chart_id:j.chart_id, question: '今年的事业如何？' }) })
        const j2 = await r2.json()
        setSummary(j2.summary)
      }
    })()
  },[profile_id])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-grow p-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl mb-6 text-gray-900 font-bold">试算结果</h2>
          {chart ? (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-bold text-xl mb-4 text-gray-900">八字命盘数据</h3>
                <pre className="bg-gray-100 p-4 text-gray-800 rounded border overflow-x-auto text-sm">{JSON.stringify(chart,null,2)}</pre>
              </Card>
              <Card className="p-6">
                <h3 className="font-bold text-xl mb-4 text-gray-900">AI 智能解读</h3>
                <p className="text-gray-700 leading-relaxed">{summary || '加载中...'}</p>
              </Card>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <div className="flex items-center justify-center space-x-3">
                <svg className="animate-spin h-6 w-6 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-900 text-lg">正在计算您的命盘，请稍候...</p>
              </div>
            </Card>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
