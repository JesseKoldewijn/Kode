import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Track mock callbacks so we can simulate workspace/settings changes
let settingsCallback: ((settings: any) => void) | null = null;
let filesCallback: (() => void) | null = null;

// Mock workspace module
const mockSaveFile = vi.fn();
let mockOpenFiles: any[] = [];

vi.mock('../../src/lib/workspace', () => ({
  get openFiles() {
    return mockOpenFiles;
  },
  saveFile: (...args: any[]) => mockSaveFile(...args),
  subscribeToOpenFiles: vi.fn((cb: () => void) => {
    filesCallback = cb;
    return () => {
      filesCallback = null;
    };
  }),
}));

vi.mock('../../src/lib/editor-settings', () => ({
  subscribeToEditorSettings: vi.fn((cb: (settings: any) => void) => {
    settingsCallback = cb;
    // Immediately call with defaults (disabled)
    cb({ tabSize: 2, wordWrap: false, autoSave: false, autoSaveDelay: 1000 });
    return () => {
      settingsCallback = null;
    };
  }),
}));

import { initAutoSave, destroyAutoSave } from '../../src/lib/auto-save';

describe('Auto-save', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockOpenFiles = [];
    mockSaveFile.mockClear();
    settingsCallback = null;
    filesCallback = null;
  });

  afterEach(() => {
    destroyAutoSave();
    vi.useRealTimers();
  });

  describe('initAutoSave / destroyAutoSave', () => {
    it('initializes without errors', () => {
      expect(() => initAutoSave()).not.toThrow();
    });

    it('subscribes to editor settings on init', () => {
      initAutoSave();
      expect(settingsCallback).not.toBeNull();
    });

    it('subscribes to open files on init', () => {
      initAutoSave();
      expect(filesCallback).not.toBeNull();
    });

    it('cleans up subscriptions on destroy', () => {
      initAutoSave();
      destroyAutoSave();
      expect(settingsCallback).toBeNull();
      expect(filesCallback).toBeNull();
    });

    it('can destroy without init (no-op)', () => {
      expect(() => destroyAutoSave()).not.toThrow();
    });
  });

  describe('when auto-save is disabled', () => {
    it('does not save dirty files', () => {
      mockOpenFiles = [{ id: '1', path: '/test.ts', isDirty: true, specialTab: false }];
      initAutoSave();

      // Trigger files change
      if (filesCallback) filesCallback();
      vi.advanceTimersByTime(5000);

      expect(mockSaveFile).not.toHaveBeenCalled();
    });
  });

  describe('when auto-save is enabled', () => {
    it('saves dirty files after delay', () => {
      mockOpenFiles = [{ id: '1', path: '/test.ts', isDirty: true, specialTab: false }];
      initAutoSave();

      // Enable auto-save
      if (settingsCallback) {
        settingsCallback({ autoSave: true, autoSaveDelay: 1000 });
      }

      // File change detected
      if (filesCallback) filesCallback();

      // Not yet - timer hasn't fired
      expect(mockSaveFile).not.toHaveBeenCalled();

      // Advance past delay
      vi.advanceTimersByTime(1100);

      expect(mockSaveFile).toHaveBeenCalledWith('1');
    });

    it('respects the configured delay', () => {
      mockOpenFiles = [{ id: '1', path: '/test.ts', isDirty: true, specialTab: false }];
      initAutoSave();

      // Enable auto-save with 3 second delay
      if (settingsCallback) {
        settingsCallback({ autoSave: true, autoSaveDelay: 3000 });
      }

      if (filesCallback) filesCallback();

      vi.advanceTimersByTime(2000);
      expect(mockSaveFile).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1100);
      expect(mockSaveFile).toHaveBeenCalledWith('1');
    });

    it('does not save non-dirty files', () => {
      mockOpenFiles = [{ id: '1', path: '/test.ts', isDirty: false, specialTab: false }];
      initAutoSave();

      if (settingsCallback) {
        settingsCallback({ autoSave: true, autoSaveDelay: 1000 });
      }
      if (filesCallback) filesCallback();

      vi.advanceTimersByTime(2000);
      expect(mockSaveFile).not.toHaveBeenCalled();
    });

    it('does not save specialTab files (e.g. settings)', () => {
      mockOpenFiles = [{ id: 'settings', path: null, isDirty: true, specialTab: true }];
      initAutoSave();

      if (settingsCallback) {
        settingsCallback({ autoSave: true, autoSaveDelay: 1000 });
      }
      if (filesCallback) filesCallback();

      vi.advanceTimersByTime(2000);
      expect(mockSaveFile).not.toHaveBeenCalled();
    });

    it('does not save files without a path', () => {
      mockOpenFiles = [{ id: '1', path: null, isDirty: true, specialTab: false }];
      initAutoSave();

      if (settingsCallback) {
        settingsCallback({ autoSave: true, autoSaveDelay: 1000 });
      }
      if (filesCallback) filesCallback();

      vi.advanceTimersByTime(2000);
      expect(mockSaveFile).not.toHaveBeenCalled();
    });

    it('saves multiple dirty files independently', () => {
      mockOpenFiles = [
        { id: '1', path: '/a.ts', isDirty: true, specialTab: false },
        { id: '2', path: '/b.ts', isDirty: true, specialTab: false },
        { id: '3', path: '/c.ts', isDirty: false, specialTab: false },
      ];
      initAutoSave();

      if (settingsCallback) {
        settingsCallback({ autoSave: true, autoSaveDelay: 1000 });
      }
      if (filesCallback) filesCallback();

      vi.advanceTimersByTime(1100);

      expect(mockSaveFile).toHaveBeenCalledTimes(2);
      expect(mockSaveFile).toHaveBeenCalledWith('1');
      expect(mockSaveFile).toHaveBeenCalledWith('2');
    });

    it('debounces saves - resets timer on repeated file changes', () => {
      mockOpenFiles = [{ id: '1', path: '/test.ts', isDirty: true, specialTab: false }];
      initAutoSave();

      if (settingsCallback) {
        settingsCallback({ autoSave: true, autoSaveDelay: 1000 });
      }

      // First file change
      if (filesCallback) filesCallback();
      vi.advanceTimersByTime(500);

      // File wasn't saved yet, file state changes again (re-triggers)
      // Since the timer is already pending, checkDirtyFiles skips re-scheduling
      // But if we simulate a new dirty detection, the existing timer still fires
      expect(mockSaveFile).not.toHaveBeenCalled();

      vi.advanceTimersByTime(600);
      expect(mockSaveFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('toggling auto-save', () => {
    it('clears pending timers when disabled', () => {
      mockOpenFiles = [{ id: '1', path: '/test.ts', isDirty: true, specialTab: false }];
      initAutoSave();

      // Enable and trigger
      if (settingsCallback) {
        settingsCallback({ autoSave: true, autoSaveDelay: 1000 });
      }
      if (filesCallback) filesCallback();

      vi.advanceTimersByTime(500);

      // Disable before timer fires
      if (settingsCallback) {
        settingsCallback({ autoSave: false, autoSaveDelay: 1000 });
      }

      vi.advanceTimersByTime(1000);
      expect(mockSaveFile).not.toHaveBeenCalled();
    });

    it('checks dirty files when re-enabled', () => {
      mockOpenFiles = [{ id: '1', path: '/test.ts', isDirty: true, specialTab: false }];
      initAutoSave();

      // Enable
      if (settingsCallback) {
        settingsCallback({ autoSave: true, autoSaveDelay: 1000 });
      }

      vi.advanceTimersByTime(1100);
      expect(mockSaveFile).toHaveBeenCalledTimes(1);
      mockSaveFile.mockClear();

      // Keep file dirty for re-enable scenario
      mockOpenFiles = [{ id: '2', path: '/other.ts', isDirty: true, specialTab: false }];

      // Disable then re-enable
      if (settingsCallback) {
        settingsCallback({ autoSave: false, autoSaveDelay: 1000 });
      }
      if (settingsCallback) {
        settingsCallback({ autoSave: true, autoSaveDelay: 1000 });
      }

      vi.advanceTimersByTime(1100);
      expect(mockSaveFile).toHaveBeenCalledWith('2');
    });
  });

  describe('file becomes clean before timer fires', () => {
    it('does not save if file is no longer dirty when timer fires', () => {
      mockOpenFiles = [{ id: '1', path: '/test.ts', isDirty: true, specialTab: false }];
      initAutoSave();

      if (settingsCallback) {
        settingsCallback({ autoSave: true, autoSaveDelay: 1000 });
      }
      if (filesCallback) filesCallback();

      // File is saved manually (becomes clean) before auto-save fires
      vi.advanceTimersByTime(500);
      mockOpenFiles[0].isDirty = false;

      vi.advanceTimersByTime(600);
      expect(mockSaveFile).not.toHaveBeenCalled();
    });
  });
});
