import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestInputSender, slitherInputSignature } from './latestInput.js';

function fixture() {
    let at = 0;
    const writes = [];
    const socket = { connected: true, io: { engine: { transport: { writable: true }, writeBuffer: [] } },
        emit: (_, payload) => writes.push({ payload, reliable: true }),
        volatile: { emit: (_, payload) => writes.push({ payload, reliable: false }) } };
    const sender = createLatestInputSender({ socket, event: 'slitherInput', signature: slitherInputSignature,
        edge: payload => payload.boost, now: () => at });
    return { socket, writes, sender, advance(ms) { at += ms; } };
}
const input = { dx: 1, dy: 0, boost: false };

test('busy transport retries the latest steering without queuing stale pointer samples', () => {
    const { socket, writes, sender, advance } = fixture();
    assert.equal(sender.send(input), true);
    socket.io.engine.transport.writable = false;
    for (let i = 1; i <= 100; i++) { advance(1); sender.send({ ...input, dy: i }); }
    assert.equal(writes.length, 1);
    socket.io.engine.transport.writable = true;
    assert.equal(sender.send({ ...input, dy: 100 }), true);
    assert.equal(writes.at(-1).payload.dy, 100);
});

test('boost release is reliable even when released during backpressure', () => {
    const { socket, writes, sender } = fixture();
    sender.send(input);
    socket.io.engine.transport.writable = false;
    assert.equal(sender.send({ ...input, boost: true }), true);
    assert.equal(sender.send(input), true);
    assert.equal(writes.slice(1).every(write => write.reliable), true);
});

test('pointer bursts respect the rate ceiling, heartbeat and reconnect reset', () => {
    const { writes, sender, advance } = fixture();
    for (let i = 0; i < 1000; i++) { sender.send({ ...input, dy: i }); advance(1); }
    assert.ok(writes.length <= 63);
    advance(100);
    assert.equal(sender.send(writes.at(-1).payload), true);
    sender.reset();
    assert.equal(sender.send(input), true);
});
