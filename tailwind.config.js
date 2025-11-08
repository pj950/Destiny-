/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy brand colors
        brand: {
          primary: {
            50: '#f0f9ff',
            100: '#e0f2fe',
            200: '#bae6fd',
            300: '#7dd3fc',
            400: '#38bdf8',
            500: '#0ea5e9',
            600: '#0284c7',
            700: '#0369a1',
            800: '#075985',
            900: '#0c4a6e',
          },
          secondary: {
            50: '#fdf2f8',
            100: '#fce7f3',
            200: '#fbcfe8',
            300: '#f9a8d4',
            400: '#f472b6',
            500: '#ec4899',
            600: '#db2777',
            700: '#be185d',
            800: '#9d174d',
            900: '#831843',
          },
          accent: {
            50: '#fef3c7',
            100: '#fde68a',
            200: '#fcd34d',
            300: '#fbbf24',
            400: '#f59e0b',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309',
            800: '#92400e',
            900: '#78350f',
          }
        },
        // Mystical theme colors
        mystical: {
          purple: {
            950: '#1a0f2e',
            900: '#3f0f5c',
            800: '#581c87',
            700: '#6b21a8',
            600: '#7e22ce',
            500: '#9333ea',
          },
          cyan: {
            950: '#0f1c2e',
            900: '#003a75',
            800: '#004a99',
          },
          gold: {
            600: '#daa520',
            700: '#d4af37',
            500: '#f4af37',
          },
          rose: {
            700: '#d91e3f',
            800: '#b21637',
            900: '#8b4789',
          }
        }
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgb(0 0 0 / 0.07), 0 10px 20px -2px rgb(0 0 0 / 0.04)',
        'medium': '0 4px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)',
        'gold-glow': '0 0 20px rgba(212, 175, 55, 0.4)',
        'gold-glow-lg': '0 0 30px rgba(212, 175, 55, 0.3), 0 0 60px rgba(212, 175, 55, 0.15)',
        'mystical-soft': '0 4px 20px rgba(0, 0, 0, 0.3)',
        'mystical-medium': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'mystical-deep': '0 12px 48px rgba(0, 0, 0, 0.5)',
        'rose-glow': '0 0 20px rgba(139, 71, 137, 0.4)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-soft': 'bounceSoft 0.6s ease-out',
        'gold-glow-pulse': 'goldGlowPulse 2s ease-in-out infinite',
        'mystical-flicker': 'mysticalFlicker 0.15s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceSoft: {
          '0%, 20%, 53%, 80%, 100%': { transform: 'translate3d(0,0,0)' },
          '40%, 43%': { transform: 'translate3d(0, -5px, 0)' },
          '70%': { transform: 'translate3d(0, -3px, 0)' },
          '90%': { transform: 'translate3d(0, -1px, 0)' },
        },
        goldGlowPulse: {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(212, 175, 55, 0.4)',
          },
          '50%': {
            boxShadow: '0 0 40px rgba(212, 175, 55, 0.8)',
          },
        },
        mysticalFlicker: {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': {
            opacity: '1',
          },
          '20%, 24%, 55%': {
            opacity: '0.8',
          },
        },
      },
      backgroundImage: {
        'gradient-mystical-hero': 'linear-gradient(135deg, #1a0f2e 0%, #0f1c2e 50%, #1a0f2e 100%)',
        'gradient-mystical-dark': 'linear-gradient(to bottom, rgba(26, 15, 46, 0.95), rgba(15, 28, 46, 0.98))',
        'gradient-gold-accent': 'linear-gradient(135deg, #d4af37 0%, #f4af37 50%, #daa520 100%)',
        'gradient-purple-mystical': 'linear-gradient(135deg, #6b21a8 0%, #3f0f5c 100%)',
        'gradient-card-dark': 'linear-gradient(135deg, rgba(26, 15, 46, 0.8), rgba(15, 28, 46, 0.8))',
      }
    },
  },
  plugins: [],
}
