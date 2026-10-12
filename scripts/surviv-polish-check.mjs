// Actual engine + renderer QA. Local simulation only: no accounts or money.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
await mkdir('.local/surviv-polish', { recursive: true });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/surviv-playtest.html');
    await page.waitForFunction(() => window.__survivPlaytest?.renderer.me);
    await page.evaluate(async () => {
        const { equipSurvivWeaponSlot } = await import('/@fs/C:/Users/eli/Documents/c/agarstake/phantom-game-server/surviv-engine.js');
        const game = window.__survivPlaytest;
        game.reset('yard');
        game.room.obstacles = [{ id: 'contact-cover', kind: 'rock', x: 40, y: 0, w: 20, h: 30,
            collidable: true, destructible: true, hp: 1, maxHp: 100 }];
        game.room.loot = [];
        Object.assign(game.me, { x: 0, y: 0, activeWeaponSlot: 2 });
        game.me.inventory.weapons = ['m9']; game.me.weaponSlotAmmo = [15];
        equipSurvivWeaponSlot(game.me, 0);
        const r = game.renderer;
        window.__polish = { shots: [], impacts: [], traces: [] };
        const shot = r.presentGunshot, impact = r.presentBulletImpact;
        r.presentGunshot = function(event, time) { window.__polish.shots.push(event); return shot.call(this,event,time); };
        r.presentBulletImpact = function(event,time) { window.__polish.impacts.push(event);
            const result = impact.call(this,event,time);
            window.__polish.traces.push(...this.localShotTracers.map(t=>({...t}))); return result; };
    });
    await page.waitForFunction(() => window.__survivPlaytest.renderer.me.weapon === 'm9');
    await page.waitForTimeout(300);
    const aim = await page.evaluate(() => {
        const r = window.__survivPlaytest.renderer, rect = r.canvas.getBoundingClientRect();
        return { x: rect.left + r.viewW / 2 + (220 - r.camera.x) * r.zoom,
            y: rect.top + r.viewH / 2 - r.camera.y * r.zoom };
    });
    await page.mouse.click(aim.x,aim.y);
    await page.waitForFunction(() => window.__polish.impacts.length > 0);
    await page.waitForTimeout(100);
    const combat = await page.evaluate(() => ({...window.__polish,
        ammo:window.__survivPlaytest.me.weapon.ammo,
        bullets:window.__survivPlaytest.room.bullets.length,
        obstacles:window.__survivPlaytest.room.obstacles.length,
        dedupeSize:window.__survivPlaytest.renderer._seenCombatEvents.size}));
    assert.equal(combat.shots.length,1); assert.equal(combat.impacts.length,1);
    assert.equal(combat.ammo,14); assert.equal(combat.bullets,0); assert.equal(combat.obstacles,0);
    assert.ok(Math.abs(combat.impacts[0].x-30)<1e-8);
    assert.equal(combat.traces.length,1); assert.equal(combat.traces[0].vx,0); assert.equal(combat.traces[0].vy,0);
    assert.ok(combat.traces[0].contactLength<14);

    // Inspect original prop art through the real cache, plus firearm action poses.
    const gallery = await page.evaluate(() => {
        const r = window.__survivPlaytest.renderer; r.pause();
        document.querySelector('#status').style.display='none';
        document.querySelector('#yard').parentElement.style.display='none';
        const c = r.ctx, canvas = r.canvas, dpr = window.devicePixelRatio;
        canvas.width=1440*dpr; canvas.height=900*dpr; canvas.style.width='1440px'; canvas.style.height='900px';
        c.setTransform(dpr,0,0,dpr,0,0); c.fillStyle='#304e3e'; c.fillRect(0,0,1440,900);
        c.fillStyle='#eef1df'; c.font='700 23px system-ui'; c.fillText('SURVIV / MATERIALS & COMBAT POSES',35,42);
        c.font='15px system-ui'; c.fillText('Existing prop cache · intact / damaged · neutral / fire / reload / healing',35,69);
        const props=[['rock',null,64,60],['rock',null,110,82],['barrel','fuel',36,36],['barrel','water',36,36],['barrel',null,40,40]];
        props.forEach(([kind,variant,w,h],i)=>{
            const x=95+i*270;
            c.fillStyle='#4f6c4f'; c.fillRect(x-65,96,240,220);
            c.fillStyle='#e5e8d8'; c.fillText(`${kind} ${variant||''}`,x-45,121);
            for(let j=0;j<2;j++) {
                c.save(); c.translate(x+j*108,205); c.scale(1.65,1.65);
                r.drawObstacle(c,{id:`gallery-${i}-${j}`,kind,variant,w,h,x:0,y:0,hue:218,hp:j?20:100,maxHp:100}); c.restore();
            }
        });
        const ids=['m9','mp5','m416','m870','mosin','awms','dp28','vss'];
        ids.forEach((weapon,i)=>{
            const x=80+i%4*352,y=375+Math.floor(i/4)*250;
            c.fillStyle='#5d7165'; c.fillRect(x-45,y-28,330,222);
            c.fillStyle='#eef0e4'; c.font='700 15px system-ui'; c.fillText(weapon.toUpperCase(),x-26,y-5);
            ['neutral','fire','reload','healing'].forEach((state,j)=>{
                const id=`pose-${i}-${j}`,px=x+(j%2)*157,py=y+54+Math.floor(j/2)*99;
                r._frameNow=Date.now();
                if(state==='fire') r._weaponShots.set(id,{weaponType:weapon,slot:0,startedAt:r._frameNow-15});
                const p={id,x:px,y:py,angle:0,color:'#b77bed',weapon,activeWeaponSlot:0,hp:100,maxHp:100,
                    reloading:state==='reload',reloadEndAtLocal:r._frameNow+800,reloadMs:1600,
                    medkitEndAtLocal:state==='healing'?r._frameNow+1250:0,medkitUseMs:2500};
                c.save(); c.translate(px,py); c.scale(1.8,1.8); c.translate(-px,-py);
                r.drawPlayer(c,p,false); c.restore();
                c.fillStyle='#e4e9dc'; c.font='11px system-ui'; c.fillText(state,px-20,py+32);
            });
        });
        // HP updates must change the visible wear, not invalidate/rebuild a sprite.
        const check = document.createElement('canvas'); check.width=180; check.height=180;
        const checkCtx=check.getContext('2d');
        const fixture={id:'cache-damage-regression',kind:'furniture',variant:'labBench',x:90,y:90,w:82,h:44,hp:100,maxHp:100};
        r._cacheBuildsThisFrame=0; r._obstacleCacheBuildsThisFrame=0;
        r.drawObstacle(checkCtx,fixture);
        const intact=checkCtx.getImageData(0,0,180,180).data;
        const cache=[...r._obstacleSpriteCache.values()].at(-1);
        const cacheCount=r._obstacleSpriteCache.size;
        checkCtx.clearRect(0,0,180,180); fixture.hp=20;
        r.drawObstacle(checkCtx,fixture);
        const damaged=checkCtx.getImageData(0,0,180,180).data;
        let changed=0; for(let i=0;i<intact.length;i++) if(intact[i]!==damaged[i]) changed++;
        if(changed<20) throw new Error('Cached furniture damage did not update');
        if(r._obstacleSpriteCache.size!==cacheCount || [...r._obstacleSpriteCache.values()].at(-1)!==cache)
            throw new Error('Damage rebuilt the static prop cache');
        return {props:props.length,weaponPoses:ids.length*4,cachedDamageChangedChannels:changed,spriteReused:true};
    });
    await page.screenshot({path:'.local/surviv-polish/materials-combat.png'});
    assert.deepEqual(errors,[]);
    const result={combat,gallery,errors};
    await writeFile('.local/surviv-polish/check.json',JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
} finally { await browser.close(); }
