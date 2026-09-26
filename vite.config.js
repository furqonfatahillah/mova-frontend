import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // Use automatic JSX runtime for smaller bundle
      jsxRuntime: 'automatic',
      // Babel plugins for production optimization
      babel: {
        plugins: process.env.NODE_ENV === 'production'
          ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
          : [],
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    // Inline assets under 8KB to reduce HTTP requests
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 800,
    minify: 'esbuild',
    // Drop console.log in production builds
    esbuild: {
      drop: ['debugger'],
      legalComments: 'none',
    },
    rollupOptions: {
      output: {
        // Aggressive code-splitting for parallel loading
        manualChunks(id) {
          // Heavy export libraries — load only when user exports
          if (id.includes('node_modules/exceljs')) return 'vendor-exceljs';
          if (id.includes('node_modules/xlsx')) return 'vendor-xlsx';

          // SweetAlert2 — used sparingly for confirm dialogs
          if (id.includes('node_modules/sweetalert2')) return 'vendor-swal';

          // Core React runtime
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor-react';

          // Router — loaded on initial navigation
          if (id.includes('node_modules/react-router') || id.includes('node_modules/react-router-dom/')) return 'vendor-router';

          // Icons — can be large
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';

          // Lightweight utilities
          if (id.includes('node_modules/axios') || id.includes('node_modules/react-hot-toast')) return 'vendor-utils';
        },
        // Use standard flat assets path for optimal CDN and server routing compatibility
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    // Enable dependency pre-bundling for dev speed
    warmup: {
      clientFiles: [
        './src/App.jsx',
        './src/components/Layout.jsx',
        './src/components/ui.jsx',
        './src/context/OutletContext.jsx',
      ],
    },
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'react-hot-toast',
      'lucide-react',
    ],
    // Exclude heavy libs from pre-bundle — they get their own chunks
    exclude: ['exceljs'],
  },
});
