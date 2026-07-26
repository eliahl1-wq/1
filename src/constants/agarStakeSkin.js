export const AGARSTAKE_SKIN_ID = 'agarstake';
export const AGARSTAKE_SKIN_VALUE = 'agarstake';
export const AGARSTAKE_SKIN_PRODUCT_ID = 'slither:agarstake';
export const AGARSTAKE_CHARM_URL = '/agarstake-charm.png';

export const AGARSTAKE_SKIN_COLORS = Object.freeze([
    '#09070f',
    '#171020',
    '#7c3aff',
    '#b13cff',
]);

let charmImage = null;

export function getAgarStakeCharmImage() {
    if (charmImage || typeof Image === 'undefined') return charmImage;
    charmImage = new Image();
    charmImage.decoding = 'async';
    charmImage.src = AGARSTAKE_CHARM_URL;
    return charmImage;
}

export function drawAgarStakeCharm(ctx, image, headX, headY, radius, angle, phase = 0) {
    if (!ctx || !Number.isFinite(radius) || radius <= 0) return;

    const forwardX = Math.cos(angle);
    const forwardY = Math.sin(angle);
    const sideX = Math.sin(angle);
    const sideY = -Math.cos(angle);
    const swing = Math.sin(phase) * radius * 0.24;
    const anchorX = headX - forwardX * radius * 0.2 + sideX * radius * 0.52;
    const anchorY = headY - forwardY * radius * 0.2 + sideY * radius * 0.52;
    const charmX = headX - forwardX * radius * 1.5 + sideX * radius * 1.55 + sideX * swing;
    const charmY = headY - forwardY * radius * 1.5 + sideY * radius * 1.55 + sideY * swing;
    const controlX = (anchorX + charmX) / 2 - forwardX * radius * 0.25;
    const controlY = (anchorY + charmY) / 2 - forwardY * radius * 0.25;
    const charmRadius = Math.max(5, radius * 0.78);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.quadraticCurveTo(controlX, controlY, charmX, charmY);
    ctx.lineWidth = Math.max(2.4, radius * 0.23);
    ctx.strokeStyle = 'rgba(4, 3, 8, 0.94)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.quadraticCurveTo(controlX, controlY, charmX, charmY);
    ctx.lineWidth = Math.max(1.1, radius * 0.09);
    ctx.strokeStyle = '#9b4dff';
    ctx.stroke();

    ctx.shadowColor = 'rgba(139, 72, 255, 0.62)';
    ctx.shadowBlur = radius * 0.52;
    ctx.beginPath();
    ctx.arc(charmX, charmY, charmRadius + Math.max(1.5, radius * 0.12), 0, Math.PI * 2);
    ctx.fillStyle = '#08060e';
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
        fallback.addColorStop(0, '#7c3aff');
        fallback.addColorStop(1, '#09070f');
        ctx.fillStyle = fallback;
        ctx.fillRect(charmX - charmRadius, charmY - charmRadius, charmRadius * 2, charmRadius * 2);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(charmX, charmY, charmRadius, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.2, radius * 0.12);
    ctx.strokeStyle = '#9c4dff';
    ctx.stroke();
    ctx.restore();
}
