import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleEditorCommand,
  resetEditorMocks,
} from '../../src/lib/mocks/editor.mock';

describe('Goto Definition Mock System', () => {
  beforeEach(() => {
    resetEditorMocks();
  });

  it('returns definition location for a known symbol', () => {
    handleEditorCommand('open_buffer', { path: 'test.ts' });
    handleEditorCommand('edit_buffer', {
      bufferId: 'test.ts',
      edit: {
        range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
        newText: 'function foo() {}\nfoo();',
      },
    });

    // Cursor on "foo" in the function call (line 1)
    const result = handleEditorCommand('lsp_goto_definition', {
      bufferId: 'test.ts',
      line: 1,
      character: 0,
    }) as any;

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('path');
    expect(result).toHaveProperty('startLine');
    expect(result).toHaveProperty('startCharacter');
    expect(result.path).toBe('test.ts');
    // Definition should be on line 0 (the function declaration)
    expect(result.startLine).toBe(0);
  });

  it('returns null when no definition is found', () => {
    handleEditorCommand('open_buffer', { path: 'test.ts' });
    handleEditorCommand('edit_buffer', {
      bufferId: 'test.ts',
      edit: {
        range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
        newText: 'const x = 10;',
      },
    });

    // Cursor on a literal - no definition
    const result = handleEditorCommand('lsp_goto_definition', {
      bufferId: 'test.ts',
      line: 0,
      character: 10,
    });

    expect(result).toBeNull();
  });

  it('returns null for non-existent buffer', () => {
    const result = handleEditorCommand('lsp_goto_definition', {
      bufferId: 'nonexistent.ts',
      line: 0,
      character: 0,
    });

    expect(result).toBeNull();
  });

  it('returns null for unsupported file types', () => {
    handleEditorCommand('open_buffer', { path: 'test.txt' });

    const result = handleEditorCommand('lsp_goto_definition', {
      bufferId: 'test.txt',
      line: 0,
      character: 0,
    });

    expect(result).toBeNull();
  });
});
