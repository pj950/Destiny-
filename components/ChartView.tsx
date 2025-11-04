export default function ChartView({ chart }: { chart: any }) {
  return (
    <div className="p-4 bg-white text-black rounded shadow">
      <h4 className="font-bold mb-2">命盘概览</h4>
      <pre className="text-sm overflow-auto">{JSON.stringify(chart, null, 2)}</pre>
    </div>
  )
}
