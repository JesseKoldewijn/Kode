/**
 * Keybinding System Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseKeyString,
  keyComboToString,
  keyCombosMatch,
  getDisplayString,
  KeybindingManager,
  eventToKeyCombo,
  getAction,
  getActionsByCategory,
  getCategories,
  actions,
  vscodePreset,
  cursorPreset,
  jetbrainsPreset,
  getPreset,
  getPresetNames,
  DEFAULT_SETTINGS,
  exportKeybindingSettings,
  importKeybindingSettings,
} from '../../src/lib/keybindings';

describe('parseKeyString', () => {
  it('parses simple key', () => {
    const combo = parseKeyString('a');
    expect(combo.key).toBe('a');
    expect(combo.ctrl).toBe(false);
    expect(combo.alt).toBe(false);
    expect(combo.shift).toBe(false);
    expect(combo.meta).toBe(false);
  });

  it('parses ctrl+key', () => {
    const combo = parseKeyString('ctrl+s');
    expect(combo.key).toBe('s');
    expect(combo.ctrl).toBe(true);
    expect(combo.alt).toBe(false);
    expect(combo.shift).toBe(false);
    expect(combo.meta).toBe(false);
  });

  it('parses multiple modifiers', () => {
    const combo = parseKeyString('ctrl+shift+alt+p');
    expect(combo.key).toBe('p');
    expect(combo.ctrl).toBe(true);
    expect(combo.alt).toBe(true);
    expect(combo.shift).toBe(true);
    expect(combo.meta).toBe(false);
  });

  it('parses cmd as meta', () => {
    const combo = parseKeyString('cmd+s');
    expect(combo.key).toBe('s');
    expect(combo.meta).toBe(true);
  });

  it('parses function keys', () => {
    const combo = parseKeyString('f12');
    expect(combo.key).toBe('f12');
  });

  it('handles empty string', () => {
    const combo = parseKeyString('');
    expect(combo.key).toBe('');
    expect(combo.ctrl).toBe(false);
  });
});

describe('keyComboToString', () => {
  it('converts simple key', () => {
    expect(keyComboToString({ key: 'a', ctrl: false, alt: false, shift: false, meta: false })).toBe(
      'a'
    );
  });

  it('converts with modifiers', () => {
    const result = keyComboToString({ key: 's', ctrl: true, alt: false, shift: true, meta: false });
    expect(result).toBe('ctrl+shift+s');
  });

  it('handles all modifiers', () => {
    const result = keyComboToString({ key: 'p', ctrl: true, alt: true, shift: true, meta: true });
    // Meta shows as 'cmd' on Mac or 'meta' on others - we test non-Mac case in jsdom
    expect(result).toContain('ctrl');
    expect(result).toContain('alt');
    expect(result).toContain('shift');
    expect(result).toContain('p');
  });
});

describe('keyCombosMatch', () => {
  it('matches identical combos', () => {
    const a = parseKeyString('ctrl+s');
    const b = parseKeyString('ctrl+s');
    expect(keyCombosMatch(a, b)).toBe(true);
  });

  it('does not match different keys', () => {
    const a = parseKeyString('ctrl+s');
    const b = parseKeyString('ctrl+a');
    expect(keyCombosMatch(a, b)).toBe(false);
  });

  it('does not match different modifiers', () => {
    const a = parseKeyString('ctrl+s');
    const b = parseKeyString('ctrl+shift+s');
    expect(keyCombosMatch(a, b)).toBe(false);
  });
});

describe('eventToKeyCombo', () => {
  it('converts regular key events', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
    });
    const combo = eventToKeyCombo(event);
    expect(combo.key).toBe('a');
    expect(combo.ctrl).toBe(true);
    expect(combo.alt).toBe(false);
    expect(combo.shift).toBe(false);
    expect(combo.meta).toBe(false);
  });

  it('handles backtick key with code Backquote', () => {
    const event = new KeyboardEvent('keydown', {
      key: '`',
      code: 'Backquote',
    });
    const combo = eventToKeyCombo(event);
    expect(combo.key).toBe('`');
  });

  it('handles special keys with consistent codes', () => {
    const testCases = [
      { code: 'Backquote', expectedKey: '`' },
      { code: 'Minus', expectedKey: '-' },
      { code: 'Equal', expectedKey: '=' },
      { code: 'BracketLeft', expectedKey: '[' },
      { code: 'BracketRight', expectedKey: ']' },
      { code: 'Backslash', expectedKey: '\\' },
      { code: 'Semicolon', expectedKey: ';' },
      { code: 'Quote', expectedKey: "'" },
      { code: 'Comma', expectedKey: ',' },
      { code: 'Period', expectedKey: '.' },
      { code: 'Slash', expectedKey: '/' },
    ];

    for (const { code, expectedKey } of testCases) {
      const event = new KeyboardEvent('keydown', {
        key: 'x', // Some browsers may send different key values
        code,
      });
      const combo = eventToKeyCombo(event);
      expect(combo.key).toBe(expectedKey);
    }
  });

  it('preserves modifiers from keyboard event', () => {
    const event = new KeyboardEvent('keydown', {
      key: '`',
      code: 'Backquote',
      ctrlKey: true,
      shiftKey: true,
    });
    const combo = eventToKeyCombo(event);
    expect(combo.key).toBe('`');
    expect(combo.ctrl).toBe(true);
    expect(combo.shift).toBe(true);
    expect(combo.alt).toBe(false);
    expect(combo.meta).toBe(false);
  });
});

describe('getDisplayString', () => {
  it('displays simple key', () => {
    const display = getDisplayString('a');
    expect(display).toBe('A');
  });

  it('displays with modifiers', () => {
    const display = getDisplayString('ctrl+s');
    // In jsdom (non-Mac), should show Ctrl+S
    expect(display).toContain('Ctrl');
    expect(display).toContain('S');
  });

  it('handles empty string', () => {
    expect(getDisplayString('')).toBe('');
  });

  it('displays special keys', () => {
    const display = getDisplayString('escape');
    expect(display).toContain('Esc');
  });
});

describe('Actions', () => {
  it('has actions defined', () => {
    expect(actions.length).toBeGreaterThan(0);
  });

  it('can get action by id', () => {
    const action = getAction('file.save');
    expect(action).toBeDefined();
    expect(action?.label).toBe('Save');
    expect(action?.category).toBe('File');
  });

  it('returns undefined for unknown action', () => {
    const action = getAction('unknown.action');
    expect(action).toBeUndefined();
  });

  it('can get actions by category', () => {
    const fileActions = getActionsByCategory('File');
    expect(fileActions.length).toBeGreaterThan(0);
    expect(fileActions.every((a) => a.category === 'File')).toBe(true);
  });

  it('can get all categories', () => {
    const categories = getCategories();
    expect(categories).toContain('File');
    expect(categories).toContain('Edit');
    expect(categories).toContain('View');
  });

  it('all actions have required fields', () => {
    for (const action of actions) {
      expect(action.id).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.category).toBeTruthy();
      expect(action.defaultBinding).toBeDefined();
    }
  });
});

describe('Presets', () => {
  it('has vscode preset', () => {
    expect(vscodePreset.name).toBe('vscode');
    expect(vscodePreset.displayName).toBe('Visual Studio Code');
    expect(Object.keys(vscodePreset.bindings).length).toBeGreaterThan(0);
  });

  it('has cursor preset', () => {
    expect(cursorPreset.name).toBe('cursor');
    expect(cursorPreset.displayName).toBe('Cursor');
    // Cursor should have chat.focus with different binding
    expect(cursorPreset.bindings['chat.focus']).toBe('ctrl+l');
  });

  it('has jetbrains preset', () => {
    expect(jetbrainsPreset.name).toBe('jetbrains');
    expect(jetbrainsPreset.displayName).toBe('JetBrains');
    // JetBrains uses different bindings
    expect(jetbrainsPreset.bindings['editor.goToDefinition']).toBe('ctrl+b');
  });

  it('can get preset by name', () => {
    expect(getPreset('vscode')).toBe(vscodePreset);
    expect(getPreset('cursor')).toBe(cursorPreset);
    expect(getPreset('jetbrains')).toBe(jetbrainsPreset);
  });

  it('can get all preset names', () => {
    const names = getPresetNames();
    expect(names).toContain('vscode');
    expect(names).toContain('cursor');
    expect(names).toContain('jetbrains');
  });
});

describe('KeybindingManager', () => {
  let manager: KeybindingManager;

  beforeEach(() => {
    manager = new KeybindingManager();
  });

  it('initializes with default settings', () => {
    expect(manager.getPreset()).toBe('vscode');
  });

  it('can get binding for action', () => {
    const binding = manager.getBinding('file.save');
    expect(binding).toBe('ctrl+s');
  });

  it('can get display string for binding', () => {
    const display = manager.getBindingDisplay('file.save');
    expect(display).toContain('Ctrl');
    expect(display).toContain('S');
  });

  it('can match keyboard event', () => {
    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    });

    const match = manager.matchEvent(event);
    expect(match).not.toBeNull();
    expect(match?.actionId).toBe('file.save');
  });

  it('returns null for unbound keys', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'x',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
      metaKey: false,
    });

    const match = manager.matchEvent(event);
    expect(match).toBeNull();
  });

  it('ignores modifier-only events', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Control',
      ctrlKey: true,
    });

    const match = manager.matchEvent(event);
    expect(match).toBeNull();
  });

  it('can set custom binding', () => {
    manager.setBinding('file.save', 'ctrl+shift+s');
    expect(manager.getBinding('file.save')).toBe('ctrl+shift+s');
  });

  it('removes conflicting bindings when setting', () => {
    // file.saveAs uses ctrl+shift+s by default
    const originalAction = manager.matchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true })
    );
    expect(originalAction?.actionId).toBe('file.saveAs');

    // Set file.save to ctrl+shift+s
    manager.setBinding('file.save', 'ctrl+shift+s');

    // Now ctrl+shift+s should trigger file.save
    const match = manager.matchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true })
    );
    expect(match?.actionId).toBe('file.save');

    // file.saveAs should be unbound (undefined since it's removed from computed bindings)
    expect(manager.getBinding('file.saveAs')).toBeUndefined();
  });

  it('can reset binding to default', () => {
    manager.setBinding('file.save', 'ctrl+shift+s');
    expect(manager.getBinding('file.save')).toBe('ctrl+shift+s');

    manager.resetBinding('file.save');
    expect(manager.getBinding('file.save')).toBe('ctrl+s');
  });

  it('can disable binding', () => {
    manager.disableBinding('file.save');
    expect(manager.getBinding('file.save')).toBeUndefined();

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    expect(manager.matchEvent(event)).toBeNull();
  });

  it('can change preset', () => {
    manager.setPreset('jetbrains');
    expect(manager.getPreset()).toBe('jetbrains');
    expect(manager.getBinding('editor.goToDefinition')).toBe('ctrl+b');
  });

  it('can reset to preset', () => {
    manager.setBinding('file.save', 'ctrl+shift+s');
    manager.resetToPreset('vscode');
    expect(manager.getBinding('file.save')).toBe('ctrl+s');
  });

  it('can get all bindings', () => {
    const bindings = manager.getAllBindings();
    expect(bindings.get('file.save')).toBe('ctrl+s');
    expect(bindings.size).toBeGreaterThan(0);
  });

  it('can get all actions with bindings', () => {
    const actionsWithBindings = manager.getAllActionsWithBindings();
    expect(actionsWithBindings.length).toBe(actions.length);

    const saveAction = actionsWithBindings.find((a) => a.id === 'file.save');
    expect(saveAction).toBeDefined();
    expect(saveAction?.binding).toBe('ctrl+s');
    expect(saveAction?.isCustom).toBe(false);
    expect(saveAction?.isDisabled).toBe(false);
  });

  it('notifies subscribers on change', () => {
    const callback = vi.fn();
    const unsubscribe = manager.subscribe(callback);

    manager.setBinding('file.save', 'ctrl+shift+s');
    expect(callback).toHaveBeenCalledTimes(1);

    manager.setPreset('jetbrains');
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
    manager.setBinding('file.save', 'ctrl+s');
    expect(callback).toHaveBeenCalledTimes(2); // Should not increase
  });

  it('can export and import settings', () => {
    manager.setBinding('file.save', 'ctrl+shift+s');
    manager.setPreset('cursor');

    const settings = manager.getSettings();
    const exported = exportKeybindingSettings(settings);
    expect(exported).toContain('cursor');
    expect(exported).toContain('ctrl+shift+s');

    const imported = importKeybindingSettings(exported);
    expect(imported).not.toBeNull();
    expect(imported?.preset).toBe('cursor');
    expect(imported?.customBindings['file.save']).toBe('ctrl+shift+s');
  });
});

describe('Settings', () => {
  it('has valid default settings', () => {
    expect(DEFAULT_SETTINGS.preset).toBe('vscode');
    expect(DEFAULT_SETTINGS.customBindings).toEqual({});
    expect(DEFAULT_SETTINGS.disabledBindings).toEqual([]);
  });

  it('validates imported settings', () => {
    // Valid settings
    expect(
      importKeybindingSettings('{"preset": "vscode", "customBindings": {}, "disabledBindings": []}')
    ).not.toBeNull();

    // Invalid preset
    expect(
      importKeybindingSettings(
        '{"preset": "invalid", "customBindings": {}, "disabledBindings": []}'
      )
    ).toBeNull();

    // Missing fields
    expect(importKeybindingSettings('{"preset": "vscode"}')).toBeNull();

    // Invalid JSON
    expect(importKeybindingSettings('not json')).toBeNull();
  });
});

describe('Events', () => {
  it('allows subscribing to and emitting actions', async () => {
    const { subscribeToAction, emitAction, clearAllActionSubscribers } =
      await import('../../src/lib/keybindings/events');

    // Clear any existing subscribers
    clearAllActionSubscribers();

    const callback = vi.fn();
    const unsubscribe = subscribeToAction('test.action', callback);

    // Emit the action
    const handled = emitAction('test.action');
    expect(handled).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);

    // Emit again
    emitAction('test.action');
    expect(callback).toHaveBeenCalledTimes(2);

    // Unsubscribe
    unsubscribe();
    emitAction('test.action');
    expect(callback).toHaveBeenCalledTimes(2); // No new calls

    clearAllActionSubscribers();
  });

  it('returns false when no subscribers exist', async () => {
    const { emitAction, clearAllActionSubscribers } =
      await import('../../src/lib/keybindings/events');

    clearAllActionSubscribers();
    const handled = emitAction('nonexistent.action');
    expect(handled).toBe(false);
  });

  it('supports multiple subscribers for the same action', async () => {
    const { subscribeToAction, emitAction, clearAllActionSubscribers } =
      await import('../../src/lib/keybindings/events');

    clearAllActionSubscribers();

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    subscribeToAction('multi.action', callback1);
    subscribeToAction('multi.action', callback2);

    emitAction('multi.action');

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);

    clearAllActionSubscribers();
  });

  it('can check if action has subscribers', async () => {
    const { subscribeToAction, hasActionSubscribers, clearAllActionSubscribers } =
      await import('../../src/lib/keybindings/events');

    clearAllActionSubscribers();

    expect(hasActionSubscribers('check.action')).toBe(false);

    const unsubscribe = subscribeToAction('check.action', () => {});
    expect(hasActionSubscribers('check.action')).toBe(true);

    unsubscribe();
    expect(hasActionSubscribers('check.action')).toBe(false);

    clearAllActionSubscribers();
  });

  it('supports edit.find action subscription', async () => {
    const { subscribeToAction, emitAction, clearAllActionSubscribers } =
      await import('../../src/lib/keybindings/events');

    clearAllActionSubscribers();

    const callback = vi.fn();
    const unsubscribe = subscribeToAction('edit.find', callback);

    emitAction('edit.find');
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    clearAllActionSubscribers();
  });

  it('supports edit.findReplace action subscription', async () => {
    const { subscribeToAction, emitAction, clearAllActionSubscribers } =
      await import('../../src/lib/keybindings/events');

    clearAllActionSubscribers();

    const callback = vi.fn();
    const unsubscribe = subscribeToAction('edit.findReplace', callback);

    emitAction('edit.findReplace');
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    clearAllActionSubscribers();
  });

  it('handles multiple editor actions independently', async () => {
    const { subscribeToAction, emitAction, clearAllActionSubscribers } =
      await import('../../src/lib/keybindings/events');

    clearAllActionSubscribers();

    const findCallback = vi.fn();
    const findReplaceCallback = vi.fn();
    const goToLineCallback = vi.fn();

    const unsub1 = subscribeToAction('edit.find', findCallback);
    const unsub2 = subscribeToAction('edit.findReplace', findReplaceCallback);
    const unsub3 = subscribeToAction('editor.goToLine', goToLineCallback);

    // Emit find only
    emitAction('edit.find');
    expect(findCallback).toHaveBeenCalledTimes(1);
    expect(findReplaceCallback).toHaveBeenCalledTimes(0);
    expect(goToLineCallback).toHaveBeenCalledTimes(0);

    // Emit findReplace only
    emitAction('edit.findReplace');
    expect(findCallback).toHaveBeenCalledTimes(1);
    expect(findReplaceCallback).toHaveBeenCalledTimes(1);
    expect(goToLineCallback).toHaveBeenCalledTimes(0);

    // Emit goToLine only
    emitAction('editor.goToLine');
    expect(findCallback).toHaveBeenCalledTimes(1);
    expect(findReplaceCallback).toHaveBeenCalledTimes(1);
    expect(goToLineCallback).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
    unsub3();
    clearAllActionSubscribers();
  });
});
