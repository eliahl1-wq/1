import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
await mkdir('.local/surviv-loot',{recursive:true});
try {
    const page=await browser.newPage({viewport:{width:1440,height:1120},deviceScaleFactor:1.5});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5174/surviv-playtest.html');
    await page.waitForFunction(()=>window.__survivPlaytest?.renderer.me);
    const result=await page.evaluate(async()=>{
        const game=window.__survivPlaytest,r=game.renderer;
        const engine=await import('/@fs/C:/Users/eli/Documents/c/agarstake/phantom-game-server/surviv-engine.js');
        const {SURVIV_STANDARD_FIREARM_IDS:ids}=await import('/@fs/C:/Users/eli/Documents/c/agarstake/phantom-game-server/surviv-weapons.js');
        const {getSurvivWeaponRarity}=await import('/src/game/surviv/weaponCatalog.js');
        const {drawGameMinimap}=await import('/src/game/minimap.js');
        const {SURVIV_RARITY_COLORS:colors}=await import('/src/game/surviv/lootConfig.js');
        game.reset('yard');game.room.obstacles=[];game.room.loot=[];
        game.me._survivEntryAllocated=false;
        const allocation=engine.fundSurvivEntry(game.room,game.me,5);
        if(allocation.player!==1||allocation.bot!==1||allocation.map!==3) throw new Error('Incorrect actual entry split');
        await new Promise(resolve=>setTimeout(resolve,100));
        r.pause();
        document.querySelector('#status').style.display='none';document.querySelector('#yard').parentElement.style.display='none';
        const canvas=r.canvas,c=r.ctx,dpr=window.devicePixelRatio;
        canvas.width=1440*dpr;canvas.height=1120*dpr;canvas.style.width='1440px';canvas.style.height='1120px';
        c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#2e493c';c.fillRect(0,0,1440,1120);
        c.fillStyle='#f1eee1';c.font='700 24px system-ui';c.fillText('SURVIV / LOOT PROGRESSION',30,42);
        c.font='15px system-ui';c.fillText('26 weapons · shared ground / held art · funded coins · directional radar warnings',30,70);
        r.me=null;r._frameNow=Date.now();
        ids.forEach((id,i)=>{
            const x=25+(i%4)*355,y=100+Math.floor(i/4)*128;
            c.fillStyle='#536b59';c.fillRect(x,y,338,118);
            const rarity=getSurvivWeaponRarity(id);
            c.textAlign='left';c.textBaseline='alphabetic';c.fillStyle=colors[rarity];c.font='700 13px system-ui';c.fillText(`${engine.WEAPONS[id].label} / ${rarity.toUpperCase()}`,x+12,y+20);
            r.drawLoot(c,{id:`g-${id}`,type:'weapon',weaponType:id,x:x+90,y:y+68,tier:rarity});
            r.drawPlayer(c,{id:`p-${id}`,x:x+249,y:y+68,angle:0,color:'#b77bed',hp:100,maxHp:100,weapon:id,activeWeaponSlot:0},false);
        });
        for(let i=0;i<3;i++) r.drawLoot(c,{id:`coin${i}`,type:'money',dollarValue:.5,x:950+i*65,y:1010});
        c.save();c.translate(1190,940);
        drawGameMinimap(c,{screenW:160,screenH:160,isMobile:false,centerX:0,centerY:0,viewHalfW:500,viewHalfH:300,
            warnings:[{angle:0,strength:.85},{angle:-Math.PI/4,strength:.85}],time:Date.now()});
        c.restore();
        return {allocation,weapons:ids.length,rarities:[...new Set(ids.map(getSurvivWeaponRarity))],coins:game.room.loot.filter(l=>l.type==='money').length};
    });
    await page.screenshot({path:'.local/surviv-loot/progression.png'});
    assert.equal(result.weapons,26);assert.deepEqual(errors,[]);
    if(process.env.SURVIV_UI_ORIGIN) {
        const {token}=await fetch('http://127.0.0.1:5057/fixture').then(r=>r.json());
        const context=await browser.newContext({viewport:{width:1440,height:900}});
        await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
        await context.addInitScript(token=>{
            localStorage.setItem('token',token);localStorage.setItem('selected_gamemode','surviv');
            localStorage.setItem('public_free_mode','false');
        },token);
        const lobby=await context.newPage();lobby.on('pageerror',e=>errors.push(e.message));
        await lobby.goto(`${process.env.SURVIV_UI_ORIGIN}/surviv`);
        await lobby.getByText('Game details',{exact:true}).click();
        const start=lobby.getByText('Starting balance',{exact:true}).locator('..');
        await start.waitFor();assert.ok((await start.innerText()).includes('$1.00'));
        const coins=lobby.getByText('Map coins per entry',{exact:true}).locator('..');
        assert.ok((await coins.innerText()).includes('$3.00–$4.00'));
        await lobby.screenshot({path:'.local/surviv-loot/pregame.png'});
        result.pregameVerified=true;assert.deepEqual(errors,[]);await context.close();
    }
    await writeFile('.local/surviv-loot/check.json',JSON.stringify({...result,errors},null,2));
    console.log(JSON.stringify({...result,errors,passed:true}));
} finally {await browser.close();}
