export default function ReportCard({ url }: { url: string }) {
  return (
    <div className="p-4 border rounded shadow bg-white">
      <a 
        href={url} 
        target="_blank" 
        rel="noreferrer" 
        className="text-indigo-600 hover:text-indigo-800 underline"
      >
        下载报告
      </a>
    </div>
  )
}
