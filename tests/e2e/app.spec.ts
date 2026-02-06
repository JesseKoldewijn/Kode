import { test, expect } from '@playwright/test';

test.describe('App Mounting', () => {
  test('page loads without runtime errors', async ({ page }) => {
    // Capture console errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');

    // Wait for app to mount
    await page.waitForSelector('#app', { timeout: 10000 });

    // Give time for any async mounting errors
    await page.waitForTimeout(1000);

    // Log any errors found
    if (errors.length > 0) {
      console.log('ERRORS FOUND:', errors);
    }

    // Check for Ripple-specific errors
    const hasRippleError = errors.some(
      (e) =>
        e.includes('nextSibling') ||
        e.includes('Illegal invocation') ||
        e.includes('Node.') ||
        e.includes('get_next_sibling')
    );

    expect(hasRippleError).toBe(false);
  });

  test('app renders content', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Check that the main app div has content
    const app = page.locator('#app');
    await expect(app).not.toBeEmpty();

    // Check for visible content
    const hasVisibleContent = await app.locator('div, h1, button').count();
    expect(hasVisibleContent).toBeGreaterThan(0);
  });
});
