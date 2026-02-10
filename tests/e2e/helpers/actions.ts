import { Page } from '@playwright/test';

/**
 * Triggers an action via the app's __test-action custom event system.
 * This bypasses Chromium's interception of shortcuts like Ctrl+P, Ctrl+B.
 *
 * @param page - Playwright page instance
 * @param actionId - Action ID (e.g., 'view.quickOpen', 'view.settings')
 * @param waitMs - Time to wait for reactive updates (default: 500ms)
 */
export async function triggerAction(
  page: Page,
  actionId: string,
  waitMs: number = 500
): Promise<void> {
  await page.evaluate((id) => {
    window.dispatchEvent(new CustomEvent('__test-action', { detail: id }));

    // Force synchronous Ripple updates if available
    if (typeof (window as any).flushSync === 'function') {
      (window as any).flushSync();
    }
  }, actionId);

  // Wait for Ripple's reactive DOM updates and microtask queue
  await page.waitForTimeout(waitMs);
}

/**
 * Sends a keyboard shortcut via dispatchEvent.
 * Use triggerAction() for intercepted shortcuts (Ctrl+P, Ctrl+B, etc.)
 */
export async function sendShortcut(
  page: Page,
  key: string,
  opts: { ctrl?: boolean; shift?: boolean } = {}
): Promise<void> {
  await page.evaluate(() => document.body.focus());

  await page.evaluate(
    ({ key, opts }) => {
      const event = new KeyboardEvent('keydown', {
        key: key,
        code: `Key${key.toUpperCase()}`,
        ctrlKey: opts.ctrl,
        shiftKey: opts.shift,
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      window.dispatchEvent(event);
    },
    { key, opts }
  );

  await page.waitForTimeout(300);
}

/**
 * Wait for app to be fully loaded and initialized (main content + workspace in mock mode).
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('#app', { timeout: 15000, state: 'attached' });
  await page.getByText('No file is open').waitFor({ state: 'visible', timeout: 10000 });
  // In mock mode, workspace path is set async by FileTree; wait for sidebar so quick open search can use root
  await page.getByText('EXPLORER').first().waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(1500);
}

/**
 * Set the command palette search input value and trigger Ripple reactivity.
 * Waits for palette visible, then sets input value and dispatches input event so the effect runs.
 */
export async function setCommandPaletteQuery(page: Page, query: string): Promise<void> {
  const palette = page.getByTestId('command-palette');
  await palette.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#command-palette-input').evaluate(
    (el: HTMLInputElement, value: string) => {
      (el as HTMLInputElement).value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    query
  );
  await page.waitForTimeout(300);
}
