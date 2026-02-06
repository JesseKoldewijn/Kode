/**
 * Cursor Keybinding Preset
 *
 * Keybindings matching Cursor editor's default shortcuts.
 * Based on VSCode with AI-focused modifications.
 */

import type { KeybindingPreset } from '../types';
import { vscodePreset } from './vscode';

/**
 * Cursor-specific keybinding overrides
 * Cursor is based on VSCode but has different AI-related shortcuts.
 */
const cursorOverrides: Record<string, string> = {
  // Chat/AI focused shortcuts - Cursor uses Cmd+L for chat
  'chat.focus': 'ctrl+l',
  'chat.newConversation': 'ctrl+shift+l',

  // Cursor uses Cmd+K for AI command palette
  'view.commandPalette': 'ctrl+k',

  // Standard command palette moved to Cmd+Shift+P
  'view.quickOpen': 'ctrl+p',

  // Terminal clear uses different shortcut since Cmd+K is AI
  'terminal.clear': 'ctrl+shift+k',
};

export const cursorPreset: KeybindingPreset = {
  name: 'cursor',
  displayName: 'Cursor',
  description: 'Keybindings matching Cursor editor with AI-focused shortcuts',
  bindings: {
    ...vscodePreset.bindings,
    ...cursorOverrides,
  },
};
