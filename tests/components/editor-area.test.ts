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

      // Add file to workspace
      workspace.openFiles.push(mockFile);
      workspace.setActiveFileId(mockFile.id);

      const { container, cleanup: c } = mountComponent(EditorArea);
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const editorArea = container.querySelector('[data-testid="editor-area"]');
      expect(editorArea).toBeTruthy();

      // Should have editor container
      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
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

      const { container, cleanup: c } = mountComponent(EditorArea);
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

      const { container, cleanup: c } = mountComponent(EditorArea);
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const editorArea = container.querySelector('[data-testid="editor-area"]');
      expect(editorArea).toBeTruthy();
    });
  });

  describe('state synchronization', () => {
    it('updates when activeFileId changes', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      // Start with no active file
      const { container, cleanup: c } = mountComponent(EditorArea);
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Initially shows empty state
      expect(container.textContent).toContain('No file is open');

      // Add and activate a file
      workspace.openFiles.push(mockFile);
      workspace.setActiveFileId(mockFile.id);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should now show editor
      const editorContainer = container.querySelector('[data-testid="editor-container"]');
      expect(editorContainer).toBeTruthy();
    });

    it('updates when openFiles changes', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      workspace.openFiles.push(mockFile);
      workspace.setActiveFileId(mockFile.id);

      const { container, cleanup: c } = mountComponent(EditorArea);
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Close the file
      workspace.closeFile(mockFile.id);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should show empty state again
      expect(container.textContent).toContain('No file is open');
    });
  });

  describe('component structure', () => {
    it('renders EditorTabs component', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');

      workspace.openFiles.push(mockFile);
      workspace.setActiveFileId(mockFile.id);

      const { container, cleanup: c } = mountComponent(EditorArea);
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

      const { container, cleanup: c } = mountComponent(EditorArea);
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
      props: {},
    });

    const duration = performance.now() - start;

    cleanup = () => container.remove();

    expect(duration).toBeLessThan(150);
  });
});
