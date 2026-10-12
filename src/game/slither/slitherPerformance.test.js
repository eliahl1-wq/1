import test from 'node:test';
import assert from 'node:assert/strict';
import { slitherCanvasDpr, slitherQualityForFrameTime, createSlitherQualityGovernor } from './slitherPerformance.js';

test('fullscreen canvas stays inside its desktop GPU pixel budget', () => {
    const dpr1440p = slitherCanvasDpr({ width: 2560, height: 1440, rawDpr: 1.5 });
    const dpr4k = slitherCanvasDpr({ width: 3840, height: 2160, rawDpr: 2 });
    assert.ok(2560 * 1440 * dpr1440p * dpr1440p <= 2_800_001);
    assert.ok(3840 * 2160 * dpr4k * dpr4k <= 2_800_001, 'minimum DPR cannot defeat the 4K pixel budget');
});

test('normal 60 Hz stays sharp while capture-like frame times reduce work', () => {
    assert.equal(slitherQualityForFrameTime(1, 16.67), 1);
    assert.equal(slitherQualityForFrameTime(1, 22), 0.72);
    assert.equal(slitherQualityForFrameTime(0.72, 16.5), 1);
});

test('short hitches do not lower quality and stable recovery cannot oscillate each second', () => {
    const governor = createSlitherQualityGovernor();
    for (let i = 0; i < 12; i++) assert.equal(governor.update(33), 1);
    for (let i = 0; i < 150; i++) governor.update(33);
    assert.equal(governor.update(33), 0.6);
    for (let i = 0; i < 180; i++) governor.update(16.67);
    assert.equal(governor.update(16.67), 0.6, 'three seconds cannot instantly restore expensive effects');
    for (let i = 0; i < 600; i++) governor.update(16.67);
    assert.equal(governor.update(16.67), 1);
    assert.equal(governor.update(3000), 1, 'tab/debugger stalls are ignored');
});
