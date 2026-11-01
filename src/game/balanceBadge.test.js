import test from 'node:test';
import assert from 'node:assert/strict';
import { drawBalanceBadge } from './balanceBadge.js';

function makeContext() {
    const text = [];
    const widths = [];
    const ctx = {
        save() {}, restore() {}, beginPath() {}, fill() {}, stroke() {},
        roundRect(x, y, width) { widths.push(width); },
        measureText(value) { return { width: value.length * 8 }; },
        fillText(value, x, y) { text.push({ value, x, y, color: this.fillStyle }); },
    };
    return { ctx, text, widths };
}

for (const isMe of [true, false]) {
    test(`USD badge separates muted dollar from unchanged amount (local=${isMe})`, () => {
        const { ctx, text, widths } = makeContext();
        drawBalanceBadge(ctx, 100, 20, 2, isMe, { currency: 'USD' });
        assert.deepEqual(text.map(item => item.value), ['$', '2.00']);
        assert.equal(text[0].color, isMe ? 'rgba(255, 255, 255, 0.48)' : 'rgba(255, 255, 255, 0.35)');
        assert.equal(text[1].color, isMe ? '#ffffff' : 'rgba(255, 255, 255, 0.92)');
        assert.equal(text[1].x - text[0].x, 8);
        assert.equal(text[1].y, text[0].y);
        assert.equal(widths[0], 60);
    });
}

test('SOL badge keeps its amount and does not draw a dollar', () => {
    const { ctx, text } = makeContext();
    drawBalanceBadge(ctx, 100, 20, 2, true, { currency: 'SOL', solPrice: 100 });
    assert.deepEqual(text.map(item => item.value), ['0.02']);
    assert.equal(text[0].color, '#ffffff');
});
