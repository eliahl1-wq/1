import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetedCanvasDpr, createGameFramePacer } from './renderBudget.js';

test('stable pixel budget preserves 1080p and bounds 4K/ultrawide without a manual mode', () => {
    assert.equal(budgetedCanvasDpr({ width: 1920, height: 1080 }), 1);
    for (const [width, height] of [[3840, 2160], [7680, 2160], [5120, 2880]]) {
        const dpr = budgetedCanvasDpr({ width, height });
        assert.ok(width * height * dpr * dpr <= 2_400_001);
    }
    assert.equal(budgetedCanvasDpr({ width: 844, height: 390, baseDpr: 1.5 }), 1.5);
});

test('healthy rendering preserves 60/120/144 Hz without painting at 240/360 Hz', () => {
    for (const hz of [60, 120, 144, 240, 360]) {
        const pacer = createGameFramePacer();
        let draws = 0, inputs = 0;
        for (let frame = 0; frame <= hz * 10; frame++) {
            inputs++;
            if (pacer.shouldDraw(frame * 1000 / hz)) { draws++; pacer.recordDraw(2); }
        }
        const expectedHz = hz / Math.max(1, Math.round(hz / 144));
        assert.ok(Math.abs(draws - (expectedHz * 10 + 1)) < 3, `${hz} Hz: ${draws}`);
        assert.equal(inputs, hz * 10 + 1);
    }
});

test('jittered 60 Hz callbacks cannot accidentally halve the frame rate', () => {
    const pacer = createGameFramePacer({ maxFps: 60 });
    let draws = 0;
    for (let frame = 0; frame <= 600; frame++) {
        const jitter = frame % 3 === 0 ? -1.2 : frame % 3 === 1 ? .6 : 0;
        if (pacer.shouldDraw(frame * 1000 / 60 + jitter)) { draws++; pacer.recordDraw(2); }
    }
    assert.ok(draws >= 598, `${draws} draws`);
});

test('sustained heavy draws automatically reduce paint work, with slow recovery', () => {
    const pacer = createGameFramePacer();
    let now = 0;
    const run = (milliseconds, cost) => {
        const end = now + milliseconds;
        while (now < end) { if (pacer.shouldDraw(now)) pacer.recordDraw(cost); now += 1000 / 144; }
    };
    run(500, 20); assert.equal(pacer.targetFps, 144);
    run(3000, 20); assert.equal(pacer.targetFps, 60);
    run(5000, 2); assert.equal(pacer.targetFps, 60);
    run(16_000, 2); assert.equal(pacer.targetFps, 144);
});

test('slow callbacks alone do not cause an additional FPS penalty', () => {
    const pacer = createGameFramePacer();
    for (let i = 0; i < 120; i++) {
        assert.equal(pacer.shouldDraw(i * 33.3), true);
        pacer.recordDraw(3);
    }
    assert.equal(pacer.targetFps, 144);
    assert.equal(pacer.shouldDraw(10000), true);
    assert.equal(pacer.shouldDraw(10001), false);
    pacer.reset(); assert.equal(pacer.shouldDraw(10002), true);
});

test('under load on 120/144 Hz, every paint lands two display ticks apart', () => {
    for (const hz of [120, 144]) {
        for (const cost of [10, 20]) {
            const pacer = createGameFramePacer();
            const painted = [];
            for (let frame = 0; frame < hz * 5; frame++) {
                if (pacer.shouldDraw(frame * 1000 / hz + Math.sin(frame) * .45)) {
                    pacer.recordDraw(cost);
                    if (frame >= hz * 3) painted.push(frame);
                }
            }
            assert.ok(painted.length > 100);
            assert.ok(painted.slice(1).every((frame, index) => frame - painted[index] === 2));
        }
    }
});

test('retired recording preference is removed and cannot force 60 FPS', async () => {
    const previous = globalThis.window;
    const removed = [];
    globalThis.window = { localStorage: { removeItem: key => removed.push(key) } };
    try {
        const module = await import('./renderBudget.js?retired-preference-test');
        assert.deepEqual(removed, ['game_recording_mode']);
        assert.equal(module.createGameFramePacer().targetFps, 144);
        assert.equal('setRecordingMode' in module, false);
    } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});
