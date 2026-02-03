import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'
import path from 'path';

export default defineConfig({
  plugins: [react(),
    tailwindcss(),],

  server: {
    host: process.env.VITE_FRONTEND_HOST || '0.0.0.0',
    port: parseInt(process.env.VITE_FRONTEND_PORT) || 3000,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      // FALLBACK - Main API (debe ir AL FINAL)
      '/api': {
        target: process.env.VITE_FRONTEND_API_URL || 'http://backend-api:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('🔴 [Main API] Proxy error:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('🔗 [Main API] Proxying:', req.method, req.url, '→', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('🔗 [Main API] Response:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@components': path.resolve(__dirname, './src/components'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@helpers': path.resolve(__dirname, './src/helpers'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@config': path.resolve(__dirname, './src/config')
    },
  },

  css: {
    postcss: './postcss.config.js',
  },

  // ====================================
  // OPTIMIZACIÓN DE BUILD MEJORADA PARA TU PROYECTO ACTUAL
  // ====================================
  build: {
    sourcemap: true,

    // Configuración de chunks optimizada para tus archivos existentes
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ====================================
          // VENDOR CHUNKS - Librerías externas
          // ====================================

          // React ecosystem
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }

          // Router
          if (id.includes('node_modules/react-router') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-router';
          }

          // HTTP y servicios
          if (id.includes('node_modules/axios')) {
            return 'vendor-http';
          }

          // EXPORTERS - Librerías de exportación
          if (id.includes('node_modules/xlsx') ||
            id.includes('node_modules/exceljs') ||
            id.includes('node_modules/pdfmake') ||
            id.includes('node_modules/file-saver')) {
            return 'vendor-exporters';
          }

          // Iconos (lucide-react que veo en tu modal)
          if (id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/@heroicons') ||
            id.includes('node_modules/@tabler/icons')) {
            return 'vendor-icons';
          }

          // Estado global (Zustand que veo que usas)
          if (id.includes('node_modules/zustand') ||
            id.includes('node_modules/immer')) {
            return 'vendor-state';
          }

          // Utilidades comunes
          if (id.includes('node_modules/lodash') ||
            id.includes('node_modules/date-fns') ||
            id.includes('node_modules/dayjs') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/classnames')) {
            return 'vendor-utils';
          }

          // Otras librerías de node_modules
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }

          // ====================================
          // CHUNKS BASADOS EN TUS ARCHIVOS EXISTENTES
          // ====================================

          // Auth pages (tienes Login)
          if (id.includes('/pages/auth/')) {
            return 'pages-auth';
          }

          // Modal system (tienes un sistema completo de modales)
          if (id.includes('/components/ui/modal/')) {
            return 'components-modal';
          }

          // Layout components (tienes header, breadcrumb, etc.)
          if (id.includes('/components/layout/')) {
            return 'components-layout';
          }

          // Demos (tienes ModalDemo)
          if (id.includes('/demos/') || id.includes('/demo')) {
            return 'demos';
          }

          // Services (tienes authService)
          if (id.includes('/services/')) {
            return 'services';
          }

          // Store (tienes authStore)
          if (id.includes('/store/')) {
            return 'store';
          }

          // Utils y helpers
          if (id.includes('/utils/') || id.includes('/helpers/')) {
            return 'utils';
          }

          // Constants
          if (id.includes('/constants/')) {
            return 'constants';
          }

          // Hooks
          if (id.includes('/hooks/')) {
            return 'hooks';
          }

          // Default: return undefined para que Vite maneje automáticamente
          return undefined;
        },

        // Configuración de nombres de archivos
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.').pop();
          if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(extType)) {
            return `images/[name]-[hash][extname]`;
          }
          if (/css/i.test(extType)) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        entryFileNames: 'js/[name]-[hash].js'
      }
    },

    // ====================================
    // CONFIGURACIÓN DE TAMAÑO Y MINIFICACIÓN
    // ====================================

    chunkSizeWarningLimit: 1000,

    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.info', 'console.debug', 'console.warn'],
        passes: 2,
        dead_code: true,
        unused: true,
        conditionals: true,
        evaluate: true,
        booleans: true,
        loops: true,
        inline: true,
        hoist_funs: true,
        collapse_vars: true,
        reduce_vars: true,
        keep_fnames: process.env.NODE_ENV !== 'production',
        keep_classnames: process.env.NODE_ENV !== 'production'
      },

      mangle: {
        keep_fnames: process.env.NODE_ENV !== 'production',
        keep_classnames: process.env.NODE_ENV !== 'production',
        toplevel: true,
        safari10: true
      },

      format: {
        comments: false,
        beautify: false,
        safari10: true,
        webkit: true
      }
    },

    target: [
      'es2020',
      'chrome80',
      'firefox78',
      'safari14',
      'edge88'
    ],

    cssTarget: 'chrome80',
    assetsDir: 'assets',
    assetsInlineLimit: 4096
  },

  // ====================================
  // OPTIMIZACIÓN DE DEPENDENCIAS - INCLUYE EXPORTERS
  // ====================================

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'zustand', // Veo que usas Zustand en tu authStore
      'lucide-react', // Veo que usas Lucide en tu modal system
      // AGREGAR DEPENDENCIAS DEL EXPORTER
      'xlsx',
      'exceljs',
      'pdfmake',
      'file-saver'
    ],

    esbuildOptions: {
      target: 'es2020',
      jsx: 'automatic',
      jsxDev: process.env.NODE_ENV === 'development',
      treeShaking: true,
      minify: process.env.NODE_ENV === 'production',
      define: {
        global: 'globalThis',
      },
      keepNames: process.env.NODE_ENV === 'development'
    }
  },

  esbuild: {
    target: 'es2020',
    jsx: 'automatic',
    jsxDev: process.env.NODE_ENV === 'development',
    drop: process.env.NODE_ENV === 'production' ?
      ['console', 'debugger'] : [],
    sourcemap: true,
    keepNames: process.env.NODE_ENV === 'development'
  },

  // ====================================
  // VARIABLES DE ENTORNO Y DEFINE
  // ====================================

  define: {
    __DEV__: process.env.NODE_ENV === 'development',
    __PROD__: process.env.NODE_ENV === 'production',
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  },

  // ====================================
  // CONFIGURACIÓN ADICIONAL
  // ====================================

  json: {
    namedExports: true,
    stringify: false
  },

  logLevel: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
  cacheDir: 'node_modules/.vite',
  base: process.env.VITE_BASE_URL || '/'
});