// Retired preference must never impose a hidden FPS cap or resolution setting.
try { if (typeof window !== 'undefined') window.localStorage.removeItem('game_recording_mode'); } catch {}

export function budgetedCanvasDpr({ width, height, baseDpr = 1, pixelBudget = 2_400_000 }) {
    const area = Math.max(1, (Number(width) || 1) * (Number(height) || 1));
    return Math.min(baseDpr, Math.sqrt(pixelBudget / area));
}

// Present through the browser compositor, not the low-latency front-buffer path
// that is allowed to tear. Main loops paint once per requestAnimationFrame,
// without a second timer or adaptive frame-skipping clock.
export function getGameCanvasContext(canvas) {
    return canvas.getContext('2d', { alpha: false, desynchronized: false });
}
