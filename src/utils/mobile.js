/**
 * Touch / mobile detection shared by the games so in-game layout, controls and
 * the landscape gate all agree on what "mobile" means.
 */
export function isTouchDevice() {
    if (typeof window === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    return !!coarse || 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}

/** Retina backing-store scale for mobile canvas, capped by total GPU pixels. */
export function getMobileCanvasDpr(width, height, maxDpr = 2) {
    if (typeof window === 'undefined') return 1;
    const safeWidth = Number(width) || window.innerWidth;
    const safeHeight = Number(height) || window.innerHeight;
    const pixelBudget = 3_200_000;
    const budgetDpr = Math.sqrt(pixelBudget / Math.max(1, safeWidth * safeHeight));
    return Math.max(1, Math.min(maxDpr, window.devicePixelRatio || 1, budgetDpr));
}
