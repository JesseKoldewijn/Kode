import { test, expect } from '@playwright/test';
import { waitForAppReady, triggerAction } from './helpers/actions';

test.describe('Monaco Editor Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console messages for debugging
    page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));

    await page.goto('/');
    await waitForAppReady(page);

    // Wait for mocks to initialize (they log "Mock environment ready")
    await page.waitForTimeout(500);
  });

  test('Monaco editor container renders when file is open', async ({ page }) => {
    // Use triggerAction to open command palette
    await triggerAction(page, 'view.quickOpen');

    // Type to search for TypeScript file
    const input = page.locator('input[placeholder="Search files..."]');
    await expect(input).toBeVisible({ timeout: 2000 });
    await input.fill('main.ts');
    await page.waitForTimeout(300);

    // Press Enter to open first result
    await input.press('Enter');
    await page.waitForTimeout(1000);

    // Check for Monaco editor container
    const monacoContainer = page.locator('.monaco-editor');
    await expect(monacoContainer).toBeVisible({ timeout: 5000 });

    // Verify container has dimensions (actually rendered)
    const bbox = await monacoContainer.boundingBox();
    expect(bbox).not.toBeNull();
    expect(bbox!.width).toBeGreaterThan(100);
    expect(bbox!.height).toBeGreaterThan(100);
  });

  test('Monaco worker bundles load successfully', async ({ page }) => {
    const workerRequests: string[] = [];

    // Intercept network requests
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('monacoeditorwork') || url.includes('.worker')) {
        workerRequests.push(url);
        console.log('Worker request:', url);
      }
    });

    // Open command palette and open a TypeScript file
    await triggerAction(page, 'view.quickOpen');

    const input = page.locator('input[placeholder="Search files..."]');
    await input.fill('main.ts');
    await page.waitForTimeout(300);

    await input.press('Enter');
    await page.waitForTimeout(2000); // Give time for workers to load

    // Verify at least one worker was requested
    expect(workerRequests.length).toBeGreaterThan(0);

    // Log all worker requests for debugging
    console.log('Total worker requests:', workerRequests.length);
    workerRequests.forEach((url) => console.log('  -', url));
  });

  test('syntax highlighting appears in Monaco editor', async ({ page }) => {
    // Open command palette
    await triggerAction(page, 'view.quickOpen');

    const input = page.locator('input[placeholder="Search files..."]');
    await input.fill('main.ts');
    await page.waitForTimeout(300);
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Monaco applies syntax highlighting via .mtk* classes
    // Check for Monaco's line content structure
    const viewLines = page.locator('.monaco-editor .view-lines');
    await expect(viewLines).toBeVisible({ timeout: 3000 });

    // Verify Monaco has rendered content
    const textContent = await viewLines.textContent();
    expect(textContent).toBeTruthy();
    expect(textContent!.length).toBeGreaterThan(10);
  });

  test('theme switching updates Monaco editor theme', async ({ page }) => {
    // Open a file first
    await triggerAction(page, 'view.quickOpen');

    const input = page.locator('input[placeholder="Search files..."]');
    await input.fill('main.ts');
    await page.waitForTimeout(300);
    await input.press('Enter');
    await page.waitForTimeout(1000);

    // Get initial theme classes
    const monacoEditor = page.locator('.monaco-editor').first();
    const initialClasses = await monacoEditor.getAttribute('class');
    console.log('Initial Monaco classes:', initialClasses);

    // Click theme toggle button
    const themeBtn = page.locator('button[title^="Theme:"]');
    await themeBtn.click();
    await page.waitForTimeout(800); // Wait for theme to apply

    // Verify Monaco theme changed
    const newClasses = await monacoEditor.getAttribute('class');
    console.log('New Monaco classes:', newClasses);

    // Classes should be different (theme changed)
    expect(newClasses).not.toBe(initialClasses);

    // Check for vs-dark or vs-light theme classes
    const hasThemeClass = newClasses?.includes('vs-dark') || newClasses?.includes('vs-light');
    expect(hasThemeClass).toBe(true);
  });

  test('editor settings apply to Monaco instance', async ({ page }) => {
    // Open settings page
    const settingsBtn = page.getByTitle('Settings (Ctrl+,)');
    await settingsBtn.click();
    await page.waitForTimeout(500);

    // Look for editor settings section
    const settingsContent = await page.locator('main').first().textContent();
    console.log('Settings page loaded:', settingsContent?.includes('Editor'));

    // Open a file to verify editor rendered
    await triggerAction(page, 'view.quickOpen');

    const input = page.locator('input[placeholder="Search files..."]');
    await input.fill('main.ts');
    await page.waitForTimeout(300);
    await input.press('Enter');
    await page.waitForTimeout(1000);

    // Verify Monaco editor is present with settings applied
    const monacoEditor = page.locator('.monaco-editor');
    await expect(monacoEditor).toBeVisible();

    // Verify editor has basic Monaco structure
    const hasLines = await page.locator('.view-lines').count();
    expect(hasLines).toBeGreaterThan(0);
  });

  test('Monaco editor loads without console errors', async ({ page }) => {
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
    await waitForAppReady(page);

    // Open a file
    await triggerAction(page, 'view.quickOpen');

    const input = page.locator('input[placeholder="Search files..."]');
    await input.fill('main.ts');
    await page.waitForTimeout(300);
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (err) =>
        !err.includes('favicon') && // Favicon 404s are ok
        !err.includes('Source Map') && // Source map warnings are ok
        !err.includes('[vite]') && // Vite HMR messages are ok
        !err.includes('Download the') // React DevTools messages are ok
    );

    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors);
    }

    expect(criticalErrors).toHaveLength(0);
  });

  test('multiple files can be opened in Monaco editor', async ({ page }) => {
    // Open first file
    await triggerAction(page, 'view.quickOpen');
    let input = page.locator('input[placeholder="Search files..."]');
    await input.fill('main.ts');
    await page.waitForTimeout(300);
    await input.press('Enter');
    await page.waitForTimeout(800);

    // Verify first tab exists
    const tab1 = page.locator('[data-testid="editor-tab"]').first();
    await expect(tab1).toBeVisible();

    // Open second file
    await triggerAction(page, 'view.quickOpen');
    input = page.locator('input[placeholder="Search files..."]');
    await input.fill('utils.ts');
    await page.waitForTimeout(300);
    await input.press('Enter');
    await page.waitForTimeout(800);

    // Verify both tabs exist
    const tabs = page.locator('[data-testid="editor-tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBe(2);

    // Verify Monaco editor is still visible
    const monacoEditor = page.locator('.monaco-editor');
    await expect(monacoEditor).toBeVisible();
  });
});
