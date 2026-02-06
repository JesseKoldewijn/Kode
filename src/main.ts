import { mount } from 'ripple';
import { App } from './App.ripple';
import { initTheme } from './lib/theme';
import './styles/global.css';

// Type declaration for the compile-time flag
declare const __ENABLE_MOCKS__: boolean;

/**
 * Check if we're running inside a Tauri application
 */
function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

/**
 * Bootstrap the Kode application
 *
 * This handles:
 * 1. Mock initialization (browser-only mode)
 * 2. Theme system initialization
 * 3. App mounting
 */
async function bootstrap(): Promise<void> {
  // CRITICAL: Only initialize mocks if:
  // 1. We're NOT in Tauri environment (runtime check)
  // 2. AND the compile-time flag is enabled (build check)
  const shouldInitMocks =
    !isTauriEnvironment() && typeof __ENABLE_MOCKS__ !== 'undefined' && __ENABLE_MOCKS__;

  if (shouldInitMocks) {
    console.log('[Kode] Initializing browser mock environment...');
    try {
      const { initializeMocks, verifyMockStatus } = await import('./lib/mocks');
      // Verify configuration before initializing
      verifyMockStatus();
      await initializeMocks();
    } catch (error) {
      console.warn('[Kode] Failed to initialize mocks:', error);
      // Continue anyway - some features may not work
    }
  } else {
    console.log('[Kode] Running in Tauri environment - skipping mock initialization', {
      isTauri: isTauriEnvironment(),
      enableMocksFlag: typeof __ENABLE_MOCKS__ !== 'undefined' ? __ENABLE_MOCKS__ : 'undefined',
    });

    // Verify that mocks are properly disabled in Tauri
    if (isTauriEnvironment()) {
      const { verifyMockStatus } = await import('./lib/mocks/verify');
      verifyMockStatus();
    }
  }

  // Initialize theme system
  initTheme();

  // Mount the app
  const target = document.getElementById('app');
  if (!target) {
    throw new Error('Could not find #app element to mount application');
  }

  mount(App, { target });
}

// Start the application
bootstrap().catch((error) => {
  console.error('[Kode] Failed to start application:', error);
  // Show error in the DOM for visibility
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div style="padding: 2rem; color: #f85149; font-family: monospace;">
        <h1>Failed to Start Kode</h1>
        <pre>${error.message || error}</pre>
      </div>
    `;
  }
});
