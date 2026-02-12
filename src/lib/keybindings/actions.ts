/**
 * Actions Registry
 *
 * Defines all available actions/commands that can be bound to keyboard shortcuts.
 */

import type { Action } from './types';

/**
 * All available actions in Kode
 */
export const actions: Action[] = [
  // ============================================================================
  // File Actions
  // ============================================================================
  {
    id: 'file.newFile',
    label: 'New File',
    category: 'File',
    description: 'Create a new file',
    defaultBinding: { key: 'ctrl+n', mac: 'cmd+n' },
  },
  {
    id: 'file.openFile',
    label: 'Open File',
    category: 'File',
    description: 'Open an existing file',
    defaultBinding: { key: 'ctrl+o', mac: 'cmd+o' },
  },
  {
    id: 'file.openFolder',
    label: 'Open Folder',
    category: 'File',
    description: 'Open an existing folder',
    defaultBinding: { key: 'ctrl+k ctrl+o', mac: 'cmd+k cmd+o' },
  },
  {
    id: 'file.save',
    label: 'Save',
    category: 'File',
    description: 'Save the current file',
    defaultBinding: { key: 'ctrl+s', mac: 'cmd+s', when: 'editorFocus' },
  },
  {
    id: 'file.saveAs',
    label: 'Save As',
    category: 'File',
    description: 'Save the current file with a new name',
    defaultBinding: { key: 'ctrl+shift+s', mac: 'cmd+shift+s', when: 'editorFocus' },
  },
  {
    id: 'file.saveAll',
    label: 'Save All',
    category: 'File',
    description: 'Save all open files',
    defaultBinding: { key: 'ctrl+alt+s', mac: 'cmd+alt+s' },
  },
  {
    id: 'file.close',
    label: 'Close Tab',
    category: 'File',
    description: 'Close the current tab',
    defaultBinding: { key: 'ctrl+w', mac: 'cmd+w', when: 'editorFocus' },
  },
  {
    id: 'file.closeAll',
    label: 'Close All Tabs',
    category: 'File',
    description: 'Close all open tabs',
    defaultBinding: { key: 'ctrl+shift+w', mac: 'cmd+shift+w' },
  },

  // ============================================================================
  // Edit Actions
  // ============================================================================
  {
    id: 'edit.undo',
    label: 'Undo',
    category: 'Edit',
    description: 'Undo the last action',
    defaultBinding: { key: 'ctrl+z', mac: 'cmd+z', when: 'editorFocus' },
  },
  {
    id: 'edit.redo',
    label: 'Redo',
    category: 'Edit',
    description: 'Redo the last undone action',
    defaultBinding: { key: 'ctrl+shift+z', mac: 'cmd+shift+z', when: 'editorFocus' },
  },
  {
    id: 'edit.cut',
    label: 'Cut',
    category: 'Edit',
    description: 'Cut selected text',
    defaultBinding: { key: 'ctrl+x', mac: 'cmd+x', when: 'editorFocus' },
  },
  {
    id: 'edit.copy',
    label: 'Copy',
    category: 'Edit',
    description: 'Copy selected text',
    defaultBinding: { key: 'ctrl+c', mac: 'cmd+c', when: 'editorFocus' },
  },
  {
    id: 'edit.paste',
    label: 'Paste',
    category: 'Edit',
    description: 'Paste from clipboard',
    defaultBinding: { key: 'ctrl+v', mac: 'cmd+v', when: 'editorFocus' },
  },
  {
    id: 'edit.selectAll',
    label: 'Select All',
    category: 'Edit',
    description: 'Select all text',
    defaultBinding: { key: 'ctrl+a', mac: 'cmd+a', when: 'editorFocus' },
  },
  {
    id: 'edit.find',
    label: 'Find',
    category: 'Edit',
    description: 'Open find panel',
    defaultBinding: { key: 'ctrl+f', mac: 'cmd+f', when: 'editorFocus' },
  },
  {
    id: 'edit.findReplace',
    label: 'Find and Replace',
    category: 'Edit',
    description: 'Open find and replace panel',
    defaultBinding: { key: 'ctrl+h', mac: 'cmd+alt+f', when: 'editorFocus' },
  },
  {
    id: 'edit.findInFiles',
    label: 'Find in Files',
    category: 'Edit',
    description: 'Search across all files',
    defaultBinding: { key: 'ctrl+shift+f', mac: 'cmd+shift+f' },
  },

  // ============================================================================
  // View Actions
  // ============================================================================
  {
    id: 'view.quickOpen',
    label: 'Quick Open',
    category: 'View',
    description: 'Quickly open a file by name',
    defaultBinding: { key: 'ctrl+p', mac: 'cmd+p' },
  },
  {
    id: 'view.commandPalette',
    label: 'Command Palette',
    category: 'View',
    description: 'Open the command palette',
    defaultBinding: { key: 'ctrl+shift+p', mac: 'cmd+shift+p' },
  },
  {
    id: 'view.toggleSidebar',
    label: 'Toggle Sidebar',
    category: 'View',
    description: 'Show or hide the sidebar',
    defaultBinding: { key: 'ctrl+b', mac: 'cmd+b' },
  },
  {
    id: 'view.togglePanel',
    label: 'Toggle Panel',
    category: 'View',
    description: 'Show or hide the bottom panel',
    defaultBinding: { key: 'ctrl+j', mac: 'cmd+j' },
  },
  {
    id: 'view.toggleChat',
    label: 'Toggle Chat',
    category: 'View',
    description: 'Show or hide the AI chat panel',
    defaultBinding: { key: 'ctrl+shift+b', mac: 'cmd+shift+b' },
  },
  {
    id: 'view.toggleFullscreen',
    label: 'Toggle Fullscreen',
    category: 'View',
    description: 'Enter or exit fullscreen mode',
    defaultBinding: { key: 'f11', mac: 'ctrl+cmd+f' },
  },
  {
    id: 'view.zoomIn',
    label: 'Zoom In',
    category: 'View',
    description: 'Increase editor font size',
    defaultBinding: { key: 'ctrl+=', mac: 'cmd+=' },
  },
  {
    id: 'view.zoomOut',
    label: 'Zoom Out',
    category: 'View',
    description: 'Decrease editor font size',
    defaultBinding: { key: 'ctrl+-', mac: 'cmd+-' },
  },
  {
    id: 'view.resetZoom',
    label: 'Reset Zoom',
    category: 'View',
    description: 'Reset editor font size to default',
    defaultBinding: { key: 'ctrl+0', mac: 'cmd+0' },
  },

  // ============================================================================
  // Editor/Navigation Actions
  // ============================================================================
  {
    id: 'editor.goToLine',
    label: 'Go to Line',
    category: 'Navigation',
    description: 'Jump to a specific line number',
    defaultBinding: { key: 'ctrl+g', mac: 'ctrl+g', when: 'editorFocus' },
  },
  {
    id: 'editor.goToDefinition',
    label: 'Go to Definition',
    category: 'Navigation',
    description: 'Jump to the definition of the symbol',
    defaultBinding: { key: 'f12', mac: 'f12', when: 'editorFocus' },
  },
  {
    id: 'editor.goToSymbol',
    label: 'Go to Symbol',
    category: 'Navigation',
    description: 'Jump to a symbol in the current file',
    defaultBinding: { key: 'ctrl+shift+o', mac: 'cmd+shift+o', when: 'editorFocus' },
  },
  {
    id: 'editor.nextTab',
    label: 'Next Tab',
    category: 'Navigation',
    description: 'Switch to the next editor tab',
    defaultBinding: { key: 'ctrl+tab', mac: 'ctrl+tab' },
  },
  {
    id: 'editor.previousTab',
    label: 'Previous Tab',
    category: 'Navigation',
    description: 'Switch to the previous editor tab',
    defaultBinding: { key: 'ctrl+shift+tab', mac: 'ctrl+shift+tab' },
  },
  {
    id: 'editor.focusEditor',
    label: 'Focus Editor',
    category: 'Navigation',
    description: 'Move focus to the editor',
    defaultBinding: { key: 'escape', when: 'always' },
  },
  {
    id: 'editor.toggleMinimap',
    label: 'Toggle Minimap',
    category: 'Editor',
    description: 'Show or hide the minimap',
    defaultBinding: { key: 'ctrl+shift+m', mac: 'cmd+shift+m' },
  },
  {
    id: 'editor.toggleWordWrap',
    label: 'Toggle Word Wrap',
    category: 'Editor',
    description: 'Toggle word wrapping in the editor',
    defaultBinding: { key: 'alt+z', mac: 'alt+z' },
  },
  {
    id: 'editor.showSignatureHelp',
    label: 'Show Signature Help',
    category: 'Editor',
    description: 'Show parameter hints for the current function call',
    defaultBinding: { key: 'ctrl+shift+space', mac: 'cmd+shift+space', when: 'editorFocus' },
  },
  {
    id: 'editor.formatDocument',
    label: 'Format Document',
    category: 'Editor',
    description: 'Format the current document',
    defaultBinding: { key: 'ctrl+shift+i', mac: 'cmd+shift+i', when: 'editorFocus' },
  },
  {
    id: 'editor.commentLine',
    label: 'Toggle Line Comment',
    category: 'Editor',
    description: 'Toggle comment on the current line',
    defaultBinding: { key: 'ctrl+/', mac: 'cmd+/', when: 'editorFocus' },
  },
  {
    id: 'editor.commentBlock',
    label: 'Toggle Block Comment',
    category: 'Editor',
    description: 'Toggle block comment on selection',
    defaultBinding: { key: 'ctrl+shift+/', mac: 'cmd+shift+/', when: 'editorFocus' },
  },
  {
    id: 'editor.indentLine',
    label: 'Indent Line',
    category: 'Editor',
    description: 'Indent the current line',
    defaultBinding: { key: 'ctrl+]', mac: 'cmd+]', when: 'editorFocus' },
  },
  {
    id: 'editor.outdentLine',
    label: 'Outdent Line',
    category: 'Editor',
    description: 'Outdent the current line',
    defaultBinding: { key: 'ctrl+[', mac: 'cmd+[', when: 'editorFocus' },
  },
  {
    id: 'editor.duplicateLine',
    label: 'Duplicate Line',
    category: 'Editor',
    description: 'Duplicate the current line',
    defaultBinding: { key: 'ctrl+shift+d', mac: 'cmd+shift+d', when: 'editorFocus' },
  },
  {
    id: 'editor.deleteLine',
    label: 'Delete Line',
    category: 'Editor',
    description: 'Delete the current line',
    defaultBinding: { key: 'ctrl+shift+k', mac: 'cmd+shift+k', when: 'editorFocus' },
  },
  {
    id: 'editor.moveLineUp',
    label: 'Move Line Up',
    category: 'Editor',
    description: 'Move the current line up',
    defaultBinding: { key: 'alt+up', mac: 'alt+up', when: 'editorFocus' },
  },
  {
    id: 'editor.moveLineDown',
    label: 'Move Line Down',
    category: 'Editor',
    description: 'Move the current line down',
    defaultBinding: { key: 'alt+down', mac: 'alt+down', when: 'editorFocus' },
  },

  // ============================================================================
  // Terminal Actions
  // ============================================================================
  {
    id: 'terminal.toggle',
    label: 'Toggle Terminal',
    category: 'Terminal',
    description: 'Show or hide the integrated terminal',
    defaultBinding: { key: 'ctrl+`', mac: 'ctrl+`' },
  },
  {
    id: 'terminal.new',
    label: 'New Terminal',
    category: 'Terminal',
    description: 'Create a new terminal instance',
    defaultBinding: { key: 'ctrl+shift+`', mac: 'ctrl+shift+`' },
  },
  {
    id: 'terminal.clear',
    label: 'Clear Terminal',
    category: 'Terminal',
    description: 'Clear the terminal output',
    defaultBinding: { key: 'ctrl+k', mac: 'cmd+k', when: 'terminalFocus' },
  },

  // ============================================================================
  // Chat Actions
  // ============================================================================
  {
    id: 'chat.focus',
    label: 'Focus Chat',
    category: 'Chat',
    description: 'Move focus to the chat input',
    defaultBinding: { key: 'ctrl+shift+i', mac: 'cmd+shift+i' },
  },
  {
    id: 'chat.newConversation',
    label: 'New Conversation',
    category: 'Chat',
    description: 'Start a new chat conversation',
    defaultBinding: { key: 'ctrl+shift+n', mac: 'cmd+shift+n' },
  },

  // ============================================================================
  // Help/Settings Actions
  // ============================================================================
  {
    id: 'help.openSettings',
    label: 'Open Settings',
    category: 'Help',
    description: 'Open the settings page',
    defaultBinding: { key: 'ctrl+,', mac: 'cmd+,' },
  },
  {
    id: 'help.openKeybindings',
    label: 'Open Keyboard Shortcuts',
    category: 'Help',
    description: 'Open keyboard shortcuts settings',
    defaultBinding: { key: 'ctrl+k ctrl+s', mac: 'cmd+k cmd+s' },
  },
  {
    id: 'help.showAbout',
    label: 'About Kode',
    category: 'Help',
    description: 'Show information about Kode',
    defaultBinding: { key: '' }, // No default binding
  },
];

/**
 * Get an action by its ID
 */
export function getAction(id: string): Action | undefined {
  return actions.find((action) => action.id === id);
}

/**
 * Get all actions in a category
 */
export function getActionsByCategory(category: string): Action[] {
  return actions.filter((action) => action.category === category);
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  return [...new Set(actions.map((action) => action.category))];
}

/**
 * Create a map of action IDs to actions for quick lookup
 */
export const actionsMap: Map<string, Action> = new Map(
  actions.map((action) => [action.id, action])
);
