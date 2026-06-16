/**
 * Static canvas previews for gamemode cards — mirrors in-game visuals at a glance.
 */

import { drawFood, drawOrganicCell } from '../game/agar/render.js';
import { drawCashoutProgressRing } from '../game/cashoutRing.js';
import { drawBalanceBadge } from '../game/balanceBadge.js';

const FULL = Math.PI * 2;
const LOOSE_BORDERS = { left: -9999, right: 9999, top: -9999, bottom: 9999 };

function parseColor(hex) {
    const h = (hex || '#787878').replace('#', '');
    if (h.length === 3) {
        return {
            r: parseInt(h[0] + h[0], 16),
            g: parseInt(h[1] + h[1], 16),
            b: parseInt(h[2] + h[2], 16),
        };
    }
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

function rgb({ r, g, b }, a = 1) {
    return `rgba(${r},${g},${b},${a})`;
}

function toHex({ r, g, b }) {
    return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function shadeColor({ r, g, b }, amount) {
    return {
        r: Math.max(0, Math.min(255, r + amount)),
        g: Math.max(0, Math.min(255, g + amount)),
        b: Math.max(0, Math.min(255, b + amount)),
    };
}

function drawAgarGrid(ctx, W, H) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    const step = H / 18;
    for (let x = 0; x <= W; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
}

function drawAgarCell(ctx, cell) {
    ctx.fillStyle = cell.color;
    ctx.strokeStyle = cell.borderColor || '#000';
    ctx.lineWidth = 4;
    ctx.shadowBlur = cell.isMe ? 15 : 10;
    ctx.shadowColor = cell.color;
    drawOrganicCell(cell, LOOSE_BORDERS, ctx);
    ctx.shadowBlur = 0;

    if (cell.isMe && cell.radius >= 18) {
        const nameY = cell.y - cell.radius * 0.1;
        drawBalanceBadge(ctx, cell.x, nameY + 14, cell.balance ?? 12.5, true);
        drawCashoutProgressRing(ctx, cell.x, cell.y, cell.radius + 8, 0.55, { counterClockwise: true });
    }
}

function drawAgarPreview(ctx, W, H, { battleRoyale = false } = {}) {
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, W, H);
    drawAgarGrid(ctx, W, H);

    if (battleRoyale) {
        const zx = W * 0.52;
        const zy = H * 0.5;
        const zr = Math.min(W, H) * 0.34;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 59, 48, 0.14)';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(zx, zy, zr, 0, FULL, true);
        ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 7]);
        ctx.beginPath();
        ctx.arc(zx, zy, zr, 0, FULL);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    const foods = [
        { x: W * 0.18, y: H * 0.28, hue: 120, radius: 4 },
        { x: W * 0.72, y: H * 0.22, hue: 280, radius: 4 },
        { x: W * 0.35, y: H * 0.78, hue: 45, radius: 4 },
        { x: W * 0.82, y: H * 0.68, hue: 200, radius: 4 },
        { x: W * 0.55, y: H * 0.35, hue: 15, radius: 4, golden: true },
    ];
    for (const f of foods) {
        drawFood({ x: f.x, y: f.y }, f, ctx);
    }

    drawAgarCell(ctx, {
        x: W * 0.28, y: H * 0.55, radius: 28,
        color: 'hsl(210, 100%, 55%)', borderColor: 'hsl(210, 100%, 38%)',
        vX: 2, vY: -1,
    });
    drawAgarCell(ctx, {
        x: W * 0.68, y: H * 0.58, radius: 36,
        color: 'hsl(330, 100%, 58%)', borderColor: 'hsl(330, 100%, 40%)',
        vX: -1.5, vY: 1,
    });
    if (!battleRoyale) {
        drawAgarCell(ctx, {
            x: W * 0.5, y: H * 0.42, radius: 42,
            color: 'hsl(145, 100%, 50%)', borderColor: 'hsl(145, 100%, 35%)',
            vX: 0.5, vY: 2, isMe: true, balance: 18.75,
        });
    } else {
        drawAgarCell(ctx, {
            x: W * 0.5, y: H * 0.42, radius: 38,
            color: 'hsl(145, 100%, 50%)', borderColor: 'hsl(145, 100%, 35%)',
            vX: 0.5, vY: 2,
        });
    }
}

function drawSlitherTilePattern(ctx, W, H) {
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, W, H);

    const step = 22;
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let y = 0; y < H + step; y += step) {
        for (let x = ((y / step) % 2) * (step / 2); x < W + step; x += step) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, FULL);
            ctx.fill();
        }
    }
}

function drawSlitherPlayFill(ctx, W, H, arena) {
    const pad = 14;
    const cx = W / 2;
    const cy = H / 2;

    if (arena === 'square') {
        const left = pad;
        const top = pad;
        const w = W - pad * 2;
        const h = H - pad * 2;
        ctx.save();
        ctx.fillStyle = 'rgba(72, 4, 9, 0.96)';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.rect(left, top, w, h);
        ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(255, 45, 45, 0.28)';
        ctx.lineWidth = 8;
        ctx.strokeRect(left, top, w, h);
        ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(left, top, w, h);
        ctx.restore();
        return { cx, cy, radius: Math.min(w, h) / 2 };
    }

    const radius = Math.min(W, H) * 0.42;
    ctx.save();
    ctx.fillStyle = 'rgba(72, 4, 9, 0.96)';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, radius, 0, FULL, true);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, FULL);
    ctx.stroke();
    ctx.restore();
    return { cx, cy, radius };
}

function drawSlitherZone(ctx, W, H, cx, cy, radius, { shrinking = false } = {}) {
    ctx.save();
    ctx.fillStyle = 'rgba(72, 4, 9, 0.9)';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, radius, 0, FULL, true);
    ctx.fill('evenodd');
    ctx.strokeStyle = shrinking ? 'rgba(255, 85, 85, 0.95)' : 'rgba(255, 85, 85, 0.85)';
    ctx.lineWidth = shrinking ? 3 : 2.5;
    if (shrinking) ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, FULL);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function paintSnakeSegment(ctx, x, y, r, hex, phase = 0) {
    const col = parseColor(hex);
    const centerCol = shadeColor(col, 18);
    const midCol = col;
    const edgeCol = shadeColor(col, -28);
    const grad = ctx.createRadialGradient(x - r * 0.22, y - r * 0.22, 0, x, y, r);
    grad.addColorStop(0, toHex(centerCol));
    grad.addColorStop(0.6, toHex(midCol));
    grad.addColorStop(1, toHex(edgeCol));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, FULL);
    ctx.fill();

    const hiCol = shadeColor(col, 40);
    const hiGrad = ctx.createLinearGradient(x, y - r, x, y + r);
    hiGrad.addColorStop(phase ? 0.07 : 0.05, 'rgba(255,255,255,0)');
    hiGrad.addColorStop(phase ? 0.16 : 0.13, rgb(hiCol, 0.22));
    hiGrad.addColorStop(phase ? 0.28 : 0.25, rgb(hiCol, 0.04));
    ctx.fillStyle = hiGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, FULL);
    ctx.fill();
}

function drawSnakePath(ctx, points, radius, color) {
    for (let i = points.length - 1; i >= 0; i--) {
        const t = i / Math.max(1, points.length - 1);
        const r = radius * (0.72 + 0.28 * t);
        paintSnakeSegment(ctx, points[i].x, points[i].y, r, color, i % 2);
    }

    const head = points[0];
    const next = points[1] || head;
    const angle = Math.atan2(head.y - next.y, head.x - next.x);
    const eyeOffset = radius * 0.38;
    const eyeR = Math.max(2, radius * 0.22);
    for (const side of [-1, 1]) {
        const ex = head.x + Math.cos(angle + side * 0.85) * eyeOffset;
        const ey = head.y + Math.sin(angle + side * 0.85) * eyeOffset;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, FULL);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(ex + Math.cos(angle) * eyeR * 0.35, ey + Math.sin(angle) * eyeR * 0.35, eyeR * 0.45, 0, FULL);
        ctx.fill();
    }
}

function sampleSnakePath(startX, startY, angle, length, count) {
    const pts = [];
    let x = startX;
    let y = startY;
    let a = angle;
    for (let i = 0; i < count; i++) {
        pts.push({ x, y });
        a += Math.sin(i * 0.55) * 0.18;
        x += Math.cos(a) * length;
        y += Math.sin(a) * length;
    }
    return pts;
}

function drawSlitherFood(ctx, x, y, r, hue, golden = false) {
    const halo = golden ? r * 2.4 : r * 1.6;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, halo);
    if (golden) {
        grad.addColorStop(0, 'hsla(55, 100%, 100%, 1)');
        grad.addColorStop(0.35, 'hsla(48, 100%, 62%, 0.95)');
        grad.addColorStop(1, 'hsla(40, 100%, 45%, 0)');
    } else {
        grad.addColorStop(0, `hsla(${hue}, 100%, 88%, 0.95)`);
        grad.addColorStop(0.4, `hsla(${hue}, 100%, 58%, 0.75)`);
        grad.addColorStop(1, `hsla(${hue}, 100%, 45%, 0)`);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, halo, 0, FULL);
    ctx.fill();
}

function drawSlitherPreview(ctx, W, H, opts = {}) {
    const {
        arena = 'square',
        zone = null,
        showCashout = false,
    } = opts;

    drawSlitherTilePattern(ctx, W, H);
    const arenaInfo = drawSlitherPlayFill(ctx, W, H, arena);

    if (zone) {
        drawSlitherZone(ctx, W, H, zone.cx ?? arenaInfo.cx, zone.cy ?? arenaInfo.cy, zone.radius, zone);
    }

    drawSlitherFood(ctx, W * 0.22, H * 0.3, 5, 120);
    drawSlitherFood(ctx, W * 0.78, H * 0.25, 4, 280);
    drawSlitherFood(ctx, W * 0.62, H * 0.72, 4.5, 35, true);
    drawSlitherFood(ctx, W * 0.35, H * 0.78, 4, 200);

    drawSnakePath(
        ctx,
        sampleSnakePath(W * 0.62, H * 0.48, Math.PI * 0.85, 9, 14),
        7,
        '#7ec8f0',
    );
    drawSnakePath(
        ctx,
        sampleSnakePath(W * 0.38, H * 0.62, Math.PI * 0.15, 8, 12),
        6,
        '#f08ec8',
    );

    const youPts = sampleSnakePath(W * 0.48, H * 0.38, Math.PI * 1.05, 10, 16);
    drawSnakePath(ctx, youPts, 8, '#8ef0a8');

    if (showCashout && youPts[0]) {
        const head = youPts[0];
        drawBalanceBadge(ctx, head.x, head.y + 14, 14.5, true);
        drawCashoutProgressRing(ctx, head.x, head.y, 14, 0.45, { counterClockwise: true });
    }
}

const DRAWERS = {
    agar: (ctx, W, H) => drawAgarPreview(ctx, W, H),
    'br-agar': (ctx, W, H) => drawAgarPreview(ctx, W, H, { battleRoyale: true }),
    slither: (ctx, W, H) => drawSlitherPreview(ctx, W, H, { arena: 'square', showCashout: true }),
    'competitive-slither': (ctx, W, H) => drawSlitherPreview(ctx, W, H, {
        arena: 'circle',
        zone: { radius: Math.min(W, H) * 0.28, shrinking: true },
        showCashout: true,
    }),
    'br-slither': (ctx, W, H) => drawSlitherPreview(ctx, W, H, {
        arena: 'square',
        zone: { cx: W * 0.5, cy: H * 0.5, radius: Math.min(W, H) * 0.3 },
    }),
};

export function drawGamemodePreview(ctx, W, H, mode) {
    const draw = DRAWERS[mode] || DRAWERS.agar;
    const zoom = 1.12;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
    draw(ctx, W, H);
    ctx.restore();
}
