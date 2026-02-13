import { describe, it, expect } from 'vitest';
import {
  handleEditorCommand,
  resetEditorMocks,
} from '../../src/lib/mocks/editor.mock';

describe('Signature Help Mock System', () => {
  it('returns signature help for console.log in TypeScript file', () => {
    resetEditorMocks();
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
    expect(result.signatures).toBeDefined();
    expect(result.signatures.length).toBeGreaterThan(0);
    expect(result.signatures[0].label).toContain('log');
    expect(result.activeSignature).toBe(0);
    expect(result.activeParameter).toBe(0);
  });

  it('returns signature help with multiple overloads for setTimeout', () => {
    resetEditorMocks();
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
  });

  it('calculates active parameter correctly based on comma position', () => {
    resetEditorMocks();
    handleEditorCommand('open_buffer', { path: 'test.ts' });
    handleEditorCommand('edit_buffer', {
      bufferId: 'test.ts',
      edit: {
        range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
        newText: 'Math.pow(2,',
      },
    });

    const result = handleEditorCommand('lsp_signature_help', {
      bufferId: 'test.ts',
      line: 0,
      character: 11,
    }) as any;

    expect(result).not.toBeNull();
    expect(result.activeParameter).toBe(1);
  });

  it('returns null for non-function contexts', () => {
    resetEditorMocks();
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

  it('returns null for unsupported languages', () => {
    resetEditorMocks();
    handleEditorCommand('open_buffer', { path: 'test.txt' });

    const result = handleEditorCommand('lsp_signature_help', {
      bufferId: 'test.txt',
      line: 0,
      character: 0,
    });

    expect(result).toBeNull();
  });
});

// Note: Full UI interaction testing (popup appearance, keyboard navigation,
// active parameter highlighting) is handled by E2E tests since Ripple 
// components require real browser events and DOM interactions.
// The RustEditor component's signature help feature is tested through:
// 1. Mock system tests (above) - verify data layer
// 2. E2E tests - verify full user interaction flow

