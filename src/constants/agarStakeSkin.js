export const AGARSTAKE_SKIN_ID = 'agarstake';
export const AGARSTAKE_SKIN_VALUE = 'agarstake';
export const AGARSTAKE_SKIN_PRODUCT_ID = 'slither:agarstake';
export const AGARSTAKE_CHARM_URL = '/agarstake-charm.png';

export const AGARSTAKE_SKIN_COLORS = Object.freeze([
    '#030205',
    '#8f2fff',
]);

export function getAgarStakePatternIndex(segmentIndex) {
    return Math.floor(Math.max(0, segmentIndex) / 6) % AGARSTAKE_SKIN_COLORS.length;
}

let charmImage = null;

export function getAgarStakeCharmImage() {
    if (charmImage || typeof Image === 'undefined') return charmImage;
    charmImage = new Image();
    charmImage.decoding = 'async';
    charmImage.src = AGARSTAKE_CHARM_URL;
    return charmImage;
}

export function createAgarStakeCharmState() {
    return {
        initialized: false,
        x: 0,
        y: 0,
        previousX: 0,
        previousY: 0,
        anchorX: 0,
        anchorY: 0,
        lastTime: 0,
        radius: 0,
    };
}

function resetCharmState(state, anchorX, anchorY, targetX, targetY, radius, now) {
    state.initialized = true;
    state.x = targetX;
    state.y = targetY;
    state.previousX = targetX;
    state.previousY = targetY;
    state.anchorX = anchorX;
    state.anchorY = anchorY;
    state.lastTime = now;
    state.radius = radius;
}

function updateCharmState(state, anchorX, anchorY, targetX, targetY, radius, ropeLength, now) {
    const jumpX = anchorX - state.anchorX;
    const jumpY = anchorY - state.anchorY;
    const jumpedTooFar = jumpX * jumpX + jumpY * jumpY > (radius * 8) ** 2;
    const scaleChanged = Math.abs(state.radius - radius) > Math.max(2, radius * 0.35);

    if (!state.initialized || jumpedTooFar || scaleChanged) {
        resetCharmState(state, anchorX, anchorY, targetX, targetY, radius, now);
        return;
    }

    // Move the whole pendulum with the snake/camera while retaining its angular inertia.
    state.x += jumpX;
    state.y += jumpY;
    state.previousX += jumpX;
    state.previousY += jumpY;

    const frameScale = Math.max(0.45, Math.min(1.8, (now - state.lastTime) / 16.667 || 1));
    const velocityX = (state.x - state.previousX) * Math.pow(0.88, frameScale);
    const velocityY = (state.y - state.previousY) * Math.pow(0.88, frameScale);
    const spring = 1 - Math.pow(0.935, frameScale);

    const currentX = state.x;
    const currentY = state.y;
    state.x += velocityX + (targetX - state.x) * spring;
    state.y += velocityY + (targetY - state.y) * spring;
    state.previousX = currentX;
    state.previousY = currentY;

    const ropeX = state.x - anchorX;
    const ropeY = state.y - anchorY;
    const distance = Math.hypot(ropeX, ropeY) || 1;
    const minimumLength = ropeLength * 0.72;
    const constrainedLength = Math.max(minimumLength, Math.min(ropeLength, distance));
    state.x = anchorX + ropeX / distance * constrainedLength;
    state.y = anchorY + ropeY / distance * constrainedLength;

    state.anchorX = anchorX;
    state.anchorY = anchorY;
    state.lastTime = now;
    state.radius = radius;
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
    const sideX = Math.sin(angle);
    const sideY = -Math.cos(angle);
    const anchorX = headX - forwardX * radius * 0.34 + sideX * radius * 0.72;
    const anchorY = headY - forwardY * radius * 0.34 + sideY * radius * 0.72;
    const ropeLength = radius * 2.65;
    const looseDistance = ropeLength * 0.82;
    const sway = Math.sin(phase * 0.62) * 0.14;
    const desiredX = -forwardX * (0.68 + sway) + sideX * 0.74;
    const desiredY = -forwardY * (0.68 + sway) + sideY * 0.74;
    const desiredLength = Math.hypot(desiredX, desiredY) || 1;
    const targetX = anchorX + desiredX / desiredLength * looseDistance;
    const targetY = anchorY + desiredY / desiredLength * looseDistance;
    const charmRadius = Math.max(5, radius * 0.72);
    const state = physicsState || createAgarStakeCharmState();
    const timestamp = Number.isFinite(now) && now > 0 ? now : phase * 1000;

    updateCharmState(state, anchorX, anchorY, targetX, targetY, radius, ropeLength, timestamp);

    const charmX = state.x;
    const charmY = state.y;
    const chordX = charmX - anchorX;
    const chordY = charmY - anchorY;
    const chordLength = Math.hypot(chordX, chordY) || 1;
    const normalX = -chordY / chordLength;
    const normalY = chordX / chordLength;
    const velocityX = charmX - state.previousX;
    const velocityY = charmY - state.previousY;
    const bendDirection = Math.sign(velocityX * normalX + velocityY * normalY) || 1;
    const slack = Math.max(radius * 0.26, (ropeLength - chordLength) * 0.78);
    const controlX = (anchorX + charmX) * 0.5 + normalX * slack * bendDirection;
    const controlY = (anchorY + charmY) * 0.5 + normalY * slack * bendDirection;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';

    // The dark outer cord and thin purple thread make the rope readable on every arena.
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.quadraticCurveTo(controlX, controlY, charmX, charmY);
    ctx.lineWidth = Math.max(2.2, radius * 0.2);
    ctx.strokeStyle = 'rgba(3, 2, 6, 0.96)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.quadraticCurveTo(controlX, controlY, charmX, charmY);
    ctx.lineWidth = Math.max(0.9, radius * 0.075);
    ctx.strokeStyle = 'rgba(157, 73, 255, 0.92)';
    ctx.stroke();

    ctx.shadowColor = 'rgba(139, 72, 255, 0.48)';
    ctx.shadowBlur = radius * 0.42;
    ctx.beginPath();
    ctx.arc(charmX, charmY, charmRadius + Math.max(1.3, radius * 0.1), 0, Math.PI * 2);
    ctx.fillStyle = '#050308';
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
        fallback.addColorStop(1, '#030205');
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
