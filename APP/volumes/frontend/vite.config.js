import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    host: process.env.VITE_FRONTEND_HOST || '0.0.0.0',
    port: parseInt(process.env.VITE_FRONTEND_PORT) || 3000,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      // Intercepta /api/* y lo reescribe quitando solo /api,
      // manteniendo el /v1 que viene en el path del endpoint.
      // Ej: /api/v1/auth/login → /v1/auth/login → backend:8000
      '/api': {
        target: process.env.VITE_FRONTEND_API_URL || 'http://backend:8000',
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
      },
    },
  },

  resolve: {
    alias: {
      '@':           path.resolve(__dirname, './src'),
      '@assets':     path.resolve(__dirname, './src/assets'),
      '@components': path.resolve(__dirname, './src/components'),
      '@constants':  path.resolve(__dirname, './src/constants'),
      '@helpers':    path.resolve(__dirname, './src/helpers'),
      '@hooks':      path.resolve(__dirname, './src/hooks'),
      '@pages':      path.resolve(__dirname, './src/pages'),
      '@routes':     path.resolve(__dirname, './src/routes'),
      '@services':   path.resolve(__dirname, './src/services'),
      '@store':      path.resolve(__dirname, './src/store'),
      '@utils':      path.resolve(__dirname, './src/utils'),
      '@config':     path.resolve(__dirname, './src/config'),
      '@data':       path.resolve(__dirname, './src/data'),
    },
  },

  css: {
    postcss: './postcss.config.js',
  },

  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/react-router')) return 'vendor-router';
          if (id.includes('node_modules/axios'))        return 'vendor-http';
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/exceljs') ||
              id.includes('node_modules/pdfmake') || id.includes('node_modules/file-saver')) return 'vendor-exporters';
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/@heroicons') ||
              id.includes('node_modules/@tabler/icons')) return 'vendor-icons';
          if (id.includes('node_modules/zustand') || id.includes('node_modules/immer')) return 'vendor-state';
          if (id.includes('node_modules/lodash') || id.includes('node_modules/date-fns') ||
              id.includes('node_modules/dayjs') || id.includes('node_modules/clsx') ||
              id.includes('node_modules/classnames')) return 'vendor-utils';
          if (id.includes('node_modules')) return 'vendor-misc';

          if (id.includes('/pages/auth/'))        return 'pages-auth';
          if (id.includes('/components/ui/modal/')) return 'components-modal';
          if (id.includes('/components/layout/')) return 'components-layout';
          if (id.includes('/demos/') || id.includes('/demo')) return 'demos';
          if (id.includes('/services/'))          return 'services';
          if (id.includes('/store/'))             return 'store';
          if (id.includes('/utils/') || id.includes('/helpers/')) return 'utils';
          if (id.includes('/constants/'))         return 'constants';
          if (id.includes('/hooks/'))             return 'hooks';

          return undefined;
        },
        chunkFileNames:  'js/[name]-[hash].js',
        entryFileNames:  'js/[name]-[hash].js',
        assetFileNames:  (assetInfo) => {
          const ext = assetInfo.name.split('.').pop();
          if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(ext)) return 'images/[name]-[hash][extname]';
          if (/css/i.test(ext))                                   return 'css/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },

    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console:    process.env.NODE_ENV === 'production',
        drop_debugger:   true,
        pure_funcs:      ['console.info', 'console.debug', 'console.warn'],
        passes:          2,
        dead_code:       true,
        unused:          true,
        conditionals:    true,
        evaluate:        true,
        booleans:        true,
        loops:           true,
        inline:          true,
        hoist_funs:      true,
        collapse_vars:   true,
        reduce_vars:     true,
        keep_fnames:     process.env.NODE_ENV !== 'production',
        keep_classnames: process.env.NODE_ENV !== 'production',
      },
      mangle: {
        keep_fnames:     process.env.NODE_ENV !== 'production',
        keep_classnames: process.env.NODE_ENV !== 'production',
        toplevel:        true,
        safari10:        true,
      },
      format: {
        comments:  false,
        beautify:  false,
        safari10:  true,
        webkit:    true,
      },
    },

    target:             ['es2020', 'chrome80', 'firefox78', 'safari14', 'edge88'],
    cssTarget:          'chrome80',
    assetsDir:          'assets',
    assetsInlineLimit:  4096,
  },

  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-router-dom',
      'axios', 'zustand', 'lucide-react',
      'xlsx', 'exceljs', 'pdfmake', 'file-saver',
    ],
    esbuildOptions: {
      target:      'es2020',
      jsx:         'automatic',
      jsxDev:      process.env.NODE_ENV === 'development',
      treeShaking: true,
      minify:      process.env.NODE_ENV === 'production',
      define:      { global: 'globalThis' },
      keepNames:   process.env.NODE_ENV === 'development',
    },
  },

  esbuild: {
    target:    'es2020',
    jsx:       'automatic',
    jsxDev:    process.env.NODE_ENV === 'development',
    drop:      process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    sourcemap: true,
    keepNames: process.env.NODE_ENV === 'development',
  },

  define: {
    __DEV__:        process.env.NODE_ENV === 'development',
    __PROD__:       process.env.NODE_ENV === 'production',
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __VERSION__:    JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },

  json:      { namedExports: true, stringify: false },
  logLevel:  process.env.NODE_ENV === 'development' ? 'info' : 'warn',
  cacheDir:  'node_modules/.vite',
  base:      process.env.VITE_BASE_URL || '/',
});