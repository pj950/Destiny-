import { useState } from 'react'
import { useRouter } from 'next/router'

export default function Home() {
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('1990-01-01T08:00')
  const [tz, setTz] = useState('Asia/Shanghai')
  const router = useRouter()

  const handleCompute = async () => {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, birth_local: birth, birth_timezone: tz, gender: 'male' })
    })
    const j = await res.json()
    if (j.ok) {
      router.push(`/compute?profile_id=${j.profile_id}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="w-full max-w-xl p-8">
        <h1 className="text-3xl font-bold mb-4">Eastern Destiny — 免费试算</h1>
        <div className="space-y-3">
          <input className="w-full p-2 rounded text-black" value={name} onChange={e=>setName(e.target.value)} placeholder="姓名 (可选)" />
          <input className="w-full p-2 rounded text-black" type="datetime-local" value={birth} onChange={e=>setBirth(e.target.value)} />
          <input className="w-full p-2 rounded text-black" value={tz} onChange={e=>setTz(e.target.value)} />
          <button className="w-full p-3 bg-indigo-600 rounded hover:bg-indigo-700 transition" onClick={handleCompute}>立即试算</button>
        </div>
      </div>
    </div>
  )
}
