/**
 * Terminal Session Manager
 *
 * Manages multiple terminal sessions with pub/sub notifications.
 * Each session has a unique ID, display name, and connection state.
 * The Panel component uses this to render terminal tabs.
 */

export interface TerminalSession {
  id: string;
  name: string;
  createdAt: number;
}

export interface TerminalSessionState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
}

type SessionListener = (state: TerminalSessionState) => void;

// Module-level state
let sessions: TerminalSession[] = [];
let activeSessionId: string | null = null;
let sessionCounter = 0;
const listeners = new Set<SessionListener>();

function generateId(): string {
  return `terminal-${Date.now()}-${sessionCounter++}`;
}

function generateName(): string {
  // Find the next available number
  const existingNumbers = sessions
    .map((s) => {
      const match = s.name.match(/^Terminal (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  let num = 1;
  while (existingNumbers.includes(num)) {
    num++;
  }
  return `Terminal ${num}`;
}

function getState(): TerminalSessionState {
  return {
    sessions: [...sessions],
    activeSessionId,
  };
}

function notify(): void {
  const state = getState();
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.error('Terminal session listener error:', err);
    }
  }
}

/**
 * Create a new terminal session and make it active.
 * Returns the new session's ID.
 */
export function createSession(): string {
  const id = generateId();
  const name = generateName();
  const session: TerminalSession = {
    id,
    name,
    createdAt: Date.now(),
  };

  sessions = [...sessions, session];
  activeSessionId = id;
  notify();
  return id;
}

/**
 * Close a terminal session by ID.
 * If it was the active session, activates the nearest sibling or null.
 */
export function closeSession(id: string): void {
  const index = sessions.findIndex((s) => s.id === id);
  if (index === -1) return;

  sessions = sessions.filter((s) => s.id !== id);

  if (activeSessionId === id) {
    if (sessions.length === 0) {
      activeSessionId = null;
    } else {
      // Activate nearest sibling: prefer next, then prev
      const newIndex = Math.min(index, sessions.length - 1);
      activeSessionId = sessions[newIndex].id;
    }
  }

  notify();
}

/**
 * Set the active terminal session.
 */
export function setActiveSession(id: string): void {
  if (sessions.some((s) => s.id === id) && activeSessionId !== id) {
    activeSessionId = id;
    notify();
  }
}

/**
 * Rename a terminal session.
 */
export function renameSession(id: string, name: string): void {
  const session = sessions.find((s) => s.id === id);
  if (session && name.trim()) {
    session.name = name.trim();
    sessions = [...sessions]; // trigger new reference
    notify();
  }
}

/**
 * Get the current session state.
 */
export function getSessionState(): TerminalSessionState {
  return getState();
}

/**
 * Get a specific session by ID.
 */
export function getSession(id: string): TerminalSession | undefined {
  return sessions.find((s) => s.id === id);
}

/**
 * Subscribe to session state changes.
 * The listener is called immediately with current state, then on every change.
 * Returns an unsubscribe function.
 */
export function subscribeToSessions(listener: SessionListener): () => void {
  listeners.add(listener);
  listener(getState());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Reset all sessions (useful for tests).
 */
export function resetSessions(): void {
  sessions = [];
  activeSessionId = null;
  sessionCounter = 0;
  listeners.clear();
}
