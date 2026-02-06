/**
 * Monaco Editor Theme Configuration
 *
 * Defines custom themes for Monaco that integrate with Kode's
 * CSS variable-based theming system.
 */

import * as monaco from 'monaco-editor';

/**
 * Read a CSS custom property value from the document root.
 * Returns the fallback if the variable is not set.
 */
function getCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Register the Kode dark theme with Monaco.
 */
export function registerDarkTheme(): void {
  monaco.editor.defineTheme('kode-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // Comments - muted green
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'comment.line', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'comment.block', foreground: '6A9955', fontStyle: 'italic' },

      // Keywords - purple/magenta
      { token: 'keyword', foreground: 'C586C0' },
      { token: 'keyword.control', foreground: 'C586C0' },
      { token: 'keyword.operator', foreground: 'C586C0' },

      // Strings - orange
      { token: 'string', foreground: 'CE9178' },
      { token: 'string.quoted', foreground: 'CE9178' },
      { token: 'string.template', foreground: 'CE9178' },

      // Numbers - light green
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'number.float', foreground: 'B5CEA8' },
      { token: 'number.hex', foreground: 'B5CEA8' },

      // Types - teal
      { token: 'type', foreground: '4EC9B0' },
      { token: 'type.identifier', foreground: '4EC9B0' },
      { token: 'class', foreground: '4EC9B0' },
      { token: 'interface', foreground: '4EC9B0' },

      // Functions - yellow
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'function.declaration', foreground: 'DCDCAA' },

      // Variables - light blue
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'variable.parameter', foreground: '9CDCFE' },
      { token: 'variable.other', foreground: '9CDCFE' },

      // Constants - blue
      { token: 'constant', foreground: '569CD6' },
      { token: 'constant.language', foreground: '569CD6' },

      // Operators
      { token: 'operator', foreground: 'D4D4D4' },

      // Punctuation
      { token: 'delimiter', foreground: 'D4D4D4' },
      { token: 'delimiter.bracket', foreground: 'FFD700' },

      // Tags (HTML/JSX)
      { token: 'tag', foreground: '569CD6' },
      { token: 'tag.attribute.name', foreground: '9CDCFE' },

      // Markdown
      { token: 'markup.heading', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'markup.bold', fontStyle: 'bold' },
      { token: 'markup.italic', fontStyle: 'italic' },
      { token: 'markup.underline', fontStyle: 'underline' },
      { token: 'markup.link', foreground: '4EC9B0' },

      // JSON
      { token: 'string.key.json', foreground: '9CDCFE' },
      { token: 'string.value.json', foreground: 'CE9178' },

      // Regex
      { token: 'regexp', foreground: 'D16969' },
    ],
    colors: {
      // Editor background and foreground
      'editor.background': getCssVar('--editor-bg', '#1e1e1e'),
      'editor.foreground': getCssVar('--text-primary', '#d4d4d4'),

      // Line highlighting
      'editor.lineHighlightBackground': getCssVar('--bg-hover', '#2a2a2a'),
      'editor.lineHighlightBorder': '#00000000',

      // Selection
      'editor.selectionBackground': getCssVar('--bg-selected', '#264f78'),
      'editor.selectionHighlightBackground': '#add6ff26',
      'editor.inactiveSelectionBackground': '#3a3d41',

      // Cursor
      'editorCursor.foreground': getCssVar('--accent', '#0078d4'),

      // Line numbers
      'editorLineNumber.foreground': getCssVar('--text-muted', '#858585'),
      'editorLineNumber.activeForeground': getCssVar('--text-secondary', '#c6c6c6'),

      // Indentation guides
      'editorIndentGuide.background': '#404040',
      'editorIndentGuide.activeBackground': '#707070',

      // Whitespace
      'editorWhitespace.foreground': '#3b3b3b',

      // Bracket matching
      'editorBracketMatch.background': '#0d3a58',
      'editorBracketMatch.border': '#888888',

      // Search highlighting
      'editor.findMatchBackground': '#515c6a',
      'editor.findMatchHighlightBackground': '#ea5c0055',
      'editor.findMatchBorder': '#74879f',

      // Word highlighting
      'editor.wordHighlightBackground': '#575757b8',
      'editor.wordHighlightStrongBackground': '#004972b8',

      // Minimap
      'minimap.background': getCssVar('--bg-surface', '#171717'),
      'minimapSlider.background': '#79797933',
      'minimapSlider.hoverBackground': '#64646466',
      'minimapSlider.activeBackground': '#bfbfbf33',

      // Scrollbar
      'scrollbarSlider.background': '#79797966',
      'scrollbarSlider.hoverBackground': '#646464b3',
      'scrollbarSlider.activeBackground': '#bfbfbf66',

      // Widget (find/replace panel, etc.)
      'editorWidget.background': getCssVar('--bg-elevated', '#1f1f1f'),
      'editorWidget.border': getCssVar('--border-muted', '#454545'),

      // Input (find/replace input boxes)
      'input.background': getCssVar('--bg-surface', '#171717'),
      'input.border': getCssVar('--border-muted', '#454545'),
      'input.foreground': getCssVar('--text-primary', '#cccccc'),
      'inputOption.activeBorder': getCssVar('--accent', '#0078d4'),
      'inputOption.activeBackground': getCssVar('--accent-muted', 'rgba(0, 120, 212, 0.15)'),

      // Focus border
      focusBorder: getCssVar('--accent', '#0078d4'),

      // Overview ruler (scrollbar annotations)
      'editorOverviewRuler.border': '#7f7f7f4d',
      'editorOverviewRuler.findMatchForeground': '#d186167e',
      'editorOverviewRuler.errorForeground': '#ff1212b3',
      'editorOverviewRuler.warningForeground': '#cca700',

      // Gutter
      'editorGutter.background': getCssVar('--editor-bg', '#1e1e1e'),
      'editorGutter.modifiedBackground': '#0c7d9d',
      'editorGutter.addedBackground': '#587c0c',
      'editorGutter.deletedBackground': '#94151b',

      // Error/warning squiggles
      'editorError.foreground': '#f14c4c',
      'editorWarning.foreground': '#cca700',
      'editorInfo.foreground': '#3794ff',

      // Suggest widget (autocomplete)
      'editorSuggestWidget.background': getCssVar('--bg-elevated', '#1f1f1f'),
      'editorSuggestWidget.border': getCssVar('--border-muted', '#454545'),
      'editorSuggestWidget.foreground': getCssVar('--text-primary', '#d4d4d4'),
      'editorSuggestWidget.selectedBackground': getCssVar('--bg-selected', '#264f78'),
      'editorSuggestWidget.highlightForeground': getCssVar('--accent', '#0078d4'),

      // Hover widget
      'editorHoverWidget.background': getCssVar('--bg-elevated', '#1f1f1f'),
      'editorHoverWidget.border': getCssVar('--border-muted', '#454545'),
    },
  });
}

/**
 * Register the Kode light theme with Monaco.
 */
export function registerLightTheme(): void {
  monaco.editor.defineTheme('kode-light', {
    base: 'vs',
    inherit: true,
    rules: [
      // Comments - muted green
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'comment.line', foreground: '008000', fontStyle: 'italic' },
      { token: 'comment.block', foreground: '008000', fontStyle: 'italic' },

      // Keywords - blue
      { token: 'keyword', foreground: '0000FF' },
      { token: 'keyword.control', foreground: 'AF00DB' },
      { token: 'keyword.operator', foreground: '0000FF' },

      // Strings - dark red
      { token: 'string', foreground: 'A31515' },
      { token: 'string.quoted', foreground: 'A31515' },
      { token: 'string.template', foreground: 'A31515' },

      // Numbers - dark green
      { token: 'number', foreground: '098658' },
      { token: 'number.float', foreground: '098658' },
      { token: 'number.hex', foreground: '098658' },

      // Types - teal
      { token: 'type', foreground: '267F99' },
      { token: 'type.identifier', foreground: '267F99' },
      { token: 'class', foreground: '267F99' },
      { token: 'interface', foreground: '267F99' },

      // Functions - dark yellow
      { token: 'function', foreground: '795E26' },
      { token: 'function.declaration', foreground: '795E26' },

      // Variables
      { token: 'variable', foreground: '001080' },
      { token: 'variable.parameter', foreground: '001080' },
      { token: 'variable.other', foreground: '001080' },

      // Constants
      { token: 'constant', foreground: '0070C1' },
      { token: 'constant.language', foreground: '0000FF' },

      // Operators
      { token: 'operator', foreground: '000000' },

      // Punctuation
      { token: 'delimiter', foreground: '000000' },
      { token: 'delimiter.bracket', foreground: '0431FA' },

      // Tags
      { token: 'tag', foreground: '800000' },
      { token: 'tag.attribute.name', foreground: 'FF0000' },

      // Markdown
      { token: 'markup.heading', foreground: '0000FF', fontStyle: 'bold' },
      { token: 'markup.bold', fontStyle: 'bold' },
      { token: 'markup.italic', fontStyle: 'italic' },
      { token: 'markup.underline', fontStyle: 'underline' },
      { token: 'markup.link', foreground: '267F99' },

      // JSON
      { token: 'string.key.json', foreground: '0451A5' },
      { token: 'string.value.json', foreground: 'A31515' },

      // Regex
      { token: 'regexp', foreground: '811F3F' },
    ],
    colors: {
      // Editor background and foreground
      'editor.background': getCssVar('--editor-bg', '#ffffff'),
      'editor.foreground': getCssVar('--text-primary', '#000000'),

      // Line highlighting
      'editor.lineHighlightBackground': getCssVar('--bg-hover', '#f0f0f0'),
      'editor.lineHighlightBorder': '#00000000',

      // Selection
      'editor.selectionBackground': getCssVar('--bg-selected', '#add6ff'),
      'editor.selectionHighlightBackground': '#add6ff80',
      'editor.inactiveSelectionBackground': '#e5ebf1',

      // Cursor
      'editorCursor.foreground': getCssVar('--accent', '#0066b8'),

      // Line numbers
      'editorLineNumber.foreground': getCssVar('--text-muted', '#237893'),
      'editorLineNumber.activeForeground': getCssVar('--text-primary', '#000000'),

      // Indentation guides
      'editorIndentGuide.background': '#d3d3d3',
      'editorIndentGuide.activeBackground': '#939393',

      // Whitespace
      'editorWhitespace.foreground': '#d3d3d3',

      // Bracket matching
      'editorBracketMatch.background': '#add6ff80',
      'editorBracketMatch.border': '#b9b9b9',

      // Search highlighting
      'editor.findMatchBackground': '#a8ac94',
      'editor.findMatchHighlightBackground': '#ea5c0055',
      'editor.findMatchBorder': '#74879f',

      // Word highlighting
      'editor.wordHighlightBackground': '#57575740',
      'editor.wordHighlightStrongBackground': '#0063ce40',

      // Minimap
      'minimap.background': getCssVar('--bg-surface', '#fafafa'),
      'minimapSlider.background': '#64646433',
      'minimapSlider.hoverBackground': '#64646466',
      'minimapSlider.activeBackground': '#64646499',

      // Scrollbar
      'scrollbarSlider.background': '#64646466',
      'scrollbarSlider.hoverBackground': '#646464b3',
      'scrollbarSlider.activeBackground': '#64646499',

      // Widget
      'editorWidget.background': getCssVar('--bg-elevated', '#f5f5f5'),
      'editorWidget.border': getCssVar('--border-muted', '#c8c8c8'),

      // Input
      'input.background': getCssVar('--bg-surface', '#ffffff'),
      'input.border': getCssVar('--border-muted', '#c8c8c8'),
      'input.foreground': getCssVar('--text-primary', '#000000'),
      'inputOption.activeBorder': getCssVar('--accent', '#0066b8'),
      'inputOption.activeBackground': getCssVar('--accent-muted', 'rgba(0, 102, 184, 0.1)'),

      // Focus border
      focusBorder: getCssVar('--accent', '#0066b8'),

      // Overview ruler
      'editorOverviewRuler.border': '#7f7f7f4d',
      'editorOverviewRuler.findMatchForeground': '#d186167e',
      'editorOverviewRuler.errorForeground': '#ff1212b3',
      'editorOverviewRuler.warningForeground': '#bf8803',

      // Gutter
      'editorGutter.background': getCssVar('--editor-bg', '#ffffff'),
      'editorGutter.modifiedBackground': '#2090d3',
      'editorGutter.addedBackground': '#48985d',
      'editorGutter.deletedBackground': '#e51400',

      // Error/warning squiggles
      'editorError.foreground': '#e51400',
      'editorWarning.foreground': '#bf8803',
      'editorInfo.foreground': '#1a85ff',

      // Suggest widget
      'editorSuggestWidget.background': getCssVar('--bg-elevated', '#f5f5f5'),
      'editorSuggestWidget.border': getCssVar('--border-muted', '#c8c8c8'),
      'editorSuggestWidget.foreground': getCssVar('--text-primary', '#000000'),
      'editorSuggestWidget.selectedBackground': getCssVar('--bg-selected', '#cce5ff'),
      'editorSuggestWidget.highlightForeground': getCssVar('--accent', '#0066b8'),

      // Hover widget
      'editorHoverWidget.background': getCssVar('--bg-elevated', '#f5f5f5'),
      'editorHoverWidget.border': getCssVar('--border-muted', '#c8c8c8'),
    },
  });
}

/**
 * Register all Kode themes with Monaco.
 * Call this once at app startup before creating any editors.
 */
export function registerMonacoThemes(): void {
  registerDarkTheme();
  registerLightTheme();
}

/**
 * Set the active Monaco theme.
 * @param mode - 'dark' or 'light'
 */
export function setMonacoTheme(mode: 'dark' | 'light'): void {
  const themeName = mode === 'dark' ? 'kode-dark' : 'kode-light';
  monaco.editor.setTheme(themeName);
}

/**
 * Get the Monaco theme name for the given mode.
 */
export function getMonacoThemeName(mode: 'dark' | 'light'): string {
  return mode === 'dark' ? 'kode-dark' : 'kode-light';
}
