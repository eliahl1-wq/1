import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMinimapCache } from './minimapCache.js';

test('radar pixels are reused at display refresh and redraw on viewport/scale changes', () => {
    let paints = 0, composites = 0;
    const cacheCtx = { setTransform() {}, clearRect() {} };
    const canvas = { width: 0, height: 0, getContext: () => cacheCtx };
    const ctx = { getTransform: () => ({ a: 1.5 }), drawImage() { composites++; } };
    const cache = new GameMinimapCache({ createCanvas: () => canvas, draw: () => paints++ });
    const options = { isMobile: false, screenW: 1440, screenH: 900, viewHalfW: 720, viewHalfH: 450 };
    for (let frame = 0; frame < 120; frame++) cache.draw(ctx, { ...options, time: 1000 + frame * 8.33 });
    assert.ok(paints <= 13);
    assert.equal(composites, 120);
    assert.equal(canvas.width, 240);
    cache.draw(ctx, { ...options, screenW: 1800, viewHalfW: 900, time: 2001 });
    const afterResize = paints;
    cache.draw(ctx, { ...options, isMobile: true, time: 2002 });
    assert.equal(paints, afterResize + 1);
    assert.equal(canvas.width, 138);
});

test('large radar data is prepared only for an actual radar refresh, never for every world frame', () => {
    let prepared = 0, paints = 0;
    const context = { setTransform() {}, clearRect() {} };
    const cache = new GameMinimapCache({ createCanvas: () => ({ getContext: () => context }),
        draw: (_ctx, options) => { paints++; assert.equal(options.food[0].x, prepared); } });
    const ctx = { getTransform: () => ({ a: 1 }), drawImage() {} };
    for (let frame = 0; frame < 144; frame++) cache.draw(ctx, {
        screenW: 1920, screenH: 1080, time: frame * 1000 / 144,
        getData: () => { prepared++; return { food: [{ x: prepared, y: 0 }] }; },
    });
    assert.equal(prepared, paints);
    assert.ok(prepared <= 13);
});
