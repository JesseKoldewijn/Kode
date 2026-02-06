import { describe, it, expect, afterEach } from 'vitest';
import { mount } from 'ripple';

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

describe('Component Mounting Tests', () => {
  let cleanup: (() => void) | null = null;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  describe('StatusBar', () => {
    it('mounts without errors', async () => {
      const { StatusBar } = await import('../../src/components/layout/StatusBar.ripple');
      const { container, cleanup: c } = mountComponent(StatusBar);
      cleanup = c;

      // Check that something rendered
      expect(container.innerHTML).not.toBe('');
      expect(container.querySelector('div')).toBeTruthy();
    });
  });

  describe('Panel', () => {
    it('mounts without errors', async () => {
      const { Panel } = await import('../../src/components/layout/Panel.ripple');
      const { container, cleanup: c } = mountComponent(Panel, {
        onClose: () => {},
      });
      cleanup = c;

      expect(container.innerHTML).not.toBe('');
    });

    it('can switch tabs without errors', async () => {
      const { Panel } = await import('../../src/components/layout/Panel.ripple');
      const { container, cleanup: c } = mountComponent(Panel, {
        onClose: () => {},
      });
      cleanup = c;

      // Find tab buttons in the nav element (not action buttons like close/new/clear)
      const nav = container.querySelector('nav');
      const tabButtons = nav ? nav.querySelectorAll('button') : [];
      expect(tabButtons.length).toBeGreaterThan(0);

      // Click each tab - this tests the CSS hidden pattern
      for (const button of tabButtons) {
        button.click();
        await new Promise((r) => setTimeout(r, 50));
      }

      // Should still have content
      expect(container.innerHTML).not.toBe('');
    });
  });

  describe('Sidebar', () => {
    it('mounts without errors', async () => {
      const { Sidebar } = await import('../../src/components/layout/Sidebar.ripple');
      const { container, cleanup: c } = mountComponent(Sidebar);
      cleanup = c;

      expect(container.innerHTML).not.toBe('');
    });

    it('can switch tabs without errors', async () => {
      const { Sidebar } = await import('../../src/components/layout/Sidebar.ripple');
      const { container, cleanup: c } = mountComponent(Sidebar);
      cleanup = c;

      const buttons = container.querySelectorAll('button');

      for (const button of buttons) {
        button.click();
        await new Promise((r) => setTimeout(r, 50));
      }

      expect(container.innerHTML).not.toBe('');
    });
  });

  describe('EditorArea', () => {
    it('mounts without errors', async () => {
      const { EditorArea } = await import('../../src/components/layout/EditorArea.ripple');
      const { container, cleanup: c } = mountComponent(EditorArea);
      cleanup = c;

      expect(container.innerHTML).not.toBe('');
    });
  });

  describe('ChatPanel', () => {
    it('mounts without errors', async () => {
      const { ChatPanel } = await import('../../src/components/chat/ChatPanel.ripple');
      const { container, cleanup: c } = mountComponent(ChatPanel);
      cleanup = c;

      expect(container.innerHTML).not.toBe('');
    });
  });

  describe('CommandPalette', () => {
    it('mounts without errors when closed', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: false,
        onClose: () => {},
      });
      cleanup = c;

      expect(container.innerHTML).not.toBe('');
    });

    it('mounts without errors when open', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        onClose: () => {},
      });
      cleanup = c;

      expect(container.innerHTML).not.toBe('');
    });
  });

  describe('Full App', () => {
    it('mounts without errors', async () => {
      const { App } = await import('../../src/App.ripple');
      const { container, cleanup: c } = mountComponent(App);
      cleanup = c;

      expect(container.innerHTML).not.toBe('');
      expect(container.querySelector('div')).toBeTruthy();
    });
  });

  describe('ContextMenu', () => {
    it('mounts without errors when closed', async () => {
      const { ContextMenu } = await import('../../src/components/filetree/ContextMenu.ripple');
      const { container, cleanup: c } = mountComponent(ContextMenu, {
        state: { isOpen: false, x: 0, y: 0, node: null },
        workspacePath: '/test',
        onAction: () => {},
        onClose: () => {},
      });
      cleanup = c;

      // When closed, the component should still mount (may render nothing visible)
      expect(container).toBeTruthy();
    });

    it('mounts without errors when open', async () => {
      const { ContextMenu } = await import('../../src/components/filetree/ContextMenu.ripple');
      const mockNode = {
        id: 'test-node',
        name: 'test.ts',
        path: '/test/test.ts',
        type: 'file' as const,
      };
      const { container, cleanup: c } = mountComponent(ContextMenu, {
        state: { isOpen: true, x: 100, y: 100, node: mockNode },
        workspacePath: '/test',
        onAction: () => {},
        onClose: () => {},
      });
      cleanup = c;

      expect(container.innerHTML).not.toBe('');
    });
  });

  describe('Breadcrumbs', () => {
    it('mounts without errors', async () => {
      const { Breadcrumbs } = await import('../../src/components/editor/Breadcrumbs.ripple');
      const { container, cleanup: c } = mountComponent(Breadcrumbs);
      cleanup = c;

      // Breadcrumbs may be hidden when no file is active, but should mount
      expect(container).toBeTruthy();
    });
  });

  describe('SourceControl', () => {
    it('mounts without errors', async () => {
      const { SourceControl } = await import('../../src/components/git/SourceControl.ripple');
      const { container, cleanup: c } = mountComponent(SourceControl);
      cleanup = c;

      expect(container).toBeTruthy();
    });
  });
});
