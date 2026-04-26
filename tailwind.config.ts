import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#07091A',
          900: '#0B1120',
          800: '#0F1A33',
          700: '#162247',
          600: '#1E2E5E',
          500: '#263A75',
        },
        brand: {
          orange: '#F97316',
          'orange-dark': '#EA580C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.68,-0.55,0.27,1.55) forwards',
        'ping-slow': 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      backgroundImage: {
        'dot-grid':
          'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
        'hero-gradient':
          'linear-gradient(135deg, #07091A 0%, #0F1A33 50%, #162247 100%)',
        'card-gradient':
          'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
      },
      backgroundSize: {
        'dot-md': '28px 28px',
      },
      boxShadow: {
        'card-glow': '0 0 40px rgba(249, 115, 22, 0.15)',
        'input-focus': '0 0 0 3px rgba(249, 115, 22, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
