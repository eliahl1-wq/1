const FULL_ANGLE = Math.PI * 2;

/**
 * Green progress ring — same style as the cashout countdown timer.
 * Timer drains clockwise; hold-to-cashout fills counter-clockwise.
 */
export function drawCashoutProgressRing(ctx, x, y, radius, progress, opts = {}) {
    const { counterClockwise = false, pulse = false } = opts;
    const lineWidth = 5;

    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, FULL_ANGLE);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (progress <= 0) return;

    const start = -Math.PI / 2;
    const end = counterClockwise
        ? start - progress * FULL_ANGLE
        : start + progress * FULL_ANGLE;

    ctx.beginPath();
    ctx.arc(x, y, radius, start, end, counterClockwise);
    const grad = ctx.createLinearGradient(x - radius, y, x + radius, y);
    grad.addColorStop(0, '#0DBF76');
    grad.addColorStop(1, '#14F195');
    ctx.strokeStyle = grad;
    ctx.lineWidth = lineWidth;
    if (pulse) {
        ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.009) * 0.3;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
}
