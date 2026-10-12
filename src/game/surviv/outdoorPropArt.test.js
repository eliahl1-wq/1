import test from 'node:test';
import assert from 'node:assert/strict';
import { drawCraftedOutdoorProp } from './outdoorPropArt.js';
function recorder() {
    const calls = [];
    const ctx = new Proxy({}, { set(t,k,v) { t[k]=v; calls.push([k,v]); return true; },
        get(t,k) { if(k in t) return t[k]; return (...args)=>{
            assert.ok(args.every(v=>typeof v!=='number'||Number.isFinite(v)),k);
            if(k==='arc') assert.ok(args[2]>0); calls.push([k,...args]); }; } });
    return {ctx,calls};
}
test('outdoor materials are deterministic, bounded and reuse cached drawing at every world position',()=>{
    for(const kind of ['rock','barrel']) for(const variant of ['fuel','water','ordinary']) for(const [w,h] of [[12,12],[36,36],[64,60],[110,82]]) {
        const a=recorder(),b=recorder();
        assert.equal(drawCraftedOutdoorProp(a.ctx,{kind,variant,w,h,hue:218,x:0,y:0}),true);
        drawCraftedOutdoorProp(b.ctx,{kind,variant,w,h,hue:218,x:8000,y:9000});
        assert.deepEqual(a.calls,b.calls);
        assert.equal(a.calls.filter(c=>c[0]==='save').length,a.calls.filter(c=>c[0]==='restore').length);
        assert.ok(a.calls.length<160);
        assert.ok(!a.calls.some(c=>['createLinearGradient','createRadialGradient','shadowBlur','filter'].includes(c[0])));
    }
});
test('unsupported props and invalid bounds do not modify canvas state',()=>{
    for(const o of [{kind:'tree',w:60,h:60},{kind:'rock',w:NaN,h:30},{kind:'barrel',w:30,h:Infinity}]) {
        const r=recorder(); assert.equal(drawCraftedOutdoorProp(r.ctx,o),false); assert.deepEqual(r.calls,[]);
    }
});
