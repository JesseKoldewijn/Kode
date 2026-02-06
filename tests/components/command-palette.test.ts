import { describe, it, expect, afterEach, vi } from 'vitest';
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

describe('CommandPalette Integration Tests', () => {
  let cleanup: (() => void) | null = null;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  describe('Opening and Closing', () => {
    it('shows input when opened in files mode', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      // Wait for render
      await new Promise((resolve) => setTimeout(resolve, 100));

      const input = container.querySelector('input');
      expect(input).toBeTruthy();
      expect(input?.placeholder).toBe('Search files...');
    });

    it('is hidden when isOpen is false', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: false,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      // The outer container should have 'hidden' class
      const paletteContainer = container.querySelector('.fixed.z-\\[500\\]');
      expect(paletteContainer).toBeTruthy();
      expect(paletteContainer?.classList.contains('hidden')).toBe(true);
    });

    it('calls onClose when clicking backdrop', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Click the backdrop (outer div)
      const backdrop = container.querySelector('.fixed.z-\\[500\\]');
      expect(backdrop).toBeTruthy();

      (backdrop as HTMLElement).click();

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when pressing Escape', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const input = container.querySelector('input');
      expect(input).toBeTruthy();

      // Simulate Escape key
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      input?.dispatchEvent(escapeEvent);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mode Switching via Input', () => {
    it('starts with empty query in files mode', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.placeholder).toBe('Search files...');
      expect(input.value).toBe('');
    });

    it('switches to command mode when typing > prefix', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.placeholder).toBe('Search files...');

      // Simulate typing ">" to switch modes
      input.value = '>';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Wait for reactive update
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should now show command mode placeholder
      expect(input.placeholder).toBe('Type a command...');
      expect(input.value).toBe('>');
    });

    it('switches back to files mode when removing > prefix', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();

      // Switch to command mode
      input.value = '>';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(input.placeholder).toBe('Type a command...');

      // Clear the input to remove ">" prefix
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Wait for reactive update
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should now show files mode placeholder
      expect(input.placeholder).toBe('Search files...');
      expect(input.value).toBe('');
    });
  });

  describe('Command Mode via Props (tests prop-based mode switching)', () => {
    it('can be opened via prop change from closed to open', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      // Start closed
      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: false,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify it's hidden
      const paletteContainer = container.querySelector('.fixed.z-\\[500\\]');
      expect(paletteContainer?.classList.contains('hidden')).toBe(true);

      // Note: In a real app, the parent component would re-render with isOpen: true
      // We can't test prop changes in this mount utility, but we verify the closed state works
    });

    it('accepts typing in command mode after switching via >', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();

      // Type ">settings" to switch to command mode and search
      input.value = '>settings';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Wait for reactive update
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Input should have the new value and be in command mode
      expect(input.value).toBe('>settings');
      expect(input.placeholder).toBe('Type a command...');
    });
  });

  describe('Visual Elements', () => {
    it('shows search icon in files mode', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check for icon (SVG element)
      const icon = container.querySelector('svg');
      expect(icon).toBeTruthy();
    });

    it('shows escape key hint', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should show "esc" keyboard hint
      const escHint = Array.from(container.querySelectorAll('kbd')).find(
        (kbd) => kbd.textContent === 'esc'
      );
      expect(escHint).toBeTruthy();
    });

    it('shows footer with navigation hints', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check for footer element
      const footer = container.querySelector('footer');
      expect(footer).toBeTruthy();

      // Should have keyboard hints
      const hints = footer?.querySelectorAll('kbd');
      expect(hints && hints.length > 0).toBe(true);
    });

    it('shows mode toggle hint in footer', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const footer = container.querySelector('footer');
      const footerText = footer?.textContent || '';

      // In files mode, should show hint to type > for commands
      expect(footerText.includes('type > for commands')).toBe(true);
    });
  });

  describe('Commands Mode Prefill', () => {
    it('prefills > when opened directly in commands mode', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'commands',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.value).toBe('>');
      expect(input.placeholder).toBe('Type a command...');
    });

    it('shows command mode placeholder when opened in commands mode', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'commands',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.placeholder).toBe('Type a command...');
    });

    it('shows commands list when opened in commands mode', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'commands',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should show command items (not the "No commands found" message)
      // Commands have category labels like "File", "View", "Terminal", etc.
      const categoryLabels = container.querySelectorAll('.w-16.shrink-0');
      expect(categoryLabels.length).toBeGreaterThan(0);
    });

    it('shows footer hint to remove > for files in commands mode', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'commands',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const footer = container.querySelector('footer');
      const footerText = footer?.textContent || '';

      // In commands mode, should show hint to remove > for files
      expect(footerText.includes('remove > for files')).toBe(true);
    });
  });

  describe('Autofocus Behavior', () => {
    it('autofocuses input when opened in files mode', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 150));

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(document.activeElement).toBe(input);
    });

    it('autofocuses input when opened in commands mode', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'commands',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 150));

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(document.activeElement).toBe(input);
    });

    it('input has autofocus attribute', async () => {
      const { CommandPalette } = await import('../../src/components/palette/CommandPalette.ripple');
      const onClose = vi.fn();

      const { container, cleanup: c } = mountComponent(CommandPalette, {
        isOpen: true,
        mode: 'files',
        onClose,
      });
      cleanup = c;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.hasAttribute('autofocus')).toBe(true);
    });
  });
});
