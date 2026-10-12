import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSlitherTick } from './snapshotProtocol.js';

test('compact wire data preserves every segment, skin, cashout and growth field exactly', () => {
    const packed = { you: 'p', snakes: [{ id: 'p', color: 'flags:se', sct: 100, radius: 9,
        cashoutHoldActive: true, cashoutHoldStartedAt: 123, segmentPositions: [10.1, -20.2, 8.3, -19.4, 7, -18] }] };
    const decoded = decodeSlitherTick(packed);
    assert.deepEqual(decoded.snakes[0].segments, [{ x: 10.1, y: -20.2 }, { x: 8.3, y: -19.4 }, { x: 7, y: -18 }]);
    assert.equal(decoded.snakes[0].sct, 100);
    assert.equal(decoded.snakes[0].cashoutHoldStartedAt, 123);
    assert.equal(decoded.snakes[0].color, 'flags:se');
    assert.equal('segments' in packed.snakes[0], false, 'wire input remains immutable');
    assert.equal(decodeSlitherTick(decoded), decoded, 'legacy and already decoded snapshots are zero-copy');
});
