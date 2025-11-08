import { categoryGradients, categoryIcons } from '../lib/fortuneConstants'
import type { FortuneCategory } from '../lib/fortuneConstants'
import FortuneStick from './FortuneStick'
import { Text, Heading } from './ui'

interface FortuneAnimationStageProps {
  state: 'shake' | 'fallen'
  selectedCategory: FortuneCategory
  statusMessage: string
}

export default function FortuneAnimationStage({
  state,
  selectedCategory,
  statusMessage,
}: FortuneAnimationStageProps) {
  const gradientClass = categoryGradients[selectedCategory]
  const title = state === 'shake' ? '神秘签筒正在苏醒' : '签文已降临'
  const subtitle = state === 'shake'
    ? '轻捧诚念，让金色签筒与您的心意同频共振'
    : '签牌穿越星辉坠落，光芒映照出今日的指引'
  const message = statusMessage?.trim()
    ? statusMessage
    : state === 'shake'
      ? '请保持虔诚，签筒与灵韵共鸣，签文即将降临。'
      : '金色签牌自签筒稳稳落地，吉凶已现。'

  return (
    <div className="relative overflow-hidden rounded-4xl border border-mystical-gold-700/30 bg-gradient-to-br from-mystical-purple-950/85 via-mystical-purple-900/80 to-mystical-cyan-950/85 shadow-mystical-deep backdrop-blur-xl transition-all duration-500">
      <div className={`absolute inset-0 opacity-30 mix-blend-screen blur-3xl bg-gradient-to-br ${gradientClass}`} />
      <div className="mystical-grid-pattern" />
      <div className="mystical-fog" />
      <div className="mystical-stars" />
      <div className="fortune-stage-veil" />
      <div className="fortune-stage-sigil" />
      <div className="fortune-stage-orb" />
      <div className="fortune-stage-orb fortune-stage-orb--slow" />
      <div className="fortune-stage-floor" />

      <div className="relative z-10 flex flex-col items-center text-center px-6 py-16 sm:py-20 md:px-16">
        <div className="inline-flex items-center gap-3 rounded-full border border-mystical-gold-700/30 bg-white/10 px-5 py-2 text-sm font-semibold tracking-wide text-mystical-gold-400 shadow-gold-glow backdrop-blur-md">
          <span className="text-2xl" aria-hidden="true">
            {categoryIcons[selectedCategory]}
          </span>
          <span className="font-semibold">{selectedCategory}</span>
        </div>

        <Heading
          level={2}
          size="3xl"
          weight="semibold"
          gradient
          className="mt-10 font-serif text-4xl md:text-5xl"
        >
          {title}
        </Heading>

        <Text
          size="lg"
          className="mt-4 max-w-2xl font-medium text-mystical-gold-600/80"
        >
          {subtitle}
        </Text>

        <div className="relative mt-14 mb-16 flex w-full max-w-md items-center justify-center">
          <div className="absolute inset-x-10 -bottom-2 h-24 rounded-full bg-gradient-to-br from-mystical-gold-700/35 via-mystical-gold-500/20 to-transparent blur-3xl" />
          <FortuneStick
            isShaking={state === 'shake'}
            isFalling={state === 'fallen'}
            category={selectedCategory}
          />
        </div>

        <div className="flex flex-col items-center gap-4">
          <Text
            size="lg"
            className="max-w-2xl text-mystical-gold-400/90 leading-relaxed"
          >
            {message}
          </Text>
          <div className="flex items-center gap-3">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full bg-mystical-gold-500 animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="inline-block h-2.5 w-2.5 rounded-full bg-mystical-gold-500/80 animate-bounce"
              style={{ animationDelay: '160ms' }}
            />
            <span
              className="inline-block h-2.5 w-2.5 rounded-full bg-mystical-gold-500/60 animate-bounce"
              style={{ animationDelay: '320ms' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
