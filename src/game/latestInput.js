// Continuous steering coalesces to the latest sample; control edges can still
// travel reliably. A rejected volatile write must never become the last sent state.
export function createLatestInputSender({ socket, event, signature, edge = () => '', heartbeatMs = 100, minimumIntervalMs = 16, now = () => performance.now() }) {
    let lastSignature = null;
    let lastEdge = null;
    let lastSentAt = -Infinity;
    return {
        reset() { lastSignature = null; lastEdge = null; lastSentAt = -Infinity; },
        send(payload, { reliable = false, force = false } = {}) {
            if (!socket.connected) return false;
            const key = signature(payload);
            const control = edge(payload);
            const at = now();
            const controlChanged = lastEdge !== null && control !== lastEdge;
            const mustDeliver = reliable || controlChanged;
            if (!force && !mustDeliver && key === lastSignature && at - lastSentAt < heartbeatMs) return false;
            if (!force && !mustDeliver && at - lastSentAt < minimumIntervalMs) return false;
            const engine = socket.io?.engine;
            if (!mustDeliver && (engine?.transport?.writable === false || engine?.writeBuffer?.length > 0)) return false;
            (mustDeliver ? socket : socket.volatile).emit(event, payload);
            lastSignature = key;
            lastEdge = control;
            lastSentAt = at;
            return true;
        },
    };
}

export const agarInputSignature = payload => [payload.x, payload.y, payload.screenWidth, payload.screenHeight]
    .map(value => Math.round(Number(value) || 0)).join(':');
export const slitherInputSignature = payload => [Math.round(payload.dx * 1000), Math.round(payload.dy * 1000), !!payload.boost].join(':');
