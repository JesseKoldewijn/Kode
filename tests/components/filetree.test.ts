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
});
