/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0a0b12',
          elevated: '#15161f',
          hover: '#1d1e29',
          sunken: '#060710',
          // legacy aliases
          deep: '#0a0b12',
          card: '#15161f',
          mid: '#15161f'
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          subtle: 'rgba(255,255,255,0.06)',
          strong: 'rgba(255,255,255,0.12)'
        },
        text: {
          primary: '#f5f5f7',
          secondary: 'rgba(245,245,247,0.65)',
          tertiary: 'rgba(245,245,247,0.45)',
          disabled: 'rgba(245,245,247,0.25)'
        },
        accent: {
          DEFAULT: '#f97316',
          hover: '#fb923c',
          soft: 'rgba(249,115,22,0.14)',
          light: '#fb923c',
          dark: '#c2410c'
        },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        platform: {
          youtube: '#FF0000',
          instagram: '#E1306C',
          facebook: '#1877F2',
          tiktok: '#69C9D0',
          twitter: '#FFFFFF'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      maxWidth: { app: '480px' },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out'
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } }
      }
    }
  },
  plugins: []
}
