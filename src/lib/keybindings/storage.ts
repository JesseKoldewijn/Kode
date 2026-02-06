/**
 * Keybinding Storage
 *
 * Handles persisting keybinding settings using Tauri Store.
 * Falls back to localStorage in browser-only mode.
 */

import type { KeybindingSettings, PresetName } from './types';
import { DEFAULT_SETTINGS } from './types';

const STORE_KEY = 'keybinding-settings';
const STORE_FILE = 'keybindings.json';

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Validate keybinding settings structure
 */
function validateSettings(data: unknown): data is KeybindingSettings {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const settings = data as Record<string, unknown>;

  // Check preset
  if (
    typeof settings.preset !== 'string' ||
    !['vscode', 'cursor', 'jetbrains'].includes(settings.preset)
  ) {
    return false;
  }

  // Check customBindings
  if (typeof settings.customBindings !== 'object' || settings.customBindings === null) {
    return false;
  }

  // Check disabledBindings
  if (!Array.isArray(settings.disabledBindings)) {
    return false;
  }

  return true;
}

/**
 * Store options with defaults
 */
const STORE_OPTIONS = {
  defaults: {
    [STORE_KEY]: DEFAULT_SETTINGS,
  },
  autoSave: true,
};

/**
 * Tauri Store-based storage
 */
async function loadFromTauriStore(): Promise<KeybindingSettings | null> {
  try {
    const { load } = await import('@tauri-apps/plugin-store');
    const store = await load(STORE_FILE, STORE_OPTIONS);
    const data = await store.get<KeybindingSettings>(STORE_KEY);

    if (validateSettings(data)) {
      return data;
    }

    return null;
  } catch (error) {
    console.warn('Failed to load keybindings from Tauri Store:', error);
    return null;
  }
}

async function saveToTauriStore(settings: KeybindingSettings): Promise<boolean> {
  try {
    const { load } = await import('@tauri-apps/plugin-store');
    const store = await load(STORE_FILE, STORE_OPTIONS);
    await store.set(STORE_KEY, settings);
    await store.save();
    return true;
  } catch (error) {
    console.warn('Failed to save keybindings to Tauri Store:', error);
    return false;
  }
}

/**
 * localStorage-based storage (fallback)
 */
function loadFromLocalStorage(): KeybindingSettings | null {
  try {
    const data = localStorage.getItem(STORE_KEY);
    if (!data) {
      return null;
    }

    const parsed = JSON.parse(data);
    if (validateSettings(parsed)) {
      return parsed;
    }

    return null;
  } catch (error) {
    console.warn('Failed to load keybindings from localStorage:', error);
    return null;
  }
}

function saveToLocalStorage(settings: KeybindingSettings): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.warn('Failed to save keybindings to localStorage:', error);
    return false;
  }
}

/**
 * Load keybinding settings from storage
 * Uses Tauri Store in desktop mode, localStorage otherwise
 */
export async function loadKeybindingSettings(): Promise<KeybindingSettings> {
  if (isTauri()) {
    const settings = await loadFromTauriStore();
    if (settings) {
      return settings;
    }
  }

  // Fallback to localStorage
  const localSettings = loadFromLocalStorage();
  if (localSettings) {
    return localSettings;
  }

  // Return defaults
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save keybinding settings to storage
 * Uses Tauri Store in desktop mode, localStorage otherwise
 */
export async function saveKeybindingSettings(settings: KeybindingSettings): Promise<boolean> {
  if (isTauri()) {
    const success = await saveToTauriStore(settings);
    if (success) {
      return true;
    }
  }

  // Fallback to localStorage
  return saveToLocalStorage(settings);
}

/**
 * Reset keybinding settings to defaults
 */
export async function resetKeybindingSettings(preset?: PresetName): Promise<KeybindingSettings> {
  const settings: KeybindingSettings = {
    preset: preset ?? DEFAULT_SETTINGS.preset,
    customBindings: {},
    disabledBindings: [],
  };

  await saveKeybindingSettings(settings);
  return settings;
}

/**
 * Export keybinding settings as JSON string (for backup/sharing)
 */
export function exportKeybindingSettings(settings: KeybindingSettings): string {
  return JSON.stringify(settings, null, 2);
}

/**
 * Import keybinding settings from JSON string
 */
export function importKeybindingSettings(json: string): KeybindingSettings | null {
  try {
    const parsed = JSON.parse(json);
    if (validateSettings(parsed)) {
      return parsed;
    }
    console.warn('Invalid keybinding settings format');
    return null;
  } catch (error) {
    console.warn('Failed to parse keybinding settings JSON:', error);
    return null;
  }
}
