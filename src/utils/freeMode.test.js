import test from 'node:test';
import assert from 'node:assert/strict';
import { getFreeModeEntryFee } from './freeMode.js';

test('free mode mirrors the server fixed economy tiers', () => {
    assert.equal(getFreeModeEntryFee('agar'), 10);
    assert.equal(getFreeModeEntryFee('slither'), 10);
    assert.equal(getFreeModeEntryFee('surviv'), 5);
    assert.equal(getFreeModeEntryFee('competitive-slither'), 5);
});
