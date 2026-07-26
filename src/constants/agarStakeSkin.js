export const AGARSTAKE_SKIN_ID = 'agarstake';
export const AGARSTAKE_SKIN_VALUE = 'agarstake';
export const AGARSTAKE_SKIN_PRODUCT_ID = 'slither:agarstake';
export const AGARSTAKE_CHARM_URL = '/agarstake-charm.png';

export const AGARSTAKE_SKIN_COLORS = Object.freeze([
    '#302a35',
    '#8f2fff',
]);

export function getAgarStakePatternIndex(segmentIndex) {
    return Math.floor(Math.max(0, segmentIndex) / 6) % AGARSTAKE_SKIN_COLORS.length;
}

let charmImage = null;
const AGARSTAKE_ROPE_JOINTS = 8;

export function getAgarStakeCharmImage() {
    if (charmImage || typeof Image === 'undefined') return charmImage;
    charmImage = new Image();
    charmImage.decoding = 'async';
    charmImage.src = AGARSTAKE_CHARM_URL;
    return charmImage;
}

function createRopePoint() {
    return { x: 0, y: 0, previousX: 0, previousY: 0 };
}

export function createAgarStakeCharmState() {
    return {
        initialized: false,
        points: Array.from({ length: AGARSTAKE_ROPE_JOINTS }, createRopePoint),
        anchorX: 0,
        anchorY: 0,
        lastTime: 0,
        radius: 0,
    };
}

function resetCharmState(state, anchorX, anchorY, backwardX, backwardY, radius, segmentLength, now) {
    if (!Array.isArray(state.points) || state.points.length !== AGARSTAKE_ROPE_JOINTS) {
        state.points = Array.from({ length: AGARSTAKE_ROPE_JOINTS }, createRopePoint);
    }
    for (let index = 0; index < state.points.length; index += 1) {
        const point = state.points[index];
        const distance = segmentLength * (index + 1);
        point.x = anchorX + backwardX * distance;
        point.y = anchorY + backwardY * distance;
        point.previousX = point.x;
        point.previousY = point.y;
    }
    state.initialized = true;
    state.anchorX = anchorX;
    state.anchorY = anchorY;
    state.lastTime = now;
    state.radius = radius;
}

function constrainRope(points, anchorX, anchorY, segmentLength) {
    for (let iteration = 0; iteration < 12; iteration += 1) {
        for (let index = 0; index < points.length; index += 1) {
            const point = points[index];
            const previous = index === 0 ? null : points[index - 1];
            const startX = previous ? previous.x : anchorX;
            const startY = previous ? previous.y : anchorY;
            const dx = point.x - startX;
            const dy = point.y - startY;
            const distance = Math.hypot(dx, dy) || 1;
            const correction = (distance - segmentLength) / distance;

            if (!previous) {
                point.x -= dx * correction;
                point.y -= dy * correction;
            } else {
                const correctionX = dx * correction * 0.5;
                const correctionY = dy * correction * 0.5;
                previous.x += correctionX;
                previous.y += correctionY;
                point.x -= correctionX;
                point.y -= correctionY;
            }
        }
    }
}

function updateCharmState(state, anchorX, anchorY, backwardX, backwardY, radius, segmentLength, now) {
    const anchorDeltaX = anchorX - state.anchorX;
    const anchorDeltaY = anchorY - state.anchorY;
    const jumpedTooFar = anchorDeltaX * anchorDeltaX + anchorDeltaY * anchorDeltaY > (radius * 8) ** 2;
    const scaleChanged = Math.abs(state.radius - radius) > Math.max(2, radius * 0.35);

    if (!state.initialized || jumpedTooFar || scaleChanged) {
        resetCharmState(state, anchorX, anchorY, backwardX, backwardY, radius, segmentLength, now);
        return;
    }

    const frameScale = Math.max(0.45, Math.min(1.8, (now - state.lastTime) / 16.667 || 1));
    const damping = Math.pow(0.9, frameScale);
    const straightening = 1 - Math.pow(0.968, frameScale);

    for (let index = 0; index < state.points.length; index += 1) {
        const point = state.points[index];

        // Compensate for camera/body translation while retaining turn inertia.
        point.x += anchorDeltaX;
        point.y += anchorDeltaY;
        point.previousX += anchorDeltaX;
        point.previousY += anchorDeltaY;

        const velocityX = (point.x - point.previousX) * damping;
        const velocityY = (point.y - point.previousY) * damping;
        const currentX = point.x;
        const currentY = point.y;
        const restingDistance = segmentLength * (index + 1);
        const restingX = anchorX + backwardX * restingDistance;
        const restingY = anchorY + backwardY * restingDistance;
        const pointSpring = straightening * (0.42 + index * 0.12);

        point.x += velocityX + (restingX - point.x) * pointSpring;
        point.y += velocityY + (restingY - point.y) * pointSpring;
        point.previousX = currentX;
        point.previousY = currentY;
    }

    constrainRope(state.points, anchorX, anchorY, segmentLength);
    state.anchorX = anchorX;
    state.anchorY = anchorY;
    state.lastTime = now;
    state.radius = radius;
}

function traceRope(ctx, anchorX, anchorY, points) {
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    if (points.length === 1) {
        ctx.lineTo(points[0].x, points[0].y);
        return;
    }

    for (let index = 0; index < points.length - 1; index += 1) {
        const point = points[index];
        const next = points[index + 1];
        const midpointX = (point.x + next.x) * 0.5;
        const midpointY = (point.y + next.y) * 0.5;
        ctx.quadraticCurveTo(point.x, point.y, midpointX, midpointY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
}

export function drawAgarStakeCharm(
    ctx,
    image,
    headX,
    headY,
    radius,
    angle,
    phase = 0,
    physicsState = null,
    now = 0,
) {
    if (!ctx || !Number.isFinite(radius) || radius <= 0) return;

    const forwardX = Math.cos(angle);
    const forwardY = Math.sin(angle);
    const backwardX = -forwardX;
    const backwardY = -forwardY;
    const anchorX = headX - forwardX * radius * 0.18;
    const anchorY = headY - forwardY * radius * 0.18;
    const ropeLength = radius * 3.05;
    const segmentLength = ropeLength / AGARSTAKE_ROPE_JOINTS;
    const charmRadius = Math.max(5, radius * 0.72);
    const state = physicsState || createAgarStakeCharmState();
    const timestamp = Number.isFinite(now) && now > 0 ? now : phase * 1000;

    updateCharmState(
        state,
        anchorX,
        anchorY,
        backwardX,
        backwardY,
        radius,
        segmentLength,
        timestamp,
    );

    const charmPoint = state.points[state.points.length - 1];
    const charmX = charmPoint.x;
    const charmY = charmPoint.y;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Four physical rope joints form one smooth cord that bends naturally on turns.
    traceRope(ctx, anchorX, anchorY, state.points);
    ctx.lineWidth = Math.max(2.15, radius * 0.19);
    ctx.strokeStyle = 'rgba(9, 7, 12, 0.96)';
    ctx.stroke();

    traceRope(ctx, anchorX, anchorY, state.points);
    ctx.lineWidth = Math.max(0.85, radius * 0.07);
    ctx.strokeStyle = 'rgba(164, 83, 255, 0.92)';
    ctx.stroke();

    ctx.shadowColor = 'rgba(139, 72, 255, 0.46)';
    ctx.shadowBlur = radius * 0.4;
    ctx.beginPath();
    ctx.arc(charmX, charmY, charmRadius + Math.max(1.3, radius * 0.1), 0, Math.PI * 2);
    ctx.fillStyle = '#15111a';
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.beginPath();
    ctx.arc(charmX, charmY, charmRadius, 0, Math.PI * 2);
    ctx.clip();
    if (image?.complete && image.naturalWidth > 0) {
        ctx.drawImage(
            image,
            charmX - charmRadius,
            charmY - charmRadius,
            charmRadius * 2,
            charmRadius * 2,
        );
    } else {
        const fallback = ctx.createRadialGradient(
            charmX - charmRadius * 0.3,
            charmY - charmRadius * 0.35,
            charmRadius * 0.1,
            charmX,
            charmY,
            charmRadius,
        );
        fallback.addColorStop(0, '#8f2fff');
        fallback.addColorStop(1, '#302a35');
        ctx.fillStyle = fallback;
        ctx.fillRect(charmX - charmRadius, charmY - charmRadius, charmRadius * 2, charmRadius * 2);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(charmX, charmY, charmRadius, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.1, radius * 0.1);
    ctx.strokeStyle = '#9438ff';
    ctx.stroke();
    ctx.restore();
}
