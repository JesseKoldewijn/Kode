/**
 * VSCode Keybinding Preset
 *
 * Default keybindings matching Visual Studio Code's default shortcuts.
 * This is the base preset that other presets may extend or override.
 */

import type { KeybindingPreset } from '../types';
import { actions } from '../actions';

/**
 * Generate VSCode preset from action defaults
 * Since our actions already define VSCode-style defaults, we use those directly.
 */
function generateBindings(): Record<string, string> {
  const bindings: Record<string, string> = {};

  for (const action of actions) {
    if (action.defaultBinding.key) {
      // Skip chord bindings (contain space) - not supported yet
      if (action.defaultBinding.key.includes(' ')) {
        continue;
      }
      bindings[action.id] = action.defaultBinding.key;
    }
  }

  return bindings;
}

export const vscodePreset: KeybindingPreset = {
  name: 'vscode',
  displayName: 'Visual Studio Code',
  description: 'Default keybindings matching Visual Studio Code',
  bindings: generateBindings(),
};

/**
 * VSCode-specific binding overrides (if any differ from our action defaults)
 * Currently empty since actions.ts already uses VSCode defaults.
 */
export const vscodeOverrides: Record<string, string> = {
  // No overrides needed - actions.ts uses VSCode defaults
};
