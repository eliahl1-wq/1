import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { generateSurvivMap, SURVIV } from '../../phantom-game-server/surviv-engine.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
await mkdir('.local/surviv-architecture', { recursive: true });
try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1440 }, deviceScaleFactor: 1.5 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174');
    const result = await page.evaluate(async () => {
        const { SurvivRenderer } = await import('/src/game/surviv/SurvivRenderer.js');
        document.body.innerHTML = '<canvas id="gallery" width="1400" height="1440"></canvas>';
        document.body.style.margin = '0';
        const canvas = document.querySelector('canvas');
        const r = new SurvivRenderer(canvas); r.pause();
        const c = canvas.getContext('2d');
        c.fillStyle = '#253c32'; c.fillRect(0, 0, 1400, 1440);
        c.fillStyle = '#f0e6d0'; c.font = 'bold 24px sans-serif'; c.fillText('SURVIV / ROOFS & INTERIORS', 35, 38);
        const roofs = ['residence-clay', 'residence-slate', 'cabin', 'warehouse', 'brick', 'barn'];
        roofs.forEach((variant, i) => {
            const x = 245 + i % 3 * 450, y = 165 + Math.floor(i / 3) * 255;
            r.drawHouseRoof(c, { id: `roof-${i}`, variant, x, y, w: 310, h: 180 }, false);
            c.fillStyle = '#ddd9c9'; c.font = '16px sans-serif'; c.fillText(variant, x - 150, y + 117);
        });
        const props = ['bed','hospitalBed','bunkBed','sofa','armchair','entryBench','prisonBench','dresser','locker','wardrobe','medicalCabinet','workbench','desk','coffeeTable','nightstand','diningTable','kitchenCounter','labBench','bookshelf','storageShelf','toilet','bathtub','vanity','generator','housePlant'];
        props.forEach((variant, i) => {
            const x = 140 + i % 5 * 277, y = 640 + Math.floor(i / 5) * 153;
            c.fillStyle = '#526258'; c.fillRect(x - 119, y - 58, 238, 128);
            c.save(); c.translate(x, y - 4); c.scale(1.45, 1.45);
            r.drawObstacle(c, { id: `prop-${i}`, kind: 'furniture', variant, x: 0, y: 0, w: 82, h: 44 }, false);
            c.restore(); c.fillStyle = '#eee8d5'; c.font = '15px sans-serif'; c.fillText(variant, x - 100, y + 60);
        });
        for (const variant of props) r.drawObstacle(c, { id: `portrait-${variant}`, kind: 'furniture', variant, x: -300, y: -300, w: 32, h: 72 }, false);
        return { roofs: roofs.length, props: props.length };
    });
    await page.screenshot({ path: '.local/surviv-architecture/gallery.png' });
    const map = generateSurvivMap(SURVIV.worldHalf);
    const homes = map.obstacles.filter(o => o.role === 'countryHome' && o.kind === 'houseFloor');
    const ids = new Set(homes.map(o => o.id));
    const objects = map.obstacles.filter(o => ids.has(o.houseId) || ids.has(o.id));
    const loot = map.loot.filter(o => ids.has(o.houseId));
    await page.evaluate(async ({ homes, objects, loot }) => {
        const { SurvivRenderer } = await import('/src/game/surviv/SurvivRenderer.js');
        const canvas = document.querySelector('canvas'); canvas.width = 1400; canvas.height = 1440;
        const r = new SurvivRenderer(canvas); r.pause(); r.obstacles = objects;
        const c = canvas.getContext('2d'); c.fillStyle = '#41623b'; c.fillRect(0, 0, 1400, 1440);
        homes.forEach((home, i) => {
            const items = objects.filter(o => o.houseId === home.id);
            r._roomZonesByHouseId.set(home.id, items.filter(o => o.kind === 'roomZone'));
            for (const roof of [false, true]) {
                c.save(); c.translate(roof ? 1040 : 340, 235 + i * 470);
                c.scale(.60, .60); c.translate(-home.x, -home.y);
                r.drawObstacle(c, home, false);
                for (const o of items.filter(o => !['roomZone','road'].includes(o.kind))) r.drawObstacle(c, o, false);
                for (const item of loot.filter(o => o.houseId === home.id)) r.drawLoot(c, item);
                if (roof) r.drawHouseRoof(c, home, false);
                c.restore();
            }
            c.fillStyle = '#fff'; c.font = '20px sans-serif'; c.fillText(home.blueprint, 40, 35 + i * 470);
        });
    }, { homes, objects, loot });
    await page.screenshot({ path: '.local/surviv-architecture/country-homes.png' });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ...result, errors, passed: true }));
} finally { await browser.close(); }
