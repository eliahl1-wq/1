import test from 'node:test';
import assert from 'node:assert/strict';
import { isVisibleSkinProduct, visibleSkinSelection } from './skinAvailability.js';
import { SIGNATURE_SKINS } from './signatureSkins.js';
import { SLITHER_SPECIAL_SKINS } from './slitherSpecialSkins.js';

test('temporary hidden skins stay defined but disappear from catalog and picker inputs', () => {
    assert.ok(SIGNATURE_SKINS.some(s => s.id === 'prism'));
    assert.ok(SLITHER_SPECIAL_SKINS.some(s => s.id === 'leviathan'));
    assert.deepEqual(SIGNATURE_SKINS.filter(isVisibleSkinProduct).map(s => s.id), ['farmer']);
    assert.deepEqual(SLITHER_SPECIAL_SKINS.filter(isVisibleSkinProduct).map(s => s.id), ['aurora', 'eclipse']);
    for (const id of ['prism', 'agar:prism', 'leviathan', 'slither:leviathan']) {
        assert.equal(isVisibleSkinProduct({ id }), false);
        assert.equal(visibleSkinSelection(id), '#c080ff');
    }
    assert.equal(visibleSkinSelection('farmer'), 'farmer');
});
