// Retired preference must never leave returning players locked to 60 FPS or
// a lower-resolution surface. No recorder detection or user-facing mode remains.
try { if (typeof window !== 'undefined') window.localStorage.removeItem('game_recording_mode'); } catch {}

export function budgetedCanvasDpr({ width, height, baseDpr = 1, pixelBudget = 2_400_000 }) {
    const area = Math.max(1, (Number(width) || 1) * (Number(height) || 1));
    return Math.min(baseDpr, Math.sqrt(pixelBudget / area));
}

// Only gates paint work. Input, simulation, packets and animation clocks remain independent.
export function createGameFramePacer({ maxFps = 144, adaptive = true } = {}) {
    let last = null, credit = 0, targetFps = maxFps;
    let averageCost = 0, averageInterval = 16.67, baselineInterval = 16.67;
    let overloadedAt = null, recoveredAt = null;
    return {
        get targetFps() { return targetFps; },
        recordDraw(ms) {
            if (Number.isFinite(ms) && ms >= 0 && ms < 250) averageCost += (ms - averageCost) * .1;
        },
        reset() { last = null; credit = 0; overloadedAt = recoveredAt = null; },
        shouldDraw(now) {
            if (last === null || now < last || now - last > 250) { last = now; credit = 0; return true; }
            const elapsed = now - last;
            last = now;
            if (elapsed > 1 && elapsed < 100) {
                averageInterval += (elapsed - averageInterval) * .04;
                baselineInterval = Math.min(baselineInterval, elapsed);
            }
            if (adaptive) {
                const slowCallbacks = averageInterval > Math.max(22, baselineInterval * 1.8);
                const wanted = averageCost >= 14 || slowCallbacks ? Math.min(maxFps, 60)
                    : averageCost >= 8 ? Math.min(maxFps, 90) : targetFps;
                if (wanted < targetFps) {
                    overloadedAt ??= now;
                    recoveredAt = null;
                    if (now - overloadedAt >= 1500) { targetFps = wanted; credit = 0; overloadedAt = null; }
                } else {
                    overloadedAt = null;
                    const healthy = averageCost < 5 && averageInterval < Math.max(18, baselineInterval * 1.3);
                    if (targetFps < maxFps && healthy) {
                        recoveredAt ??= now;
                        if (now - recoveredAt >= 15_000) {
                            targetFps = Math.min(maxFps, targetFps < 90 ? 90 : maxFps);
                            credit = 0; recoveredAt = null;
                        }
                    } else recoveredAt = null;
                }
            }
            const interval = 1000 / targetFps;
            credit = Math.min(interval * 2, credit + elapsed);
            const tolerance = Math.min(2, interval * .12);
            if (credit < interval - tolerance) return false;
            credit -= interval;
            return true;
        },
    };
}
