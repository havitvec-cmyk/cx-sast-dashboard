/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg:       '#050d1a',
          surface:  '#0a1628',
          card:     '#0f1f3d',
          border:   '#1a3a5c',
          cyan:     '#22d3ee',
          purple:   '#a78bfa',
          green:    '#34d399',
        },
        sev: {
          high:   '#ef4444',
          medium: '#f97316',
          low:    '#facc15',
          info:   '#3b82f6',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow:        '0 0 20px rgba(34,211,238,0.25)',
        'glow-sm':   '0 0 10px rgba(34,211,238,0.15)',
        'glow-red':  '0 0 20px rgba(239,68,68,0.3)',
        'glow-purple':'0 0 20px rgba(167,139,250,0.25)',
      },
      backgroundImage: {
        'grid-cyber': `
          linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        'grid-cyber': '40px 40px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'scan': 'scan 4s linear infinite',
      },
      keyframes: {
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
};
