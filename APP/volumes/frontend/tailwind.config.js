/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ✅ Dark mode con clase para layout store
  darkMode: 'class',

  theme: {
    extend: {
      // ====================================
      // COLORES PARA COMPONENTES ATÓMICOS
      // ====================================
      colors: {
        // === COLORES PRIMARIOS ===
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          DEFAULT: '#3b82f6'
        },

        // === COLORES CÁLIDOS ===
        warm: {
          50: '#fefcfb',
          100: '#fef7f0',
          200: '#feeee0',
          300: '#fde1c7',
          400: '#fbcb9a',
          500: '#f7b16d',
          600: '#e89547',
          700: '#d4772b',
          800: '#b8651e',
          900: '#9a5419',
          DEFAULT: '#f7b16d'
        },

        // === COLORES SECUNDARIOS (SLATE) ===
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',  // Para sidebar light base
          700: '#334155',  // Para sidebar light dark
          800: '#1e293b',  // Para sidebar dark light
          900: '#0f172a',  // Para sidebar dark base
          DEFAULT: '#64748b'
        },

        // === COLORES ESPECÍFICOS DEL SIDEBAR (BASADO EN TU DISEÑO) ===
        sidebar: {
          // Modo Light - Gradiente slate-700 to slate-800
          light: {
            from: '#334155',  // slate-700
            to: '#1e293b',    // slate-800
            text: 'rgba(255, 255, 255, 0.9)',
            'text-bright': 'rgba(255, 255, 255, 0.95)',
            hover: 'rgba(255, 255, 255, 0.1)',
            active: 'rgba(255, 255, 255, 0.15)',
            border: 'rgba(255, 255, 255, 0.1)',
            'border-bright': 'rgba(255, 255, 255, 0.15)'
          },
          // Modo Dark - Gradiente slate-900 to black
          dark: {
            from: '#0f172a',  // slate-900
            to: '#000000',    // black
            text: 'rgba(255, 255, 255, 0.95)',
            'text-bright': 'rgba(255, 255, 255, 1)',
            hover: 'rgba(255, 255, 255, 0.15)',
            active: 'rgba(255, 255, 255, 0.2)',
            border: 'rgba(255, 255, 255, 0.15)',
            'border-bright': 'rgba(255, 255, 255, 0.2)'
          }
        },

        // === COLORES DE ESTADO ===
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          DEFAULT: '#16a34a'
        },

        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          DEFAULT: '#f59e0b'
        },

        danger: {
          50: '#fef2f2',
          100: '#fecaca',
          200: '#fca5a5',
          300: '#f87171',
          400: '#ef4444',
          500: '#dc2626',
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#7f1d1d',
          DEFAULT: '#dc2626'
        },

        info: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          DEFAULT: '#06b6d4'
        },

        // === ALIAS PARA DARK MODE (COMPONENTES ATÓMICOS) ===
        surface: {
          light: '#ffffff',
          dark: '#1e293b'
        },
        background: {
          light: '#f8fafc',
          dark: '#0f172a'
        },
        border: {
          light: '#e2e8f0',
          dark: '#374151'
        }
      },

      // ====================================
      // LAYOUT DESKTOP/TABLET ESPECÍFICO
      // ====================================
      spacing: {
        // Layout principal
        'sidebar': '280px',
        'sidebar-collapsed': '80px',
        'header': '64px',
        'footer': '48px',

        // Componentes
        'button-sm': '0.5rem',
        'button-md': '0.75rem',
        'button-lg': '1rem',
        'card-padding': '1.5rem'
      },

      // ====================================
      // BREAKPOINTS DESKTOP/TABLET
      // ====================================
      screens: {
        'tablet': '768px',
        'laptop': '1024px',
        'desktop': '1280px',
        'wide': '1440px',
        // Específicos para layout
        'sidebar-breakpoint': '1024px'
      },

      // ====================================
      // TIPOGRAFÍA PARA COMPONENTES
      // ====================================
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }]
      },

      // ====================================
      // SOMBRAS PARA COMPONENTES
      // ====================================
      boxShadow: {
        // Componentes básicos
        'button': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'button-hover': '0 4px 8px rgba(0, 0, 0, 0.12)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.15)',

        // Layout específico
        'dropdown': '0 10px 25px rgba(0, 0, 0, 0.15)',
        'modal': '0 25px 50px rgba(0, 0, 0, 0.25)',
        'sidebar': '2px 0 8px rgba(0, 0, 0, 0.1)',

        // Estados
        'focus': '0 0 0 3px rgba(59, 130, 246, 0.1)',
        'focus-warm': '0 0 0 3px rgba(247, 177, 109, 0.1)'
      },

      // ====================================
      // BORDER RADIUS PROFESIONAL
      // ====================================
      borderRadius: {
        'xs': '0.125rem',
        'sm': '0.375rem',
        'DEFAULT': '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.5rem',
        '2xl': '2rem',
        'full': '9999px',
        // Específicos para componentes
        'button': '0.5rem',
        'card': '0.75rem'
      },

      // ====================================
      // TRANSICIONES OPTIMIZADAS
      // ====================================
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
        '350': '350ms',
        '500': '500ms'
      },

      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'gentle': 'cubic-bezier(0.25, 0.1, 0.25, 1)'
      },

      // ====================================
      // Z-INDEX ORGANIZADOS
      // ====================================
      zIndex: {
        'dropdown': '1000',
        'sticky': '1010',
        'fixed': '1020',
        'modal-backdrop': '1030',
        'modal': '1040',
        'popover': '1050',
        'tooltip': '1060'
      },

      // ====================================
      // ANIMACIONES SUTILES
      // ====================================
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },

        // ====================================
        // ANIMACIONES PARA TOAST
        // ====================================
        'toast-enter': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-leave': {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
        },
      },

      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'scale-in': 'scale-in 0.15s ease-out',

        // ====================================
        // ANIMACIONES PARA TOAST
        // ====================================
        'toast-enter': 'toast-enter 0.18s cubic-bezier(0.2, 0, 0, 1) forwards',
        'toast-leave': 'toast-leave 0.15s ease-in forwards',
      }
    }
  },

  // ====================================
  // PLUGINS CON UTILIDADES ÚTILES
  // ====================================
  plugins: [
    function ({ addUtilities, addComponents, theme }) {
      // === UTILIDADES PARA DARK MODE ===
      addUtilities({
        '.bg-theme': {
          '@apply bg-white dark:bg-secondary-900': {}
        },
        '.bg-surface': {
          '@apply bg-surface-light dark:bg-surface-dark': {}
        },
        '.text-theme': {
          '@apply text-secondary-900 dark:text-secondary-50': {}
        },
        '.text-muted': {
          '@apply text-secondary-600 dark:text-secondary-400': {}
        },
        '.border-theme': {
          '@apply border-border-light dark:border-border-dark': {}
        },

        // === UTILIDADES DE LAYOUT ===
        '.layout-container': {
          '@apply max-w-screen-wide mx-auto px-6': {}
        },
        '.sidebar-width': {
          'width': theme('spacing.sidebar'),
          'min-width': theme('spacing.sidebar')
        },
        '.sidebar-collapsed-width': {
          'width': theme('spacing.sidebar-collapsed'),
          'min-width': theme('spacing.sidebar-collapsed')
        },

        // === UTILIDADES DE TRANSICIÓN ===
        '.transition-theme': {
          '@apply transition-colors duration-200 ease-smooth': {}
        },
        '.transition-layout': {
          '@apply transition-all duration-300 ease-smooth': {}
        },
        '.transition-gentle': {
          '@apply transition-all duration-250 ease-gentle': {}
        },

        // === UTILIDADES DE HOVER ===
        '.hover-lift': {
          '@apply transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-card-hover': {}
        },
        '.hover-scale': {
          '@apply transition-transform duration-200 hover:scale-105': {}
        },
        '.hover-glow': {
          '@apply transition-all duration-200 hover:shadow-lg': {}
        },

        // === UTILIDADES DE FOCUS ===
        '.focus-ring': {
          '@apply focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2': {}
        },
        '.focus-ring-warm': {
          '@apply focus:outline-none focus:ring-2 focus:ring-warm-500 focus:ring-offset-2': {}
        },

        // === UTILIDADES PARA SIDEBAR ESPECÍFICO ===
        '.sidebar-bg-light': {
          'background': 'linear-gradient(180deg, #334155 0%, #1e293b 100%)'
        },
        '.sidebar-bg-dark': {
          'background': 'linear-gradient(180deg, #0f172a 0%, #000000 100%)'
        },
        '.sidebar-text': {
          'color': 'rgba(255, 255, 255, 0.9)'
        },
        '.sidebar-text-bright': {
          'color': 'rgba(255, 255, 255, 0.95)'
        },
        '.sidebar-hover': {
          'background-color': 'rgba(255, 255, 255, 0.1)'
        },
        '.sidebar-hover-dark': {
          'background-color': 'rgba(255, 255, 255, 0.15)'
        },
        '.sidebar-border': {
          'border-color': 'rgba(255, 255, 255, 0.1)'
        },
        '.sidebar-border-bright': {
          'border-color': 'rgba(255, 255, 255, 0.15)'
        },
      });

      // === COMPONENTES BASE PARA ÁTOMOS ===
      addComponents({
        '.btn-base': {
          '@apply inline-flex items-center justify-center font-medium rounded-button transition-all duration-200 focus-ring': {}
        },
        '.btn-sm': {
          '@apply px-3 py-1.5 text-sm': {}
        },
        '.btn-md': {
          '@apply px-4 py-2 text-base': {}
        },
        '.btn-lg': {
          '@apply px-6 py-3 text-lg': {}
        },

        '.card-base': {
          '@apply bg-surface border border-theme rounded-card shadow-card': {}
        },

        '.sidebar-base': {
          '@apply flex flex-col h-screen relative overflow-hidden z-fixed transition-all duration-500 ease-smooth text-white shadow-sidebar': {}
        },
        '.sidebar-light': {
          '@apply sidebar-bg-light': {}
        },
        '.sidebar-dark': {
          '@apply sidebar-bg-dark': {}
        },
        '.sidebar-collapsed': {
          '@apply w-20 min-w-20': {}
        },
        '.sidebar-expanded': {
          '@apply sidebar-width': {}
        }
      });
    }
  ]
};