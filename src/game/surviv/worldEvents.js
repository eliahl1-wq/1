// Snapshot effects use server ids and relative ages, never synchronized clocks.
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
