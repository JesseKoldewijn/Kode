import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleEditorCommand,
  resetEditorMocks,
  isEditorCommand,
} from '../../src/lib/mocks/editor.mock';

describe('LSP Rename Symbol', () => {
  beforeEach(() => {
    resetEditorMocks();
  });

  describe('Command availability', () => {
    it('should recognize lsp_prepare_rename as editor command', () => {
      expect(isEditorCommand('lsp_prepare_rename')).toBe(true);
    });

    it('should recognize lsp_rename as editor command', () => {
      expect(isEditorCommand('lsp_rename')).toBe(true);
    });
  });

  describe('Prepare Rename', () => {
    it('returns range and placeholder for valid symbol', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function foo() {}\nfoo();',
        },
      });

      const result = handleEditorCommand('lsp_prepare_rename', {
        bufferId: 'test.ts',
        line: 0,
        character: 9, // on "foo" in function definition
      }) as any;

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('range');
      expect(result).toHaveProperty('placeholder');
      expect(result.placeholder).toBe('foo');
      expect(result.range.startLine).toBe(0);
    });

    it('returns null for non-TypeScript/JavaScript files', () => {
      handleEditorCommand('open_buffer', { path: 'test.txt' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.txt',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'some text',
        },
      });

      const result = handleEditorCommand('lsp_prepare_rename', {
        bufferId: 'test.txt',
        line: 0,
        character: 0,
      });

      expect(result).toBeNull();
    });

    it('returns null for non-existent buffer', () => {
      const result = handleEditorCommand('lsp_prepare_rename', {
        bufferId: 'nonexistent.ts',
        line: 0,
        character: 0,
      });

      expect(result).toBeNull();
    });
  });

  describe('Rename Symbol', () => {
    it('renames all occurrences of a function', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function foo() {}\nfoo();\nconst x = foo();',
        },
      });

      const result = handleEditorCommand('lsp_rename', {
        bufferId: 'test.ts',
        line: 0,
        character: 9,
        newName: 'bar',
      }) as any;

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('changes');
      expect(result.changes['test.ts']).toBeInstanceOf(Array);
      expect(result.changes['test.ts'].length).toBe(3); // 3 occurrences

      // Check that each edit has correct structure
      result.changes['test.ts'].forEach((edit: any) => {
        expect(edit).toHaveProperty('range');
        expect(edit).toHaveProperty('newText');
        expect(edit.newText).toBe('bar');
      });
    });

    it('renames variable declarations and usages', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const oldName = 42;\nconsole.log(oldName);\nreturn oldName;',
        },
      });

      const result = handleEditorCommand('lsp_rename', {
        bufferId: 'test.ts',
        line: 0,
        character: 6,
        newName: 'newName',
      }) as any;

      expect(result).not.toBeNull();
      expect(result.changes['test.ts'].length).toBe(3);
      result.changes['test.ts'].forEach((edit: any) => {
        expect(edit.newText).toBe('newName');
      });
    });

    it('handles multiple occurrences on same line', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const x = 1;\nconst result = x + x + x;',
        },
      });

      const result = handleEditorCommand('lsp_rename', {
        bufferId: 'test.ts',
        line: 0,
        character: 6,
        newName: 'y',
      }) as any;

      expect(result).not.toBeNull();
      expect(result.changes['test.ts'].length).toBe(4); // Declaration + 3 on second line
    });

    it('provides correct range information for each edit', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const abc = 1;\nabc;',
        },
      });

      const result = handleEditorCommand('lsp_rename', {
        bufferId: 'test.ts',
        line: 0,
        character: 6,
        newName: 'xyz',
      }) as any;

      expect(result).not.toBeNull();
      const edits = result.changes['test.ts'];
      expect(edits.length).toBe(2);

      // Check first edit (declaration)
      expect(edits[0].range.startLine).toBe(0);
      expect(edits[0].range.startCharacter).toBe(6);
      expect(edits[0].range.endCharacter).toBe(9);

      // Check second edit (usage)
      expect(edits[1].range.startLine).toBe(1);
      expect(edits[1].range.startCharacter).toBe(0);
      expect(edits[1].range.endCharacter).toBe(3);
    });

    it('returns null for non-TypeScript/JavaScript files', () => {
      handleEditorCommand('open_buffer', { path: 'test.txt' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.txt',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'some text',
        },
      });

      const result = handleEditorCommand('lsp_rename', {
        bufferId: 'test.txt',
        line: 0,
        character: 0,
        newName: 'newText',
      });

      expect(result).toBeNull();
    });

    it('returns null when no symbol found at position', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const x = 1;\n   ',
        },
      });

      const result = handleEditorCommand('lsp_rename', {
        bufferId: 'test.ts',
        line: 1, // Empty line
        character: 1,
        newName: 'y',
      });

      expect(result).toBeNull();
    });

    it('handles symbols at different indentation levels', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function test() {\n  const nested = 1;\n  return nested;\n}',
        },
      });

      const result = handleEditorCommand('lsp_rename', {
        bufferId: 'test.ts',
        line: 1,
        character: 8,
        newName: 'value',
      }) as any;

      expect(result).not.toBeNull();
      expect(result.changes['test.ts'].length).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('handles renaming with special characters in new name', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const x = 1;',
        },
      });

      const result = handleEditorCommand('lsp_rename', {
        bufferId: 'test.ts',
        line: 0,
        character: 6,
        newName: '_my$Var123',
      }) as any;

      expect(result).not.toBeNull();
      expect(result.changes['test.ts'][0].newText).toBe('_my$Var123');
    });

    it('handles single-character variable names', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const x = 1;\nconst y = x + 1;',
        },
      });

      const result = handleEditorCommand('lsp_rename', {
        bufferId: 'test.ts',
        line: 0,
        character: 6,
        newName: 'value',
      }) as any;

      expect(result).not.toBeNull();
      expect(result.changes['test.ts'].length).toBe(2); // Declaration + usage
    });
  });
});
