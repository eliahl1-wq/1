import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetedCanvasDpr, createGameFramePacer, getRecordingMode, setRecordingMode } from './renderBudget.js';

test('4K and ultrawide canvases obey pixel budgets without lowering ordinary 1080p', () => {
    assert.equal(budgetedCanvasDpr({ width: 1920, height: 1080, recordingMode: false }), 1);
    for (const [width, height] of [[3840, 2160], [7680, 2160], [5120, 2880]]) {
        for (const recordingMode of [false, true]) {
            const dpr = budgetedCanvasDpr({ width, height, recordingMode });
            assert.ok(width * height * dpr * dpr <= (recordingMode ? 1_600_001 : 2_800_001));
        }
    }
    assert.equal(budgetedCanvasDpr({ width: 844, height: 390, baseDpr: 1.5, recordingMode: true }), 1.5);
});

test('recording paint stays near 60 FPS across common display rates, without changing input callbacks', () => {
    for (const hz of [60, 120, 144, 165, 240, 360]) {
        const pacer = createGameFramePacer(() => true);
        let draws = 0, inputs = 0;
        for (let frame = 0; frame <= hz * 10; frame++) {
            inputs++;
            if (pacer.shouldDraw(frame * 1000 / hz)) draws++;
        }
        assert.ok(draws >= 598 && draws <= 603, `${hz} Hz: ${draws} draws`);
        assert.equal(inputs, hz * 10 + 1);
    }
});

test('normal mode retains 60/120/144 Hz and avoids painting 240/360 times per second', () => {
    for (const hz of [60, 120, 144, 240, 360]) {
        const pacer = createGameFramePacer(() => false);
        let draws = 0;
        for (let frame = 0; frame <= hz * 10; frame++) if (pacer.shouldDraw(frame * 1000 / hz)) draws++;
        assert.ok(Math.abs(draws - (Math.min(144, hz) * 10 + 1)) < 3, `${hz} Hz: ${draws}`);
    }
});

test('slightly jittered 60 Hz callbacks do not become accidental 30 FPS during capture', () => {
    const pacer = createGameFramePacer(() => true);
    let draws = 0;
    for (let frame = 0; frame <= 600; frame++) {
        const jitter = frame % 3 === 0 ? -1.2 : frame % 3 === 1 ? .6 : 0;
        if (pacer.shouldDraw(frame * 1000 / 60 + jitter)) draws++;
    }
    assert.ok(draws >= 598, `${draws} draws`);
});

test('mode changes and background interruptions resume immediately rather than replaying missed frames', () => {
    let recording = false;
    const pacer = createGameFramePacer(() => recording);
    assert.equal(pacer.shouldDraw(0), true);
    assert.equal(pacer.shouldDraw(2), false);
    recording = true;
    assert.equal(pacer.shouldDraw(3), true);
    assert.equal(pacer.shouldDraw(8), false);
    assert.equal(pacer.shouldDraw(1000), true);
    pacer.reset(); assert.equal(pacer.shouldDraw(1001), true);
});

test('recording preference can be switched without browser storage and affects only render budgeting', () => {
    const initial = getRecordingMode();
    try {
        setRecordingMode(true); assert.equal(getRecordingMode(), true);
        assert.ok(budgetedCanvasDpr({ width: 3840, height: 2160 }) < 0.5);
        setRecordingMode(false); assert.equal(getRecordingMode(), false);
    } finally { setRecordingMode(initial); }
});
