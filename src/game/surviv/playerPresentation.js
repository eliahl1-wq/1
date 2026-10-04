export function advanceWalkPose(state, x, y, dt) {
    const seconds = Math.max(0, Math.min(Number(dt) || 0, .05));
    if (!state) return { x, y, phase: 0, amplitude: 0, bob: 0 };
    const distance = Math.hypot(x - state.x, y - state.y);
    state.x = x;
    state.y = y;
    // Teleports/rejoins are not walking steps. The same travelled distance
    // advances the same pose at 60, 120 and 144 Hz; snapshots never reset it.
    if (distance > 40) { state.amplitude = 0; state.bob = 0; return state; }
    // A restrained left/right cycle covers roughly two ordinary footsteps.
    state.phase = (state.phase + distance * .05) % (Math.PI * 2);
    const targetAmplitude = seconds > 0 ? Math.min(1, distance / seconds / 180) : 0;
    state.amplitude += (targetAmplitude - state.amplitude) * (1 - Math.exp(-seconds * 14));
    state.bob = Math.sin(state.phase) * state.amplitude;
    return state;
}

export function isSameEquippedWeapon(previous, next) {
    return previous.weapon === next.weapon && previous.slot === next.slot;
}

export function didCompleteReload(previous, next) {
    return previous.reloading && !next.reloading && isSameEquippedWeapon(previous, next)
        && Number(next.ammo) > Number(previous.ammo);
}

export function localPresentationAim(serverAngle, inputAngle, canAimLocally) {
    return canAimLocally && Number.isFinite(inputAngle) ? inputAngle : serverAngle;
}
