import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrimaryFireInput, listenForInputInterruption } from './inputLifecycle.js';

function fixture(allowed = true) {
    let shooting = false, id = 0;
    const sent = [];
    const renderer = {
        handlePointerDown() { shooting = true; id++; }, handlePointerUp() { shooting = false; },
        handlePointerMove() {}, clearInput() { shooting = false; },
        getInputPayload() { return { dx: 1, dy: 0, shooting, firePressId: id }; },
    };
    return { sent, input: createPrimaryFireInput({ renderer, canStart: () => allowed, send: p => sent.push(p) }) };
}
const left = { pointerId: 1, button: 0, buttons: 1, clientX: 40, clientY: 60 };

test('only the firing pointer can release desktop fire; cancellation is idempotent', () => {
    const { input, sent } = fixture();
    assert.equal(input.press(left), true);
    assert.equal(input.release({ ...left, pointerId: 2 }), false);
    assert.equal(input.release({ ...left, button: 2 }), false);
    assert.equal(sent.length, 1);
    assert.equal(input.cancel(left), true);
    assert.equal(input.cancel(left), false);
    assert.equal(sent[1].shooting, false);
    assert.equal(sent[1].firePressId, sent[0].firePressId);
});
test('left release during a mouse-button chord stops shooting without waiting for final pointerup', () => {
    const { input, sent } = fixture();
    input.press(left);
    assert.equal(input.move({ ...left, buttons: 3 }), false);
    assert.equal(input.move({ ...left, buttons: 2 }), true);
    assert.equal(sent.at(-1).shooting, false);
});
test('neutralization clears movement and fire and permits the next fresh press', () => {
    const { input, sent } = fixture();
    input.press(left); input.neutralize();
    assert.deepEqual(sent[1], { dx: 0, dy: 0, shooting: false, firePressId: 1 });
    input.press(left);
    assert.equal(sent[2].firePressId, 2);
    assert.equal(fixture(false).input.press(left), false);
    assert.equal(fixture().input.press({ ...left, button: 2 }), false);
});
test('blur, hiding, pagehide and orientation interruption reset controls; cleanup removes listeners', () => {
    const windowTarget = new EventTarget(), documentTarget = new EventTarget();
    let resets = 0;
    const cleanup = listenForInputInterruption(windowTarget, documentTarget, () => resets++);
    for (const name of ['blur', 'pagehide', 'orientationchange']) windowTarget.dispatchEvent(new Event(name));
    documentTarget.hidden = false; documentTarget.dispatchEvent(new Event('visibilitychange'));
    assert.equal(resets, 3);
    documentTarget.hidden = true; documentTarget.dispatchEvent(new Event('visibilitychange'));
    assert.equal(resets, 4);
    cleanup(); windowTarget.dispatchEvent(new Event('blur')); documentTarget.dispatchEvent(new Event('visibilitychange'));
    assert.equal(resets, 4);
});
