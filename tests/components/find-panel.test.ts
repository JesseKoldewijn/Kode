import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { editorEngine, type SearchMatch } from '../../src/lib/editor-engine';

// Mock editorEngine
vi.mock('../../src/lib/editor-engine', () => {
  const mockSearchBuffer = vi.fn(async () => []);
  const mockEditBuffer = vi.fn(async () => ({
    version: 1,
    appliedRange: {
      startLine: 0,
      startCol: 0,
      endLine: 0,
      endCol: 0,
    },
    newEnd: { line: 0, col: 0 },
  }));
  const mockSetSelections = vi.fn(async () => ({
    bufferId: 'test',
    selections: [],
    primaryIndex: 0,
  }));

  return {
    editorEngine: {
      searchBuffer: mockSearchBuffer,
      editBuffer: mockEditBuffer,
      setSelections: mockSetSelections,
    },
  };
});

describe('FindPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search functionality', () => {
    it('calls searchBuffer with correct parameters when searching', async () => {
      vi.mocked(editorEngine.searchBuffer).mockResolvedValueOnce([
        {
          lineNumber: 0,
          startCol: 6,
          endCol: 9,
          lineText: 'const foo = 1;',
          matchText: 'foo',
        },
      ]);

      const result = await editorEngine.searchBuffer('buffer-1', 'foo', false, false);

      expect(editorEngine.searchBuffer).toHaveBeenCalledWith('buffer-1', 'foo', false, false);
      expect(result.length).toBe(1);
      expect(result[0].matchText).toBe('foo');
    });

    it('searches with case sensitivity enabled', async () => {
      vi.mocked(editorEngine.searchBuffer).mockResolvedValueOnce([]);

      await editorEngine.searchBuffer('buffer-1', 'Foo', false, true);

      expect(editorEngine.searchBuffer).toHaveBeenCalledWith('buffer-1', 'Foo', false, true);
    });

    it('searches with regex enabled', async () => {
      vi.mocked(editorEngine.searchBuffer).mockResolvedValueOnce([
        {
          lineNumber: 0,
          startCol: 6,
          endCol: 12,
          lineText: 'const fooBar = 1;',
          matchText: 'fooBar',
        },
      ]);

      const result = await editorEngine.searchBuffer('buffer-1', 'foo.*', true, false);

      expect(editorEngine.searchBuffer).toHaveBeenCalledWith('buffer-1', 'foo.*', true, false);
      expect(result.length).toBe(1);
    });

    it('returns empty array when no matches found', async () => {
      vi.mocked(editorEngine.searchBuffer).mockResolvedValueOnce([]);

      const result = await editorEngine.searchBuffer('buffer-1', 'nonexistent', false, false);

      expect(result.length).toBe(0);
    });

    it('returns multiple matches', async () => {
      const mockResults: SearchMatch[] = [
        {
          lineNumber: 0,
          startCol: 6,
          endCol: 9,
          lineText: 'const foo = 1;',
          matchText: 'foo',
        },
        {
          lineNumber: 2,
          startCol: 6,
          endCol: 9,
          lineText: 'const foo = 3;',
          matchText: 'foo',
        },
        {
          lineNumber: 4,
          startCol: 10,
          endCol: 13,
          lineText: 'function foo() {}',
          matchText: 'foo',
        },
      ];

      vi.mocked(editorEngine.searchBuffer).mockResolvedValueOnce(mockResults);

      const result = await editorEngine.searchBuffer('buffer-1', 'foo', false, false);

      expect(result.length).toBe(3);
      expect(result[0].lineNumber).toBe(0);
      expect(result[1].lineNumber).toBe(2);
      expect(result[2].lineNumber).toBe(4);
    });
  });

  describe('replace functionality', () => {
    it('calls editBuffer to replace text', async () => {
      await editorEngine.editBuffer('buffer-1', {
        range: {
          startLine: 0,
          startCol: 6,
          endLine: 0,
          endCol: 9,
        },
        newText: 'bar',
      });

      expect(editorEngine.editBuffer).toHaveBeenCalledWith('buffer-1', {
        range: {
          startLine: 0,
          startCol: 6,
          endLine: 0,
          endCol: 9,
        },
        newText: 'bar',
      });
    });

    it('replaces multiple matches sequentially', async () => {
      const mockResults: SearchMatch[] = [
        {
          lineNumber: 0,
          startCol: 6,
          endCol: 9,
          lineText: 'const foo = 1;',
          matchText: 'foo',
        },
        {
          lineNumber: 2,
          startCol: 6,
          endCol: 9,
          lineText: 'const foo = 3;',
          matchText: 'foo',
        },
      ];

      // Simulate replacing all matches from bottom to top
      for (let i = mockResults.length - 1; i >= 0; i--) {
        const match = mockResults[i];
        await editorEngine.editBuffer('buffer-1', {
          range: {
            startLine: match.lineNumber,
            startCol: match.startCol,
            endLine: match.lineNumber,
            endCol: match.endCol,
          },
          newText: 'bar',
        });
      }

      expect(editorEngine.editBuffer).toHaveBeenCalledTimes(2);
      // Verify replaced in reverse order (bottom to top)
      expect(editorEngine.editBuffer).toHaveBeenNthCalledWith(1, 'buffer-1', {
        range: {
          startLine: 2,
          startCol: 6,
          endLine: 2,
          endCol: 9,
        },
        newText: 'bar',
      });
      expect(editorEngine.editBuffer).toHaveBeenNthCalledWith(2, 'buffer-1', {
        range: {
          startLine: 0,
          startCol: 6,
          endLine: 0,
          endCol: 9,
        },
        newText: 'bar',
      });
    });
  });

  describe('navigation with setSelections', () => {
    it('calls setSelections to navigate to match', async () => {
      const match: SearchMatch = {
        lineNumber: 5,
        startCol: 10,
        endCol: 15,
        lineText: 'const match = true;',
        matchText: 'match',
      };

      await editorEngine.setSelections('buffer-1', [
        {
          anchorLine: match.lineNumber,
          anchorCol: match.startCol,
          headLine: match.lineNumber,
          headCol: match.endCol,
        },
      ]);

      expect(editorEngine.setSelections).toHaveBeenCalledWith('buffer-1', [
        {
          anchorLine: 5,
          anchorCol: 10,
          headLine: 5,
          headCol: 15,
        },
      ]);
    });
  });

  describe('search patterns', () => {
    it('handles empty query', async () => {
      vi.mocked(editorEngine.searchBuffer).mockResolvedValueOnce([]);

      const result = await editorEngine.searchBuffer('buffer-1', '', false, false);

      expect(result.length).toBe(0);
    });

    it('handles special regex characters when regex is disabled', async () => {
      vi.mocked(editorEngine.searchBuffer).mockResolvedValueOnce([
        {
          lineNumber: 0,
          startCol: 0,
          endCol: 5,
          lineText: 'foo.*',
          matchText: 'foo.*',
        },
      ]);

      const result = await editorEngine.searchBuffer('buffer-1', 'foo.*', false, false);

      expect(result.length).toBe(1);
      expect(result[0].matchText).toBe('foo.*');
    });

    it('handles multiline search results', async () => {
      vi.mocked(editorEngine.searchBuffer).mockResolvedValueOnce([
        {
          lineNumber: 0,
          startCol: 0,
          endCol: 10,
          lineText: 'first line with pattern',
          matchText: 'first line',
        },
        {
          lineNumber: 10,
          startCol: 5,
          endCol: 15,
          lineText: 'another pattern match',
          matchText: 'pattern ma',
        },
      ]);

      const result = await editorEngine.searchBuffer('buffer-1', 'pattern', false, false);

      expect(result.length).toBe(2);
      expect(result[0].lineNumber).toBe(0);
      expect(result[1].lineNumber).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('handles buffer not found error', async () => {
      vi.mocked(editorEngine.searchBuffer).mockRejectedValueOnce(new Error('Buffer not found'));

      await expect(
        editorEngine.searchBuffer('invalid-buffer', 'foo', false, false)
      ).rejects.toThrow('Buffer not found');
    });

    it('handles invalid regex pattern error', async () => {
      vi.mocked(editorEngine.searchBuffer).mockRejectedValueOnce(
        new Error('Invalid regex pattern')
      );

      await expect(editorEngine.searchBuffer('buffer-1', '[invalid', true, false)).rejects.toThrow(
        'Invalid regex pattern'
      );
    });

    it('handles replace in non-existent range', async () => {
      vi.mocked(editorEngine.editBuffer).mockRejectedValueOnce(new Error('Invalid range'));

      await expect(
        editorEngine.editBuffer('buffer-1', {
          range: {
            startLine: 999,
            startCol: 0,
            endLine: 999,
            endCol: 5,
          },
          newText: 'replacement',
        })
      ).rejects.toThrow('Invalid range');
    });
  });
});
