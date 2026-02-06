/**
 * Auto-save Module
 *
 * Watches for dirty files and automatically saves them after a configurable delay.
 * Integrates with editor-settings for enable/disable and delay configuration.
 */

import { openFiles, saveFile, subscribeToOpenFiles } from './workspace';
import { subscribeToEditorSettings, type EditorSettings } from './editor-settings';

let autoSaveEnabled = false;
let autoSaveDelay = 1000;
let pendingTimers: Map<string, number> = new Map();
let unsubscribeFiles: (() => void) | null = null;
let unsubscribeSettings: (() => void) | null = null;

/**
 * Schedule an auto-save for a specific file.
 * Debounces: resets the timer if called again before it fires.
 */
function scheduleAutoSave(fileId: string): void {
  // Clear any existing timer for this file
  const existing = pendingTimers.get(fileId);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    pendingTimers.delete(fileId);
    // Double-check the file is still dirty and auto-save is still enabled
    const file = openFiles.find((f) => f.id === fileId);
    if (file && file.isDirty && !file.specialTab && file.path && autoSaveEnabled) {
      saveFile(fileId);
    }
  }, autoSaveDelay) as unknown as number;

  pendingTimers.set(fileId, timer);
}

/**
 * Clear all pending auto-save timers.
 */
function clearAllTimers(): void {
  for (const timer of pendingTimers.values()) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
}

/**
 * Check all open files and schedule saves for dirty ones.
 */
function checkDirtyFiles(): void {
  if (!autoSaveEnabled) return;

  for (const file of openFiles) {
    if (file.isDirty && !file.specialTab && file.path) {
      // Only schedule if not already pending
      if (!pendingTimers.has(file.id)) {
        scheduleAutoSave(file.id);
      }
    }
  }
}

/**
 * Initialize the auto-save system.
 * Call once at app startup after initEditorSettings().
 */
export function initAutoSave(): void {
  // Subscribe to editor settings changes
  unsubscribeSettings = subscribeToEditorSettings((settings: EditorSettings) => {
    const wasEnabled = autoSaveEnabled;
    autoSaveEnabled = settings.autoSave;
    autoSaveDelay = settings.autoSaveDelay;

    if (!autoSaveEnabled) {
      clearAllTimers();
    } else if (!wasEnabled && autoSaveEnabled) {
      // Just enabled - check for any currently dirty files
      checkDirtyFiles();
    }
  });

  // Subscribe to open files changes to detect newly dirty files
  unsubscribeFiles = subscribeToOpenFiles(() => {
    if (!autoSaveEnabled) return;
    checkDirtyFiles();
  });
}

/**
 * Tear down the auto-save system.
 */
export function destroyAutoSave(): void {
  clearAllTimers();
  if (unsubscribeFiles) {
    unsubscribeFiles();
    unsubscribeFiles = null;
  }
  if (unsubscribeSettings) {
    unsubscribeSettings();
    unsubscribeSettings = null;
  }
}
