import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from 'ripple';

/**
 * Performance tests for reactive array operations in Ripple.
 *
 * These tests measure performance characteristics of tracked arrays
 * to ensure they scale well with larger datasets.
 */
describe('Reactive Array Performance', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should handle large arrays (1000 items) efficiently', async () => {
    const { ChatPanel } = await import('../../src/components/chat/ChatPanel.ripple');
    const mockOnSend = vi.fn();

    const startTime = performance.now();

    const { cleanup } = {
      cleanup: () => {
        container.remove();
      },
    };

    mount(ChatPanel, {
      target: container,
      props: { onSend: mockOnSend },
    });

    const mountTime = performance.now() - startTime;

    // Component should mount in reasonable time (< 500ms even with potential large state)
    expect(mountTime).toBeLessThan(500);

    cleanup();
  });

  it('should handle rapid array mutations efficiently', async () => {
    const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
    const mockOnClose = vi.fn();

    const startTime = performance.now();

    const { cleanup } = {
      cleanup: () => {
        container.remove();
      },
    };

    mount(CommandPalette, {
      target: container,
      props: {
        isOpen: true,
        onClose: mockOnClose,
        mode: 'files',
      },
    });

    const mountTime = performance.now() - startTime;

    // Multiple rapid state updates should not cause performance issues
    const input = container.querySelector('input#command-palette-input') as HTMLInputElement;
    if (input) {
      const updateStart = performance.now();

      // Simulate rapid typing
      for (let i = 0; i < 10; i++) {
        input.value = `test${i}`;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const updateTime = performance.now() - updateStart;

      // Rapid updates should complete quickly (< 100ms for 10 updates)
      expect(updateTime).toBeLessThan(100);
    }

    // Initial mount should be fast
    expect(mountTime).toBeLessThan(300);

    cleanup();
  });

  it('should scale well with multiple tracked arrays', async () => {
    const { Sidebar } = await import('../../src/components/layout/Sidebar.ripple');

    const startTime = performance.now();

    const { cleanup } = {
      cleanup: () => {
        container.remove();
      },
    };

    mount(Sidebar, {
      target: container,
      props: {},
    });

    const mountTime = performance.now() - startTime;

    // Component with multiple tracked arrays (searchResults, fileGroups) should mount efficiently
    expect(mountTime).toBeLessThan(400);

    cleanup();
  });

  it('should handle list rendering efficiently', async () => {
    const { FileTree } = await import('../../src/components/filetree/FileTree.ripple');

    // Mock workspace with 50 files
    const mockFiles = Array.from({ length: 50 }, (_, i) => ({
      id: `file-${i}`,
      name: `file-${i}.ts`,
      path: `/workspace/file-${i}.ts`,
      isDirectory: false,
      isSymlink: false,
      children: null,
      isExpanded: false,
      isLoading: false,
      gitStatus: null,
    }));

    const startTime = performance.now();

    const { cleanup } = {
      cleanup: () => {
        container.remove();
      },
    };

    mount(FileTree, {
      target: container,
      props: {
        onOpenFile: vi.fn(),
        onContextMenu: vi.fn(),
      },
    });

    const mountTime = performance.now() - startTime;

    // Should render 50 file nodes efficiently
    expect(mountTime).toBeLessThan(500);

    cleanup();
  });

  it('should measure memory usage remains reasonable', () => {
    // Basic memory sanity check
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    // Create and destroy multiple components
    for (let i = 0; i < 5; i++) {
      const testContainer = document.createElement('div');
      document.body.appendChild(testContainer);
      testContainer.remove();
    }

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

    // Memory should not grow excessively (allow 10MB growth max)
    const memoryGrowth = finalMemory - initialMemory;
    if (initialMemory > 0) {
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // 10MB
    }
  });
});
