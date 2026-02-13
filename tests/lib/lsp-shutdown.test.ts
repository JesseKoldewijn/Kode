import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleEditorCommand,
  resetEditorMocks,
  isEditorCommand,
} from '../../src/lib/mocks/editor.mock';

describe('LSP Shutdown', () => {
  beforeEach(() => {
    resetEditorMocks();
  });

  describe('lspShutdown', () => {
    it('should gracefully handle shutdown for specific buffer', () => {
      const bufferId = '/test/file.ts';
      handleEditorCommand('open_buffer', { path: bufferId });

      // Should return undefined (no error)
      const result = handleEditorCommand('lsp_shutdown', { bufferId });
      expect(result).toBeUndefined();
    });

    it('should handle shutdown for non-existent buffer gracefully', () => {
      const bufferId = '/test/nonexistent.ts';

      // Should not throw (logs warning but doesn't error)
      const result = handleEditorCommand('lsp_shutdown', { bufferId });
      expect(result).toBeUndefined();
    });

    it('should handle shutdown for buffer without LSP support', () => {
      const bufferId = '/test/file.txt';
      handleEditorCommand('open_buffer', { path: bufferId });

      // Should not throw
      const result = handleEditorCommand('lsp_shutdown', { bufferId });
      expect(result).toBeUndefined();
    });

    it('should allow operations after shutting down one buffer while others remain', () => {
      const bufferId1 = '/test/file1.ts';
      const bufferId2 = '/test/file2.ts';

      handleEditorCommand('open_buffer', { path: bufferId1 });
      handleEditorCommand('open_buffer', { path: bufferId2 });

      // Shutdown first buffer
      handleEditorCommand('lsp_shutdown', { bufferId: bufferId1 });

      // Second buffer should still work
      const diagnostics = handleEditorCommand('lsp_get_diagnostics', {
        bufferId: bufferId2,
      });
      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });

  describe('lspShutdownAll', () => {
    it('should gracefully shut down all LSP servers', () => {
      const bufferId1 = '/test/file1.ts';
      const bufferId2 = '/test/file2.js';
      const bufferId3 = '/test/file3.py';

      handleEditorCommand('open_buffer', { path: bufferId1 });
      handleEditorCommand('open_buffer', { path: bufferId2 });
      handleEditorCommand('open_buffer', { path: bufferId3 });

      // Should not throw
      const result = handleEditorCommand('lsp_shutdown_all', {});
      expect(result).toBeUndefined();
    });

    it('should work when no LSP servers are running', () => {
      // Should not throw even with no active sessions
      const result = handleEditorCommand('lsp_shutdown_all', {});
      expect(result).toBeUndefined();
    });

    it('should handle mixed buffer types', () => {
      const tsBuffer = '/test/file.ts';
      const txtBuffer = '/test/file.txt';

      handleEditorCommand('open_buffer', { path: tsBuffer });
      handleEditorCommand('open_buffer', { path: txtBuffer });

      // Should not throw
      const result = handleEditorCommand('lsp_shutdown_all', {});
      expect(result).toBeUndefined();
    });

    it('should clean up all sessions properly', () => {
      const bufferId1 = '/test/file1.ts';
      const bufferId2 = '/test/file2.rs';

      handleEditorCommand('open_buffer', { path: bufferId1 });
      handleEditorCommand('open_buffer', { path: bufferId2 });

      // Verify LSP sessions exist
      const hasTsSession = handleEditorCommand('lsp_has_session', {
        bufferId: bufferId1,
      });
      const hasRustSession = handleEditorCommand('lsp_has_session', {
        bufferId: bufferId2,
      });
      expect(hasTsSession).toBe(true);
      expect(hasRustSession).toBe(true);

      // Shutdown all
      handleEditorCommand('lsp_shutdown_all', {});

      // After shutdown, new buffers should be able to start fresh LSP sessions
      const bufferId3 = '/test/file3.ts';
      handleEditorCommand('open_buffer', { path: bufferId3 });
      const hasNewSession = handleEditorCommand('lsp_has_session', {
        bufferId: bufferId3,
      });
      expect(hasNewSession).toBe(true);
    });
  });

  describe('Shutdown on workspace change', () => {
    it('should clean up LSP servers when workspace changes', () => {
      // Simulate opening files in workspace A
      const workspaceA = '/workspace-a/file.ts';
      handleEditorCommand('open_buffer', { path: workspaceA });

      // Shutdown all before switching workspaces
      handleEditorCommand('lsp_shutdown_all', {});

      // Open files in workspace B
      const workspaceB = '/workspace-b/file.ts';
      handleEditorCommand('open_buffer', { path: workspaceB });

      // Should work without issues
      const diagnostics = handleEditorCommand('lsp_get_diagnostics', {
        bufferId: workspaceB,
      });
      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });

  describe('Shutdown on app exit', () => {
    it('should provide clean shutdown mechanism for app close', () => {
      // Open multiple files with different LSP servers
      const buffers = [
        '/test/file1.ts',
        '/test/file2.js',
        '/test/file3.py',
        '/test/file4.rs',
      ];

      for (const bufferId of buffers) {
        handleEditorCommand('open_buffer', { path: bufferId });
      }

      // Simulate app close - should shut down all LSP servers gracefully
      const result = handleEditorCommand('lsp_shutdown_all', {});

      // Test passes if no errors thrown
      expect(result).toBeUndefined();
    });
  });

  describe('Command availability', () => {
    it('should recognize lsp_shutdown as editor command', () => {
      expect(isEditorCommand('lsp_shutdown')).toBe(true);
    });

    it('should recognize lsp_shutdown_all as editor command', () => {
      expect(isEditorCommand('lsp_shutdown_all')).toBe(true);
    });

    it('should recognize notify_lsp_did_save as editor command', () => {
      expect(isEditorCommand('notify_lsp_did_save')).toBe(true);
    });
  });
});
