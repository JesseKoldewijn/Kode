/**
 * Keybinding System
 *
 * Public API for the keybinding system.
 *
 * @example
 * ```typescript
 * import {
 *   getKeybindingManager,
 *   loadKeybindingSettings,
 *   saveKeybindingSettings,
 *   getDisplayString,
 * } from '@/lib/keybindings';
 *
 * // Initialize with saved settings
 * const settings = await loadKeybindingSettings();
 * const manager = initKeybindingManager(settings);
 *
 * // Match keyboard events
 * document.addEventListener('keydown', (e) => {
 *   const match = manager.matchEvent(e);
 *   if (match) {
 *     e.preventDefault();
 *     handleAction(match.actionId);
 *   }
 * });
 *
 * // Get display string for a keybinding
 * const display = getDisplayString('ctrl+s'); // "Ctrl+S" or "⌘S" on Mac
 *
 * // Change preset
 * manager.setPreset('jetbrains');
 * await saveKeybindingSettings(manager.getSettings());
 * ```
 */

// Types
export type {
  ModifierKey,
  KeyCombo,
  KeyBinding,
  KeyBindingContext,
  Action,
  ActionCategory,
  PresetName,
  KeybindingSettings,
  KeybindingPreset,
  KeybindingChangeCallback,
  KeyMatchResult,
} from './types';

export { DEFAULT_SETTINGS } from './types';

// Actions
export { actions, actionsMap, getAction, getActionsByCategory, getCategories } from './actions';

// Presets
export {
  vscodePreset,
  cursorPreset,
  jetbrainsPreset,
  presets,
  getPreset,
  getPresetNames,
} from './presets';

// Manager
export {
  KeybindingManager,
  getKeybindingManager,
  initKeybindingManager,
  parseKeyString,
  keyComboToString,
  eventToKeyCombo,
  keyCombosMatch,
  getDisplayString,
} from './manager';

// Storage
export {
  loadKeybindingSettings,
  saveKeybindingSettings,
  resetKeybindingSettings,
  exportKeybindingSettings,
  importKeybindingSettings,
} from './storage';

// Events
export {
  subscribeToAction,
  emitAction,
  hasActionSubscribers,
  clearAllActionSubscribers,
} from './events';
