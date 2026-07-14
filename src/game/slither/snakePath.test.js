import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSpineToArcLength, updateBodyAlongPath } from './snakePath.js';

test('visual tail growth is split into moving points instead of one rigid edge', () => {
    const spine = [{ x: 0, y: 0 }, { x: -4, y: 0 }, { x: -8, y: 0 }];
    const grown = fitSpineToArcLength(spine, 48);

    assert.ok(grown.length > spine.length + 1, 'long growth should add several tail points');
    for (let i = 1; i < grown.length; i++) {
        const edge = Math.hypot(grown[i].x - grown[i - 1].x, grown[i].y - grown[i - 1].y);
        assert.ok(edge <= 12.001, `tail edge ${i} should remain flexible, got ${edge}`);
    }
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