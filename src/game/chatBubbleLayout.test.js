import test from 'node:test';
import assert from 'node:assert/strict';
import { getChatBubbleLayout } from './chatBubbleLayout.js';

test('chat layout is measured once across hundreds of animation frames and remains bounded', () => {
    let measurements = 0;
    const ctx = { font: 'bold 13px Inter', measureText(value) { measurements++; return { width: Array.from(value).length * 7 }; } };
    const text = 'Hello players! '.repeat(20);
    const layout = getChatBubbleLayout(ctx, text, 13);
    const initial = measurements;
    for (let frame = 0; frame < 600; frame++) assert.equal(getChatBubbleLayout(ctx, text, 13), layout);
    assert.equal(measurements, initial);
    assert.equal(layout.lines.length, 3);
    assert.ok(layout.lines.at(-1).endsWith('…'));
    assert.ok(layout.bubbleWidth > 0);
    for (let i = 0; i < 200; i++) getChatBubbleLayout(ctx, `message ${i}`, 13);
    assert.notEqual(getChatBubbleLayout(ctx, text, 13), layout, 'old layouts can be evicted');
});
