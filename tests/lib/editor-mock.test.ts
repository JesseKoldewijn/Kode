import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleEditorCommand,
  isEditorCommand,
  resetEditorMocks,
  getMockBuffer,
} from '../../src/lib/mocks/editor.mock';

describe('Editor Mock Module', () => {
  beforeEach(() => {
    resetEditorMocks();
  });

  describe('isEditorCommand', () => {
    it('returns true for editor commands', () => {
      expect(isEditorCommand('open_buffer')).toBe(true);
      expect(isEditorCommand('close_buffer')).toBe(true);
      expect(isEditorCommand('edit_buffer')).toBe(true);
      expect(isEditorCommand('get_highlights')).toBe(true);
      expect(isEditorCommand('lsp_hover')).toBe(true);
    });

    it('returns false for non-editor commands', () => {
      expect(isEditorCommand('read_file')).toBe(false);
      expect(isEditorCommand('spawn_terminal')).toBe(false);
      expect(isEditorCommand('unknown_command')).toBe(false);
    });
  });

  describe('open_buffer', () => {
    it('creates a new buffer with proper metadata', () => {
      const result = handleEditorCommand('open_buffer', {
        path: '/demo-project/src/main.ts',
      });

      expect(result).toMatchObject({
        id: '/demo-project/src/main.ts',
        language: 'typescript',
        version: 1,
        isDirty: false,
        lineEnding: 'LF',
      });
      expect(result).toHaveProperty('lineCount');
      expect(result).toHaveProperty('charCount');
    });

    it('detects language from file extension', () => {
      const tsResult = handleEditorCommand('open_buffer', { path: 'file.ts' });
      expect(tsResult).toMatchObject({ language: 'typescript' });

      const jsResult = handleEditorCommand('open_buffer', { path: 'file.js' });
      expect(jsResult).toMatchObject({ language: 'javascript' });

      const rsResult = handleEditorCommand('open_buffer', { path: 'file.rs' });
      expect(rsResult).toMatchObject({ language: 'rust' });

      const pyResult = handleEditorCommand('open_buffer', { path: 'file.py' });
      expect(pyResult).toMatchObject({ language: 'python' });
    });

    it('initializes buffer state', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      const buffer = getMockBuffer('test.ts');

      expect(buffer).toBeDefined();
      expect(buffer?.content).toBeDefined();
      expect(buffer?.selections).toEqual([
        { anchorLine: 0, anchorCol: 0, headLine: 0, headCol: 0 },
      ]);
      expect(buffer?.history.entries).toHaveLength(1);
      expect(buffer?.history.currentIndex).toBe(0);
    });
  });

  describe('close_buffer', () => {
    it('removes buffer from state', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      expect(getMockBuffer('test.ts')).toBeDefined();

      handleEditorCommand('close_buffer', { bufferId: 'test.ts' });
      expect(getMockBuffer('test.ts')).toBeUndefined();
    });
  });

  describe('get_buffer_info', () => {
    it('returns buffer metadata', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      const info = handleEditorCommand('get_buffer_info', { bufferId: 'test.ts' });

      expect(info).toMatchObject({
        id: 'test.ts',
        language: 'typescript',
        version: 1,
        isDirty: false,
      });
    });

    it('returns default info for unopened buffer', () => {
      const info = handleEditorCommand('get_buffer_info', {
        bufferId: '/demo-project/src/main.ts',
      });

      expect(info).toMatchObject({
        id: '/demo-project/src/main.ts',
        version: 0,
        isDirty: false,
      });
    });
  });

  describe('edit_buffer', () => {
    it('applies single character insertion', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      const result = handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'a',
        },
      });

      expect(result).toMatchObject({
        version: 2,
        newEnd: { line: 0, col: 1 },
      });

      const buffer = getMockBuffer('test.ts');
      expect(buffer?.content).toContain('a');
      expect(buffer?.isDirty).toBe(true);
    });

    it('applies multi-line insertion', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      const result = handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'line1\nline2\nline3',
        },
      });

      expect(result).toMatchObject({
        newEnd: { line: 2, col: 5 },
      });

      const buffer = getMockBuffer('test.ts');
      expect(buffer?.content).toContain('line1\nline2\nline3');
    });

    it('applies deletion', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      // Insert text first
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'hello world',
        },
      });

      // Delete "world"
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 6, endLine: 0, endCol: 11 },
          newText: '',
        },
      });

      const buffer = getMockBuffer('test.ts');
      expect(buffer?.content).toContain('hello ');
      expect(buffer?.content).not.toContain('world');
    });

    it('increments version on each edit', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      const result1 = handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'a',
        },
      });
      expect(result1).toMatchObject({ version: 2 });

      const result2 = handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 1, endLine: 0, endCol: 1 },
          newText: 'b',
        },
      });
      expect(result2).toMatchObject({ version: 3 });
    });

    it('marks buffer as dirty after edit', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      let buffer = getMockBuffer('test.ts');
      expect(buffer?.isDirty).toBe(false);

      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'x',
        },
      });

      buffer = getMockBuffer('test.ts');
      expect(buffer?.isDirty).toBe(true);
    });
  });

  describe('edit_buffer_with_selections', () => {
    it('applies edit and updates selections', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      const result = handleEditorCommand('edit_buffer_with_selections', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'hello',
        },
        selections: [{ anchorLine: 0, anchorCol: 5, headLine: 0, headCol: 5 }],
      });

      expect(result).toMatchObject({
        version: 2,
        selections: {
          bufferId: 'test.ts',
          selections: [{ anchorLine: 0, anchorCol: 5, headLine: 0, headCol: 5 }],
          primaryIndex: 0,
        },
      });

      const buffer = getMockBuffer('test.ts');
      expect(buffer?.selections).toEqual([
        { anchorLine: 0, anchorCol: 5, headLine: 0, headCol: 5 },
      ]);
    });
  });

  describe('set_selections and get_selections', () => {
    it('updates and retrieves selections', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      const newSelections = [{ anchorLine: 1, anchorCol: 2, headLine: 3, headCol: 4 }];

      handleEditorCommand('set_selections', {
        bufferId: 'test.ts',
        selections: newSelections,
      });

      const result = handleEditorCommand('get_selections', { bufferId: 'test.ts' });

      expect(result).toMatchObject({
        bufferId: 'test.ts',
        selections: newSelections,
        primaryIndex: 0,
      });
    });
  });

  describe('get_highlights', () => {
    it('returns highlights with totalLines', () => {
      handleEditorCommand('open_buffer', { path: '/demo-project/src/main.ts' });

      const result = handleEditorCommand('get_highlights', {
        bufferId: '/demo-project/src/main.ts',
        startLine: 0,
        endLine: 10,
      });

      expect(result).toHaveProperty('bufferId', '/demo-project/src/main.ts');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('lines');
      expect(result).toHaveProperty('totalLines');
      expect((result as any).totalLines).toBeGreaterThan(0);
    });

    it('tokenizes TypeScript syntax', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      // Insert TypeScript code
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const foo = "bar";',
        },
      });

      const result = handleEditorCommand('get_highlights', {
        bufferId: 'test.ts',
        startLine: 0,
        endLine: 1,
      });

      const lines = (result as any).lines;
      expect(lines).toHaveLength(1);
      expect(lines[0].spans).toBeDefined();
      expect(lines[0].spans.length).toBeGreaterThan(0);

      // Check that keywords are highlighted
      const hasKeyword = lines[0].spans.some((s: any) => s.scope === 'keyword');
      expect(hasKeyword).toBe(true);
    });

    it('works without opened buffer (fallback to file content)', () => {
      const result = handleEditorCommand('get_highlights', {
        bufferId: '/demo-project/src/main.ts',
        startLine: 0,
        endLine: 10,
      });

      expect(result).toHaveProperty('totalLines');
      expect((result as any).totalLines).toBeGreaterThan(0);
    });
  });

  describe('undo and redo', () => {
    it('undoes single edit', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      const initialContent = getMockBuffer('test.ts')?.content;

      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'hello',
        },
      });

      const result = handleEditorCommand('undo_buffer', { bufferId: 'test.ts' });

      expect(result).toMatchObject({ success: true });
      expect((result as any).content).toBe(initialContent);
    });

    it('redoes undone edit', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'hello',
        },
      });

      const afterEdit = getMockBuffer('test.ts')?.content;

      handleEditorCommand('undo_buffer', { bufferId: 'test.ts' });
      const result = handleEditorCommand('redo_buffer', { bufferId: 'test.ts' });

      expect(result).toMatchObject({ success: true });
      expect((result as any).content).toBe(afterEdit);
    });

    it('returns success:false when no undo available', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      const result = handleEditorCommand('undo_buffer', { bufferId: 'test.ts' });

      expect(result).toMatchObject({ success: false });
    });

    it('returns success:false when no redo available', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      const result = handleEditorCommand('redo_buffer', { bufferId: 'test.ts' });

      expect(result).toMatchObject({ success: false });
    });
  });

  describe('get_history_state', () => {
    it('reports no undo/redo for new buffer', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      const result = handleEditorCommand('get_history_state', { bufferId: 'test.ts' });

      expect(result).toEqual({ canUndo: false, canRedo: false });
    });

    it('reports canUndo after edit', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'x',
        },
      });

      const result = handleEditorCommand('get_history_state', { bufferId: 'test.ts' });

      expect(result).toEqual({ canUndo: true, canRedo: false });
    });

    it('reports canRedo after undo', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'x',
        },
      });

      handleEditorCommand('undo_buffer', { bufferId: 'test.ts' });

      const result = handleEditorCommand('get_history_state', { bufferId: 'test.ts' });

      expect(result).toEqual({ canUndo: false, canRedo: true });
    });
  });

  describe('search_buffer', () => {
    beforeEach(() => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'hello world\nhello again\nGoodbye',
        },
      });
    });

    it('finds literal matches', () => {
      const result = handleEditorCommand('search_buffer', {
        bufferId: 'test.ts',
        query: 'hello',
        isRegex: false,
        caseSensitive: true,
      });

      expect((result as any[]).length).toBe(2);
      expect((result as any[])[0]).toMatchObject({
        lineNumber: 0,
        matchText: 'hello',
      });
      expect((result as any[])[1]).toMatchObject({
        lineNumber: 1,
        matchText: 'hello',
      });
    });

    it('performs case-insensitive search', () => {
      const result = handleEditorCommand('search_buffer', {
        bufferId: 'test.ts',
        query: 'HELLO',
        isRegex: false,
        caseSensitive: false,
      });

      expect((result as any[]).length).toBe(2);
    });

    it('supports regex search', () => {
      const result = handleEditorCommand('search_buffer', {
        bufferId: 'test.ts',
        query: 'h\\w+',
        isRegex: true,
        caseSensitive: false,
      });

      expect((result as any[]).length).toBe(2);
    });
  });

  describe('get_symbols', () => {
    it('extracts function declarations', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function myFunc() {}\nexport async function anotherFunc() {}',
        },
      });

      const result = handleEditorCommand('get_symbols', { bufferId: 'test.ts' });

      expect((result as any[]).length).toBeGreaterThanOrEqual(2);
      expect((result as any[]).some((s: any) => s.name === 'myFunc' && s.kind === 'Function')).toBe(
        true
      );
      expect(
        (result as any[]).some((s: any) => s.name === 'anotherFunc' && s.kind === 'Function')
      ).toBe(true);
    });

    it('extracts class declarations', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'class MyClass {}',
        },
      });

      const result = handleEditorCommand('get_symbols', { bufferId: 'test.ts' });

      expect((result as any[]).some((s: any) => s.name === 'MyClass' && s.kind === 'Class')).toBe(
        true
      );
    });
  });

  describe('get_fold_ranges', () => {
    it('detects block folds from braces', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function foo() {\n  console.log("hi");\n}',
        },
      });

      const result = handleEditorCommand('get_fold_ranges', { bufferId: 'test.ts' });

      expect((result as any[]).length).toBeGreaterThan(0);
      expect((result as any[])[0]).toMatchObject({
        startLine: 0,
        endLine: 2,
        kind: 'block',
      });
    });
  });

  describe('save_buffer', () => {
    it('marks buffer as not dirty after save', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'content',
        },
      });

      expect(getMockBuffer('test.ts')?.isDirty).toBe(true);

      handleEditorCommand('save_buffer', { bufferId: 'test.ts' });

      expect(getMockBuffer('test.ts')?.isDirty).toBe(false);
    });
  });

  describe('LSP mock handlers', () => {
    it('lsp_has_session returns true for supported languages', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      const result = handleEditorCommand('lsp_has_session', { bufferId: 'test.ts' });

      expect(result).toBe(true);
    });

    it('lsp_has_session returns false for unsupported languages', () => {
      handleEditorCommand('open_buffer', { path: 'test.txt' });

      const result = handleEditorCommand('lsp_has_session', { bufferId: 'test.txt' });

      expect(result).toBe(false);
    });

    it('lsp_get_diagnostics returns empty array', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      const result = handleEditorCommand('lsp_get_diagnostics', { bufferId: 'test.ts' });

      expect(result).toEqual([]);
    });

    it('lsp_hover returns basic hover info', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'console.log("hi");',
        },
      });

      const result = handleEditorCommand('lsp_hover', {
        bufferId: 'test.ts',
        line: 0,
        character: 0,
      });

      expect(result).toHaveProperty('contents');
    });

    it('lsp_completion returns keyword suggestions', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });

      const result = handleEditorCommand('lsp_completion', {
        bufferId: 'test.ts',
        line: 0,
        character: 0,
      });

      expect(Array.isArray(result)).toBe(true);
      expect((result as any[]).length).toBeGreaterThan(0);
      expect((result as any[]).some((item: any) => item.label === 'function')).toBe(true);
    });

    it('lsp_signature_help returns null for non-existent buffer', () => {
      const result = handleEditorCommand('lsp_signature_help', {
        bufferId: 'nonexistent.ts',
        line: 0,
        character: 0,
      });

      expect(result).toBeNull();
    });

    it('lsp_signature_help returns null for unsupported languages', () => {
      handleEditorCommand('open_buffer', { path: 'test.txt' });

      const result = handleEditorCommand('lsp_signature_help', {
        bufferId: 'test.txt',
        line: 0,
        character: 0,
      });

      expect(result).toBeNull();
    });

    it('lsp_signature_help returns null when not in function call', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const x = 10;',
        },
      });

      const result = handleEditorCommand('lsp_signature_help', {
        bufferId: 'test.ts',
        line: 0,
        character: 10,
      });

      expect(result).toBeNull();
    });

    it('lsp_signature_help returns signature for console.log', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'console.log(',
        },
      });

      const result = handleEditorCommand('lsp_signature_help', {
        bufferId: 'test.ts',
        line: 0,
        character: 12,
      }) as any;

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('signatures');
      expect(Array.isArray(result.signatures)).toBe(true);
      expect(result.signatures.length).toBeGreaterThan(0);
      expect(result.signatures[0].label).toContain('log');
      expect(result.signatures[0].parameters).toBeDefined();
      expect(result.activeSignature).toBe(0);
      expect(result.activeParameter).toBe(0);
    });

    it('lsp_signature_help calculates active parameter based on commas', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'setTimeout(callback,',
        },
      });

      const result = handleEditorCommand('lsp_signature_help', {
        bufferId: 'test.ts',
        line: 0,
        character: 20,
      }) as any;

      expect(result).not.toBeNull();
      expect(result.activeParameter).toBe(1);
    });

    it('lsp_signature_help returns multiple signatures for setTimeout', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'setTimeout(',
        },
      });

      const result = handleEditorCommand('lsp_signature_help', {
        bufferId: 'test.ts',
        line: 0,
        character: 11,
      }) as any;

      expect(result).not.toBeNull();
      expect(result.signatures.length).toBe(2);
      expect(result.signatures[0].label).toContain('callback');
      expect(result.signatures[1].label).toContain('code');
    });

    it('lsp_signature_help works for Math.max', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'Math.max(',
        },
      });

      const result = handleEditorCommand('lsp_signature_help', {
        bufferId: 'test.ts',
        line: 0,
        character: 9,
      }) as any;

      expect(result).not.toBeNull();
      expect(result.signatures[0].label).toContain('max');
      expect(result.signatures[0].documentation).toContain('largest');
    });
  });

  describe('resetEditorMocks', () => {
    it('clears all buffer state', () => {
      handleEditorCommand('open_buffer', { path: 'test1.ts' });
      handleEditorCommand('open_buffer', { path: 'test2.ts' });

      expect(getMockBuffer('test1.ts')).toBeDefined();
      expect(getMockBuffer('test2.ts')).toBeDefined();

      resetEditorMocks();

      expect(getMockBuffer('test1.ts')).toBeUndefined();
      expect(getMockBuffer('test2.ts')).toBeUndefined();
    });
  });
});
