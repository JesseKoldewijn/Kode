import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  editorEngine,
  type SearchMatch,
  type DocumentSymbol,
  type FoldRange,
} from '../../src/lib/editor-engine';

const mockInvoke = vi.fn(async (cmd: string, args: any) => {
  if (cmd === 'search_buffer') {
    const query = args.query as string;
    const matches: SearchMatch[] = [
      {
        lineNumber: 0,
        startCol: 6,
        endCol: 6 + query.length,
        lineText: 'const foo = 1;',
        matchText: query,
      },
    ];
    return matches;
  }

  if (cmd === 'get_symbols') {
    const symbols: DocumentSymbol[] = [
      {
        name: 'foo',
        kind: 'Function',
        startLine: 0,
        endLine: 3,
        startCol: 0,
        endCol: 10,
        children: [],
      },
    ];
    return symbols;
  }

  if (cmd === 'get_fold_ranges') {
    const folds: FoldRange[] = [
      {
        startLine: 0,
        endLine: 10,
        kind: 'Block',
      },
    ];
    return folds;
  }

  if (cmd === 'get_buffer_info') {
    return {
      id: args.bufferId ?? 'test',
      language: 'TypeScript',
      lineCount: 10,
      charCount: 100,
      version: 1,
      isDirty: false,
      lineEnding: 'LF',
    };
  }

  return null;
});

vi.mock('@tauri-apps/api/core', () => {
  return {
    invoke: (cmd: string, args: any) => mockInvoke(cmd, args),
  };
});

describe('editorEngine integration wrappers', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  it('searchBuffer calls invoke with correct command and arguments', async () => {
    const results = await editorEngine.searchBuffer('buffer-1', 'foo', false, false);

    // Verify IPC contract: correct command name and argument shape
    expect(mockInvoke).toHaveBeenCalledWith('search_buffer', {
      bufferId: 'buffer-1',
      query: 'foo',
      isRegex: false,
      caseSensitive: false,
    });

    // Verify return value structure
    expect(results.length).toBe(1);
    expect(results[0]).toMatchObject({
      lineNumber: expect.any(Number),
      startCol: expect.any(Number),
      endCol: expect.any(Number),
      lineText: expect.any(String),
      matchText: 'foo',
    });
  });

  it('getSymbols calls invoke with correct command and bufferId', async () => {
    const symbols = await editorEngine.getSymbols('buffer-1');

    // Verify IPC contract
    expect(mockInvoke).toHaveBeenCalledWith('get_symbols', {
      bufferId: 'buffer-1',
    });

    // Verify return value structure
    expect(symbols.length).toBe(1);
    expect(symbols[0]).toMatchObject({
      name: expect.any(String),
      kind: expect.any(String),
      startLine: expect.any(Number),
      endLine: expect.any(Number),
    });
  });

  it('getFoldRanges calls invoke with correct command and bufferId', async () => {
    const folds = await editorEngine.getFoldRanges('buffer-1');

    // Verify IPC contract
    expect(mockInvoke).toHaveBeenCalledWith('get_fold_ranges', {
      bufferId: 'buffer-1',
    });

    // Verify return value structure
    expect(folds.length).toBe(1);
    expect(folds[0]).toMatchObject({
      startLine: expect.any(Number),
      endLine: expect.any(Number),
      kind: expect.any(String),
    });
  });

  it('getBufferInfo calls invoke with correct command and bufferId', async () => {
    const info = await editorEngine.getBufferInfo('buffer-xyz');

    // Verify IPC contract
    expect(mockInvoke).toHaveBeenCalledWith('get_buffer_info', {
      bufferId: 'buffer-xyz',
    });

    // Verify return value structure
    expect(info).toMatchObject({
      id: 'buffer-xyz',
      language: expect.any(String),
      lineCount: expect.any(Number),
      charCount: expect.any(Number),
      version: expect.any(Number),
      isDirty: expect.any(Boolean),
      lineEnding: expect.any(String),
    });
  });
});
