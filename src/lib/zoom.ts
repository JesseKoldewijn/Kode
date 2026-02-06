/**
 * Zoom/Font Size Management
 *
 * Manages editor font size with zoom in/out/reset controls.
 * Persists zoom level to localStorage.
 * Applies font size via CSS custom property --editor-font-size.
 */

const STORAGE_KEY = 'kode-zoom';
const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;
const ZOOM_STEP = 1;

// Current zoom state
export let currentFontSize: number = DEFAULT_FONT_SIZE;

// Callbacks for reactive updates
const listeners: Set<(fontSize: number) => void> = new Set();

/**
 * Subscribe to zoom/font size changes
 */
export function subscribeToZoom(callback: (fontSize: number) => void): () => void {
  listeners.add(callback);
  // Immediately call with current state
  callback(currentFontSize);
  return () => listeners.delete(callback);
}

function notifyListeners(): void {
  listeners.forEach((cb) => cb(currentFontSize));
}

/**
 * Apply font size to the document via CSS custom property
 */
function applyFontSize(size: number): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
}

/**
 * Persist font size to localStorage
 */
function persist(size: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(size));
  } catch (e) {
    console.warn('Failed to persist zoom level:', e);
  }
}

/**
 * Set the editor font size directly
 */
export function setFontSize(size: number): void {
  const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
  currentFontSize = clamped;
  applyFontSize(clamped);
  persist(clamped);
  notifyListeners();
}

/**
 * Zoom in (increase font size by step)
 */
export function zoomIn(): void {
  setFontSize(currentFontSize + ZOOM_STEP);
}

/**
 * Zoom out (decrease font size by step)
 */
export function zoomOut(): void {
  setFontSize(currentFontSize - ZOOM_STEP);
}

/**
 * Reset zoom to default font size
 */
export function resetZoom(): void {
  setFontSize(DEFAULT_FONT_SIZE);
}

/**
 * Get the current zoom percentage relative to default
 */
export function getZoomPercentage(): number {
  return Math.round((currentFontSize / DEFAULT_FONT_SIZE) * 100);
}

/**
 * Initialize zoom system
 * Call this once at app startup
 */
export function initZoom(): void {
  // Load saved preference
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = Number(saved);
      if (!isNaN(parsed) && parsed >= MIN_FONT_SIZE && parsed <= MAX_FONT_SIZE) {
        currentFontSize = parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load zoom level:', e);
  }

  // Apply initial font size
  applyFontSize(currentFontSize);
  notifyListeners();
}

// Export constants for tests and settings UI
export { DEFAULT_FONT_SIZE, MIN_FONT_SIZE, MAX_FONT_SIZE, ZOOM_STEP };
