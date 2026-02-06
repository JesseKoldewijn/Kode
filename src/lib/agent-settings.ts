/**
 * Agent Settings Management
 *
 * Manages AI agent configuration (command, args, presets).
 * Persists settings to localStorage.
 * Uses the same pub/sub pattern as editor-settings.ts.
 */

const STORAGE_KEY = 'kode-agent-settings';

export type AgentPreset = 'opencode' | 'custom';

export interface AgentPresetConfig {
  label: string;
  command: string;
  args: string[];
  description: string;
}

export interface AgentSettings {
  preset: AgentPreset;
  command: string;
  args: string[];
}

export const AGENT_PRESETS: Record<AgentPreset, AgentPresetConfig> = {
  opencode: {
    label: 'OpenCode',
    command: 'opencode',
    args: [],
    description: 'OpenCode CLI agent',
  },
  custom: {
    label: 'Custom',
    command: '',
    args: [],
    description: 'Custom agent command',
  },
};

const DEFAULT_SETTINGS: AgentSettings = {
  preset: 'opencode',
  command: 'opencode',
  args: [],
};

// Current settings state
export let currentAgentSettings: AgentSettings = { ...DEFAULT_SETTINGS };

// Callbacks for reactive updates
const listeners: Set<(settings: AgentSettings) => void> = new Set();

/**
 * Subscribe to agent settings changes
 */
export function subscribeToAgentSettings(callback: (settings: AgentSettings) => void): () => void {
  listeners.add(callback);
  callback({ ...currentAgentSettings });
  return () => listeners.delete(callback);
}

function notifyListeners(): void {
  const snapshot = { ...currentAgentSettings };
  listeners.forEach((cb) => cb(snapshot));
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentAgentSettings));
  } catch (e) {
    console.warn('Failed to persist agent settings:', e);
  }
}

/**
 * Set agent preset (also updates command/args to preset defaults unless custom)
 */
export function setAgentPreset(preset: AgentPreset): void {
  const presetConfig = AGENT_PRESETS[preset];
  if (preset === 'custom') {
    // Keep existing custom command/args
    currentAgentSettings = { ...currentAgentSettings, preset: 'custom' };
  } else {
    currentAgentSettings = {
      preset,
      command: presetConfig.command,
      args: [...presetConfig.args],
    };
  }
  persist();
  notifyListeners();
}

/**
 * Set custom agent command
 */
export function setAgentCommand(command: string): void {
  currentAgentSettings = { ...currentAgentSettings, preset: 'custom', command };
  persist();
  notifyListeners();
}

/**
 * Set custom agent args (comma-separated string will be parsed)
 */
export function setAgentArgs(argsStr: string): void {
  const args = argsStr
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
  currentAgentSettings = { ...currentAgentSettings, preset: 'custom', args };
  persist();
  notifyListeners();
}

/**
 * Get current agent settings
 */
export function getAgentSettings(): AgentSettings {
  return { ...currentAgentSettings };
}

/**
 * Initialize agent settings system
 */
export function initAgentSettings(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        if (parsed.preset && parsed.preset in AGENT_PRESETS) {
          currentAgentSettings.preset = parsed.preset;
        }
        if (typeof parsed.command === 'string' && parsed.command.length > 0) {
          currentAgentSettings.command = parsed.command;
        }
        if (Array.isArray(parsed.args)) {
          currentAgentSettings.args = parsed.args.filter((a: unknown) => typeof a === 'string');
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load agent settings:', e);
  }

  notifyListeners();
}
