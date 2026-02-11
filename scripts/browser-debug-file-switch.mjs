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
  const failedRequests = [];
  page.on('requestfailed', (req) => {
    const url = req.url();
    failedRequests.push({ url, failure: req.failure()?.errorText });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedRequests.push({ url: res.url(), status: res.status() });
    }
  });
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (
      text.includes('[EditorArea]') ||
      text.includes('[RustEditor]') ||
      text.includes('[Workspace]') ||
      text.includes('[App]')
    ) {
      console.log('BROWSER:', text);
    }
    if (msg.type() === 'error') console.log('BROWSER ERROR:', text);
  });

  console.log('Navigating to', BASE);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  if (failedRequests.length) {
    console.log('Failed/error responses after goto:', failedRequests);
  }
  await page.waitForSelector('#app', { state: 'attached', timeout: 10000 });
  try {
    await page.getByText('No file is open').waitFor({ state: 'visible', timeout: 12000 });
  } catch (e) {
    console.log('Failed/error responses so far:', failedRequests);
    const body = await page.evaluate(() => document.body?.innerText?.slice(0, 500)).catch(() => '');
    console.log('Body text (first 500 chars):', body);
    throw e;
  }
  await page.getByText('EXPLORER').first().waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(1500);

  // Enable debug flag
  await page.evaluate(() => {
    window.__DEBUG_EDITOR_AREA__ = true;
  });

  // Open Quick Open via app test hook (bypasses browser intercept of Ctrl+P)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('__test-action', { detail: 'view.quickOpen' }));
  });
  await page.waitForTimeout(800);

  const palette = page.getByTestId('command-palette');
  try {
    await palette.waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('#command-palette-input').waitFor({ state: 'attached', timeout: 5000 });
  } catch (e) {
    const html = await page.evaluate(() => document.body.innerHTML.slice(0, 3000));
    const overlayText = await page
      .evaluate(() => {
        const el = document.querySelector('vite-error-overlay');
        return el ? (el.shadowRoot?.innerHTML ?? el.innerHTML) : 'no overlay';
      })
      .catch(() => 'N/A');
    console.log('Palette not found. Body HTML (first 3000 chars):', html);
    console.log('Vite error overlay:', overlayText.slice(0, 1500));
    console.log('Console messages:', consoleLogs.slice(-30));
    throw e;
  }
  await page.locator('#command-palette-input').evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, 'main');
  await page.waitForTimeout(600);

  console.log('Selecting main.ts');
  await palette.getByText('main.ts').first().waitFor({ state: 'attached', timeout: 10000 });
  await page.waitForTimeout(200);
  await palette.getByText('main.ts').first().click({ force: true });
  await page.waitForTimeout(2500);

  const editorArea = page.getByTestId('editor-area');
  const editorAreaCount = await page.locator('[data-testid="editor-area"]').count();
  const allEditorAreaIds = await page
    .locator('[data-testid="editor-area"]')
    .evaluateAll((nodes) => nodes.map((el) => el.getAttribute('data-current-file-id')))
    .catch(() => []);
  console.log('editor-area count:', editorAreaCount, 'data-current-file-id on each:', allEditorAreaIds);
  const containerCount = await page.locator('[data-testid="editor-container"]').count();
  let containerVisible = false;
  let containerText = '';
  if (containerCount > 0) {
    const first = page.getByTestId('editor-container').first();
    containerVisible = await first.isVisible().catch(() => false);
    containerText = await first
      .evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return JSON.stringify({
          text: el.textContent?.slice(0, 300) ?? '',
          display: getComputedStyle(el).display,
          height: rect.height,
          width: rect.width,
          inDom: el.isConnected,
        });
      })
      .catch((e) => String(e));
  }
  const editorAreaRect = await page
    .getByTestId('editor-area')
    .evaluate((el) => el.getBoundingClientRect())
    .catch(() => null);
  const currentFileId = await page.getByTestId('editor-area').getAttribute('data-current-file-id').catch(() => null);
  const appActiveFileId = await page.locator('main[data-app-active-file-id]').getAttribute('data-app-active-file-id').catch(() => null);
  console.log('After opening main.ts - editor-container count:', containerCount);
  console.log('App data-app-active-file-id:', appActiveFileId);
  console.log('Editor-area data-current-file-id:', currentFileId);
  console.log('Editor container visible:', containerVisible, 'details:', containerText);
  console.log('Editor-area rect:', editorAreaRect ? { w: editorAreaRect.width, h: editorAreaRect.height } : null);

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
  await palette.getByText('utils.ts').first().waitFor({ state: 'attached', timeout: 10000 });
  await page.waitForTimeout(200);
  await palette.getByText('utils.ts').first().click({ force: true });
  await page.waitForTimeout(800);
  await page
    .getByTestId('editor-area')
    .waitFor({ state: 'visible' })
    .catch(() => {});
  await page
    .locator('[data-testid="editor-area"][data-current-file-id="/demo-project/src/utils.ts"]')
    .waitFor({ state: 'attached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(1200);

  const hasUtils = await editorArea
    .getByText('Utility functions')
    .isVisible()
    .catch(() => false);
  console.log('After opening utils.ts - "Utility functions" visible:', hasUtils);

  // Switch back via tab click (use tab test id to avoid matching close button)
  const mainTab = page.getByTestId('editor-tab:/demo-project/src/main.ts');
  await mainTab.click();
  await page.waitForTimeout(800);

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

  console.log('Recent console logs (Workspace/App/EditorArea/RustEditor):');
  consoleLogs
    .filter((l) =>
      l.includes('[Workspace]') ||
      l.includes('[App]') ||
      l.includes('[EditorArea]') ||
      l.includes('[RustEditor]')
    )
    .slice(-40)
    .forEach((l) => console.log(l));

  console.log('Keeping browser open 3s...');
  await page.waitForTimeout(3000);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
