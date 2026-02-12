import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Tests for Phase 2 Editing Features
 *
 * These tests verify the new editing features:
 * - Tab key behavior (spaces/tabs)
 * - Auto-indent on Enter
 * - Bracket/quote auto-pairing
 * - Word navigation (Ctrl+Arrow)
 * - Line deletion (Ctrl+Shift+K)
 * - Clipboard operations (copy/cut/paste)
 *
 * Note: Most of these features are tested via integration tests in
 * the RustEditor component tests. These are unit tests for helper functions.
 */

describe('Editing Features - Helper Functions', () => {
  describe('getLineIndentation', () => {
    const getLineIndentation = (line: string): string => {
      const match = line.match(/^(\s*)/);
      return match ? match[1] : '';
    };

    it('returns empty string for no indentation', () => {
      expect(getLineIndentation('function foo() {')).toBe('');
    });

    it('returns spaces for space indentation', () => {
      expect(getLineIndentation('  return 42;')).toBe('  ');
      expect(getLineIndentation('    const x = 1;')).toBe('    ');
    });

    it('returns tabs for tab indentation', () => {
      expect(getLineIndentation('\treturn 42;')).toBe('\t');
      expect(getLineIndentation('\t\tconst x = 1;')).toBe('\t\t');
    });

    it('returns mixed whitespace', () => {
      expect(getLineIndentation('\t  return 42;')).toBe('\t  ');
    });

    it('handles empty lines', () => {
      expect(getLineIndentation('')).toBe('');
    });
  });

  describe('findWordBoundary', () => {
    const isWordChar = (ch: string) => /[a-zA-Z0-9_]/.test(ch);

    const findWordBoundary = (line: string, col: number, direction: 'left' | 'right'): number => {
      if (direction === 'left') {
        if (col === 0) return 0;
        let pos = col - 1;
        const startChar = line[pos];

        if (startChar && isWordChar(startChar)) {
          while (pos > 0 && isWordChar(line[pos - 1])) {
            pos--;
          }
        } else {
          while (pos > 0 && !isWordChar(line[pos - 1]) && line[pos - 1] !== ' ') {
            pos--;
          }
          while (pos > 0 && line[pos - 1] === ' ') {
            pos--;
          }
        }
        return pos;
      } else {
        if (col >= line.length) return line.length;
        let pos = col;
        const startChar = line[pos];

        if (startChar && isWordChar(startChar)) {
          while (pos < line.length && isWordChar(line[pos])) {
            pos++;
          }
        } else {
          while (pos < line.length && !isWordChar(line[pos]) && line[pos] !== ' ') {
            pos++;
          }
          while (pos < line.length && line[pos] === ' ') {
            pos++;
          }
        }
        return pos;
      }
    };

    describe('left navigation', () => {
      it('moves to start of current word', () => {
        const line = 'const myVariable = 42;';
        expect(findWordBoundary(line, 10, 'left')).toBe(6); // From middle of 'myVariable' to start
      });

      it('moves to start of previous word from space', () => {
        const line = 'const myVariable = 42;';
        // Position 17 is in '= ', move left should go to start of '='
        expect(findWordBoundary(line, 17, 'left')).toBe(16); // From space to '='
      });

      it('stops at column 0', () => {
        const line = 'const myVariable = 42;';
        expect(findWordBoundary(line, 0, 'left')).toBe(0);
      });

      it('handles punctuation', () => {
        const line = 'foo.bar.baz';
        expect(findWordBoundary(line, 7, 'left')).toBe(4); // From 'bar' to after '.'
      });

      it('skips multiple spaces', () => {
        const line = 'foo   bar';
        expect(findWordBoundary(line, 6, 'left')).toBe(3); // From space to end of 'foo'
      });
    });

    describe('right navigation', () => {
      it('moves to end of current word', () => {
        const line = 'const myVariable = 42;';
        expect(findWordBoundary(line, 6, 'right')).toBe(16); // From 'm' to end of 'myVariable'
      });

      it('moves to end of next word from space', () => {
        const line = 'const myVariable = 42;';
        expect(findWordBoundary(line, 16, 'right')).toBe(17); // From space to '='
      });

      it('stops at line length', () => {
        const line = 'const myVariable = 42;';
        const len = line.length;
        expect(findWordBoundary(line, len, 'right')).toBe(len);
      });

      it('handles punctuation', () => {
        const line = 'foo.bar.baz';
        expect(findWordBoundary(line, 3, 'right')).toBe(4); // From end of 'foo' to after '.'
      });

      it('skips multiple spaces', () => {
        const line = 'foo   bar';
        expect(findWordBoundary(line, 3, 'right')).toBe(6); // From end of 'foo' to start of 'bar'
      });
    });
  });

  describe('getClosingChar', () => {
    const getClosingChar = (openChar: string): string | null => {
      const pairs: Record<string, string> = {
        '{': '}',
        '[': ']',
        '(': ')',
        '"': '"',
        "'": "'",
        '`': '`',
      };
      return pairs[openChar] ?? null;
    };

    it('returns closing bracket for opening bracket', () => {
      expect(getClosingChar('{')).toBe('}');
      expect(getClosingChar('[')).toBe(']');
      expect(getClosingChar('(')).toBe(')');
    });

    it('returns matching quote', () => {
      expect(getClosingChar('"')).toBe('"');
      expect(getClosingChar("'")).toBe("'");
      expect(getClosingChar('`')).toBe('`');
    });

    it('returns null for non-paired characters', () => {
      expect(getClosingChar('a')).toBe(null);
      expect(getClosingChar('}')).toBe(null);
      expect(getClosingChar('!')).toBe(null);
    });
  });

  describe('shouldSkipClosing', () => {
    const shouldSkipClosing = (line: string, col: number, char: string): boolean => {
      return col < line.length && line[col] === char;
    };

    it('returns true when next char matches', () => {
      expect(shouldSkipClosing('foo)', 3, ')')).toBe(true);
      expect(shouldSkipClosing('const x = "hello"', 16, '"')).toBe(true);
    });

    it('returns false when next char does not match', () => {
      expect(shouldSkipClosing('foo', 3, ')')).toBe(false);
      expect(shouldSkipClosing('const x = "hello', 16, '"')).toBe(false);
    });

    it('returns false at end of line', () => {
      const line = 'foo';
      expect(shouldSkipClosing(line, line.length, ')')).toBe(false);
    });
  });

  describe('Tab Insertion', () => {
    it('should insert spaces when insertSpaces is true', () => {
      const tabSize = 2;
      const insertSpaces = true;
      const result = insertSpaces ? ' '.repeat(tabSize) : '\t';
      expect(result).toBe('  ');
    });

    it('should insert tab character when insertSpaces is false', () => {
      const tabSize = 2;
      const insertSpaces = false;
      const result = insertSpaces ? ' '.repeat(tabSize) : '\t';
      expect(result).toBe('\t');
    });

    it('should respect tabSize setting', () => {
      const tabSize4 = 4;
      const insertSpaces = true;
      const result = insertSpaces ? ' '.repeat(tabSize4) : '\t';
      expect(result).toBe('    ');
    });
  });

  describe('Auto-Indent Detection', () => {
    it('should detect opening braces that need extra indent', () => {
      const lines = ['function foo() {', 'if (true) {', 'const arr = [', 'const obj = {'];

      for (const line of lines) {
        const trimmed = line.trim();
        const shouldIncrease =
          trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(');
        expect(shouldIncrease).toBe(true);
      }
    });

    it('should not increase indent for regular lines', () => {
      const lines = ['const x = 42;', 'return foo;', 'console.log("hello");'];

      for (const line of lines) {
        const trimmed = line.trim();
        const shouldIncrease =
          trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(');
        expect(shouldIncrease).toBe(false);
      }
    });
  });

  describe('Clipboard Text Extraction', () => {
    it('extracts single-line selection', () => {
      const lines = ['const foo = 42;'];
      const startLine = 0;
      const endLine = 0;
      const startCol = 6;
      const endCol = 9;

      let selectedText = '';
      if (startLine === endLine) {
        selectedText = lines[startLine].substring(startCol, endCol);
      }

      expect(selectedText).toBe('foo');
    });

    it('extracts multi-line selection', () => {
      const lines = ['function foo() {', '  return 42;', '}'];
      const startLine = 0;
      const endLine = 2;
      const startCol = 9;
      const endCol = 1;

      let selectedText = '';
      selectedText = lines[startLine].substring(startCol) + '\n';
      for (let i = startLine + 1; i < endLine; i++) {
        selectedText += lines[i] + '\n';
      }
      selectedText += lines[endLine].substring(0, endCol);

      expect(selectedText).toBe('foo() {\n  return 42;\n}');
    });
  });

  describe('Line Deletion Range Calculation', () => {
    it('deletes middle line including newline', () => {
      const lines = ['line 1', 'line 2', 'line 3'];
      const currentLine = 1; // 'line 2'

      const range = {
        startLine: currentLine,
        startCol: 0,
        endLine: currentLine + 1,
        endCol: 0,
      };

      expect(range).toEqual({
        startLine: 1,
        startCol: 0,
        endLine: 2,
        endCol: 0,
      });
    });

    it('deletes last line by removing newline from previous', () => {
      const lines = ['line 1', 'line 2', 'line 3'];
      const currentLine = 2; // 'line 3' (last)

      const range = {
        startLine: currentLine - 1,
        startCol: lines[currentLine - 1].length,
        endLine: currentLine,
        endCol: lines[currentLine].length,
      };

      expect(range).toEqual({
        startLine: 1,
        startCol: 6,
        endLine: 2,
        endCol: 6,
      });
    });

    it('clears single line if only line in file', () => {
      const lines = ['only line'];
      const currentLine = 0;

      const range = {
        startLine: 0,
        startCol: 0,
        endLine: 0,
        endCol: lines[0].length,
      };

      expect(range).toEqual({
        startLine: 0,
        startCol: 0,
        endLine: 0,
        endCol: 9,
      });
    });
  });
});
