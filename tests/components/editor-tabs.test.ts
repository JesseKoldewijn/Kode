import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
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

describe('EditorTabs Integration Tests', () => {
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

  const mockFiles: workspace.OpenFile[] = [
    {
      id: 'file1',
      path: '/path/to/file1.ts',
      name: 'file1.ts',
      content: 'content1',
      isDirty: false,
      language: 'typescript',
    },
    {
      id: 'file2',
      path: '/path/to/file2.js',
      name: 'file2.js',
      content: 'content2',
      isDirty: true,
      language: 'javascript',
    },
  ];

  it('renders open files as tabs', async () => {
    const { EditorTabs } = await import('../../src/components/editor/EditorTabs.ripple');

    // Add files to workspace
    workspace.openFiles.push(...mockFiles);
    workspace.setActiveFileId('file1');

    const { container, cleanup: c } = mountComponent(EditorTabs);
    cleanup = c;

    // Wait for render
    await new Promise((resolve) => setTimeout(resolve, 50));

    const tabs = container.querySelectorAll('[data-testid^="editor-tab:"]');
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent).toContain('file1.ts');
    expect(tabs[1].textContent).toContain('file2.js');
  });

  it('highlights the active tab', async () => {
    const { EditorTabs } = await import('../../src/components/editor/EditorTabs.ripple');

    workspace.openFiles.push(...mockFiles);
    workspace.setActiveFileId('file1');

    const { container, cleanup: c } = mountComponent(EditorTabs);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 50));

    const tab1 = container.querySelector('[data-testid="editor-tab:file1"]');
    const tab2 = container.querySelector('[data-testid="editor-tab:file2"]');

    expect(tab1?.classList.contains('bg-editor-bg')).toBe(true);
    expect(tab2?.classList.contains('bg-editor-bg')).toBe(false);
  });

  it('switches active file when clicking a tab', async () => {
    const { EditorTabs } = await import('../../src/components/editor/EditorTabs.ripple');
    const setActiveSpy = vi.spyOn(workspace, 'setActiveFileId');

    workspace.openFiles.push(...mockFiles);
    workspace.setActiveFileId('file1');

    const { container, cleanup: c } = mountComponent(EditorTabs);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 50));

    const tab2 = container.querySelector('[data-testid="editor-tab:file2"]') as HTMLElement;
    tab2.click();

    expect(setActiveSpy).toHaveBeenCalledWith('file2');
  });

  it('shows dirty indicator for modified files', async () => {
    const { EditorTabs } = await import('../../src/components/editor/EditorTabs.ripple');

    workspace.openFiles.push(...mockFiles);
    workspace.setActiveFileId('file1');

    const { container, cleanup: c } = mountComponent(EditorTabs);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 50));

    const dirty1 = container.querySelector('[data-testid="editor-tab-dirty:file1"]');
    const dirty2 = container.querySelector('[data-testid="editor-tab-dirty:file2"]');

    // file1 is not dirty, file2 is dirty
    expect(dirty1?.classList.contains('hidden')).toBe(true);
    expect(dirty2?.classList.contains('hidden')).toBe(false);
  });

  it('closes a clean file immediately when close button is clicked', async () => {
    const { EditorTabs } = await import('../../src/components/editor/EditorTabs.ripple');
    const closeSpy = vi.spyOn(workspace, 'closeFile');

    workspace.openFiles.push(...mockFiles);
    workspace.setActiveFileId('file1');

    const { container, cleanup: c } = mountComponent(EditorTabs);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 50));

    const closeBtn1 = container.querySelector(
      '[data-testid="editor-tab-close:file1"]'
    ) as HTMLElement;
    closeBtn1.click();

    expect(closeSpy).toHaveBeenCalledWith('file1');
  });

  it('shows confirmation dialog when closing a dirty file', async () => {
    const { EditorTabs } = await import('../../src/components/editor/EditorTabs.ripple');

    workspace.openFiles.push(...mockFiles);
    workspace.setActiveFileId('file2'); // file2 is dirty

    const { container, cleanup: c } = mountComponent(EditorTabs);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 50));

    const closeBtn2 = container.querySelector(
      '[data-testid="editor-tab-close:file2"]'
    ) as HTMLElement;
    closeBtn2.click();

    // Wait for dialog to appear
    await new Promise((resolve) => setTimeout(resolve, 50));

    const dialog = container.querySelector('[data-testid="confirm-dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.classList.contains('hidden')).toBe(false);
    expect(dialog?.textContent).toContain('Unsaved Changes');
  });
});
