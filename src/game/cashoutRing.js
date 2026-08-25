const FULL_ANGLE = Math.PI * 2;

/** Hold Q / cashout button duration before cashout is submitted. */
export const CASHOUT_HOLD_MS = 3000;

/** Server-side bot exit countdown. */
export const BOT_CASHOUT_MS = 3000;

/** Brand purple — matches --accent / cashout button styling. */
export const CASHOUT_RING_COLOR = '#785eff';

/** Smooth frame-based progress from a wall-clock end timestamp. */
export function getCashoutRingProgress(endAtMs, totalSeconds) {
    if (!endAtMs || !totalSeconds) return 0;
    const remainingSec = Math.max(0, endAtMs - Date.now()) / 1000;
    return remainingSec / totalSeconds;
}

/**
 * Progress visible to other clients. Players broadcast the start of their
 * Q-hold, while bots broadcast the end of their server-side exit countdown.
 */
export function getRemoteCashoutRingProgress(entity, nowMs = Date.now()) {
    if (entity?.cashoutHoldActive && Number.isFinite(entity.cashoutHoldStartedAt)) {
        return Math.min(1, Math.max(0, (nowMs - entity.cashoutHoldStartedAt) / CASHOUT_HOLD_MS));
    }

    if (entity?.isCashingOut && Number.isFinite(entity.cashOutEndTime) && entity.cashOutEndTime > nowMs) {
        return Math.min(1, Math.max(0, 1 - ((entity.cashOutEndTime - nowMs) / BOT_CASHOUT_MS)));
    }

    return null;
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
