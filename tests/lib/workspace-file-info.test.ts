import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectLineEnding,
  currentFileInfo,
  subscribeToFileInfo,
  openFiles,
  setActiveFileId,
  openFile,
  closeFile,
} from '../../src/lib/workspace';

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
}));

// Mock the file-watcher module
vi.mock('../../src/lib/file-watcher', () => ({
  startFileWatcher: vi.fn().mockResolvedValue(undefined),
  stopFileWatcher: vi.fn().mockResolvedValue(undefined),
  subscribeToFileChanges: vi.fn().mockReturnValue(() => {}),
}));

describe('detectLineEnding', () => {
  describe('basic line ending detection', () => {
    it('returns LF for empty content', () => {
      expect(detectLineEnding('')).toBe('LF');
    });

    it('returns LF for null-ish content', () => {
      expect(detectLineEnding(null as unknown as string)).toBe('LF');
      expect(detectLineEnding(undefined as unknown as string)).toBe('LF');
    });

    it('returns LF for content with no line endings', () => {
      expect(detectLineEnding('hello world')).toBe('LF');
    });

    it('returns LF for LF-only content', () => {
      expect(detectLineEnding('line1\nline2\nline3')).toBe('LF');
    });

    it('returns CRLF for CRLF-only content', () => {
      expect(detectLineEnding('line1\r\nline2\r\nline3')).toBe('CRLF');
    });

    it('returns CR for CR-only content (legacy Mac)', () => {
      expect(detectLineEnding('line1\rline2\rline3')).toBe('CR');
    });
  });

  describe('mixed line ending detection', () => {
    it('returns CRLF for mixed content with CRLF majority', () => {
      // 3 CRLF, 1 LF
      const content = 'line1\r\nline2\r\nline3\r\nline4\nline5';
      expect(detectLineEnding(content)).toBe('CRLF');
    });

    it('returns LF for mixed content with LF majority', () => {
      // 1 CRLF, 3 LF
      const content = 'line1\nline2\nline3\nline4\r\nline5';
      expect(detectLineEnding(content)).toBe('LF');
    });

    it('returns CRLF when CRLF equals LF count', () => {
      // Edge case: equal counts, CRLF wins
      const content = 'line1\r\nline2\n';
      expect(detectLineEnding(content)).toBe('CRLF');
    });

    it('handles complex mixed endings', () => {
      // Mix of all three: 2 CRLF, 1 LF, 1 CR
      const content = 'a\r\nb\r\nc\nd\re';
      expect(detectLineEnding(content)).toBe('CRLF');
    });
  });

  describe('edge cases', () => {
    it('handles single newline at end', () => {
      expect(detectLineEnding('content\n')).toBe('LF');
      expect(detectLineEnding('content\r\n')).toBe('CRLF');
      expect(detectLineEnding('content\r')).toBe('CR');
    });

    it('handles content with only newlines', () => {
      expect(detectLineEnding('\n\n\n')).toBe('LF');
      expect(detectLineEnding('\r\n\r\n\r\n')).toBe('CRLF');
      expect(detectLineEnding('\r\r\r')).toBe('CR');
    });

    it('handles unicode content correctly', () => {
      expect(detectLineEnding('\u4e16\u754c\n\u4f60\u597d')).toBe('LF');
      expect(detectLineEnding('\u{1F600}\r\n\u{1F601}')).toBe('CRLF');
    });

    it('handles very long lines', () => {
      const longLine = 'x'.repeat(10000);
      expect(detectLineEnding(`${longLine}\n${longLine}`)).toBe('LF');
    });
  });
});

describe('file info subscription', () => {
  beforeEach(() => {
    // Reset state
    openFiles.length = 0;
    setActiveFileId(null);
  });

  it('notifies subscribers when file info changes', async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToFileInfo(callback);

    // Open a file which triggers updateFileInfo
    await openFile('/test/file.ts', 'file.ts');

    expect(callback).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        lineEnding: expect.any(String),
        encoding: 'UTF-8',
      })
    );

    unsubscribe();
  });

  it('unsubscribe prevents further notifications', async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToFileInfo(callback);

    unsubscribe();

    await openFile('/test/file.ts', 'file.ts');

    // Callback should not have been called after unsubscribe
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('file info with active file changes', () => {
  beforeEach(() => {
    openFiles.length = 0;
    setActiveFileId(null);
  });

  it('updates file info when switching active files', async () => {
    const callback = vi.fn();
    subscribeToFileInfo(callback);

    // Open first file
    await openFile('/test/file1.ts', 'file1.ts');
    const callCount1 = callback.mock.calls.length;

    // Open second file
    await openFile('/test/file2.ts', 'file2.ts');
    const callCount2 = callback.mock.calls.length;

    // File info should be updated for each new file
    expect(callCount2).toBeGreaterThan(callCount1);
  });

  it('does not update file info for special tabs', async () => {
    const { openSpecialTab } = await import('../../src/lib/workspace');
    const callback = vi.fn();
    subscribeToFileInfo(callback);

    // First open a regular file to establish baseline file info
    await openFile('/test/file.ts', 'file.ts');
    const initialLineEnding = currentFileInfo.lineEnding;

    callback.mockClear();

    // Open settings tab (special tab)
    openSpecialTab('settings');

    // File info should not change for special tabs
    // The lineEnding should remain from the previous regular file
    expect(currentFileInfo.lineEnding).toBe(initialLineEnding);

    // The callback should not have been called with different line ending data
    // (it may be called for other reasons, but not with file content analysis)
    const fileInfoCalls = callback.mock.calls.filter(
      (call) => call[0]?.lineEnding && call[0].lineEnding !== initialLineEnding
    );
    expect(fileInfoCalls).toHaveLength(0);
  });
});

describe('currentFileInfo state', () => {
  it('has default values', () => {
    expect(currentFileInfo).toEqual({
      lineEnding: expect.any(String),
      encoding: 'UTF-8',
    });
  });

  it('encoding is always UTF-8', async () => {
    // Open a file
    await openFile('/test/file.ts', 'file.ts');

    expect(currentFileInfo.encoding).toBe('UTF-8');
  });
});

describe('closeFile and file info', () => {
  beforeEach(() => {
    openFiles.length = 0;
    setActiveFileId(null);
  });

  it('closing file updates active file id', async () => {
    await openFile('/test/file1.ts', 'file1.ts');
    await openFile('/test/file2.ts', 'file2.ts');

    closeFile('/test/file2.ts');

    // After closing file2, file1 should become active
    expect(openFiles.length).toBe(1);
  });
});
