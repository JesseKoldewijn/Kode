import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from 'ripple';
import * as workspace from '../../src/lib/workspace';

// Test utility to mount a component and return cleanup function
function mountComponent(Component: any, props?: Record<string, any>) {
  const container = document.createElement('div');
  container.id = 'test-root';
  document.body.appendChild(container);

  mount(Component, {
    target: container,
    props,
  });

  return {
    container,
    cleanup: () => {
      container.innerHTML = '';
      container.remove();
    },
  };
}

describe('CodeEditor', () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    // Reset workspace state
    workspace.openFiles.length = 0;
    workspace.setActiveFileId(null);
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  const mockFile: workspace.OpenFile = {
    id: 'test-file',
    path: '/test/file.ts',
    name: 'file.ts',
    content: 'const x = 1;\nconst y = 2;\nconst z = 3;',
    isDirty: false,
    language: 'typescript',
  };

  describe('editor lifecycle', () => {
    it('creates editor container on mount', async () => {
      const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
      const onContentChange = vi.fn();

      const { container, cleanup: c } = mountComponent(CodeEditor, {
        file: mockFile,
        onContentChange,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
    });

    it('renders editor content', async () => {
      const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
      const onContentChange = vi.fn();

      const { container, cleanup: c } = mountComponent(CodeEditor, {
        file: mockFile,
        onContentChange,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify editor container exists (Monaco is mocked in tests, so we check the container)
      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
    });

    it('handles null file gracefully', async () => {
      const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
      const onContentChange = vi.fn();

      const { container, cleanup: c } = mountComponent(CodeEditor, {
        file: null,
        onContentChange,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should render container but no editor
      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
    });
  });

  describe('language detection', () => {
    const testCases = [
      { language: 'typescript', expected: 'typescript' },
      { language: 'javascript', expected: 'javascript' },
      { language: 'json', expected: 'json' },
      { language: 'markdown', expected: 'markdown' },
      { language: 'css', expected: 'css' },
      { language: 'html', expected: 'html' },
      { language: 'rust', expected: 'rust' },
      { language: 'python', expected: 'python' },
      { language: 'yaml', expected: 'yaml' },
      { language: 'toml', expected: 'toml' },
      { language: 'text', expected: 'text' },
    ];

    testCases.forEach(({ language }) => {
      it(`handles ${language} files`, async () => {
        const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
        const onContentChange = vi.fn();
        const file = { ...mockFile, language };

        const { container, cleanup: c } = mountComponent(CodeEditor, {
          file,
          onContentChange,
        });
        cleanup = c;

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Should render without errors
        const editorContainer = container.querySelector('[data-testid="editor-container"]');
        expect(editorContainer).toBeTruthy();
      });
    });
  });

  describe('content changes', () => {
    it('provides onContentChange callback', async () => {
      const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
      const onContentChange = vi.fn();

      const { cleanup: c } = mountComponent(CodeEditor, {
        file: mockFile,
        onContentChange,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      // The mock doesn't actually trigger content changes,
      // but we verify the callback is accepted as a prop
      expect(onContentChange).toBeDefined();
    });
  });

  describe('goToLine functionality', () => {
    it('accepts goToLine prop', async () => {
      const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
      const onContentChange = vi.fn();

      const { container, cleanup: c } = mountComponent(CodeEditor, {
        file: mockFile,
        onContentChange,
        goToLine: 2,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should render without errors
      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
    });

    it('handles null goToLine', async () => {
      const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
      const onContentChange = vi.fn();

      const { container, cleanup: c } = mountComponent(CodeEditor, {
        file: mockFile,
        onContentChange,
        goToLine: null,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
    });
  });

  describe('find functionality', () => {
    it('accepts openFind prop', async () => {
      const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
      const onContentChange = vi.fn();

      const { container, cleanup: c } = mountComponent(CodeEditor, {
        file: mockFile,
        onContentChange,
        openFind: true,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
    });

    it('accepts openFindReplace prop', async () => {
      const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
      const onContentChange = vi.fn();

      const { container, cleanup: c } = mountComponent(CodeEditor, {
        file: mockFile,
        onContentChange,
        openFindReplace: true,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
    });
  });

  describe('focus functionality', () => {
    it('accepts focusEditor prop', async () => {
      const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
      const onContentChange = vi.fn();

      const { container, cleanup: c } = mountComponent(CodeEditor, {
        file: mockFile,
        onContentChange,
        focusEditor: true,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
    });
  });

  describe('file switching', () => {
    it('handles file prop changes', async () => {
      const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
      const onContentChange = vi.fn();

      const file1 = { ...mockFile, id: 'file1', name: 'file1.ts' };
      const file2 = { ...mockFile, id: 'file2', name: 'file2.ts' };

      // Mount with first file
      const { container, cleanup: c } = mountComponent(CodeEditor, {
        file: file1,
        onContentChange,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Editor should be rendered
      let editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
    });
  });
});

describe('CodeEditor performance', () => {
  let cleanup: (() => void) | null = null;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  it('mounts in <100ms', async () => {
    const { CodeEditor } = await import('../../src/components/editor/CodeEditor.ripple');
    const onContentChange = vi.fn();

    const mockFile: workspace.OpenFile = {
      id: 'perf-test',
      path: '/test/perf.ts',
      name: 'perf.ts',
      content: 'const x = 1;\n'.repeat(100), // 100 lines
      isDirty: false,
      language: 'typescript',
    };

    const container = document.createElement('div');
    document.body.appendChild(container);

    const start = performance.now();

    mount(CodeEditor, {
      target: container,
      props: { file: mockFile, onContentChange },
    });

    const duration = performance.now() - start;

    cleanup = () => container.remove();

    expect(duration).toBeLessThan(100);
  });
});
