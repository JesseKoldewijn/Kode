/**
 * File Watcher Module
 *
 * Manages the lifecycle of the file system watcher and provides a pub/sub
 * API for components to react to external file changes. Debounces rapid
 * change events to avoid excessive UI updates.
 */

import { watcher, type FileChangeEvent } from './tauri';

// ============================================================================
// Types
// ============================================================================

export interface DebouncedFileChange {
  /** Deduplicated set of changed file paths */
  changedPaths: string[];
  /** Whether any creates happened */
  hasCreates: boolean;
  /** Whether any removes happened */
  hasRemoves: boolean;
  /** Whether any modifies happened */
  hasModifies: boolean;
}

type FileChangeCallback = (change: DebouncedFileChange) => void;

// ============================================================================
// State
// ============================================================================

let isWatching = false;
let watchedPath: string | null = null;
let unlisten: (() => void) | null = null;

// Debounce state
let pendingEvents: FileChangeEvent[] = [];
let debounceTimer: number | null = null;
const DEBOUNCE_MS = 300;

// Subscribers
const subscribers = new Set<FileChangeCallback>();

// ============================================================================
// Internal helpers
// ============================================================================

function flushPendingEvents(): void {
  if (pendingEvents.length === 0) return;

  // Deduplicate paths and aggregate event kinds
  const pathSet = new Set<string>();
  let hasCreates = false;
  let hasRemoves = false;
  let hasModifies = false;

  for (const event of pendingEvents) {
    for (const p of event.paths) {
      pathSet.add(p);
    }
    if (event.kind === 'create') hasCreates = true;
    if (event.kind === 'remove') hasRemoves = true;
    if (event.kind === 'modify') hasModifies = true;
  }

  pendingEvents = [];

  const change: DebouncedFileChange = {
    changedPaths: Array.from(pathSet),
    hasCreates,
    hasRemoves,
    hasModifies,
  };

  // Notify subscribers
  for (const callback of subscribers) {
    try {
      callback(change);
    } catch (err) {
      console.error('[FileWatcher] Subscriber error:', err);
    }
  }
}

function handleRawEvent(event: FileChangeEvent): void {
  pendingEvents.push(event);

  // Reset debounce timer
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    flushPendingEvents();
  }, DEBOUNCE_MS) as unknown as number;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Start watching a directory for file changes.
 * Stops any existing watcher first.
 */
export async function startFileWatcher(path: string): Promise<void> {
  // Stop existing watcher if any
  await stopFileWatcher();

  try {
    // Listen for file-change events from the backend
    unlisten = await watcher.onChange(handleRawEvent);

    // Tell the backend to start watching
    await watcher.start(path);

    isWatching = true;
    watchedPath = path;
    console.log('[FileWatcher] Started watching:', path);
  } catch (err) {
    // Clean up if start failed
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
    console.error('[FileWatcher] Failed to start:', err);
  }
}

/**
 * Stop the file watcher.
 */
export async function stopFileWatcher(): Promise<void> {
  if (!isWatching) return;

  try {
    await watcher.stop();
  } catch (err) {
    console.error('[FileWatcher] Failed to stop backend watcher:', err);
  }

  if (unlisten) {
    unlisten();
    unlisten = null;
  }

  // Clear pending events
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingEvents = [];

  isWatching = false;
  watchedPath = null;
  console.log('[FileWatcher] Stopped');
}

/**
 * Subscribe to debounced file change notifications.
 * Returns an unsubscribe function.
 */
export function subscribeToFileChanges(callback: FileChangeCallback): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Get current watcher status.
 */
export function getWatcherStatus(): { isWatching: boolean; path: string | null } {
  return { isWatching, path: watchedPath };
}

/**
 * Reset watcher state (for testing).
 */
export function resetFileWatcher(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingEvents = [];
  subscribers.clear();
  isWatching = false;
  watchedPath = null;
  unlisten = null;
}
