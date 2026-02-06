/**
 * Color Contrast Accessibility Tests (P0)
 *
 * Validates WCAG 2.1 Level AA color contrast requirements:
 * - Normal text: 4.5:1 minimum
 * - Large text (18pt+): 3:1 minimum
 * - UI components: 3:1 minimum
 *
 * These tests check critical UI elements in both light and dark modes.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { waitForAppReady } from '../helpers/actions';

test.describe('Color Contrast Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Log browser console for debugging
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        console.log(`BROWSER [${type}]: ${msg.text()}`);
      }
    });

    await page.goto('/');
    await waitForAppReady(page);

    // Dismiss any blocking overlay dialogs
    await page.evaluate(() => {
      document.querySelectorAll('.fixed.inset-0.z-\\[1000\\]').forEach((el) => {
        if (!el.classList.contains('hidden')) {
          el.classList.add('hidden');
        }
      });
    });
  });

  test('dark mode: status bar text has sufficient contrast', async ({ page }) => {
    // Ensure dark mode is active
    const themeBtn = page.locator('button[title^="Theme:"]');
    const title = await themeBtn.getAttribute('title');
    if (!title?.includes('dark')) {
      await themeBtn.click();
      await page.waitForTimeout(300);
    }

    // Check status bar contrast - scan entire page
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('light mode: status bar text has sufficient contrast', async ({ page }) => {
    // Switch to light mode
    const themeBtn = page.locator('button[title^="Theme:"]');

    // Cycle through themes until we get light mode
    let attempts = 0;
    while (attempts < 3) {
      const currentTitle = await themeBtn.getAttribute('title');
      if (currentTitle?.includes('light')) break;
      await themeBtn.click();
      await page.waitForTimeout(300);
      attempts++;
    }

    // Check status bar contrast in light mode - scan entire page
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('sidebar: activity bar icons have sufficient contrast', async ({ page }) => {
    // Check sidebar activity bar - scan entire page
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('editor tabs: text and close buttons have sufficient contrast', async ({ page }) => {
    // Open a file first (simulate user action)
    const fileNode = page.locator('[data-file-path]').first();
    if ((await fileNode.count()) > 0) {
      await fileNode.dblclick();
      await page.waitForTimeout(500);
    }

    // Check editor tabs area - use a more general selector
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('file tree: file and folder names have sufficient contrast', async ({ page }) => {
    // Check file tree contrast
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .include('[class*="flex-1 overflow-auto"]')
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('buttons and interactive elements have sufficient contrast', async ({ page }) => {
    // Check all buttons on the page
    const buttons = page.locator('button');
    const count = await buttons.count();

    expect(count).toBeGreaterThan(0);

    // Run contrast check on all buttons
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    expect(results.violations).toEqual([]);
  });
});
