import test from 'node:test';
import assert from 'node:assert/strict';
import {
    adjustPlayerWheelZoom,
    nextWeaponSlot,
    PLAYER_WHEEL_ZOOM_MIN,
} from './gameWheel.js';

test('desktop game wheel zoom only moves from the existing zoom toward a small zoom-out limit', () => {
    assert.equal(adjustPlayerWheelZoom(1, -100), 1);
    assert.equal(adjustPlayerWheelZoom(1, 100), 0.96);
    let zoom = 1;
    for (let i = 0; i < 20; i++) zoom = adjustPlayerWheelZoom(zoom, 100);
    assert.equal(zoom, PLAYER_WHEEL_ZOOM_MIN);
    assert.equal(adjustPlayerWheelZoom(zoom, -100), 0.92);
});

test('Surviv mouse wheel cycles both gun slots and melee in either direction', () => {
    assert.equal(nextWeaponSlot(0, 100), 1);
    assert.equal(nextWeaponSlot(1, 100), 2);
    assert.equal(nextWeaponSlot(2, 100), 0);
    assert.equal(nextWeaponSlot(0, -100), 2);
});
