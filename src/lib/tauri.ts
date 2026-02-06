import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ============================================================================
// Filesystem Types
// ============================================================================

export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_symlink: boolean;
  size: number | null;
  modified: number | null;
  git_status: string | null;
}

export interface SearchResult {
  path: string;
  name: string;
  score: number;
}

export interface ContentMatch {
  path: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

// ============================================================================
// Terminal Types
// ============================================================================

export interface TerminalOutput {
  id: string;
  data: string;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentOutput {
  id: string;
  stream: 'stdout' | 'stderr';
  data: string;
}

export interface AgentExit {
  id: string;
  code: number | null;
}

// ============================================================================
// File Watcher Types
// ============================================================================

export interface FileChangeEvent {
  /** The type of change: "create", "modify", "remove" */
  kind: 'create' | 'modify' | 'remove';
  /** Affected file/directory paths */
  paths: string[];
}

// ============================================================================
// Filesystem Commands
// ============================================================================

export const fs = {
  async readDirectory(path: string): Promise<FileEntry[]> {
    return invoke('read_directory', { path });
  },

  async readFile(path: string): Promise<string> {
    return invoke('read_file', { path });
  },

  async writeFile(path: string, content: string): Promise<void> {
    return invoke('write_file', { path, content });
  },

  async createFile(path: string, content?: string): Promise<void> {
    return invoke('create_file', { path, content });
  },

  async createDirectory(path: string): Promise<void> {
    return invoke('create_directory', { path });
  },

  async deletePath(path: string): Promise<void> {
    return invoke('delete_path', { path });
  },

  async renamePath(oldPath: string, newPath: string): Promise<void> {
    return invoke('rename_path', { oldPath, newPath });
  },

  async searchFiles(root: string, query: string, maxResults?: number): Promise<SearchResult[]> {
    return invoke('search_files', { root, query, maxResults });
  },

  async searchContent(root: string, query: string, maxResults?: number): Promise<ContentMatch[]> {
    return invoke('search_content', { root, query, maxResults });
  },
};

// ============================================================================
// Terminal Commands
// ============================================================================

export const terminal = {
  async spawn(id: string, shell?: string, cwd?: string): Promise<void> {
    // Build args object, only including defined values
    // Tauri v2 requires omitting undefined optional parameters, not passing undefined
    const args: { id: string; shell?: string; cwd?: string } = { id };
    if (shell !== undefined) args.shell = shell;
    if (cwd !== undefined) args.cwd = cwd;

    return invoke('spawn_terminal', args);
  },

  async write(id: string, data: string): Promise<void> {
    return invoke('write_terminal', { id, data });
  },

  async resize(id: string, rows: number, cols: number): Promise<void> {
    return invoke('resize_terminal', { id, rows, cols });
  },

  async close(id: string): Promise<void> {
    return invoke('close_terminal', { id });
  },

  onOutput(callback: (output: TerminalOutput) => void): Promise<UnlistenFn> {
    return listen<TerminalOutput>('terminal-output', (event) => {
      callback(event.payload);
    });
  },
};

// ============================================================================
// Agent Commands
// ============================================================================

export const agent = {
  async start(id: string, command: string, args: string[], cwd?: string): Promise<void> {
    return invoke('start_agent', { id, command, args, cwd });
  },

  async send(id: string, data: string): Promise<void> {
    return invoke('send_to_agent', { id, data });
  },

  async stop(id: string): Promise<void> {
    return invoke('stop_agent', { id });
  },

  onOutput(callback: (output: AgentOutput) => void): Promise<UnlistenFn> {
    return listen<AgentOutput>('agent-output', (event) => {
      callback(event.payload);
    });
  },

  onExit(callback: (exit: AgentExit) => void): Promise<UnlistenFn> {
    return listen<AgentExit>('agent-exit', (event) => {
      callback(event.payload);
    });
  },
};

// ============================================================================
// File Watcher Commands
// ============================================================================

export const watcher = {
  async start(path: string): Promise<void> {
    return invoke('start_watcher', { path });
  },

  async stop(): Promise<void> {
    return invoke('stop_watcher');
  },

  onChange(callback: (event: FileChangeEvent) => void): Promise<UnlistenFn> {
    return listen<FileChangeEvent>('file-change', (event) => {
      callback(event.payload);
    });
  },
};

// ============================================================================
// Git Commands
// ============================================================================

export const git = {
  /**
   * Get the current git branch name for a workspace path.
   * Returns null if the path is not a git repository.
   */
  async getBranch(path: string): Promise<string | null> {
    return invoke('get_git_branch', { path });
  },

  /**
   * Get git status for all files in the workspace.
   * Returns a map of relative_path -> status_code.
   */
  async getStatus(path: string): Promise<Record<string, string>> {
    return invoke('get_git_status', { path });
  },
};

// ============================================================================
// Shell Commands
// ============================================================================

export const shell = {
  /**
   * Opens a URL in the default browser.
   * Falls back to window.open if Tauri shell API is unavailable.
   */
  async openUrl(url: string): Promise<void> {
    try {
      // Dynamic import to avoid bundling issues
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } catch (error) {
      // Fallback for browser-only mode or if shell plugin unavailable
      console.warn('Tauri shell API unavailable, using window.open fallback:', error);
      window.open(url, '_blank');
    }
  },
};

// ============================================================================
// Window Commands
// ============================================================================

export const windowApi = {
  /**
   * Toggles fullscreen mode for the current window.
   * No-op in browser-only mode.
   */
  async toggleFullscreen(): Promise<void> {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      const isFs = await win.isFullscreen();
      await win.setFullscreen(!isFs);
    } catch (error) {
      console.warn('Tauri window API unavailable:', error);
    }
  },
};

// ============================================================================
// Event System
// ============================================================================

export const events = {
  /**
   * Listen for Tauri events (like menu actions).
   * Returns an unlisten function, or null if running in browser mode.
   */
  async listen<T>(event: string, handler: (payload: T) => void): Promise<(() => void) | null> {
    try {
      const { listen: tauriListen } = await import('@tauri-apps/api/event');
      const unlisten = await tauriListen<T>(event, (event) => {
        handler(event.payload);
      });
      return unlisten;
    } catch (error) {
      console.warn('Tauri event API unavailable:', error);
      return null;
    }
  },
};

// ============================================================================
// Dialog API
// ============================================================================

export const dialog = {
  /**
   * Opens a file/folder picker dialog.
   * Returns the selected path(s), or null if canceled.
   */
  async openDialog(options: {
    directory?: boolean;
    multiple?: boolean;
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | string[] | null> {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      return await open(options);
    } catch (error) {
      console.warn('Tauri dialog API unavailable:', error);
      return null;
    }
  },
};

// ============================================================================
// Terminal UI (xterm.js)
// ============================================================================

export const xtermLoader = {
  /**
   * Dynamically loads xterm.js and its addons.
   * Returns null in test environments or if xterm is unavailable.
   */
  async loadXterm(): Promise<{
    Terminal: any;
    FitAddon: any;
    WebLinksAddon: any;
  } | null> {
    try {
      const [terminalModule, fitModule, linksModule] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
        import('@xterm/addon-web-links'),
      ]);
      return {
        Terminal: terminalModule.Terminal,
        FitAddon: fitModule.FitAddon,
        WebLinksAddon: linksModule.WebLinksAddon,
      };
    } catch (error) {
      console.warn('xterm.js unavailable:', error);
      return null;
    }
  },
};
