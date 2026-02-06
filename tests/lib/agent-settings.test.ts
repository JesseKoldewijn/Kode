import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initAgentSettings,
  setAgentPreset,
  setAgentCommand,
  setAgentArgs,
  getAgentSettings,
  subscribeToAgentSettings,
  currentAgentSettings,
  AGENT_PRESETS,
} from '../../src/lib/agent-settings';

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

describe('Agent Settings', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset to defaults
    setAgentPreset('opencode');
  });

  describe('AGENT_PRESETS', () => {
    it('has opencode preset', () => {
      expect(AGENT_PRESETS.opencode).toBeDefined();
      expect(AGENT_PRESETS.opencode.command).toBe('opencode');
    });

    it('has custom preset', () => {
      expect(AGENT_PRESETS.custom).toBeDefined();
      expect(AGENT_PRESETS.custom.command).toBe('');
    });

    it('all presets have required fields', () => {
      for (const [key, config] of Object.entries(AGENT_PRESETS)) {
        expect(config.label).toBeTruthy();
        expect(typeof config.command).toBe('string');
        expect(Array.isArray(config.args)).toBe(true);
        expect(config.description).toBeTruthy();
      }
    });
  });

  describe('Default values', () => {
    it('defaults to opencode preset', () => {
      const settings = getAgentSettings();
      expect(settings.preset).toBe('opencode');
    });

    it('defaults to opencode command', () => {
      const settings = getAgentSettings();
      expect(settings.command).toBe('opencode');
    });

    it('defaults to empty args', () => {
      const settings = getAgentSettings();
      expect(settings.args).toEqual([]);
    });
  });

  describe('initAgentSettings', () => {
    it('initializes with defaults when no saved value', () => {
      localStorageMock.clear();
      initAgentSettings();
      const settings = getAgentSettings();
      expect(settings.preset).toBe('opencode');
      expect(settings.command).toBe('opencode');
    });

    it('loads saved settings from localStorage', () => {
      localStorageMock.setItem(
        'kode-agent-settings',
        JSON.stringify({ preset: 'custom', command: 'my-agent', args: [] })
      );
      initAgentSettings();
      const settings = getAgentSettings();
      expect(settings.preset).toBe('custom');
      expect(settings.command).toBe('my-agent');
    });

    it('ignores invalid JSON in localStorage', () => {
      localStorageMock.setItem('kode-agent-settings', 'not-json');
      initAgentSettings();
      const settings = getAgentSettings();
      expect(settings.preset).toBe('opencode');
    });

    it('ignores invalid preset values', () => {
      localStorageMock.setItem(
        'kode-agent-settings',
        JSON.stringify({ preset: 'invalid-preset', command: 'foo', args: [] })
      );
      initAgentSettings();
      const settings = getAgentSettings();
      expect(settings.preset).toBe('opencode'); // Falls back
    });

    it('loads valid command from saved settings', () => {
      localStorageMock.setItem(
        'kode-agent-settings',
        JSON.stringify({ preset: 'custom', command: 'my-agent', args: ['--flag'] })
      );
      initAgentSettings();
      const settings = getAgentSettings();
      expect(settings.command).toBe('my-agent');
      expect(settings.args).toEqual(['--flag']);
    });

    it('ignores empty command strings', () => {
      localStorageMock.setItem(
        'kode-agent-settings',
        JSON.stringify({ preset: 'opencode', command: '', args: [] })
      );
      initAgentSettings();
      expect(getAgentSettings().command).toBe('opencode'); // Kept from default
    });

    it('filters non-string args', () => {
      localStorageMock.setItem(
        'kode-agent-settings',
        JSON.stringify({
          preset: 'custom',
          command: 'test',
          args: ['valid', 123, null, 'also-valid'],
        })
      );
      initAgentSettings();
      expect(getAgentSettings().args).toEqual(['valid', 'also-valid']);
    });

    it('notifies listeners after initialization', () => {
      const callback = vi.fn();
      subscribeToAgentSettings(callback);
      callback.mockClear();

      localStorageMock.setItem(
        'kode-agent-settings',
        JSON.stringify({ preset: 'custom', command: 'my-agent', args: [] })
      );
      initAgentSettings();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('setAgentPreset', () => {
    it('switches to custom preset', () => {
      setAgentPreset('custom');
      const settings = getAgentSettings();
      expect(settings.preset).toBe('custom');
    });

    it('keeps existing command/args when switching to custom', () => {
      setAgentCommand('my-custom-agent');
      setAgentPreset('custom');
      const settings = getAgentSettings();
      expect(settings.preset).toBe('custom');
      expect(settings.command).toBe('my-custom-agent');
    });

    it('persists to localStorage', () => {
      setAgentPreset('custom');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kode-agent-settings',
        expect.any(String)
      );
      const stored = JSON.parse(
        localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1]
      );
      expect(stored.preset).toBe('custom');
    });

    it('notifies listeners', () => {
      const callback = vi.fn();
      subscribeToAgentSettings(callback);
      callback.mockClear();

      setAgentPreset('custom');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ preset: 'custom' }));
    });
  });

  describe('setAgentCommand', () => {
    it('sets a custom command', () => {
      setAgentCommand('my-agent');
      expect(getAgentSettings().command).toBe('my-agent');
    });

    it('automatically switches to custom preset', () => {
      setAgentPreset('opencode');
      setAgentCommand('my-agent');
      expect(getAgentSettings().preset).toBe('custom');
    });

    it('persists to localStorage', () => {
      setAgentCommand('my-agent');
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('notifies listeners', () => {
      const callback = vi.fn();
      subscribeToAgentSettings(callback);
      callback.mockClear();

      setAgentCommand('test-agent');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('setAgentArgs', () => {
    it('parses comma-separated args', () => {
      setAgentArgs('--flag1, --flag2, --flag3');
      expect(getAgentSettings().args).toEqual(['--flag1', '--flag2', '--flag3']);
    });

    it('trims whitespace from args', () => {
      setAgentArgs('  --flag1  ,  --flag2  ');
      expect(getAgentSettings().args).toEqual(['--flag1', '--flag2']);
    });

    it('filters empty args', () => {
      setAgentArgs('--flag1,,, --flag2,');
      expect(getAgentSettings().args).toEqual(['--flag1', '--flag2']);
    });

    it('handles empty string', () => {
      setAgentArgs('');
      expect(getAgentSettings().args).toEqual([]);
    });

    it('automatically switches to custom preset', () => {
      setAgentPreset('opencode');
      setAgentArgs('--my-flag');
      expect(getAgentSettings().preset).toBe('custom');
    });

    it('persists to localStorage', () => {
      localStorageMock.setItem.mockClear();
      setAgentArgs('--flag');
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('getAgentSettings', () => {
    it('returns a copy, not a reference', () => {
      const s1 = getAgentSettings();
      const s2 = getAgentSettings();
      expect(s1).not.toBe(s2);
      expect(s1).toEqual(s2);
    });

    it('reflects current state', () => {
      setAgentCommand('my-agent');
      const settings = getAgentSettings();
      expect(settings).toEqual({
        preset: 'custom',
        command: 'my-agent',
        args: [],
      });
    });
  });

  describe('subscribeToAgentSettings', () => {
    it('calls subscriber immediately with current value', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToAgentSettings(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ preset: 'opencode' }));

      unsubscribe();
    });

    it('calls subscriber on preset changes', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToAgentSettings(callback);
      callback.mockClear();

      setAgentPreset('custom');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('stops calling after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToAgentSettings(callback);
      callback.mockClear();

      unsubscribe();
      setAgentPreset('custom');
      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = subscribeToAgentSettings(cb1);
      const unsub2 = subscribeToAgentSettings(cb2);

      cb1.mockClear();
      cb2.mockClear();

      setAgentPreset('custom');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });

    it('only unsubscribes the specific subscriber', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = subscribeToAgentSettings(cb1);
      const unsub2 = subscribeToAgentSettings(cb2);

      cb1.mockClear();
      cb2.mockClear();

      unsub1();
      setAgentPreset('custom');

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);

      unsub2();
    });
  });

  describe('combined operations', () => {
    it('handles preset then custom override', () => {
      setAgentPreset('opencode');
      setAgentCommand('my-custom');
      setAgentArgs('--verbose');

      const settings = getAgentSettings();
      expect(settings.preset).toBe('custom');
      expect(settings.command).toBe('my-custom');
      expect(settings.args).toEqual(['--verbose']);
    });

    it('roundtrips through init correctly', () => {
      setAgentCommand('my-agent');

      // Simulate app restart
      initAgentSettings();

      const settings = getAgentSettings();
      expect(settings.preset).toBe('custom');
      expect(settings.command).toBe('my-agent');
    });
  });
});
