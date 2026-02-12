/**
 * Mock System for Kode
 *
 * This module provides a complete mock environment for running Kode
 * in browser mode without Tauri. It uses the official @tauri-apps/api/mocks
 * package to intercept IPC calls.
 *
 * Features:
 * - Automatic detection of browser vs Tauri environment
 * - Complete filesystem mocking with a demo project
 * - Terminal emulation with basic shell commands
 * - AI agent simulation for chat functionality
 * - Tree-shakeable - not included in Tauri production builds
 */

import { mockIPC, mockWindows, clearMocks } from '@tauri-apps/api/mocks';
import type { InvokeArgs } from '@tauri-apps/api/core';
import {
  handleFilesystemCommand,
  getDemoWorkspacePath,
  resetFilesystemMocks,
} from './filesystem.mock';
import { handleTerminalCommand, resetTerminalMocks } from './terminal.mock';
import { handleAgentCommand, resetAgentMocks } from './agent.mock';
import { handleEditorCommand, isEditorCommand, resetEditorMocks } from './editor.mock';

// Re-export for convenience
export { getDemoWorkspacePath } from './filesystem.mock';
export { verifyMockStatus } from './verify';

/**
 * Check if we're running inside a Tauri application
 */
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for Tauri internals
  const hasTauriInternals = '__TAURI_INTERNALS__' in window;
  const hasTauri = '__TAURI__' in window;
  const result = hasTauriInternals || hasTauri;

  console.log('[Kode Mocks] Environment detection:', {
    hasTauriInternals,
    hasTauri,
    isTauriEnvironment: result,
  });

  return result;
}

/**
 * Check if mocks should be enabled
 * This checks the compile-time flag set by Vite
 */
export function shouldEnableMocks(): boolean {
  // First check: if we're in Tauri, NEVER enable mocks
  if (isTauriEnvironment()) {
    return false;
  }

  // Second check: use compile-time flag
  // In Tauri builds, __ENABLE_MOCKS__ will be false
  // In browser dev mode, it will be true
  if (typeof __ENABLE_MOCKS__ !== 'undefined') {
    return __ENABLE_MOCKS__;
  }

  // Fallback: disabled by default (safer)
  return false;
}

// Track initialization state
let isInitialized = false;

/**
 * Initialize the mock system
 *
 * This sets up:
 * - Mock window environment
 * - IPC interceptors for all Tauri commands
 * - Event mocking for terminal and agent output
 *
 * @returns Promise that resolves when mocks are ready
 */
export async function initializeMocks(): Promise<void> {
  if (isInitialized) {
    console.log('[Kode Mocks] Already initialized');
    return;
  }

  console.log('[Kode Mocks] Checking if mocks should be enabled...', {
    shouldEnableMocks: shouldEnableMocks(),
    isTauriEnvironment: isTauriEnvironment(),
    enableMocksFlag: typeof __ENABLE_MOCKS__ !== 'undefined' ? __ENABLE_MOCKS__ : 'undefined',
  });

  if (!shouldEnableMocks()) {
    console.log('[Kode Mocks] Skipping - running in Tauri environment');
    return;
  }

  console.log('[Kode Mocks] Initializing browser mock environment...');

  try {
    // Setup mock window
    mockWindows('main');

    // Setup IPC mock handler
    mockIPC(
      (cmd: string, payload?: InvokeArgs) => {
        // Convert payload to Record<string, unknown> for our handlers
        const args =
          payload && typeof payload === 'object' && !Array.isArray(payload)
            ? (payload as Record<string, unknown>)
            : {};
        return handleIPCCommand(cmd, args);
      },
      { shouldMockEvents: true }
    );

    isInitialized = true;

    console.log('[Kode Mocks] Mock environment ready');
    console.log(`[Kode Mocks] Demo workspace: ${getDemoWorkspacePath()}`);
  } catch (error) {
    console.error('[Kode Mocks] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Route IPC commands to appropriate mock handlers
 */
function handleIPCCommand(cmd: string, args: Record<string, unknown>): unknown {
  // Filesystem commands
  if (
    cmd === 'read_directory' ||
    cmd === 'read_file' ||
    cmd === 'write_file' ||
    cmd === 'create_file' ||
    cmd === 'create_directory' ||
    cmd === 'delete_path' ||
    cmd === 'rename_path' ||
    cmd === 'search_files' ||
    cmd === 'search_content'
  ) {
    return handleFilesystemCommand(cmd, args);
  }

  // Terminal commands
  if (
    cmd === 'spawn_terminal' ||
    cmd === 'write_terminal' ||
    cmd === 'resize_terminal' ||
    cmd === 'close_terminal'
  ) {
    return handleTerminalCommand(cmd, args);
  }

  // Agent commands
  if (cmd === 'start_agent' || cmd === 'send_to_agent' || cmd === 'stop_agent') {
    return handleAgentCommand(cmd, args);
  }

  // Dialog plugin commands
  if (cmd === 'plugin:dialog|open') {
    if (args.directory) {
      return getDemoWorkspacePath();
    }
    return '/demo-project/src/main.ts';
  }

  // File watcher commands (no-op in mock mode)
  if (cmd === 'start_watcher' || cmd === 'stop_watcher') {
    return null;
  }

  // Editor engine commands - routed to dedicated editor mock module
  if (isEditorCommand(cmd)) {
    return handleEditorCommand(cmd, args);
  }

  // Git commands (mock responses)
  if (cmd === 'get_git_branch') {
    return 'main';
  }
  if (cmd === 'get_git_status') {
    if (args.path === '/demo-project' || args.path === getDemoWorkspacePath()) {
      return {
        'src/main.ts': 'M',
        'src/utils.ts': 'M',
        'package.json': 'M',
        'README.md': 'M',
        '.gitignore': '?',
        'new-file.ts': 'A',
      };
    }
    return {};
  }

  // Log unhandled commands for debugging
  console.warn(`[Kode Mocks] Unhandled IPC command: ${cmd}`, args);
  return null;
}

/**
 * Reset all mocks to initial state
 * Useful for testing or refreshing the mock environment
 */
export function resetMocks(): void {
  resetFilesystemMocks();
  resetTerminalMocks();
  resetAgentMocks();
  resetEditorMocks();
  console.log('[Kode Mocks] All mocks reset');
}

/**
 * Completely teardown the mock system
 * Call this when you want to switch back to real Tauri APIs
 */
export function teardownMocks(): void {
  if (!isInitialized) return;

  try {
    clearMocks();
    resetMocks();
    isInitialized = false;
    console.log('[Kode Mocks] Mock system torn down');
  } catch (error) {
    console.error('[Kode Mocks] Failed to teardown:', error);
  }
}

/**
 * Check if mock system is currently active
 */
export function isMockSystemActive(): boolean {
  return isInitialized;
}

// Type declaration for the compile-time flag
declare const __ENABLE_MOCKS__: boolean;
