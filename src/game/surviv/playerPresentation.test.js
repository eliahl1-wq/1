import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWalkPose, didCompleteReload, isSameEquippedWeapon, localPresentationAim } from './playerPresentation.js';

test('walking phase follows rendered distance rather than restarting each snapshot', () => {
    let at60 = advanceWalkPose(null, 0, 0, 0), at144 = advanceWalkPose(null, 0, 0, 0);
    for (let i = 1; i <= 60; i++) at60 = advanceWalkPose(at60, i * 208 / 60, 0, 1 / 60);
    for (let i = 1; i <= 144; i++) at144 = advanceWalkPose(at144, i * 208 / 144, 0, 1 / 144);
    assert.ok(Math.abs(at60.phase - at144.phase) < 1e-10);
    assert.ok(Math.abs(at60.bob - at144.bob) < 1e-10);
    assert.ok(Math.abs(at60.bob) > .1);
    const movingAmplitude = at60.amplitude;
    for (let i = 0; i < 60; i++) advanceWalkPose(at60, 208, 0, 1 / 60);
    assert.ok(at60.amplitude < movingAmplitude * .001, 'settles smoothly after stopping');
    advanceWalkPose(at60, 1000, 1000, 1 / 60);
    assert.equal(at60.bob, 0);
});

test('reload completion and firing identity distinguish two copies of the same gun', () => {
    const previous = { weapon: 'm416', slot: 0, ammo: 2, reloading: true };
    assert.equal(didCompleteReload(previous, {...previous, ammo: 30, reloading: false}), true);
    assert.equal(didCompleteReload(previous, {...previous, slot: 1, ammo: 30, reloading: false}), false);
    assert.equal(didCompleteReload(previous, {...previous, weapon: 'm9', ammo: 15, reloading: false}), false);
    assert.equal(didCompleteReload(previous, {...previous, reloading: false}), false);
    assert.equal(isSameEquippedWeapon(previous, {...previous, slot: 1}), false);
});

test('local aim is immediate, but disabled or spectator presentation stays authoritative', () => {
    assert.equal(localPresentationAim(.3, 2.1, true), 2.1);
    assert.equal(localPresentationAim(.3, 2.1, false), .3);
    assert.equal(localPresentationAim(.3, NaN, true), .3);
});
