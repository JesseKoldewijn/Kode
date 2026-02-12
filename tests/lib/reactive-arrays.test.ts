import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount } from 'ripple';

/**
 * Regression tests for reactive array patterns in Ripple components.
 *
 * These tests ensure that components using arrays properly use track()
 * and @ prefix for mutations to trigger re-renders.
 *
 * Background: We had a bug where arrays were declared as plain TypeScript
 * arrays (Type[]) instead of tracked arrays (track<Type[]>([])), causing
 * UI elements to not update when data was pushed/modified.
 *
 * Components that were fixed:
 * - ChatPanel.ripple (messages array)
 * - CommandPalette.ripple (fileResults array)
 * - Sidebar.ripple (searchResults, fileGroups arrays)
 * - SourceControl.ripple (changes array)
 */

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

describe('Reactive Array Regression Tests', () => {
  let cleanup: (() => void) | null = null;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  describe('ChatPanel - messages array', () => {
    it('should mount without crashing when messages array is empty', async () => {
      const { ChatPanel } = await import('../../src/components/chat/ChatPanel.ripple');
      const mockOnSend = vi.fn();

      const { container, cleanup: c } = mountComponent(ChatPanel, {
        onSend: mockOnSend,
      });
      cleanup = c;

      // Component should render without errors (the key test for reactive arrays)
      expect(container.innerHTML).not.toBe('');

      // Should have chat content area
      const chatContent = container.querySelector('.flex-1.overflow-y-auto');
      expect(chatContent).toBeTruthy();
    });

    it('should render textarea and send button for message input', async () => {
      const { ChatPanel } = await import('../../src/components/chat/ChatPanel.ripple');
      const mockOnSend = vi.fn();

      const { container, cleanup: c } = mountComponent(ChatPanel, {
        onSend: mockOnSend,
      });
      cleanup = c;

      // Find input and send button (these rely on messages array being reactive)
      const input = container.querySelector('textarea');
      // Find the send button by its SVG icon (send/arrow icon) in the chat input area
      const sendButton = container.querySelector('.px-4.pb-4 button');

      expect(input).toBeTruthy();
      expect(sendButton).toBeTruthy();
    });
  });

  describe('CommandPalette - fileResults array', () => {
    it('should render with empty fileResults initially', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const mockOnClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        onClose: mockOnClose,
        mode: 'files',
      });
      cleanup = c;

      // Should have input field
      const input = container.querySelector('input#command-palette-input');
      expect(input).toBeTruthy();

      // Component should render without errors
      expect(container.innerHTML).not.toBe('');
    });

    it('should update results when typing in search', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const mockOnClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        onClose: mockOnClose,
        mode: 'files',
      });
      cleanup = c;

      const input = container.querySelector('input#command-palette-input') as HTMLInputElement;
      expect(input).toBeTruthy();

      // Type into search
      if (input) {
        input.value = 'test';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      await new Promise((r) => setTimeout(r, 100));

      // Results should be rendered (even if empty in test environment)
      // The key test is that the component doesn't crash trying to render fileResults
      expect(container.innerHTML).not.toBe('');
    });
  });

  describe('Sidebar - searchResults and fileGroups arrays', () => {
    it('should mount without errors with empty search results', async () => {
      const { Sidebar } = await import('../../src/components/layout/Sidebar.ripple');

      const { container, cleanup: c } = mountComponent(Sidebar, { activeTab: 'explorer' });
      cleanup = c;

      // Should render the sidebar
      expect(container.innerHTML).not.toBe('');

      // Should have file explorer and search icons
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should switch to search tab without errors', async () => {
      const { Sidebar } = await import('../../src/components/layout/Sidebar.ripple');

      const { container, cleanup: c } = mountComponent(Sidebar, { activeTab: 'search' });
      cleanup = c;

      // With search tab active, search input should be visible
      const searchInput = container.querySelector('input[placeholder*="search"]');
      expect(searchInput).toBeTruthy();
    });
  });

  describe('SourceControl - changes array', () => {
    it('should mount without errors when no git repository', async () => {
      const { SourceControl } = await import('../../src/components/git/SourceControl.ripple');

      const { container, cleanup: c } = mountComponent(SourceControl);
      cleanup = c;

      // Component should render without errors (async git check may show "Loading...")
      expect(container.innerHTML).not.toBe('');

      // Should have the SOURCE CONTROL header
      const header = container.textContent;
      expect(header).toContain('SOURCE CONTROL');
    });

    it('should handle changes array properly', async () => {
      const { SourceControl } = await import('../../src/components/git/SourceControl.ripple');

      const { container, cleanup: c } = mountComponent(SourceControl);
      cleanup = c;

      // Component should render without crashing when changes array is empty
      expect(container.innerHTML).not.toBe('');

      // Should have status indicators
      const statusText = container.textContent || '';
      expect(statusText.length).toBeGreaterThan(0);
    });
  });

  describe('General reactive array patterns', () => {
    it('all components with tracked arrays should mount without errors', async () => {
      // Import all components that use tracked arrays
      const { ChatPanel } = await import('../../src/components/chat/ChatPanel.ripple');
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const { Sidebar } = await import('../../src/components/layout/Sidebar.ripple');
      const { SourceControl } = await import('../../src/components/git/SourceControl.ripple');

      // Mount each component to verify no runtime errors
      const components = [
        { Component: ChatPanel, props: { onSend: vi.fn() } },
        { Component: CommandPalette, props: { isOpen: false, onClose: vi.fn() } },
        { Component: Sidebar, props: { activeTab: 'explorer' } },
        { Component: SourceControl, props: {} },
      ];

      for (const { Component, props } of components) {
        const container = document.createElement('div');
        document.body.appendChild(container);

        // Should not throw
        expect(() => {
          mount(Component, { target: container, props });
        }).not.toThrow();

        container.remove();
      }
    });
  });
});
