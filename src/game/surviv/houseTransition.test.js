import test from 'node:test';
import assert from 'node:assert/strict';
import { stabilizeHouseSelection } from './houseTransition.js';

function step(state, candidateId, previousStillValid, now) {
    return stabilizeHouseSelection({
        stableId: state.selectedId,
        pendingId: state.pendingId,
        pendingSince: state.pendingSince,
        candidateId,
        previousStillValid,
        now,
    });
}

test('one transient indoor sample cannot switch the full-screen render mode', () => {
    let state = { selectedId: null, pendingId: undefined, pendingSince: 0 };
    state = step(state, 'house-a', false, 1000);
    assert.equal(state.selectedId, null);
    state = step(state, null, false, 1025);
    assert.equal(state.selectedId, null);
    assert.equal(state.pendingId, undefined);
});

test('entry and exit require a stable classification but remain responsive', () => {
    let state = { selectedId: null, pendingId: undefined, pendingSince: 0 };
    state = step(state, 'house-a', false, 1000);
    state = step(state, 'house-a', false, 1030);
    assert.equal(state.selectedId, null);
    state = step(state, 'house-a', false, 1065);
    assert.equal(state.selectedId, 'house-a');
    assert.equal(state.committed, true);

    state = step(state, null, false, 1100);
    state = step(state, null, false, 1130);
    assert.equal(state.selectedId, 'house-a');
    state = step(state, null, false, 1165);
    assert.equal(state.selectedId, null);
    assert.equal(state.committed, true);
});

test('the current house stays selected throughout ordinary hysteresis', () => {
    const state = stabilizeHouseSelection({
        stableId: 'house-a',
        pendingId: null,
        pendingSince: 1000,
        candidateId: 'house-a',
        previousStillValid: true,
        now: 1030,
    });
    assert.equal(state.selectedId, 'house-a');
    assert.equal(state.pendingId, undefined);
});
