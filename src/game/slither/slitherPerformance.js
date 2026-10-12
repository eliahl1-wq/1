export function slitherCanvasDpr({ width, height, rawDpr = 1, isMobile = false, quality = 1 }) {
    const safeArea = Math.max(1, (Number(width) || 1) * (Number(height) || 1));
    const pixelBudget = isMobile ? 2_400_000 : 2_800_000;
    const budgetDpr = Math.sqrt(pixelBudget / safeArea);
    const qualityScale = quality <= 0.64 ? 0.82 : quality <= 0.8 ? 0.9 : 1;
    const base = isMobile
        ? Math.max(1, Math.min(2, rawDpr || 1, budgetDpr))
        : Math.max(0.68, Math.min(1.35, rawDpr || 1, budgetDpr));
    return Math.min(budgetDpr, base * qualityScale);
}

export function slitherQualityForFrameTime(currentQuality, averageFrameMs) {
    if (averageFrameMs >= 27) return 0.6;
    if (averageFrameMs >= 21) return Math.min(currentQuality, 0.72);
    if (averageFrameMs >= 18) return Math.min(currentQuality, 0.84);
    if (averageFrameMs <= 17.1) return 1;
    return currentQuality;
}

// A short capture/fullscreen hitch must not repeatedly rebuild the canvas and
// all effect textures. Reduce cosmetic work after sustained load, then wait for
// a long stable recovery. Simulation and backing resolution stay unchanged.
export function createSlitherQualityGovernor() {
    let quality = 1;
    let average = 16.67;
    let overloadedMs = 0;
    let recoveredMs = 0;
    return {
        update(frameMs) {
            if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 100) return quality;
            average += (frameMs - average) * 0.06;
            const target = slitherQualityForFrameTime(quality, average);
            overloadedMs = target < quality ? overloadedMs + frameMs : 0;
            recoveredMs = target > quality ? recoveredMs + frameMs : 0;
            if (overloadedMs >= 1500) { quality = target; overloadedMs = 0; recoveredMs = 0; }
            else if (recoveredMs >= 8000) { quality = target; overloadedMs = 0; recoveredMs = 0; }
            return quality;
        },
    };
}
