import { test, expect } from '@playwright/test';

test('debug app', async ({ page }) => {
  const errors: string[] = [];
  const consoleMessages: string[] = [];

  page.on('pageerror', (error) => {
    errors.push(`PAGE ERROR: ${error.message}\nStack: ${error.stack}`);
  });

  page.on('console', (msg) => {
    consoleMessages.push(`CONSOLE [${msg.type()}]: ${msg.text()}`);
  });

  await page.goto('/');

  // Wait a bit for errors to appear
  await page.waitForTimeout(3000);

  // Get the app div content
  const appContent = await page.evaluate(() => {
    const app = document.getElementById('app');
    return {
      innerHTML: app?.innerHTML || 'NO APP ELEMENT',
      visible: (app?.offsetHeight || 0) > 0,
    };
  });

  console.log('\n=== DEBUG OUTPUT ===');
  console.log('App innerHTML:', appContent.innerHTML);
  console.log('App visible:', appContent.visible);
  console.log('\nErrors:', JSON.stringify(errors, null, 2));
  console.log('\nConsole Messages:', JSON.stringify(consoleMessages, null, 2));

  // Assert no page errors occurred during load
  expect(errors, 'Expected no page errors during app load').toHaveLength(0);

  // Assert the app element is visible
  expect(appContent.visible, 'Expected app element to be visible').toBe(true);
});
