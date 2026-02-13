import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleEditorCommand,
  resetEditorMocks,
  isEditorCommand,
} from '../../src/lib/mocks/editor.mock';

describe('Find All References Mock System', () => {
  beforeEach(() => {
    resetEditorMocks();
  });

  describe('Command availability', () => {
    it('should recognize lsp_references as editor command', () => {
      expect(isEditorCommand('lsp_references')).toBe(true);
    });
  });

  describe('Basic references finding', () => {
    it('returns all references for a function', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function foo() {}\nfoo();\nconst x = foo();\nif (foo()) {}',
        },
      });

      // Find references to "foo" (cursor on function name in declaration)
      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 0,
        character: 9, // on "foo" in function definition
        includeDeclaration: true,
      }) as any[];

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(3); // Declaration + 3 usages
      
      // Check that all references have correct structure
      result.forEach((ref) => {
        expect(ref).toHaveProperty('path');
        expect(ref).toHaveProperty('startLine');
        expect(ref).toHaveProperty('startCharacter');
        expect(ref).toHaveProperty('endLine');
        expect(ref).toHaveProperty('endCharacter');
      });
    });

    it('returns references for a variable', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const myVar = 42;\nconsole.log(myVar);\nreturn myVar;',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 0,
        character: 6, // on "myVar" in declaration
        includeDeclaration: true,
      }) as any[];

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(3); // Declaration + 2 usages
    });

    it('returns references from cursor position on usage', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function bar() {}\nbar();\nbar();',
        },
      });

      // Find references from usage line (not declaration)
      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 1, // on first call
        character: 0,
        includeDeclaration: true,
      }) as any[];

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(3); // Declaration + 2 calls
    });
  });

  describe('includeDeclaration parameter', () => {
    it('includes declaration when includeDeclaration is true', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function test() {}\ntest();\ntest();',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 1,
        character: 0,
        includeDeclaration: true,
      }) as any[];

      // Should include declaration + 2 usages = 3
      expect(result.length).toBe(3);
      
      // Check that first reference is the declaration (line 0)
      const declarationRef = result.find((ref) => ref.startLine === 0);
      expect(declarationRef).toBeDefined();
    });

    it('excludes declaration when includeDeclaration is false', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function test() {}\ntest();\ntest();',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 1,
        character: 0,
        includeDeclaration: false,
      }) as any[];

      // Should only include 2 usages (no declaration)
      expect(result.length).toBe(2);
      
      // Check that no reference is on line 0 (declaration line)
      const declarationRef = result.find((ref) => ref.startLine === 0);
      expect(declarationRef).toBeUndefined();
    });

    it('defaults to including declaration when parameter omitted', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const value = 10;\nvalue + 5;\nvalue * 2;',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 1,
        character: 0,
        // includeDeclaration omitted - should default to true
      }) as any[];

      expect(result.length).toBe(3); // Declaration + 2 usages
    });
  });

  describe('Multiple occurrences on same line', () => {
    it('finds all occurrences when symbol appears multiple times on one line', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const x = 1;\nconst result = x + x + x;',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 0,
        character: 6,
        includeDeclaration: true,
      }) as any[];

      expect(result.length).toBe(4); // Declaration + 3 usages on second line
      
      // Check that we have 3 references on line 1
      const line1Refs = result.filter((ref) => ref.startLine === 1);
      expect(line1Refs.length).toBe(3);
    });
  });

  describe('Different symbol types', () => {
    it('finds references for const declarations', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const myConst = 42;\nconsole.log(myConst);',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 0,
        character: 6,
        includeDeclaration: true,
      }) as any[];

      expect(result.length).toBe(2);
    });

    it('finds references for let declarations', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'let myLet = 10;\nmyLet = 20;\nconsole.log(myLet);',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 0,
        character: 4,
        includeDeclaration: true,
      }) as any[];

      expect(result.length).toBe(3); // Declaration + 2 usages
    });

    it('finds references for class names', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'class MyClass {}\nconst instance = new MyClass();\nconst another = new MyClass();',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 0,
        character: 6,
        includeDeclaration: true,
      }) as any[];

      expect(result.length).toBe(3); // Declaration + 2 usages
    });

    it('finds references for exported functions', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'export function exported() {}\nexported();\nconst ref = exported;',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 0,
        character: 16,
        includeDeclaration: true,
      }) as any[];

      expect(result.length).toBe(3);
    });
  });

  describe('Edge cases', () => {
    it('returns empty array for non-existent buffer', () => {
      const result = handleEditorCommand('lsp_references', {
        bufferId: 'nonexistent.ts',
        line: 0,
        character: 0,
        includeDeclaration: true,
      }) as any[];

      expect(result).toEqual([]);
    });

    it('returns empty array for non-TypeScript/JavaScript files', () => {
      handleEditorCommand('open_buffer', { path: 'test.txt' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.txt',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function foo() {}\nfoo();',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.txt',
        line: 0,
        character: 9,
        includeDeclaration: true,
      }) as any[];

      expect(result).toEqual([]);
    });

    it('returns empty array when line is out of bounds', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function foo() {}',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 999,
        character: 0,
        includeDeclaration: true,
      }) as any[];

      expect(result).toEqual([]);
    });

    it('returns empty array when cursor is on whitespace', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function foo() {}\n   \nfoo();',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 1, // Empty line with spaces
        character: 1,
        includeDeclaration: true,
      }) as any[];

      expect(result).toEqual([]);
    });

    it('handles symbols with no references (only declaration)', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'function unused() {}\nfunction other() {}',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 0,
        character: 9,
        includeDeclaration: true,
      }) as any[];

      // Should only find the declaration itself
      expect(result.length).toBe(1);
      expect(result[0].startLine).toBe(0);
    });
  });

  describe('Reference locations accuracy', () => {
    it('provides correct start and end positions', () => {
      handleEditorCommand('open_buffer', { path: 'test.ts' });
      handleEditorCommand('edit_buffer', {
        bufferId: 'test.ts',
        edit: {
          range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          newText: 'const abc = 1;\nabc;',
        },
      });

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 0,
        character: 6,
        includeDeclaration: true,
      }) as any[];

      expect(result.length).toBe(2);
      
      // Check declaration reference
      const declaration = result.find((ref) => ref.startLine === 0);
      expect(declaration.startCharacter).toBe(6); // "abc" starts at column 6
      expect(declaration.endCharacter).toBe(9); // "abc" is 3 chars long
      
      // Check usage reference
      const usage = result.find((ref) => ref.startLine === 1);
      expect(usage.startCharacter).toBe(0); // "abc" at start of line
      expect(usage.endCharacter).toBe(3);
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

      const result = handleEditorCommand('lsp_references', {
        bufferId: 'test.ts',
        line: 1,
        character: 8,
        includeDeclaration: true,
      }) as any[];

      expect(result.length).toBe(2);
      
      // Both references should have correct character positions accounting for indentation
      const declarationRef = result.find((ref) => ref.startLine === 1);
      expect(declarationRef.startCharacter).toBe(8); // After "  const "
      
      const usageRef = result.find((ref) => ref.startLine === 2);
      expect(usageRef.startCharacter).toBe(9); // After "  return "
    });
  });
});
