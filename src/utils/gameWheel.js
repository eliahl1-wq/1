export const PLAYER_WHEEL_ZOOM_MIN = 0.88;
export const PLAYER_WHEEL_ZOOM_MAX = 1;
export const PLAYER_WHEEL_ZOOM_STEP = 0.04;

export function adjustPlayerWheelZoom(current, deltaY) {
    const value = Number.isFinite(current) ? current : PLAYER_WHEEL_ZOOM_MAX;
    if (!Number.isFinite(deltaY) || deltaY === 0) {
        return Math.max(PLAYER_WHEEL_ZOOM_MIN, Math.min(PLAYER_WHEEL_ZOOM_MAX, value));
    }
    const next = value + (deltaY < 0 ? PLAYER_WHEEL_ZOOM_STEP : -PLAYER_WHEEL_ZOOM_STEP);
    return Math.max(PLAYER_WHEEL_ZOOM_MIN, Math.min(PLAYER_WHEEL_ZOOM_MAX, Number(next.toFixed(2))));
}

export function nextWeaponSlot(currentSlot, deltaY, slotCount = 3) {
    const count = Math.max(1, Math.floor(slotCount));
    const current = Number.isInteger(currentSlot) ? currentSlot : count - 1;
    const direction = deltaY < 0 ? -1 : 1;
    return (current + direction + count) % count;
}
