import test from 'node:test';
import assert from 'node:assert/strict';
import { drawGameMinimap, normalizeMinimapData } from './minimap.js';
test('shared radar paints coarse gunfire/proximity warnings without needing exact opponent coordinates',()=>{
    const strokes=[];let color='';
    const ctx=new Proxy({}, {set(t,k,v){if(k==='strokeStyle')color=v;t[k]=v;return true;},get(t,k){
        if(k in t)return t[k];if(k==='stroke')return()=>strokes.push(color);
        if(k==='createRadialGradient')return()=>({addColorStop(){}});return()=>{};
    }});
    const data=normalizeMinimapData({players:[{x:0,y:0,isYou:true}],warnings:[{angle:0,strength:.85}]});
    drawGameMinimap(ctx,{screenW:500,screenH:500,isMobile:false,centerX:0,centerY:0,viewHalfW:500,viewHalfH:300,...data});
    assert.ok(strokes.some(c=>c.startsWith('rgba(255, 35, 35,')));
    assert.deepEqual(data.warnings,[{angle:0,strength:.85}]);
});
