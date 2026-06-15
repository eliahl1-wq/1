/**
 * slither.io-style circular minimap — bottom-left, mobile-scaled.
 */

import { isTouchDevice } from '../utils/mobile.js';

const DESKTOP_SIZE = 132;
const MOBILE_SIZE = 76;
const MARGIN_DESKTOP = 14;
const MARGIN_MOBILE = 8;

function parseColor(color) {
    if (!color) return '#7acc7a';
    if (typeof color === 'object' && color !== null) color = color.fill || color.border || '#7acc7a';
    if (typeof color !== 'string') return '#7acc7a';
    const h = color.replace('#', '');
    if (h.length === 3) {
        return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    }
    return h.length >= 6 ? `#${h.slice(0, 6)}` : '#7acc7a';
}

function worldCenter(bounds) {
    return {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
    };
}

function worldSpan(bounds) {
    return Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {number} opts.screenW
 * @param {number} opts.screenH
 * @param {{ minX: number, maxX: number, minY: number, maxY: number }} opts.bounds
 * @param {number} opts.cameraX
 * @param {number} opts.cameraY
 * @param {number} opts.viewHalfW
 * @param {number} opts.viewHalfH
 * @param {Array<{ x: number, y: number, color?: string, c?: string, isYou?: boolean, you?: boolean }>} opts.dots
 * @param {{ cx: number, cy: number, radius: number } | null} [opts.zone]
 * @param {boolean} [opts.isMobile]
 */
export function drawGameMinimap(ctx, opts) {
    const {
        screenW,
        screenH,
        bounds,
        cameraX,
        cameraY,
        viewHalfW,
        viewHalfH,
        dots = [],
        zone = null,
    } = opts;

    if (!bounds || !screenW || !screenH) return;

    const isMobile = opts.isMobile ?? isTouchDevice();
    const size = isMobile ? MOBILE_SIZE : DESKTOP_SIZE;
    const margin = isMobile ? MARGIN_MOBILE : MARGIN_DESKTOP;
    const mapPad = isMobile ? 0.86 : 0.84;

    const cx = margin + size / 2;
    const cy = screenH - margin - size / 2;
    const radius = size / 2;
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;
    const scale = (size * mapPad) / Math.max(worldW, worldH);
    const wc = worldCenter(bounds);

    const toMini = (wx, wy) => ({
        x: cx + (wx - wc.x) * scale,
        y: cy + (wy - wc.y) * scale,
    });

    ctx.save();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // slither.io dark purple fill
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    bg.addColorStop(0, 'rgba(28, 22, 42, 0.94)');
    bg.addColorStop(1, 'rgba(12, 10, 20, 0.96)');
    ctx.fillStyle = bg;
    ctx.fillRect(cx - radius, cy - radius, size, size);

    // subtle dot grid
    const gridStep = isMobile ? 14 : 18;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    const gridLeft = cx - radius;
    const gridTop = cy - radius;
    for (let gx = gridLeft; gx <= cx + radius; gx += gridStep) {
        for (let gy = gridTop; gy <= cy + radius; gy += gridStep) {
            const dx = gx - cx;
            const dy = gy - cy;
            if (dx * dx + dy * dy <= radius * radius) {
                ctx.fillRect(gx, gy, 1, 1);
            }
        }
    }

    // world border (red danger zone)
    const tl = toMini(bounds.minX, bounds.minY);
    const br = toMini(bounds.maxX, bounds.maxY);
    const mapX = Math.min(tl.x, br.x);
    const mapY = Math.min(tl.y, br.y);
    const mapW = Math.abs(br.x - tl.x);
    const mapH = Math.abs(br.y - tl.y);

    ctx.strokeStyle = 'rgba(210, 45, 45, 0.92)';
    ctx.lineWidth = isMobile ? 1.1 : 1.6;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // BR safe zone
    if (zone?.radius > 0) {
        const zc = toMini(zone.cx, zone.cy);
        ctx.beginPath();
        ctx.arc(zc.x, zc.y, zone.radius * scale, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.75)';
        ctx.lineWidth = isMobile ? 1 : 1.4;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // viewport rectangle
    if (cameraX != null && cameraY != null && viewHalfW > 0 && viewHalfH > 0) {
        const vtl = toMini(cameraX - viewHalfW, cameraY - viewHalfH);
        const vbr = toMini(cameraX + viewHalfW, cameraY + viewHalfH);
        const vx = Math.min(vtl.x, vbr.x);
        const vy = Math.min(vtl.y, vbr.y);
        const vw = Math.abs(vbr.x - vtl.x);
        const vh = Math.abs(vbr.y - vtl.y);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(vx, vy, vw, vh);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(vx + 0.5, vy + 0.5, vw - 1, vh - 1);
    }

    // other players
    const otherR = isMobile ? 1.6 : 2.2;
    for (const dot of dots) {
        const isYou = dot.isYou || dot.you;
        if (isYou || dot.x == null || dot.y == null) continue;
        const p = toMini(dot.x, dot.y);
        ctx.fillStyle = parseColor(dot.color || dot.c);
        ctx.beginPath();
        ctx.arc(p.x, p.y, otherR, 0, Math.PI * 2);
        ctx.fill();
    }

    // your position — bright white dot
    for (const dot of dots) {
        const isYou = dot.isYou || dot.you;
        if (!isYou || dot.x == null || dot.y == null) continue;
        const p = toMini(dot.x, dot.y);
        const meR = isMobile ? 2.6 : 3.2;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.75)';
        ctx.shadowBlur = isMobile ? 3 : 5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, meR, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
    }

    ctx.restore();

    // outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = isMobile ? 1.4 : 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

/** Normalize server minimap payload to draw dots. */
export function normalizeMinimapDots(raw, fallback = []) {
    if (Array.isArray(raw) && raw.length > 0) {
        return raw.map(d => ({
            x: d.x,
            y: d.y,
            color: d.c || d.color,
            isYou: !!(d.you || d.isYou),
        }));
    }
    return fallback;
}
