import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedContactTrace, ingestAirdropTimers, ingestCombatEvents, ingestExplosionEvents } from './worldEvents.js';

test('a between-snapshot hit draws only its confirmed segment, never a guessed projectile through cover',()=>{
    const event={x:40,y:10,fromX:20,fromY:10,angle:0,ageMs:10,weaponType:'m9'};
    const trace=confirmedContactTrace(event,false);
    assert.equal(trace.x,40); assert.equal(trace.contactLength,20); assert.equal(trace.vx,0); assert.equal(trace.vy,0);
    assert.equal(confirmedContactTrace(event,true),null);
    assert.equal(confirmedContactTrace({...event,ageMs:100},false),null);
    assert.equal(confirmedContactTrace({...event,fromX:NaN},false),null);
    assert.equal(confirmedContactTrace({...event,fromX:-500},false),null);
});

test('combat effects dedupe exact contacts and coalesce delayed shots without creating burst reports', () => {
    const seen = new Map(), shots = [], impacts = [];
    const event = (id, type, ownerId, ageMs = 0) => ({ id, type, ownerId, ageMs, x: 20, y: 5, angle: 0 });
    const batch = [event('a','shot','me',120),event('b','shot','me',20),event('c','shot','other',30),
        event('d','impact','me',20),event('expired','shot','me',250),event('invalid','impact','me')];
    batch.at(-1).x = NaN;
    ingestCombatEvents(batch,seen,1000,e=>shots.push(e),e=>impacts.push(e));
    assert.deepEqual(shots.map(e=>e.id),['b','c']); assert.deepEqual(impacts.map(e=>e.id),['d']);
    ingestCombatEvents(batch,seen,1100,e=>shots.push(e),e=>impacts.push(e));
    assert.equal(shots.length,2); assert.equal(impacts.length,1);
});

test('combat event deduplication is bounded and clears idle history', () => {
    const seen = new Map();
    ingestCombatEvents(Array.from({length:600},(_,i)=>({id:`s${i}`,type:'impact',x:0,y:0,angle:0,ageMs:350})),seen,1000,()=>{},()=>{});
    assert.equal(seen.size,384); ingestCombatEvents([],seen,4000,()=>{},()=>{}); assert.equal(seen.size,0);
});

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
