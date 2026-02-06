/**
 * Keybinding Manager
 *
 * Core manager for handling keyboard shortcuts, matching events to actions,
 * and managing keybinding configurations.
 */

import type {
  KeyCombo,
  KeyBindingContext,
  KeybindingSettings,
  KeybindingChangeCallback,
  KeyMatchResult,
  PresetName,
} from './types';
import { DEFAULT_SETTINGS } from './types';
import { actions, actionsMap, getAction } from './actions';
import { getPreset } from './presets';

/**
 * Detect if running on macOS
 */
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * Parse a key string (e.g., 'ctrl+shift+s') into a KeyCombo
 */
export function parseKeyString(keyString: string): KeyCombo {
  const combo: KeyCombo = {
    key: '',
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  };

  if (!keyString) {
    return combo;
  }

  const parts = keyString.toLowerCase().split('+');

  for (const part of parts) {
    switch (part) {
      case 'ctrl':
      case 'control':
        combo.ctrl = true;
        break;
      case 'alt':
      case 'option':
        combo.alt = true;
        break;
      case 'shift':
        combo.shift = true;
        break;
      case 'meta':
      case 'cmd':
      case 'command':
      case 'win':
      case 'super':
        combo.meta = true;
        break;
      default:
        // Last non-modifier part is the key
        combo.key = part;
    }
  }

  return combo;
}

/**
 * Convert a KeyCombo back to a string representation
 */
export function keyComboToString(combo: KeyCombo): string {
  const parts: string[] = [];

  if (combo.ctrl) parts.push('ctrl');
  if (combo.alt) parts.push('alt');
  if (combo.shift) parts.push('shift');
  if (combo.meta) parts.push(isMac ? 'cmd' : 'meta');
  if (combo.key) parts.push(combo.key);

  return parts.join('+');
}

/**
 * Map event.code values to normalized key names for consistent keybinding matching
 */
const CODE_TO_KEY_MAP: Record<string, string> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};

/**
 * Convert a keyboard event to a KeyCombo
 */
export function eventToKeyCombo(event: KeyboardEvent): KeyCombo {
  // For special keys that have inconsistent event.key values, use event.code
  let key = event.key.toLowerCase();

  // Handle special cases using event.code for consistency
  if (event.code && CODE_TO_KEY_MAP[event.code]) {
    key = CODE_TO_KEY_MAP[event.code];
  }

  return {
    key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

/**
 * Check if two key combos match
 */
export function keyCombosMatch(a: KeyCombo, b: KeyCombo): boolean {
  return (
    a.key === b.key &&
    a.ctrl === b.ctrl &&
    a.alt === b.alt &&
    a.shift === b.shift &&
    a.meta === b.meta
  );
}

/**
 * Get a human-readable display string for a key combo
 */
export function getDisplayString(keyString: string): string {
  if (!keyString) return '';

  const combo = parseKeyString(keyString);
  const parts: string[] = [];

  if (isMac) {
    if (combo.ctrl) parts.push('⌃');
    if (combo.alt) parts.push('⌥');
    if (combo.shift) parts.push('⇧');
    if (combo.meta) parts.push('⌘');
  } else {
    if (combo.ctrl) parts.push('Ctrl');
    if (combo.alt) parts.push('Alt');
    if (combo.shift) parts.push('Shift');
    if (combo.meta) parts.push('Win');
  }

  // Format the main key
  if (combo.key) {
    const keyDisplay = formatKeyDisplay(combo.key);
    parts.push(keyDisplay);
  }

  return isMac ? parts.join('') : parts.join('+');
}

/**
 * Format a key for display
 */
function formatKeyDisplay(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    space: 'Space',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
    enter: '↵',
    return: '↵',
    escape: 'Esc',
    esc: 'Esc',
    tab: 'Tab',
    backspace: '⌫',
    delete: 'Del',
    insert: 'Ins',
    home: 'Home',
    end: 'End',
    pageup: 'PgUp',
    pagedown: 'PgDn',
    '`': '`',
  };

  const lower = key.toLowerCase();
  if (keyMap[lower]) {
    return keyMap[lower];
  }

  // Capitalize single letters and function keys
  if (key.length === 1) {
    return key.toUpperCase();
  }

  if (/^f\d+$/i.test(key)) {
    return key.toUpperCase();
  }

  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Keybinding Manager Class
 *
 * Manages keybindings, matches keyboard events to actions,
 * and handles user customizations.
 */
export class KeybindingManager {
  private settings: KeybindingSettings;
  private listeners: Set<KeybindingChangeCallback> = new Set();
  private computedBindings: Map<string, string> = new Map(); // actionId -> keyString
  private reverseBindings: Map<string, string> = new Map(); // keyString -> actionId

  constructor(settings?: KeybindingSettings) {
    // Deep clone settings to avoid mutating defaults
    this.settings = settings
      ? {
          preset: settings.preset,
          customBindings: { ...settings.customBindings },
          disabledBindings: [...settings.disabledBindings],
        }
      : {
          preset: DEFAULT_SETTINGS.preset,
          customBindings: {},
          disabledBindings: [],
        };
    this.recomputeBindings();
  }

  /**
   * Recompute the binding maps from current settings
   */
  private recomputeBindings(): void {
    this.computedBindings.clear();
    this.reverseBindings.clear();

    // Get base preset bindings
    const preset = getPreset(this.settings.preset);

    // Apply preset bindings
    for (const [actionId, binding] of Object.entries(preset.bindings)) {
      const keyString = typeof binding === 'string' ? binding : binding.key;
      if (keyString && !this.settings.disabledBindings.includes(actionId)) {
        this.computedBindings.set(actionId, keyString);
      }
    }

    // Apply custom bindings (override preset)
    for (const [actionId, keyString] of Object.entries(this.settings.customBindings)) {
      if (keyString && !this.settings.disabledBindings.includes(actionId)) {
        this.computedBindings.set(actionId, keyString);
      } else if (!keyString) {
        // Empty string means explicitly unbound
        this.computedBindings.delete(actionId);
      }
    }

    // Build reverse lookup (keyString -> actionId)
    for (const [actionId, keyString] of this.computedBindings) {
      // Normalize for Mac: also add cmd version for ctrl shortcuts
      if (isMac) {
        const macKey = this.getMacBinding(actionId);
        if (macKey) {
          this.reverseBindings.set(this.normalizeKeyString(macKey), actionId);
        }
      }
      this.reverseBindings.set(this.normalizeKeyString(keyString), actionId);
    }
  }

  /**
   * Get Mac-specific binding for an action if available
   */
  private getMacBinding(actionId: string): string | undefined {
    const action = getAction(actionId);
    if (action?.defaultBinding.mac) {
      return action.defaultBinding.mac;
    }

    // Check custom bindings
    const custom = this.settings.customBindings[actionId];
    if (custom) {
      return custom;
    }

    // Check preset bindings
    const preset = getPreset(this.settings.preset);
    const binding = preset.bindings[actionId];
    if (typeof binding === 'object' && binding.mac) {
      return binding.mac;
    }

    return undefined;
  }

  /**
   * Normalize a key string for comparison
   */
  private normalizeKeyString(keyString: string): string {
    const combo = parseKeyString(keyString);
    const parts: string[] = [];

    // Use consistent order for modifiers
    if (combo.ctrl) parts.push('ctrl');
    if (combo.alt) parts.push('alt');
    if (combo.shift) parts.push('shift');
    if (combo.meta) parts.push('meta');
    if (combo.key) parts.push(combo.key.toLowerCase());

    return parts.join('+');
  }

  /**
   * Match a keyboard event to an action
   */
  matchEvent(event: KeyboardEvent, context?: KeyBindingContext): KeyMatchResult | null {
    const combo = eventToKeyCombo(event);

    // Skip if only modifier keys are pressed
    if (['control', 'alt', 'shift', 'meta', 'os'].includes(combo.key)) {
      return null;
    }

    const keyString = this.normalizeKeyString(keyComboToString(combo));
    const actionId = this.reverseBindings.get(keyString);

    if (!actionId) {
      return null;
    }

    const action = actionsMap.get(actionId);
    if (!action) {
      return null;
    }

    // Check context if specified
    if (context && action.defaultBinding.when && action.defaultBinding.when !== 'always') {
      if (action.defaultBinding.when !== context) {
        return null;
      }
    }

    return { actionId, action };
  }

  /**
   * Get the current keybinding for an action
   */
  getBinding(actionId: string): string | undefined {
    return this.computedBindings.get(actionId);
  }

  /**
   * Get the display string for an action's keybinding
   */
  getBindingDisplay(actionId: string): string {
    const binding = this.getBinding(actionId);
    return binding ? getDisplayString(binding) : '';
  }

  /**
   * Set a custom keybinding for an action
   */
  setBinding(actionId: string, keyString: string): void {
    // Check for conflicts
    const normalizedKey = this.normalizeKeyString(keyString);
    const existingAction = this.reverseBindings.get(normalizedKey);

    if (existingAction && existingAction !== actionId) {
      // Remove binding from conflicting action
      this.settings.customBindings[existingAction] = '';
    }

    this.settings.customBindings[actionId] = keyString;
    this.recomputeBindings();
    this.notifyListeners();
  }

  /**
   * Remove a custom keybinding (revert to preset default)
   */
  resetBinding(actionId: string): void {
    delete this.settings.customBindings[actionId];
    this.settings.disabledBindings = this.settings.disabledBindings.filter((id) => id !== actionId);
    this.recomputeBindings();
    this.notifyListeners();
  }

  /**
   * Disable a keybinding (unbind)
   */
  disableBinding(actionId: string): void {
    if (!this.settings.disabledBindings.includes(actionId)) {
      this.settings.disabledBindings.push(actionId);
    }
    this.recomputeBindings();
    this.notifyListeners();
  }

  /**
   * Get the current preset
   */
  getPreset(): PresetName {
    return this.settings.preset;
  }

  /**
   * Change to a different preset
   */
  setPreset(preset: PresetName): void {
    this.settings.preset = preset;
    this.recomputeBindings();
    this.notifyListeners();
  }

  /**
   * Reset all bindings to preset defaults
   */
  resetToPreset(preset?: PresetName): void {
    if (preset) {
      this.settings.preset = preset;
    }
    this.settings.customBindings = {};
    this.settings.disabledBindings = [];
    this.recomputeBindings();
    this.notifyListeners();
  }

  /**
   * Get all bindings as a map
   */
  getAllBindings(): Map<string, string> {
    return new Map(this.computedBindings);
  }

  /**
   * Get all actions with their current bindings
   */
  getAllActionsWithBindings(): Array<{
    id: string;
    label: string;
    category: string;
    description?: string;
    binding: string;
    isCustom: boolean;
    isDisabled: boolean;
  }> {
    return actions.map((action) => ({
      id: action.id,
      label: action.label,
      category: action.category,
      description: action.description,
      binding: this.computedBindings.get(action.id) ?? '',
      isCustom: action.id in this.settings.customBindings,
      isDisabled: this.settings.disabledBindings.includes(action.id),
    }));
  }

  /**
   * Get current settings (for persistence)
   */
  getSettings(): KeybindingSettings {
    return { ...this.settings };
  }

  /**
   * Load settings (from persistence)
   */
  loadSettings(settings: KeybindingSettings): void {
    this.settings = { ...settings };
    this.recomputeBindings();
    this.notifyListeners();
  }

  /**
   * Subscribe to keybinding changes
   */
  subscribe(callback: KeybindingChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of a change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

/**
 * Singleton instance of the keybinding manager
 */
let managerInstance: KeybindingManager | null = null;

/**
 * Get the singleton keybinding manager
 */
export function getKeybindingManager(): KeybindingManager {
  if (!managerInstance) {
    managerInstance = new KeybindingManager();
  }
  return managerInstance;
}

/**
 * Initialize the keybinding manager with settings
 */
export function initKeybindingManager(settings?: KeybindingSettings): KeybindingManager {
  managerInstance = new KeybindingManager(settings);
  return managerInstance;
}
