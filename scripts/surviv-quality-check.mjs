// Real renderer QA; development-only simulation, no accounts or paid games.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_EXECUTABLE
    ? {executablePath:process.env.CHROME_EXECUTABLE} : {})});
try {
    const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1.5});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/surviv-playtest.html');
    await page.locator('#status').filter({hasText:'simulation'}).waitFor();
    const reserveBefore = await page.evaluate(() => {
        const me = window.__survivPlaytest.me;
        me.weapon.ammo = 7;
        me.inventory.ammoReserves['556'] = 60;
        return me.inventory.ammoReserves['556'];
    });
    await page.keyboard.press('r');
    await page.waitForFunction(() => window.__survivPlaytest.renderer.me.reloading);
    await page.keyboard.press('x');
    await page.waitForFunction(() => !window.__survivPlaytest.renderer.me.reloading);
    const canceledReload = await page.evaluate(() => ({
        reserve: window.__survivPlaytest.me.inventory.ammoReserves['556'],
        clip: window.__survivPlaytest.me.weapon.ammo,
        endAt: window.__survivPlaytest.renderer.me.reloadEndAtLocal,
    }));
    assert.deepEqual(canceledReload,{reserve:reserveBefore,clip:7,endAt:0});
    const results = [];
    for (const scene of ['intersection','glasshouse','casino','ironworks']) {
        results.push(await page.evaluate(async scene => {
            const game = window.__survivPlaytest;
            game.reset(scene);
            await new Promise(resolve => setTimeout(resolve, 1200));
            const r = game.renderer, source = r.sortedWorldObstacles;
            const house = r.getCurrentHouse(), room = r.getCurrentRoom(house);
            const old = [], indexed = [], oldTimes = [], indexedTimes = [];
            for (let i=0;i<400;i++) {
                r.setViewBounds(r.camera.x + (i%20), r.camera.y, r.viewW, r.viewH, r.zoom);
                const begin = performance.now();
                old.length=0;
                for (const o of source) if (r.isObstacleInView(o,48) && r.shouldDrawObstacle(o,house,room)) old.push(o);
                const middle = performance.now();
                r.collectVisibleObstacles(source,indexed,48,house,room);
                const end = performance.now();
                if (i>=40) { oldTimes.push(middle-begin); indexedTimes.push(end-middle); }
                if (old.length!==indexed.length || old.some((o,j)=>o!==indexed[j])) throw new Error('Render membership/order changed');
            }
            // Rotate the local character without waiting for a server snapshot.
            r.clearInput();
            const rect = r.canvas.getBoundingClientRect();
            r.handlePointerMove(rect.left+r.viewW/2+210,rect.top+r.viewH/2-150);
            const expected = r.getInputPayload().aimAngle;
            const serverAngle = r._interpMe.targetAngle;
            r.draw(1/144);
            const aimError = Math.abs(Math.atan2(Math.sin(r.me.angle-expected),Math.cos(r.me.angle-expected)));
            if (aimError>1e-8) throw new Error('Local aim still follows delayed server angle');
            const mean = a => Number((a.reduce((s,v)=>s+v,0)/a.length).toFixed(5));
            return {scene,sourceObjects:source.length,visibleObjects:indexed.length,
                oldCullMeanMs:mean(oldTimes),indexedCullMeanMs:mean(indexedTimes),aimError,serverAngle};
        },scene));
    }
    assert.deepEqual(errors,[]);
    await mkdir('.local/surviv-quality',{recursive:true});
    await writeFile('.local/surviv-quality/check.json',JSON.stringify({canceledReload,results,errors},null,2));
    await page.screenshot({path:'.local/surviv-quality/ironworks.png'});
    console.log(JSON.stringify({canceledReload,results,errors}));
} finally {await browser.close();}
