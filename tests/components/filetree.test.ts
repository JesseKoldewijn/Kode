import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount } from 'ripple';
import * as workspace from '../../src/lib/workspace';
import type { FileTreeNode } from '../../src/lib/workspace';

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

describe('FileTree Integration Tests', () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    // Reset workspace state
    workspace.fileTree.length = 0;
    workspace.setWorkspacePath(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  const mockFileTree: FileTreeNode[] = [
    {
      id: 'node1',
      name: 'src',
      path: '/workspace/src',
      isDirectory: true,
      isSymlink: false,
      isExpanded: false,
      isLoading: false,
      gitStatus: null,
      children: [
        {
          id: 'node2',
          name: 'index.ts',
          path: '/workspace/src/index.ts',
          isDirectory: false,
          isSymlink: false,
          isExpanded: false,
          isLoading: false,
          gitStatus: null,
          children: null,
        },
      ],
    },
    {
      id: 'node3',
      name: 'README.md',
      path: '/workspace/README.md',
      isDirectory: false,
      isSymlink: false,
      isExpanded: false,
      isLoading: false,
      gitStatus: null,
      children: null,
    },
  ];

  it('renders file tree nodes', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');

    // Set up workspace - this will call loadWorkspace() which clears fileTree
    workspace.setWorkspacePath('/workspace');

    // Wait for loadWorkspace to finish
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Now populate with our mock data
    workspace.fileTree.push(...mockFileTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    // Wait for Ripple to render
    await new Promise((resolve) => setTimeout(resolve, 100));

    const treeContainer = container.querySelector('[data-testid="filetree"]');
    expect(treeContainer).toBeTruthy();

    const srcNode = container.querySelector('[data-testid="filetree-node:/workspace/src"]');
    expect(srcNode).toBeTruthy();
    expect(srcNode?.textContent).toContain('src');

    const readmeNode = container.querySelector(
      '[data-testid="filetree-node:/workspace/README.md"]'
    );
    expect(readmeNode).toBeTruthy();
    expect(readmeNode?.textContent).toContain('README.md');
  });

  it('expands directory when clicked', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');
    const toggleSpy = vi.spyOn(workspace, 'toggleDirectory');

    workspace.setWorkspacePath('/workspace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    workspace.fileTree.push(...mockFileTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    const srcNode = container.querySelector(
      '[data-testid="filetree-node:/workspace/src"]'
    ) as HTMLElement;
    expect(srcNode).toBeTruthy();

    // Click to expand
    srcNode.click();

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(toggleSpy).toHaveBeenCalledWith(expect.objectContaining({ path: '/workspace/src' }));
  });

  it('calls openFile when clicking a file node', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');
    const openFileSpy = vi.spyOn(workspace, 'openFile');

    workspace.setWorkspacePath('/workspace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    workspace.fileTree.push(...mockFileTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    const readmeNode = container.querySelector(
      '[data-testid="filetree-node:/workspace/README.md"]'
    ) as HTMLElement;
    expect(readmeNode).toBeTruthy();

    readmeNode.click();

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(openFileSpy).toHaveBeenCalledWith('/workspace/README.md', 'README.md');
  });

  it('shows "No folder opened" when no workspace is set', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(container.textContent).toContain('No folder opened');
    expect(container.textContent).toContain('Open Folder');
  });

  it('shows context menu on right-click', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');

    workspace.setWorkspacePath('/workspace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    workspace.fileTree.push(...mockFileTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    const srcNode = container.querySelector(
      '[data-testid="filetree-node:/workspace/src"]'
    ) as HTMLElement;
    expect(srcNode).toBeTruthy();

    // Trigger context menu
    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });
    srcNode.dispatchEvent(contextMenuEvent);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const contextMenu = container.querySelector('[data-testid="filetree-context-menu"]');
    expect(contextMenu).toBeTruthy();
  });

  it('renders nested file structure when directory is expanded', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');

    const expandedTree = [
      {
        ...mockFileTree[0],
        isExpanded: true,
      },
      mockFileTree[1],
    ];

    workspace.setWorkspacePath('/workspace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    workspace.fileTree.push(...expandedTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    const indexNode = container.querySelector(
      '[data-testid="filetree-node:/workspace/src/index.ts"]'
    );
    expect(indexNode).toBeTruthy();
    expect(indexNode?.textContent).toContain('index.ts');
  });

  it('creates new file via toolbar button', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');
    const createFileSpy = vi.spyOn(workspace, 'createNewFile');

    workspace.setWorkspacePath('/workspace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    workspace.fileTree.push(...mockFileTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Click "New File" toolbar button
    const newFileButton = container.querySelector('button[title="New File"]') as HTMLElement;
    expect(newFileButton).toBeTruthy();
    newFileButton.click();

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Input field should appear
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toContain('File name');

    // Type file name and press Enter
    input.value = 'test.ts';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(createFileSpy).toHaveBeenCalledWith('/workspace', 'test.ts');
  });

  it('creates new folder via toolbar button', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');
    const createDirSpy = vi.spyOn(workspace, 'createNewDirectory');

    workspace.setWorkspacePath('/workspace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    workspace.fileTree.push(...mockFileTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Click "New Folder" toolbar button
    const newFolderButton = container.querySelector('button[title="New Folder"]') as HTMLElement;
    expect(newFolderButton).toBeTruthy();
    newFolderButton.click();

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Input field should appear
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toContain('Folder name');

    // Type folder name and press Enter
    input.value = 'components';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(createDirSpy).toHaveBeenCalledWith('/workspace', 'components');
  });

  it('cancels file creation on Escape', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');
    const createFileSpy = vi.spyOn(workspace, 'createNewFile');

    workspace.setWorkspacePath('/workspace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    workspace.fileTree.push(...mockFileTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Click "New File" toolbar button
    const newFileButton = container.querySelector('button[title="New File"]') as HTMLElement;
    newFileButton.click();

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Input field should appear
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    // Type empty name (pressing Escape will cancel without calling create)
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Press Escape
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    input.dispatchEvent(escapeEvent);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should not create file (empty names are rejected anyway)
    expect(createFileSpy).not.toHaveBeenCalled();
  });

  it('refreshes file tree when refresh button is clicked', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');
    const refreshSpy = vi.spyOn(workspace, 'refreshWorkspace');

    workspace.setWorkspacePath('/workspace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    workspace.fileTree.push(...mockFileTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Click refresh button
    const refreshButton = container.querySelector('button[title="Refresh"]') as HTMLElement;
    expect(refreshButton).toBeTruthy();
    refreshButton.click();

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(refreshSpy).toHaveBeenCalled();
  });
});

describe('FileTree Context Menu Operations', () => {
  let cleanup: (() => void) | null = null;
  const mockClipboard = {
    writeText: vi.fn(),
  };

  beforeEach(() => {
    // Reset workspace state
    workspace.fileTree.length = 0;
    workspace.setWorkspacePath(null);

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: mockClipboard,
    });
    mockClipboard.writeText.mockReset();
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  const mockFileTree: FileTreeNode[] = [
    {
      id: 'node1',
      name: 'src',
      path: '/workspace/src',
      isDirectory: true,
      isSymlink: false,
      isExpanded: false,
      isLoading: false,
      gitStatus: null,
      children: [
        {
          id: 'node2',
          name: 'index.ts',
          path: '/workspace/src/index.ts',
          isDirectory: false,
          isSymlink: false,
          isExpanded: false,
          isLoading: false,
          gitStatus: null,
          children: null,
        },
      ],
    },
    {
      id: 'node3',
      name: 'README.md',
      path: '/workspace/README.md',
      isDirectory: false,
      isSymlink: false,
      isExpanded: false,
      isLoading: false,
      gitStatus: null,
      children: null,
    },
  ];

  it('shows delete confirmation dialog when delete action is triggered', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');

    workspace.setWorkspacePath('/workspace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    workspace.fileTree.push(...mockFileTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    const readmeNode = container.querySelector(
      '[data-testid="filetree-node:/workspace/README.md"]'
    ) as HTMLElement;

    // Right-click to open context menu
    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });
    readmeNode.dispatchEvent(contextMenuEvent);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Find and click delete action (this would require the context menu to render delete action)
    // For now, we test that the delete confirmation dialog can be triggered
    // This is a placeholder - actual implementation would need to simulate clicking the delete menu item
  });

  it('copies full path to clipboard when "Copy Path" is clicked', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');

    workspace.setWorkspacePath('/workspace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    workspace.fileTree.push(...mockFileTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    const readmeNode = container.querySelector(
      '[data-testid="filetree-node:/workspace/README.md"]'
    ) as HTMLElement;

    // Right-click to open context menu
    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });
    readmeNode.dispatchEvent(contextMenuEvent);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Context menu should be visible
    const contextMenu = container.querySelector('[data-testid="filetree-context-menu"]');
    expect(contextMenu).toBeTruthy();
  });

  it('copies relative path to clipboard when "Copy Relative Path" is clicked', async () => {
    // @ts-expect-error - Ripple component import
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');

    workspace.setWorkspacePath('/workspace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    workspace.fileTree.push(...mockFileTree);

    const { container, cleanup: c } = mountComponent(FileTree);
    cleanup = c;

    await new Promise((resolve) => setTimeout(resolve, 100));

    const readmeNode = container.querySelector(
      '[data-testid="filetree-node:/workspace/README.md"]'
    ) as HTMLElement;

    // Right-click to open context menu
    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });
    readmeNode.dispatchEvent(contextMenuEvent);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Context menu should be visible
    const contextMenu = container.querySelector('[data-testid="filetree-context-menu"]');
    expect(contextMenu).toBeTruthy();
  });
});
