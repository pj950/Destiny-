import { categoryGradients } from '../lib/fortuneConstants'
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

  return (
    <div
      className={`min-h-96 rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br ${gradientClass} relative`}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white rounded-full blur-3xl" />
      </div>

      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center p-6 sm:p-12">
        {/* Title */}
        <Heading level={2} className="text-white mb-12 text-center drop-shadow-lg">
          {state === 'shake' ? '正在为您求签...' : '签文已出'}
        </Heading>

        {/* Fortune stick animation area */}
        <div className="mb-12 flex items-center justify-center">
          <FortuneStick
            isShaking={state === 'shake'}
            isFalling={state === 'fallen'}
            category={selectedCategory}
          />
        </div>

        {/* Status message with loading indicator */}
        <div className="flex flex-col items-center gap-3">
          <Text size="lg" className="text-white/90 text-center drop-shadow-md">
            {statusMessage}
          </Text>
          <div className="flex gap-2 items-center">
            <span className="inline-block w-2 h-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="inline-block w-2 h-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="inline-block w-2 h-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
