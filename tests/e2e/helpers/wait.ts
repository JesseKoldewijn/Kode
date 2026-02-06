import { Page, Locator } from '@playwright/test';

/**
 * Wait for element with automatic retry and better error messages
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options: { timeout?: number; state?: 'visible' | 'attached' } = {}
): Promise<Locator> {
  const timeout = options.timeout || 10000;
  const state = options.state || 'visible';

  try {
    const locator = page.locator(selector);
    await locator.waitFor({ timeout, state });
    return locator;
  } catch (error) {
    // Enhanced error message with page state
    const pageTitle = await page.title();
    const bodyText = await page.locator('body').textContent();
    const hasErrorOverlay = (await page.locator('vite-error-overlay').count()) > 0;

    throw new Error(
      `Failed to find element: ${selector}\n` +
        `Page title: ${pageTitle}\n` +
        `Has Vite error overlay: ${hasErrorOverlay}\n` +
        `Body preview: ${bodyText?.substring(0, 200)}...\n` +
        `Original error: ${error}`
    );
  }
}

/**
 * Wait for dialog to open with verification
 */
export async function waitForDialog(
  page: Page,
  dialogSelector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 5000;

  // Wait for overlay
  await page.locator('.fixed.inset-0.z-\\[1000\\]').waitFor({
    timeout,
    state: 'visible',
  });

  // Wait for dialog content
  await page.locator(dialogSelector).waitFor({
    timeout,
    state: 'visible',
  });

  // Wait for dialog animation
  await page.waitForTimeout(200);
}
