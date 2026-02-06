/**
 * Theme Management System
 *
 * Supports: system, light, dark themes
 * Persists user preference to localStorage
 * Listens for system preference changes
 */

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeConfig {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
}

const STORAGE_KEY = 'kode-theme';

// Current theme state (plain variables - components use track() locally)
export let currentMode: ThemeMode = 'system';
export let resolvedTheme: 'light' | 'dark' = 'dark';

// Callbacks for reactive updates
const listeners: Set<(config: ThemeConfig) => void> = new Set();

export function subscribe(callback: (config: ThemeConfig) => void): () => void {
  listeners.add(callback);
  // Immediately call with current state
  callback({ mode: currentMode, resolvedTheme });
  return () => listeners.delete(callback);
}

function notifyListeners(): void {
  const config: ThemeConfig = { mode: currentMode, resolvedTheme };
  listeners.forEach((cb) => cb(config));
}

/**
 * Get the system's preferred color scheme
 */
function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Resolve the actual theme based on mode
 */
function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return getSystemPreference();
  }
  return mode;
}

/**
 * Apply theme to document
 */
function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Remove existing theme classes
  root.classList.remove('light', 'dark');

  // Add new theme class
  root.classList.add(theme);

  // Also set data attribute for CSS selectors
  root.setAttribute('data-theme', theme);

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#ffffff');
  }
}

/**
 * Set theme mode and persist
 */
export function setTheme(mode: ThemeMode): void {
  currentMode = mode;
  resolvedTheme = resolveTheme(mode);

  // Persist to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (e) {
    console.warn('Failed to persist theme preference:', e);
  }

  applyTheme(resolvedTheme);
  notifyListeners();
}

/**
 * Get current theme config
 */
export function getTheme(): ThemeConfig {
  return { mode: currentMode, resolvedTheme };
}

/**
 * Initialize theme system
 * Call this once at app startup
 */
export function initTheme(): void {
  // Load saved preference
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved && ['system', 'light', 'dark'].includes(saved)) {
      currentMode = saved;
    }
  } catch (e) {
    console.warn('Failed to load theme preference:', e);
  }

  // Resolve and apply
  resolvedTheme = resolveTheme(currentMode);
  applyTheme(resolvedTheme);

  // Listen for system preference changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

    const handleChange = () => {
      if (currentMode === 'system') {
        resolvedTheme = getSystemPreference();
        applyTheme(resolvedTheme);
        notifyListeners();
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }
  }

  notifyListeners();
}

/**
 * Toggle between light and dark (skips system)
 */
export function toggleTheme(): void {
  const newMode = resolvedTheme === 'dark' ? 'light' : 'dark';
  setTheme(newMode);
}

/**
 * Cycle through: system -> light -> dark -> system
 */
export function cycleTheme(): void {
  const modes: ThemeMode[] = ['system', 'light', 'dark'];
  const currentIndex = modes.indexOf(currentMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  setTheme(modes[nextIndex]);
}
