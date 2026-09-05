import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestAirdropTimers, ingestExplosionEvents } from './worldEvents.js';

test('explosions are delivered once even when repeated or out-of-order snapshots arrive', () => {
    const seen = new Map();
    const effects = [];
    const spawn = (...args) => effects.push(args);
    const event = { id: 'a', x: 1, y: 2, radius: 155, kind: 'barrel', ageMs: 30 };
    ingestExplosionEvents([event], seen, 1000, spawn);
    ingestExplosionEvents([{ ...event, ageMs: 150 }], seen, 1120, spawn);
    ingestExplosionEvents([event], seen, 1150, spawn);
    assert.equal(effects.length, 1);
    assert.deepEqual(effects[0], [1, 2, { radius: 155, kind: 'barrel', ageMs: 30 }]);
});

test('stale effects do not replay and deduplication memory is bounded', () => {
    const seen = new Map();
    let count = 0;
    ingestExplosionEvents([{ id: 'old', x: 0, y: 0, ageMs: 800 }], seen, 1000, () => count++);
    assert.equal(count, 0);
    const events = Array.from({ length: 400 }, (_, i) => ({ id: `e${i}`, x: 0, y: 0 }));
    ingestExplosionEvents(events, seen, 1100, () => count++);
    assert.equal(seen.size, 256);
    ingestExplosionEvents([], seen, 12000, () => count++);
    assert.equal(seen.size, 0);
});

test('airdrop descent uses relative server time and is not jittered by packet arrival time', () => {
    const drop = { id: 'a', state: 'incoming', landsAt: 100, remainingMs: 7000 };
    const first = ingestAirdropTimers([drop], [], 900000);
    assert.equal(first[0].localLandsAt, 907000);
    const next = ingestAirdropTimers([{ ...drop, remainingMs: 6600 }], first, 900550);
    assert.equal(next[0].localLandsAt, 907000);
    assert.deepEqual(ingestAirdropTimers([], next, 901000), []);
});
