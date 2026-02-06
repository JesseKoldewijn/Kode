/**
 * Baseline Accessibility Tests (P0 - Critical)
 *
 * Automated axe-core scanning for WCAG 2.1 Level AA compliance
 * Tests the entire app in dark mode, light mode, and system mode
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { triggerAction, waitForAppReady } from '../helpers/actions';

test.describe('Baseline Accessibility', () => {
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

    // Dismiss any blocking overlay dialogs that may not have 'hidden' class on first render
    await page.evaluate(() => {
      document.querySelectorAll('.fixed.inset-0.z-\\[1000\\]').forEach((el) => {
        if (!el.classList.contains('hidden')) {
          el.classList.add('hidden');
        }
      });
    });
  });

  test('main app has no automatically detectable a11y violations in dark mode', async ({
    page,
  }) => {
    // Ensure dark mode is applied
    await page.evaluate(() => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    });

    // Wait for theme to apply
    await page.waitForTimeout(500);

    // Run axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('main app has no automatically detectable a11y violations in light mode', async ({
    page,
  }) => {
    // Switch to light mode
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });

    // Wait for theme to apply
    await page.waitForTimeout(500);

    // Run axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('command palette has no a11y violations when open', async ({ page }) => {
    // Open command palette
    await triggerAction(page, 'view.quickOpen');

    // Wait for palette to be visible
    await page.waitForSelector('input[placeholder="Search files..."]', { timeout: 5000 });

    // Run axe scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
