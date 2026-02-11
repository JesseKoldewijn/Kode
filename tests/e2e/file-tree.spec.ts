import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/actions';

test.describe('File Tree', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));

    await page.goto('/');
    await waitForAppReady(page);

    // Ensure we're on the Explorer tab
    const explorerBtn = page.getByTitle('Explorer (Ctrl+Shift+E)');
    await explorerBtn.click();
    await page.waitForTimeout(200);
  });

  test('renders file tree with root items', async ({ page }) => {
    // Verify root items are visible
    const srcFolder = page.getByTestId('filetree-node:/demo-project/src');
    const testsFolder = page.getByTestId('filetree-node:/demo-project/tests');
    const packageJson = page.getByTestId('filetree-node:/demo-project/package.json');

    await expect(srcFolder).toBeVisible();
    await expect(testsFolder).toBeVisible();
    await expect(packageJson).toBeVisible();
  });

  test('clicking a folder expands it and shows children', async ({ page }) => {
    // Click on src folder
    const srcFolder = page.getByTestId('filetree-node:/demo-project/src');
    await srcFolder.click();

    // Wait for expansion animation and child loading
    await page.waitForTimeout(500);

    // Verify src folder is expanded (arrow should rotate)
    const srcToggle = page.getByTestId('filetree-toggle:/demo-project/src');
    await expect(srcToggle).toHaveClass(/rotate-90/);

    // Verify children are visible (mock has main.ts, utils.ts, types.ts under src)
    const mainTs = page.getByTestId('filetree-node:/demo-project/src/main.ts');
    const utilsTs = page.getByTestId('filetree-node:/demo-project/src/utils.ts');
    const typesTs = page.getByTestId('filetree-node:/demo-project/src/types.ts');

    await expect(mainTs).toBeVisible();
    await expect(utilsTs).toBeVisible();
    await expect(typesTs).toBeVisible();
  });

  test('clicking an expanded folder collapses it', async ({ page }) => {
    // First expand src folder
    const srcFolder = page.getByTestId('filetree-node:/demo-project/src');
    await srcFolder.click();
    await page.waitForTimeout(500);

    // Verify it's expanded (mock has main.ts under src)
    const mainTs = page.getByTestId('filetree-node:/demo-project/src/main.ts');
    await expect(mainTs).toBeVisible();

    // Click again to collapse
    await srcFolder.click();
    await page.waitForTimeout(300);

    // Verify it's collapsed (arrow should not have rotate-90)
    const srcToggle = page.getByTestId('filetree-toggle:/demo-project/src');
    await expect(srcToggle).not.toHaveClass(/rotate-90/);

    // Children should be hidden
    await expect(mainTs).not.toBeVisible();
  });

  test('clicking a file selects it', async ({ page }) => {
    // Click on package.json file
    const packageJson = page.getByTestId('filetree-node:/demo-project/package.json');
    await packageJson.click();
    await page.waitForTimeout(300);

    // Verify file is selected (has bg-bg-active class)
    await expect(packageJson).toHaveClass(/bg-bg-active/);
  });

  test('nested folder expansion works', async ({ page }) => {
    // Expand src folder (mock has src with files + components + lib)
    const srcFolder = page.getByTestId('filetree-node:/demo-project/src');
    await srcFolder.click();
    await page.waitForTimeout(500);

    // Verify src is expanded
    const srcToggle = page.getByTestId('filetree-toggle:/demo-project/src');
    await expect(srcToggle).toHaveClass(/rotate-90/);

    // Verify src children are visible as separate rows
    const mainTs = page.getByTestId('filetree-node:/demo-project/src/main.ts');
    const utilsTs = page.getByTestId('filetree-node:/demo-project/src/utils.ts');
    const typesTs = page.getByTestId('filetree-node:/demo-project/src/types.ts');
    await expect(mainTs).toBeVisible();
    await expect(utilsTs).toBeVisible();
    await expect(typesTs).toBeVisible();
  });

  test('deep nesting: expand src then components then chat shows nested files', async ({ page }) => {
    await page.getByTestId('filetree-node:/demo-project/src').click();
    await page.waitForTimeout(500);

    const componentsFolder = page.getByTestId('filetree-node:/demo-project/src/components');
    await expect(componentsFolder).toBeVisible();
    await componentsFolder.click();
    await page.waitForTimeout(500);

    const componentsToggle = page.getByTestId('filetree-toggle:/demo-project/src/components');
    await expect(componentsToggle).toHaveClass(/rotate-90/);

    const chatFolder = page.getByTestId('filetree-node:/demo-project/src/components/chat');
    await expect(chatFolder).toBeVisible();
    await chatFolder.click();
    await page.waitForTimeout(500);

    const chatPanelFile = page.getByTestId(
      'filetree-node:/demo-project/src/components/chat/ChatPanel.ripple'
    );
    const chatInputFile = page.getByTestId(
      'filetree-node:/demo-project/src/components/chat/ChatInput.ripple'
    );
    await expect(chatPanelFile).toBeVisible();
    await expect(chatInputFile).toBeVisible();
  });

  test('collapsing parent folder hides all nested children', async ({ page }) => {
    await page.getByTestId('filetree-node:/demo-project/src').click();
    await page.waitForTimeout(500);
    await page.getByTestId('filetree-node:/demo-project/src/components').click();
    await page.waitForTimeout(500);
    await page.getByTestId('filetree-node:/demo-project/src/components/chat').click();
    await page.waitForTimeout(500);

    const chatPanelFile = page.getByTestId(
      'filetree-node:/demo-project/src/components/chat/ChatPanel.ripple'
    );
    await expect(chatPanelFile).toBeVisible();

    await page.getByTestId('filetree-node:/demo-project/src').click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId('filetree-node:/demo-project/src/components')).not.toBeVisible();
    await expect(chatPanelFile).not.toBeVisible();
  });

  test('collapsing parent folder hides all children', async ({ page }) => {
    // Expand src folder (mock has main.ts, utils.ts, types.ts under src)
    await page.getByTestId('filetree-node:/demo-project/src').click();
    await page.waitForTimeout(500);

    // Verify a child file is visible
    const mainTs = page.getByTestId('filetree-node:/demo-project/src/main.ts');
    await expect(mainTs).toBeVisible();

    // Collapse src folder
    await page.getByTestId('filetree-node:/demo-project/src').click();
    await page.waitForTimeout(300);

    // All children should be hidden
    await expect(mainTs).not.toBeVisible();
    await expect(page.getByTestId('filetree-node:/demo-project/src/utils.ts')).not.toBeVisible();
  });

  test('folder icons change between collapsed and expanded states', async ({ page }) => {
    const srcFolder = page.getByTestId('filetree-node:/demo-project/src');

    // Get folder icon SVG path (order: 0=spinner, 1=chevron, 2=folder)
    const folderIcon = srcFolder.locator('svg path').nth(2);

    // Collapsed folder should have closed folder path
    const collapsedPath = await folderIcon.getAttribute('d');
    expect(collapsedPath).toContain(
      'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'
    );

    // Expand folder
    await srcFolder.click();
    await page.waitForTimeout(500);

    // Expanded folder should have open folder path
    const expandedPath = await folderIcon.getAttribute('d');
    expect(expandedPath).toContain(
      'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z'
    );
  });
});
