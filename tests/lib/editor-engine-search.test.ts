import { describe, it, expect, vi } from 'vitest';
import { editorEngine, type SearchMatch, type DocumentSymbol, type FoldRange } from '../../src/lib/editor-engine';

vi.mock('@tauri-apps/api/core', () => {
  return {
    invoke: vi.fn(async (cmd: string, args: any) => {
      if (cmd === 'search_buffer') {
        const bufferId = args.bufferId as string;
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
    }),
  };
});

describe('editorEngine integration wrappers', () => {
  it('searchBuffer returns search matches', async () => {
    const results = await editorEngine.searchBuffer('buffer-1', 'foo', false, false);
    expect(results.length).toBe(1);
    expect(results[0].matchText).toBe('foo');
    expect(results[0].lineNumber).toBe(0);
  });

  it('getSymbols returns document symbols', async () => {
    const symbols = await editorEngine.getSymbols('buffer-1');
    expect(symbols.length).toBe(1);
    expect(symbols[0].name).toBe('foo');
    expect(symbols[0].kind).toBeTypeOf('string');
  });

  it('getFoldRanges returns fold ranges', async () => {
    const folds = await editorEngine.getFoldRanges('buffer-1');
    expect(folds.length).toBe(1);
    expect(folds[0].kind).toBe('Block');
  });

  it('getBufferInfo returns buffer metadata', async () => {
    const info = await editorEngine.getBufferInfo('buffer-xyz');
    expect(info.id).toBe('buffer-xyz');
    expect(info.language).toBe('TypeScript');
    expect(info.lineCount).toBe(10);
  });
});

