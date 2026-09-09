// Extrapolate the authoritative linear shrink only between nearby snapshots.
// Clamped prediction freezes safely during packet loss and never overshoots.
export function presentBRZone(zone, receivedAt, now) {
    if (!zone?.shrinking || !(zone.endsInMs > 0)) return zone;
    const fraction = Math.min(1, Math.max(0, Math.min(250, now - receivedAt)) / zone.endsInMs);
    return { ...zone,
        x: zone.x + (zone.targetX - zone.x) * fraction,
        y: zone.y + (zone.targetY - zone.y) * fraction,
        radius: zone.radius + (zone.targetRadius - zone.radius) * fraction,
    };
}
