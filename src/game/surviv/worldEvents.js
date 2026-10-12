// Snapshot effects use server ids and relative ages, never synchronized clocks.
export function confirmedContactTrace(event, alreadyVisible) {
    if (alreadyVisible || !(event.ageMs < 65) || !Number.isFinite(event.fromX)
        || !Number.isFinite(event.fromY)) return null;
    const length = Math.hypot(event.x - event.fromX, event.y - event.fromY);
    if (!(length > .5 && length <= 180)) return null;
    return { x: event.x, y: event.y, vx: 0, vy: 0,
        angle: Math.atan2(event.y - event.fromY, event.x - event.fromX),
        contactLength: length, weaponType: event.weaponType, life: (65 - event.ageMs) / 1000 };
}

export function ingestCombatEvents(events, seen, receivedAt, shot, impact) {
    for (const [id, seenAt] of seen) {
        if (receivedAt - seenAt > 2000) seen.delete(id);
    }
    const latestShots = new Map();
    for (const event of Array.isArray(events) ? events : []) {
        if (!event?.id || seen.has(event.id)
            || !Number.isFinite(event.x) || !Number.isFinite(event.y)
            || !Number.isFinite(event.angle)) continue;
        seen.set(event.id, receivedAt);
        const ageMs = Math.max(0, Number(event.ageMs) || 0);
        if (event.type === 'shot' && ageMs < 180) {
            const previous = latestShots.get(event.ownerId);
            if (!previous || ageMs < previous.ageMs) latestShots.set(event.ownerId, { ...event, ageMs });
        } else if (event.type === 'impact' && ageMs < 280) {
            impact({ ...event, ageMs });
        }
    }
    // Never replay a burst of old reports together after a delayed snapshot.
    for (const event of latestShots.values()) shot(event);
    while (seen.size > 384) seen.delete(seen.keys().next().value);
}

export function ingestExplosionEvents(events, seen, receivedAt, spawn) {
    for (const [id, seenAt] of seen) {
        if (receivedAt - seenAt > 10000) seen.delete(id);
    }
    for (const event of Array.isArray(events) ? events : []) {
        if (!event?.id || seen.has(event.id)) continue;
        if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) continue;
        seen.set(event.id, receivedAt);
        const ageMs = Math.max(0, Number(event.ageMs) || 0);
        if (ageMs >= 760) continue;
        spawn(event.x, event.y, {
            kind: event.kind === 'barrel' ? 'barrel' : 'grenade',
            radius: Math.min(250, Math.max(20, Number(event.radius) || 145)),
            ageMs,
        });
    }
    while (seen.size > 256) seen.delete(seen.keys().next().value);
}

export function ingestAirdropTimers(drops, previous, receivedAt) {
    return (Array.isArray(drops) ? drops : []).map(drop => {
        const known = previous.find(item => item.id === drop.id);
        const remaining = Number.isFinite(drop.remainingMs)
            ? drop.remainingMs : Math.max(0, Number(drop.landsAt) - receivedAt);
        return { ...drop, localLandsAt: known?.localLandsAt ?? receivedAt + Math.max(0, remaining || 0) };
    });
}
