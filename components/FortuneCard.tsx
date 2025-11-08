import { categoryIcons, levelColors } from '../lib/fortuneConstants'
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
  const levelClass = levelColors[stick_level as keyof typeof levelColors] ?? 'text-mystical-gold-500'

  return (
    <div
      className={`relative mx-auto max-w-3xl ${isRevealing ? 'fortune-card-reveal' : ''}`}
      style={{ animation: isRevealing ? 'cardReveal 0.8s ease-out forwards' : 'none' }}
    >
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-mystical-gold-700/18 via-mystical-rose-700/10 to-transparent blur-3xl opacity-80" aria-hidden="true" />
      <div className="fortune-card-scroll">
        <span className="fortune-card-seal" aria-hidden="true" />

        <div className="relative px-8 py-12 sm:px-14 sm:py-16 text-center">
          <div className="absolute inset-x-14 top-12 h-px bg-gradient-to-r from-transparent via-mystical-gold-500/40 to-transparent" aria-hidden="true" />
          <div className="absolute inset-x-14 bottom-12 h-px bg-gradient-to-r from-transparent via-mystical-gold-500/30 to-transparent" aria-hidden="true" />

          <div className="relative flex justify-center">
            <div className={`inline-flex items-center gap-3 rounded-full border border-mystical-gold-700/40 bg-mystical-purple-950/30 px-6 py-3 text-sm font-semibold tracking-widest text-mystical-gold-500 shadow-gold-glow backdrop-blur-sm`}
              aria-label={`求签类别：${category}`}
            >
              <span className="text-3xl" aria-hidden="true">
                {categoryIcons[category]}
              </span>
              <span className="uppercase tracking-[0.4em] text-xs sm:text-sm">
                {category}
              </span>
            </div>
          </div>

          <div className="mt-12">
            <div className="font-serif text-xs uppercase tracking-[0.45em] text-mystical-gold-600/70">
              签号
            </div>
            <h3 className="mt-4 font-serif text-4xl sm:text-5xl font-bold text-mystical-purple-900">
              第 {stick_id} 签
            </h3>
            <div className="mt-2 text-[0.65rem] uppercase tracking-[0.6em] text-mystical-gold-500/70">
              SIGN #{stick_id}
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <div className={`font-serif text-3xl sm:text-4xl font-semibold drop-shadow-sm ${levelClass}`}>
              {stick_level}
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-mystical-gold-700/40 bg-gradient-to-b from-white/85 to-white/70 px-6 py-8 text-left shadow-soft">
            <p className="font-serif text-lg sm:text-2xl leading-relaxed text-mystical-purple-900">
              {stick_text}
            </p>
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none mt-6 hidden h-10 w-10/12 translate-y-2 rounded-full bg-gradient-to-r from-mystical-gold-700/25 via-mystical-gold-500/10 to-transparent blur-2xl md:block"
        aria-hidden="true"
      />
    </div>
  )
}
