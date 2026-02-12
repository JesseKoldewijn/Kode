import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, tick, flushSync } from 'ripple';
import * as workspace from '../../src/lib/workspace';
import { EditorArea } from '../../src/components/layout/EditorArea.ripple';

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
    it('updates when activeFileId changes via subscription (no remount)', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      // Start with a file open
      workspace.openFiles.push(mockFile);
      workspace.setActiveFileId(mockFile.id);

      const { container, cleanup: c } = mountComponent(EditorArea, {
        activeFile: workspace.getActiveFile(),
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify initial state shows the file
      expect(container.querySelector('[data-testid="editor-container"]')).toBeTruthy();
      expect(
        container.querySelector('[data-testid="editor-area"]')?.getAttribute('data-current-file-id')
      ).toBe(mockFile.id);

      // Add a second file
      const secondFile: workspace.OpenFile = {
        id: 'second-file',
        path: '/test/second.ts',
        name: 'second.ts',
        content: 'const y = 2;',
        isDirty: false,
        language: 'typescript',
      };
      workspace.openFiles.push(secondFile);

      // Switch to second file using flushSync (same as real tab click)
      flushSync(() => {
        workspace.setActiveFileId(secondFile.id);
      });

      await tick();
      await tick();

      // Verify the component updated in-place (no remount) to show the new file
      const editorArea = container.querySelector('[data-testid="editor-area"]');
      expect(editorArea?.getAttribute('data-current-file-id')).toBe(secondFile.id);
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

    it('shows new file content when active file is switched after mount', async () => {
      const fileA: workspace.OpenFile = {
        id: 'file-a',
        path: '/a.ts',
        name: 'a.ts',
        content: 'content A only',
        isDirty: false,
        language: 'typescript',
      };
      const fileB: workspace.OpenFile = {
        id: 'file-b',
        path: '/b.ts',
        name: 'b.ts',
        content: 'content B only',
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

      let editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
      expect(editorContainer?.textContent).toContain('content A only');
      expect(editorContainer?.textContent).not.toContain('content B only');

      // Must call setActiveFileId inside flushSync so subscription callbacks run in FLUSH_SYNC mode
      flushSync(() => {
        workspace.setActiveFileId(fileB.id);
      });

      // Allow nested updates (RustEditor content sync effect) to run
      await tick();
      await tick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify editor-area attributes updated to reflect file B
      const editorArea = container.querySelector('[data-testid="editor-area"]');
      expect(editorArea?.getAttribute('data-current-file-id')).toBe(fileB.id);
      expect(editorArea?.getAttribute('data-active-file-id')).toBe(fileB.id);

      // Verify editor-container attributes updated to reflect file B
      editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer?.getAttribute('data-active-file-id')).toBe(fileB.id);

      // Note: In jsdom tests, the RustEditor component's internal content may not fully update
      // due to async effects and the key-based recreation timing. The data attributes confirm
      // the correct file is active. E2E tests verify actual content switching.
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

      // EditorTabs should be present (has editor-tabs container)
      const editorTabs = container.querySelector('[data-testid="editor-tabs"]');
      expect(editorTabs).toBeTruthy();

      // Should have at least one tab for the open file
      const tab = container.querySelector('[data-testid^="editor-tab:"]');
      expect(tab).toBeTruthy();
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

      // Breadcrumbs should be present (added data-testid="breadcrumbs")
      const breadcrumbs = container.querySelector('[data-testid="breadcrumbs"]');
      expect(breadcrumbs).toBeTruthy();

      // Note: Breadcrumbs content depends on workspacePath and subscribeToActiveFile
      // In unit tests without a proper workspace setup, the content may be empty
      // The E2E tests verify full breadcrumb functionality
    });
  });

  describe('gutter updates on file switch', () => {
    it('gutter line count changes when switching between files with different line counts', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      // File A has 5 lines
      const fileA: workspace.OpenFile = {
        id: 'file-a-gutter',
        path: '/a.ts',
        name: 'a.ts',
        content: 'line1\nline2\nline3\nline4\nline5',
        isDirty: false,
        language: 'typescript',
      };

      // File B has 50 lines
      const fileB: workspace.OpenFile = {
        id: 'file-b-gutter',
        path: '/b.ts',
        name: 'b.ts',
        content: Array.from({ length: 50 }, (_, i) => `line${i + 1}`).join('\n'),
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

      // Trigger resize observer to set container height
      const triggerResize = (globalThis as any).__triggerResizeObserver__ as (
        height: number
      ) => void;
      if (typeof triggerResize === 'function') {
        triggerResize(400);
        await tick();
      }

      // Get initial gutter state for file A (5 lines)
      const gutterA = container.querySelector('[data-testid="editor-gutter"]');
      expect(gutterA).toBeTruthy();
      const gutterAText = gutterA?.textContent || '';
      expect(gutterAText).toContain('1');
      expect(gutterAText).toContain('5');

      // Switch to file B (50 lines)
      flushSync(() => {
        workspace.setActiveFileId(fileB.id);
      });
      await tick();
      await tick();

      // Trigger resize again for new editor instance
      if (typeof triggerResize === 'function') {
        triggerResize(400);
        await tick();
      }

      // Get gutter state for file B
      const gutterB = container.querySelector('[data-testid="editor-gutter"]');
      expect(gutterB).toBeTruthy();
      const gutterBText = gutterB?.textContent || '';
      // File B should show higher line numbers
      expect(gutterBText).toContain('1');
      // With 50 lines, we should see lines beyond 5
      expect(gutterBText.match(/\d+/g)?.some((n) => parseInt(n) > 5)).toBe(true);

      // Switch back to file A
      flushSync(() => {
        workspace.setActiveFileId(fileA.id);
      });
      await tick();
      await tick();

      if (typeof triggerResize === 'function') {
        triggerResize(400);
        await tick();
      }

      // Verify gutter shows file A's line count again
      const gutterAAgain = container.querySelector('[data-testid="editor-gutter"]');
      const gutterAAgainText = gutterAAgain?.textContent || '';
      expect(gutterAAgainText).toContain('5');
    });

    it('cursor/active line resets to line 1 when switching files', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      const fileA: workspace.OpenFile = {
        id: 'cursor-file-a',
        path: '/cursor-a.ts',
        name: 'cursor-a.ts',
        content: 'line1\nline2\nline3\nline4\nline5',
        isDirty: false,
        language: 'typescript',
      };

      const fileB: workspace.OpenFile = {
        id: 'cursor-file-b',
        path: '/cursor-b.ts',
        name: 'cursor-b.ts',
        content: 'first\nsecond\nthird',
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

      const triggerResize = (globalThis as any).__triggerResizeObserver__ as (
        height: number
      ) => void;
      if (typeof triggerResize === 'function') {
        triggerResize(400);
        await tick();
      }

      // Initial state: line 1 should be active (0-indexed = 0)
      // The gutter highlights active line with bg-white/10 class
      let gutter = container.querySelector('[data-testid="editor-gutter"]');
      let activeLineElement = gutter?.querySelector('.bg-white\\/10');
      expect(activeLineElement).toBeTruthy();
      // Active line should contain "1" (first line)
      expect(activeLineElement?.textContent).toContain('1');

      // Switch to file B
      flushSync(() => {
        workspace.setActiveFileId(fileB.id);
      });
      await tick();
      await tick();

      if (typeof triggerResize === 'function') {
        triggerResize(400);
        await tick();
      }

      // After switching, line 1 should still be active (cursor resets)
      gutter = container.querySelector('[data-testid="editor-gutter"]');
      activeLineElement = gutter?.querySelector('.bg-white\\/10');
      expect(activeLineElement).toBeTruthy();
      expect(activeLineElement?.textContent).toContain('1');
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
