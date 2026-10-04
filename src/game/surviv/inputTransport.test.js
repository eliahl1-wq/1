import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurvivInputTransport, survivInputSignature } from './inputTransport.js';

function fixture() {
    let time = 1000;
    const sent = [];
    const socket = {
        connected: true,
        io: { engine: { transport: { writable: true } } },
        emit(event, payload) { sent.push({ event, payload, reliable: true }); },
        volatile: { emit(event, payload) { sent.push({ event, payload, reliable: false }); } },
    };
    return { socket, sent, advance(ms) { time += ms; }, transport: createSurvivInputTransport({ socket, now: () => time }) };
}
const idle = { dx: 0, dy: 0, aimAngle: 0, aimDistance: 200, shooting: false, firePressId: 0 };

test('a dropped continuous state retries immediately when the transport becomes writable', () => {
    const { socket, sent, advance, transport } = fixture();
    transport.send(idle);
    socket.io.engine.transport.writable = false;
    advance(16);
    assert.equal(transport.send({ ...idle, dx: 1 }), false);
    socket.io.engine.transport.writable = true;
    advance(16);
    assert.equal(transport.send({ ...idle, dx: 1 }), true);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].payload.dx, 1);
});

test('continuous packets coalesce without building a backlog and distance-only aim changes are sent', () => {
    const { socket, sent, advance, transport } = fixture();
    transport.send(idle);
    socket.io.engine.transport.writable = false;
    for (let distance = 220; distance <= 320; distance += 20) {
        advance(16);
        transport.send({ ...idle, aimDistance: distance });
    }
    assert.equal(sent.length, 1);
    socket.io.engine.transport.writable = true;
    assert.equal(transport.send({ ...idle, aimDistance: 320 }), true);
    assert.equal(sent[1].payload.aimDistance, 320);
    assert.notEqual(survivInputSignature(idle), survivInputSignature({ ...idle, aimDistance: 321 }));
});

test('reliable stop, fire and cancellation edges survive backpressure without a redundant refresh', () => {
    const { socket, sent, transport } = fixture();
    socket.io.engine.transport.writable = false;
    assert.equal(transport.send({ ...idle, dx: 1 }, { reliable: true }), true);
    assert.equal(transport.send(idle, { reliable: true }), true);
    assert.equal(transport.send({ ...idle, cancelAction: true }, { hasAction: true }), true);
    assert.equal(transport.send(idle), false);
    assert.equal(sent.length, 3);
    assert.equal(sent.every(packet => packet.reliable), true);
});

test('keepalive, forced neutral input, reconnect reset and disconnected actions behave predictably', () => {
    const { socket, sent, advance, transport } = fixture();
    transport.send(idle);
    advance(249); assert.equal(transport.send(idle), false);
    advance(1); assert.equal(transport.send(idle), true);
    assert.equal(transport.send(idle, { reliable: true, force: true }), true);
    socket.connected = false;
    assert.equal(transport.send({ ...idle, reload: true }, { hasAction: true }), false);
    socket.connected = true; transport.reset();
    assert.equal(transport.send(idle), true);
    assert.equal(sent.length, 4);
});
