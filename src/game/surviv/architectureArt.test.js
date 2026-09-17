import test from 'node:test';
import assert from 'node:assert/strict';
import { drawCraftedFurniture, drawRoofCourses, drawRoofWingRelief, drawInteriorAccessories } from './architectureArt.js';

function recorder() {
    const calls = [];
    const ctx = new Proxy({}, {
        set(target, key, value) { calls.push([key, value]); target[key] = value; return true; },
        get(target, key) {
            if (key in target) return target[key];
            return (...args) => {
                assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value)), `finite ${key}`);
                if (key === 'arc') assert.ok(args[2] >= 0);
                if (key === 'roundRect') assert.ok(args[2] > 0 && args[3] > 0);
                calls.push([key, ...args]);
            };
        },
    });
    return { ctx, calls };
}
test('furniture art is deterministic across horizontal, vertical and small footprints', () => {
    for (const variant of ['bed','bunkBed','hospitalBed','sofa','armchair','entryBench','prisonBench','dresser','locker','medicalCabinet','workbench','desk','nightstand','coffeeTable']) {
        for (const [w,h] of [[82,44],[44,82],[28,28]]) {
            const a = recorder(), b = recorder();
            const obstacle = { w, h, x: 240, y: -100, variant };
            assert.equal(drawCraftedFurniture(a.ctx, obstacle, variant), true);
            drawCraftedFurniture(b.ctx, obstacle, variant);
            assert.deepEqual(a.calls, b.calls);
            assert.equal(a.calls.filter(c => c[0] === 'save').length, a.calls.filter(c => c[0] === 'restore').length);
            assert.ok(a.calls.length < 500, 'bounded drawing cost');
        }
    }
    assert.equal(drawCraftedFurniture(recorder().ctx, {w:40,h:40}, 'unknown'), false);
});
test('roof courses and remaining interior details have bounded, stable geometry', () => {
    const outline = [[-380,-230],[380,-230],[380,20],[150,20],[150,230],[-150,230],[-150,20],[-380,20]].map(([x,y]) => ({x,y}));
    const wingA = recorder(), wingB = recorder();
    drawRoofWingRelief(wingA.ctx, outline); drawRoofWingRelief(wingB.ctx, outline);
    assert.deepEqual(wingA.calls, wingB.calls);
    assert.ok(wingA.calls.length < 180);
    for (const variant of ['residence-clay','warehouse','barn']) {
        const a = recorder(), b = recorder();
        drawRoofCourses(a.ctx, 720, 560, variant); drawRoofCourses(b.ctx, 720, 560, variant);
        assert.deepEqual(a.calls, b.calls);
        assert.ok(a.calls.length < 30000);
    }
    for (const variant of ['bookshelf','diningTable','kitchenCounter','labBench','toilet','bathtub','vanity','generator','housePlant']) {
        const a = recorder();
        drawInteriorAccessories(a.ctx, {w:82,h:44}, variant);
        assert.ok(a.calls.length > 2);
    }
});
