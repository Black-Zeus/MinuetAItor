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
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      output: {
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
    minify: 'esbuild',
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
      'echarts', 'echarts-for-react',
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
