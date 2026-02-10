#!/usr/bin/env node
/**
 * Standalone script to debug file switching in the browser using Playwright.
 * Run with: node scripts/browser-debug-file-switch.mjs
 * Requires: dev server on http://localhost:1420 (yarn dev)
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:1420';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (
      text.includes('[EditorArea]') ||
      text.includes('[RustEditor]') ||
      text.includes('[Workspace]')
    ) {
      console.log('BROWSER:', text);
    }
    if (msg.type() === 'error') console.log('BROWSER ERROR:', text);
  });

  console.log('Navigating to', BASE);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('#app', { state: 'attached', timeout: 10000 });
  await page.waitForTimeout(2000);

  // Enable debug flag
  await page.evaluate(() => {
    window.__DEBUG_EDITOR_AREA__ = true;
  });

  // Open Quick Open via app test hook (bypasses browser intercept of Ctrl+P)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('__test-action', { detail: 'view.quickOpen' }));
  });
  await page.waitForTimeout(2000);

  const input = page.locator('#command-palette-input');
  try {
    await input.waitFor({ state: 'attached', timeout: 15000 });
  } catch (e) {
    const html = await page.evaluate(() => document.body.innerHTML.slice(0, 3000));
    const overlayText = await page
      .evaluate(() => {
        const el = document.querySelector('vite-error-overlay');
        return el ? (el.shadowRoot?.innerHTML ?? el.innerHTML) : 'no overlay';
      })
      .catch(() => 'N/A');
    console.log('Palette input not found. Body HTML (first 3000 chars):', html);
    console.log('Vite error overlay:', overlayText.slice(0, 1500));
    console.log('Console messages:', consoleLogs.slice(-30));
    throw e;
  }
  await input.evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, 'main');
  await page.waitForTimeout(800);

  console.log('Selecting main.ts');
  await page.getByText('main.ts').first().click();
  await page.waitForTimeout(800);

  const editorArea = page.getByTestId('editor-area');
  const hasMain = await editorArea
    .getByText('Main entry point')
    .isVisible()
    .catch(() => false);
  console.log('After opening main.ts - "Main entry point" visible:', hasMain);

  // Open second file
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('__test-action', { detail: 'view.quickOpen' }));
  });
  await page.waitForTimeout(600);
  await page.locator('#command-palette-input').evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, 'utils');
  await page.waitForTimeout(800);
  console.log('Selecting utils.ts');
  await page.getByText('utils.ts').first().click();
  await page.waitForTimeout(800);

  const hasUtils = await editorArea
    .getByText('Utility functions')
    .isVisible()
    .catch(() => false);
  console.log('After opening utils.ts - "Utility functions" visible:', hasUtils);

  // Switch back via tab click
  const mainTab = page.getByTestId('editor-tabs').getByRole('button', { name: 'main.ts' });
  await mainTab.click();
  await page.waitForTimeout(600);

  const hasMainAgain = await editorArea
    .getByText('Main entry point')
    .isVisible()
    .catch(() => false);
  console.log('After clicking main.ts tab - "Main entry point" visible:', hasMainAgain);

  console.log('\n--- Summary ---');
  console.log('First file (main.ts) content shown:', hasMain);
  console.log('Second file (utils.ts) content shown:', hasUtils);
  console.log('Tab switch back to main.ts content shown:', hasMainAgain);
  console.log('File switching OK:', hasMain && hasUtils && hasMainAgain);

  console.log('Keeping browser open 5s...');
  await page.waitForTimeout(5000);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
