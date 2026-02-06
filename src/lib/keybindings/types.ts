/**
 * Keybinding System Types
 *
 * Defines the structure for keybindings, actions, and presets.
 */

/**
 * Modifier keys that can be combined with regular keys
 */
export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';

/**
 * A parsed key combination
 */
export interface KeyCombo {
  key: string; // The main key (lowercase)
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean; // Cmd on Mac, Win on Windows
}

/**
 * A keybinding definition
 */
export interface KeyBinding {
  /** The key combination string (e.g., 'ctrl+s', 'cmd+shift+p') */
  key: string;
  /** Optional Mac-specific binding (uses Cmd instead of Ctrl) */
  mac?: string;
  /** Optional context when this binding is active */
  when?: KeyBindingContext;
}

/**
 * Context conditions for when a keybinding should be active
 */
export type KeyBindingContext =
  | 'editorFocus'
  | 'editorTextFocus'
  | 'inputFocus'
  | 'terminalFocus'
  | 'sidebarFocus'
  | 'panelFocus'
  | 'dialogOpen'
  | 'commandPaletteOpen'
  | 'always';

/**
 * An action that can be triggered by a keybinding
 */
export interface Action {
  /** Unique identifier (e.g., 'editor.save', 'view.commandPalette') */
  id: string;
  /** Display label for the action */
  label: string;
  /** Category for grouping in settings UI */
  category: ActionCategory;
  /** Description of what the action does */
  description?: string;
  /** Default keybinding for this action */
  defaultBinding: KeyBinding;
}

/**
 * Categories for organizing actions
 */
export type ActionCategory =
  | 'File'
  | 'Edit'
  | 'View'
  | 'Editor'
  | 'Navigation'
  | 'Terminal'
  | 'Chat'
  | 'Debug'
  | 'Help';

/**
 * Available keybinding presets
 */
export type PresetName = 'vscode' | 'cursor' | 'jetbrains';

/**
 * User's keybinding settings
 */
export interface KeybindingSettings {
  /** The base preset to use */
  preset: PresetName;
  /** Custom bindings that override the preset (actionId -> keyString) */
  customBindings: Record<string, string>;
  /** Actions that have been explicitly unbound */
  disabledBindings: string[];
}

/**
 * A preset definition containing all keybindings
 */
export interface KeybindingPreset {
  /** Name of the preset */
  name: PresetName;
  /** Display name */
  displayName: string;
  /** Description */
  description: string;
  /** Keybindings (actionId -> keyString or KeyBinding) */
  bindings: Record<string, string | KeyBinding>;
}

/**
 * Callback for keybinding change events
 */
export type KeybindingChangeCallback = () => void;

/**
 * Result of matching a keyboard event to an action
 */
export interface KeyMatchResult {
  actionId: string;
  action: Action;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: KeybindingSettings = {
  preset: 'vscode',
  customBindings: {},
  disabledBindings: [],
};
