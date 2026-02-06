import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initPanelSizes,
  setSidebarWidth,
  setChatWidth,
  setPanelHeight,
  getPanelSizes,
  subscribeToPanelSizes,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_CHAT_WIDTH,
  MAX_CHAT_WIDTH,
  MIN_PANEL_HEIGHT,
  MAX_PANEL_HEIGHT,
} from '../../src/lib/panel-sizes';

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

describe('Panel Sizes', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset to defaults
    setSidebarWidth(240);
    setChatWidth(320);
    setPanelHeight(200);
  });

  describe('Constants', () => {
    it('has correct sidebar width constraints', () => {
      expect(MIN_SIDEBAR_WIDTH).toBe(160);
      expect(MAX_SIDEBAR_WIDTH).toBe(500);
    });

    it('has correct chat width constraints', () => {
      expect(MIN_CHAT_WIDTH).toBe(240);
      expect(MAX_CHAT_WIDTH).toBe(600);
    });

    it('has correct panel height constraints', () => {
      expect(MIN_PANEL_HEIGHT).toBe(100);
      expect(MAX_PANEL_HEIGHT).toBe(500);
    });
  });

  describe('Default values', () => {
    it('defaults sidebar width to 240', () => {
      expect(getPanelSizes().sidebarWidth).toBe(240);
    });

    it('defaults chat width to 320', () => {
      expect(getPanelSizes().chatWidth).toBe(320);
    });

    it('defaults panel height to 200', () => {
      expect(getPanelSizes().panelHeight).toBe(200);
    });
  });

  describe('initPanelSizes', () => {
    it('initializes with defaults when no saved value', () => {
      localStorageMock.clear();
      initPanelSizes();
      const sizes = getPanelSizes();
      expect(sizes.sidebarWidth).toBe(240);
      expect(sizes.chatWidth).toBe(320);
      expect(sizes.panelHeight).toBe(200);
    });

    it('loads saved sizes from localStorage', () => {
      localStorageMock.setItem(
        'kode-panel-sizes',
        JSON.stringify({ sidebarWidth: 300, chatWidth: 400, panelHeight: 250 })
      );
      initPanelSizes();
      const sizes = getPanelSizes();
      expect(sizes.sidebarWidth).toBe(300);
      expect(sizes.chatWidth).toBe(400);
      expect(sizes.panelHeight).toBe(250);
    });

    it('clamps loaded values to min/max bounds', () => {
      localStorageMock.setItem(
        'kode-panel-sizes',
        JSON.stringify({ sidebarWidth: 10, chatWidth: 9999, panelHeight: 50 })
      );
      initPanelSizes();
      const sizes = getPanelSizes();
      expect(sizes.sidebarWidth).toBe(MIN_SIDEBAR_WIDTH);
      expect(sizes.chatWidth).toBe(MAX_CHAT_WIDTH);
      expect(sizes.panelHeight).toBe(MIN_PANEL_HEIGHT);
    });

    it('ignores invalid JSON in localStorage', () => {
      localStorageMock.setItem('kode-panel-sizes', 'not-json');
      initPanelSizes();
      // Should keep current values (defaults from beforeEach)
      const sizes = getPanelSizes();
      expect(sizes.sidebarWidth).toBe(240);
    });

    it('ignores non-number values', () => {
      localStorageMock.setItem(
        'kode-panel-sizes',
        JSON.stringify({ sidebarWidth: 'wide', chatWidth: null, panelHeight: true })
      );
      initPanelSizes();
      // Non-number values should be skipped, keeping current values
      const sizes = getPanelSizes();
      expect(sizes.sidebarWidth).toBe(240);
      expect(sizes.chatWidth).toBe(320);
      expect(sizes.panelHeight).toBe(200);
    });
  });

  describe('setSidebarWidth', () => {
    it('sets sidebar width', () => {
      setSidebarWidth(300);
      expect(getPanelSizes().sidebarWidth).toBe(300);
    });

    it('clamps to minimum', () => {
      setSidebarWidth(10);
      expect(getPanelSizes().sidebarWidth).toBe(MIN_SIDEBAR_WIDTH);
    });

    it('clamps to maximum', () => {
      setSidebarWidth(9999);
      expect(getPanelSizes().sidebarWidth).toBe(MAX_SIDEBAR_WIDTH);
    });

    it('persists to localStorage', () => {
      localStorageMock.setItem.mockClear();
      setSidebarWidth(300);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('kode-panel-sizes', expect.any(String));
      const stored = JSON.parse(
        localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1]
      );
      expect(stored.sidebarWidth).toBe(300);
    });

    it('notifies subscribers', () => {
      const callback = vi.fn();
      subscribeToPanelSizes(callback);
      callback.mockClear();

      setSidebarWidth(300);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ sidebarWidth: 300 }));
    });
  });

  describe('setChatWidth', () => {
    it('sets chat width', () => {
      setChatWidth(400);
      expect(getPanelSizes().chatWidth).toBe(400);
    });

    it('clamps to minimum', () => {
      setChatWidth(10);
      expect(getPanelSizes().chatWidth).toBe(MIN_CHAT_WIDTH);
    });

    it('clamps to maximum', () => {
      setChatWidth(9999);
      expect(getPanelSizes().chatWidth).toBe(MAX_CHAT_WIDTH);
    });

    it('persists to localStorage', () => {
      localStorageMock.setItem.mockClear();
      setChatWidth(400);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('notifies subscribers', () => {
      const callback = vi.fn();
      subscribeToPanelSizes(callback);
      callback.mockClear();

      setChatWidth(400);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ chatWidth: 400 }));
    });
  });

  describe('setPanelHeight', () => {
    it('sets panel height', () => {
      setPanelHeight(300);
      expect(getPanelSizes().panelHeight).toBe(300);
    });

    it('clamps to minimum', () => {
      setPanelHeight(10);
      expect(getPanelSizes().panelHeight).toBe(MIN_PANEL_HEIGHT);
    });

    it('clamps to maximum', () => {
      setPanelHeight(9999);
      expect(getPanelSizes().panelHeight).toBe(MAX_PANEL_HEIGHT);
    });

    it('persists to localStorage', () => {
      localStorageMock.setItem.mockClear();
      setPanelHeight(300);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('notifies subscribers', () => {
      const callback = vi.fn();
      subscribeToPanelSizes(callback);
      callback.mockClear();

      setPanelHeight(300);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ panelHeight: 300 }));
    });
  });

  describe('getPanelSizes', () => {
    it('returns a copy, not a reference', () => {
      const s1 = getPanelSizes();
      const s2 = getPanelSizes();
      expect(s1).not.toBe(s2);
      expect(s1).toEqual(s2);
    });

    it('reflects current state', () => {
      setSidebarWidth(350);
      setChatWidth(450);
      setPanelHeight(250);
      expect(getPanelSizes()).toEqual({
        sidebarWidth: 350,
        chatWidth: 450,
        panelHeight: 250,
      });
    });
  });

  describe('subscribeToPanelSizes', () => {
    it('calls subscriber immediately with current value', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToPanelSizes(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        sidebarWidth: 240,
        chatWidth: 320,
        panelHeight: 200,
      });

      unsubscribe();
    });

    it('calls subscriber on changes', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToPanelSizes(callback);
      callback.mockClear();

      setSidebarWidth(300);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('stops calling after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToPanelSizes(callback);
      callback.mockClear();

      unsubscribe();
      setSidebarWidth(300);
      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = subscribeToPanelSizes(cb1);
      const unsub2 = subscribeToPanelSizes(cb2);

      cb1.mockClear();
      cb2.mockClear();

      setSidebarWidth(300);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });

    it('only unsubscribes the specific subscriber', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = subscribeToPanelSizes(cb1);
      const unsub2 = subscribeToPanelSizes(cb2);

      cb1.mockClear();
      cb2.mockClear();

      unsub1();
      setChatWidth(400);

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);

      unsub2();
    });
  });

  describe('combined operations', () => {
    it('handles multiple dimension changes', () => {
      setSidebarWidth(350);
      setChatWidth(450);
      setPanelHeight(300);

      expect(getPanelSizes()).toEqual({
        sidebarWidth: 350,
        chatWidth: 450,
        panelHeight: 300,
      });
    });

    it('persists combined state correctly', () => {
      setSidebarWidth(350);
      setChatWidth(450);
      localStorageMock.setItem.mockClear();

      setPanelHeight(300);
      const stored = JSON.parse(
        localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1]
      );
      expect(stored).toEqual({
        sidebarWidth: 350,
        chatWidth: 450,
        panelHeight: 300,
      });
    });
  });
});
