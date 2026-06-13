const FULL_ANGLE = Math.PI * 2;

/**
 * Green progress ring — same style as the cashout countdown timer.
 * Timer drains clockwise; hold-to-cashout fills counter-clockwise.
 */
export function drawCashoutProgressRing(ctx, x, y, radius, progress, opts = {}) {
    const { counterClockwise = false, pulse = false, showTrack = true } = opts;
    const lineWidth = 3.5;

    if (progress <= 0) return;

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
    ctx.strokeStyle = '#14F195';
    ctx.lineWidth = lineWidth;
    if (pulse) {
        ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.009) * 0.3;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
}
