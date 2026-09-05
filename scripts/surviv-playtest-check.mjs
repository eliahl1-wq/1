// Optional browser smoke test: provide PLAYWRIGHT_MODULE and CHROME_EXECUTABLE
// when Playwright/Chromium aren't installed in the project's development tools.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const directory = resolve('.local/surviv-playtest');
await mkdir(directory, { recursive: true });
const errors = [];
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/surviv-playtest.html');
    await page.locator('#status').filter({ hasText: 'simulation' }).waitFor();
    await page.screenshot({ path: resolve(directory, 'fuel-depot.png') });
    await page.getByRole('button', { name: 'Test explosion' }).click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('4 explosion events'));
    assert.match(await page.locator('#status').innerText(), /3 objects/);
    await page.waitForTimeout(130);
    await page.screenshot({ path: resolve(directory, 'fuel-chain.png') });
    await page.getByRole('button', { name: 'Supply drop' }).click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: resolve(directory, 'supply-descent.png') });
    await page.waitForTimeout(8500);
    await page.screenshot({ path: resolve(directory, 'supply-landed.png') });
    await page.getByRole('button', { name: 'Glasshouse' }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: resolve(directory, 'glasshouse.png') });
    await page.keyboard.down('d');
    await page.waitForTimeout(600);
    await page.keyboard.up('d');
    await page.getByRole('button', { name: 'Fuel depot' }).click();
    const mobile = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto('http://127.0.0.1:5173/surviv-playtest.html');
    await mobile.locator('#status').filter({ hasText: 'simulation' }).waitFor();
    await mobile.screenshot({ path: resolve(directory, 'mobile-world.png') });
    assert.deepEqual(errors, [], 'browser runtime errors');
    console.log(JSON.stringify({ passed: true, errors, screenshots: directory }, null, 2));
} finally {
    await browser.close();
}
