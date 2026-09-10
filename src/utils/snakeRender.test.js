import test from 'node:test';
import assert from 'node:assert/strict';
import { getSnakeSegmentCanvas, snakeSegmentCache } from './snakeRender.js';
import { getSignatureSkin, SIGNATURE_SKINS } from '../constants/signatureSkins.js';
import { drawSlitherSpecialBody, drawSlitherSpecialDetails } from '../constants/slitherSpecialSkins.js';

test('Leviathan retains default segment opacity, shaded volume and bounded material caching', () => {
    const originalDocument = globalThis.document;
    globalThis.document = { createElement() {
        const canvas = {};
        canvas.getContext = () => ({
            createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
            putImageData: image => { canvas.pixels = image.data; },
        });
        return canvas;
    } };
    try {
        snakeSegmentCache.clear();
        const base = getSnakeSegmentCanvas(24, '#123b43', true);
        const dragon = getSnakeSegmentCanvas(24, '#123b43', true, 'leviathan');
        assert.notEqual(base, dragon);
        assert.equal(getSnakeSegmentCanvas(24, '#123b43', true, 'leviathan'), dragon);
        const colors = new Set();
        for (let i = 0; i < base.pixels.length; i += 4) {
            assert.equal(dragon.pixels[i + 3], base.pixels[i + 3], 'same round antialiased boundary');
            if (dragon.pixels[i + 3] === 255) colors.add(Array.from(dragon.pixels.slice(i, i + 3)).join(','));
        }
        assert.ok(colors.size > 100, 'multiple pigments and lighting within each segment');
        const green = (x, y) => dragon.pixels[(y * 48 + x) * 4 + 1];
        assert.ok(green(24, 24) > green(24, 45), 'center remains brighter than flank');
        for (let i = 0; i < 520; i++) getSnakeSegmentCanvas(2, `#${i.toString(16).padStart(6, '0')}`, true, 'leviathan');
        assert.ok(snakeSegmentCache.size <= 512);
    } finally {
        snakeSegmentCache.clear();
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }
});

test('Leviathan does not flatten segments with opaque body-path artwork', () => {
    const ctx = { save() {}, restore() {} };
    const points = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 0 }];
    // Deliberately no path painting methods: cruising must only use segment textures.
    drawSlitherSpecialBody(ctx, 'leviathan', points, 12);
    drawSlitherSpecialDetails(ctx, 'leviathan', points, 12);
});

test('Farmer replaces the retired product and normalizes saved Warden selections', () => {
    assert.equal(SIGNATURE_SKINS.some(skin => skin.id === 'warden'), false);
    assert.equal(getSignatureSkin('warden'), getSignatureSkin('farmer'));
    assert.equal(getSignatureSkin('surviv:warden').productId, 'surviv:farmer');
    assert.equal(getSignatureSkin('farmer').gameMode, 'surviv');
});
