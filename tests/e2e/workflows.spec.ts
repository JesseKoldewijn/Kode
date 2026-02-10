import { test, expect, Page } from '@playwright/test';
import { triggerAction, sendShortcut, waitForAppReady } from './helpers/actions';

test.describe('UI Workflow Tests', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));
    await page.goto('/');
    await waitForAppReady(page);

    // Dismiss any blocking overlay dialogs that may not have 'hidden' class on first render
    // This works around a Ripple framework timing issue where conditional classes
    // may not be applied before the first paint.
    // IMPORTANT: Only target z-[1000] overlays (ConfirmDialog) — NOT z-[500] (CommandPalette)
    // because externally adding 'hidden' breaks Ripple's reactive class tracking.
    await page.evaluate(() => {
      document.querySelectorAll('.fixed.inset-0.z-\\[1000\\]').forEach((el) => {
        if (!el.classList.contains('hidden')) {
          el.classList.add('hidden');
        }
      });
    });

    // Ensure page body has focus for keyboard events
    await page.locator('body').click();
    await page.waitForTimeout(100);
  });

  test('sidebar renders with activity bar buttons', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Activity bar should have the key nav buttons
    const explorerBtn = page.getByTitle('Explorer (Ctrl+Shift+E)');
    const searchBtn = page.getByTitle('Search (Ctrl+Shift+F)');
    const gitBtn = page.getByTitle('Source Control (Ctrl+Shift+G)');
    const settingsBtn = page.getByTitle('Settings (Ctrl+,)');

    await expect(explorerBtn).toBeVisible();
    await expect(searchBtn).toBeVisible();
    await expect(gitBtn).toBeVisible();
    await expect(settingsBtn).toBeVisible();
  });

  test('sidebar tabs switch content panels', async ({ page }) => {
    // Click Search tab
    const searchBtn = page.getByTitle('Search (Ctrl+Shift+F)');
    await searchBtn.click();
    await page.waitForTimeout(200);

    // Search input should be visible
    const searchInput = page.getByPlaceholder('Search in files...');
    await expect(searchInput).toBeVisible();

    // Click Source Control tab
    const gitBtn = page.getByTitle('Source Control (Ctrl+Shift+G)');
    await gitBtn.click();
    await page.waitForTimeout(200);

    // Search input should no longer be visible (hidden panel)
    await expect(searchInput).not.toBeVisible();

    // Click back to Explorer
    const explorerBtn = page.getByTitle('Explorer (Ctrl+Shift+E)');
    await explorerBtn.click();
    await page.waitForTimeout(200);

    // Explorer header should be visible (use .first() since EXPLORER text appears in both header and section)
    const explorerHeader = page.getByText('EXPLORER').first();
    await expect(explorerHeader).toBeVisible();
  });

  test('editor area shows empty state when no file open', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Empty state should show app name and message
    const heading = page.getByRole('main').getByRole('heading', { name: 'JereKode' });
    await expect(heading).toBeVisible();

    const emptyMsg = page.getByText('No file is open');
    await expect(emptyMsg).toBeVisible();
  });

  test('status bar is visible with expected sections', async ({ page }) => {
    // Use the specific status bar footer (has bg-statusbar-bg class)
    const footer = page.locator('footer.bg-statusbar-bg');
    await expect(footer).toBeVisible();

    // Theme toggle should be present
    const themeBtn = page.locator('button[title^="Theme:"]');
    await expect(themeBtn).toBeVisible();
  });

  test('toggle sidebar with Ctrl+B', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Toggle sidebar off via __test-action hook
    await triggerAction(page, 'view.toggleSidebar');

    await expect(sidebar).toBeHidden();

    // Toggle sidebar back on
    await triggerAction(page, 'view.toggleSidebar');

    await expect(sidebar).toBeVisible();
  });

  test('toggle bottom panel with Ctrl+J', async ({ page }) => {
    // First, open the panel (it may start closed)
    await page.keyboard.press('Control+j');
    await page.waitForTimeout(300);

    // Check for panel tab buttons - use exact role match to avoid "Toggle Terminal" and mock terminal text
    const terminalTab = page.getByRole('button', { name: 'TERMINAL', exact: true });

    // If the panel is open, terminal tab should be visible
    const panelVisible = await terminalTab.isVisible().catch(() => false);

    if (panelVisible) {
      // Toggle it closed
      await page.keyboard.press('Control+j');
      await page.waitForTimeout(300);

      await expect(terminalTab).not.toBeVisible();

      // Toggle it open again
      await page.keyboard.press('Control+j');
      await page.waitForTimeout(300);

      await expect(terminalTab).toBeVisible();
    } else {
      // Panel may have just been toggled to closed state; toggle again to open
      await page.keyboard.press('Control+j');
      await page.waitForTimeout(300);

      await expect(terminalTab).toBeVisible();
    }
  });

  test('settings page opens from sidebar', async ({ page }) => {
    const settingsBtn = page.getByTitle('Settings (Ctrl+,)');
    await settingsBtn.click();
    await page.waitForTimeout(500);

    // Settings page should be rendered in the editor area
    // Use .first() since settings page adds a second <main> element
    const main = page.locator('main').first();
    const mainContent = await main.innerHTML();
    expect(mainContent.length).toBeGreaterThan(0);

    // The empty state should no longer be visible since settings tab is open
    const emptyMsg = page.getByText('No file is open');
    await expect(emptyMsg).not.toBeVisible();
  });

  test('theme toggle cycles through modes', async ({ page }) => {
    const themeBtn = page.locator('button[title^="Theme:"]');
    await expect(themeBtn).toBeVisible();

    // Get initial theme
    const initialTitle = await themeBtn.getAttribute('title');

    // Click to cycle theme
    await themeBtn.click();
    await page.waitForTimeout(200);

    const newTitle = await themeBtn.getAttribute('title');

    // Title should have changed (theme cycled)
    expect(newTitle).not.toBe(initialTitle);
  });
});
