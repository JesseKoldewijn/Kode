/**
 * Keybinding Presets Index
 *
 * Exports all available keybinding presets.
 */

export { vscodePreset } from './vscode';
export { cursorPreset } from './cursor';
export { jetbrainsPreset } from './jetbrains';

import type { KeybindingPreset, PresetName } from '../types';
import { vscodePreset } from './vscode';
import { cursorPreset } from './cursor';
import { jetbrainsPreset } from './jetbrains';

/**
 * Map of all available presets
 */
export const presets: Record<PresetName, KeybindingPreset> = {
  vscode: vscodePreset,
  cursor: cursorPreset,
  jetbrains: jetbrainsPreset,
};

/**
 * Get a preset by name
 */
export function getPreset(name: PresetName): KeybindingPreset {
  return presets[name];
}

/**
 * Get all available preset names
 */
export function getPresetNames(): PresetName[] {
  return Object.keys(presets) as PresetName[];
}
