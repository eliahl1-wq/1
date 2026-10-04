import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
await mkdir('.local/surviv-architecture', { recursive: true });
try {
    const page = await browser.newPage({ viewport: { width: 1380, height: 1280 }, deviceScaleFactor: 1.5 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.SURVIV_PREVIEW_URL || 'http://127.0.0.1:5174');
    const result = await page.evaluate(async () => {
        const { SurvivRenderer } = await import('/src/game/surviv/SurvivRenderer.js');
        const cases = [
            ['kitchenCounter', 118, 34], ['labBench', 112, 34], ['bookshelf', 96, 30],
            ['displayShelf', 94, 32], ['storageShelf', 108, 36], ['controlConsole', 120, 40],
            ['machine', 90, 56], ['industrial', 84, 48], ['generator', 64, 48],
            ['serverRack', 82, 38], ['bathtub', 82, 38], ['vanity', 48, 30],
        ];
        document.body.innerHTML = '<canvas width="1380" height="1280"></canvas>';
        document.body.style.margin = '0';
        const canvas = document.querySelector('canvas'), c = canvas.getContext('2d');
        const r = new SurvivRenderer(canvas); r.pause();
        // Gallery pixels do not use the game's adaptive world-canvas scale.
        // Reset the backing store explicitly after renderer initialization.
        const dpr = window.devicePixelRatio;
        canvas.width = Math.round(1380 * dpr); canvas.height = Math.round(1280 * dpr);
        canvas.style.width = '1380px'; canvas.style.height = '1280px';
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.fillStyle = '#233c34'; c.fillRect(0, 0, 1380, 1280);
        c.fillStyle = '#e4e5cf'; c.font = 'bold 24px sans-serif'; c.fillText('SURVIV / CRAFTED FIXTURES', 28, 40);
        c.font = '16px sans-serif'; c.fillText('Actual renderer: landscape · portrait · damaged. Artwork stays inside the authoritative footprint.', 28, 67);
        for (let i = 0; i < cases.length; i++) {
            const [variant, w, h] = cases[i], tx = 20 + i % 3 * 450, ty = 90 + Math.floor(i / 3) * 295;
            c.fillStyle = '#61766b'; c.fillRect(tx, ty, 428, 275);
            c.fillStyle = '#e9e8d5'; c.font = 'bold 17px sans-serif'; c.fillText(variant, tx + 16, ty + 26);
            const states = [
                { x: tx + 119, y: ty + 94, w, h, hp: 48 },
                { x: tx + 330, y: ty + 150, w: h, h: w, hp: 48 },
                { x: tx + 119, y: ty + 215, w, h, hp: 12 },
            ];
            for (let j = 0; j < states.length; j++) {
                const o = { ...states[j], id: `fixture-${i}-${j}`, kind: 'furniture', variant, maxHp: 48 };
                c.save(); c.translate(o.x, o.y); c.scale(1.55, 1.55);
                c.translate(-o.x, -o.y); r.drawObstacle(c, o, false); c.restore();
            }
        }
        return { variants: cases.length, poses: cases.length * 3 };
    });
    await page.screenshot({ path: '.local/surviv-architecture/crafted-fixtures.png' });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ...result, errors, passed: true }));
} finally { await browser.close(); }
