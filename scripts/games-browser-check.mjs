// Real React + Socket.IO + authoritative BR engines. Simulated local funds only.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GAME_PLAYTEST_ORIGIN || 'http://127.0.0.1:5175';
const api = 'http://127.0.0.1:5057';
const fixture = () => fetch(`${api}/fixture`).then(response => response.json());
const waitFor = async predicate => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error('Fixture condition timed out');
};
const output = '.local/game-performance';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const errors = [], results = [];
try {
    const { token } = await fixture();
    for (const mode of ['agar', 'slither']) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
        });
        await context.addInitScript(({ token, mode }) => {
            localStorage.setItem('token', token);
            localStorage.setItem('selected_gamemode', `br-${mode}`);
            localStorage.setItem('current_game_mode', `br-${mode}`);
            localStorage.setItem('selected_entry_fee', '5');
            localStorage.removeItem('public_free_mode');
        }, { token, mode });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(`${mode}: ${error.message}`));
        await page.goto(`${origin}/br-lobby`);
        await page.getByText(new RegExp(`BATTLE ROYALE — ${mode.toUpperCase()}`)).waitFor();
        await fetch(`${api}/fixture/fill?variant=${mode}`, { method: 'POST' });
        await page.waitForURL(mode === 'agar' ? '**/game' : '**/slither-game', { timeout: 30000 });
        const canvas = page.locator('canvas.gameplay-cursor-surface');
        await canvas.waitFor();
        await waitFor(async () => (await fixture()).status === 'active');
        await page.waitForTimeout(1200);
        const before = await fixture();
        await page.mouse.move(1140, 450);
        await page.waitForTimeout(500);
        const after = await fixture();
        assert.ok(Math.hypot(after.player.x - before.player.x, after.player.y - before.player.y) > 1, `${mode} movement reaches authority`);

        const captures = await page.evaluate(async () => {
            const canvas = document.querySelector('canvas.gameplay-cursor-surface');
            const dimensions = [canvas.width, canvas.height];
            const stream = canvas.captureStream(30);
            const recorder = new MediaRecorder(stream, { videoBitsPerSecond: 1500000 });
            let chunks = 0;
            recorder.ondataavailable = event => { if (event.data.size) chunks++; };
            recorder.start(100);
            await new Promise(resolve => setTimeout(resolve, 1400));
            await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
            stream.getTracks().forEach(track => track.stop());
            return { dimensions, finalDimensions: [canvas.width, canvas.height], chunks };
        });
        assert.deepEqual(captures.dimensions, captures.finalDimensions, 'recording does not repeatedly resize/soften canvas');
        assert.ok(captures.chunks > 0, 'actual canvas recording produced frames');
        for (const viewport of [{ width: 1920, height: 1080 }, { width: 3840, height: 2160 }, { width: 844, height: 390 }]) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(300);
            const size = await canvas.evaluate(element => ({ width: element.width, height: element.height, cssWidth: element.getBoundingClientRect().width }));
            assert.ok(size.width > 0 && size.height > 0);
            assert.equal(Math.round(size.cssWidth), viewport.width, 'canvas fits the resized/fullscreen-sized viewport');
            if (mode === 'slither') assert.ok(size.width * size.height <= 2_810_000, '4K raster budget is honored');
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        if (mode === 'slither') {
            await page.mouse.move(1100, 450); await page.mouse.down();
            await waitFor(async () => (await fixture()).player.boost);
            await page.mouse.move(10, 10); await page.mouse.up();
            await waitFor(async () => !(await fixture()).player.boost);
            assert.equal((await fixture()).player.boost, false, 'boost release reaches the engine');
        }
        await page.screenshot({ path: `${output}/${mode}-desktop.png` });
        await page.reload();
        await canvas.waitFor();
        await page.waitForTimeout(700);
        assert.equal((await fixture()).status, 'active', 'reload rejoins the same active match');
        assert.ok((await fixture()).player, 'the rejoined player remains in the room');
        const finishing = await fetch(`${api}/fixture/finish`, { method: 'POST' });
        assert.ok(finishing.ok, 'only finish a live fixture player');
        await waitFor(async () => !(await fixture()).matchId);
        results.push({ mode, passed: true, recordingChunks: captures.chunks });
        await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ results, errors, output }));
} finally { await browser.close(); }
