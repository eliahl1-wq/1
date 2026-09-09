import test from 'node:test';
import assert from 'node:assert/strict';
import { presentBRZone } from './brZonePresentation.js';
import { isBattleRoyaleAvailable, normalizeGamemodeForLobby } from '../../constants/features.js';
import { getVisibleGamemodes } from '../../constants/gamemodes.js';

test('Surviv BR is publicly selectable without enabling unfinished Agar/Slither BR', () => {
    assert.equal(isBattleRoyaleAvailable(false, 'br-surviv'), true);
    assert.equal(isBattleRoyaleAvailable(false, 'br-agar'), false);
    assert.equal(normalizeGamemodeForLobby('br-surviv'), 'br-surviv');
    assert.equal(normalizeGamemodeForLobby('br-slither'), 'slither');
    assert.ok(getVisibleGamemodes().some(mode => mode.id === 'br-surviv'));
});
test('zone presentation advances sub-tick, never overshoots, and freezes under packet loss', () => {
    const zone = { x: 0, y: 0, radius: 1000, targetX: 100, targetY: -100, targetRadius: 500, shrinking: true, endsInMs: 1000 };
    assert.deepEqual(presentBRZone(zone, 500, 500), zone);
    assert.equal(presentBRZone(zone, 500, 510).radius, 995);
    assert.equal(presentBRZone(zone, 500, 100000).radius, 875, 'at most 250ms extrapolation');
    assert.equal(presentBRZone({ ...zone, endsInMs: 10 }, 500, 800).radius, 500);
    assert.equal(presentBRZone({ ...zone, shrinking: false }, 500, 800).radius, 1000);
    assert.equal(zone.radius, 1000, 'authoritative snapshot remains untouched');
});
