/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          deep: '#07071a',
          card: 'rgba(255,255,255,0.04)',
          mid: '#0d0d2b'
        },
        border: { DEFAULT: 'rgba(255,255,255,0.08)' },
        accent: { DEFAULT: '#7c3aed', light: '#9d5cff', dark: '#5b21b6' },
        platform: {
          youtube: '#FF0000',
          instagram: '#E1306C',
          facebook: '#1877F2',
          tiktok: '#69C9D0',
          twitter: '#FFFFFF'
        }
      },
      fontFamily: {
        heading: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace']
      },
      maxWidth: { app: '430px' },
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
