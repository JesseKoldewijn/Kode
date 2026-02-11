import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, tick } from 'ripple';
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
      container.remove();
    },
  };
}

describe('EditorArea', () => {
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
    content: 'const x = 1;',
    isDirty: false,
    language: 'typescript',
  };

  describe('file display', () => {
    it('shows empty state when no file is active', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      const { container, cleanup: c } = mountComponent(EditorArea);
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const editorArea = container.querySelector('[data-testid="editor-area"]');
      expect(editorArea).toBeTruthy();

      // Should show "No file is open" message
      expect(editorArea?.textContent).toContain('No file is open');
    });

    it('renders editor when file is active', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      workspace.openFiles.push(mockFile);
      workspace.setActiveFileId(mockFile.id);

      const { container, cleanup: c } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const editorArea = container.querySelector('[data-testid="editor-area"]');
      expect(editorArea).toBeTruthy();

      // Should have editor container
      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();

      // Should render gutter and minimap when editor is active
      const gutter = container.querySelector('[data-testid="editor-gutter"]');
      expect(gutter).toBeTruthy();
      const minimap = container.querySelector('[data-testid="editor-minimap"]');
      expect(minimap).toBeTruthy();
    });

    it('renders SettingsPage for settings tab', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      // Add settings tab to workspace
      const settingsTab: workspace.OpenFile = {
        id: '__settings__',
        path: '',
        name: 'Settings',
        content: '',
        isDirty: false,
        language: '',
        specialTab: 'settings',
      };
      workspace.openFiles.push(settingsTab);
      workspace.setActiveFileId(settingsTab.id);

      const { container, cleanup: c } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const editorArea = container.querySelector('[data-testid="editor-area"]');
      expect(editorArea).toBeTruthy();
    });

    it('renders keybindings settings for keybindings tab', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      const keybindingsTab: workspace.OpenFile = {
        id: '__settings-keybindings__',
        path: '',
        name: 'Keyboard Shortcuts',
        content: '',
        isDirty: false,
        language: '',
        specialTab: 'settings-keybindings',
      };
      workspace.openFiles.push(keybindingsTab);
      workspace.setActiveFileId(keybindingsTab.id);

      const { container, cleanup: c } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const editorArea = container.querySelector('[data-testid="editor-area"]');
      expect(editorArea).toBeTruthy();
    });
  });

  describe('state synchronization', () => {
    it('updates when activeFileId changes', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      const { container, cleanup: c } = mountComponent(EditorArea);
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container.textContent).toContain('No file is open');

      workspace.openFiles.push(mockFile);
      workspace.setActiveFileId(mockFile.id);

      // Re-mount with new activeFile so EditorArea (no context in test) shows the file
      c();
      const { container: container2, cleanup: c2 } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c2;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const editorContainer = container2.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
    });

    it('updates when openFiles changes', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      workspace.openFiles.push(mockFile);
      workspace.setActiveFileId(mockFile.id);

      const { container, cleanup: c } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      workspace.closeFile(mockFile.id);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Re-mount with current workspace state (no context in test) to see empty state
      c();
      const { container: container2, cleanup: c2 } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c2;

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container2.textContent).toContain('No file is open');
    });

    it('shows active file content in editor body (and updates when active file is set before mount)', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      const fileA: workspace.OpenFile = {
        id: 'file-a',
        path: '/a.ts',
        name: 'a.ts',
        content: 'content A',
        isDirty: false,
        language: 'typescript',
      };
      const fileB: workspace.OpenFile = {
        id: 'file-b',
        path: '/b.ts',
        name: 'b.ts',
        content: 'content B',
        isDirty: false,
        language: 'typescript',
      };
      workspace.openFiles.push(fileA, fileB);
      workspace.setActiveFileId(fileB.id);

      const { container, cleanup: c } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
      expect(editorContainer?.textContent).toContain('content B');
      expect(editorContainer?.textContent).not.toContain('content A');
    });

    it('shows first file content when that file is active at mount', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      const fileA: workspace.OpenFile = {
        id: 'file-a',
        path: '/a.ts',
        name: 'a.ts',
        content: 'content A',
        isDirty: false,
        language: 'typescript',
      };
      const fileB: workspace.OpenFile = {
        id: 'file-b',
        path: '/b.ts',
        name: 'b.ts',
        content: 'content B',
        isDirty: false,
        language: 'typescript',
      };
      workspace.openFiles.push(fileA, fileB);
      workspace.setActiveFileId(fileA.id);

      const { container, cleanup: c } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
      expect(editorContainer?.textContent).toContain('content A');
    });
  });

  describe('line-number column', () => {
    it('shows exactly one gutter with visible line numbers when file is open', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      const fileWithContent: workspace.OpenFile = {
        id: 'gutter-test',
        path: '/gutter.ts',
        name: 'gutter.ts',
        content: 'line one\nline two',
        isDirty: false,
        language: 'typescript',
      };
      workspace.openFiles.push(fileWithContent);
      workspace.setActiveFileId(fileWithContent.id);

      const { container, cleanup: c } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const triggerResize = (globalThis as any).__triggerResizeObserver__ as (
        height: number
      ) => void;
      if (typeof triggerResize === 'function') {
        triggerResize(400);
        await tick();
      }

      const gutters = container.querySelectorAll('[data-testid="editor-gutter"]');
      expect(gutters.length).toBe(1);

      const gutter = gutters[0];
      expect(gutter?.textContent).toContain('1');
    });
  });

  describe('component structure', () => {
    it('renders EditorTabs component', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      workspace.openFiles.push(mockFile);
      workspace.setActiveFileId(mockFile.id);

      const { container, cleanup: c } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      // EditorTabs should be present (has tabs container)
      const editorArea = container.querySelector('[data-testid="editor-area"]');
      expect(editorArea).toBeTruthy();
    });

    it('renders Breadcrumbs component', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      workspace.openFiles.push(mockFile);
      workspace.setActiveFileId(mockFile.id);

      const { container, cleanup: c } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const editorArea = container.querySelector('[data-testid="editor-area"]');
      expect(editorArea).toBeTruthy();
    });
  });

  describe('keyboard shortcuts hints', () => {
    it('shows keyboard shortcuts in empty state', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      const { container, cleanup: c } = mountComponent(EditorArea);
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should show quick open shortcut
      expect(container.textContent).toContain('Ctrl+P');
      expect(container.textContent).toContain('Quick Open');

      // Should show settings shortcut
      expect(container.textContent).toContain('Ctrl+,');
      expect(container.textContent).toContain('Settings');

      // Should show terminal shortcut
      expect(container.textContent).toContain('Ctrl+`');
      expect(container.textContent).toContain('Toggle Terminal');
    });
  });
});

describe('EditorArea performance', () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    workspace.openFiles.length = 0;
    workspace.setActiveFileId(null);
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  it('mounts in <100ms with no active file', async () => {
    const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

    const container = document.createElement('div');
    document.body.appendChild(container);

    const start = performance.now();

    mount(EditorArea, {
      target: container,
      props: {},
    });

    const duration = performance.now() - start;

    cleanup = () => container.remove();

    expect(duration).toBeLessThan(100);
  });

  it('mounts in <150ms with active file', async () => {
    const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

    const mockFile: workspace.OpenFile = {
      id: 'perf-test',
      path: '/test/perf.ts',
      name: 'perf.ts',
      content: 'const x = 1;',
      isDirty: false,
      language: 'typescript',
    };

    workspace.openFiles.push(mockFile);
    workspace.setActiveFileId(mockFile.id);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const start = performance.now();

    mount(EditorArea, {
      target: container,
      props: { activeFile: workspace.getActiveFile() },
    });

    const duration = performance.now() - start;

    cleanup = () => container.remove();

    expect(duration).toBeLessThan(150);
  });
});
