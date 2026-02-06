// Panel layout persistence module
// Manages sidebar width, chat panel width, and bottom panel height

export interface PanelSizes {
  sidebarWidth: number;
  chatWidth: number;
  panelHeight: number;
}

const STORAGE_KEY = 'kode-panel-sizes';

const DEFAULT_SIZES: PanelSizes = {
  sidebarWidth: 240,
  chatWidth: 320,
  panelHeight: 200,
};

// Constraints
export const MIN_SIDEBAR_WIDTH = 160;
export const MAX_SIDEBAR_WIDTH = 500;
export const MIN_CHAT_WIDTH = 240;
export const MAX_CHAT_WIDTH = 600;
export const MIN_PANEL_HEIGHT = 100;
export const MAX_PANEL_HEIGHT = 500;

// Module-level state
let sizes: PanelSizes = { ...DEFAULT_SIZES };
const subscribers: Set<(sizes: PanelSizes) => void> = new Set();

function notify(): void {
  const snapshot = { ...sizes };
  subscribers.forEach((cb) => cb(snapshot));
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    // Ignore storage errors
  }
}

export function initPanelSizes(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.sidebarWidth === 'number') {
        sizes.sidebarWidth = clamp(parsed.sidebarWidth, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
      }
      if (typeof parsed.chatWidth === 'number') {
        sizes.chatWidth = clamp(parsed.chatWidth, MIN_CHAT_WIDTH, MAX_CHAT_WIDTH);
      }
      if (typeof parsed.panelHeight === 'number') {
        sizes.panelHeight = clamp(parsed.panelHeight, MIN_PANEL_HEIGHT, MAX_PANEL_HEIGHT);
      }
    }
  } catch {
    // Ignore parse errors, use defaults
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function setSidebarWidth(width: number): void {
  sizes.sidebarWidth = clamp(width, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
  persist();
  notify();
}

export function setChatWidth(width: number): void {
  sizes.chatWidth = clamp(width, MIN_CHAT_WIDTH, MAX_CHAT_WIDTH);
  persist();
  notify();
}

export function setPanelHeight(height: number): void {
  sizes.panelHeight = clamp(height, MIN_PANEL_HEIGHT, MAX_PANEL_HEIGHT);
  persist();
  notify();
}

export function getPanelSizes(): PanelSizes {
  return { ...sizes };
}

export function subscribeToPanelSizes(callback: (sizes: PanelSizes) => void): () => void {
  subscribers.add(callback);
  // Immediately call with current sizes
  callback({ ...sizes });
  return () => {
    subscribers.delete(callback);
  };
}
