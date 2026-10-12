import test from 'node:test';
import assert from 'node:assert/strict';
import { AgarPresentation } from './presentation.js';
const player = (x, cells = [{ id: 'cell', x, y: 50, radius: 20, balance: 10 }]) => ({ id: 'me', x, y: 50, dollarBalance: 2, cells });

test('40 Hz snapshots produce intermediate positions at display refresh without changing authority', () => {
    const presentation = new AgarPresentation();
    const original = player(100);
    presentation.update([original], 1000);
    presentation.update([player(120)], 1025);
    const halfway = presentation.sample(1037.5)[0];
    assert.equal(halfway.x, 110);
    assert.equal(halfway.cells[0].x, 110);
    assert.equal(halfway.dollarBalance, 2);
    assert.equal(original.cells[0].x, 100, 'authoritative snapshot is never mutated');
    assert.equal(presentation.sample(1200)[0].x, 120, 'no invented movement during a network stall');
});

test('split, removal, teleport and a fresh session do not interpolate across unrelated entities', () => {
    const presentation = new AgarPresentation();
    presentation.update([player(100)], 1000);
    presentation.update([player(2000)], 1025);
    assert.equal(presentation.sample(1025)[0].cells[0].x, 2000);
    presentation.update([player(2000, [{ id: 'split', x: 2010, y: 50, radius: 12, balance: 5 }])], 1050);
    assert.equal(presentation.sample(1050)[0].cells[0].id, 'split');
    assert.equal(presentation.players.get('me').cells.size, 1);
    presentation.update([], 1075);
    assert.equal(presentation.players.size, 0);
    presentation.reset();
    assert.equal(presentation.visible.length, 0);
});
