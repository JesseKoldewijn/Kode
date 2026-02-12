import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initEditorSettings,
  setTabSize,
  setInsertSpaces,
  setWordWrap,
  setAutoSave,
  setAutoSaveDelay,
  setAutoClosingBrackets,
  setAutoClosingQuotes,
  setAutoIndent,
  toggleWordWrap,
  getEditorSettings,
  subscribeToEditorSettings,
  currentSettings,
} from '../../src/lib/editor-settings';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

const DEFAULT_SETTINGS = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: false,
  autoSave: false,
  autoSaveDelay: 1000,
  autoClosingBrackets: true,
  autoClosingQuotes: true,
  autoIndent: true,
} as const;

describe('Editor Settings', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset to defaults
    setTabSize(2);
    setInsertSpaces(true);
    setWordWrap(false);
    setAutoSave(false);
    setAutoSaveDelay(1000);
    setAutoClosingBrackets(true);
    setAutoClosingQuotes(true);
    setAutoIndent(true);
  });

  describe('Default values', () => {
    it('has tabSize 2 by default', () => {
      const settings = getEditorSettings();
      expect(settings.tabSize).toBe(2);
    });

    it('has wordWrap false by default', () => {
      const settings = getEditorSettings();
      expect(settings.wordWrap).toBe(false);
    });
  });

  describe('initEditorSettings', () => {
    it('initializes with defaults when no saved value', () => {
      localStorageMock.clear();
      initEditorSettings();
      const settings = getEditorSettings();
      expect(settings.tabSize).toBe(2);
      expect(settings.wordWrap).toBe(false);
    });

    it('loads saved settings from localStorage', () => {
      localStorageMock.setItem(
        'kode-editor-settings',
        JSON.stringify({ tabSize: 4, wordWrap: true })
      );
      initEditorSettings();
      const settings = getEditorSettings();
      expect(settings.tabSize).toBe(4);
      expect(settings.wordWrap).toBe(true);
    });

    it('ignores invalid JSON in localStorage', () => {
      localStorageMock.setItem('kode-editor-settings', 'not-json');
      initEditorSettings();
      const settings = getEditorSettings();
      expect(settings.tabSize).toBe(2);
      expect(settings.wordWrap).toBe(false);
    });

    it('ignores invalid tabSize values', () => {
      localStorageMock.setItem(
        'kode-editor-settings',
        JSON.stringify({ tabSize: 8, wordWrap: true })
      );
      initEditorSettings();
      const settings = getEditorSettings();
      expect(settings.tabSize).toBe(2); // Falls back to current (default)
      expect(settings.wordWrap).toBe(true);
    });

    it('ignores non-boolean wordWrap values', () => {
      localStorageMock.setItem(
        'kode-editor-settings',
        JSON.stringify({ tabSize: 4, wordWrap: 'yes' })
      );
      initEditorSettings();
      const settings = getEditorSettings();
      expect(settings.tabSize).toBe(4);
      expect(settings.wordWrap).toBe(false); // Falls back to current (default)
    });

    it('notifies listeners after initialization', () => {
      const callback = vi.fn();
      subscribeToEditorSettings(callback);
      callback.mockClear();

      localStorageMock.setItem(
        'kode-editor-settings',
        JSON.stringify({ tabSize: 4, wordWrap: true })
      );
      initEditorSettings();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        tabSize: 4,
        wordWrap: true,
      });
    });
  });

  describe('setTabSize', () => {
    it('sets tab size to 2', () => {
      setTabSize(4); // Change first
      setTabSize(2);
      expect(getEditorSettings().tabSize).toBe(2);
    });

    it('sets tab size to 4', () => {
      setTabSize(4);
      expect(getEditorSettings().tabSize).toBe(4);
    });

    it('persists to localStorage', () => {
      setTabSize(4);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kode-editor-settings',
        JSON.stringify({ ...DEFAULT_SETTINGS, tabSize: 4 })
      );
    });

    it('notifies listeners', () => {
      const callback = vi.fn();
      subscribeToEditorSettings(callback);
      callback.mockClear();

      setTabSize(4);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        tabSize: 4,
      });
    });
  });

  describe('setWordWrap', () => {
    it('enables word wrap', () => {
      setWordWrap(true);
      expect(getEditorSettings().wordWrap).toBe(true);
    });

    it('disables word wrap', () => {
      setWordWrap(true);
      setWordWrap(false);
      expect(getEditorSettings().wordWrap).toBe(false);
    });

    it('persists to localStorage', () => {
      setWordWrap(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kode-editor-settings',
        JSON.stringify({ ...DEFAULT_SETTINGS, wordWrap: true })
      );
    });

    it('notifies listeners', () => {
      const callback = vi.fn();
      subscribeToEditorSettings(callback);
      callback.mockClear();

      setWordWrap(true);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        wordWrap: true,
      });
    });
  });

  describe('toggleWordWrap', () => {
    it('toggles from false to true', () => {
      setWordWrap(false);
      toggleWordWrap();
      expect(getEditorSettings().wordWrap).toBe(true);
    });

    it('toggles from true to false', () => {
      setWordWrap(true);
      toggleWordWrap();
      expect(getEditorSettings().wordWrap).toBe(false);
    });

    it('persists the toggled value', () => {
      toggleWordWrap();
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kode-editor-settings',
        JSON.stringify({ ...DEFAULT_SETTINGS, wordWrap: true })
      );
    });
  });

  describe('getEditorSettings', () => {
    it('returns a copy, not a reference', () => {
      const settings1 = getEditorSettings();
      const settings2 = getEditorSettings();
      expect(settings1).not.toBe(settings2);
      expect(settings1).toEqual(settings2);
    });

    it('reflects current state', () => {
      setTabSize(4);
      setWordWrap(true);
      const settings = getEditorSettings();
      expect(settings).toEqual({
        ...DEFAULT_SETTINGS,
        tabSize: 4,
        wordWrap: true,
      });
    });
  });

  describe('subscribeToEditorSettings', () => {
    it('calls subscriber immediately with current value', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToEditorSettings(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(DEFAULT_SETTINGS);

      unsubscribe();
    });

    it('calls subscriber on tab size changes', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToEditorSettings(callback);
      callback.mockClear();

      setTabSize(4);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        tabSize: 4,
      });

      unsubscribe();
    });

    it('calls subscriber on word wrap changes', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToEditorSettings(callback);
      callback.mockClear();

      setWordWrap(true);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        wordWrap: true,
      });

      unsubscribe();
    });

    it('stops calling after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToEditorSettings(callback);
      callback.mockClear();

      unsubscribe();
      setTabSize(4);
      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsub1 = subscribeToEditorSettings(callback1);
      const unsub2 = subscribeToEditorSettings(callback2);

      callback1.mockClear();
      callback2.mockClear();

      setTabSize(4);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });

    it('only unsubscribes the specific subscriber', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsub1 = subscribeToEditorSettings(callback1);
      const unsub2 = subscribeToEditorSettings(callback2);

      callback1.mockClear();
      callback2.mockClear();

      unsub1();
      setWordWrap(true);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);

      unsub2();
    });

    it('receives a snapshot copy, not a reference', () => {
      const received: Array<any> = [];
      const callback = (settings: any) => {
        received.push(settings);
      };

      const unsubscribe = subscribeToEditorSettings(callback);
      setTabSize(4);

      // The two received objects should be different references
      expect(received.length).toBe(2);
      expect(received[0]).not.toBe(received[1]);
      expect(received[0]).toEqual(DEFAULT_SETTINGS);
      expect(received[1]).toEqual({
        ...DEFAULT_SETTINGS,
        tabSize: 4,
      });

      unsubscribe();
    });
  });

  describe('combined operations', () => {
    it('handles multiple setting changes', () => {
      setTabSize(4);
      setWordWrap(true);

      const settings = getEditorSettings();
      expect(settings).toEqual({
        ...DEFAULT_SETTINGS,
        tabSize: 4,
        wordWrap: true,
      });
    });

    it('persists combined state correctly', () => {
      setTabSize(4);
      localStorageMock.setItem.mockClear();

      setWordWrap(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kode-editor-settings',
        JSON.stringify({ ...DEFAULT_SETTINGS, tabSize: 4, wordWrap: true })
      );
    });

    it('roundtrips through init correctly', () => {
      setTabSize(4);
      setWordWrap(true);

      // Simulate app restart by re-initializing
      initEditorSettings();

      const settings = getEditorSettings();
      expect(settings).toEqual({
        ...DEFAULT_SETTINGS,
        tabSize: 4,
        wordWrap: true,
      });
    });
  });
});
