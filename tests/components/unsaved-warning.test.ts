import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  openFiles,
  openFile,
  closeFile,
  updateFileContent,
  saveFile,
  setActiveFileId,
} from '../../src/lib/workspace';

// Helper to reset workspace state
function resetWorkspaceState() {
  // Clear all open files
  while (openFiles.length > 0) {
    openFiles.pop();
  }
  // Reset activeFileId
  setActiveFileId(null);
}

describe('Unsaved File Warning Behavior', () => {
  beforeEach(() => {
    resetWorkspaceState();
    vi.clearAllMocks();
  });

  describe('Dirty state tracking', () => {
    it('should mark file as dirty when content changes', async () => {
      await openFile('/test/file.ts', 'file.ts');

      expect(openFiles[0].isDirty).toBe(false);

      updateFileContent(openFiles[0].id, 'new content');

      expect(openFiles[0].isDirty).toBe(true);
    });

    it('should clear dirty flag after saving', async () => {
      await openFile('/test/file.ts', 'file.ts');
      updateFileContent(openFiles[0].id, 'new content');

      expect(openFiles[0].isDirty).toBe(true);

      await saveFile(openFiles[0].id);

      expect(openFiles[0].isDirty).toBe(false);
    });

    it('should not mark file as dirty on initial open', async () => {
      await openFile('/test/file.ts', 'file.ts');

      expect(openFiles[0].isDirty).toBe(false);
    });
  });

  describe('Close behavior with dirty files', () => {
    it('should close non-dirty file immediately', async () => {
      await openFile('/test/clean.ts', 'clean.ts');

      expect(openFiles.length).toBe(1);
      expect(openFiles[0].isDirty).toBe(false);

      closeFile(openFiles[0].id);

      expect(openFiles.length).toBe(0);
    });

    it('should still close dirty file when closeFile is called directly (for programmatic close after save/discard)', async () => {
      await openFile('/test/dirty.ts', 'dirty.ts');
      updateFileContent(openFiles[0].id, 'unsaved changes');

      expect(openFiles.length).toBe(1);
      expect(openFiles[0].isDirty).toBe(true);

      // closeFile is a low-level function that always closes
      // The UI layer (EditorTabs) handles the confirmation dialog
      closeFile(openFiles[0].id);

      expect(openFiles.length).toBe(0);
    });
  });

  describe('Multiple files scenario', () => {
    it('should track dirty state independently for each file', async () => {
      await openFile('/test/file1.ts', 'file1.ts');
      await openFile('/test/file2.ts', 'file2.ts');
      await openFile('/test/file3.ts', 'file3.ts');

      // Make only file2 dirty
      updateFileContent(openFiles[1].id, 'modified');

      expect(openFiles[0].isDirty).toBe(false);
      expect(openFiles[1].isDirty).toBe(true);
      expect(openFiles[2].isDirty).toBe(false);
    });

    it('should correctly identify which files have unsaved changes', async () => {
      await openFile('/test/file1.ts', 'file1.ts');
      await openFile('/test/file2.ts', 'file2.ts');
      await openFile('/test/file3.ts', 'file3.ts');

      updateFileContent(openFiles[0].id, 'modified 1');
      updateFileContent(openFiles[2].id, 'modified 3');

      const dirtyFiles = openFiles.filter((f) => f.isDirty);

      expect(dirtyFiles.length).toBe(2);
      expect(dirtyFiles.map((f) => f.name)).toEqual(['file1.ts', 'file3.ts']);
    });
  });

  describe('Save then close workflow', () => {
    it('should allow closing after saving dirty file', async () => {
      await openFile('/test/file.ts', 'file.ts');
      updateFileContent(openFiles[0].id, 'new content');

      expect(openFiles[0].isDirty).toBe(true);

      // Save first
      await saveFile(openFiles[0].id);

      expect(openFiles[0].isDirty).toBe(false);

      // Then close
      closeFile(openFiles[0].id);

      expect(openFiles.length).toBe(0);
    });
  });
});
