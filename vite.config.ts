import { defineConfig } from 'vite';
import { ripple } from '@ripple-ts/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const isTauri = !!process.env.TAURI_ENV_PLATFORM;

// Log environment detection for debugging
console.log('[Vite Config] Environment:', {
  isTauri,
  TAURI_ENV_PLATFORM: process.env.TAURI_ENV_PLATFORM,
  enableMocks: !isTauri,
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [ripple(), tailwindcss()],

  // Define compile-time constants for conditional code
  define: {
    // Enable mocks ONLY when NOT in Tauri environment
    // This will be replaced at build/dev time with a boolean literal
    __ENABLE_MOCKS__: JSON.stringify(!isTauri),
  },

  // Vite options tailored for Tauri development
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
      usePolling: true,
      interval: 1000,
    },
  },

  // Build configuration
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari14',
    // Don't minify for debug builds - use oxc for production (rolldown-vite compatible)
    minify: process.env.TAURI_ENV_DEBUG ? false : 'oxc',
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      // In Tauri builds, we can optimize by excluding mock-related code
      treeshake: {
        moduleSideEffects: (id) => {
          // Ensure mocks have no side effects in Tauri builds
          if (isTauri && id.includes('/mocks/')) {
            return false;
          }
          return true;
        },
      },
      output: {
        manualChunks: (id: string) => {
          // Split Monaco editor into its own chunk (but not workers)
          if (id.includes('monaco-editor') && !id.includes('editor.worker')) {
            return 'monaco';
          }
          // Split xterm.js into its own chunk
          if (id.includes('@xterm/')) {
            return 'xterm';
          }
        },
      },
    },
  },

  // Env prefix for Tauri
  envPrefix: ['VITE_', 'TAURI_ENV_*'],

  // Optimize dependencies
  optimizeDeps: {
    include: ['monaco-editor'],
  },

  // Resolve configuration for Monaco workers
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
