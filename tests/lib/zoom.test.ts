import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initZoom,
  zoomIn,
  zoomOut,
  resetZoom,
  setFontSize,
  getZoomPercentage,
  subscribeToZoom,
  currentFontSize,
  DEFAULT_FONT_SIZE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  ZOOM_STEP,
} from '../../src/lib/zoom';

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

describe('Zoom Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset to default state
    resetZoom();
  });

  describe('Constants', () => {
    it('has valid default constants', () => {
      expect(DEFAULT_FONT_SIZE).toBe(13);
      expect(MIN_FONT_SIZE).toBe(8);
      expect(MAX_FONT_SIZE).toBe(32);
      expect(ZOOM_STEP).toBe(1);
    });
  });

  describe('initZoom', () => {
    it('initializes with default font size when no saved value', () => {
      localStorageMock.clear();
      initZoom();
      expect(getZoomPercentage()).toBe(100);
    });

    it('loads saved font size from localStorage', () => {
      localStorageMock.setItem('kode-zoom', '16');
      initZoom();
      expect(getZoomPercentage()).toBe(Math.round((16 / DEFAULT_FONT_SIZE) * 100));
    });

    it('ignores invalid saved values', () => {
      localStorageMock.setItem('kode-zoom', 'invalid');
      initZoom();
      expect(getZoomPercentage()).toBe(100);
    });

    it('ignores out-of-range saved values (too small)', () => {
      localStorageMock.setItem('kode-zoom', '2');
      initZoom();
      expect(getZoomPercentage()).toBe(100);
    });

    it('ignores out-of-range saved values (too large)', () => {
      localStorageMock.setItem('kode-zoom', '100');
      initZoom();
      expect(getZoomPercentage()).toBe(100);
    });
  });

  describe('zoomIn', () => {
    it('increases font size by step', () => {
      resetZoom();
      zoomIn();
      expect(getZoomPercentage()).toBe(
        Math.round(((DEFAULT_FONT_SIZE + ZOOM_STEP) / DEFAULT_FONT_SIZE) * 100)
      );
    });

    it('does not exceed maximum font size', () => {
      setFontSize(MAX_FONT_SIZE);
      zoomIn();
      expect(getZoomPercentage()).toBe(Math.round((MAX_FONT_SIZE / DEFAULT_FONT_SIZE) * 100));
    });

    it('persists to localStorage', () => {
      resetZoom();
      zoomIn();
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kode-zoom',
        String(DEFAULT_FONT_SIZE + ZOOM_STEP)
      );
    });
  });

  describe('zoomOut', () => {
    it('decreases font size by step', () => {
      resetZoom();
      zoomOut();
      expect(getZoomPercentage()).toBe(
        Math.round(((DEFAULT_FONT_SIZE - ZOOM_STEP) / DEFAULT_FONT_SIZE) * 100)
      );
    });

    it('does not go below minimum font size', () => {
      setFontSize(MIN_FONT_SIZE);
      zoomOut();
      expect(getZoomPercentage()).toBe(Math.round((MIN_FONT_SIZE / DEFAULT_FONT_SIZE) * 100));
    });

    it('persists to localStorage', () => {
      resetZoom();
      zoomOut();
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kode-zoom',
        String(DEFAULT_FONT_SIZE - ZOOM_STEP)
      );
    });
  });

  describe('resetZoom', () => {
    it('resets font size to default', () => {
      zoomIn();
      zoomIn();
      zoomIn();
      resetZoom();
      expect(getZoomPercentage()).toBe(100);
    });

    it('persists default to localStorage', () => {
      resetZoom();
      expect(localStorageMock.setItem).toHaveBeenCalledWith('kode-zoom', String(DEFAULT_FONT_SIZE));
    });
  });

  describe('setFontSize', () => {
    it('sets font size directly', () => {
      setFontSize(18);
      expect(getZoomPercentage()).toBe(Math.round((18 / DEFAULT_FONT_SIZE) * 100));
    });

    it('clamps to minimum', () => {
      setFontSize(2);
      expect(getZoomPercentage()).toBe(Math.round((MIN_FONT_SIZE / DEFAULT_FONT_SIZE) * 100));
    });

    it('clamps to maximum', () => {
      setFontSize(100);
      expect(getZoomPercentage()).toBe(Math.round((MAX_FONT_SIZE / DEFAULT_FONT_SIZE) * 100));
    });
  });

  describe('getZoomPercentage', () => {
    it('returns 100 at default font size', () => {
      resetZoom();
      expect(getZoomPercentage()).toBe(100);
    });

    it('returns correct percentage for larger sizes', () => {
      setFontSize(26);
      expect(getZoomPercentage()).toBe(200);
    });

    it('returns correct percentage for smaller sizes', () => {
      setFontSize(10);
      expect(getZoomPercentage()).toBe(77);
    });
  });

  describe('subscribeToZoom', () => {
    it('calls subscriber immediately with current value', () => {
      resetZoom();
      const callback = vi.fn();
      const unsubscribe = subscribeToZoom(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(DEFAULT_FONT_SIZE);

      unsubscribe();
    });

    it('calls subscriber on zoom changes', () => {
      resetZoom();
      const callback = vi.fn();
      const unsubscribe = subscribeToZoom(callback);

      callback.mockClear();
      zoomIn();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(DEFAULT_FONT_SIZE + ZOOM_STEP);

      unsubscribe();
    });

    it('stops calling after unsubscribe', () => {
      resetZoom();
      const callback = vi.fn();
      const unsubscribe = subscribeToZoom(callback);

      callback.mockClear();
      unsubscribe();
      zoomIn();
      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      resetZoom();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsub1 = subscribeToZoom(callback1);
      const unsub2 = subscribeToZoom(callback2);

      callback1.mockClear();
      callback2.mockClear();

      zoomIn();
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });

    it('only unsubscribes the specific subscriber', () => {
      resetZoom();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsub1 = subscribeToZoom(callback1);
      const unsub2 = subscribeToZoom(callback2);

      callback1.mockClear();
      callback2.mockClear();

      unsub1();
      zoomIn();
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);

      unsub2();
    });
  });

  describe('CSS custom property', () => {
    it('sets --editor-font-size on document element', () => {
      resetZoom();
      const style = document.documentElement.style.getPropertyValue('--editor-font-size');
      expect(style).toBe(`${DEFAULT_FONT_SIZE}px`);
    });

    it('updates --editor-font-size on zoom in', () => {
      resetZoom();
      zoomIn();
      const style = document.documentElement.style.getPropertyValue('--editor-font-size');
      expect(style).toBe(`${DEFAULT_FONT_SIZE + ZOOM_STEP}px`);
    });

    it('updates --editor-font-size on zoom out', () => {
      resetZoom();
      zoomOut();
      const style = document.documentElement.style.getPropertyValue('--editor-font-size');
      expect(style).toBe(`${DEFAULT_FONT_SIZE - ZOOM_STEP}px`);
    });
  });
});
