import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSpineToArcLength, stepSnakeBody, updateBodyAlongPath } from './snakePath.js';

test('downsampled curve loss cannot become a long rigid tail extension', () => {
    const spine = [{ x: 0, y: 0 }, { x: -4, y: 0 }, { x: -8, y: 0 }];
    const grown = fitSpineToArcLength(spine, 48, 3.6);
    const tail = grown[grown.length - 1];
    const originalTail = spine[spine.length - 1];
    const extension = Math.hypot(tail.x - originalTail.x, tail.y - originalTail.y);

    assert.ok(extension <= 3.601, `tail may only use fractional segment growth, got ${extension}`);
    assert.equal(fitSpineToArcLength(spine, 48).length, spine.length,
        'curve compression alone must not synthesize any tail');
});
test('a 1200-segment tail stays distributed when path history must be extended', () => {
    const segments = Array.from({ length: 1200 }, () => ({ x: 0, y: 0 }));
    const state = { path: [{ x: 0, y: 0 }, { x: -5.4, y: 0 }] };
    updateBodyAlongPath(state, segments, 5.4, 0, 0, 0, 1200);

    const tail = segments[segments.length - 1];
    const beforeTail = segments[segments.length - 2];
    assert.ok(Math.hypot(tail.x - beforeTail.x, tail.y - beforeTail.y) > 5,
        'the final tail points must not collapse into one rigid collision pile');
    assert.ok(state.path.length >= 1200, 'path history should cover the full large body');
});
test('the local snake can use faster smoothing without changing remote snake smoothing', () => {
    const makeState = () => ({ segments: [{ x: 0, y: 0 }], angle: 0 });
    const local = makeState();
    const remote = makeState();
    const target = [{ x: 10, y: 0 }];
    const meta = { segmentCount: 1, fam: 0 };

    stepSnakeBody(local, meta, target, 1, 1 / 60, 0, {
        skipDensify: true,
        smoothTime: 0.024,
        angleSmoothTime: 0.018,
    });
    stepSnakeBody(remote, meta, target, 1, 1 / 60, 0, {
        skipDensify: true,
        smoothTime: 0.06,
        angleSmoothTime: 0.045,
    });

    assert.ok(local.segments[0].x > remote.segments[0].x * 2);
    assert.ok(local.angle > remote.angle);
});