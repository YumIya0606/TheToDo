/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        foreground: '#f9fafb',
        card: '#0d1117',
        'card-foreground': '#f9fafb',
        popover: '#0d1117',
        'popover-foreground': '#f9fafb',
        primary: {
          DEFAULT: '#2dd4bf',
          foreground: '#020817'
        },
        secondary: {
          DEFAULT: '#374151',
          foreground: '#f9fafb'
        },
        accent: {
          DEFAULT: '#6366f1',
          foreground: '#f9fafb'
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: [],
}