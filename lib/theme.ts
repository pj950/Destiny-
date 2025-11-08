/**
 * Mystical theme configuration
 * Deep purple/cyan with gold accents for Eastern Destiny
 */

export const theme = {
  // Primary colors - Deep purple/cyan mystical palette
  colors: {
    // Deep purples (primary mystical background)
    purple: {
      50: '#f3e8ff',
      100: '#e9d5ff',
      200: '#d8b4fe',
      300: '#c084fc',
      400: '#a855f7',
      500: '#9333ea',
      600: '#7e22ce',
      700: '#6b21a8',
      800: '#581c87',
      900: '#3f0f5c',
      950: '#1a0f2e', // Deep mystical purple
    },
    
    // Deep cyans (primary mystical background)
    cyan: {
      50: '#ecf7ff',
      100: '#d4f1ff',
      200: '#a9e3ff',
      300: '#7ec9ff',
      400: '#4aafff',
      500: '#1595ff',
      600: '#0080e5',
      700: '#0060c2',
      800: '#004a99',
      900: '#003a75',
      950: '#0f1c2e', // Deep mystical cyan
    },

    // Golds/Bronzes (accent, luxury feel)
    gold: {
      50: '#fffbf0',
      100: '#fdf6e3',
      200: '#fce8c3',
      300: '#fad8a1',
      400: '#f7c35f',
      500: '#f4af37', // Bright gold
      600: '#daa520', // Goldenrod
      700: '#d4af37', // Primary gold accent
      800: '#b8941e',
      900: '#8b7815',
      950: '#5a5209',
    },

    // Rose/Magenta (secondary accent)
    rose: {
      50: '#fff1f3',
      100: '#ffe4e8',
      200: '#ffcdd5',
      300: '#ffabb4',
      400: '#ff7a8b',
      500: '#ff4d63',
      600: '#ff2850',
      700: '#d91e3f',
      800: '#b21637',
      900: '#8b4789', // Rose red accent
      950: '#4a2847',
    },
  },

  // Gradients for various UI elements
  gradients: {
    // Hero/background gradients
    heroDeep: 'linear-gradient(135deg, #1a0f2e 0%, #0f1c2e 50%, #1a0f2e 100%)',
    heroDark: 'linear-gradient(to bottom, rgba(26, 15, 46, 0.95), rgba(15, 28, 46, 0.98))',
    
    // Gold gradient overlays
    goldGlow: 'linear-gradient(135deg, #d4af37 0%, #f4af37 50%, #daa520 100%)',
    goldAccent: 'linear-gradient(to right, #d4af37, #c9a961)',
    
    // Mystical purples
    purpleMystical: 'linear-gradient(135deg, #6b21a8 0%, #3f0f5c 100%)',
    purpleDeep: 'linear-gradient(to bottom, #581c87, #3f0f5c)',
    
    // Rose accents
    roseGlow: 'linear-gradient(135deg, #8b4789 0%, #d91e3f 100%)',
    
    // Card gradients
    cardDark: 'linear-gradient(135deg, rgba(26, 15, 46, 0.8), rgba(15, 28, 46, 0.8))',
    cardGolden: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(201, 169, 97, 0.1))',
  },

  // Shadows
  shadows: {
    // Gold glow effects
    goldGlow: '0 0 20px rgba(212, 175, 55, 0.4)',
    goldGlowLarge: '0 0 30px rgba(212, 175, 55, 0.3), 0 0 60px rgba(212, 175, 55, 0.15)',
    
    // Mystical shadows
    mysticalSoft: '0 4px 20px rgba(0, 0, 0, 0.3)',
    mysticalMedium: '0 8px 32px rgba(0, 0, 0, 0.4)',
    mysticalDeep: '0 12px 48px rgba(0, 0, 0, 0.5)',
    
    // Rose glow
    roseGlow: '0 0 20px rgba(139, 71, 137, 0.4)',
  },

  // Border styles
  borders: {
    // Gold borders
    goldBorder: '1px solid rgba(212, 175, 55, 0.3)',
    goldBorderHeavy: '2px solid rgba(212, 175, 55, 0.5)',
    goldBorderLight: '1px solid rgba(212, 175, 55, 0.15)',
    
    // Purple borders
    purpleBorder: '1px solid rgba(107, 33, 168, 0.3)',
    purpleBorderHeavy: '2px solid rgba(107, 33, 168, 0.5)',
  },

  // Text colors for dark background
  text: {
    primary: '#fafaf9', // Off-white for dark bg
    secondary: '#e0e0e0', // Light gray
    muted: '#a0a0a0', // Muted gray
    gold: '#d4af37', // Gold text
    goldBright: '#f4af37', // Bright gold
    accent: '#8b4789', // Rose accent
  },

  // Animation configurations
  animations: {
    // Glow animations
    goldGlowPulse: {
      keyframes: {
        '0%, 100%': {
          boxShadow: '0 0 20px rgba(212, 175, 55, 0.4)',
        },
        '50%': {
          boxShadow: '0 0 40px rgba(212, 175, 55, 0.8)',
        },
      },
      duration: '2s',
      timingFunction: 'ease-in-out',
      iterationCount: 'infinite',
    },

    // Flicker effect for mystical feel
    flicker: {
      keyframes: {
        '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': {
          opacity: '1',
        },
        '20%, 24%, 55%': {
          opacity: '0.8',
        },
      },
      duration: '0.15s',
      iterationCount: 'infinite',
    },
  },
}

export const themeColors = theme.colors
export const themeGradients = theme.gradients
export const themeShadows = theme.shadows
