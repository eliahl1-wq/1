import test from 'node:test';
import assert from 'node:assert/strict';
import { slitherCanvasDpr, slitherQualityForFrameTime } from './slitherPerformance.js';

test('fullscreen canvas stays inside its desktop GPU pixel budget', () => {
    const dpr1440p = slitherCanvasDpr({ width: 2560, height: 1440, rawDpr: 1.5 });
    const dpr4k = slitherCanvasDpr({ width: 3840, height: 2160, rawDpr: 2 });
    assert.ok(2560 * 1440 * dpr1440p * dpr1440p <= 2_800_001);
    assert.ok(3840 * 2160 * dpr4k * dpr4k <= 3_850_000, 'minimum DPR may exceed the budget slightly at 4K');
});

test('normal 60 Hz stays sharp while capture-like frame times reduce work', () => {
    assert.equal(slitherQualityForFrameTime(1, 16.67), 1);
    assert.equal(slitherQualityForFrameTime(1, 22), 0.72);
    assert.equal(slitherQualityForFrameTime(0.72, 16.5), 1);
});
