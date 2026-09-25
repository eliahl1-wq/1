import test from 'node:test';
import assert from 'node:assert/strict';
import { appendHouseFootprintPath, buildVisibilityRayIndex, castVisibilityRay, getHouseBoundarySegments } from './visibilityGeometry.js';

function brute(segments, px, py, dx, dy, distance) {
    let closest = distance;
    for (const s of segments) {
        const sx = s.bx - s.ax, sy = s.by - s.ay;
        const denominator = dx * sy - dy * sx;
        if (Math.abs(denominator) < 1e-10) continue;
        const t = ((s.ax - px) * sy - (s.ay - py) * sx) / denominator;
        const u = ((s.ax - px) * dy - (s.ay - py) * dx) / denominator;
        if (t >= 0 && u >= -1e-7 && u <= 1 + 1e-7) closest = Math.min(closest, t);
    }
    return { x: px + dx * closest, y: py + dy * closest };
}

test('indexed visibility preserves brute-force wall/corner intersections while pruning work', () => {
    const segments = getHouseBoundarySegments({ x: 0, y: 0, w: 1800, h: 1300 });
    for (let y = -500; y <= 500; y += 100) for (let x = -750; x <= 750; x += 100) {
        segments.push(...getHouseBoundarySegments({ x, y, w: 42, h: 26, rotation: (x + y) / 1000 }));
    }
    const index = buildVisibilityRayIndex(segments), metrics = { segmentTests: 0 };
    let rays = 0;
    for (const [px, py] of [[0, 0], [27.000001, 33], [-899.999, -649.999], [120, -211]]) {
        const angles = Array.from({ length: 360 }, (_, i) => i * Math.PI / 180);
        for (const segment of segments) angles.push(Math.atan2(segment.ay - py, segment.ax - px));
        for (const angle of angles) {
            const dx = Math.cos(angle), dy = Math.sin(angle);
            const actual = castVisibilityRay(index, px, py, dx, dy, 900, {}, metrics);
            const expected = brute(segments, px, py, dx, dy, 900);
            assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < 1e-6);
            rays++;
        }
    }
    assert.ok(metrics.segmentTests < rays * segments.length * .20,
        `expected >80% fewer exact tests; ${metrics.segmentTests}/${rays * segments.length}`);
});

test('empty geometry, cardinal rays and rebuilt doors retain exact visibility', () => {
    assert.deepEqual(castVisibilityRay(null, 1, 2, 1, 0, 50, {}), { x: 51, y: 2 });
    const wall = [{ ax: 10, ay: -5, bx: 10, by: 5 }];
    assert.deepEqual(castVisibilityRay(buildVisibilityRayIndex(wall), 0, 0, 1, 0, 100, {}), { x: 10, y: 0 });
    const opened = [{ ax: 10, ay: -5, bx: 20, by: -5 }];
    assert.deepEqual(castVisibilityRay(buildVisibilityRayIndex(opened), 0, 0, 1, 0, 100, {}), { x: 100, y: 0 });
    assert.deepEqual(castVisibilityRay(buildVisibilityRayIndex(wall), 10, 0, 1, 0, 100, {}), { x: 10, y: 0 });
});

test('concave roof mask and LOS boundaries follow the same actual house outline', () => {
    const footprint = [[-100,-100],[0,-100],[0,0],[100,0],[100,100],[-100,100]].map(([x,y]) => ({x,y}));
    const house = { x: 300, y: -200, w: 200, h: 200, footprint };
    const boundary = getHouseBoundarySegments(house);
    assert.equal(boundary.length, 6);
    assert.deepEqual(castVisibilityRay(buildVisibilityRayIndex(boundary), 250, -250, 1, 0, 900, {}), { x: 300, y: -250 });
    const calls = [];
    const ctx = new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]) });
    appendHouseFootprintPath(ctx, house, 2);
    assert.equal(calls.filter(c => c[0] === 'lineTo').length, 5);
    assert.ok(!calls.some(c => c[0] === 'rect' || c[0] === 'beginPath'), 'append a polygon hole, not a bounding box');
    assert.ok(Math.abs(getHouseBoundarySegments({ x: 0, y: 0, w: 20, h: 10, rotation: Math.PI / 2 })[0].ax - 5) < 1e-9);
});
