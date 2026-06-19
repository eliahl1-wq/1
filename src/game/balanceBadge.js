/**
 * In-world balance pill — crisp purple outline for local player, muted for others.
 */

const ME = {
    fill: 'rgba(14, 13, 22, 0.96)',
    stroke: '#785eff',
    strokeInner: 'rgba(255, 255, 255, 0.06)',
    strokeWidth: 1.5,
    amountColor: '#ffffff',
    unitColor: 'rgba(255, 255, 255, 0.48)',
    radius: 7,
};

const OTHER = {
    fill: 'rgba(10, 10, 16, 0.9)',
    stroke: 'rgba(255, 255, 255, 0.2)',
    strokeInner: null,
    strokeWidth: 1,
    amountColor: 'rgba(255, 255, 255, 0.92)',
    unitColor: 'rgba(255, 255, 255, 0.35)',
    radius: 7,
};

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} centerX
 * @param {number} topY
 * @param {number} balance
 * @param {boolean} isMe
 */
export function drawBalanceBadge(ctx, centerX, topY, balance, isMe) {
    const theme = isMe ? ME : OTHER;
    const amount = (balance || 0).toFixed(2);
    const amountFont = 13;
    const unitFont = 10;
    const gap = 3;

    ctx.save();
    ctx.font = `800 ${amountFont}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const amountW = ctx.measureText(amount).width;
    ctx.font = `600 ${unitFont}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const unitW = ctx.measureText('$').width;

    const padX = 10;
    const pillW = Math.ceil(unitW + gap + amountW + padX * 2);
    const pillH = amountFont + 10;
    const pillX = Math.round(centerX - pillW / 2);
    const pillY = Math.round(topY);
    const r = theme.radius;

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, r);
    ctx.fillStyle = theme.fill;
    ctx.fill();

    if (theme.strokeInner) {
        ctx.beginPath();
        ctx.roundRect(pillX + 1, pillY + 1, pillW - 2, pillH - 2, Math.max(0, r - 1));
        ctx.strokeStyle = theme.strokeInner;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, r);
    ctx.strokeStyle = theme.stroke;
    ctx.lineWidth = theme.strokeWidth;
    ctx.stroke();

    const midY = pillY + pillH / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.font = `600 ${unitFont}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillStyle = theme.unitColor;
    ctx.fillText('$', pillX + padX, midY);

    ctx.font = `800 ${amountFont}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillStyle = theme.amountColor;
    ctx.fillText(amount, pillX + padX + unitW + gap, midY);

    ctx.textAlign = 'center';
    ctx.restore();
}
