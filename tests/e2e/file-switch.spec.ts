import { test, expect } from '@playwright/test';
import { triggerAction, waitForAppReady, setCommandPaletteQuery } from './helpers/actions';

/**
 * E2E tests for file switching: open multiple files via quick open (mocked backend)
 * and assert the editor content updates when switching tabs.
 *
 * Run: `yarn test:e2e -- tests/e2e/file-switch.spec.ts` (Playwright starts the dev server).
 */
test.describe('File switching (mocked backend)', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await page.evaluate(() => {
      document.querySelectorAll('.fixed.inset-0.z-\\[1000\\]').forEach((el) => {
        if (!el.classList.contains('hidden')) {
          el.classList.add('hidden');
        }
      });
    });

    await page.locator('body').click();
    await page.waitForTimeout(100);
  });

  test('quick open opens palette', async ({ page }) => {
    await triggerAction(page, 'view.quickOpen', 1000);
    const palette = page.getByTestId('command-palette');
    await expect(palette).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#command-palette-input')).toBeVisible({ timeout: 3000 });
  });

  test('quick open file search returns main.ts', async ({ page }) => {
    await triggerAction(page, 'view.quickOpen', 1000);
    const palette = page.getByTestId('command-palette');
    await palette.waitFor({ state: 'visible', timeout: 5000 });
    await setCommandPaletteQuery(page, 'main');
    // Debounce is 150ms + async search; wait for result
    await page.waitForTimeout(600);
    await palette.getByText('main.ts').first().waitFor({ state: 'attached', timeout: 10000 });
    await expect(palette.getByText('main.ts').first()).toBeAttached();
  });

  test('editor shows first file content after opening via quick open', async ({ page }) => {
    await triggerAction(page, 'view.quickOpen', 800);
    const input = page.locator('#command-palette-input');
    await input.waitFor({ state: 'attached', timeout: 10000 });
    await setCommandPaletteQuery(page, 'main');
    const palette = page.getByTestId('command-palette');
    await palette.getByText('main.ts').first().waitFor({ state: 'attached', timeout: 10000 });
    await page.waitForTimeout(200);
    await palette.getByText('main.ts').first().click({ force: true });
    await page.waitForTimeout(800);

    const editorArea = page.getByTestId('editor-area');
    await expect(editorArea.getByText('Main entry point')).toBeVisible({ timeout: 10000 });
    await expect(editorArea.getByText('greet(user.name)')).toBeVisible();
  });

  test('editor content updates when switching to second file via quick open', async ({ page }) => {
    const palette = page.getByTestId('command-palette');
    await triggerAction(page, 'view.quickOpen', 800);
    await page.locator('#command-palette-input').waitFor({ state: 'attached', timeout: 10000 });
    await setCommandPaletteQuery(page, 'main');
    await palette.getByText('main.ts').first().waitFor({ state: 'attached', timeout: 10000 });
    await page.waitForTimeout(200);
    await palette.getByText('main.ts').first().click({ force: true });
    await page.waitForTimeout(800);

    await triggerAction(page, 'view.quickOpen', 800);
    await page.locator('#command-palette-input').waitFor({ state: 'attached', timeout: 10000 });
    await setCommandPaletteQuery(page, 'utils');
    await palette.getByText('utils.ts').first().waitFor({ state: 'attached', timeout: 10000 });
    await page.waitForTimeout(200);
    await palette.getByText('utils.ts').first().click({ force: true });
    await page.waitForTimeout(1500);

    const editorArea = page.getByTestId('editor-area');
    await expect(editorArea.getByText('Utility functions')).toBeVisible({ timeout: 15000 });
    await expect(editorArea.getByText('greet(name: string)')).toBeVisible();
  });

  test('editor content updates when switching tabs by clicking tab', async ({ page }) => {
    const palette = page.getByTestId('command-palette');
    await triggerAction(page, 'view.quickOpen', 800);
    await page.locator('#command-palette-input').waitFor({ state: 'attached', timeout: 10000 });
    await setCommandPaletteQuery(page, 'main');
    await palette.getByText('main.ts').first().waitFor({ state: 'attached', timeout: 10000 });
    await palette.getByText('main.ts').first().click({ force: true });
    await page.waitForTimeout(800);

    await triggerAction(page, 'view.quickOpen', 800);
    await setCommandPaletteQuery(page, 'utils');
    await palette.getByText('utils.ts').first().waitFor({ state: 'attached', timeout: 10000 });
    await palette.getByText('utils.ts').first().click({ force: true });
    await page.waitForTimeout(800);

    const editorArea = page.getByTestId('editor-area');
    await expect(editorArea.getByText('Utility functions')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('editor-tabs').getByRole('button', { name: 'main.ts' }).click();
    await page.waitForTimeout(500);

    await expect(editorArea.getByText('Main entry point')).toBeVisible({ timeout: 10000 });
    await expect(editorArea.getByText('greet(user.name)')).toBeVisible();
  });
});
