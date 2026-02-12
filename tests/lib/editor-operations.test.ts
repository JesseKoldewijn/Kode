import { describe, it, expect } from 'vitest';
import {
  toggleLineComment,
  duplicateLine,
  moveLineUp,
  moveLineDown,
  indentLine,
  outdentLine,
  getCommentSyntax,
  getSelectionLineRange,
} from '../../src/lib/editor-operations';
import type { Selection } from '../../src/lib/editor-engine';

describe('editor-operations', () => {
  // ============================================================================
  // Helper Functions
  // ============================================================================

  describe('getCommentSyntax', () => {
    it('should return line and block comment syntax for JavaScript', () => {
      const syntax = getCommentSyntax('javascript');
      expect(syntax.line).toBe('//');
      expect(syntax.block).toEqual({ start: '/*', end: '*/' });
    });

    it('should return line comment syntax for Python', () => {
      const syntax = getCommentSyntax('python');
      expect(syntax.line).toBe('#');
    });

    it('should return block comment syntax for HTML', () => {
      const syntax = getCommentSyntax('html');
      expect(syntax.block).toEqual({ start: '<!--', end: '-->' });
    });

    it('should return default syntax for unknown language', () => {
      const syntax = getCommentSyntax('unknown');
      expect(syntax.line).toBe('//');
    });
  });

  describe('getSelectionLineRange', () => {
    it('should return line range for single line selection', () => {
      const selection: Selection = {
        anchorLine: 5,
        anchorCol: 0,
        headLine: 5,
        headCol: 10,
      };
      const range = getSelectionLineRange(selection);
      expect(range).toEqual({ start: 5, end: 5 });
    });

    it('should return line range for multi-line selection (forward)', () => {
      const selection: Selection = {
        anchorLine: 2,
        anchorCol: 0,
        headLine: 5,
        headCol: 10,
      };
      const range = getSelectionLineRange(selection);
      expect(range).toEqual({ start: 2, end: 5 });
    });

    it('should return line range for multi-line selection (backward)', () => {
      const selection: Selection = {
        anchorLine: 5,
        anchorCol: 10,
        headLine: 2,
        headCol: 0,
      };
      const range = getSelectionLineRange(selection);
      expect(range).toEqual({ start: 2, end: 5 });
    });
  });

  // ============================================================================
  // Toggle Line Comment
  // ============================================================================

  describe('toggleLineComment', () => {
    it('should add comment to single uncommented line', () => {
      const content = 'console.log("hello");';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = toggleLineComment(content, selection, 'javascript');

      expect(operations).toHaveLength(1);
      expect(operations[0].newText).toBe('// console.log("hello");');
      expect(operations[0].range).toEqual({
        startLine: 0,
        startCol: 0,
        endLine: 0,
        endCol: 21,
      });
    });

    it('should remove comment from single commented line', () => {
      const content = '// console.log("hello");';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = toggleLineComment(content, selection, 'javascript');

      expect(operations).toHaveLength(1);
      expect(operations[0].newText).toBe('console.log("hello");');
    });

    it('should preserve indentation when adding comment', () => {
      const content = '  console.log("hello");';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = toggleLineComment(content, selection, 'javascript');

      expect(operations[0].newText).toBe('  // console.log("hello");');
    });

    it('should preserve indentation when removing comment', () => {
      const content = '  // console.log("hello");';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = toggleLineComment(content, selection, 'javascript');

      expect(operations[0].newText).toBe('  console.log("hello");');
    });

    it('should add comment to multiple lines', () => {
      const content = 'line1\nline2\nline3';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 2,
        headCol: 0,
      };
      const operations = toggleLineComment(content, selection, 'javascript');

      expect(operations).toHaveLength(3);
      expect(operations[0].newText).toBe('// line1');
      expect(operations[1].newText).toBe('// line2');
      expect(operations[2].newText).toBe('// line3');
    });

    it('should remove comment from multiple lines', () => {
      const content = '// line1\n// line2\n// line3';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 2,
        headCol: 0,
      };
      const operations = toggleLineComment(content, selection, 'javascript');

      expect(operations).toHaveLength(3);
      expect(operations[0].newText).toBe('line1');
      expect(operations[1].newText).toBe('line2');
      expect(operations[2].newText).toBe('line3');
    });

    it('should use correct comment syntax for Python', () => {
      const content = 'print("hello")';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = toggleLineComment(content, selection, 'python');

      expect(operations[0].newText).toBe('# print("hello")');
    });

    it('should handle empty lines when adding comments', () => {
      const content = '';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = toggleLineComment(content, selection, 'javascript');

      expect(operations).toHaveLength(1);
      expect(operations[0].newText).toBe('//');
    });

    it('should return empty array for language without line comment syntax', () => {
      const content = 'html content';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = toggleLineComment(content, selection, 'html');

      expect(operations).toEqual([]);
    });
  });

  // ============================================================================
  // Duplicate Line
  // ============================================================================

  describe('duplicateLine', () => {
    it('should duplicate a single line', () => {
      const content = 'line1\nline2\nline3';
      const selection: Selection = {
        anchorLine: 1,
        anchorCol: 0,
        headLine: 1,
        headCol: 5,
      };
      const operation = duplicateLine(content, selection);

      expect(operation.newText).toBe('\nline2');
      expect(operation.range).toEqual({
        startLine: 1,
        startCol: 5,
        endLine: 1,
        endCol: 5,
      });
    });

    it('should duplicate multiple lines', () => {
      const content = 'line1\nline2\nline3\nline4';
      const selection: Selection = {
        anchorLine: 1,
        anchorCol: 0,
        headLine: 2,
        headCol: 5,
      };
      const operation = duplicateLine(content, selection);

      expect(operation.newText).toBe('\nline2\nline3');
      expect(operation.range.startLine).toBe(2);
      expect(operation.range.endLine).toBe(2);
    });

    it('should preserve indentation when duplicating', () => {
      const content = '  indented line';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operation = duplicateLine(content, selection);

      expect(operation.newText).toBe('\n  indented line');
    });

    it('should duplicate the last line', () => {
      const content = 'line1\nline2';
      const selection: Selection = {
        anchorLine: 1,
        anchorCol: 0,
        headLine: 1,
        headCol: 0,
      };
      const operation = duplicateLine(content, selection);

      expect(operation.newText).toBe('\nline2');
    });
  });

  // ============================================================================
  // Move Line Up
  // ============================================================================

  describe('moveLineUp', () => {
    it('should move a single line up', () => {
      const content = 'line1\nline2\nline3';
      const selection: Selection = {
        anchorLine: 1,
        anchorCol: 0,
        headLine: 1,
        headCol: 0,
      };
      const operations = moveLineUp(content, selection);

      expect(operations).toHaveLength(2);
      // First operation: delete line1
      expect(operations[0].range).toEqual({
        startLine: 0,
        startCol: 0,
        endLine: 0,
        endCol: 5,
      });
      expect(operations[0].newText).toBe('');
      // Second operation: insert line1 after line2
      expect(operations[1].newText).toBe('\nline1');
    });

    it('should return empty array when trying to move first line up', () => {
      const content = 'line1\nline2';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = moveLineUp(content, selection);

      expect(operations).toEqual([]);
    });

    it('should move multiple lines up', () => {
      const content = 'line1\nline2\nline3\nline4';
      const selection: Selection = {
        anchorLine: 1,
        anchorCol: 0,
        headLine: 2,
        headCol: 0,
      };
      const operations = moveLineUp(content, selection);

      expect(operations).toHaveLength(2);
      // Delete line1
      expect(operations[0].newText).toBe('');
      // Insert line1 after line3
      expect(operations[1].newText).toBe('\nline1');
    });
  });

  // ============================================================================
  // Move Line Down
  // ============================================================================

  describe('moveLineDown', () => {
    it('should move a single line down', () => {
      const content = 'line1\nline2\nline3';
      const selection: Selection = {
        anchorLine: 1,
        anchorCol: 0,
        headLine: 1,
        headCol: 0,
      };
      const operations = moveLineDown(content, selection);

      expect(operations).toHaveLength(2);
      // First operation: delete line3
      expect(operations[0].range).toEqual({
        startLine: 2,
        startCol: 0,
        endLine: 2,
        endCol: 5,
      });
      expect(operations[0].newText).toBe('');
      // Second operation: insert line3 before line2
      expect(operations[1].newText).toBe('\nline3');
    });

    it('should return empty array when trying to move last line down', () => {
      const content = 'line1\nline2';
      const selection: Selection = {
        anchorLine: 1,
        anchorCol: 0,
        headLine: 1,
        headCol: 0,
      };
      const operations = moveLineDown(content, selection);

      expect(operations).toEqual([]);
    });

    it('should move multiple lines down', () => {
      const content = 'line1\nline2\nline3\nline4';
      const selection: Selection = {
        anchorLine: 1,
        anchorCol: 0,
        headLine: 2,
        headCol: 0,
      };
      const operations = moveLineDown(content, selection);

      expect(operations).toHaveLength(2);
      // Delete line4
      expect(operations[0].newText).toBe('');
      // Insert line4 before line2
      expect(operations[1].newText).toBe('\nline4');
    });
  });

  // ============================================================================
  // Indent Line
  // ============================================================================

  describe('indentLine', () => {
    it('should indent a single line with spaces', () => {
      const content = 'line1';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = indentLine(content, selection, 2, true);

      expect(operations).toHaveLength(1);
      expect(operations[0].newText).toBe('  ');
      expect(operations[0].range).toEqual({
        startLine: 0,
        startCol: 0,
        endLine: 0,
        endCol: 0,
      });
    });

    it('should indent a single line with tab', () => {
      const content = 'line1';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = indentLine(content, selection, 2, false);

      expect(operations).toHaveLength(1);
      expect(operations[0].newText).toBe('\t');
    });

    it('should indent multiple lines', () => {
      const content = 'line1\nline2\nline3';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 2,
        headCol: 0,
      };
      const operations = indentLine(content, selection, 2, true);

      expect(operations).toHaveLength(3);
      expect(operations[0].newText).toBe('  ');
      expect(operations[1].newText).toBe('  ');
      expect(operations[2].newText).toBe('  ');
    });

    it('should use custom tab size', () => {
      const content = 'line1';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = indentLine(content, selection, 4, true);

      expect(operations[0].newText).toBe('    ');
    });
  });

  // ============================================================================
  // Outdent Line
  // ============================================================================

  describe('outdentLine', () => {
    it('should outdent a line with spaces', () => {
      const content = '  line1';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = outdentLine(content, selection, 2);

      expect(operations).toHaveLength(1);
      expect(operations[0].range).toEqual({
        startLine: 0,
        startCol: 0,
        endLine: 0,
        endCol: 2,
      });
      expect(operations[0].newText).toBe('');
    });

    it('should outdent a line with tab', () => {
      const content = '\tline1';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = outdentLine(content, selection, 2);

      expect(operations).toHaveLength(1);
      expect(operations[0].range.endCol).toBe(1);
      expect(operations[0].newText).toBe('');
    });

    it('should not outdent line without indentation', () => {
      const content = 'line1';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = outdentLine(content, selection, 2);

      expect(operations).toEqual([]);
    });

    it('should outdent multiple lines', () => {
      const content = '  line1\n  line2\n  line3';
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 2,
        headCol: 0,
      };
      const operations = outdentLine(content, selection, 2);

      expect(operations).toHaveLength(3);
      expect(operations[0].range.endCol).toBe(2);
      expect(operations[1].range.endCol).toBe(2);
      expect(operations[2].range.endCol).toBe(2);
    });

    it('should remove only up to tabSize spaces', () => {
      const content = '    line1'; // 4 spaces
      const selection: Selection = {
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      };
      const operations = outdentLine(content, selection, 2);

      expect(operations).toHaveLength(1);
      expect(operations[0].range.endCol).toBe(2); // Only remove 2 spaces
    });
  });
});
