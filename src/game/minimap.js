/**
 * Local radar minimap — larger than screen view, not the full world.
 * Enemies: red blinking dots. Off-map threats tint the rim red.
 */

import { isTouchDevice } from '../utils/mobile.js';

const DESKTOP_SIZE = 132;
const MOBILE_SIZE = 76;
const MARGIN_DESKTOP = 14;
const MARGIN_MOBILE = 8;
const RANGE_MULT_DESKTOP = 3.35;
const RANGE_MULT_MOBILE = 2.8;
const THREAT_MULT = 1.55;
const EDGE_BUCKETS = 40;

export function getMinimapHalfRange(viewHalfW, viewHalfH, isMobile) {
    const mult = isMobile ? RANGE_MULT_MOBILE : RANGE_MULT_DESKTOP;
    return Math.max(viewHalfW, viewHalfH) * mult;
}

function inRange(x, y, cx, cy, range) {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= range * range;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 */
export function drawGameMinimap(ctx, opts) {
    const {
        screenW,
        screenH,
        centerX,
        centerY,
        viewHalfW,
        viewHalfH,
        players = [],
        food = [],
        viruses = [],
        ejected = [],
        obstacles = [],
        zone = null,
        time = performance.now(),
    } = opts;

    if (centerX == null || centerY == null || !screenW || !screenH) return;

    const isMobile = opts.isMobile ?? isTouchDevice();
    const size = isMobile ? MOBILE_SIZE : DESKTOP_SIZE;
    const margin = isMobile ? MARGIN_MOBILE : MARGIN_DESKTOP;

    const cx = margin + size / 2;
    const cy = margin + size / 2;
    const radius = size / 2;
    const mapPad = isMobile ? 0.88 : 0.86;

    const halfRange = getMinimapHalfRange(viewHalfW, viewHalfH, isMobile);
    const threatRange = halfRange * THREAT_MULT;
    const scale = (radius * mapPad * 2) / (halfRange * 2);

    const toMini = (wx, wy) => ({
        x: cx + (wx - centerX) * scale,
        y: cy + (wy - centerY) * scale,
    });

    const blink = 0.5 + 0.5 * Math.sin(time * 0.009);
    const enemyList = players.filter(p => !(p.isYou || p.you) && p.x != null && p.y != null);
    const enemies = enemyList.length > 48
        ? enemyList
            .map(e => ({
                e,
                d: (e.x - centerX) ** 2 + (e.y - centerY) ** 2,
            }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 48)
            .map(({ e }) => e)
        : enemyList;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    bg.addColorStop(0, 'rgba(28, 22, 42, 0.94)');
    bg.addColorStop(1, 'rgba(12, 10, 20, 0.96)');
    ctx.fillStyle = bg;
    ctx.fillRect(cx - radius, cy - radius, size, size);

    const gridStep = isMobile ? 14 : 18;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let gx = cx - radius; gx <= cx + radius; gx += gridStep) {
        for (let gy = cy - radius; gy <= cy + radius; gy += gridStep) {
            const dx = gx - cx;
            const dy = gy - cy;
            if (dx * dx + dy * dy <= radius * radius) {
                ctx.fillRect(gx, gy, 1, 1);
            }
        }
    }

    const obstacleFill = (o) => {
        if (o.kind === 'houseFloor' && o.variant === 'ironworks') return 'rgba(72, 98, 107, 0.95)';
        if (o.kind === 'houseFloor') return 'rgba(196, 169, 117, 0.72)';
        if (o.kind === 'wall' || o.kind === 'interiorWall') return 'rgba(38, 31, 24, 0.9)';
        if (o.kind === 'road') return 'rgba(120, 113, 95, 0.42)';
        if (o.kind === 'water') return 'rgba(72, 128, 150, 0.58)';
        if (o.kind === 'container') return 'rgba(99, 119, 126, 0.62)';
        return null;
    };

    const maxObstacles = isMobile ? 80 : 160;
    let obstacleDrawn = 0;
    for (const o of obstacles) {
        if (obstacleDrawn >= maxObstacles) break;
        if (!o || o.x == null || o.y == null || !o.w || !o.h) continue;
        if (Math.abs(o.x - centerX) > halfRange + o.w / 2 || Math.abs(o.y - centerY) > halfRange + o.h / 2) continue;
        const fill = obstacleFill(o);
        if (!fill) continue;
        const p = toMini(o.x, o.y);
        const mw = Math.max(1, o.w * scale);
        const mh = Math.max(1, o.h * scale);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(o.rotation || 0);
        ctx.fillStyle = fill;
        if (o.kind === 'wall' || o.kind === 'interiorWall') {
            ctx.fillRect(-mw / 2, -mh / 2, mw, mh);
        } else if (o.kind === 'water') {
            ctx.beginPath();
            ctx.ellipse(0, 0, mw / 2, mh / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(-mw / 2, -mh / 2, mw, mh);
        }
        if (o.kind === 'houseFloor' && o.variant === 'ironworks') {
            ctx.strokeStyle = 'rgba(239, 181, 55, 0.95)';
            ctx.lineWidth = isMobile ? 1.2 : 1.8;
            ctx.strokeRect(-mw / 2, -mh / 2, mw, mh);
        }
        ctx.restore();
        obstacleDrawn++;
    }

    // BR zone edge when it crosses the local radar
    if (zone?.radius > 0) {
        const zc = toMini(zone.cx, zone.cy);
        const zr = zone.radius * scale;
        ctx.beginPath();
        ctx.arc(zc.x, zc.y, zr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.55)';
        ctx.lineWidth = isMobile ? 1 : 1.3;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // food pellets
    const foodR = isMobile ? 0.9 : 1.1;
    let foodDrawn = 0;
    const maxFoodDots = isMobile ? 50 : 80;
    for (const f of food) {
        if (foodDrawn >= maxFoodDots) break;
        if (f.x == null || f.y == null) continue;
        if (!inRange(f.x, f.y, centerX, centerY, halfRange)) continue;
        const p = toMini(f.x, f.y);
        if (f.golden || f.g) {
            ctx.fillStyle = `rgba(255, 210, 60, ${0.75 + blink * 0.2})`;
        } else if (f.hue != null || f.h != null) {
            const hue = f.hue ?? f.h;
            ctx.fillStyle = `hsla(${hue}, 70%, 58%, 0.55)`;
        } else {
            ctx.fillStyle = 'rgba(180, 185, 200, 0.45)';
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, foodR, 0, Math.PI * 2);
        ctx.fill();
        foodDrawn++;
    }

    // ejected mass
    const ejR = isMobile ? 1.2 : 1.5;
    for (const m of ejected) {
        if (m.x == null || m.y == null) continue;
        if (!inRange(m.x, m.y, centerX, centerY, halfRange)) continue;
        const p = toMini(m.x, m.y);
        ctx.fillStyle = 'rgba(255, 140, 50, 0.7)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, ejR, 0, Math.PI * 2);
        ctx.fill();
    }

    // viruses
    const virusR = isMobile ? 2 : 2.6;
    for (const v of viruses) {
        if (v.x == null || v.y == null) continue;
        if (!inRange(v.x, v.y, centerX, centerY, halfRange)) continue;
        const p = toMini(v.x, v.y);
        ctx.fillStyle = 'rgba(80, 210, 100, 0.75)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, virusR, 0, Math.PI * 2);
        ctx.fill();
    }

    // enemies on radar — steady red dots (no pulse; pulse on many players looked like minimap flicker)
    const enemyR = isMobile ? 2 : 2.6;
    for (const e of enemies) {
        if (!inRange(e.x, e.y, centerX, centerY, halfRange)) continue;
        const p = toMini(e.x, e.y);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.arc(p.x, p.y, enemyR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // you — always centered
    const meR = isMobile ? 2.4 : 3;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
    ctx.shadowBlur = isMobile ? 3 : 5;
    ctx.beginPath();
    ctx.arc(cx, cy, meR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    // rim threat from enemies outside radar but nearby
    const edgeThreat = new Array(EDGE_BUCKETS).fill(0);
    let maxThreat = 0;
    for (const e of enemies) {
        const dx = e.x - centerX;
        const dy = e.y - centerY;
        const dist = Math.hypot(dx, dy);
        if (dist <= halfRange || dist > threatRange) continue;
        const t = 1 - (dist - halfRange) / (threatRange - halfRange);
        const angle = Math.atan2(dy, dx);
        const bucket = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * EDGE_BUCKETS) % EDGE_BUCKETS;
        edgeThreat[bucket] = Math.max(edgeThreat[bucket], t);
        maxThreat = Math.max(maxThreat, t);
    }

    const baseRingAlpha = 0.22;
    const ringR = radius;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${baseRingAlpha})`;
    ctx.lineWidth = isMobile ? 1.4 : 2;
    ctx.stroke();

    for (let i = 0; i < EDGE_BUCKETS; i++) {
        const t = edgeThreat[i];
        if (t <= 0.02) continue;
        const a0 = (i / EDGE_BUCKETS) * Math.PI * 2 - Math.PI;
        const a1 = ((i + 1) / EDGE_BUCKETS) * Math.PI * 2 - Math.PI;
        const alpha = (0.35 + t * 0.65) * 0.85;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR - 1, a0, a1);
        ctx.strokeStyle = `rgba(255, 35, 35, ${alpha})`;
        ctx.lineWidth = isMobile ? 2.5 : 3.5;
        ctx.lineCap = 'butt';
        ctx.stroke();
    }

    if (maxThreat > 0.05) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 50, 50, ${0.12 + maxThreat * 0.35})`;
        ctx.lineWidth = isMobile ? 2 : 2.5;
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

/** Normalize server minimap payload or build from local game state. */
export function normalizeMinimapData(raw, fallback = {}) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return {
            players: raw.players || raw.p || fallback.players || [],
            food: raw.food || raw.f || fallback.food || [],
            viruses: raw.viruses || raw.v || fallback.viruses || [],
            ejected: raw.ejected || raw.e || fallback.ejected || [],
        };
    }
    if (Array.isArray(raw) && raw.length > 0) {
        return {
            players: raw.map(d => ({
                x: d.x,
                y: d.y,
                isYou: !!(d.you || d.isYou),
            })),
            food: fallback.food || [],
            viruses: fallback.viruses || [],
            ejected: fallback.ejected || [],
        };
    }
    return {
        players: fallback.players || [],
        food: fallback.food || [],
        viruses: fallback.viruses || [],
        ejected: fallback.ejected || [],
    };
}
