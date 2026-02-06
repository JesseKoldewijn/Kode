import { describe, it, expect, beforeEach, vi } from 'vitest';
import { measureTime, measureTimeAsync, generateLargeContent } from '../helpers/perf';
import { detectLineEnding, openFile, openFiles, setActiveFileId } from '../../src/lib/workspace';

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

describe('detectLineEnding performance', () => {
  describe('small files', () => {
    it('completes in <1ms for small content', () => {
      const content = 'line1\nline2\nline3\n';

      const { durationMs } = measureTime(() => detectLineEnding(content));

      expect(durationMs).toBeLessThan(1);
    });
  });

  describe('medium files (~50KB)', () => {
    it('completes in <5ms for 50KB LF file', () => {
      const content = generateLargeContent(1000, '\n', 50); // ~50KB

      const { durationMs } = measureTime(() => detectLineEnding(content));

      expect(durationMs).toBeLessThan(5);
    });

    it('completes in <5ms for 50KB CRLF file', () => {
      const content = generateLargeContent(1000, '\r\n', 50); // ~50KB

      const { durationMs } = measureTime(() => detectLineEnding(content));

      expect(durationMs).toBeLessThan(5);
    });
  });

  describe('large files (~500KB)', () => {
    it('completes in <5ms for 500KB LF file', () => {
      const content = generateLargeContent(10000, '\n', 50); // ~500KB

      const { durationMs } = measureTime(() => detectLineEnding(content));

      expect(durationMs).toBeLessThan(5);
    });

    it('completes in <5ms for 500KB CRLF file', () => {
      const content = generateLargeContent(10000, '\r\n', 50); // ~500KB

      const { durationMs } = measureTime(() => detectLineEnding(content));

      expect(durationMs).toBeLessThan(5);
    });
  });

  describe('very large files (~1MB)', () => {
    it('completes in <10ms for 1MB file', () => {
      const content = generateLargeContent(20000, '\n', 50); // ~1MB

      const { durationMs } = measureTime(() => detectLineEnding(content));

      expect(durationMs).toBeLessThan(10);
    });
  });

  describe('huge files (~5MB)', () => {
    it('completes in <15ms for 5MB file', () => {
      const content = generateLargeContent(100000, '\n', 50); // ~5MB

      const { durationMs } = measureTime(() => detectLineEnding(content));

      // After optimization, this should be nearly constant time
      // since we only sample the first 4KB
      expect(durationMs).toBeLessThan(15);
    });
  });

  describe('correctness with large files', () => {
    it('correctly detects LF in large file', () => {
      const content = generateLargeContent(10000, '\n', 50);

      const result = detectLineEnding(content);

      expect(result).toBe('LF');
    });

    it('correctly detects CRLF in large file', () => {
      const content = generateLargeContent(10000, '\r\n', 50);

      const result = detectLineEnding(content);

      expect(result).toBe('CRLF');
    });

    it('correctly detects CR in large file', () => {
      const content = generateLargeContent(10000, '\r', 50);

      const result = detectLineEnding(content);

      expect(result).toBe('CR');
    });
  });
});

describe('openFile performance', () => {
  beforeEach(() => {
    openFiles.length = 0;
    setActiveFileId(null);
  });

  it('completes in <50ms excluding I/O', async () => {
    const { durationMs } = await measureTimeAsync(() => openFile('/test/file.ts', 'file.ts'));

    // This measures the time excluding actual file I/O (which is mocked)
    expect(durationMs).toBeLessThan(50);
  });

  it('completes quickly for multiple sequential file opens', async () => {
    const files = [
      { path: '/test/file1.ts', name: 'file1.ts' },
      { path: '/test/file2.ts', name: 'file2.ts' },
      { path: '/test/file3.ts', name: 'file3.ts' },
      { path: '/test/file4.ts', name: 'file4.ts' },
      { path: '/test/file5.ts', name: 'file5.ts' },
    ];

    const start = performance.now();

    for (const file of files) {
      await openFile(file.path, file.name);
    }

    const totalDuration = performance.now() - start;

    // 5 files should complete in <250ms total
    expect(totalDuration).toBeLessThan(250);
    expect(openFiles.length).toBe(5);
  });

  it('reactivating already-open file is very fast', async () => {
    // Open a file
    await openFile('/test/file.ts', 'file.ts');

    // Open a second file
    await openFile('/test/file2.ts', 'file2.ts');

    // Re-open the first file (should just switch active, not reload)
    const { durationMs } = await measureTimeAsync(() => openFile('/test/file.ts', 'file.ts'));

    // Reactivating should be nearly instant
    expect(durationMs).toBeLessThan(5);
  });
});

describe('setActiveFileId performance', () => {
  beforeEach(() => {
    openFiles.length = 0;
    setActiveFileId(null);
  });

  it('completes in <5ms', async () => {
    await openFile('/test/file.ts', 'file.ts');

    const { durationMs } = measureTime(() => setActiveFileId('/test/file.ts'));

    expect(durationMs).toBeLessThan(5);
  });
});

describe('performance regression tests', () => {
  beforeEach(() => {
    openFiles.length = 0;
    setActiveFileId(null);
  });

  it('opening many files does not degrade linearly', async () => {
    // Open 10 files and measure average time
    const times: number[] = [];

    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await openFile(`/test/file${i}.ts`, `file${i}.ts`);
      times.push(performance.now() - start);
    }

    // Later file opens should not be significantly slower than early ones
    const earlyAvg = (times[0] + times[1] + times[2]) / 3;
    const lateAvg = (times[7] + times[8] + times[9]) / 3;

    // Late opens should be within 2x of early opens
    expect(lateAvg).toBeLessThan(earlyAvg * 2 + 10); // +10ms buffer for variance
  });
});
