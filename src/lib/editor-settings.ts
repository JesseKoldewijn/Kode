/**
 * Editor Settings Management
 *
 * Manages editor configuration options like tab size and word wrap.
 * Persists settings to localStorage.
 * Uses the same pub/sub pattern as theme.ts and zoom.ts.
 */

const STORAGE_KEY = 'kode-editor-settings';

export interface EditorSettings {
  tabSize: 2 | 4;
  insertSpaces: boolean; // true = spaces, false = tabs
  wordWrap: boolean;
  autoSave: boolean;
  autoSaveDelay: number; // milliseconds
  autoClosingBrackets: boolean;
  autoClosingQuotes: boolean;
  autoIndent: boolean;
}

const DEFAULT_SETTINGS: EditorSettings = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: false,
  autoSave: false,
  autoSaveDelay: 1000,
  autoClosingBrackets: true,
  autoClosingQuotes: true,
  autoIndent: true,
};

// Current settings state
export let currentSettings: EditorSettings = { ...DEFAULT_SETTINGS };

// Callbacks for reactive updates
const listeners: Set<(settings: EditorSettings) => void> = new Set();

/**
 * Subscribe to editor settings changes
 */
export function subscribeToEditorSettings(
  callback: (settings: EditorSettings) => void
): () => void {
  listeners.add(callback);
  // Immediately call with current state
  callback({ ...currentSettings });
  return () => listeners.delete(callback);
}

function notifyListeners(): void {
  const snapshot = { ...currentSettings };
  listeners.forEach((cb) => cb(snapshot));
}

/**
 * Persist settings to localStorage
 */
function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  } catch (e) {
    console.warn('Failed to persist editor settings:', e);
  }
}

/**
 * Set tab size
 */
export function setTabSize(size: 2 | 4): void {
  currentSettings = { ...currentSettings, tabSize: size };
  persist();
  notifyListeners();
}

/**
 * Set whether to insert spaces or tabs
 */
export function setInsertSpaces(enabled: boolean): void {
  currentSettings = { ...currentSettings, insertSpaces: enabled };
  persist();
  notifyListeners();
}

/**
 * Set auto-closing brackets
 */
export function setAutoClosingBrackets(enabled: boolean): void {
  currentSettings = { ...currentSettings, autoClosingBrackets: enabled };
  persist();
  notifyListeners();
}

/**
 * Set auto-closing quotes
 */
export function setAutoClosingQuotes(enabled: boolean): void {
  currentSettings = { ...currentSettings, autoClosingQuotes: enabled };
  persist();
  notifyListeners();
}

/**
 * Set auto-indent
 */
export function setAutoIndent(enabled: boolean): void {
  currentSettings = { ...currentSettings, autoIndent: enabled };
  persist();
  notifyListeners();
}

/**
 * Set word wrap
 */
export function setWordWrap(enabled: boolean): void {
  currentSettings = { ...currentSettings, wordWrap: enabled };
  persist();
  notifyListeners();
}

/**
 * Toggle word wrap
 */
export function toggleWordWrap(): void {
  setWordWrap(!currentSettings.wordWrap);
}

/**
 * Set auto-save enabled/disabled
 */
export function setAutoSave(enabled: boolean): void {
  currentSettings = { ...currentSettings, autoSave: enabled };
  persist();
  notifyListeners();
}

/**
 * Set auto-save delay in milliseconds
 */
export function setAutoSaveDelay(delay: number): void {
  const clamped = Math.max(500, Math.min(30000, delay));
  currentSettings = { ...currentSettings, autoSaveDelay: clamped };
  persist();
  notifyListeners();
}

/**
 * Get current editor settings
 */
export function getEditorSettings(): EditorSettings {
  return { ...currentSettings };
}

/**
 * Initialize editor settings system
 * Call this once at app startup
 */
export function initEditorSettings(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        if (parsed.tabSize === 2 || parsed.tabSize === 4) {
          currentSettings.tabSize = parsed.tabSize;
        }
        if (typeof parsed.insertSpaces === 'boolean') {
          currentSettings.insertSpaces = parsed.insertSpaces;
        }
        if (typeof parsed.wordWrap === 'boolean') {
          currentSettings.wordWrap = parsed.wordWrap;
        }
        if (typeof parsed.autoSave === 'boolean') {
          currentSettings.autoSave = parsed.autoSave;
        }
        if (typeof parsed.autoSaveDelay === 'number' && parsed.autoSaveDelay >= 500) {
          currentSettings.autoSaveDelay = parsed.autoSaveDelay;
        }
        if (typeof parsed.autoClosingBrackets === 'boolean') {
          currentSettings.autoClosingBrackets = parsed.autoClosingBrackets;
        }
        if (typeof parsed.autoClosingQuotes === 'boolean') {
          currentSettings.autoClosingQuotes = parsed.autoClosingQuotes;
        }
        if (typeof parsed.autoIndent === 'boolean') {
          currentSettings.autoIndent = parsed.autoIndent;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load editor settings:', e);
  }

  notifyListeners();
}
