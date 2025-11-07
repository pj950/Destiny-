import { categoryGradients, categoryIcons, levelColors } from '../lib/fortuneConstants'
import type { FortuneCategory } from '../lib/fortuneConstants'

interface FortuneCardProps {
  stick_id: number
  stick_level: string
  stick_text: string
  category: FortuneCategory
  isRevealing?: boolean
}

export default function FortuneCard({
  stick_id,
  stick_level,
  stick_text,
  category,
  isRevealing = false,
}: FortuneCardProps) {
  return (
    <div
      className={`max-w-2xl mx-auto fortune-card ${isRevealing ? 'fortune-card-reveal' : ''}`}
      style={{
        animation: isRevealing ? 'cardReveal 0.8s ease-out forwards' : 'none',
      }}
    >
      {/* Card background with ancient paper effect */}
      <div
        className="relative bg-gradient-to-br rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.9))',
          border: '3px solid #d4af37',
          boxShadow:
            '0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.5), 0 0 30px rgba(212,175,55,0.2)',
        }}
      >
        {/* Decorative corners */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-yellow-600/30 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-yellow-600/30 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-yellow-600/30 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-yellow-600/30 rounded-br-lg" />

        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, #000, #000 1px, transparent 1px, transparent 2px)`,
          }}
        />

        {/* Content */}
        <div className="relative p-8 sm:p-12 text-center">
          {/* Category badge */}
          <div 
            className={`mb-6 inline-flex items-center px-6 py-3 rounded-full shadow-lg bg-gradient-to-br ${categoryGradients[category]}`}
          >
            <span className="text-2xl mr-2" aria-hidden="true">
              {categoryIcons[category]}
            </span>
            <span className="text-white font-bold text-sm sm:text-base">{category}</span>
          </div>

          {/* Divider */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent mb-6" />

          {/* Stick ID - styled as traditional fortune stick numbering */}
          <div className="mb-2">
            <div className="text-xs text-gray-400 tracking-widest uppercase">签号</div>
            <div className="text-5xl font-bold text-gray-800 mb-2">第 {stick_id}</div>
            <div className="text-xs text-gray-400 tracking-widest">SIGN #{stick_id}</div>
          </div>

          {/* Level */}
          <div className="mb-6">
            <div
              className={`text-3xl font-bold ${
                levelColors[stick_level as keyof typeof levelColors]
              } drop-shadow-md`}
            >
              {stick_level}
            </div>
          </div>

          {/* Divider */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent mb-8" />

          {/* Fortune text - main content */}
          <div className="bg-gradient-to-b from-white/50 to-white/30 rounded-lg p-6 mb-6">
            <div className="text-gray-900 text-lg sm:text-2xl font-semibold leading-relaxed mb-4">
              {stick_text}
            </div>
          </div>

          {/* Bottom divider */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
        </div>
      </div>

      {/* Reflection effect */}
      <div
        className="mt-4 mx-auto w-11/12 h-8 rounded-2xl opacity-10 blur-lg"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.5), transparent)',
        }}
      />
    </div>
  )
}
