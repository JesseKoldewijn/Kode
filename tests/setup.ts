// Test setup file
import { vi } from 'vitest';

// IMPORTANT: These mocks are ONLY for the test suite
// They should NOT affect Tauri dev mode or production builds

// Mock Tauri APIs - core and event are separate modules
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd: string, args?: unknown) => {
    // Return appropriate values based on command
    switch (cmd) {
      case 'read_directory':
        return Promise.resolve([]);
      case 'get_git_status':
        return Promise.resolve({});
      case 'read_file':
        return Promise.resolve('test content');
      case 'write_file':
        return Promise.resolve(undefined);
      case 'lsp_has_session':
        return Promise.resolve(false);
      case 'lsp_get_diagnostics':
        return Promise.resolve([]);
      case 'lsp_goto_definition':
        return Promise.resolve(null);
      case 'lsp_hover':
        return Promise.resolve(null);
      case 'lsp_completion':
        return Promise.resolve(null);
      case 'lsp_signature_help':
        return Promise.resolve({
          signatures: [
            {
              label: 'mockFunction(param: string): void',
              documentation: 'Mock signature help for testing',
              parameters: [
                { label: 'param: string', documentation: 'Parameter description' },
              ],
            },
          ],
          activeSignature: 0,
          activeParameter: 0,
        });
      default:
        return Promise.resolve(null);
    }
  }),
  transformCallback: vi.fn().mockImplementation((callback) => {
    // Return a callback id
    return Math.random();
  }),
}));

// Do NOT mock @tauri-apps/api/mocks - it's needed by our browser mock system
// vi.mock('@tauri-apps/api/mocks', () => ({ ... }));  // WRONG!

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
  once: vi.fn().mockResolvedValue(() => {}),
}));

// Legacy combined mock for backwards compatibility
vi.mock('@tauri-apps/api', () => ({
  invoke: vi.fn().mockResolvedValue(null),
  event: {
    listen: vi.fn().mockResolvedValue(() => {}),
    emit: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn().mockResolvedValue([]),
  readTextFile: vi.fn().mockResolvedValue(''),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  mkdir: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ isDirectory: false, isFile: true }),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: {
    create: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
      spawn: vi.fn().mockResolvedValue({ pid: 1, kill: vi.fn(), write: vi.fn() }),
      on: vi.fn(),
    }),
  },
  open: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
    clear: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  })),
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@tauri-apps/plugin-log', () => ({
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  exit: vi.fn().mockResolvedValue(undefined),
  relaunch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
  message: vi.fn().mockResolvedValue(undefined),
  ask: vi.fn().mockResolvedValue(false),
  confirm: vi.fn().mockResolvedValue(false),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    isFullscreen: vi.fn().mockResolvedValue(false),
    setFullscreen: vi.fn().mockResolvedValue(undefined),
    setTitle: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    center: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
    maximize: vi.fn().mockResolvedValue(undefined),
    minimize: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver - allows tests to trigger resize via __triggerResizeObserver__(height)
const resizeObserverEntries: { callback: ResizeObserverCallback; element: Element }[] = [];
class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe = vi.fn((element: Element) => {
    resizeObserverEntries.push({ callback: this.callback, element });
  });
  unobserve = vi.fn();
  disconnect = vi.fn(() => {
    const idx = resizeObserverEntries.findIndex((e) => e.callback === this.callback);
    if (idx !== -1) resizeObserverEntries.splice(idx, 1);
  });
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
(global as any).__triggerResizeObserver__ = (height: number) => {
  const contentRect = { height, width: 800, top: 0, left: 0, bottom: height, right: 800, x: 0, y: 0, toJSON: () => ({}) };
  resizeObserverEntries.forEach(({ callback, element }) => {
    const entry = { contentRect, target: element } as ResizeObserverEntry;
    callback([entry], {} as ResizeObserver);
  });
};

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
