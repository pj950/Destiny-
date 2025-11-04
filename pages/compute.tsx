import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

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
    <div className="p-8 min-h-screen bg-gray-50">
      <h2 className="text-2xl mb-4 text-black font-bold">试算结果</h2>
      {chart ? (
        <div className="space-y-4">
          <pre className="bg-gray-100 p-4 text-black rounded border">{JSON.stringify(chart,null,2)}</pre>
          <div className="p-4 bg-white text-black rounded shadow">
            <h3 className="font-semibold mb-2">AI 短解读</h3>
            <p>{summary || '加载中...'}</p>
          </div>
        </div>
      ) : <p className="text-black">计算中...</p>}
    </div>
  )
}
