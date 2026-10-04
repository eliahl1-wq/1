const numberOrZero = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function survivInputSignature(payload) {
    return [
        Math.round(numberOrZero(payload.dx) * 1000),
        Math.round(numberOrZero(payload.dy) * 1000),
        Math.round(numberOrZero(payload.aimAngle) * 1000),
        // Throw distance can change without changing the aim angle.
        Math.round(numberOrZero(payload.aimDistance)),
        payload.shooting ? 1 : 0,
        numberOrZero(payload.firePressId),
    ].join(':');
}

// Aim/motion refreshes should coalesce under transport backpressure, while
// control edges and one-shot actions must not be discarded. Socket.IO's
// volatile emit silently drops packets when its transport is not writable;
// only remember a continuous state after it can actually enter the transport.
export function createSurvivInputTransport({ socket, now = () => performance.now(), heartbeatMs = 250 }) {
    let lastSignature = '';
    let lastSentAt = -Infinity;

    return {
        reset() {
            lastSignature = '';
            lastSentAt = -Infinity;
        },
        send(payload, { reliable = false, hasAction = false, force = false } = {}) {
            if (!socket.connected) return false;
            const signature = survivInputSignature(payload);
            const sentAt = now();
            if (!force && !hasAction && signature === lastSignature && sentAt - lastSentAt < heartbeatMs) return false;
            if (!reliable && !hasAction && !socket.io?.engine?.transport?.writable) return false;

            if (reliable || hasAction) socket.emit('survivInput', payload);
            else socket.volatile.emit('survivInput', payload);
            lastSignature = signature;
            lastSentAt = sentAt;
            return true;
        },
    };
}
