/**
 * Debug script: open two files and dump editor DOM content.
 * Run: npx tsx scripts/debug-editor-content.ts
 * (Requires dev server on http://localhost:1420)
 */
import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://localhost:1420', { waitUntil: 'networkidle' });
  await page.waitForSelector('#app', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Open Quick Open and type "main"
  await page.keyboard.press('Control+p');
  await page.waitForSelector('#command-palette-input', { timeout: 5000 });
  await page.fill('#command-palette-input', 'main');
  await page.waitForTimeout(600);
  await page.getByTestId('command-palette').getByText('main.ts').first().click({ force: true });
  await page.waitForTimeout(1200);

  const afterFirst = await page.evaluate(() => {
    const area = document.querySelector('[data-testid="editor-area"]');
    const bufferId = document.querySelector('[data-editor-buffer-id]')?.getAttribute('data-editor-buffer-id');
    const lineContent = document.querySelector('.editor-line-content');
    return {
      bufferId,
      firstLineText: lineContent?.textContent?.slice(0, 80) ?? null,
      editorAreaText: area?.textContent?.slice(0, 200) ?? null,
    };
  });
  console.log('After opening main.ts:', JSON.stringify(afterFirst, null, 2));

  // Open second file via Quick Open
  await page.keyboard.press('Control+p');
  await page.waitForSelector('#command-palette-input', { timeout: 5000 });
  await page.fill('#command-palette-input', 'utils');
  await page.waitForTimeout(600);
  await page.getByTestId('command-palette').getByText('utils.ts').first().click({ force: true });
  await page.waitForTimeout(1500);

  const afterSecond = await page.evaluate(() => {
    const area = document.querySelector('[data-testid="editor-area"]');
    const bufferId = document.querySelector('[data-editor-buffer-id]')?.getAttribute('data-editor-buffer-id');
    const lines = Array.from(document.querySelectorAll('.editor-line-content')).map((el) => el.textContent?.slice(0, 60));
    const ws = (window as unknown as { __kodeWorkspace?: { activeFileId: () => string | null; openFileIds: () => string[] } }).__kodeWorkspace;
    return {
      bufferId,
      firstFewLines: lines.slice(0, 5),
      hasUtilityFunctions: area?.textContent?.includes('Utility functions') ?? false,
      workspaceActiveId: ws?.activeFileId() ?? null,
      workspaceOpenIds: ws?.openFileIds() ?? [],
    };
  });
  console.log('After opening utils.ts:', JSON.stringify(afterSecond, null, 2));

  await browser.close();
}

main().catch(console.error);
