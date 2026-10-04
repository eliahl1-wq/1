import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRenderSpatialIndex, queryRenderSpatialIndex } from './renderSpatialIndex.js';

const brute = (source, b) => source.filter(o => {
    const w = o._renderHalfW ?? Math.abs(o.w) / 2, h = o._renderHalfH ?? Math.abs(o.h) / 2;
    return o.x + w >= b.left && o.x - w <= b.right && o.y + h >= b.top && o.y - h <= b.bottom;
});
test('render index preserves exact viewport membership and drawing order', () => {
    const objects = [];
    for (let i = 0; i < 10000; i++) objects.push({ id: i, x: (i % 100) * 200 - 10000,
        y: Math.floor(i / 100) * 200 - 10000, w: 80, h: 60,
        ...(i % 17 === 0 ? { _renderHalfW: 130, _renderHalfH: 130 } : {}) });
    objects.splice(217, 0, { id: 'long-river', x: 0, y: 0, w: 22000, h: 1000 });
    objects.push({ id: 'door-swing', x: 256, y: 256, w: 10, h: 80, _renderHalfW: 85, _renderHalfH: 85 });
    const index = buildRenderSpatialIndex(objects), out = [];
    for (let i = 0; i < 120; i++) {
        const x = -10000 + i * 167, y = -10000 + ((i * 71) % 120) * 167;
        const b = { left: x - 600, right: x + 600, top: y - 380, bottom: y + 380 };
        assert.deepEqual(queryRenderSpatialIndex(index, b, out), brute(objects, b));
        assert.equal(new Set(out).size, out.length, 'multi-cell entries are not duplicated');
    }
    const metrics = {};
    queryRenderSpatialIndex(index, { left: -650, right: 650, top: -450, bottom: 450 }, out, metrics);
    assert.ok(metrics.candidates < objects.length * .04, 'no full-map scan for an ordinary viewport');
    assert.equal(index.oversized.length, 1, 'large water geometry has bounded indexing cost');
});

test('render queries include exact edges, negative cells, giant views and rebuilt removals', () => {
    const source = [{x: -512, y: -512, w: 20, h: 20}, {x: 40, y: 40, w: 10, h: 10}];
    let index = buildRenderSpatialIndex(source), out = [];
    const edge = { left: -502, right: -502, top: -522, bottom: -522 };
    assert.deepEqual(queryRenderSpatialIndex(index, edge, out), [source[0]]);
    const giant = { left: -20000, right: 20000, top: -20000, bottom: 20000 };
    assert.deepEqual(queryRenderSpatialIndex(index, giant, out), source);
    assert.deepEqual(queryRenderSpatialIndex(index, {left:-Infinity,right:Infinity,top:-Infinity,bottom:Infinity}, out), source);
    index = buildRenderSpatialIndex(source.slice(1));
    assert.deepEqual(queryRenderSpatialIndex(index, giant, out), [source[1]]);
    assert.deepEqual(queryRenderSpatialIndex(buildRenderSpatialIndex([]), giant, out), []);
});
