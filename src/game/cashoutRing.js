const FULL_ANGLE = Math.PI * 2;

/** Hold Q / cashout button duration before cashout is submitted. */
export const CASHOUT_HOLD_MS = 3000;

/** Brand purple — matches --accent / cashout button styling. */
export const CASHOUT_RING_COLOR = '#785eff';

/** Smooth frame-based progress from a wall-clock end timestamp. */
export function getCashoutRingProgress(endAtMs, totalSeconds) {
    if (!endAtMs || !totalSeconds) return 0;
    const remainingSec = Math.max(0, endAtMs - Date.now()) / 1000;
    return remainingSec / totalSeconds;
}

/**
 * Purple progress ring for the three-second hold-to-cashout gesture.
 * Timer drains clockwise; hold-to-cashout fills counter-clockwise.
 */
export function drawCashoutProgressRing(ctx, x, y, radius, progress, opts = {}) {
    const { counterClockwise = false, showTrack = true, lineWidth = 3.5 } = opts;

    if (progress <= 0) return;

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.lineCap = 'round';

    if (showTrack) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, FULL_ANGLE);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    const start = -Math.PI / 2;
    const end = counterClockwise
        ? start - progress * FULL_ANGLE
        : start + progress * FULL_ANGLE;

    ctx.beginPath();
    ctx.arc(x, y, radius, start, end, counterClockwise);
    ctx.strokeStyle = CASHOUT_RING_COLOR;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
}
