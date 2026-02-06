import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initTheme,
  setTheme,
  getTheme,
  toggleTheme,
  cycleTheme,
  subscribe,
  currentMode,
  resolvedTheme,
} from '../../src/lib/theme';

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

describe('Theme', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset to system default
    setTheme('system');
  });

  describe('Default values', () => {
    it('defaults to system mode', () => {
      const config = getTheme();
      expect(config.mode).toBe('system');
    });

    it('resolves system to dark (matchMedia returns false for light)', () => {
      const config = getTheme();
      // window.matchMedia is mocked to return matches: false for all queries
      // So prefers-color-scheme: light matches false => dark
      expect(config.resolvedTheme).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('sets to dark mode', () => {
      setTheme('dark');
      expect(getTheme().mode).toBe('dark');
      expect(getTheme().resolvedTheme).toBe('dark');
    });

    it('sets to light mode', () => {
      setTheme('light');
      expect(getTheme().mode).toBe('light');
      expect(getTheme().resolvedTheme).toBe('light');
    });

    it('sets to system mode', () => {
      setTheme('light');
      setTheme('system');
      expect(getTheme().mode).toBe('system');
    });

    it('persists to localStorage', () => {
      setTheme('dark');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('kode-theme', 'dark');
    });

    it('applies dark class to document', () => {
      setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });

    it('applies light class to document', () => {
      setTheme('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('sets data-theme attribute', () => {
      setTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      setTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('notifies listeners', () => {
      const callback = vi.fn();
      subscribe(callback);
      callback.mockClear();

      setTheme('light');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ mode: 'light', resolvedTheme: 'light' });
    });
  });

  describe('initTheme', () => {
    it('initializes with defaults when no saved value', () => {
      localStorageMock.clear();
      initTheme();
      expect(getTheme().mode).toBe('system');
    });

    it('loads saved theme from localStorage', () => {
      localStorageMock.setItem('kode-theme', 'light');
      initTheme();
      expect(getTheme().mode).toBe('light');
      expect(getTheme().resolvedTheme).toBe('light');
    });

    it('loads dark theme from localStorage', () => {
      localStorageMock.setItem('kode-theme', 'dark');
      initTheme();
      expect(getTheme().mode).toBe('dark');
    });

    it('ignores invalid values in localStorage', () => {
      localStorageMock.setItem('kode-theme', 'invalid');
      initTheme();
      expect(getTheme().mode).toBe('system');
    });

    it('notifies listeners after initialization', () => {
      const callback = vi.fn();
      subscribe(callback);
      callback.mockClear();

      initTheme();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('applies theme to DOM on init', () => {
      localStorageMock.setItem('kode-theme', 'light');
      initTheme();
      expect(document.documentElement.classList.contains('light')).toBe(true);
    });
  });

  describe('toggleTheme', () => {
    it('toggles from dark to light', () => {
      setTheme('dark');
      toggleTheme();
      expect(getTheme().mode).toBe('light');
      expect(getTheme().resolvedTheme).toBe('light');
    });

    it('toggles from light to dark', () => {
      setTheme('light');
      toggleTheme();
      expect(getTheme().mode).toBe('dark');
      expect(getTheme().resolvedTheme).toBe('dark');
    });

    it('toggles from system (resolved dark) to light', () => {
      setTheme('system');
      // System resolves to dark because matchMedia returns false for light
      toggleTheme();
      expect(getTheme().resolvedTheme).toBe('light');
    });

    it('persists the toggled value', () => {
      setTheme('dark');
      localStorageMock.setItem.mockClear();
      toggleTheme();
      expect(localStorageMock.setItem).toHaveBeenCalledWith('kode-theme', 'light');
    });
  });

  describe('cycleTheme', () => {
    it('cycles from system to light', () => {
      setTheme('system');
      cycleTheme();
      expect(getTheme().mode).toBe('light');
    });

    it('cycles from light to dark', () => {
      setTheme('light');
      cycleTheme();
      expect(getTheme().mode).toBe('dark');
    });

    it('cycles from dark to system', () => {
      setTheme('dark');
      cycleTheme();
      expect(getTheme().mode).toBe('system');
    });

    it('full cycle: system -> light -> dark -> system', () => {
      setTheme('system');
      cycleTheme();
      expect(getTheme().mode).toBe('light');
      cycleTheme();
      expect(getTheme().mode).toBe('dark');
      cycleTheme();
      expect(getTheme().mode).toBe('system');
    });
  });

  describe('getTheme', () => {
    it('returns mode and resolvedTheme', () => {
      setTheme('light');
      const config = getTheme();
      expect(config).toEqual({ mode: 'light', resolvedTheme: 'light' });
    });
  });

  describe('subscribe', () => {
    it('calls subscriber immediately with current value', () => {
      setTheme('dark');
      const callback = vi.fn();
      const unsubscribe = subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ mode: 'dark', resolvedTheme: 'dark' });

      unsubscribe();
    });

    it('calls subscriber on theme changes', () => {
      const callback = vi.fn();
      const unsubscribe = subscribe(callback);
      callback.mockClear();

      setTheme('light');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('stops calling after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = subscribe(callback);
      callback.mockClear();

      unsubscribe();
      setTheme('light');
      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = subscribe(cb1);
      const unsub2 = subscribe(cb2);

      cb1.mockClear();
      cb2.mockClear();

      setTheme('light');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });

    it('only unsubscribes the specific subscriber', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = subscribe(cb1);
      const unsub2 = subscribe(cb2);

      cb1.mockClear();
      cb2.mockClear();

      unsub1();
      setTheme('dark');

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);

      unsub2();
    });
  });
});
