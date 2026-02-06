import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSession,
  closeSession,
  setActiveSession,
  renameSession,
  getSessionState,
  getSession,
  subscribeToSessions,
  resetSessions,
} from '../../src/lib/terminal-sessions';

describe('Terminal Sessions', () => {
  beforeEach(() => {
    resetSessions();
  });

  describe('createSession', () => {
    it('creates a session and returns its ID', () => {
      const id = createSession();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('sets the new session as active', () => {
      const id = createSession();
      const state = getSessionState();
      expect(state.activeSessionId).toBe(id);
    });

    it('names first session "Terminal 1"', () => {
      const id = createSession();
      const session = getSession(id);
      expect(session?.name).toBe('Terminal 1');
    });

    it('names subsequent sessions sequentially', () => {
      const id1 = createSession();
      const id2 = createSession();
      const id3 = createSession();
      expect(getSession(id1)?.name).toBe('Terminal 1');
      expect(getSession(id2)?.name).toBe('Terminal 2');
      expect(getSession(id3)?.name).toBe('Terminal 3');
    });

    it('fills gaps in naming when sessions are closed', () => {
      const id1 = createSession();
      const id2 = createSession();
      closeSession(id2);
      const id3 = createSession();
      expect(getSession(id1)?.name).toBe('Terminal 1');
      expect(getSession(id3)?.name).toBe('Terminal 2');
    });

    it('generates unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        ids.add(createSession());
      }
      expect(ids.size).toBe(10);
    });

    it('tracks creation timestamp', () => {
      const before = Date.now();
      const id = createSession();
      const after = Date.now();
      const session = getSession(id);
      expect(session?.createdAt).toBeGreaterThanOrEqual(before);
      expect(session?.createdAt).toBeLessThanOrEqual(after);
    });
  });

  describe('closeSession', () => {
    it('removes the session', () => {
      const id = createSession();
      closeSession(id);
      const state = getSessionState();
      expect(state.sessions).toHaveLength(0);
    });

    it('ignores non-existent session IDs', () => {
      createSession();
      closeSession('non-existent');
      const state = getSessionState();
      expect(state.sessions).toHaveLength(1);
    });

    it('activates next sibling when active session is closed', () => {
      const id1 = createSession();
      const id2 = createSession();
      const id3 = createSession();
      setActiveSession(id2);
      closeSession(id2);
      // id3 was at index 2, but after id2 removal it shifts to index 1
      // the original index of id2 was 1, Math.min(1, 1) = 1, so id3
      expect(getSessionState().activeSessionId).toBe(id3);
    });

    it('activates previous sibling when last session is closed', () => {
      const id1 = createSession();
      const id2 = createSession();
      const id3 = createSession();
      // id3 is active (last created)
      closeSession(id3);
      expect(getSessionState().activeSessionId).toBe(id2);
    });

    it('sets activeSessionId to null when all sessions are closed', () => {
      const id = createSession();
      closeSession(id);
      expect(getSessionState().activeSessionId).toBeNull();
    });

    it('does not change active session when non-active session is closed', () => {
      const id1 = createSession();
      const id2 = createSession();
      const id3 = createSession();
      // id3 is active
      closeSession(id1);
      expect(getSessionState().activeSessionId).toBe(id3);
    });
  });

  describe('setActiveSession', () => {
    it('changes the active session', () => {
      const id1 = createSession();
      const id2 = createSession();
      setActiveSession(id1);
      expect(getSessionState().activeSessionId).toBe(id1);
    });

    it('ignores non-existent session IDs', () => {
      const id = createSession();
      setActiveSession('non-existent');
      expect(getSessionState().activeSessionId).toBe(id);
    });

    it('does not notify if already active', () => {
      const id = createSession();
      const listener = vi.fn();
      subscribeToSessions(listener);
      listener.mockClear();
      setActiveSession(id); // already active
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('renameSession', () => {
    it('renames a session', () => {
      const id = createSession();
      renameSession(id, 'My Shell');
      expect(getSession(id)?.name).toBe('My Shell');
    });

    it('trims whitespace from name', () => {
      const id = createSession();
      renameSession(id, '  Custom Name  ');
      expect(getSession(id)?.name).toBe('Custom Name');
    });

    it('ignores empty names', () => {
      const id = createSession();
      renameSession(id, '');
      expect(getSession(id)?.name).toBe('Terminal 1');
    });

    it('ignores whitespace-only names', () => {
      const id = createSession();
      renameSession(id, '   ');
      expect(getSession(id)?.name).toBe('Terminal 1');
    });

    it('ignores non-existent session IDs', () => {
      createSession();
      renameSession('non-existent', 'New Name');
      // Should not throw
      expect(getSessionState().sessions).toHaveLength(1);
    });
  });

  describe('getSessionState', () => {
    it('returns empty state initially', () => {
      const state = getSessionState();
      expect(state.sessions).toHaveLength(0);
      expect(state.activeSessionId).toBeNull();
    });

    it('returns a copy of sessions array', () => {
      createSession();
      const state1 = getSessionState();
      const state2 = getSessionState();
      expect(state1.sessions).not.toBe(state2.sessions);
      expect(state1.sessions).toEqual(state2.sessions);
    });

    it('reflects current state after operations', () => {
      const id1 = createSession();
      const id2 = createSession();
      closeSession(id1);
      const state = getSessionState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe(id2);
      expect(state.activeSessionId).toBe(id2);
    });
  });

  describe('getSession', () => {
    it('returns session by ID', () => {
      const id = createSession();
      const session = getSession(id);
      expect(session).toBeDefined();
      expect(session?.id).toBe(id);
    });

    it('returns undefined for non-existent ID', () => {
      expect(getSession('non-existent')).toBeUndefined();
    });
  });

  describe('subscribeToSessions', () => {
    it('calls listener immediately with current state', () => {
      createSession();
      const listener = vi.fn();
      subscribeToSessions(listener);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].sessions).toHaveLength(1);
    });

    it('calls listener on create', () => {
      const listener = vi.fn();
      subscribeToSessions(listener);
      listener.mockClear();
      createSession();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].sessions).toHaveLength(1);
    });

    it('calls listener on close', () => {
      const id = createSession();
      const listener = vi.fn();
      subscribeToSessions(listener);
      listener.mockClear();
      closeSession(id);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].sessions).toHaveLength(0);
    });

    it('calls listener on setActive', () => {
      const id1 = createSession();
      createSession();
      const listener = vi.fn();
      subscribeToSessions(listener);
      listener.mockClear();
      setActiveSession(id1);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].activeSessionId).toBe(id1);
    });

    it('calls listener on rename', () => {
      const id = createSession();
      const listener = vi.fn();
      subscribeToSessions(listener);
      listener.mockClear();
      renameSession(id, 'New Name');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].sessions[0].name).toBe('New Name');
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = subscribeToSessions(listener);
      listener.mockClear();
      unsub();
      createSession();
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      subscribeToSessions(listener1);
      subscribeToSessions(listener2);
      listener1.mockClear();
      listener2.mockClear();
      createSession();
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('handles listener errors gracefully', () => {
      let callCount = 0;
      const errorListener = vi.fn(() => {
        callCount++;
        // Only throw after the initial subscribe call
        if (callCount > 1) {
          throw new Error('listener error');
        }
      });
      const goodListener = vi.fn();
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      subscribeToSessions(errorListener);
      subscribeToSessions(goodListener);
      goodListener.mockClear();
      createSession();
      expect(goodListener).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe('resetSessions', () => {
    it('clears all sessions', () => {
      createSession();
      createSession();
      resetSessions();
      const state = getSessionState();
      expect(state.sessions).toHaveLength(0);
      expect(state.activeSessionId).toBeNull();
    });

    it('clears all listeners', () => {
      const listener = vi.fn();
      subscribeToSessions(listener);
      resetSessions();
      listener.mockClear();
      createSession();
      expect(listener).not.toHaveBeenCalled();
    });

    it('resets session counter for naming', () => {
      createSession();
      createSession();
      resetSessions();
      const id = createSession();
      expect(getSession(id)?.name).toBe('Terminal 1');
    });
  });

  describe('complex scenarios', () => {
    it('handles rapid create/close cycles', () => {
      for (let i = 0; i < 5; i++) {
        const id = createSession();
        closeSession(id);
      }
      expect(getSessionState().sessions).toHaveLength(0);
      expect(getSessionState().activeSessionId).toBeNull();
    });

    it('maintains correct active session through multiple operations', () => {
      const id1 = createSession(); // Terminal 1, active
      const id2 = createSession(); // Terminal 2, active
      const id3 = createSession(); // Terminal 3, active
      setActiveSession(id1); // Terminal 1 active
      closeSession(id2); // Terminal 1 still active
      expect(getSessionState().activeSessionId).toBe(id1);
      expect(getSessionState().sessions).toHaveLength(2);
    });

    it('close all sessions one by one', () => {
      const id1 = createSession();
      const id2 = createSession();
      const id3 = createSession();
      closeSession(id3);
      expect(getSessionState().activeSessionId).toBe(id2);
      closeSession(id2);
      expect(getSessionState().activeSessionId).toBe(id1);
      closeSession(id1);
      expect(getSessionState().activeSessionId).toBeNull();
      expect(getSessionState().sessions).toHaveLength(0);
    });
  });
});
