// Local visual regression check; every API response is a fixture.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GAME_PLAYTEST_ORIGIN || 'http://127.0.0.1:5178';
const phase = process.env.UI_CHECK_PHASE || 'after';
const output = '.local/ui-polish';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const errors = [], layouts = {}, interactions = [];
try {
    for (const [device, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
        const page = await browser.newPage({ viewport });
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
            localStorage.setItem('selected_gamemode', 'slither');
            localStorage.setItem('selected_entry_fee', '5');
        });
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.pathname === '/ready') return route.fulfill({ json: { ready: true, status: 'ready' } });
            if (url.pathname.startsWith('/api/')) {
                const data = /leaderboard|tournaments/.test(url.pathname) ? []
                    : url.pathname === '/api/stats' ? { solPrice: 100, playersByGamemode: {}, playersByModeAndFee: {} }
                    : { ready: true, status: 'ready', enabled: false, items: [], products: [] };
                return route.fulfill({ json: data });
            }
            return url.origin === origin ? route.continue() : route.abort();
        });
        for (const path of ['/pre-game', '/gamemodes', '/faq', '/login']) {
            await page.goto(`${origin}${path}`);
            await page.locator(path === '/login' ? '.auth-page' : '.topbar').waitFor();
            await page.waitForTimeout(400);
            const key = `${device}-${path.slice(1)}`;
            layouts[key] = await page.evaluate(() => {
                const result = {};
                for (const selector of ['.topbar', '.game-card.main-card', '.play-btn', '.gm-card', '.auth-card']) {
                    const el = document.querySelector(selector);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        result[selector] = { width: rect.width, height: rect.height };
                    }
                }
                return result;
            });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${key}: page overflow`);
            await page.screenshot({ path: `${output}/${phase}-${key}.png`, fullPage: true, animations: 'disabled' });
        }
        if (device === 'desktop') {
            const button = page.locator('button.btn-primary').first();
            const before = await button.boundingBox();
            await button.hover(); await page.waitForTimeout(250);
            const after = await button.boundingBox();
            assert.equal(before.width, after.width);
            assert.equal(before.height, after.height);
            await button.focus();
            interactions.push(await button.evaluate(el => ({ focus: getComputedStyle(el).outlineStyle,
                transition: getComputedStyle(el).transitionDuration })));
            assert.notEqual(interactions.at(-1).focus, 'none');
            await page.emulateMedia({ reducedMotion: 'reduce' });
            assert.ok(await button.evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) < .01));
        }
        await page.close();
    }
    if (phase === 'before') await writeFile(`${output}/baseline.json`, JSON.stringify(layouts));
    else {
        const before = JSON.parse(await readFile(`${output}/baseline.json`, 'utf8'));
        assert.deepEqual(layouts, before, 'existing header/button/card dimensions are preserved');
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, phase, pages: 4, viewports: 2, unchangedDimensions: phase === 'after', interactions, output }));
} finally { await browser.close(); }
