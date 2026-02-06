/**
 * JetBrains Keybinding Preset
 *
 * Keybindings matching JetBrains IDEs (IntelliJ, WebStorm, etc.) default shortcuts.
 */

import type { KeybindingPreset } from '../types';

/**
 * JetBrains IDE keybindings
 * These differ significantly from VSCode in many areas.
 */
const jetbrainsBindings: Record<string, string> = {
  // ============================================================================
  // File Actions
  // ============================================================================
  'file.newFile': 'ctrl+alt+insert',
  'file.openFile': 'ctrl+shift+n',
  'file.save': 'ctrl+s',
  'file.saveAs': 'ctrl+shift+s',
  'file.saveAll': 'ctrl+s', // JetBrains auto-saves, so same as save
  'file.close': 'ctrl+f4',
  'file.closeAll': 'ctrl+shift+f4',

  // ============================================================================
  // Edit Actions
  // ============================================================================
  'edit.undo': 'ctrl+z',
  'edit.redo': 'ctrl+shift+z',
  'edit.cut': 'ctrl+x',
  'edit.copy': 'ctrl+c',
  'edit.paste': 'ctrl+v',
  'edit.selectAll': 'ctrl+a',
  'edit.find': 'ctrl+f',
  'edit.findReplace': 'ctrl+r',
  'edit.findInFiles': 'ctrl+shift+f',

  // ============================================================================
  // View Actions
  // ============================================================================
  'view.commandPalette': 'ctrl+shift+a', // "Find Action" in JetBrains
  'view.quickOpen': 'ctrl+shift+n', // "Go to File" in JetBrains
  'view.toggleSidebar': 'alt+1', // Project tool window
  'view.togglePanel': 'alt+4', // Run tool window
  'view.toggleChat': 'alt+shift+c', // AI Assistant
  'view.toggleFullscreen': 'ctrl+shift+f12',
  'view.zoomIn': 'ctrl+shift+=',
  'view.zoomOut': 'ctrl+shift+-',
  'view.resetZoom': 'ctrl+shift+0',

  // ============================================================================
  // Editor/Navigation Actions
  // ============================================================================
  'editor.goToLine': 'ctrl+g',
  'editor.goToDefinition': 'ctrl+b', // Different from VSCode's F12
  'editor.goToSymbol': 'ctrl+shift+alt+n',
  'editor.nextTab': 'alt+right',
  'editor.previousTab': 'alt+left',
  'editor.focusEditor': 'escape',
  'editor.toggleMinimap': '', // Not a standard JetBrains feature
  'editor.toggleWordWrap': 'ctrl+shift+w',
  'editor.formatDocument': 'ctrl+alt+l', // Reformat Code
  'editor.commentLine': 'ctrl+/',
  'editor.commentBlock': 'ctrl+shift+/',
  'editor.indentLine': 'tab',
  'editor.outdentLine': 'shift+tab',
  'editor.duplicateLine': 'ctrl+d',
  'editor.deleteLine': 'ctrl+y', // Different from VSCode!
  'editor.moveLineUp': 'ctrl+shift+up',
  'editor.moveLineDown': 'ctrl+shift+down',

  // ============================================================================
  // Terminal Actions
  // ============================================================================
  'terminal.toggle': 'alt+f12',
  'terminal.new': 'ctrl+shift+t',
  'terminal.clear': 'ctrl+l',

  // ============================================================================
  // Chat Actions
  // ============================================================================
  'chat.focus': 'alt+shift+c',
  'chat.newConversation': 'alt+shift+n',

  // ============================================================================
  // Help/Settings Actions
  // ============================================================================
  'help.openSettings': 'ctrl+alt+s',
  'help.openKeybindings': 'ctrl+alt+s', // Same as settings in JetBrains
  'help.showAbout': '',
};

export const jetbrainsPreset: KeybindingPreset = {
  name: 'jetbrains',
  displayName: 'JetBrains',
  description: 'Keybindings matching JetBrains IDEs (IntelliJ, WebStorm, etc.)',
  bindings: jetbrainsBindings,
};
