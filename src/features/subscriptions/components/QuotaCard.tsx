import React from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'

interface QuotaCardProps {
  title: string
  used: number
  limit: number | null
  enabled: boolean
  period?: string
  resetAt?: string
  onUpgrade?: () => void
  className?: string
}

export default function QuotaCard({
  title,
  used,
  limit,
  enabled,
  period,
  resetAt,
  onUpgrade,
  className = ''
}: QuotaCardProps) {
  // Calculate percentage for progress bar
  const percentage = limit !== null && limit > 0 ? (used / limit) * 100 : 0
  
  // Determine progress bar color based on percentage
  const getProgressColor = () => {
    if (!enabled || limit === null) return 'bg-gray-300'
    if (percentage < 50) return 'bg-green-500'
    if (percentage < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }
  
  // Get status text
  const getStatusText = () => {
    if (!enabled) return '已禁用'
    if (limit === null) return '无限制'
    if (limit === 0) return '已锁定'
    return `${used}/${limit}`
  }
  
  // Get status color
  const getStatusColor = () => {
    if (!enabled) return 'text-gray-500'
    if (limit === null) return 'text-green-600'
    if (percentage >= 80) return 'text-red-600'
    if (percentage >= 50) return 'text-yellow-600'
    return 'text-green-600'
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          {!enabled && (
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          )}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>
      
      {/* Progress Bar */}
      {enabled && limit !== null && limit > 0 && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`${getProgressColor()} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Additional Info */}
      {period && resetAt && (
        <div className="text-xs text-gray-500 mb-3">
          重置时间: {new Date(resetAt).toLocaleDateString('zh-CN')}
        </div>
      )}
      
      {/* Upgrade Button for locked features */}
      {!enabled || limit === 0 ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onUpgrade}
          className="w-full"
        >
          升级解锁
        </Button>
      ) : null}
    </Card>
  )
}