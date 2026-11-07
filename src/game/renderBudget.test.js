import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { budgetedCanvasDpr, getGameCanvasContext } from './renderBudget.js';

test('stable pixel budget preserves 1080p and bounds 4K/ultrawide without a manual mode', () => {
    assert.equal(budgetedCanvasDpr({ width: 1920, height: 1080 }), 1);
    for (const [width, height] of [[3840, 2160], [7680, 2160], [5120, 2880]]) {
        const dpr = budgetedCanvasDpr({ width, height });
        assert.ok(width * height * dpr * dpr <= 2_400_001);
    }
    assert.equal(budgetedCanvasDpr({ width: 844, height: 390, baseDpr: 1.5 }), 1.5);
});

test('visible game canvases explicitly request synchronized, opaque presentation', () => {
    const context = {};
    let requested;
    assert.equal(getGameCanvasContext({ getContext(...args) { requested = args; return context; } }), context);
    assert.deepEqual(requested, ['2d', { alpha: false, desynchronized: false }]);
});

for (const file of ['agar/Game.jsx', 'slither/SlitherRenderer.js', 'surviv/SurvivRenderer.js']) {
    test(`${file} uses compositor sync without a second frame-skipping clock`, () => {
        const source = readFileSync(new URL(file, import.meta.url), 'utf8');
        assert.match(source, /getGameCanvasContext\(canvas\)/);
        assert.match(source, /requestAnimationFrame\(/);
        assert.doesNotMatch(source, /framePacer|createGameFramePacer/);
        assert.doesNotMatch(source, /getContext\('2d', \{ alpha: false, desynchronized: true/);
    });
}

test('retired recording preference is removed and cannot impose a hidden FPS cap', async () => {
    const previous = globalThis.window;
    const removed = [];
    globalThis.window = { localStorage: { removeItem: key => removed.push(key) } };
    try {
        const module = await import('./renderBudget.js?retired-preference-test');
        assert.deepEqual(removed, ['game_recording_mode']);
        assert.equal('createGameFramePacer' in module, false);
        assert.equal('setRecordingMode' in module, false);
    } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});
