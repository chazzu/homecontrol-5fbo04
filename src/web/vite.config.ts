import { defineConfig } from 'vite'; // ^4.0.0
import react from '@vitejs/plugin-react-swc'; // ^3.0.0
import path from 'path';

// Vite configuration for Smart Home Dashboard
export default defineConfig({
  // React SWC plugin for fast compilation
  plugins: [
    react({
      // Use automatic JSX runtime for smaller bundle size
      jsxRuntime: 'automatic',
      // Enable TypeScript decorators
      tsDecorators: true,
    }),
  ],

  // Path aliases matching tsconfig.json
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@contexts': path.resolve(__dirname, 'src/contexts'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@config': path.resolve(__dirname, 'src/config'),
    },
  },

  // Production build configuration
  build: {
    // Target modern browsers
    target: 'esnext',
    // Output directory
    outDir: 'dist',
    // Assets directory within output
    assetsDir: 'assets',
    // Generate source maps for debugging
    sourcemap: true,
    // Enable minification
    minify: true,
    // Split CSS into separate files
    cssCodeSplit: true,
    // Rollup-specific options
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: {
          // Core React bundle
          vendor: ['react', 'react-dom'],
          // Home Assistant integration bundle
          'home-assistant': ['home-assistant-js-websocket'],
          // Styling bundle
          styling: ['styled-components'],
        },
      },
    },
  },

  // Development server configuration
  server: {
    // Development port
    port: 3000,
    // Fail if port is in use
    strictPort: true,
    // Listen on all network interfaces
    host: true,
    // Open browser on start
    open: true,
    // Hot Module Replacement settings
    hmr: {
      // Show error overlay
      overlay: true,
    },
  },
});