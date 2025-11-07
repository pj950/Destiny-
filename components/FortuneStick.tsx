import { categoryGradients } from '../lib/fortuneConstants'
import type { FortuneCategory } from '../lib/fortuneConstants'

interface FortuneStickProps {
  isShaking?: boolean
  isFalling?: boolean
  category?: FortuneCategory
}

export default function FortuneStick({ isShaking = false, isFalling = false, category }: FortuneStickProps) {
  return (
    <div className="relative w-32 h-64 perspective" style={{ perspective: '1000px' }}>
      {/* Stick container with 3D perspective */}
      <div
        className={`w-full h-full relative transition-all ${
          isShaking ? 'fortune-stick-shake' : isFalling ? 'fortune-stick-fall' : ''
        }`}
        style={{
          transformStyle: 'preserve-3d',
          transformOrigin: 'center center',
        }}
      >
        {/* Main stick body - gradient cylinder effect */}
        <div
          className="absolute inset-0 rounded-lg shadow-xl"
          style={{
            background: category
              ? `linear-gradient(135deg, var(--stop-1), var(--stop-2))`
              : 'linear-gradient(135deg, #92400e, #b45309)',
            '--stop-1': category ? categoryGradients[category].split(' ')[1] : '#d97706',
            '--stop-2': category ? categoryGradients[category].split(' ')[3] : '#f59e0b',
          } as any}
        >
          {/* 3D depth effect with sides */}
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            {/* Left edge for 3D effect */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 bg-black/10 rounded-l-lg"
              style={{ transform: 'translateZ(-10px)' }}
            />
            {/* Right edge highlight */}
            <div
              className="absolute right-0 top-0 bottom-0 w-2 bg-white/20 rounded-r-lg"
              style={{ transform: 'translateZ(10px)' }}
            />
            {/* Top shine */}
            <div className="absolute top-0 left-0 right-0 h-6 bg-white/20" />
            {/* Center decoration */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-3xl opacity-80" aria-hidden="true">
                签
              </div>
            </div>
          </div>
        </div>

        {/* Top cap of stick */}
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-gradient-to-b from-yellow-600 to-yellow-700 rounded-t-full shadow-md"
          style={{
            boxShadow: '0 -2px 4px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)',
          }}
        />

        {/* Bottom cap of stick */}
        <div
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-gradient-to-t from-yellow-700 to-yellow-600 rounded-b-full shadow-md"
          style={{
            boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(255,255,255,0.3)',
          }}
        />

        {/* Glow effect */}
        {isShaking && (
          <div
            className="absolute inset-0 rounded-lg opacity-50 blur-lg fortune-glow"
            style={{
              background: category
                ? `linear-gradient(135deg, var(--stop-1), var(--stop-2))`
                : 'linear-gradient(135deg, #d97706, #f59e0b)',
              '--stop-1': category ? categoryGradients[category].split(' ')[1] : '#d97706',
              '--stop-2': category ? categoryGradients[category].split(' ')[3] : '#f59e0b',
            } as any}
          />
        )}
      </div>

      {/* Shadow under stick */}
      <div
        className={`absolute -bottom-8 left-1/2 -translate-x-1/2 w-24 h-2 bg-black/10 rounded-full blur-md ${
          isFalling ? 'opacity-0' : 'opacity-100'
        } transition-opacity`}
      />
    </div>
  )
}
