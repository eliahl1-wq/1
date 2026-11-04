// Retired preference must never leave returning players locked to 60 FPS or
// a lower-resolution surface. No recorder detection or user-facing mode remains.
try { if (typeof window !== 'undefined') window.localStorage.removeItem('game_recording_mode'); } catch {}

export function budgetedCanvasDpr({ width, height, baseDpr = 1, pixelBudget = 2_400_000 }) {
    const area = Math.max(1, (Number(width) || 1) * (Number(height) || 1));
    return Math.min(baseDpr, Math.sqrt(pixelBudget / area));
}

// Only gates paint work. Input, simulation, packets and animation clocks remain independent.
export function createGameFramePacer({ maxFps = 144, adaptive = true } = {}) {
    let last = null, lastDraw = null, targetFps = maxFps;
    let averageCost = 0, averageInterval = null;
    let overloadedAt = null, recoveredAt = null;
    return {
        get targetFps() { return targetFps; },
        recordDraw(ms) {
            if (Number.isFinite(ms) && ms >= 0 && ms < 250) averageCost += (ms - averageCost) * .1;
        },
        reset() { last = lastDraw = averageInterval = null; overloadedAt = recoveredAt = null; },
        shouldDraw(now) {
            if (last === null || now < last || now - last > 250) {
                last = lastDraw = now;
                averageInterval = overloadedAt = recoveredAt = null;
                return true;
            }
            const elapsed = now - last;
            last = now;
            if (elapsed > 1 && elapsed < 100) {
                averageInterval ??= elapsed;
                // A missed callback is not evidence of a new refresh rate on its own.
                averageInterval += (Math.min(elapsed, averageInterval * 2) - averageInterval) * .04;
            }
            if (adaptive) {
                const wanted = averageCost >= 8 ? Math.min(maxFps, 60) : targetFps;
                if (wanted < targetFps) {
                    overloadedAt ??= now;
                    recoveredAt = null;
                    if (now - overloadedAt >= 1500) { targetFps = wanted; overloadedAt = null; }
                } else {
                    overloadedAt = null;
                    const healthy = averageCost < 5;
                    if (targetFps < maxFps && healthy) {
                        recoveredAt ??= now;
                        if (now - recoveredAt >= 15_000) {
                            targetFps = maxFps;
                            recoveredAt = null;
                        }
                    } else recoveredAt = null;
                }
            }
            // Use whole display ticks (e.g. 120 Hz -> 60, not uneven 90).
            // At or below the target cadence, paint every callback. After a
            // stall paint once, without storing credit for a burst of frames.
            const interval = 1000 / targetFps;
            const refresh = averageInterval ?? interval;
            const ticks = Math.max(1, Math.round(interval / refresh + 1e-6));
            const minimumGap = ticks === 1 ? Math.min(interval, refresh) * .45 : (ticks - .3) * refresh;
            if (now - lastDraw < Math.min(minimumGap, interval * 1.12)) return false;
            lastDraw = now;
            return true;
        },
    };
}
