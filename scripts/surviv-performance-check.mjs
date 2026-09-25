// Local renderer/snapshot timings, not a claim about a production player's FPS.
// Run Vite on 5174; optionally provide PLAYWRIGHT_MODULE / CHROME_EXECUTABLE.
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE
    ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const label = (process.argv[2] || 'current').replace(/[^a-z0-9_-]/gi, '');
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/surviv-playtest.html');
    await page.locator('#status').filter({ hasText: 'simulation' }).waitFor();
    const results = [];
    for (const scene of ['intersection', 'glasshouse', 'casino', 'ironworks']) {
        results.push(await page.evaluate(async scene => {
            const game = window.__survivPlaytest;
            // Identical generated layout on baseline/recheck.
            const originalRandom = Math.random;
            let seed = 314159;
            Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
            try { game.reset(scene); } finally { Math.random = originalRandom; }
            const r = game.renderer;
            const draw = r.draw, updateState = r.updateState;
            const drawMs = [], snapshotMs = [], intervals = [];
            let measuring = false, lastFrame = 0;
            r.draw = function (...args) {
                const before = performance.now();
                const result = draw.apply(this, args);
                if (measuring) {
                    drawMs.push(performance.now() - before);
                    if (lastFrame) intervals.push(before - lastFrame);
                    lastFrame = before;
                }
                return result;
            };
            r.updateState = function (...args) {
                const before = performance.now();
                const result = updateState.apply(this, args);
                if (measuring) snapshotMs.push(performance.now() - before);
                return result;
            };
            await new Promise(resolve => setTimeout(resolve, 1800));
            const house = r.getCurrentHouse();
            let visibility = null;
            if (house && r._losRayIndexesByHouseId.get(house.id)) {
                const segments = r._gatherWallSegments(0, 0, 1440, 900, 1, house, r.me.x, r.me.y, 900);
                const vertices = r._losVerticesByHouseId.get(house.id);
                const index = r._losRayIndexesByHouseId.get(house.id);
                const times = { brute: [], indexed: [] };
                let maxError = 0;
                // Interleave old/new searches on the same actual building and
                // moving viewpoint. Ray count and output points are identical.
                for (let i = 0; i < 80; i++) {
                    const x = r.me.x + i * .02, y = r.me.y + i * .01;
                    const begin = performance.now();
                    const old = r._buildVisibilityPolygon(x, y, segments, vertices, 900, null);
                    const beforeCopy = performance.now();
                    const expected = old.map(p => ({ ...p }));
                    const indexedStart = performance.now();
                    const actual = r._buildVisibilityPolygon(x, y, segments, vertices, 900, index);
                    const end = performance.now();
                    if (i >= 10) { times.brute.push(beforeCopy - begin); times.indexed.push(end - indexedStart); }
                    if (actual.length !== expected.length) throw new Error('Visibility ray count changed');
                    for (let j = 0; j < actual.length; j++) maxError = Math.max(maxError,
                        Math.hypot(actual[j].x - expected[j].x, actual[j].y - expected[j].y));
                }
                const average = values => Number((values.reduce((a,b) => a+b, 0) / values.length).toFixed(3));
                if (maxError > .000001) throw new Error(`Visibility changed by ${maxError}`);
                visibility = { house: house.variant, segments: segments.length,
                    oldMeanMs: average(times.brute), indexedMeanMs: average(times.indexed), maxError };
            }
            measuring = true;
            r.handleKeyDown({ key: 'd', code: 'KeyD', preventDefault() {} });
            await new Promise(resolve => setTimeout(resolve, 3000));
            r.clearInput();
            r.draw = draw; r.updateState = updateState;
            const stats = values => {
                values.sort((a,b) => a-b);
                const at = percentile => Number((values[Math.min(values.length - 1, Math.floor(values.length * percentile))] || 0).toFixed(3));
                return { count: values.length, median: at(.5), p95: at(.95), max: at(1) };
            };
            return { scene, visibility, drawMs: stats(drawMs), snapshotMs: stats(snapshotMs), frameIntervalMs: stats(intervals),
                obstacles: r.obstacles.length, mapObjects: game.room.obstacles.length, canvas: [r.canvas.width, r.canvas.height] };
        }, scene));
    }
    assert.deepEqual(errors, []);
    assert.ok(results.every(r => r.drawMs.count >= 20 && r.snapshotMs.count >= 20), 'enough actual gameplay samples');
    await mkdir('.local/surviv-performance', { recursive: true });
    await writeFile(`.local/surviv-performance/${label}.json`, JSON.stringify({ label, results, errors }, null, 2));
    await page.screenshot({ path: `.local/surviv-performance/${label}.png` });
    console.log(JSON.stringify({ label, results, errors }));
} finally { await browser.close(); }
