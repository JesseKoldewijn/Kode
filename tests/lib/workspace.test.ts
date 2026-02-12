import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  openFiles,
  fileTree,
  activeFileId,
  workspacePath,
  cursorPosition,
  openFile,
  closeFile,
  saveFile,
  updateFileContent,
  setActiveFileId,
  setWorkspacePath,
  setCursorPosition,
  loadWorkspace,
  refreshWorkspace,
  subscribeToActiveFile,
  subscribeToOpenFiles,
  subscribeToCursorPosition,
  getActiveFile,
  nextTab,
  previousTab,
  goToTab,
  createNewFile,
  createNewDirectory,
  deletePath,
  renamePath,
  type OpenFile,
} from '../../src/lib/workspace';
import { fs } from '../../src/lib/tauri';

// Mock the Tauri fs module
vi.mock('../../src/lib/tauri', () => ({
  fs: {
    readFile: vi.fn().mockResolvedValue('file content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readDirectory: vi.fn().mockResolvedValue([]),
    createFile: vi.fn().mockResolvedValue(undefined),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    deletePath: vi.fn().mockResolvedValue(undefined),
    renamePath: vi.fn().mockResolvedValue(undefined),
  },
  watcher: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    onChange: vi.fn().mockResolvedValue(() => {}),
  },
  git: {
    getBranch: vi.fn().mockResolvedValue('main'),
    getStatus: vi.fn().mockResolvedValue({}),
  },
  shell: {
    openUrl: vi.fn().mockResolvedValue(undefined),
  },
  dialog: {
    openDialog: vi.fn().mockResolvedValue(null),
  },
}));

// Mock the file-watcher module so workspace.ts module-level subscription is safe
vi.mock('../../src/lib/file-watcher', () => ({
  startFileWatcher: vi.fn().mockResolvedValue(undefined),
  stopFileWatcher: vi.fn().mockResolvedValue(undefined),
  subscribeToFileChanges: vi.fn().mockReturnValue(() => {}),
}));

describe('workspace', () => {
  beforeEach(() => {
    // Reset state before each test
    openFiles.length = 0;
    fileTree.length = 0;
    setActiveFileId(null);
    setWorkspacePath(null);
    setCursorPosition(1, 1);
  });

  describe('openFile', () => {
    it('adds file to openFiles array', async () => {
      expect(openFiles.length).toBe(0);

      await openFile('/test/file.ts', 'file.ts');

      expect(openFiles.length).toBe(1);
      expect(openFiles[0].path).toBe('/test/file.ts');
      expect(openFiles[0].name).toBe('file.ts');
    });

    it('sets activeFileId to the opened file', async () => {
      await openFile('/test/file.ts', 'file.ts');

      expect(activeFileId).toBe('/test/file.ts');
    });

    it('does not duplicate already open files', async () => {
      await openFile('/test/file.ts', 'file.ts');
      await openFile('/test/file.ts', 'file.ts');

      expect(openFiles.length).toBe(1);
    });

    it('sets activeFileId to existing file when opening duplicate', async () => {
      await openFile('/test/file1.ts', 'file1.ts');
      await openFile('/test/file2.ts', 'file2.ts');
      await openFile('/test/file1.ts', 'file1.ts'); // Open first file again

      expect(activeFileId).toBe('/test/file1.ts');
      expect(openFiles.length).toBe(2);
    });

    it('detects language from file extension', async () => {
      await openFile('/test/file.ts', 'file.ts');
      expect(openFiles[0].language).toBe('typescript');

      await openFile('/test/file.js', 'file.js');
      expect(openFiles[1].language).toBe('javascript');

      await openFile('/test/file.json', 'file.json');
      expect(openFiles[2].language).toBe('json');

      await openFile('/test/file.md', 'file.md');
      expect(openFiles[3].language).toBe('markdown');

      await openFile('/test/file.rs', 'file.rs');
      expect(openFiles[4].language).toBe('rust');

      await openFile('/test/file.py', 'file.py');
      expect(openFiles[5].language).toBe('python');

      await openFile('/test/file.ripple', 'file.ripple');
      expect(openFiles[6].language).toBe('typescript');

      await openFile('/test/file.unknown', 'file.unknown');
      expect(openFiles[7].language).toBe('text');
    });

    it('initializes file as not dirty', async () => {
      await openFile('/test/file.ts', 'file.ts');
      expect(openFiles[0].isDirty).toBe(false);
    });
  });

  describe('closeFile', () => {
    it('removes file from openFiles array', async () => {
      await openFile('/test/file.ts', 'file.ts');
      expect(openFiles.length).toBe(1);

      closeFile('/test/file.ts');
      expect(openFiles.length).toBe(0);
    });

    it('updates activeFileId to next file when closing active file', async () => {
      await openFile('/test/file1.ts', 'file1.ts');
      await openFile('/test/file2.ts', 'file2.ts');
      await openFile('/test/file3.ts', 'file3.ts');

      // file3 is active (last opened)
      expect(activeFileId).toBe('/test/file3.ts');

      // Close active file, should go to previous file
      closeFile('/test/file3.ts');
      expect(activeFileId).toBe('/test/file2.ts');
    });

    it('updates activeFileId to previous file when closing last file in list', async () => {
      await openFile('/test/file1.ts', 'file1.ts');
      await openFile('/test/file2.ts', 'file2.ts');
      setActiveFileId('/test/file2.ts');

      closeFile('/test/file2.ts');
      expect(activeFileId).toBe('/test/file1.ts');
    });

    it('sets activeFileId to null when closing last remaining file', async () => {
      await openFile('/test/file.ts', 'file.ts');
      closeFile('/test/file.ts');

      expect(activeFileId).toBeNull();
    });

    it('does not change activeFileId when closing non-active file', async () => {
      await openFile('/test/file1.ts', 'file1.ts');
      await openFile('/test/file2.ts', 'file2.ts');
      // file2 is active

      closeFile('/test/file1.ts');
      expect(activeFileId).toBe('/test/file2.ts');
    });
  });

  describe('setActiveFileId', () => {
    it('updates activeFileId', async () => {
      await openFile('/test/file1.ts', 'file1.ts');
      await openFile('/test/file2.ts', 'file2.ts');

      setActiveFileId('/test/file1.ts');
      expect(activeFileId).toBe('/test/file1.ts');

      setActiveFileId('/test/file2.ts');
      expect(activeFileId).toBe('/test/file2.ts');
    });

    it('can set to null', () => {
      setActiveFileId(null);
      expect(activeFileId).toBeNull();
    });
  });

  describe('updateFileContent', () => {
    it('updates file content', async () => {
      await openFile('/test/file.ts', 'file.ts');
      updateFileContent('/test/file.ts', 'new content');

      expect(openFiles[0].content).toBe('new content');
    });

    it('marks file as dirty', async () => {
      await openFile('/test/file.ts', 'file.ts');
      expect(openFiles[0].isDirty).toBe(false);

      updateFileContent('/test/file.ts', 'new content');
      expect(openFiles[0].isDirty).toBe(true);
    });

    it('does nothing for non-existent file', () => {
      updateFileContent('/nonexistent/file.ts', 'content');
      // Should not throw
    });
  });

  describe('saveFile', () => {
    it('clears dirty flag after saving', async () => {
      await openFile('/test/file.ts', 'file.ts');
      updateFileContent('/test/file.ts', 'new content');
      expect(openFiles[0].isDirty).toBe(true);

      await saveFile('/test/file.ts');
      expect(openFiles[0].isDirty).toBe(false);
    });
  });

  describe('getActiveFile', () => {
    it('returns null when no file is active', () => {
      expect(getActiveFile()).toBeNull();
    });

    it('returns the active file', async () => {
      await openFile('/test/file.ts', 'file.ts');
      const activeFile = getActiveFile();

      expect(activeFile).not.toBeNull();
      expect(activeFile?.path).toBe('/test/file.ts');
    });
  });

  describe('subscriptions', () => {
    it('notifies subscribers when activeFileId changes', async () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToActiveFile(callback);

      await openFile('/test/file.ts', 'file.ts');

      expect(callback).toHaveBeenCalledWith('/test/file.ts');

      setActiveFileId(null);
      expect(callback).toHaveBeenCalledWith(null);

      unsubscribe();

      // Should not be called after unsubscribe
      await openFile('/test/file2.ts', 'file2.ts');
      expect(callback).toHaveBeenCalledTimes(2); // Only the previous 2 calls
    });

    it('notifies subscribers when openFiles changes', async () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToOpenFiles(callback);

      await openFile('/test/file.ts', 'file.ts');
      expect(callback).toHaveBeenCalled();

      closeFile('/test/file.ts');
      expect(callback).toHaveBeenCalledTimes(2);

      unsubscribe();
    });

    it('notifies subscribers when cursor position changes', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToCursorPosition(callback);

      setCursorPosition(5, 10);
      expect(callback).toHaveBeenCalledWith({ line: 5, column: 10 });

      setCursorPosition(100, 25);
      expect(callback).toHaveBeenCalledWith({ line: 100, column: 25 });

      unsubscribe();

      // Should not be called after unsubscribe
      setCursorPosition(1, 1);
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('cursorPosition', () => {
    it('defaults to line 1, column 1', () => {
      expect(cursorPosition).toEqual({ line: 1, column: 1 });
    });

    it('can be set via setCursorPosition', () => {
      setCursorPosition(10, 20);
      expect(cursorPosition).toEqual({ line: 10, column: 20 });
    });
  });

  describe('workspacePath', () => {
    it('defaults to null', () => {
      expect(workspacePath).toBeNull();
    });

    it('can be set via setWorkspacePath', () => {
      setWorkspacePath('/test/workspace');
      expect(workspacePath).toBe('/test/workspace');
    });
  });

  describe('refreshWorkspace', () => {
    it('clears and reloads the file tree', async () => {
      setWorkspacePath('/test/workspace');
      fileTree.push({
        id: '1',
        name: 'test',
        path: '/test',
        isDirectory: false,
        isSymlink: false,
        children: null,
        isExpanded: false,
        isLoading: false,
        gitStatus: null,
      });

      expect(fileTree.length).toBe(1);

      await refreshWorkspace();

      // After refresh, tree should be reloaded (mocked as empty)
      expect(fileTree.length).toBe(0);
    });
  });

  describe('tab navigation', () => {
    beforeEach(async () => {
      // Open several files for testing
      await openFile('/test/file1.ts', 'file1.ts');
      await openFile('/test/file2.ts', 'file2.ts');
      await openFile('/test/file3.ts', 'file3.ts');
    });

    describe('nextTab', () => {
      it('switches to the next tab', () => {
        // Currently on file3 (last opened)
        expect(activeFileId).toBe('/test/file3.ts');

        nextTab();
        expect(activeFileId).toBe('/test/file1.ts'); // Wraps around

        nextTab();
        expect(activeFileId).toBe('/test/file2.ts');

        nextTab();
        expect(activeFileId).toBe('/test/file3.ts');
      });

      it('does nothing with single file', async () => {
        // Reset and open just one file
        openFiles.length = 0;
        setActiveFileId(null);
        await openFile('/test/single.ts', 'single.ts');

        expect(activeFileId).toBe('/test/single.ts');
        nextTab();
        expect(activeFileId).toBe('/test/single.ts');
      });

      it('does nothing with no files', () => {
        openFiles.length = 0;
        setActiveFileId(null);

        nextTab();
        expect(activeFileId).toBeNull();
      });

      it('selects first file if no active file', () => {
        setActiveFileId(null);
        nextTab();
        expect(activeFileId).toBe('/test/file1.ts');
      });
    });

    describe('previousTab', () => {
      it('switches to the previous tab', () => {
        // Currently on file3 (last opened)
        expect(activeFileId).toBe('/test/file3.ts');

        previousTab();
        expect(activeFileId).toBe('/test/file2.ts');

        previousTab();
        expect(activeFileId).toBe('/test/file1.ts');

        previousTab();
        expect(activeFileId).toBe('/test/file3.ts'); // Wraps around
      });

      it('does nothing with single file', async () => {
        openFiles.length = 0;
        setActiveFileId(null);
        await openFile('/test/single.ts', 'single.ts');

        expect(activeFileId).toBe('/test/single.ts');
        previousTab();
        expect(activeFileId).toBe('/test/single.ts');
      });

      it('selects last file if no active file', () => {
        setActiveFileId(null);
        previousTab();
        expect(activeFileId).toBe('/test/file3.ts');
      });
    });

    describe('goToTab', () => {
      it('switches to specific tab by 1-based index', () => {
        goToTab(1);
        expect(activeFileId).toBe('/test/file1.ts');

        goToTab(2);
        expect(activeFileId).toBe('/test/file2.ts');

        goToTab(3);
        expect(activeFileId).toBe('/test/file3.ts');
      });

      it('does nothing for invalid index', () => {
        setActiveFileId('/test/file1.ts');

        goToTab(0); // Too low
        expect(activeFileId).toBe('/test/file1.ts');

        goToTab(4); // Too high
        expect(activeFileId).toBe('/test/file1.ts');

        goToTab(-1); // Negative
        expect(activeFileId).toBe('/test/file1.ts');
      });
    });
  });

  describe('file operations', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('createNewFile', () => {
      it('calls fs.createFile with correct path', async () => {
        await createNewFile('/workspace/src', 'test.ts');

        expect(fs.createFile).toHaveBeenCalledWith('/workspace/src/test.ts');
      });

      it('handles file creation errors gracefully', async () => {
        vi.mocked(fs.createFile).mockRejectedValueOnce(new Error('Permission denied'));

        // Should not throw
        await expect(createNewFile('/workspace', 'test.ts')).resolves.not.toThrow();
      });
    });

    describe('createNewDirectory', () => {
      it('calls fs.createDirectory with correct path', async () => {
        await createNewDirectory('/workspace', 'components');

        expect(fs.createDirectory).toHaveBeenCalledWith('/workspace/components');
      });

      it('handles directory creation errors gracefully', async () => {
        vi.mocked(fs.createDirectory).mockRejectedValueOnce(new Error('Already exists'));

        // Should not throw
        await expect(createNewDirectory('/workspace', 'test')).resolves.not.toThrow();
      });
    });

    describe('deletePath', () => {
      it('calls fs.deletePath with correct path', async () => {
        await deletePath('/workspace/file.ts');

        expect(fs.deletePath).toHaveBeenCalledWith('/workspace/file.ts');
      });

      it('closes open file when deleting its path', async () => {
        await openFile('/workspace/file.ts', 'file.ts');
        expect(openFiles.length).toBe(1);
        expect(activeFileId).toBe('/workspace/file.ts');

        await deletePath('/workspace/file.ts');

        expect(openFiles.length).toBe(0);
        expect(activeFileId).toBeNull();
      });

      it('does not affect unrelated open files', async () => {
        await openFile('/workspace/file1.ts', 'file1.ts');
        await openFile('/workspace/file2.ts', 'file2.ts');
        expect(openFiles.length).toBe(2);

        await deletePath('/workspace/file1.ts');

        expect(openFiles.length).toBe(1);
        expect(openFiles[0].path).toBe('/workspace/file2.ts');
      });

      it('handles deletion errors gracefully', async () => {
        vi.mocked(fs.deletePath).mockRejectedValueOnce(new Error('File not found'));

        // Should not throw
        await expect(deletePath('/workspace/nonexistent.ts')).resolves.not.toThrow();
      });
    });

    describe('renamePath', () => {
      it('calls fs.renamePath with correct paths', async () => {
        await renamePath('/workspace/old.ts', '/workspace/new.ts');

        expect(fs.renamePath).toHaveBeenCalledWith('/workspace/old.ts', '/workspace/new.ts');
      });

      it('updates open file path and name when renamed', async () => {
        await openFile('/workspace/old.ts', 'old.ts');
        expect(openFiles[0].path).toBe('/workspace/old.ts');
        expect(openFiles[0].name).toBe('old.ts');
        expect(openFiles[0].id).toBe('/workspace/old.ts');

        await renamePath('/workspace/old.ts', '/workspace/new.ts');

        expect(openFiles[0].path).toBe('/workspace/new.ts');
        expect(openFiles[0].name).toBe('new.ts');
        expect(openFiles[0].id).toBe('/workspace/new.ts');
      });

      it('updates activeFileId when renaming active file', async () => {
        await openFile('/workspace/old.ts', 'old.ts');
        expect(activeFileId).toBe('/workspace/old.ts');

        await renamePath('/workspace/old.ts', '/workspace/new.ts');

        expect(activeFileId).toBe('/workspace/new.ts');
      });

      it('does not affect unrelated open files', async () => {
        await openFile('/workspace/file1.ts', 'file1.ts');
        await openFile('/workspace/file2.ts', 'file2.ts');

        await renamePath('/workspace/file1.ts', '/workspace/renamed.ts');

        expect(openFiles.length).toBe(2);
        expect(openFiles[0].path).toBe('/workspace/renamed.ts');
        expect(openFiles[1].path).toBe('/workspace/file2.ts');
      });

      it('handles rename errors gracefully', async () => {
        vi.mocked(fs.renamePath).mockRejectedValueOnce(new Error('File not found'));

        // Should not throw
        await expect(renamePath('/workspace/old.ts', '/workspace/new.ts')).resolves.not.toThrow();
      });
    });
  });
});
