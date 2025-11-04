import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function Dashboard() {
  const { data } = useSWR('/api/my/charts', fetcher)

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <h2 className="text-2xl mb-4 text-black font-bold">我的命盘</h2>
      <pre className="bg-white p-4 text-black rounded shadow">{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
