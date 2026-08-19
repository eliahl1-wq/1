export function slitherCanvasDpr({ width, height, rawDpr = 1, isMobile = false, quality = 1 }) {
    const safeArea = Math.max(1, (Number(width) || 1) * (Number(height) || 1));
    const pixelBudget = isMobile ? 2_400_000 : 2_800_000;
    const budgetDpr = Math.sqrt(pixelBudget / safeArea);
    const qualityScale = quality <= 0.64 ? 0.82 : quality <= 0.8 ? 0.9 : 1;
    const base = isMobile
        ? Math.max(1, Math.min(2, rawDpr || 1, budgetDpr))
        : Math.max(0.68, Math.min(1.35, rawDpr || 1, budgetDpr));
    return base * qualityScale;
}

export function slitherQualityForFrameTime(currentQuality, averageFrameMs) {
    if (averageFrameMs >= 27) return 0.6;
    if (averageFrameMs >= 21) return Math.min(currentQuality, 0.72);
    if (averageFrameMs >= 18) return Math.min(currentQuality, 0.84);
    if (averageFrameMs <= 17.1) return 1;
    return currentQuality;
}
