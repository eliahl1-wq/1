/**
 * Surviv client renderer - top-down shooter canvas.
 */

import { drawBalanceBadge } from '../balanceBadge.js';
import { drawCashoutProgressRing, CASHOUT_HOLD_MS } from '../cashoutRing.js';
import { drawGameEmote, drawChatBubble } from '../../components/GameSocialOverlay.jsx';
import { drawGameMinimap } from '../minimap.js';
import { playSurvivFootstep, unlockGameAudio } from '../../audio/synthSounds.js';

const WEAPON_LABELS = {
    fists: 'Fists',
    knife: 'Combat Knife',
    pistol: 'M9',
    revolver: 'OT-38',
    smg: 'MP5',
    shotgun: 'M870',
    assault: 'M416',
    dmr: 'M39 EMR',
    sniper: 'Mosin-Nagant',
    lmg: 'M249',
};

const RARITY_COLORS = {
    common: '#d7c396',
    rare: '#71a7ff',
    military: '#c985ff',
};

const LOOT_COLORS = {
    money: '#ffd45a',
    medkit: '#5fe08a',
    armor: '#5d9cff',
    ammo: '#d7d1bb',
    grenade: '#f59e0b',
    weapon: '#f2774f',
};

const AMMO_COLORS = { '9mm': '#f5d547', '12g': '#f05a5a', '556': '#63d471', '762': '#5aa9f8' };

const WEAPON_FIRE_RATE = {
    fists: 0, knife: 340, pistol: 120, revolver: 520, smg: 90, shotgun: 750,
    assault: 75, dmr: 360, sniper: 950, lmg: 105,
};

const MELEE_ANIMATION_MS = 280;
const PLAYER_HAND_OUTLINE = '#effff3';
const PLAYER_HAND_OUTLINE_WIDTH = 1.7;
const PLAYER_HAND_RADIUS = 5.4;
const WATER_MOVE_MULTIPLIER = 0.68;

function drawPlayerHand(ctx, hand, playerColor) {
    ctx.fillStyle = playerColor;
    ctx.strokeStyle = PLAYER_HAND_OUTLINE;
    ctx.lineWidth = PLAYER_HAND_OUTLINE_WIDTH;
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, PLAYER_HAND_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}
const FULL_AUTO_MOVE_MULTIPLIERS = Object.freeze({ smg: 0.78, assault: 0.74, lmg: 0.66 });

const smoothstep01 = (value) => {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
};

function meleeStrikeMotion(progress, contactAt = 0.28, releaseAt = 0.48) {
    const t = clamp(progress, 0, 1);
    if (t < contactAt) return smoothstep01(t / contactAt);
    if (t < releaseAt) return 1;
    return 1 - smoothstep01((t - releaseAt) / (1 - releaseAt));
}

const WEAPON_SHAKE = {
    fists: 0, knife: 0.25, pistol: 0.3, revolver: 0.8, smg: 0.15, shotgun: 1.0,
    assault: 0.3, dmr: 0.6, sniper: 1.4, lmg: 0.25,
};

const WEAPON_BULLET_SPEED = {
    pistol: 34, revolver: 44, smg: 38, shotgun: 30,
    assault: 42, dmr: 48, sniper: 58, lmg: 40,
};

const WEAPON_MUZZLE_SCALE = Object.freeze({
    pistol: 1.33,
    revolver: 1.75,
    smg: 1.98,
    shotgun: 2.31,
    assault: 2.26,
    dmr: 2.57,
    sniper: 2.88,
    lmg: 2.47,
});

function weaponMuzzleDistance(weapon, playerRadius = 14) {
    return playerRadius * (WEAPON_MUZZLE_SCALE[weapon] || 1.3);
}

function drawGunPart(ctx, x, y, w, h, fill, radius = 1.6, stroke = '#11181b', lineWidth = 1.15) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.stroke();
}

function drawGunHighlight(ctx, x1, y1, x2, y2, alpha = 0.32) {
    ctx.strokeStyle = `rgba(231, 242, 242, ${alpha})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function drawHeldWeaponTopDown(ctx, weapon) {
    const metal = '#354247';
    const darkMetal = '#182124';
    const black = '#0d1315';
    const polymer = '#26332f';
    const wood = '#754923';

    const taperedStock = (length, halfWidth, fill = polymer) => {
        ctx.fillStyle = fill;
        ctx.strokeStyle = '#121917';
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(1, -halfWidth * 0.72);
        ctx.lineTo(length * 0.72, -halfWidth);
        ctx.lineTo(length, -halfWidth * 0.58);
        ctx.lineTo(length, halfWidth * 0.58);
        ctx.lineTo(length * 0.72, halfWidth);
        ctx.lineTo(1, halfWidth * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        drawGunHighlight(ctx, 2.5, -halfWidth * 0.42, length - 1.5, -halfWidth * 0.55, 0.25);
    };

    const barrel = (x, length, width, muzzleWidth = width + 1.8) => {
        drawGunPart(ctx, x, -width / 2, length, width, darkMetal, Math.min(1, width / 2));
        drawGunPart(ctx, x + length - 0.8, -muzzleWidth / 2, 2.1, muzzleWidth, black, 0.65);
    };

    const topSight = (x, width = 1.6) => {
        ctx.fillStyle = '#9aa6a8';
        ctx.strokeStyle = '#151d1f';
        ctx.lineWidth = 0.65;
        ctx.fillRect(x, -width / 2, 1.4, width);
        ctx.strokeRect(x, -width / 2, 1.4, width);
    };

    const scope = (x, length) => {
        drawGunPart(ctx, x, -2.15, length, 4.3, '#1b2528', 1.8, '#0b1113', 1);
        ctx.fillStyle = '#6e858b';
        ctx.strokeStyle = '#101719';
        ctx.lineWidth = 0.8;
        for (const sx of [x + 1.4, x + length - 1.4]) {
            ctx.beginPath();
            ctx.ellipse(sx, 0, 1.4, 2.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        drawGunHighlight(ctx, x + 2.4, -0.95, x + length - 2.5, -0.95, 0.38);
    };

    if (weapon === 'pistol') {
        // A pistol seen from above: the slide and sights sit on its centreline;
        // the grip remains behind the slide instead of hanging below it.
        drawGunPart(ctx, 3.8, -3.8, 13.7, 7.6, metal, 1.7);
        drawGunPart(ctx, 2.2, -4.45, 6.8, 8.9, '#273236', 2.2);
        drawGunPart(ctx, 16.6, -2.65, 2, 5.3, black, 0.65);
        drawGunHighlight(ctx, 6, -2.55, 15.3, -2.55, 0.46);
        topSight(5.2, 2.4);
        topSight(14.7, 2.1);
        ctx.strokeStyle = '#161e21';
        ctx.lineWidth = 0.8;
        for (let x = 3.6; x < 7.2; x += 1.8) {
            ctx.beginPath();
            ctx.moveTo(x, -3.7);
            ctx.lineTo(x + 0.7, -2.5);
            ctx.moveTo(x, 3.7);
            ctx.lineTo(x + 0.7, 2.5);
            ctx.stroke();
        }
        return [{ x: 6.1, y: -5.2 }, { x: 6.1, y: 5.2 }];
    }

    if (weapon === 'revolver') {
        taperedStock(7.5, 3.8, '#82502d');
        drawGunPart(ctx, 6, -5.1, 6.8, 10.2, '#536166', 4.1);
        ctx.fillStyle = '#222d30';
        for (const y of [-2.35, 0, 2.35]) {
            ctx.beginPath();
            ctx.arc(8.8, y, 0.75, 0, Math.PI * 2);
            ctx.fill();
        }
        drawGunPart(ctx, 11, -2.8, 9.5, 5.6, '#414d51', 1.15);
        barrel(19.2, 3.2, 2.5, 4.2);
        drawGunHighlight(ctx, 12.5, -1.7, 19.1, -1.7, 0.44);
        topSight(18.1, 2.1);
        return [{ x: 5.4, y: -5 }, { x: 5.4, y: 5 }];
    }

    if (weapon === 'smg') {
        ctx.strokeStyle = '#172023';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(1, -3.2);
        ctx.lineTo(7.3, -4.8);
        ctx.moveTo(1, 3.2);
        ctx.lineTo(7.3, 4.8);
        ctx.stroke();
        drawGunPart(ctx, 5.8, -4.9, 13.6, 9.8, '#2c393c', 2);
        drawGunPart(ctx, 10.7, -5.7, 5.1, 11.4, '#202b2e', 1.4);
        drawGunPart(ctx, 18, -3.45, 6.2, 6.9, '#263236', 1.1);
        barrel(23.2, 2.4, 2.5, 4.7);
        drawGunHighlight(ctx, 7.8, -3.25, 22.5, -2.25, 0.35);
        topSight(17.1, 2.2);
        return [{ x: 9.3, y: -5.8 }, { x: 17.7, y: 5.2 }];
    }

    if (weapon === 'shotgun') {
        taperedStock(10.5, 5.2, wood);
        drawGunPart(ctx, 8.2, -4.15, 10.3, 8.3, '#343e41', 1.6);
        drawGunPart(ctx, 17.1, -3.35, 11.7, 6.7, '#8b582f', 2, '#321f13');
        ctx.strokeStyle = 'rgba(45,27,15,0.75)';
        ctx.lineWidth = 0.75;
        for (let x = 19; x <= 26; x += 2) {
            ctx.beginPath();
            ctx.moveTo(x, -3);
            ctx.lineTo(x, 3);
            ctx.stroke();
        }
        // Parallel barrel and magazine tube make the shotgun readable overhead.
        drawGunPart(ctx, 27.2, -2.6, 4.1, 2.15, '#222b2e', 0.55);
        drawGunPart(ctx, 27.2, 0.45, 4.1, 2.15, '#161e21', 0.55);
        drawGunPart(ctx, 30.3, -3.3, 2.1, 6.6, black, 0.65);
        drawGunHighlight(ctx, 10.5, -2.7, 27.2, -2.05, 0.3);
        return [{ x: 10.6, y: -5.2 }, { x: 22.1, y: 5.1 }];
    }

    if (weapon === 'assault' || weapon === 'dmr') {
        const isDmr = weapon === 'dmr';
        taperedStock(isDmr ? 11 : 10, 5.1, isDmr ? '#745435' : polymer);
        drawGunPart(ctx, 8, -4.65, isDmr ? 12.8 : 11.8, 9.3, isDmr ? '#4d4638' : metal, 1.7);
        // Magazine is visible equally on both sides from above.
        drawGunPart(ctx, 10.8, -5.75, 5.6, 11.5, isDmr ? '#383228' : '#1c2827', 1.8);
        const frontX = isDmr ? 19.2 : 18.2;
        const handguardLength = isDmr ? 10.8 : 8.7;
        drawGunPart(ctx, frontX, -3.3, handguardLength, 6.6, isDmr ? '#554d3d' : '#2a3739', 1.15);
        barrel(frontX + handguardLength - 0.3, isDmr ? 5 : 3.8, 2.3, 4.6);
        drawGunHighlight(ctx, 9.8, -3.05, frontX + handguardLength - 1, -2.05, 0.32);
        if (isDmr) scope(13, 11.2);
        else {
            topSight(15.2, 2.3);
            topSight(24.7, 2);
        }
        return [{ x: 10, y: -5.5 }, { x: isDmr ? 24 : 21.6, y: 5.1 }];
    }

    if (weapon === 'sniper') {
        taperedStock(16.5, 5.5, wood);
        drawGunPart(ctx, 13.5, -3.7, 11.8, 7.4, '#465256', 1.45);
        drawGunPart(ctx, 22.8, -2.55, 8.2, 5.1, '#313c3f', 1);
        barrel(30, 9, 2.2, 4.2);
        scope(14.8, 12.2);
        drawGunHighlight(ctx, 3.2, -3.25, 13.2, -2.55, 0.24);
        ctx.fillStyle = '#778589';
        ctx.beginPath();
        ctx.arc(22, 4.8, 1.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#778589';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(21, 2.1);
        ctx.lineTo(22, 4.5);
        ctx.stroke();
        return [{ x: 11.7, y: -5.3 }, { x: 25.1, y: 4.8 }];
    }

    if (weapon === 'lmg') {
        taperedStock(10.5, 5.6, '#344239');
        drawGunPart(ctx, 7.5, -5.55, 14.5, 11.1, '#3a484b', 2);
        // Wide ammunition box is centred under the receiver in top-down view.
        drawGunPart(ctx, 9.6, -7, 8.8, 14, '#273134', 2);
        drawGunPart(ctx, 20.5, -3.6, 9.4, 7.2, '#293538', 1.2);
        ctx.fillStyle = '#667477';
        for (let x = 22.5; x < 28.5; x += 2.2) {
            ctx.beginPath();
            ctx.arc(x, 0, 0.68, 0, Math.PI * 2);
            ctx.fill();
        }
        barrel(28.9, 4.4, 2.5, 5.1);
        drawGunHighlight(ctx, 9.2, -3.7, 28.2, -2.2, 0.3);
        ctx.strokeStyle = '#1a2325';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(27.2, -2.5);
        ctx.lineTo(30, -7.8);
        ctx.moveTo(27.2, 2.5);
        ctx.lineTo(30, 7.8);
        ctx.stroke();
        return [{ x: 9.2, y: -6.4 }, { x: 23.2, y: 5.2 }];
    }

    drawGunPart(ctx, 4, -3.2, 12, 6.4, metal, 1.6);
    return [{ x: 6.5, y: -4.6 }, { x: 10.5, y: 4.6 }];
}

const makeBulletSpec = (trailLen, tipLen, thickness, rgb = '255, 251, 232') => ({
    trailLen,
    tipLen,
    thickness,
    rgb,
});

// One clean Surviv-style tracer per projectile: no stacked glow/core strokes.
const WEAPON_BULLET_SPECS = {
    shotgun: makeBulletSpec(38, 3.5, 0.85),
    sniper: makeBulletSpec(100, 6, 1.3, '245, 251, 255'),
    revolver: makeBulletSpec(70, 5, 1.1),
    pistol: makeBulletSpec(55, 4, 0.95),
    assault: makeBulletSpec(65, 4.5, 1),
    dmr: makeBulletSpec(82, 5.5, 1.15),
    smg: makeBulletSpec(48, 3.5, 0.9),
    lmg: makeBulletSpec(58, 4, 0.95),
    default: makeBulletSpec(55, 4, 0.95),
};

const SURFACE_KINDS = new Set(['road', 'roadJunction', 'trail_path', 'houseFloor', 'field', 'water', 'river', 'river_path', 'bridge']);
// These details sit directly on the ground and deliberately stay shadow-free.
// Everything with meaningful height is handled by the persistent cast-shadow
// pass below, so newly added obstacle kinds automatically receive a shadow.
const CAST_SHADOW_EXEMPT_KINDS = new Set([
    'road', 'roadJunction', 'trail_path', 'houseFloor', 'field', 'water', 'river', 'river_path',
    'roomZone', 'door', 'bush', 'fallenLog', 'grassTuft', 'wildflowers', 'mushrooms', 'reeds', 'stump',
]);
const ROUND_CAST_SHADOW_KINDS = new Set(['tree', 'rock', 'barrel', 'lampPost']);
const TALL_CAST_SHADOW_KINDS = new Set(['tree', 'container', 'tent', 'signpost', 'lampPost', 'mailbox']);
const LOS_BLOCKING_KINDS = new Set(['wall', 'interiorWall', 'container', 'crate']);
const HOUSE_BOUND_PROP_KINDS = new Set(['furniture', 'machine', 'container', 'crate', 'barrel']);
const CACHEABLE_PROP_KINDS = new Set([
    'houseFloor', 'tree', 'bush', 'rock', 'container', 'crate', 'barrel',
    'furniture', 'machine', 'sandbag', 'signpost',
    'stump', 'fallenLog', 'hayBale', 'reeds', 'grassTuft', 'wildflowers', 'mushrooms',
    'lampPost', 'bench', 'mailbox', 'roadMarker', 'picnicTable',
]);

function compactTimedItems(items, now) {
    let liveCount = 0;
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (now - item.spawnedAt < item.duration) items[liveCount++] = item;
    }
    items.length = liveCount;
}

function obstacleRenderSignature(obstacles) {
    let hash = 2166136261;
    const mixString = (value) => {
        const text = String(value ?? '');
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
    };
    const mixNumber = (value) => {
        hash ^= Math.round((Number(value) || 0) * 10);
        hash = Math.imul(hash, 16777619);
    };

    for (const o of obstacles) {
        mixString(o.id);
        mixString(o.kind);
        mixString(o.variant);
        mixString(o.houseId);
        mixString(o.role);
        mixString(o.orientation);
        mixString(o.entranceRole);
        mixString(o.landmarkType);
        mixString(o.label);
        mixNumber(o.x);
        mixNumber(o.y);
        mixNumber(o.w);
        mixNumber(o.h);
        mixNumber(o.rotation);
        mixNumber(o.width);
        mixNumber(o.collidable === false ? 0 : 1);
        mixNumber(o.isOpen ? 1 : 0);
        if (o.points?.length) {
            mixNumber(o.points.length);
            for (const point of o.points) {
                mixNumber(point.x);
                mixNumber(point.y);
            }
        }
    }
    return `${obstacles.length}:${hash >>> 0}`;
}

function hasSameSurfaceGeometry(previous, next) {
    if (!previous || !next) return false;
    if (previous.kind !== next.kind || previous.variant !== next.variant
        || previous.x !== next.x || previous.y !== next.y
        || previous.w !== next.w || previous.h !== next.h
        || previous.width !== next.width || previous.rotation !== next.rotation) return false;
    const previousPoints = previous.points || [];
    const nextPoints = next.points || [];
    if (previousPoints.length !== nextPoints.length) return false;
    for (let index = 0; index < previousPoints.length; index++) {
        if (previousPoints[index].x !== nextPoints[index].x
            || previousPoints[index].y !== nextPoints[index].y) return false;
    }
    return true;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
};

function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
}

function seededNoise(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

function traceSmoothPath(ctx, points, originX = 0, originY = 0, closed = false) {
    if (!points?.length) return false;
    const local = points.map(point => ({ x: point.x - originX, y: point.y - originY }));
    ctx.beginPath?.();
    ctx.moveTo(local[0].x, local[0].y);
    const segmentCount = closed ? local.length : local.length - 1;
    for (let i = 0; i < segmentCount; i++) {
        const p0 = local[closed ? (i - 1 + local.length) % local.length : Math.max(0, i - 1)];
        const p1 = local[i % local.length];
        const p2 = local[(i + 1) % local.length];
        const p3 = local[closed ? (i + 2) % local.length : Math.min(local.length - 1, i + 2)];
        ctx.bezierCurveTo(
            p1.x + (p2.x - p0.x) / 6,
            p1.y + (p2.y - p0.y) / 6,
            p2.x - (p3.x - p1.x) / 6,
            p2.y - (p3.y - p1.y) / 6,
            p2.x,
            p2.y,
        );
    }
    if (closed) ctx.closePath();
    return true;
}

function riverShapePoints(obstacle, padding = 0) {
    const points = obstacle.points || [];
    const left = [];
    const right = [];
    for (let i = 0; i < points.length; i++) {
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
        const length = Math.max(1, Math.hypot(next.x - prev.x, next.y - prev.y));
        const nx = -(next.y - prev.y) / length;
        const ny = (next.x - prev.x) / length;
        const halfWidth = (obstacle.widths?.[i] || obstacle.width || 220) / 2 + padding;
        left.push({ x: points[i].x + nx * halfWidth, y: points[i].y + ny * halfWidth });
        right.push({ x: points[i].x - nx * halfWidth, y: points[i].y - ny * halfWidth });
    }
    return left.concat(right.reverse());
}

function traceRiverShape(ctx, obstacle, padding = 0) {
    const shape = riverShapePoints(obstacle, padding);
    return traceSmoothPath(ctx, shape, obstacle.x, obstacle.y, true);
}

function offsetPathPoints(points, offset) {
    return points.map((point, index) => {
        const prev = points[Math.max(0, index - 1)];
        const next = points[Math.min(points.length - 1, index + 1)];
        const length = Math.max(1, Math.hypot(next.x - prev.x, next.y - prev.y));
        return {
            x: point.x - ((next.y - prev.y) / length) * offset,
            y: point.y + ((next.x - prev.x) / length) * offset,
        };
    });
}

function forEachPathSample(points, spacing, callback) {
    let carry = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        if (length < 1) continue;
        for (let distance = spacing - carry; distance <= length; distance += spacing) {
            const t = distance / length;
            callback(a.x + dx * t, a.y + dy * t, Math.atan2(dy, dx));
        }
        carry = (carry + length) % spacing;
    }
}

function traceOrganicPond(ctx, obstacle, padding = 0, scale = 1) {
    const count = 24;
    const rx = (obstacle.w / 2 + padding) * scale;
    const ry = (obstacle.h / 2 + padding) * scale;
    const points = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const wobble = 1
            + Math.sin(angle * 3 + obstacle.x * 0.007) * 0.075
            + Math.sin(angle * 5 + obstacle.y * 0.009) * 0.045
            + Math.sin(angle * 7 + (obstacle.x - obstacle.y) * 0.003) * 0.018;
        points.push({ x: Math.cos(angle) * rx * wobble, y: Math.sin(angle) * ry * wobble });
    }
    traceSmoothPath(ctx, points, 0, 0, true);
}

function biomeAt() {
    return { base: '#3d6b35', alt: '#4a7a42', grass: 'rgba(45,88,38,0.22)' };
}

export class SurvivRenderer {
    constructor(canvas, balanceCanvas = null) {
        this.canvas = canvas;
        // The game paints every pixel each frame, so an opaque low-latency
        // context avoids unnecessary alpha compositing with the DOM.
        this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        this.balanceCanvas = balanceCanvas;
        this.balanceCtx = balanceCanvas?.getContext('2d', { alpha: true }) || null;
        this._balanceCanvasCssWidth = 112;
        this._balanceCanvasCssHeight = 31;
        this._balanceCanvasDpr = 0;
        this._renderedBalance = null;
        this.camera = { x: 0, y: 0 };
        this.zoom = 1;
        this.targetZoom = 1.82;
        this.isMobileLayout = false;
        this.reducedMotion = false;
        this.worldHalf = 10000;
        this.myId = null;
        this.players = [];
        this.worldEmotes = new Map();
        this.worldChats = new Map();
        this.loot = [];
        this._solidLootContainers = [];
        this._groundWeapons = [];
        this.bullets = [];
        this.localShotTracers = [];
        this.obstacles = [];
        this.minimap = { players: [], food: [], obstacles: [] };
        this.houseFloors = [];
        this.roomZones = [];
        this.doorways = [];

        this.surfaceObstacles = [];
        this.fieldObstacles = [];
        this.waterObstacles = [];
        this.roadObstacles = [];
        this.roadJunctionObstacles = [];
        this.bridgeObstacles = [];
        this.sortedWorldObstacles = [];
        this._roomZonesByHouseId = new Map();
        this._doorwaysByHouseId = new Map();
        this._interiorFogHouseIds = new Set();
        this._losSegmentsByHouseId = new Map();
        this._losVerticesByHouseId = new Map();
        this._nearbyLosSegments = [];
        this._renderObstaclesByHouseId = new Map();
        this._collisionBuckets = new Map();
        this._houseBuckets = new Map();
        this._housesById = new Map();
        this._stableCurrentHouseId = null;
        this._stableCurrentRoomId = null;
        this._doorRevealHouseId = null;
        this._doorRevealDoorId = null;
        this._doorRevealProgress = 0;
        this._doorOpenProgress = new Map();
        this._houseBucketSize = 800;
        this._playersById = new Map();
        this._visibleFields = [];
        this._visibleWater = [];
        this._visibleRoads = [];
        this._visibleBridges = [];
        this._visibleWorldObstacles = [];
        this._obstacleRenderSignature = '';
        this._obstacleRevision = 0;
        this._viewLeft = -Infinity;
        this._viewRight = Infinity;
        this._viewTop = -Infinity;
        this._viewBottom = Infinity;
        this._terrainTexture = null;
        this._terrainPattern = null;
        this.zone = null;
        this.me = null;
        this.lootToast = null;
        this.lastLootId = null;
        this.hud = {
            balance: 0,
            hp: 100,
            maxHp: 100,
            armor: 0,
            weapon: 'fists',
            ammo: 15,
            clipSize: 15,
            reloading: false,
            kills: 0,
            cashoutEndAt: 0,
            cashoutTotal: 10,
            cashoutSeconds: 0,
            inventory: { weapons: [], medkits: 0, ammoReserves: {}, chestsOpened: 0 },
        };
        this.keys = { w: false, a: false, s: false, d: false };
        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false };
        this._canvasLeft = 0;
        this._canvasTop = 0;
        this.mobileMove = { x: 0, y: 0 };
        this._localMoveVector = { dx: 0, dy: 0 };
        this.mobileAim = { angle: 0, strength: 0, active: false, shooting: false };
        this.inputEnabled = true;
        this.spectatorMode = false;
        this.externalCameraGetter = null;
        this.inventoryOpen = false;
        this.hideNames = localStorage.getItem('hide_player_names') === 'true';
        this.running = false;
        this._raf = null;
        this._lastFrameAt = performance.now();
        this._frameNow = Date.now();
        this._footstepX = NaN;
        this._footstepY = NaN;
        this._footstepDistance = 0;
        this._footstepIndex = 0;
        this._footstepSurface = 'ground';
        // Cached gradients to avoid per-frame allocation
        this._cachedVignetteGrad = null;
        this._cachedVignetteKey = '';
        this._cachedDangerGrad = null;
        this._cachedDangerKey = '';
        this._cachedLowAmmoGrad = null;
        this._cachedLowAmmoKey = '';
        // FPS counter
        this._fpsFrames = 0;
        this._fpsLastSampleAt = performance.now();
        this._fpsDisplay = 0;
        this._resizeTimer = null;
        this._onResize = () => {
            if (this._resizeTimer) clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                this._resizeTimer = null;
                this.resize();
            }, 90);
        };
        window.addEventListener('resize', this._onResize);
        window.addEventListener('gamelayoutchange', this._onResize);
        window.visualViewport?.addEventListener('resize', this._onResize);

        // --- New visual feedback systems ---
        // Particle system (muzzle flash, bullet impacts, debris)
        this.particles = [];
        this.grenadeExplosions = [];
        this.chestBursts = [];
        this._lootBurstStates = new Map();
        // Hit marker (center-screen X when you deal damage)
        this.hitMarkers = [];
        // Damage direction indicators (red arcs at screen edge)
        this.damageIndicators = [];
        // Floating damage numbers
        this.damageNumbers = [];
        // Camera shake
        this.cameraShake = { x: 0, y: 0, intensity: 0, decay: 0.88, phase: 0 };
        // Kill feed and server-synced death presentation
        this.killFeed = [];
        this.deathMarkers = [];
        this.killAnimations = [];
        this._seenDeathMarkerIds = new Set();
        this._graveFirstSeenAt = new Map();
        // Blood decals on the ground
        this.bloodDecals = [];
        // Previous player states for interpolation & tracking
        this._prevPlayers = new Map();
        this._interpPlayers = new Map();
        this._interpMe = null;
        this._interpBullets = new Map();
        this._currentVisibilityPolygon = null;
        this._currentVisibilityHouseId = null;
        this._losCacheKey = '';
        this._losCachedPolygon = null;
        this._losLastPlayerX = NaN;
        this._losLastPlayerY = NaN;
        this._losWorkingAngles = [];
        this._losWorkingPolygon = [];
        this._frameDt = 1 / 60;
        this._minimapCanvas = null;
        this._minimapCtx = null;
        this._nextMinimapRenderAt = 0;
        this._roofSpriteCache = new Map();
        this._roofCachePixels = 0;
        this._roofCacheBuildsThisFrame = 0;
        this._obstacleSpriteCache = new Map();
        this._obstacleCachePixels = 0;
        this._obstacleCacheBuildsThisFrame = 0;
        this._surfaceSpriteCache = new Map();
        this._surfaceCachePixels = 0;
        this._surfaceCacheBuildsThisFrame = 0;
        this._surfaceChunkCache = new Map();
        this._surfaceChunkCachePixels = 0;
        this._surfaceChunkBuildsThisFrame = 0;
        this._surfaceChunkRequired = [];
        this._surfacePrefetchCandidates = [];
        this._surfaceChunkSources = new Map();
        this._cacheBuildsThisFrame = 0;
        this._lastSurfaceCamX = NaN;
        this._lastSurfaceCamY = NaN;
        // Smaller tiles keep first-time cache builds under a 140 Hz frame
        // budget while preserving the same 1.5x texture resolution.
        this._surfaceChunkTileSize = 512;
        this._surfaceCacheKeyByObject = new WeakMap();
        this._surfacePathCache = new WeakMap();
        this._pathSampleCache = new WeakMap();
        this._roadMarkingCutCache = new WeakMap();
        this._waterAnimationGeometry = new WeakMap();
        this._buildingSurfaceCache = false;
        this._buildingSurfaceChunk = false;
        // Previous HP for detecting damage
        this._prevHp = 100;
        // Previous ammo for detecting shots fired
        this._prevAmmo = -1;
        this._prevWeapon = 'fists';
        // Weapon switch animation
        this._weaponSwitchT = 0;
        this._weaponSwitchFrom = 'fists';
        // Muzzle flash
        this._muzzleFlash = 0;
        // Low ammo pulse
        this._lowAmmoPulse = 0;
        this._footstepX = NaN;
        this._footstepY = NaN;
        this._footstepDistance = 0;
        this._footstepIndex = 0;
        this._footstepSurface = 'ground';
        // Player alive count
        this.aliveCount = 0;

        this.resize();
    }

    configureBalanceCanvas() {
        if (!this.balanceCanvas || !this.balanceCtx) return;
        const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
        const width = Math.round(this._balanceCanvasCssWidth * dpr);
        const height = Math.round(this._balanceCanvasCssHeight * dpr);
        if (this.balanceCanvas.width !== width || this.balanceCanvas.height !== height) {
            this.balanceCanvas.width = width;
            this.balanceCanvas.height = height;
            this.balanceCanvas.style.width = `${this._balanceCanvasCssWidth}px`;
            this.balanceCanvas.style.height = `${this._balanceCanvasCssHeight}px`;
            this._renderedBalance = null;
        }
        this._balanceCanvasDpr = dpr;
        this.balanceCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.balanceCtx.imageSmoothingEnabled = true;
        this.balanceCtx.imageSmoothingQuality = 'high';
    }

    drawLocalBalanceBadge(screenX, screenY, balance) {
        if (!this.balanceCanvas || !this.balanceCtx) return false;
        this.configureBalanceCanvas();
        const amount = Number(balance) || 0;
        if (this._renderedBalance !== amount) {
            const ctx = this.balanceCtx;
            ctx.clearRect(0, 0, this._balanceCanvasCssWidth, this._balanceCanvasCssHeight);
            drawBalanceBadge(ctx, this._balanceCanvasCssWidth / 2, 2, amount, true);
            this._renderedBalance = amount;
        }
        const left = Math.round(screenX - this._balanceCanvasCssWidth / 2);
        const top = Math.round(screenY - 2);
        this.balanceCanvas.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        this.balanceCanvas.style.visibility = 'visible';
        return true;
    }

    resize() {
        const parent = this.canvas.parentElement;
        const w = parent?.clientWidth || window.innerWidth;
        const h = parent?.clientHeight || window.innerHeight;
        // Keep phone-sized Retina canvases sharp while capping total GPU pixels.
        const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0;
        const nextMobileLayout = coarsePointer || w < 760;
        const nextReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
        // Surviv redraws the whole canvas every frame. Keep the backing surface
        // below roughly 3M pixels so 120/144 Hz displays do not become
        // fill-rate bound even when several translucent world layers overlap.
        const pixelBudgetDpr = Math.sqrt(3_000_000 / Math.max(1, w * h));
        const dprCap = nextMobileLayout ? 1.45 : 0.95;
        const baseDpr = Math.min(window.devicePixelRatio || 1, dprCap, pixelBudgetDpr);
        // The previous 0.75 floor defeated the pixel budget on ultrawide/4K
        // displays (4.7M pixels at 4K). Keep the cost consistent across monitors.
        const minimumDpr = nextMobileLayout ? 0.58 : 0.5;
        // Resolution stays stable for the whole match. Dynamically changing the
        // backing canvas made graphics visibly soften a few seconds after join.
        const dpr = Math.max(minimumDpr, baseDpr);
        const backingWidth = Math.round(w * dpr);
        const backingHeight = Math.round(h * dpr);
        const firstResize = !Number.isFinite(this.viewW) || !Number.isFinite(this.viewH);
        const layoutChanged = this.isMobileLayout !== nextMobileLayout;
        const dprChanged = !Number.isFinite(this.renderDpr) || Math.abs(this.renderDpr - dpr) >= 0.0001;
        this.isMobileLayout = nextMobileLayout;
        this.reducedMotion = nextReducedMotion;
        this.targetZoom = this.isMobileLayout ? 1.36 : 1.82;

        if (!dprChanged
            && this.canvas.width === backingWidth
            && this.canvas.height === backingHeight
            && this.viewW === w
            && this.viewH === h) {
            const canvasRect = this.canvas.getBoundingClientRect();
            this._canvasLeft = canvasRect.left;
            this._canvasTop = canvasRect.top;
            if (!this.spectatorMode && layoutChanged) this.zoom = this.targetZoom;
            return;
        }
        this.renderDpr = dpr;
        this.canvas.width = backingWidth;
        this.canvas.height = backingHeight;
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        const canvasRect = this.canvas.getBoundingClientRect();
        this._canvasLeft = canvasRect.left;
        this._canvasTop = canvasRect.top;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = this.isMobileLayout ? 'high' : 'medium';
        this.viewW = w;
        this.viewH = h;
        this._terrainPattern = null;
        if (!this.spectatorMode && (firstResize || layoutChanged || !Number.isFinite(this.zoom))) {
            this.zoom = this.targetZoom;
        }
    }

    destroy() {
        this.pause();
        if (this.balanceCanvas) this.balanceCanvas.style.visibility = 'hidden';
        if (this._resizeTimer) clearTimeout(this._resizeTimer);
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('gamelayoutchange', this._onResize);
        window.visualViewport?.removeEventListener('resize', this._onResize);
    }

    start() {
        if (this.running) return;
        this.running = true;

        this._lastFrameAt = performance.now();
        const loop = (now) => {
            if (!this.running) return;
            const dt = Math.min(0.05, Math.max(0.001, (now - this._lastFrameAt) / 1000));
            this._lastFrameAt = now;
            this.draw(dt);
            this._raf = requestAnimationFrame(loop);
        };
        this._raf = requestAnimationFrame(loop);
    }

    pause() {
        this.running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
    }

    showEmote(payload) {
        if (!payload?.playerId || !payload?.emote) return;
        const now = performance.now();
        this.worldEmotes.set(payload.playerId, { emote: payload.emote, startedAt: now, expiresAt: now + 2600 });
    }

    showChat(payload) {
        if (!payload?.playerId || !payload?.message) return;
        const now = performance.now();
        this.worldChats.set(payload.playerId, { message: payload.message, startedAt: now, expiresAt: now + 4000 });
    }

    resetSession() {
        this.players = [];
        this.worldEmotes.clear();
        this.worldChats.clear();
        this.loot = [];
        this._solidLootContainers = [];
        this._groundWeapons = [];
        this.bullets = [];
        this.localShotTracers = [];
        this.deathMarkers = [];
        this.killAnimations = [];
        this._seenDeathMarkerIds.clear();
        this._lootBurstStates.clear();
        this._graveFirstSeenAt.clear();
        this.obstacles = [];
        this.minimap = { players: [], food: [], obstacles: [] };
        this._nextMinimapRenderAt = 0;
        this.houseFloors = [];
        this.roomZones = [];
        this.doorways = [];
        this._currentVisibilityPolygon = null;
        this._currentVisibilityHouseId = null;
        this._losCacheKey = '';
        this._losCachedPolygon = null;
        this._losLastPlayerX = NaN;
        this._losLastPlayerY = NaN;
        this._losWorkingAngles = [];
        this._losWorkingPolygon = [];
        this._stableCurrentHouseId = null;
        this._stableCurrentRoomId = null;
        this._doorRevealHouseId = null;
        this._doorRevealDoorId = null;
        this._doorRevealProgress = 0;
        this.surfaceObstacles = [];
        this.fieldObstacles = [];
        this.waterObstacles = [];
        this.roadObstacles = [];
        this.roadJunctionObstacles = [];
        this.bridgeObstacles = [];
        this.sortedWorldObstacles = [];
        this._roomZonesByHouseId.clear();
        this._doorwaysByHouseId.clear();
        this._interiorFogHouseIds.clear();
        this._losSegmentsByHouseId.clear();
        this._losVerticesByHouseId.clear();
        this._renderObstaclesByHouseId.clear();
        this._collisionBuckets.clear();
        this._houseBuckets.clear();
        this._playersById.clear();
        this._visibleFields.length = 0;
        this._visibleWater.length = 0;
        this._visibleRoads.length = 0;
        this._visibleBridges.length = 0;
        this._visibleWorldObstacles.length = 0;
        this._obstacleRenderSignature = '';
        this._obstacleRevision++;
        this._roofSpriteCache.clear();
        this._roofCachePixels = 0;
        this._obstacleSpriteCache.clear();
        this._obstacleCachePixels = 0;
        this._surfaceSpriteCache.clear();
        this._surfaceCachePixels = 0;
        this._surfaceChunkCache.clear();
        this._surfaceChunkCachePixels = 0;
        this._surfaceChunkSources.clear();
        this._surfaceCacheKeyByObject = new WeakMap();
        this._surfacePathCache = new WeakMap();
        this._pathSampleCache = new WeakMap();
        this._roadMarkingCutCache = new WeakMap();
        this._waterAnimationGeometry = new WeakMap();
        this.me = null;
        this.zone = null;
        this.lootToast = null;
        this.lastLootId = null;
        this.particles = [];
        this.grenadeExplosions = [];
        this.chestBursts = [];
        this._lootBurstStates = new Map();
        this.hitMarkers = [];
        this.damageIndicators = [];
        this.damageNumbers = [];
        this.killFeed = [];
        this.bloodDecals = [];
        this._prevPlayers.clear();
        this._interpPlayers.clear();
        this._seenDeathMarkerIds.clear();
        this._lootBurstStates.clear();
        this._prevHp = 100;
        this._prevAmmo = -1;
        this._prevWeapon = 'fists';
        this._weaponSwitchT = 0;
        this._weaponSwitchFrom = 'fists';
        this._muzzleFlash = 0;
        this._lowAmmoPulse = 0;
        this.cameraShake.x = 0;
        this.cameraShake.y = 0;
        this.cameraShake.intensity = 0;
        this.cameraShake.phase = 0;
        this.inventoryOpen = false;
        this.aliveCount = 0;
        this.camera.x = 0;
        this.camera.y = 0;
        this.hud = {
            ...this.hud,
            balance: 0,
            hp: 100,
            maxHp: 100,
            armor: 0,
            weapon: 'fists',
            ammo: 0,
            clipSize: 0,
            reloading: false,
            kills: 0,
            cashoutEndAt: 0,
            cashoutSeconds: 0,
            inventory: { weapons: [], medkits: 0, ammoReserves: {}, chestsOpened: 0 },
        };
        this.clearInput();
        this._interpMe = null;
        this._interpBullets.clear();
        this.myId = null;
    }

    setMyId(id) {
        this.myId = id;
    }

    setHud(patch) {
        Object.assign(this.hud, patch);
    }

    setInputEnabled(enabled, preserveInput = false) {
        this.inputEnabled = enabled;
        if (!enabled && !preserveInput) this.clearInput();
    }

    setSpectatorMode(on, cam) {
        this.spectatorMode = on;
        if (cam) {
            this.camera.x = cam.x;
            this.camera.y = cam.y;
            if (cam.zoom) this.zoom = cam.zoom;
        } else if (!on) {
            this.zoom = this.targetZoom;
        }
    }

    setExternalCameraGetter(fn) {
        this.externalCameraGetter = fn;
    }

    setHoldStart(atMs) {
        this.hud.cashoutHoldStart = atMs;
    }

    _ingestLocalSnapshot(me, receivedAt) {
        if (!me) {
            this._interpMe = null;
            return;
        }

        const angle = Number(me.angle) || 0;
        const state = this._interpMe;
        if (!state || state.id !== me.id) {
            this._interpMe = {
                id: me.id,
                x: me.x,
                y: me.y,
                angle,
                targetX: me.x,
                targetY: me.y,
                targetAngle: angle,
                serverX: me.x,
                serverY: me.y,
                vx: 0,
                vy: 0,
                predictionInputX: 0,
                predictionInputY: 0,
                inputChangedAt: receivedAt,
                stationarySnapshots: 0,
                receivedAt,
            };
            if (!this.externalCameraGetter && !this.spectatorMode) {
                this.camera.x = me.x;
                this.camera.y = me.y;
            }
            return;
        }

        const elapsed = clamp((receivedAt - state.receivedAt) / 1000, 0.001, 0.25);
        const serverStepDistance = Math.hypot(me.x - state.serverX, me.y - state.serverY);
        const correctionDistance = Math.hypot(me.x - state.x, me.y - state.y);
        const moveInput = this._getLocalMoveVector();
        const isTryingToMove = Math.abs(moveInput.dx) > 0.001 || Math.abs(moveInput.dy) > 0.001;
        const serverStopped = serverStepDistance < 0.04;
        state.stationarySnapshots = serverStopped && isTryingToMove
            ? (state.stationarySnapshots || 0) + 1
            : 0;
        if (correctionDistance > 180) {
            state.x = me.x;
            state.y = me.y;
            state.vx = 0;
            state.vy = 0;
        } else if (serverStepDistance < 0.04) {
            // Do not let the previous velocity overshoot after the player stops.
            state.vx = 0;
            state.vy = 0;
        } else {
            const measuredVx = (me.x - state.serverX) / elapsed;
            const measuredVy = (me.y - state.serverY) / elapsed;
            state.vx = lerp(state.vx, measuredVx, 0.72);
            state.vy = lerp(state.vy, measuredVy, 0.72);
        }
        state.targetX = me.x;
        state.targetY = me.y;
        state.targetAngle = angle;
        state.serverX = me.x;
        state.serverY = me.y;
        // One unchanged packet right after a key press usually means that input
        // has not reached the server tick yet. Keep the prior prediction clock so
        // the player does not move forward and immediately snap back. Two stopped
        // packets disable prediction, which keeps wall collisions authoritative.
        if (!(serverStopped && isTryingToMove && state.stationarySnapshots === 1)) {
            state.receivedAt = receivedAt;
        }
    }

    _advanceInterpolatedWorld(dt, now) {
        const state = this._interpMe;
        if (!state || !this.me || state.id !== this.me.id) return;

        // Extrapolate only from the input that is held right now. This starts
        // movement immediately between 40 Hz snapshots, while avoiding the stale
        // measured velocity that previously caused pull-backs after key release.
        const moveInput = this._getLocalMoveVector();
        const hasMoveInput = Math.abs(moveInput.dx) > 0.001 || Math.abs(moveInput.dy) > 0.001;
        const inputChanged = Math.hypot(
            moveInput.dx - (state.predictionInputX || 0),
            moveInput.dy - (state.predictionInputY || 0),
        ) > 0.02;
        if (inputChanged) {
            state.predictionInputX = moveInput.dx;
            state.predictionInputY = moveInput.dy;
            state.inputChangedAt = now;
        }
        const canPredictMovement = hasMoveInput && (state.stationarySnapshots || 0) < 2;
        const predictionStartedAt = Math.max(state.receivedAt, state.inputChangedAt || 0);
        const leadSeconds = canPredictMovement
            ? clamp((now - predictionStartedAt) / 1000, 0, 0.05)
            : 0;
        const heldWeapon = this.me.weapon;
        const fullAutoMultiplier = FULL_AUTO_MOVE_MULTIPLIERS[heldWeapon];
        const firingFullAuto = !!(
            fullAutoMultiplier
            && (this.mouse.down || this.mobileAim.shooting)
            && Number(this.me.ammo) > 0
            && !this.me.reloading
        );
        const surfaceMultiplier = this.me.surface === 'water' ? WATER_MOVE_MULTIPLIER : 1;
        const predictedMoveSpeed = 208 * surfaceMultiplier * (firingFullAuto ? fullAutoMultiplier : 1);
        const predictedTarget = this._resolvePredictedLootContainerCollision(
            state.targetX + moveInput.dx * predictedMoveSpeed * leadSeconds,
            state.targetY + moveInput.dy * predictedMoveSpeed * leadSeconds,
            Number(this.me.radius) || 14,
            moveInput.dx,
            moveInput.dy,
        );
        const targetX = predictedTarget.x;
        const targetY = predictedTarget.y;
        const positionAlpha = 1 - Math.exp(-Math.min(dt, 0.05) * 32);
        const angleAlpha = 1 - Math.exp(-Math.min(dt, 0.05) * 42);
        state.x = lerp(state.x, targetX, positionAlpha);
        state.y = lerp(state.y, targetY, positionAlpha);
        state.angle = lerpAngle(state.angle, state.targetAngle, angleAlpha);

        this.me.x = state.x;
        this.me.y = state.y;
        this.me.angle = state.angle;
        if (!this.externalCameraGetter && !this.spectatorMode) {
            this.camera.x = state.x;
            this.camera.y = state.y;
        }
    }

    _resolvePredictedLootContainerCollision(x, y, playerRadius, moveX = 1, moveY = 0) {
        let resolvedX = x;
        let resolvedY = y;
        for (const item of this._solidLootContainers) {
            if (Math.abs(item.x - resolvedX) > 72 || Math.abs(item.y - resolvedY) > 72) continue;
            const itemRadius = Number(item.hitRadius) || 24;
            const minimumDistance = playerRadius + itemRadius;
            const dx = resolvedX - item.x;
            const dy = resolvedY - item.y;
            const distance = Math.hypot(dx, dy);
            if (distance >= minimumDistance) continue;
            if (distance < 0.0001) {
                const moveLength = Math.hypot(moveX, moveY) || 1;
                resolvedX = item.x - (moveX / moveLength) * minimumDistance;
                resolvedY = item.y - (moveY / moveLength) * minimumDistance;
                continue;
            }
            const scale = minimumDistance / distance;
            resolvedX = item.x + dx * scale;
            resolvedY = item.y + dy * scale;
        }
        return { x: resolvedX, y: resolvedY };
    }

    _ingestLootSnapshots(nextLoot, receivedAt) {
        const previousLoot = new Map(this.loot.map(item => [item.id, item]));
        for (const item of nextLoot) {
            const previous = previousLoot.get(item.id);
            if (previous?._hitAt) item._hitAt = previous._hitAt;
            if (previous && Number.isFinite(previous.hp) && Number(item.hp) < previous.hp) {
                item._hitAt = receivedAt;
            }
        }
        for (const [id, state] of this._lootBurstStates) {
            if (receivedAt >= state.endAt) this._lootBurstStates.delete(id);
        }

        for (const item of nextLoot) {
            let state = this._lootBurstStates.get(item.id);
            if (state) {
                item._burstStartedAt = state.startedAt;
                item._burstEndAt = state.endAt;
                item._burstSpin = state.spin;
                continue;
            }

            const remainingMs = clamp(Number(item.burstRemainingMs) || 0, 0, 700);
            if (remainingMs <= 0 || !Number.isFinite(item.spawnX) || !Number.isFinite(item.spawnY)) continue;
            const endAt = receivedAt + remainingMs;
            state = {
                startedAt: endAt - 700,
                endAt,
                spin: ((Number(item.burstIndex) || 0) % 2 === 0 ? -1 : 1)
                    * (1.15 + ((Number(item.burstIndex) || 0) % 3) * 0.32),
            };
            this._lootBurstStates.set(item.id, state);
            item._burstStartedAt = state.startedAt;
            item._burstEndAt = state.endAt;
            item._burstSpin = state.spin;

            if (item.source !== 'chest') continue;
            const burstKey = `${item.spawnX}:${item.spawnY}:${Math.round(state.endAt / 50)}`;
            if (this.chestBursts.some(burst => burst.key === burstKey)) continue;
            this.chestBursts.push({
                key: burstKey,
                x: item.spawnX,
                y: item.spawnY,
                tier: item.tier || 'common',
                startedAt: state.startedAt,
                endAt: state.endAt,
            });

            const burstColor = RARITY_COLORS[item.tier] || '#f5bd63';
            for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
                const speed = 65 + Math.random() * 105;
                const shard = i < 9;
                this.particles.push({
                    x: item.spawnX,
                    y: item.spawnY - 3,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 0.42 + Math.random() * 0.26,
                    maxLife: 0.68,
                    size: shard ? 3 + Math.random() * 2.5 : 1.5 + Math.random() * 2,
                    color: shard ? (i % 2 ? '#8a5128' : '#c18442') : burstColor,
                    type: shard ? 'chestShard' : 'chestSpark',
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 12,
                });
            }
            this.cameraShake.intensity = Math.min(5, this.cameraShake.intensity + 1.25);
        }
        this._solidLootContainers = nextLoot.filter(item => item.type === 'chest' || item.type === 'deathCrate');
        this._groundWeapons = nextLoot.filter(item => item.type === 'weapon' && item.weaponType);
        return nextLoot;
    }

    _ingestBulletSnapshots(bullets, receivedAt) {
        const activeIds = new Set();
        for (const bullet of bullets) {
            activeIds.add(bullet.id);
            const previous = this._interpBullets.get(bullet.id);
            if (!previous) {
                this._interpBullets.set(bullet.id, {
                    x: bullet.x,
                    y: bullet.y,
                    targetX: bullet.x,
                    targetY: bullet.y,
                    vx: Number(bullet.vx) || 0,
                    vy: Number(bullet.vy) || 0,
                    receivedAt,
                });
                continue;
            }
            if (Math.hypot(bullet.x - previous.x, bullet.y - previous.y) > 220) {
                previous.x = bullet.x;
                previous.y = bullet.y;
            }
            previous.targetX = bullet.x;
            previous.targetY = bullet.y;
            previous.vx = Number(bullet.vx) || 0;
            previous.vy = Number(bullet.vy) || 0;
            previous.receivedAt = receivedAt;
        }
        for (const id of this._interpBullets.keys()) {
            if (!activeIds.has(id)) this._interpBullets.delete(id);
        }
    }

    _advanceBulletInterpolation(dt, now) {
        const alpha = 1 - Math.exp(-Math.min(dt, 0.05) * 46);
        for (const bullet of this.bullets) {
            const state = this._interpBullets.get(bullet.id);
            if (!state) continue;
            // Bullet velocity is expressed per 40 Hz simulation step.
            const leadTicks = clamp((now - state.receivedAt) / 25, 0, 1.15);
            const targetX = state.targetX + state.vx * leadTicks;
            const targetY = state.targetY + state.vy * leadTicks;
            state.x = lerp(state.x, targetX, alpha);
            state.y = lerp(state.y, targetY, alpha);
            bullet.x = state.x;
            bullet.y = state.y;
        }
    }

    updateState(tick) {
        if (!tick) return;
        const receivedAt = Date.now();
        const animationReceivedAt = performance.now();
        const withLocalClocks = (player) => {
            if (!player) return null;
            const meleeRemainingMs = Number(player.meleeRemainingMs) || 0;
            const meleeHand = player.meleeHand || 'top';
            const previousPlayer = this._playersById.get(player.id);
            const continuingMelee = meleeRemainingMs > 0
                && previousPlayer?.meleeUntil > receivedAt
                && previousPlayer.meleeStartedAt > 0
                && previousPlayer.meleeHand === meleeHand
                && previousPlayer.weapon === player.weapon;
            const estimatedMeleeStartedAt = receivedAt
                - Math.max(0, MELEE_ANIMATION_MS - meleeRemainingMs);
            return {
                ...player,
                reloadEndAtLocal: player.reloading
                    ? receivedAt + Math.max(0, Number(player.reloadRemainingMs) || 0)
                    : 0,
                meleeStartedAt: meleeRemainingMs > 0
                    ? continuingMelee ? previousPlayer.meleeStartedAt : estimatedMeleeStartedAt
                    : player.meleeStartedAt || 0,
                meleeUntil: meleeRemainingMs > 0
                    ? continuingMelee ? previousPlayer.meleeUntil : estimatedMeleeStartedAt + MELEE_ANIMATION_MS
                    : player.meleeUntil || 0,
                meleeHand,
            };
        };


        const rawMe = tick.you || (tick.players || []).find(p => p.isYou || p.id === this.myId);
        const me = withLocalClocks(rawMe);
        this._ingestLocalSnapshot(me, animationReceivedAt);
        const rawPlayers = (tick.players || []).map(withLocalClocks);
        this.players = me
            ? [me, ...rawPlayers.filter(p => p.id !== me.id && !p.isYou)]
            : rawPlayers;
        this._playersById.clear();
        for (const player of this.players) this._playersById.set(player.id, player);
        this.loot = this._ingestLootSnapshots(tick.loot || [], receivedAt);
        this.deathMarkers = Array.isArray(tick.deathMarkers) ? tick.deathMarkers : [];
        const activeMarkerIds = new Set();
        for (const marker of this.deathMarkers) {
            activeMarkerIds.add(marker.id);
            if (!this._graveFirstSeenAt.has(marker.id)) this._graveFirstSeenAt.set(marker.id, receivedAt);
            if (this._seenDeathMarkerIds.has(marker.id)) continue;
            this._seenDeathMarkerIds.add(marker.id);
            if (marker.killerId === this.myId) {
                this.killAnimations.push({
                    id: marker.id,
                    victimName: marker.victimName || 'Player',
                    weaponType: marker.weaponType || 'fists',
                    spawnedAt: receivedAt,
                    duration: 1350,
                });
                for (let i = 0; i < 14; i++) {
                    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.18;
                    const speed = 55 + Math.random() * 90;
                    this.particles.push({
                        x: marker.x,
                        y: marker.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 0.45 + Math.random() * 0.25,
                        maxLife: 0.7,
                        size: 1.8 + Math.random() * 2.2,
                        color: i % 3 === 0 ? '#ffd166' : '#ef544f',
                        type: 'killBurst',
                    });
                }
            }
        }
        for (const id of this._graveFirstSeenAt.keys()) {
            if (!activeMarkerIds.has(id)) this._graveFirstSeenAt.delete(id);
        }

        // Accumulate walk cycle & bob for each player
        const activePlayerIds = new Set();
        for (const p of this.players) {
            activePlayerIds.add(p.id);
            const prevPos = this._prevPlayers.get(p.id) || { x: p.x, y: p.y };
            const distMoved = Math.hypot(p.x - prevPos.x, p.y - prevPos.y);
            if (distMoved > 0.05 && distMoved < 40) {
                p.walkCycle = (p.walkCycle || 0) + distMoved * 0.16;
                p.walkBob = Math.sin(p.walkCycle);
            } else {
                p.walkBob = (p.walkBob || 0) * 0.85;
                if (Math.abs(p.walkBob) < 0.01) p.walkBob = 0;
            }
            this._prevPlayers.set(p.id, { x: p.x, y: p.y });
        }
        for (const playerId of this._prevPlayers.keys()) {
            if (!activePlayerIds.has(playerId)) this._prevPlayers.delete(playerId);
        }
        while (this._seenDeathMarkerIds.size > 200) {
            this._seenDeathMarkerIds.delete(this._seenDeathMarkerIds.values().next().value);
        }

        // Track disappeared bullets for impact particles
        const prevBullets = this.bullets || [];
        const currentBulletIds = new Set((tick.bullets || []).map(b => b.id));
        for (const b of prevBullets) {
            if (!currentBulletIds.has(b.id)) {
                if ((b.isGrenade || b.weaponType === 'grenade') && (!b.detonateAt || Date.now() + 140 >= b.detonateAt)) {
                    this.spawnGrenadeExplosion(b.x, b.y);
                    continue;
                }
                // Bullet disappeared! Spawn impact particles at b.x, b.y
                const angle = Math.atan2(b.vy || 0, b.vx || 1);
                let hitType = 'spark'; // Default spark
                let hitColor = '#ffd45a';

                // Check if near any player (excluding owner, though target confirms are handled specifically, general debris is nice)
                const hitPlayer = this.players.find(p => (p.hp || 0) > 0 && Math.hypot(p.x - b.x, p.y - b.y) < 22);
                if (hitPlayer) {
                    hitType = 'blood';
                    hitColor = '#ef544f';
                    this.spawnBloodDecal(b.x, b.y);
                } else {
                    // Check if near any obstacle
                    const hitObstacle = this.findCollisionObstacleAt(b.x, b.y, 18);
                    if (hitObstacle) {
                        if (hitObstacle.kind === 'tree' || hitObstacle.variant === 'wood' || hitObstacle.kind === 'crate') {
                            hitType = 'wood';
                            hitColor = '#8c5b2f';
                        } else if (hitObstacle.kind === 'rock' || hitObstacle.variant === 'stone') {
                            hitType = 'rock';
                            hitColor = '#7a7a7a';
                        } else if (hitObstacle.kind === 'container' || hitObstacle.kind === 'wall') {
                            hitType = 'spark';
                            hitColor = '#ffd45a';
                        }
                    }
                }

                // Spawn 3-6 particles spraying in opposite direction of bullet
                const count = hitType === 'blood' ? 6 : hitType === 'spark' ? 3 : 4;
                for (let i = 0; i < count; i++) {
                    const spread = (Math.random() - 0.5) * 1.2;
                    const pAngle = angle + Math.PI + spread; // Spray backwards
                    const speed = 40 + Math.random() * 80;
                    this.particles.push({
                        x: b.x,
                        y: b.y,
                        vx: Math.cos(pAngle) * speed,
                        vy: Math.sin(pAngle) * speed,
                        life: 0.2 + Math.random() * 0.15,
                        maxLife: 0.35,
                        size: hitType === 'blood' ? 2.5 + Math.random() * 2 : 1.5 + Math.random() * 2,
                        color: hitColor,
                        type: hitType,
                    });
                }
            }
        }
        if (this.particles.length > 110) {
            this.particles.splice(0, this.particles.length - 110);
        }
        const nextBullets = tick.bullets || [];
        this._ingestBulletSnapshots(nextBullets, animationReceivedAt);
        this.bullets = nextBullets;
        // Static world snapshots may arrive less frequently than movement
        // ticks. Retain the last snapshot when omitted, and only rebuild the
        // expensive render cache when its actual contents changed.
        if (Array.isArray(tick.obstacles)) {
            const nextObstacles = this.mergeObstaclePatch(tick.obstacles, tick.obstaclePatch);
            const previousObstacles = new Map(this.obstacles.map(obstacle => [obstacle.id, obstacle]));
            for (const obstacle of nextObstacles) {
                const previous = previousObstacles.get(obstacle.id);
                if (previous?._hitAt) obstacle._hitAt = previous._hitAt;
                if (previous && Number.isFinite(previous.hp) && obstacle.hp < previous.hp) {
                    obstacle._hitAt = receivedAt;
                }
            }
            const nextSignature = obstacleRenderSignature(nextObstacles);
            if (nextSignature !== this._obstacleRenderSignature) {
                // Streamed map patches can add a road or terrain spline to an
                // area whose chunk was previously cached as empty. Invalidate
                // only the affected tiles; keeping unrelated chunks prevents a
                // full-screen cache flash whenever the player enters a new area.
                for (const obstacle of nextObstacles) {
                    const previous = previousObstacles.get(obstacle.id);
                    if (SURFACE_KINDS.has(obstacle.kind)) {
                        if (!hasSameSurfaceGeometry(previous, obstacle)) {
                            this.invalidateSurfaceChunksForObstacle(previous);
                            this.invalidateSurfaceChunksForObstacle(obstacle);
                        }
                    } else if (SURFACE_KINDS.has(previous?.kind)) {
                        this.invalidateSurfaceChunksForObstacle(previous);
                    }
                }
                this.obstacles = nextObstacles;
                this._obstacleRenderSignature = nextSignature;
                this.rebuildObstacleRenderCache();
            } else {
                // Damage changes a prop's appearance but not its render geometry.
                // Preserve cached identities instead of rebuilding every structure
                // bucket and surface texture for a single HP update.
                for (const obstacle of nextObstacles) {
                    const previous = previousObstacles.get(obstacle.id);
                    if (!previous) continue;
                    previous.hp = obstacle.hp;
                    previous.maxHp = obstacle.maxHp;
                    previous.destructible = obstacle.destructible;
                    if (obstacle._hitAt) previous._hitAt = obstacle._hitAt;
                }
            }
        }
        this.zone = tick.zone || null;
        if (tick.minimap) this.minimap = tick.minimap;

        // Count alive players
        this.aliveCount = tick.aliveCount ?? rawPlayers.filter(p => (p.hp || 0) > 0).length;

        // Store interpolation targets for remote players
        for (const p of this.players) {
            if (p.isYou || p.id === this.myId) continue;
            const prev = this._interpPlayers.get(p.id);
            if (prev) {
                prev.targetX = p.x;
                prev.targetY = p.y;
                prev.targetAngle = p.angle || 0;
            } else {
                this._interpPlayers.set(p.id, {
                    x: p.x, y: p.y, angle: p.angle || 0,
                    targetX: p.x, targetY: p.y, targetAngle: p.angle || 0,
                });
            }
        }
        // Clean up disconnected players
        const activeIds = new Set(this.players.map(p => p.id));
        for (const [id] of this._interpPlayers) {
            if (!activeIds.has(id)) this._interpPlayers.delete(id);
        }

        this.me = me || null;
        if (me?.lastLoot && me.lastLoot.id !== this.lastLootId) {
            this.lastLootId = me.lastLoot.id;
            this.lootToast = { ...me.lastLoot, shownAt: Date.now(), expiresAt: Date.now() + 2200 };
            this.inventoryOpen = true;
        }
        if (me) {
            // Detect damage taken → spawn damage indicator + screen shake
            const hpDelta = (me.hp || 0) - this._prevHp;
            if (hpDelta < -0.5 && this._prevHp > 0) {
                const dmgAmt = Math.abs(hpDelta);
                const hasServerSource = Number.isFinite(tick.damageTaken?.sourceX)
                    && Number.isFinite(tick.damageTaken?.sourceY);
                const isZoneDamage = !hasServerSource && me.outsideZone;
                if (!isZoneDamage) {
                    // Camera shake proportional to direct combat damage.
                    this.cameraShake.intensity += clamp(dmgAmt * 0.3, 1, 8);
                    let damageAngle = null;
                    if (hasServerSource) {
                        damageAngle = Math.atan2(tick.damageTaken.sourceY - me.y, tick.damageTaken.sourceX - me.x);
                    } else {
                        const enemies = rawPlayers.filter(p => !p.isYou && p.id !== this.myId && (p.hp || 0) > 0);
                        if (enemies.length > 0) {
                            let closest = enemies[0];
                            let closestDist = Infinity;
                            for (const enemy of enemies) {
                                const distance = Math.hypot(enemy.x - me.x, enemy.y - me.y);
                                if (distance < closestDist) { closestDist = distance; closest = enemy; }
                            }
                            damageAngle = Math.atan2(closest.y - me.y, closest.x - me.x);
                        }
                    }
                    if (damageAngle != null) {
                        this.damageIndicators.push({
                            angle: damageAngle,
                            spawnedAt: Date.now(),
                            duration: 900,
                            intensity: clamp(dmgAmt / 30, 0.4, 1),
                        });
                    }
                    this.damageNumbers.push({
                        x: me.x + (Math.random() - 0.5) * 16,
                        y: me.y - 20,
                        amount: Math.round(dmgAmt),
                        spawnedAt: Date.now(),
                        duration: 900,
                        color: '#ff4444',
                    });
                }
            }
            this._prevHp = me.hp || 0;

            // Detect shots fired → muzzle flash + camera recoil
            if (this._prevAmmo >= 0 && me.ammo < this._prevAmmo && me.weapon === this._prevWeapon && me.weapon !== 'fists' && !me.reloading) {
                this._muzzleFlash = 1.0;
                const shakeAmt = WEAPON_SHAKE[me.weapon] || 1;
                this.cameraShake.intensity += shakeAmt;
                // Spawn muzzle flash particles
                const angle = me.angle || 0;
                const barrelDist = weaponMuzzleDistance(me.weapon);
                const bx = me.x + Math.cos(angle) * barrelDist;
                const by = me.y + Math.sin(angle) * barrelDist;
                // Predict a short local tracer immediately. A close-range shot can
                // hit between server snapshots and otherwise never be rendered.
                const pelletCount = me.weapon === 'shotgun' ? 3 : 1;
                const speed = (WEAPON_BULLET_SPEED[me.weapon] || 38) * 40;
                for (let i = 0; i < pelletCount; i++) {
                    const spread = pelletCount > 1 ? (i - (pelletCount - 1) / 2) * 0.1 : 0;
                    this.localShotTracers.push({
                        id: `local:${receivedAt}:${i}`,
                        x: bx,
                        y: by,
                        vx: Math.cos(angle + spread) * speed,
                        vy: Math.sin(angle + spread) * speed,
                        weaponType: me.weapon,
                        life: 0.11,
                    });
                }
                for (let i = 0; i < 2; i++) {
                    const spread = (Math.random() - 0.5) * 0.6;
                    const speed = 60 + Math.random() * 80;
                    this.particles.push({
                        x: bx, y: by,
                        vx: Math.cos(angle + spread) * speed,
                        vy: Math.sin(angle + spread) * speed,
                        life: 0.15 + Math.random() * 0.1,
                        maxLife: 0.2,
                        size: 2 + Math.random() * 3,
                        color: Math.random() > 0.5 ? '#ffdd44' : '#ff8800',
                        type: 'muzzle',
                    });
                }
            }
            this._prevAmmo = me.ammo ?? this._prevAmmo;

            // Detect weapon switch → animation
            if (me.weapon !== this._prevWeapon) {
                this._weaponSwitchT = 1.0;
                this._weaponSwitchFrom = this._prevWeapon;
                this._prevWeapon = me.weapon;
            }

            // Low ammo warning pulse
            if (me.weapon !== 'fists' && !me.reloading && me.ammo <= 3 && me.ammo > 0) {
                this._lowAmmoPulse = Math.max(this._lowAmmoPulse, 0.5);
            }

            this.hud.hp = me.hp;
            this.hud.maxHp = me.maxHp;
            this.hud.armor = me.armor;
            this.hud.weapon = me.weapon;
            this.hud.ammo = me.ammo;
            this.hud.clipSize = me.clipSize;
            this.hud.reloading = me.reloading;
            this.hud.kills = me.kills;
            if (me.inventory) this.hud.inventory = me.inventory;
        }
        if (tick.dollarBalance != null) {
            this.hud.balance = tick.dollarBalance;
        }

        // Kill feed from server
        if (tick.killFeed) {
            for (const entry of tick.killFeed) {
                this.killFeed.push({ ...entry, shownAt: Date.now() });
            }
        }
        // Also detect kills from the 'you' data
        if (tick.killNotify) {
            this.killFeed.push({
                killer: me?.username || 'You',
                victim: tick.killNotify.victim || 'Player',
                weapon: tick.killNotify.weapon || me?.weapon || 'fists',
                shownAt: Date.now(),
            });
            // Hit marker for kill
            this.hitMarkers.push({ spawnedAt: Date.now(), duration: 600, kill: true });
        }
        // Detect hit events
        if (tick.hitConfirm) {
            this.hitMarkers.push({
                spawnedAt: Date.now(),
                duration: tick.hitConfirm.kill ? 560 : 350,
                kill: !!tick.hitConfirm.kill,
            });
            // Spawn damage number on target
            if (tick.hitConfirm.targetX != null) {
                this.damageNumbers.push({
                    x: tick.hitConfirm.targetX + (Math.random() - 0.5) * 10,

                    y: tick.hitConfirm.targetY - 18,
                    amount: Math.round(tick.hitConfirm.damage || 0),
                    spawnedAt: Date.now(),
                    duration: 800,
                    color: '#ffffff',
                });
            }
        }
        // Keep kill feed trimmed
        const now = Date.now();
        this.killFeed = this.killFeed.filter(e => now - e.shownAt < 5000);
    }

    screenToWorld(sx, sy) {
        const cx = this.viewW / 2;
        const cy = this.viewH / 2;
        return {
            x: (sx - cx) / this.zoom + this.camera.x,
            y: (sy - cy) / this.zoom + this.camera.y,
        };
    }

    setMobileMove(dx, dy) {
        if (Math.hypot(Number(dx) || 0, Number(dy) || 0) > 0.08) unlockGameAudio();
        this.mobileMove.x = clamp(Number(dx) || 0, -1, 1);
        this.mobileMove.y = clamp(Number(dy) || 0, -1, 1);
    }

    setMobileAim(dx, dy, magnitude = 0) {
        const strength = clamp(Number(magnitude) || 0, 0, 1);
        this.mobileAim.strength = strength;
        this.mobileAim.active = strength > 0.08;
        if (this.mobileAim.active) {
            this.mobileAim.angle = Math.atan2(Number(dy) || 0, Number(dx) || 0);
        }
        this.mobileAim.shooting = strength > 0.3;
    }

    clearMobileInput() {
        this.mobileMove.x = 0;
        this.mobileMove.y = 0;
        this.mobileAim.strength = 0;
        this.mobileAim.active = false;
        this.mobileAim.shooting = false;
    }

    clearInput() {
        this.keys.w = false;
        this.keys.a = false;
        this.keys.s = false;
        this.keys.d = false;
        this.mouse.down = false;
        this.clearMobileInput();
    }

    _getLocalMoveVector() {
        const result = this._localMoveVector;
        if (!this.inputEnabled || this.spectatorMode) {
            result.dx = 0;
            result.dy = 0;
            return result;
        }
        let dx = this.mobileMove.x;
        let dy = this.mobileMove.y;
        if (Math.hypot(dx, dy) < 0.04) {
            dx = 0;
            dy = 0;
            if (this.keys.w) dy -= 1;
            if (this.keys.s) dy += 1;
            if (this.keys.a) dx -= 1;
            if (this.keys.d) dx += 1;
        }
        const len = Math.hypot(dx, dy);
        if (len > 1) {
            dx /= len;
            dy /= len;
        }
        result.dx = dx;
        result.dy = dy;
        return result;
    }

    getInputPayload() {
        const { dx, dy } = this._getLocalMoveVector();
        // Recalculate mouse world coordinates because camera (and player) moved
        const w = this.screenToWorld(this.mouse.x, this.mouse.y);
        this.mouse.worldX = w.x;
        this.mouse.worldY = w.y;

        const aimOrigin = this.me || this.camera;
        const pointerAimAngle = Math.atan2(
            this.mouse.worldY - aimOrigin.y,
            this.mouse.worldX - aimOrigin.x,
        );
        const aimAngle = this.mobileAim.active ? this.mobileAim.angle : pointerAimAngle;
        const pointerAimDistance = Math.hypot(
            this.mouse.worldX - aimOrigin.x,
            this.mouse.worldY - aimOrigin.y,
        );
        const aimDistance = this.mobileAim.active
            ? 90 + this.mobileAim.strength * 260
            : pointerAimDistance;
        return {
            dx,
            dy,
            aimAngle,
            aimDistance,
            shooting: (this.mouse.down || this.mobileAim.shooting) && this.inputEnabled,
            reload: false,
        };
    }

    handleKeyDown(e) {
        const k = e.key.toLowerCase();
        if (e.repeat && ['r', 'h', 'f', 'g', '1', '2', '3'].includes(k)) return null;
        if (k === 'tab') {
            if (!e.repeat) this.inventoryOpen = !this.inventoryOpen;
            e.preventDefault();
            return null;
        }
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(k)) unlockGameAudio();
        if (k === 'w' || k === 'arrowup') this.keys.w = true;
        if (k === 'a' || k === 'arrowleft') this.keys.a = true;
        if (k === 's' || k === 'arrowdown') this.keys.s = true;
        if (k === 'd' || k === 'arrowright') this.keys.d = true;
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' '].includes(k)) {
            e.preventDefault();
        }
        if (k === 'r') return 'reload';
        if (k === 'h') return 'useMedkit';
        if (k === 'f') {
            const door = this.getNearbyDoor();
            return door ? `toggleDoor:${door.id}` : 'pickupWeapon';
        }
        if (k === 'g') return 'throwGrenade';
        if (k === '1') return 'equipSlot:2';
        if (k === '2') return 'equipSlot:0';
        if (k === '3') return 'equipSlot:1';
        return null;
    }

    handleKeyUp(e) {
        const k = e.key.toLowerCase();
        if (k === 'w' || k === 'arrowup') this.keys.w = false;
        if (k === 'a' || k === 'arrowleft') this.keys.a = false;
        if (k === 's' || k === 'arrowdown') this.keys.s = false;
        if (k === 'd' || k === 'arrowright') this.keys.d = false;
    }

    handlePointerMove(clientX, clientY) {
        // Do not force a layout read for every high-polling-rate mouse event.
        // World coordinates are recalculated from the latest screen position in
        // getInputPayload, where they are actually consumed.
        this.mouse.x = clientX - this._canvasLeft;
        this.mouse.y = clientY - this._canvasTop;
    }

    handlePointerDown() {
        if (!this.inputEnabled || this.spectatorMode) return null;
        unlockGameAudio();
        this.mouse.down = true;
        return null;
    }

    handlePointerUp() {
        this.mouse.down = false;
    }

    updateMovementFeedback() {
        if (!this.me || this.spectatorMode || !this.inputEnabled) {
            this._footstepX = NaN;
            this._footstepY = NaN;
            this._footstepDistance = 0;
            return;
        }

        const x = Number(this.me.x);
        const y = Number(this.me.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (!Number.isFinite(this._footstepX) || !Number.isFinite(this._footstepY)) {
            this._footstepX = x;
            this._footstepY = y;
            return;
        }

        const moved = Math.hypot(x - this._footstepX, y - this._footstepY);
        this._footstepX = x;
        this._footstepY = y;
        const moveInput = this._getLocalMoveVector();
        const inputStrength = Math.hypot(moveInput.dx, moveInput.dy);
        if (inputStrength < 0.08 || moved < 0.001 || moved > 24) {
            if (inputStrength < 0.08 || moved > 24) this._footstepDistance = 0;
            return;
        }

        const surface = this.me.surface === 'water'
            ? 'water'
            : this.me.surface === 'indoor' ? 'indoor' : 'ground';
        if (surface !== this._footstepSurface) {
            this._footstepSurface = surface;
            this._footstepDistance = 0;
        }
        this._footstepDistance += moved;
        const stride = surface === 'water' ? 37 : surface === 'indoor' ? 46 : 52;
        if (this._footstepDistance < stride) return;
        this._footstepDistance %= stride;
        this._footstepIndex += 1;
        playSurvivFootstep(surface, this._footstepIndex);
        if (surface === 'water') this.spawnWaterStepSplash(x, y, moveInput);
    }

    spawnWaterStepSplash(x, y, moveInput) {
        const side = this._footstepIndex % 2 === 0 ? -1 : 1;
        const originX = x - moveInput.dy * side * 6;
        const originY = y + moveInput.dx * side * 6;
        this.particles.push({
            x: originX,
            y: originY,
            vx: 0,
            vy: 0,
            life: 0.42,
            maxLife: 0.42,
            size: 7.5,
            color: '#a9e7f5',
            type: 'waterRing',
        });
        for (let i = 0; i < 3; i++) {
            const angle = Math.atan2(moveInput.dy, moveInput.dx)
                + Math.PI + (i - 1) * 0.62 + (Math.random() - 0.5) * 0.24;
            const speed = 22 + Math.random() * 20;
            this.particles.push({
                x: originX,
                y: originY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.26 + Math.random() * 0.09,
                maxLife: 0.35,
                size: 1.7 + Math.random() * 1.4,
                color: '#c5f1fa',
                type: 'waterDroplet',
            });
        }
    }

    mergeObstaclePatch(incoming, patch) {
        if (!Array.isArray(incoming)) return this.obstacles;
        const patchX = Number(patch?.x);
        const patchY = Number(patch?.y);
        const patchRange = Number(patch?.range);
        const retainRange = Math.max(patchRange, Number(patch?.retainRange) || patchRange);
        const hasPatch = Number.isFinite(patchX) && Number.isFinite(patchY) && patchRange > 0;
        const incomingById = new Map(incoming.map(obstacle => [obstacle.id, obstacle]));
        if (hasPatch) {
            for (const obstacle of this.obstacles) {
                if (!obstacle?.id || incomingById.has(obstacle.id)) continue;
                const halfW = Math.abs(Number(obstacle._renderHalfW ?? obstacle.w / 2) || 0);
                const halfH = Math.abs(Number(obstacle._renderHalfH ?? obstacle.h / 2) || 0);
                const intersectsPatch = Math.abs(obstacle.x - patchX) <= patchRange + halfW
                    && Math.abs(obstacle.y - patchY) <= patchRange + halfH;
                const insideRetention = Math.abs(obstacle.x - patchX) <= retainRange + halfW
                    && Math.abs(obstacle.y - patchY) <= retainRange + halfH;
                if (!intersectsPatch && insideRetention) incomingById.set(obstacle.id, obstacle);
            }
        }
        return [...incomingById.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }
    rebuildObstacleRenderCache() {
        this.houseFloors = [];
        this.roomZones = [];
        this.doorways = [];
        this.surfaceObstacles = [];
        this.fieldObstacles = [];
        this.waterObstacles = [];
        this.roadObstacles = [];
        this.roadJunctionObstacles = [];
        this.bridgeObstacles = [];
        this._roomZonesByHouseId.clear();
        this._doorwaysByHouseId.clear();
        this._interiorFogHouseIds.clear();
        this._losSegmentsByHouseId.clear();
        this._losVerticesByHouseId.clear();
        this._renderObstaclesByHouseId.clear();
        this._collisionBuckets.clear();
        this._houseBuckets.clear();

        const hasSplineRiver = this.obstacles.some(obstacle => obstacle.kind === 'river_path');
        for (const o of this.obstacles) {
            if (o.kind === 'houseFloor') this.houseFloors.push(o);
            else if (o.kind === 'roomZone') {
                this.roomZones.push(o);
                if (o.houseId) {
                    let rooms = this._roomZonesByHouseId.get(o.houseId);
                    if (!rooms) {
                        rooms = [];
                        this._roomZonesByHouseId.set(o.houseId, rooms);
                    }
                    rooms.push(o);
                }
            } else if (o.kind === 'door') {
                this.doorways.push(o);
                if (o.houseId) {
                    let doors = this._doorwaysByHouseId.get(o.houseId);
                    if (!doors) {
                        doors = [];
                        this._doorwaysByHouseId.set(o.houseId, doors);
                    }
                    doors.push(o);
                }
            }
        }

        const houseCell = this._houseBucketSize;
        for (const house of this.houseFloors) {
            const minX = Math.floor((house.x - house.w / 2) / houseCell);
            const maxX = Math.floor((house.x + house.w / 2) / houseCell);
            const minY = Math.floor((house.y - house.h / 2) / houseCell);
            const maxY = Math.floor((house.y + house.h / 2) / houseCell);
            for (let gx = minX; gx <= maxX; gx++) {
                for (let gy = minY; gy <= maxY; gy++) {
                    const key = gx + ',' + gy;
                    const bucket = this._houseBuckets.get(key);
                    if (bucket) bucket.push(house);
                    else this._houseBuckets.set(key, [house]);
                }
            }
        }

        const housesById = new Map(this.houseFloors.map(h => [h.id, h]));
        this._housesById = housesById;
        if (!housesById.has(this._stableCurrentHouseId)) {
            this._stableCurrentHouseId = null;
            this._stableCurrentRoomId = null;
        }
        const solid = [];
        for (const o of this.obstacles) {
            if (o.kind === 'roomZone') continue;
            const rotation = Number(o.rotation) || 0;
            const cos = Math.abs(Math.cos(rotation));
            const sin = Math.abs(Math.sin(rotation));
            const halfW = Math.abs(Number(o.w) || 0) / 2;
            const halfH = Math.abs(Number(o.h) || 0) / 2;
            o._renderHalfW = cos * halfW + sin * halfH;
            o._renderHalfH = sin * halfW + cos * halfH;

            if (!SURFACE_KINDS.has(o.kind) && o.kind !== 'roomZone') {
                const house = o.houseId
                    ? housesById.get(o.houseId)
                    : this.findHouseContainingPoint(o.x, o.y);
                o._insideHouseId = house?.id || null;
                const houseRooms = house ? (this._roomZonesByHouseId.get(house.id) || []) : [];
                const room = house
                    ? houseRooms.find(r => this.pointInsideRect(r, o.x, o.y, 1))
                    : null;
                o._insideRoomId = room?.id || null;
            }
            if (SURFACE_KINDS.has(o.kind)) {
                this.surfaceObstacles.push(o);
                if (o.kind === 'field') this.fieldObstacles.push(o);
                else if (o.kind === 'road' || o.kind === 'roadJunction' || o.kind === 'trail_path') {
                    this.roadObstacles.push(o);
                    if (o.kind === 'roadJunction') this.roadJunctionObstacles.push(o);
                }
                else if (o.kind === 'bridge') this.bridgeObstacles.push(o);
                else if (o.kind === 'water' || o.kind === 'river_path' || (o.kind === 'river' && !hasSplineRiver)) {
                    this.waterObstacles.push(o);
                }
            } else {
                solid.push(o);
            }
        }
        const roadLayer = obstacle => obstacle.kind === 'trail_path' ? 0 : obstacle.kind === 'road' ? 1 : 2;
        this.roadObstacles.sort((a, b) => roadLayer(a) - roadLayer(b));
        this.rebuildSurfaceChunkSources();
        this.sortedWorldObstacles = solid.sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
        for (const obstacle of this.sortedWorldObstacles) {
            if (!obstacle._insideHouseId) continue;
            const houseObstacles = this._renderObstaclesByHouseId.get(obstacle._insideHouseId);
            if (houseObstacles) houseObstacles.push(obstacle);
            else this._renderObstaclesByHouseId.set(obstacle._insideHouseId, [obstacle]);
        }
        const collisionCell = 400;
        for (const obstacle of solid) {
            if (obstacle.collidable === false || !obstacle.w || !obstacle.h) continue;
            const collisionHalfW = obstacle._renderHalfW ?? obstacle.w / 2;
            const collisionHalfH = obstacle._renderHalfH ?? obstacle.h / 2;
            const minX = Math.floor((obstacle.x - collisionHalfW) / collisionCell);
            const maxX = Math.floor((obstacle.x + collisionHalfW) / collisionCell);
            const minY = Math.floor((obstacle.y - collisionHalfH) / collisionCell);
            const maxY = Math.floor((obstacle.y + collisionHalfH) / collisionCell);
            for (let gx = minX; gx <= maxX; gx++) {
                for (let gy = minY; gy <= maxY; gy++) {
                    const key = gx + ',' + gy;
                    const bucket = this._collisionBuckets.get(key);
                    if (bucket) bucket.push(obstacle);
                    else this._collisionBuckets.set(key, [obstacle]);
                }
            }
        }

        for (const house of this.houseFloors) {
            const huge = house.w >= 430 || house.h >= 330;
            const hasHallway = (this._roomZonesByHouseId.get(house.id) || []).some(r => r.variant === 'hallway');
            if (huge && hasHallway && (house.variant === 'mansion' || house.variant === 'warehouse' || house.variant === 'ironworks')) {
                this._interiorFogHouseIds.add(house.id);
            }

            // Build LOS geometry once per static world snapshot. The complete
            // boundary intentionally seals every doorway while a player is in.
            const minX = house.x - house.w / 2;
            const maxX = house.x + house.w / 2;
            const minY = house.y - house.h / 2;
            const maxY = house.y + house.h / 2;
            const segments = [
                { ax: minX, ay: minY, bx: maxX, by: minY },
                { ax: maxX, ay: minY, bx: maxX, by: maxY },
                { ax: maxX, ay: maxY, bx: minX, by: maxY },
                { ax: minX, ay: maxY, bx: minX, by: minY },
            ];
            const houseObstacles = this._renderObstaclesByHouseId.get(house.id) || [];
            for (const obstacle of houseObstacles) {
                if (!LOS_BLOCKING_KINDS.has(obstacle.kind)) continue;
                const left = obstacle.x - obstacle.w / 2;
                const right = obstacle.x + obstacle.w / 2;
                const top = obstacle.y - obstacle.h / 2;
                const bottom = obstacle.y + obstacle.h / 2;
                segments.push(
                    { ax: left, ay: top, bx: right, by: top },
                    { ax: right, ay: top, bx: right, by: bottom },
                    { ax: right, ay: bottom, bx: left, by: bottom },
                    { ax: left, ay: bottom, bx: left, by: top },
                );
            }
            const vertices = [];
            const seenVertices = new Set();
            for (const segment of segments) {
                segment._losDx = segment.bx - segment.ax;
                segment._losDy = segment.by - segment.ay;
                segment._losMinX = Math.min(segment.ax, segment.bx);
                segment._losMaxX = Math.max(segment.ax, segment.bx);
                segment._losMinY = Math.min(segment.ay, segment.by);
                segment._losMaxY = Math.max(segment.ay, segment.by);
                const endpointPairs = [[segment.ax, segment.ay], [segment.bx, segment.by]];
                for (const [x, y] of endpointPairs) {
                    const key = x + ':' + y;
                    if (seenVertices.has(key)) continue;
                    seenVertices.add(key);
                    vertices.push({ x, y });
                }
            }
            this._losSegmentsByHouseId.set(house.id, segments);
            this._losVerticesByHouseId.set(house.id, vertices);
        }
        this._obstacleRevision++;
        this._losCacheKey = '';
    }

    findCollisionObstacleAt(x, y, padding = 0) {
        const cell = 400;
        const gx = Math.floor(x / cell);
        const gy = Math.floor(y / cell);
        const seen = new Set();
        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                const bucket = this._collisionBuckets.get((gx + ox) + ',' + (gy + oy));
                if (!bucket) continue;
                for (const obstacle of bucket) {
                    if (seen.has(obstacle.id)) continue;
                    seen.add(obstacle.id);
                    if (obstacle.kind === 'door' && obstacle.isOpen) continue;
                    if (this.pointInsideRect(obstacle, x, y, padding)) return obstacle;
                }
            }
        }
        return null;
    }

    setViewBounds(camX, camY, viewW, viewH, z, pad = 160) {
        const halfW = viewW / (2 * z) + pad;
        const halfH = viewH / (2 * z) + pad;
        this._viewLeft = camX - halfW;
        this._viewRight = camX + halfW;
        this._viewTop = camY - halfH;
        this._viewBottom = camY + halfH;
    }

    isObstacleInView(o, pad = 0) {
        const halfW = (o._renderHalfW ?? Math.abs(Number(o.w) || 0) / 2) + pad;
        const halfH = (o._renderHalfH ?? Math.abs(Number(o.h) || 0) / 2) + pad;
        return o.x + halfW >= this._viewLeft && o.x - halfW <= this._viewRight
            && o.y + halfH >= this._viewTop && o.y - halfH <= this._viewBottom;
    }

    isPointInView(x, y, pad = 0) {
        return x + pad >= this._viewLeft && x - pad <= this._viewRight
            && y + pad >= this._viewTop && y - pad <= this._viewBottom;
    }

    collectVisibleObstacles(source, target, pad, currentHouse, currentRoom) {
        target.length = 0;
        for (const obstacle of source) {
            if (this.isObstacleInView(obstacle, pad)
                && this.shouldDrawObstacle(obstacle, currentHouse, currentRoom)) {
                target.push(obstacle);
            }
        }
        return target;
    }

    pointInsideRect(o, x, y, pad = 0) {
        return x >= o.x - o.w / 2 - pad && x <= o.x + o.w / 2 + pad
            && y >= o.y - o.h / 2 - pad && y <= o.y + o.h / 2 + pad;
    }

    findHouseContainingPoint(x, y, inset = -2) {
        const cell = this._houseBucketSize;
        const bucket = this._houseBuckets.get(Math.floor(x / cell) + ',' + Math.floor(y / cell));
        return bucket?.find(house => this.pointInsideRect(house, x, y, inset)) || null;
    }

    getCurrentHouse() {
        if (!this.me) return null;
        const previous = this._housesById.get(this._stableCurrentHouseId);
        if (previous && this.pointInsideRect(previous, this.me.x, this.me.y, 10)) return previous;
        const next = this.findHouseContainingPoint(this.me.x, this.me.y, -6);
        if ((next?.id || null) !== this._stableCurrentHouseId) this._stableCurrentRoomId = null;
        this._stableCurrentHouseId = next?.id || null;
        return next;
    }

    getDoorRevealPreview(currentHouse) {
        if (!this.me || currentHouse) {
            this._doorRevealHouseId = null;
            this._doorRevealDoorId = null;
            this._doorRevealProgress = 0;
            return null;
        }

        const revealStartDistance = 190;
        let nearestDoor = null;
        let nearestDistance = revealStartDistance;
        for (const door of this.doorways) {
            if (door.entranceRole === 'interiorDoor') continue;
            const house = this._housesById.get(door.houseId);
            if (!house || !this.isObstacleInView(house, 120)) continue;
            const side = door.orientation || door.role;
            const onOutsideApproach = side === 'north' ? this.me.y <= door.y + 36
                : side === 'south' ? this.me.y >= door.y - 36
                    : side === 'west' ? this.me.x <= door.x + 36
                        : side === 'east' ? this.me.x >= door.x - 36
                            : true;
            if (!onOutsideApproach) continue;
            const distance = Math.hypot(this.me.x - door.x, this.me.y - door.y);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestDoor = door;
            }
        }

        if (nearestDoor) {
            if (this._doorRevealDoorId !== nearestDoor.id) this._doorRevealProgress = 0;
            this._doorRevealDoorId = nearestDoor.id;
            this._doorRevealHouseId = nearestDoor.houseId;
        }

        const target = nearestDoor ? clamp((revealStartDistance - nearestDistance) / 82, 0, 1) : 0;
        const blend = 1 - Math.exp(-10 * Math.max(0.001, this._frameDt || 1 / 60));
        this._doorRevealProgress += (target - this._doorRevealProgress) * blend;
        if (!nearestDoor && this._doorRevealProgress < 0.015) {
            this._doorRevealHouseId = null;
            this._doorRevealDoorId = null;
            this._doorRevealProgress = 0;
            return null;
        }

        const house = this._housesById.get(this._doorRevealHouseId);
        const door = nearestDoor || this.doorways.find(candidate => candidate.id === this._doorRevealDoorId);
        if (!house || !door) return null;
        return { house, door, progress: this._doorRevealProgress };
    }

    drawDoorRevealPreview(ctx, preview) {
        if (!preview || preview.progress <= 0.01) return;
        const { house, door, progress } = preview;
        const side = door.orientation || door.role;
        const inwardX = side === 'west' ? 1 : side === 'east' ? -1 : 0;
        const inwardY = side === 'north' ? 1 : side === 'south' ? -1 : 0;
        const eased = progress * progress * (3 - 2 * progress);
        const maxRadius = Math.hypot(house.w, house.h) * 0.72;
        const radius = 26 + maxRadius * eased;
        const centerX = door.x + inwardX * radius * 0.24;
        const centerY = door.y + inwardY * radius * 0.24;

        ctx.save();
        ctx.beginPath();
        ctx.rect(house.x - house.w / 2, house.y - house.h / 2, house.w, house.h);
        ctx.clip();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = Math.min(1, 0.3 + eased * 0.7);
        this.drawObstacle(ctx, house);
        for (const obstacle of this._renderObstaclesByHouseId.get(house.id) || []) {
            if (obstacle.kind === 'roomZone' || !this.isObstacleInView(obstacle, 50)) continue;
            this.drawObstacle(ctx, obstacle);
        }
        // Static loot containers belong to the previewed interior too. Keep
        // loose pickups and moving entities hidden, but let players read chest
        // and crate positions before crossing the doorway.
        for (const item of this.loot) {
            if (item.type !== 'chest' && item.type !== 'deathCrate') continue;
            const belongsToHouse = item.houseId === house.id
                || this.pointInsideRect(house, item.x, item.y, -2);
            if (belongsToHouse && this.isObstacleInView(item, 70)) this.drawLoot(ctx, item);
        }
        ctx.restore();
    }

    findRoomContainingPoint(x, y, house = null) {
        const houseId = house?.id || this.findHouseContainingPoint(x, y)?.id;
        if (!houseId) return null;
        return (this._roomZonesByHouseId.get(houseId) || []).find(r => this.pointInsideRect(r, x, y, -1)) || null;
    }

    getCurrentRoom(currentHouse) {
        if (!this.me || !currentHouse) {
            this._stableCurrentRoomId = null;
            return null;
        }
        const rooms = this._roomZonesByHouseId.get(currentHouse.id) || [];
        const previous = rooms.find(room => room.id === this._stableCurrentRoomId);
        if (previous && this.pointInsideRect(previous, this.me.x, this.me.y, 10)) return previous;
        const next = rooms.find(room => this.pointInsideRect(room, this.me.x, this.me.y, -4)) || null;
        this._stableCurrentRoomId = next?.id || null;
        return next;
    }

    usesInteriorFog(house) {
        return !!house && this._interiorFogHouseIds.has(house.id);
    }

    roomVisibilityStrength(room, currentRoom, playerX, playerY) {
        if (!room || !currentRoom) return 0;
        if (room.id === currentRoom.id) return 1;
        const dx = room.x - currentRoom.x;
        const dy = room.y - currentRoom.y;
        const centerDist = Math.hypot(dx, dy);
        const playerDist = Math.hypot(room.x - playerX, room.y - playerY);
        const touches = Math.abs(dx) < (room.w + currentRoom.w) * 0.56
            && Math.abs(dy) < (room.h + currentRoom.h) * 0.56;
        // Adjacent rooms get good visibility
        if (touches && centerDist < Math.max(room.w + currentRoom.w, room.h + currentRoom.h) * 0.82) return 0.55;
        // Nearby rooms get partial visibility based on distance
        if (playerDist < 320) return 0.32;
        if (playerDist < 500) return 0.22;
        // All rooms get minimum ambient visibility (can see contours/walls, not pitch black)
        return 0.15;
    }

    isPointHiddenByRooms(x, y, currentHouse, currentRoom) {
        let house = currentHouse;
        if (currentHouse) {
            if (!this.pointInsideRect(currentHouse, x, y, -2)) return true;
        } else {
            house = this.findHouseContainingPoint(x, y);
        }
        if (!house) return false;
        if (!currentHouse || house.id !== currentHouse.id) return true;
        if (!this.usesInteriorFog(currentHouse)) return false;
        // Houses with no rooms never hide anything.
        const hasRooms = (this._roomZonesByHouseId.get(currentHouse.id)?.length || 0) > 0;
        if (!hasRooms || !currentRoom) return false;
        const room = this.findRoomContainingPoint(x, y, house);
        if (!room || room.id === currentRoom.id) return false;
        const strength = this.roomVisibilityStrength(room, currentRoom, this.me?.x ?? 0, this.me?.y ?? 0);
        return strength <= 0.18;
    }
    shouldDrawObstacle(o, currentHouse, currentRoom) {
        if (o.kind === 'roomZone') return false;
        if (o.kind === 'houseFloor') return !!currentHouse && currentHouse.id === o.id;
        // The exterior is fully shadowed while indoors. Do not spend the frame
        // drawing outdoor roads, water, roofs and props underneath that mask.
        if (currentHouse) {
            const belongsToCurrentHouse = o._insideHouseId === currentHouse.id || o.houseId === currentHouse.id;
            if (!belongsToCurrentHouse) return false;
            if (HOUSE_BOUND_PROP_KINDS.has(o.kind) && o._insideRoomId && currentRoom) {
                return o._insideRoomId === currentRoom.id;
            }
            return true;
        }
        if (o.kind === 'wall' || o.kind === 'interiorWall' || o.kind === 'door') return !o._insideHouseId;
        if (HOUSE_BOUND_PROP_KINDS.has(o.kind)) return !o._insideHouseId;
        return true;
    }
    isLootHidden(l, currentHouse, currentRoom) {
        if (this.isPointHiddenByRooms(l.x, l.y, currentHouse, currentRoom)) return true;
        if (this.isPointHiddenByLineOfSight(l.x, l.y, currentHouse)) return true;
        return false;
    }

    pointInPolygon(x, y, polygon) {
        if (!polygon || polygon.length < 3) return false;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;
            const intersects = ((yi > y) !== (yj > y))
                && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
            if (intersects) inside = !inside;
        }
        return inside;
    }

    isPointHiddenByLineOfSight(x, y, currentHouse) {
        if (!currentHouse || !this.usesInteriorFog(currentHouse)) return false;
        if (!this._currentVisibilityPolygon || this._currentVisibilityHouseId !== currentHouse.id) return false;
        return !this.pointInPolygon(x, y, this._currentVisibilityPolygon);
    }

    isPlayerHidden(p, currentHouse, currentRoom) {
        if (p.isYou || p.id === this.myId) return false;
        if (this.isPointHiddenByRooms(p.x, p.y, currentHouse, currentRoom)) return true;
        return this.isPointHiddenByLineOfSight(p.x, p.y, currentHouse);
    }

    drawRoomShadows(ctx, currentHouse, currentRoom) {
        if (!currentHouse || !this.usesInteriorFog(currentHouse)) return;
        const zones = this._roomZonesByHouseId.get(currentHouse.id) || [];
        if (!zones.length || !currentRoom || !this.me) return;
        ctx.save();

        // Softer base shadow (dimmed, not pitch black)

        ctx.fillStyle = 'rgba(8, 10, 14, 0.42)';
        roundRect(ctx, currentHouse.x - currentHouse.w / 2 + 8, currentHouse.y - currentHouse.h / 2 + 8, currentHouse.w - 16, currentHouse.h - 16, 7);
        ctx.fill();

        // Cut out visible rooms with smooth edges
        ctx.globalCompositeOperation = 'destination-out';
        for (const room of zones) {
            const strength = this.roomVisibilityStrength(room, currentRoom, this.me.x, this.me.y);
            if (strength <= 0) continue;
            const pad = room.id === currentRoom.id ? 38 : 18;
            ctx.globalAlpha = strength;
            // Use softer rounded rectangles for room cutouts
            roundRect(ctx, room.x - room.w / 2 - pad, room.y - room.h / 2 - pad, room.w + pad * 2, room.h + pad * 2, 24);
            ctx.fill();
        }

        // Doorway light leaks — cut light around all doorways in the house
        for (const door of this.doorways) {
            if (door.houseId !== currentHouse.id) continue;
            const doorGlow = ctx.createRadialGradient(door.x, door.y, 8, door.x, door.y, 110);
            doorGlow.addColorStop(0, 'rgba(0,0,0,0.6)');
            doorGlow.addColorStop(0.5, 'rgba(0,0,0,0.25)');
            doorGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 0.65;
            ctx.fillStyle = doorGlow;
            ctx.beginPath();
            ctx.arc(door.x, door.y, 110, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player glow — larger, softer radius so you can see around yourself
        const r = currentHouse.variant === 'mansion' ? 380 : 310;
        const glow = ctx.createRadialGradient(this.me.x, this.me.y, 20, this.me.x, this.me.y, r);
        glow.addColorStop(0, 'rgba(0,0,0,1)');
        glow.addColorStop(0.35, 'rgba(0,0,0,0.85)');
        glow.addColorStop(0.65, 'rgba(0,0,0,0.45)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(this.me.x, this.me.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // Subtle warm border on current room (softer, not harsh)
        ctx.strokeStyle = 'rgba(255, 230, 170, 0.08)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, currentRoom.x - currentRoom.w / 2, currentRoom.y - currentRoom.h / 2, currentRoom.w, currentRoom.h, 12);
        ctx.stroke();
        ctx.restore();
    }

    // ── Among Us-style Line-of-Sight Shadow System ──────────────────────────

    /**
     * Gather wall segments (edges of rectangles) from all solid obstacles
     * that should block line of sight.
     */
    _gatherWallSegments(camX, camY, viewW, viewH, z, currentHouse, px = this.me?.x, py = this.me?.y, maxDist = 900) {
        const source = this._losSegmentsByHouseId.get(currentHouse?.id) || [];
        if (!Number.isFinite(px) || !Number.isFinite(py)) return source;
        const target = this._nearbyLosSegments;
        target.length = 0;
        const range = maxDist + 80;
        const left = px - range;
        const right = px + range;
        const top = py - range;
        const bottom = py + range;
        for (const segment of source) {
            if (segment._losMaxX < left || segment._losMinX > right
                || segment._losMaxY < top || segment._losMinY > bottom) continue;
            target.push(segment);
        }
        return target;
    }
    /**
     * Ray-segment intersection.
     * Returns parameter t along the ray (0 = origin, 1+ = distance).
     * Returns Infinity if no intersection.
     */
    _raySegmentIntersect(rx, ry, rdx, rdy, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const denom = rdx * dy - rdy * dx;
        if (Math.abs(denom) < 1e-10) return Infinity;
        const t = ((ax - rx) * dy - (ay - ry) * dx) / denom;
        const u = ((ax - rx) * rdy - (ay - ry) * rdx) / denom;
        // Keep endpoint hits stable when floating-point rounding puts u a tiny
        // fraction outside the segment on alternating frames.
        if (t >= 0 && u >= -1e-7 && u <= 1 + 1e-7) return t;
        return Infinity;
    }

    /**
     * Cast a single ray from (px,py) at angle, returning the closest intersection point.
     */
    _castRay(px, py, rdx, rdy, segments, maxDist, out) {
        let closest = maxDist;
        for (let i = 0; i < segments.length; i++) {
            const s = segments[i];
            const segmentDx = s._losDx;
            const segmentDy = s._losDy;
            const denominator = rdx * segmentDy - rdy * segmentDx;
            if (Math.abs(denominator) < 1e-10) continue;
            const originDx = s.ax - px;
            const originDy = s.ay - py;
            const t = (originDx * segmentDy - originDy * segmentDx) / denominator;
            if (t < 0 || t >= closest) continue;
            const u = (originDx * rdy - originDy * rdx) / denominator;
            if (u >= -1e-7 && u <= 1 + 1e-7) closest = t;
        }
        out.x = px + rdx * closest;
        out.y = py + rdy * closest;
        return out;
    }

    /**
     * Build a visibility polygon from wall corners plus a coarse range circle.
     * Rays immediately beside each corner stop the visible edge from jumping
     * between fixed angular samples while the player moves.
     */
    _buildVisibilityPolygon(px, py, segments, vertices, maxDist) {
        const baseRayCount = 96;
        const endpointEpsilon = 0.00003;
        const maxEndpointDistSq = (maxDist + 2) * (maxDist + 2);
        const angles = this._losWorkingAngles;
        angles.length = 0;
        for (let i = 0; i < baseRayCount; i++) {
            angles.push((i / baseRayCount) * Math.PI * 2 - Math.PI);
        }
        for (const vertex of vertices) {
            const dx = vertex.x - px;
            const dy = vertex.y - py;
            if (dx * dx + dy * dy > maxEndpointDistSq) continue;
            const angle = Math.atan2(dy, dx);
            angles.push(angle - endpointEpsilon, angle, angle + endpointEpsilon);
        }
        angles.sort((a, b) => a - b);

        const polygon = this._losWorkingPolygon;
        let pointCount = 0;
        let previousAngle = -Infinity;
        for (const angle of angles) {
            if (angle - previousAngle < 1e-8) continue;
            previousAngle = angle;
            const point = polygon[pointCount] || (polygon[pointCount] = { x: 0, y: 0 });
            this._castRay(px, py, Math.cos(angle), Math.sin(angle), segments, maxDist, point);
            pointCount++;
        }
        polygon.length = pointCount;
        return polygon;
    }
    /**
     * Draw Among Us-style line-of-sight shadows using even-odd fill.
     * A large outer rectangle + the visibility polygon are drawn with 'evenodd'
     * fill rule, so only the area OUTSIDE the polygon is filled with darkness.
     */
    drawLineOfSightShadow(ctx, camX, camY, viewW, viewH, z, knownCurrentHouse = null) {
        this._currentVisibilityPolygon = null;
        this._currentVisibilityHouseId = null;
        if (!this.me) return;
        // Only apply shadows inside large houses (mansion, warehouse, hospital, etc.)
        const currentHouse = knownCurrentHouse || this.getCurrentHouse();
        if (!currentHouse || !this.usesInteriorFog(currentHouse)) return;

        const px = this.me.x;
        const py = this.me.y;
        const maxDist = 900;

        const cacheKey = `${currentHouse.id}:${this._obstacleRevision}`;
        let polygon = this._losCachedPolygon;
        const playerMoved = !Number.isFinite(this._losLastPlayerX)
            || Math.hypot(px - this._losLastPlayerX, py - this._losLastPlayerY) >= 0.2;
        const needsRebuild = cacheKey !== this._losCacheKey
            || !polygon
            || playerMoved;
        if (needsRebuild) {
            const segments = this._gatherWallSegments(camX, camY, viewW, viewH, z, currentHouse, px, py, maxDist);
            const vertices = this._losVerticesByHouseId.get(currentHouse.id) || [];
            polygon = this._buildVisibilityPolygon(px, py, segments, vertices, maxDist);
            this._losCacheKey = cacheKey;
            this._losCachedPolygon = polygon;
            this._losLastPlayerX = px;
            this._losLastPlayerY = py;
        }
        if (!polygon || polygon.length < 3) return;
        // Collision/visibility uses the newest authoritative shape immediately.
        this._currentVisibilityPolygon = polygon;
        this._currentVisibilityHouseId = currentHouse.id;

        // Fixed ray directions and the interpolated local player position keep the
        // shadow stable without rounding or softening wall corners.
        const displayPolygon = polygon;

        ctx.save();

        // Shadow color - lighter and more atmospheric for the interior
        ctx.fillStyle = 'rgba(12, 15, 22, 0.65)';

        // Build a single path: big outer rect + visibility polygon
        // Even-odd fill rule means the overlap (the polygon) punches a hole in the rect
        const ext = (viewW + viewH) / z + 1000;
        ctx.beginPath();
        // Outer rectangle (the dark overlay covering the whole world)
        ctx.rect(camX - ext, camY - ext, ext * 2, ext * 2);
        // Visibility polygon
        ctx.moveTo(displayPolygon[0].x, displayPolygon[0].y);
        for (let i = 1; i < displayPolygon.length; i++) {
            ctx.lineTo(displayPolygon[i].x, displayPolygon[i].y);
        }
        ctx.closePath();
        ctx.fill('evenodd');

        // One polygon mask is enough; extra full-screen gradients made large interiors expensive.

        ctx.restore();
    }

    drawExteriorHouseShadow(ctx, camX, camY, viewW, viewH, z, currentHouse) {
        if (!currentHouse) return;
        const ext = (viewW + viewH) / z + 600;
        const inset = 2;
        ctx.save();
        ctx.fillStyle = 'rgba(7, 10, 15, 0.48)';
        ctx.beginPath();
        ctx.rect(camX - ext, camY - ext, ext * 2, ext * 2);
        ctx.rect(
            currentHouse.x - currentHouse.w / 2 + inset,
            currentHouse.y - currentHouse.h / 2 + inset,
            currentHouse.w - inset * 2,
            currentHouse.h - inset * 2,
        );
        ctx.fill('evenodd');
        ctx.restore();
    }

    getNearbyGroundWeapon() {
        if (!this.me) return null;
        let nearest = null;
        let nearestDistanceSq = 58 * 58;
        for (const item of this._groundWeapons) {
            const dx = this.me.x - item.x;
            const dy = this.me.y - item.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < nearestDistanceSq) {
                nearest = item;
                nearestDistanceSq = distanceSq;
            }
        }
        return nearest;
    }

    getNearbyDoor() {
        if (!this.me) return null;
        let nearest = null;
        let nearestDistance = 58;
        for (const door of this.doorways) {
            const angle = -(Number(door.rotation) || 0);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const worldDx = this.me.x - door.x;
            const worldDy = this.me.y - door.y;
            const localX = worldDx * cos - worldDy * sin;
            const localY = worldDx * sin + worldDy * cos;
            const dx = Math.max(0, Math.abs(localX) - door.w / 2);
            const dy = Math.max(0, Math.abs(localY) - door.h / 2);
            const distance = Math.hypot(dx, dy);
            if (distance < nearestDistance) {
                nearest = door;
                nearestDistance = distance;
            }
        }
        return nearest;
    }


    draw(dt = 1 / 60) {
        this._frameDt = dt;
        this._frameNow = Date.now();
        this._roofCacheBuildsThisFrame = 0;
        this._obstacleCacheBuildsThisFrame = 0;
        this._surfaceCacheBuildsThisFrame = 0;
        this._surfaceChunkBuildsThisFrame = 0;
        // A shared budget prevents terrain, props and roofs from all creating
        // large offscreen canvases during the same 7 ms frame.
        this._cacheBuildsThisFrame = 0;
        // FPS counter
        this._fpsFrames++;
        const fpsSampleElapsed = performance.now() - this._fpsLastSampleAt;
        if (fpsSampleElapsed >= 500) {
            this._fpsDisplay = Math.round(this._fpsFrames / (fpsSampleElapsed / 1000));
            this._fpsFrames = 0;
            this._fpsLastSampleAt = performance.now();
        }
        if (this.externalCameraGetter) {
            const cam = this.externalCameraGetter();
            if (cam) {
                this.camera.x = cam.x;
                this.camera.y = cam.y;
                if (cam.zoom) this.zoom = cam.zoom;
            }
        } else if (!this.spectatorMode) {
            this.zoom = lerp(this.zoom, this.targetZoom, 1 - Math.exp(-Math.min(dt, 0.05) * 5));
        }

        const animationNow = performance.now();
        this._advanceInterpolatedWorld(dt, animationNow);
        this._advanceBulletInterpolation(dt, animationNow);
        this.updateMovementFeedback();

        // Update camera shake
        if (this.cameraShake.intensity > 0.05) {
            this.cameraShake.phase += Math.min(dt, 0.05) * 34;
            const phase = this.cameraShake.phase;
            const motionScale = this.reducedMotion ? 0 : (this.isMobileLayout ? 0.72 : 1);
            const intensity = this.cameraShake.intensity * motionScale;
            this.cameraShake.x = (
                Math.sin(phase) * 0.72
                + Math.sin(phase * 2.17 + 0.8) * 0.28
            ) * intensity;
            this.cameraShake.y = (
                Math.cos(phase * 1.31 + 0.35) * 0.72
                + Math.sin(phase * 2.73) * 0.28
            ) * intensity;
            this.cameraShake.intensity *= Math.pow(this.cameraShake.decay, dt * 60);
        } else {
            this.cameraShake.x = 0;
            this.cameraShake.y = 0;
            this.cameraShake.intensity = 0;
        }

        // Decay weapon switch animation
        if (this._weaponSwitchT > 0) this._weaponSwitchT = Math.max(0, this._weaponSwitchT - dt * 6);
        // Decay muzzle flash
        if (this._muzzleFlash > 0) this._muzzleFlash = Math.max(0, this._muzzleFlash - dt * 12);
        // Decay low ammo pulse
        if (this._lowAmmoPulse > 0) this._lowAmmoPulse = Math.max(0, this._lowAmmoPulse - dt * 2);

        // Update particles
        let liveParticleCount = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.type === 'shell' || p.type === 'chestShard') {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
                p.vx *= Math.pow(0.94, dt * 60); // Frame-rate independent air friction
                p.vy *= Math.pow(0.94, dt * 60);
                if (p.rotation !== undefined) {
                    p.rotation += p.rotSpeed * dt;
                    p.rotSpeed *= Math.pow(0.91, dt * 60); // Slow down rotational spin
                }
                // Simulate a tiny brass bounce on the ground
                if (p.bounceCount !== undefined && p.bounceCount < 2) {
                    const speed = Math.hypot(p.vx, p.vy);
                    if (speed < 12 && p.bounceCount === 0) {
                        p.bounceCount = 1;
                        const bAngle = Math.random() * Math.PI * 2;
                        p.vx = Math.cos(bAngle) * 25;
                        p.vy = Math.sin(bAngle) * 25;
                    }
                }
            } else {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
                p.vx *= Math.pow(0.92, dt * 60);
                p.vy *= Math.pow(0.92, dt * 60);
            }
            if (p.life > 0) this.particles[liveParticleCount++] = p;
        }
        this.particles.length = liveParticleCount;

        let liveTracerCount = 0;
        for (const tracer of this.localShotTracers) {
            tracer.x += tracer.vx * dt;
            tracer.y += tracer.vy * dt;
            tracer.life -= dt;
            if (tracer.life > 0) this.localShotTracers[liveTracerCount++] = tracer;
        }
        this.localShotTracers.length = liveTracerCount;

        // Interpolate remote players with the same response at 60, 120 or 144 Hz.
        const interpSpeed = 1 - Math.exp(-Math.min(dt, 0.05) * 18);
        for (const [id, ip] of this._interpPlayers) {
            ip.x = lerp(ip.x, ip.targetX, interpSpeed);
            ip.y = lerp(ip.y, ip.targetY, interpSpeed);
            ip.angle = lerpAngle(ip.angle, ip.targetAngle, interpSpeed);
        }

        const ctx = this.ctx;
        const W = this.viewW;
        const H = this.viewH;
        const camX = this.camera.x + this.cameraShake.x;
        const camY = this.camera.y + this.cameraShake.y;
        const z = this.zoom;
        this.setViewBounds(camX, camY, W, H, z);

        ctx.fillStyle = '#2d5426';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(z, z);
        ctx.translate(-camX, -camY);

        this.drawTerrain(ctx, camX, camY, W, H, z);
        const currentHouse = this.getCurrentHouse();
        const doorRevealPreview = this.getDoorRevealPreview(currentHouse);
        const currentRoom = this.getCurrentRoom(currentHouse);
        const visibleFields = this.collectVisibleObstacles(
            this.fieldObstacles, this._visibleFields, 32, currentHouse, currentRoom,
        );
        const visibleWater = this.collectVisibleObstacles(
            this.waterObstacles, this._visibleWater, 40, currentHouse, currentRoom,
        );
        const visibleRoads = this.collectVisibleObstacles(
            this.roadObstacles, this._visibleRoads, 32, currentHouse, currentRoom,
        );
        const visibleBridges = this.collectVisibleObstacles(
            this.bridgeObstacles, this._visibleBridges, 48, currentHouse, currentRoom,
        );
        const worldObstacleSource = currentHouse
            ? (this._renderObstaclesByHouseId.get(currentHouse.id) || [])
            : this.sortedWorldObstacles;
        const visibleWorldObstacles = this.collectVisibleObstacles(
            worldObstacleSource, this._visibleWorldObstacles, 48, currentHouse, currentRoom,
        );

        const surfacesCached = !currentHouse && this.drawSurfaceChunks(ctx, camX, camY, W, H, z);
        if (!surfacesCached) {
            // Fallback while the nearby chunks warm up. Each chunk is built at
            // most once per frame, avoiding a large loading hitch.
            for (const o of visibleFields) this.drawObstacle(ctx, o);
            for (const o of visibleWater) this.drawObstacleShore(ctx, o);
            for (const o of visibleRoads) this.drawRoadShoulder(ctx, o, false);
            for (const o of visibleWater) this.drawObstacleBody(ctx, o);
            for (const o of visibleRoads) this.drawRoadBody(ctx, o, false);
            for (const o of visibleRoads) this.drawRoadMarkings(ctx, o, false);
        } else {
            // Fields, water and roads are baked into world-anchored chunks. Only
            // the subtle water movement remains dynamic in the steady state.
            for (const o of visibleWater) this.drawWaterAnimation(ctx, o);
        }
        // Draw blood decals on the ground
        this.drawBloodDecals(ctx);

        // Pass 7: Draw bridges (go on top of road/river intersections)
        for (const o of visibleBridges) {
            this.drawObstacle(ctx, o);
        }

        this.drawWorldBorder(ctx);
        if (currentHouse && this.isObstacleInView(currentHouse, 80)) {
            this.drawObstacle(ctx, currentHouse);
        }
        if (!currentHouse) {
            for (const o of this.houseFloors) {
                if ((!currentHouse || currentHouse.id !== o.id) && this.isObstacleInView(o, 80)) this.drawHouseRoof(ctx, o);
            }
            // Main entrances sit on top of the roof edge so a building reads as
            // enterable before the interior reveal begins. Interior doors stay hidden.
            for (const door of this.doorways) {
                if (door.entranceRole !== 'interiorDoor' && this.isObstacleInView(door, 40)) {
                    this.drawObstacle(ctx, door);
                }
            }
        }
        this.drawDoorRevealPreview(ctx, doorRevealPreview);
        for (const o of visibleWorldObstacles) {
            this.drawObstacle(ctx, o);
        }
        this.drawDeathMarkers(ctx, currentHouse);
        // Only use the new LOS shadow system (replaces old room shadows)
        this.drawLineOfSightShadow(ctx, camX, camY, W, H, z, currentHouse);

        // Draw zone (gas circle)
        this.drawZone(ctx);

        this.drawChestBursts(ctx, currentHouse, currentRoom);
        for (const l of this.loot) {
            if (this.isPointInView(l.x, l.y, 70) && !this.isLootHidden(l, currentHouse, currentRoom)) this.drawLoot(ctx, l);
        }
        for (const b of this.bullets) {
            if (this.isPointInView(b.x, b.y, 110) && !this.isPointHiddenByRooms(b.x, b.y, currentHouse, currentRoom)) this.drawBullet(ctx, b);
        }
        for (const b of this.localShotTracers) {
            if (this.isPointInView(b.x, b.y, 110) && !this.isPointHiddenByRooms(b.x, b.y, currentHouse, currentRoom)) {
                this.drawBullet(ctx, b);
            }
        }

        // Draw players with interpolation
        for (const p of this.players) {
            const isMe = p.isYou || p.id === this.myId;
            if (!isMe) {
                // Apply interpolated positions before visibility checks so enemies do not
                // leak through house shadows from an older server position.
                const ip = this._interpPlayers.get(p.id);
                if (ip) {
                    p.x = ip.x;
                    p.y = ip.y;
                    p.angle = ip.angle;
                }
            }
            if (!this.isPointInView(p.x, p.y, 90)) continue;
            if (this.isPlayerHidden(p, currentHouse, currentRoom)) continue;
            this.drawPlayer(ctx, p);
        }

        const emoteNow = performance.now();
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${32 / this.zoom}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        for (const [playerId, activeEmote] of this.worldEmotes) {
            if (activeEmote.expiresAt <= emoteNow) { this.worldEmotes.delete(playerId); continue; }
            const player = this._playersById.get(playerId);
            if (!player || !this.isPointInView(player.x, player.y, 90)) continue;
            if (this.isPlayerHidden(player, currentHouse, currentRoom)) continue;
            const progress = Math.min(1, (emoteNow - activeEmote.startedAt) / 2600);
            ctx.globalAlpha = Math.min(1, (1 - progress) * 3);
            const emoteX = player.x;
            const emoteY = player.y - (player.radius || 14) - (28 + progress * 10) / this.zoom;
            if (!drawGameEmote(ctx, activeEmote.emote, emoteX, emoteY, 42 / this.zoom)) {
                ctx.fillText(activeEmote.emote, emoteX, emoteY);
            }
        }
        ctx.restore();

        const chatNow = performance.now();
        ctx.save();
        for (const [playerId, activeChat] of this.worldChats) {
            if (activeChat.expiresAt <= chatNow) { this.worldChats.delete(playerId); continue; }
            const player = this._playersById.get(playerId);
            if (!player || !this.isPointInView(player.x, player.y, 90)) continue;
            if (this.isPlayerHidden(player, currentHouse, currentRoom)) continue;
            const progress = Math.min(1, (chatNow - activeChat.startedAt) / 4000);
            ctx.globalAlpha = Math.min(1, (1 - progress) * 3);
            const chatX = player.x;
            const emoteOffset = (this.worldEmotes.get(playerId)?.expiresAt ?? 0) > chatNow ? 52 : 0;
            const chatY = player.y - (player.radius || 14) - (28 + progress * 10 + emoteOffset) / this.zoom;
            drawChatBubble(ctx, activeChat.message, chatX, chatY, 13 / this.zoom);
        }
        ctx.restore();

        // Draw grenade blast waves and particles (world space)
        this.drawGrenadeExplosions(ctx, currentHouse, currentRoom);
        this.drawParticles(ctx, currentHouse, currentRoom);

        // Draw floating damage numbers (world space)
        this.drawDamageNumbers(ctx, currentHouse, currentRoom);

        // Softly shade the exterior while all moving entities stay hidden.
        this.drawExteriorHouseShadow(ctx, camX, camY, W, H, z, currentHouse);

        ctx.restore();

        // Screen-space overlays
        // Keep the local balance badge out of the zoomed/shaking world transform.
        // Snapping its anchor to whole CSS pixels prevents text from becoming
        // blurry while the camera smoothly follows a moving player.
        const localPlayer = this.me || this._playersById.get(this.myId);
        if (localPlayer && !this.isPlayerHidden(localPlayer, currentHouse, currentRoom)) {
            const screenX = Math.round((localPlayer.x - this.camera.x) * z + W / 2);
            const playerScreenY = (localPlayer.y - this.camera.y) * z + H / 2;
            const screenY = Math.round(playerScreenY + (localPlayer.radius || 14) * z + 7);
            const balance = this.hud.balance ?? localPlayer.dollarBalance ?? 0;
            if (!this.drawLocalBalanceBadge(screenX, screenY, balance)) {
                drawBalanceBadge(ctx, screenX, screenY, balance, true);
            }
        } else if (this.balanceCanvas) {
            this.balanceCanvas.style.visibility = 'hidden';
        }
        this.drawMobileAimGuide(ctx);
        this.drawCrosshair(ctx);
        this.drawVignette(ctx, W, H);
        this.drawDamageIndicators(ctx, W, H);
        this.drawHitMarkers(ctx, W, H);
        this.drawKillAnimation(ctx, W, H);
        this.drawKillFeed(ctx, W, H);
        this.drawLowAmmoWarning(ctx, W, H);
        this.drawMinimapPanel(ctx, W, H);
        this.drawLootToast(ctx, W, H);
        if (import.meta.env.DEV) this.drawFpsCounter(ctx, W, H);
    }

    getTerrainPattern(ctx) {
        if (this._terrainPattern) return this._terrainPattern;
        if (typeof document === 'undefined' || typeof ctx.createPattern !== 'function') return null;

        try {
            if (!this._terrainTexture) {
                const tile = 96;
                const size = tile * 8;
                const textureScale = 1.5;
                const texture = document.createElement('canvas');
                texture.width = Math.round(size * textureScale);
                texture.height = Math.round(size * textureScale);
                const textureCtx = texture.getContext('2d');
                if (!textureCtx) return null;
                textureCtx.scale(textureScale, textureScale);
                this._terrainTexture = texture;
                this._terrainTextureScale = textureScale;
                this.drawTerrain(textureCtx, size / 2, size / 2, size, size, 1, false);
            }
            this._terrainPattern = ctx.createPattern(this._terrainTexture, 'repeat');
            if (this._terrainPattern?.setTransform && typeof DOMMatrix !== 'undefined') {
                const textureScale = this._terrainTextureScale || 1;
                this._terrainPattern.setTransform(new DOMMatrix([
                    1 / textureScale, 0, 0, 1 / textureScale, 0, 0,
                ]));
            }
        } catch {
            this._terrainPattern = null;
        }
        return this._terrainPattern;
    }

    drawTerrain(ctx, camX, camY, viewW, viewH, z, allowPattern = true) {
        const tile = 96;
        const halfW = viewW / z / 2 + tile;
        const halfH = viewH / z / 2 + tile;

        if (allowPattern) {
            const terrainPattern = this.getTerrainPattern(ctx);
            if (terrainPattern) {
                ctx.fillStyle = terrainPattern;
                ctx.fillRect(camX - halfW, camY - halfH, halfW * 2, halfH * 2);
                return;
            }
        }

        const startX = Math.floor((camX - halfW) / tile) * tile;
        const endX = Math.ceil((camX + halfW) / tile) * tile;
        const startY = Math.floor((camY - halfH) / tile) * tile;
        const endY = Math.ceil((camY + halfH) / tile) * tile;

        const viewBiome = biomeAt(camX, camY);
        ctx.fillStyle = viewBiome.base;
        ctx.fillRect(camX - halfW, camY - halfH, halfW * 2, halfH * 2);

        for (let x = startX; x <= endX; x += tile) {
            for (let y = startY; y <= endY; y += tile) {
                const n = seededNoise(x / tile, y / tile);
                const n2 = seededNoise(x / tile + 100, y / tile + 100);
                const b = biomeAt(x + tile / 2, y + tile / 2);

                // Subtle color variation per tile
                if (n > 0.55) {
                    ctx.fillStyle = n > 0.72 ? b.grass : `rgba(52,92,42,${0.08 + n2 * 0.1})`;
                    ctx.fillRect(x, y, tile, tile);
                } else {
                    ctx.fillStyle = `rgba(180,172,130,${0.02 + n * 0.04})`;
                    ctx.fillRect(x, y, tile, tile);
                }

                // Multiple organic grass patches
                if (n > 0.68) {
                    ctx.fillStyle = b.grass;
                    // Primary grass blob
                    ctx.beginPath();
                    ctx.ellipse(
                        x + tile * (0.3 + n2 * 0.4),
                        y + tile * (0.3 + n * 0.4),
                        tile * (0.12 + n2 * 0.14),
                        tile * (0.04 + n * 0.04),
                        n * 5, 0, Math.PI * 2
                    );
                    ctx.fill();
                }
                if (n > 0.82) {
                    // Secondary small grass tuft
                    ctx.fillStyle = `rgba(38,78,32,${0.18 + n2 * 0.12})`;
                    ctx.beginPath();
                    ctx.ellipse(
                        x + tile * (0.6 + n * 0.25),
                        y + tile * (0.2 + n2 * 0.5),
                        tile * 0.08, tile * 0.03,
                        n2 * 3, 0, Math.PI * 2
                    );
                    ctx.fill();
                }
                if (n > 0.92) {
                    // Third tiny detail patch
                    ctx.fillStyle = 'rgba(28,65,24,0.14)';
                    ctx.beginPath();
                    ctx.arc(x + tile * n2, y + tile * n, tile * 0.06, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Softer, more subtle grid
        ctx.strokeStyle = 'rgba(20,35,22,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += tile) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += tile) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    }

    drawWorldBorder(ctx) {
        const wh = this.worldHalf;
        ctx.strokeStyle = 'rgba(24, 32, 28, 0.65)';
        ctx.lineWidth = 18;
        ctx.strokeRect(-wh, -wh, wh * 2, wh * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-wh + 10, -wh + 10, wh * 2 - 20, wh * 2 - 20);
    }

    drawZone(ctx) {
        if (!this.zone) return;
        const { x, y, radius, targetX, targetY, targetRadius } = this.zone;
        if (!radius || radius <= 0) return;

        const left = this._viewLeft;
        const right = this._viewRight;
        const top = this._viewTop;
        const bottom = this._viewBottom;
        const nearestX = clamp(x, left, right);
        const nearestY = clamp(y, top, bottom);
        const minViewDistance = Math.hypot(nearestX - x, nearestY - y);
        const maxViewDistance = Math.max(
            Math.hypot(left - x, top - y),
            Math.hypot(right - x, top - y),
            Math.hypot(left - x, bottom - y),
            Math.hypot(right - x, bottom - y),
        );
        const borderVisible = minViewDistance <= radius + 28 && maxViewDistance >= radius - 28;
        const viewInsideSafeZone = maxViewDistance < radius - 24;
        const viewOutsideSafeZone = minViewDistance > radius + 24;

        ctx.save();
        if (!viewInsideSafeZone) {
            ctx.fillStyle = 'rgba(180, 40, 20, 0.22)';
            ctx.beginPath();
            ctx.rect(left - 4, top - 4, right - left + 8, bottom - top + 8);
            if (!viewOutsideSafeZone) ctx.arc(x, y, radius, 0, Math.PI * 2, true);
            ctx.fill();
        }

        if (borderVisible) {
            // A wide translucent stroke gives the same edge glow without
            // allocating and rasterizing a large radial gradient every frame.
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(255, 60, 30, 0.11)';
            ctx.lineWidth = 28;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(0, radius - 6), 0, Math.PI * 2);
            ctx.stroke();

            const pulse = 0.5 + Math.sin(this._frameNow / 400) * 0.5;
            ctx.strokeStyle = `rgba(255, 80, 40, ${0.5 + pulse * 0.3})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([12, 8]);
            ctx.lineDashOffset = -(this._frameNow / 40) % 20;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (targetRadius != null && targetRadius > 0 && targetRadius < radius) {
            const tx = targetX ?? x;
            const ty = targetY ?? y;
            const targetNearestX = clamp(tx, left, right);
            const targetNearestY = clamp(ty, top, bottom);
            const targetMinDistance = Math.hypot(targetNearestX - tx, targetNearestY - ty);
            const targetMaxDistance = Math.max(
                Math.hypot(left - tx, top - ty),
                Math.hypot(right - tx, top - ty),
                Math.hypot(left - tx, bottom - ty),
                Math.hypot(right - tx, bottom - ty),
            );
            if (targetMinDistance <= targetRadius + 10 && targetMaxDistance >= targetRadius - 10) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 6]);
                ctx.beginPath();
                ctx.arc(tx, ty, targetRadius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        ctx.restore();
    }
    drawObstacleShore(ctx, o, allowCache = true) {
        if (allowCache && this.drawCachedSurfaceLayer(ctx, o, 'waterShore', cacheCtx => this.drawObstacleShore(cacheCtx, o, false))) return;
        const kind = o.kind || 'crate';
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowBlur = 0;

        if (kind === 'river_path') {
            if (o.points && o.points.length > 0) {
                ctx.fillStyle = '#6f6745';
                this.fillSurfacePath(ctx, o, 'riverShore30', path => traceRiverShape(path, o, 30));
                ctx.fillStyle = '#baa06c';
                this.fillSurfacePath(ctx, o, 'riverShore16', path => traceRiverShape(path, o, 16));
            }
        } else if (kind === 'river') {
            ctx.fillStyle = '#baa06c';
            roundRect(ctx, -o.w / 2 - 12, -o.h / 2 - 14, o.w + 24, o.h + 28, o.h / 2);
            ctx.fill();
        } else if (kind === 'water') {
            ctx.fillStyle = '#66704d';
            this.fillSurfacePath(ctx, o, 'pondShore27', path => traceOrganicPond(path, o, 27));
            ctx.fillStyle = '#b8a06e';
            this.fillSurfacePath(ctx, o, 'pondShore16', path => traceOrganicPond(path, o, 16));
        }
        ctx.restore();
    }

    drawRoadShoulder(ctx, o, allowCache = true) {
        if (allowCache && this.drawCachedSurfaceLayer(ctx, o, 'roadShoulder', cacheCtx => this.drawRoadShoulder(cacheCtx, o, false))) return;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowBlur = 0;

        if (o.kind === 'trail_path' && o.points?.length) {
            ctx.strokeStyle = o.variant === 'boardwalk' ? 'rgba(35, 30, 23, 0.38)' : '#63583f';
            ctx.lineWidth = (o.width || 54) + (o.variant === 'boardwalk' ? 16 : 22);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            this.strokeSurfacePath(ctx, o, 'trailCenter', path => traceSmoothPath(path, o.points, o.x, o.y));
            ctx.restore();
            return;
        }
        const shoulderColors = {
            asphalt: '#655745',
            service: '#5b574e',
            cobblestone: '#62594c',
            gravel: '#625d50',
            rail: '#49473f',
        };
        if (!shoulderColors[o.variant]) {
            ctx.restore();
            return;
        }
        ctx.fillStyle = shoulderColors[o.variant];
        if (o.kind === 'roadJunction') {
            roundRect(ctx, -o.w / 2 - 12, -o.h / 2 - 12, o.w + 24, o.h + 24, 16);
            ctx.fill();
            ctx.restore();
            return;
        }
        const isHorizontal = o.w > o.h;
        const halfLength = (isHorizontal ? o.w : o.h) / 2;
        const visible = this.getVisibleRoadAxisRange(o, isHorizontal, 220);
        const start = Math.max(-halfLength, visible.start);
        const end = Math.min(halfLength, visible.end);
        if (end > start) {
            if (isHorizontal) {
                roundRect(ctx, start, -o.h / 2 - 12, end - start, o.h + 24, 10);
            } else {
                roundRect(ctx, -o.w / 2 - 12, start, o.w + 24, end - start, 10);
            }
            ctx.fill();
        }
        ctx.restore();
    }

    drawObstacleBody(ctx, o, allowCache = true) {
        const kind = o.kind || 'crate';
        const cached = allowCache
            && this.drawCachedSurfaceLayer(ctx, o, 'waterBody', cacheCtx => this.drawObstacleBody(cacheCtx, o, false));

        if (!cached) {
            ctx.save();
            ctx.translate(o.x, o.y);
            ctx.rotate(o.rotation || 0);
            ctx.shadowBlur = 0;

            if (kind === 'river_path') {
                if (o.points && o.points.length > 0) {
                    const waterGradient = ctx.createLinearGradient(-o.w / 2, -o.h / 2, o.w / 2, o.h / 2);
                    waterGradient.addColorStop(0, '#234f69');
                    waterGradient.addColorStop(0.52, '#2d6984');
                    waterGradient.addColorStop(1, '#24566f');
                    ctx.fillStyle = waterGradient;
                    this.fillSurfacePath(ctx, o, 'riverBody', path => traceRiverShape(path, o));
                }
            } else if (kind === 'river') {
                ctx.fillStyle = '#2a5e7a';
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, o.h / 2);
                ctx.fill();

                ctx.fillStyle = 'rgba(80, 160, 200, 0.12)';
                roundRect(ctx, -o.w / 2 + 4, -o.h * 0.2, o.w - 8, o.h * 0.4, o.h * 0.2);
                ctx.fill();
            } else if (kind === 'water') {
                const pondGradient = ctx.createRadialGradient(-o.w * 0.14, -o.h * 0.18, 8, 0, 0, Math.max(o.w, o.h) * 0.56);
                pondGradient.addColorStop(0, '#3b7990');
                pondGradient.addColorStop(0.58, '#2b647e');
                pondGradient.addColorStop(1, '#214d68');
                ctx.fillStyle = pondGradient;
                this.fillSurfacePath(ctx, o, 'pondBody', path => traceOrganicPond(path, o));
            }
            ctx.restore();
        }

        if (allowCache) this.drawWaterAnimation(ctx, o);
    }

    drawWaterAnimation(ctx, o) {
        const kind = o.kind || 'water';
        if (kind === 'river' || !o.w || !o.h) return;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowBlur = 0;

        if (kind === 'river_path' && o.points?.length) {
            let flowPaths = this._waterAnimationGeometry.get(o);
            if (!flowPaths) {
                flowPaths = [-0.24, 0, 0.24].map(factor => offsetPathPoints(o.points, (o.width || 220) * factor));
                this._waterAnimationGeometry.set(o, flowPaths);
            }
            ctx.save();
            this.clipSurfacePath(ctx, o, 'riverClip-5', path => traceRiverShape(path, o, -5));
            ctx.lineCap = 'round';
            ctx.setLineDash([48, 86]);
            ctx.lineDashOffset = -(this._frameNow * 0.018) % 134;
            for (let index = 0; index < flowPaths.length; index++) {
                ctx.strokeStyle = index === 1 ? 'rgba(144, 211, 230, 0.18)' : 'rgba(126, 198, 220, 0.11)';
                ctx.lineWidth = index === 1 ? 2.4 : 1.6;
                this.strokeSurfacePath(ctx, o, `riverFlow${index}`, path => traceSmoothPath(path, flowPaths[index], o.x, o.y));
            }
            ctx.setLineDash([]);
            ctx.restore();
        } else if (kind === 'water') {
            ctx.strokeStyle = 'rgba(151, 213, 226, 0.18)';
            ctx.lineWidth = 2.2;
            ctx.setLineDash([22, 28]);
            ctx.lineDashOffset = -(this._frameNow * 0.012) % 50;
            this.strokeSurfacePath(ctx, o, 'pondWave64', path => traceOrganicPond(path, o, 0, 0.64));
            ctx.setLineDash([]);

            ctx.strokeStyle = 'rgba(185, 228, 235, 0.19)';
            ctx.lineWidth = 1.4;
            this.strokeSurfacePath(ctx, o, 'pondWave38', path => traceOrganicPond(path, o, 0, 0.38));
        }
        ctx.restore();
    }

    getCachedPathSamples(o, spacing) {
        let samplesBySpacing = this._pathSampleCache.get(o);
        if (!samplesBySpacing) {
            samplesBySpacing = new Map();
            this._pathSampleCache.set(o, samplesBySpacing);
        }
        let samples = samplesBySpacing.get(spacing);
        if (!samples) {
            samples = [];
            forEachPathSample(o.points || [], spacing, (x, y, angle) => {
                samples.push({ x, y, angle });
            });
            samplesBySpacing.set(spacing, samples);
        }
        return samples;
    }

    drawRoadBody(ctx, o, allowCache = true) {
        if (allowCache && this.drawCachedSurfaceLayer(ctx, o, 'roadBody', cacheCtx => this.drawRoadBody(cacheCtx, o, false))) return;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowBlur = 0;

        if (o.kind === 'trail_path' && o.points?.length) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (o.variant === 'boardwalk') {
                ctx.strokeStyle = '#493b2b';
                ctx.lineWidth = (o.width || 48) + 8;
                this.strokeSurfacePath(ctx, o, 'trailCenter', path => traceSmoothPath(path, o.points, o.x, o.y));
                ctx.strokeStyle = '#8a704d';
                ctx.lineWidth = o.width || 48;
                this.strokeSurfacePath(ctx, o, 'trailCenter', path => traceSmoothPath(path, o.points, o.x, o.y));

                for (const sample of this.getCachedPathSamples(o, 18)) {
                    const { x: worldX, y: worldY, angle } = sample;
                    if (!this._buildingSurfaceCache && !this.isPointInView(worldX, worldY, 90)) continue;
                    ctx.save();
                    ctx.translate(worldX - o.x, worldY - o.y);
                    ctx.rotate(angle);
                    ctx.fillStyle = seededNoise(worldX * 0.02, worldY * 0.02) > 0.48 ? '#9b8059' : '#806746';
                    roundRect(ctx, -8, -(o.width || 48) / 2 + 3, 16, (o.width || 48) - 6, 2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(42, 31, 22, 0.28)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.restore();
                }
            } else {
                const palettes = {
                    forest: ['#65583e', '#816f4e'],
                    gravel: ['#696456', '#88816e'],
                    farm: ['#76603f', '#967b52'],
                    footpath: ['#6d5d42', '#8a7652'],
                };
                const palette = palettes[o.variant] || palettes.footpath;
                ctx.strokeStyle = palette[0];
                ctx.lineWidth = o.width || 54;
                this.strokeSurfacePath(ctx, o, 'trailCenter', path => traceSmoothPath(path, o.points, o.x, o.y));
                ctx.strokeStyle = palette[1];
                ctx.lineWidth = Math.max(12, (o.width || 54) - 13);
                this.strokeSurfacePath(ctx, o, 'trailCenter', path => traceSmoothPath(path, o.points, o.x, o.y));

                ctx.fillStyle = 'rgba(52, 44, 32, 0.24)';
                for (const sample of this.getCachedPathSamples(o, 76)) {
                    const { x: worldX, y: worldY, angle } = sample;
                    if (!this._buildingSurfaceCache && !this.isPointInView(worldX, worldY, 90)) continue;
                    const noise = seededNoise(worldX * 0.01, worldY * 0.01) - 0.5;
                    ctx.beginPath();
                    ctx.ellipse(worldX - o.x - Math.sin(angle) * noise * 22, worldY - o.y + Math.cos(angle) * noise * 22, 3.4, 1.8, angle, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
            return;
        }

        if (o.kind === 'roadJunction') {
            ctx.fillStyle = '#2b2c28';
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 11);
            ctx.fill();
            ctx.restore();
            return;
        }

        const isHorizontal = o.w > o.h;
        const halfLength = (isHorizontal ? o.w : o.h) / 2;
        const visible = this.getVisibleRoadAxisRange(o, isHorizontal, 220);
        const start = Math.max(-halfLength, visible.start);
        const end = Math.min(halfLength, visible.end);

        const hardSurfaceColors = {
            asphalt: '#2b2c28',
            service: '#454844',
            cobblestone: '#69655d',
            rail: '#5a554c',
        };
        if (end > start && hardSurfaceColors[o.variant]) {
            ctx.fillStyle = hardSurfaceColors[o.variant];
            if (isHorizontal) {
                roundRect(ctx, start, -o.h / 2, end - start, o.h, 5);
            } else {
                roundRect(ctx, -o.w / 2, start, o.w, end - start, 5);
            }
            ctx.fill();
        } else if (end > start) {
            // Dirt-road detail is generated only for the camera-visible segment.
            // Samples remain anchored to the road origin, so edges never slide.
            ctx.fillStyle = o.variant === 'gravel' ? '#777266' : '#7a684c';
            ctx.beginPath();
            const step = 28;
            const roadId = Math.round(o.x + o.y);
            const edgeWobble = (axis, side) => {
                if (axis <= -halfLength + 0.01 || axis >= halfLength - 0.01) return 0;
                return Math.sin(axis * 0.05 + roadId * side) * 5 + Math.cos(axis * 0.12) * 3;
            };
            const firstSample = -halfLength + Math.max(1, Math.ceil((start + halfLength) / step)) * step;
            const lastSample = -halfLength + Math.min(
                Math.floor((halfLength * 2 - 0.01) / step),
                Math.floor((end + halfLength) / step),
            ) * step;

            if (isHorizontal) {
                ctx.moveTo(start, -o.h / 2 + edgeWobble(start, 1));
                for (let xx = firstSample; xx < end; xx += step) {
                    ctx.lineTo(xx, -o.h / 2 + edgeWobble(xx, 1));
                }
                ctx.lineTo(end, -o.h / 2 + edgeWobble(end, 1));
                ctx.lineTo(end, o.h / 2 + edgeWobble(end, -1));
                for (let xx = lastSample; xx > start; xx -= step) {
                    ctx.lineTo(xx, o.h / 2 + edgeWobble(xx, -1));
                }
                ctx.lineTo(start, o.h / 2 + edgeWobble(start, -1));
            } else {
                ctx.moveTo(o.w / 2 + edgeWobble(start, 1), start);
                for (let yy = firstSample; yy < end; yy += step) {
                    ctx.lineTo(o.w / 2 + edgeWobble(yy, 1), yy);
                }
                ctx.lineTo(o.w / 2 + edgeWobble(end, 1), end);
                ctx.lineTo(-o.w / 2 + edgeWobble(end, -1), end);
                for (let yy = lastSample; yy > start; yy -= step) {
                    ctx.lineTo(-o.w / 2 + edgeWobble(yy, -1), yy);
                }
                ctx.lineTo(-o.w / 2 + edgeWobble(start, -1), start);
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    drawRoadMarkings(ctx, o, allowCache = true) {
        if (o.kind === 'roadJunction') return;
        if (allowCache && this.drawCachedSurfaceLayer(ctx, o, 'roadMarkings', cacheCtx => this.drawRoadMarkings(cacheCtx, o, false))) return;
        ctx.save();
        if (o.kind === 'trail_path' && o.points?.length) {
            ctx.translate(o.x, o.y);
            ctx.rotate(o.rotation || 0);
            if (o.variant !== 'boardwalk') {
                ctx.strokeStyle = o.variant === 'gravel' ? 'rgba(45, 43, 37, 0.25)' : 'rgba(57, 45, 31, 0.28)';
                ctx.lineWidth = 2.2;
                ctx.setLineDash([22, 18]);
                const trackOffsets = [-(o.width || 54) * 0.21, (o.width || 54) * 0.21];
                for (let trackIndex = 0; trackIndex < trackOffsets.length; trackIndex++) {
                    const offset = trackOffsets[trackIndex];
                    this.strokeSurfacePath(ctx, o, `trailTrack${trackIndex}`,
                        path => traceSmoothPath(path, offsetPathPoints(o.points, offset), o.x, o.y));
                }
                ctx.setLineDash([]);
            }
            ctx.restore();
            return;
        }
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowBlur = 0;

        const isHorizontal = o.w >= o.h;
        const length = isHorizontal ? o.w : o.h;
        const width = isHorizontal ? o.h : o.w;
        const inset = Math.min(68, Math.max(18, width * 0.52));
        const visible = this.getVisibleRoadAxisRange(o, isHorizontal, 180);
        const start = Math.max(-length / 2 + inset, visible.start);
        const end = Math.min(length / 2 - inset, visible.end);
        const markingIntervals = this.getRoadMarkingIntervals(o, start, end, isHorizontal);

        const line = (a, b, offset = 0) => {
            if (isHorizontal) {
                ctx.moveTo(a, offset);
                ctx.lineTo(b, offset);
            } else {
                ctx.moveTo(offset, a);
                ctx.lineTo(offset, b);
            }
        };

        if (o.variant === 'asphalt') {
            // Faint asphalt cracks, rotated with the road direction.
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.34)';
            ctx.lineWidth = 1;
            const seedVal = Math.round(o.x + o.y);
            const crackA = -length * 0.22;
            const crackB = length * 0.18;
            if (seedVal % 3 === 0) {
                ctx.beginPath();
                if (isHorizontal) {
                    ctx.moveTo(crackA, -width * 0.12);
                    ctx.lineTo(crackA + 18, width * 0.08);
                    ctx.lineTo(crackA + 28, width * 0.02);
                } else {
                    ctx.moveTo(-width * 0.12, crackA);
                    ctx.lineTo(width * 0.08, crackA + 18);
                    ctx.lineTo(width * 0.02, crackA + 28);
                }
                ctx.stroke();
            }
            if (seedVal % 5 === 0) {
                ctx.beginPath();
                if (isHorizontal) {
                    ctx.moveTo(crackB, width * 0.18);
                    ctx.lineTo(crackB + 18, width * 0.08);
                    ctx.lineTo(crackB + 28, width * 0.22);
                } else {
                    ctx.moveTo(width * 0.18, crackB);
                    ctx.lineTo(width * 0.08, crackB + 18);
                    ctx.lineTo(width * 0.22, crackB + 28);
                }
                ctx.stroke();
            }

            if (markingIntervals.length) {
                const isNetworkRoad = o.role === 'networkRoad';
                if (isNetworkRoad) {
                    ctx.strokeStyle = 'rgba(235, 185, 60, 0.76)';
                    ctx.lineWidth = 2.5;
                    // Explicit world-anchored dashes never slide when the
                    // camera-clipped drawing range changes.
                    const dashLength = 18;
                    const dashPeriod = 36;
                    const roadAxisStart = -length / 2;
                    ctx.beginPath();
                    for (const interval of markingIntervals) {
                        const firstDashIndex = Math.floor((interval.start - roadAxisStart) / dashPeriod);
                        for (let dashIndex = firstDashIndex; ; dashIndex++) {
                            const dashStart = roadAxisStart + dashIndex * dashPeriod;
                            if (dashStart >= interval.end) break;
                            const clippedStart = Math.max(interval.start, dashStart);
                            const clippedEnd = Math.min(interval.end, dashStart + dashLength);
                            if (clippedEnd > clippedStart) line(clippedStart, clippedEnd, 0);
                        }
                    }
                    ctx.stroke();
                }

                ctx.strokeStyle = isNetworkRoad
                    ? 'rgba(240, 240, 240, 0.52)'
                    : 'rgba(224, 226, 220, 0.24)';
                ctx.lineWidth = isNetworkRoad ? 1.5 : 1.2;
                const edge = width / 2 - 8;
                ctx.beginPath();
                for (const interval of markingIntervals) {
                    line(interval.start, interval.end, -edge);
                    line(interval.start, interval.end, edge);
                }
                ctx.stroke();
            }
        } else if (o.variant === 'rail') {
            // Sleepers and twin rails turn the depot surface into an actual
            // rail line instead of a narrow brown road.
            const sleeperStep = 30;
            const firstSleeper = Math.ceil(start / sleeperStep) * sleeperStep;
            ctx.strokeStyle = 'rgba(48, 34, 24, 0.82)';
            ctx.lineWidth = 5;
            ctx.beginPath();
            for (let axis = firstSleeper; axis <= end; axis += sleeperStep) {
                if (isHorizontal) {
                    ctx.moveTo(axis, -width * 0.43);
                    ctx.lineTo(axis, width * 0.43);
                } else {
                    ctx.moveTo(-width * 0.43, axis);
                    ctx.lineTo(width * 0.43, axis);
                }
            }
            ctx.stroke();
            ctx.strokeStyle = '#aab0ae';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            line(start, end, -width * 0.23);
            line(start, end, width * 0.23);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.26)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            line(start, end, -width * 0.23 - 1);
            line(start, end, width * 0.23 - 1);
            ctx.stroke();
        } else if (o.variant === 'cobblestone') {
            const stoneStep = 24;
            const firstStone = Math.ceil(start / stoneStep) * stoneStep;
            ctx.strokeStyle = 'rgba(39, 37, 33, 0.34)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let axis = firstStone; axis <= end; axis += stoneStep) {
                const stagger = Math.round(axis / stoneStep) % 2 === 0 ? width * 0.08 : -width * 0.08;
                if (isHorizontal) {
                    ctx.moveTo(axis, -width / 2 + 5);
                    ctx.lineTo(axis + stagger, width / 2 - 5);
                } else {
                    ctx.moveTo(-width / 2 + 5, axis);
                    ctx.lineTo(width / 2 - 5, axis + stagger);
                }
            }
            line(start, end, -width * 0.24);
            line(start, end, width * 0.24);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(224, 218, 198, 0.13)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            line(start, end, 0);
            ctx.stroke();
        } else if (o.variant === 'service') {
            ctx.strokeStyle = 'rgba(225, 226, 214, 0.3)';
            ctx.lineWidth = 1.6;
            ctx.setLineDash([26, 20]);
            ctx.beginPath();
            line(start, end, -width * 0.36);
            line(start, end, width * 0.36);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(20, 23, 21, 0.32)';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            line(start, end, -width * 0.14);
            line(start, end, width * 0.14);
            ctx.stroke();
        } else {
            ctx.strokeStyle = '#524330';
            ctx.lineWidth = 3.5;
            const trackOff = width * 0.18;
            ctx.beginPath();
            line(start, end, -trackOff);
            line(start, end, trackOff);
            ctx.stroke();
            if (o.variant === 'gravel') {
                ctx.fillStyle = 'rgba(210, 204, 187, 0.24)';
                const pebbleStep = 68;
                const firstPebble = Math.ceil(start / pebbleStep) * pebbleStep;
                for (let axis = firstPebble; axis <= end; axis += pebbleStep) {
                    const offset = (seededNoise(axis * 0.02, o.x + o.y) - 0.5) * width * 0.58;
                    ctx.beginPath();
                    if (isHorizontal) ctx.ellipse(axis, offset, 2.8, 1.8, 0.2, 0, Math.PI * 2);
                    else ctx.ellipse(offset, axis, 1.8, 2.8, 0.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();
    }

    getRoadMarkingCuts(road, isHorizontal) {
        const cached = this._roadMarkingCutCache.get(road);
        if (cached?.isHorizontal === isHorizontal) return cached.cuts;

        const cuts = [];
        const angle = -(road.rotation || 0);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const roadWidth = isHorizontal ? road.h : road.w;
        const halfLength = (isHorizontal ? road.w : road.h) / 2;

        for (const junction of this.roadJunctionObstacles) {
            const dx = junction.x - road.x;
            const dy = junction.y - road.y;
            const localX = dx * cos - dy * sin;
            const localY = dx * sin + dy * cos;
            const axis = isHorizontal ? localX : localY;
            const cross = isHorizontal ? localY : localX;
            const crossLimit = roadWidth / 2 + Math.max(junction.w, junction.h) / 2;
            if (Math.abs(cross) > crossLimit || axis < -halfLength - 120 || axis > halfLength + 120) continue;

            const halfCut = (isHorizontal ? junction.w : junction.h) / 2 + 22;
            cuts.push({
                start: Math.max(-halfLength, axis - halfCut),
                end: Math.min(halfLength, axis + halfCut),
            });
        }

        cuts.sort((a, b) => a.start - b.start);
        const merged = [];
        for (const cut of cuts) {
            const previous = merged[merged.length - 1];
            if (previous && cut.start <= previous.end) previous.end = Math.max(previous.end, cut.end);
            else if (cut.end > cut.start) merged.push(cut);
        }
        this._roadMarkingCutCache.set(road, { isHorizontal, cuts: merged });
        return merged;
    }

    getRoadMarkingIntervals(road, start, end, isHorizontal) {
        if (start >= end) return [];
        const intervals = [];
        let cursor = start;
        for (const cut of this.getRoadMarkingCuts(road, isHorizontal)) {
            if (cut.end <= cursor) continue;
            if (cut.start >= end) break;
            if (cut.start > cursor) intervals.push({ start: cursor, end: Math.min(end, cut.start) });
            cursor = Math.max(cursor, cut.end);
            if (cursor >= end) break;
        }
        if (cursor < end) intervals.push({ start: cursor, end });
        return intervals.filter(interval => interval.end - interval.start > 12);
    }

    getVisibleRoadAxisRange(o, isHorizontal, padding = 160) {
        if (this._buildingSurfaceCache) {
            const length = isHorizontal ? o.w : o.h;
            return { start: -length / 2 - padding, end: length / 2 + padding };
        }
        const angle = -(o.rotation || 0);
        const cos = Math.cos(angle);

        const sin = Math.sin(angle);
        const corners = [
            [this._viewLeft, this._viewTop],
            [this._viewRight, this._viewTop],
            [this._viewRight, this._viewBottom],
            [this._viewLeft, this._viewBottom],
        ];
        let min = Infinity;
        let max = -Infinity;
        for (const [worldX, worldY] of corners) {
            const dx = worldX - o.x;
            const dy = worldY - o.y;
            const localX = dx * cos - dy * sin;
            const localY = dx * sin + dy * cos;
            const axis = isHorizontal ? localX : localY;
            min = Math.min(min, axis);
            max = Math.max(max, axis);
        }
        const halfLength = (isHorizontal ? o.w : o.h) / 2;
        return {
            start: Math.max(-halfLength, min - padding),
            end: Math.min(halfLength, max + padding),
        };
    }

    getFieldPalette(variant) {
        const palettes = {
            quarry: { base: 'rgba(122, 109, 84, 0.46)', detail: 'rgba(90, 78, 58, 0.24)', line: 'rgba(58, 49, 35, 0.18)' },
            industrial: { base: 'rgba(98, 92, 82, 0.34)', detail: 'rgba(68, 63, 56, 0.20)', line: 'rgba(46, 42, 36, 0.16)' },
            ruins: { base: 'rgba(105, 99, 82, 0.30)', detail: 'rgba(74, 67, 52, 0.18)', line: 'rgba(45, 39, 30, 0.14)' },
            crop: { base: 'rgba(78, 103, 45, 0.32)', detail: 'rgba(58, 86, 35, 0.22)', line: 'rgba(35, 67, 25, 0.22)' },
            farm: { base: 'rgba(67, 93, 40, 0.24)', detail: 'rgba(86, 88, 43, 0.18)', line: 'rgba(44, 72, 27, 0.16)' },
            estate: { base: 'rgba(55, 82, 50, 0.22)', detail: 'rgba(78, 101, 58, 0.14)', line: 'rgba(30, 59, 28, 0.10)' },
            mansion: { base: 'rgba(55, 82, 50, 0.22)', detail: 'rgba(78, 101, 58, 0.14)', line: 'rgba(30, 59, 28, 0.10)' },
            town: { base: 'rgba(58, 87, 50, 0.20)', detail: 'rgba(87, 94, 59, 0.12)', line: 'rgba(32, 62, 28, 0.10)' },
            village: { base: 'rgba(59, 91, 48, 0.19)', detail: 'rgba(92, 101, 58, 0.12)', line: 'rgba(31, 63, 28, 0.10)' },
            camp: { base: 'rgba(48, 76, 40, 0.20)', detail: 'rgba(73, 94, 48, 0.14)', line: 'rgba(25, 52, 23, 0.10)' },
            woods: { base: 'rgba(42, 72, 36, 0.20)', detail: 'rgba(30, 62, 28, 0.15)', line: 'rgba(18, 45, 18, 0.08)' },
            scrub: { base: 'rgba(62, 87, 43, 0.18)', detail: 'rgba(79, 91, 44, 0.13)', line: 'rgba(39, 64, 26, 0.08)' },
            wetlands: { base: 'rgba(45, 76, 55, 0.20)', detail: 'rgba(40, 87, 68, 0.12)', line: 'rgba(22, 56, 45, 0.10)' },
            'snow-woods': { base: 'rgba(118, 132, 122, 0.20)', detail: 'rgba(92, 117, 108, 0.13)', line: 'rgba(65, 91, 83, 0.10)' },
            'snow-lab': { base: 'rgba(118, 132, 122, 0.22)', detail: 'rgba(88, 105, 101, 0.14)', line: 'rgba(62, 81, 78, 0.10)' },
        };
        return palettes[variant] || { base: 'rgba(58, 88, 48, 0.18)', detail: 'rgba(84, 98, 56, 0.12)', line: 'rgba(30, 60, 26, 0.09)' };
    }

    drawOrganicField(ctx, o) {
        const hw = o.w / 2;
        const hh = o.h / 2;
        const palette = this.getFieldPalette(o.variant);
        const variantSeed = String(o.variant || 'field').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const steps = 10;

        ctx.save();
        ctx.shadowBlur = 0;
        if (o.variant === 'parkingLot') {
            ctx.fillStyle = '#3b3d3a';
            roundRect(ctx, -hw, -hh, o.w, o.h, 18);
            ctx.fill();
            ctx.strokeStyle = '#646057';
            ctx.lineWidth = 10;
            roundRect(ctx, -hw + 5, -hh + 5, o.w - 10, o.h - 10, 14);
            ctx.stroke();

            // Restrained parking bays make the gas forecourt read as a real
            // paved lot instead of a road passing underneath the building.
            ctx.strokeStyle = 'rgba(224, 220, 192, 0.36)';
            ctx.lineWidth = 2;
            const bayDepth = Math.min(135, o.h * 0.22);
            for (let x = -hw + 100; x <= hw - 100; x += 115) {
                ctx.beginPath();
                ctx.moveTo(x, hh - 18);
                ctx.lineTo(x, hh - bayDepth);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(18, 19, 18, 0.36)';
            ctx.lineWidth = 1.4;
            for (let i = 0; i < 7; i++) {
                const x = -hw * 0.76 + seededNoise(o.x * 0.01 + i * 7, o.y * 0.01) * o.w * 0.72;
                const y = -hh * 0.56 + seededNoise(o.y * 0.01 + i * 11, o.x * 0.01) * o.h * 0.58;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + 15, y + 8);
                ctx.lineTo(x + 25, y + 3);
                ctx.stroke();
            }
            ctx.restore();
            return;
        }
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = -hw + t * o.w;
            const wobble = (seededNoise((o.x + x) * 0.013, (o.y - hh) * 0.013 + variantSeed) - 0.5) * 72;
            const y = -hh + wobble;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const y = -hh + t * o.h;
            const wobble = (seededNoise((o.x + hw) * 0.013 + variantSeed, (o.y + y) * 0.013) - 0.5) * 72;
            ctx.lineTo(hw + wobble, y);
        }
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = hw - t * o.w;
            const wobble = (seededNoise((o.x + x) * 0.013, (o.y + hh) * 0.013 - variantSeed) - 0.5) * 72;
            ctx.lineTo(x, hh + wobble);
        }
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const y = hh - t * o.h;
            const wobble = (seededNoise((o.x - hw) * 0.013 - variantSeed, (o.y + y) * 0.013) - 0.5) * 72;
            ctx.lineTo(-hw + wobble, y);
        }
        ctx.closePath();
        ctx.fillStyle = palette.base;
        ctx.fill();
        ctx.clip();

        const detailCount = Math.max(5, Math.min(18, Math.round((o.w * o.h) / 85000)));
        for (let i = 0; i < detailCount; i++) {
            const n1 = seededNoise(o.x * 0.019 + i * 17.31, o.y * 0.019 + variantSeed);
            const n2 = seededNoise(o.x * 0.017 - i * 9.77, o.y * 0.017 - variantSeed);
            const x = -hw + n1 * o.w;
            const y = -hh + n2 * o.h;
            const rw = 70 + seededNoise(i + variantSeed, o.x * 0.01) * 150;
            const rh = 20 + seededNoise(o.y * 0.01, i - variantSeed) * 56;
            ctx.fillStyle = i % 3 === 0 ? palette.line : palette.detail;
            ctx.beginPath();
            ctx.ellipse(x, y, rw, rh, n1 * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        if (o.variant === 'crop') {
            ctx.strokeStyle = palette.line;
            ctx.lineWidth = 2.2;
            for (let x = -hw + 18; x < hw; x += 28) {
                ctx.beginPath();
                ctx.moveTo(x, -hh + 10);
                ctx.lineTo(x + 12 * Math.sin((o.y + x) * 0.01), hh - 10);
                ctx.stroke();
            }
        }

        if (o.variant === 'quarry' || o.variant === 'industrial' || o.variant === 'ruins') {
            ctx.fillStyle = palette.line;
            for (let i = 0; i < detailCount; i++) {
                const n1 = seededNoise(o.x * 0.021 + i * 5.7, o.y * 0.021);
                const n2 = seededNoise(o.x * 0.015, o.y * 0.015 + i * 11.2);
                ctx.beginPath();
                ctx.arc(-hw + n1 * o.w, -hh + n2 * o.h, 4 + n1 * 8, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    getObstacleHitShake(o) {
        const elapsed = this._frameNow - (o?._hitAt || 0);
        if (elapsed < 0 || elapsed >= 190) return { x: 0, y: 0 };
        const strength = (1 - elapsed / 190) * 4.2;
        const phase = elapsed * 0.11 + String(o.id || '').length;
        return {
            x: Math.sin(phase) * strength,
            y: Math.cos(phase * 1.37) * strength * 0.65,
        };
    }

    drawPersistentCastShadow(ctx, o) {
        const kind = o.kind || 'crate';
        const width = Math.abs(Number(o.w) || 0);
        const height = Math.abs(Number(o.h) || 0);
        if (!width || !height || CAST_SHADOW_EXEMPT_KINDS.has(kind)) return;

        // The light direction is fixed in world space. Convert it to the
        // obstacle's local space so rotating a prop never rotates its shadow.
        const rotation = Number(o.rotation) || 0;
        const minSize = Math.min(width, height);
        const tall = TALL_CAST_SHADOW_KINDS.has(kind);
        const distance = kind === 'bridge' ? 5
            : kind === 'wall' || kind === 'interiorWall' || kind === 'door' ? 6
                : clamp(minSize * (tall ? 0.21 : 0.15), tall ? 8 : 5, tall ? 18 : 13);
        const worldOffsetX = distance * 0.62;
        const worldOffsetY = distance;
        const localOffsetX = Math.cos(rotation) * worldOffsetX + Math.sin(rotation) * worldOffsetY;
        const localOffsetY = -Math.sin(rotation) * worldOffsetX + Math.cos(rotation) * worldOffsetY;
        const softPad = Math.min(7, Math.max(2.5, minSize * 0.12));
        const coreAlpha = kind === 'wall' || kind === 'interiorWall' ? 0.17
            : kind === 'bridge' ? 0.18
                : tall ? 0.25 : 0.22;

        const traceShadowShape = (padding) => {
            if (ROUND_CAST_SHADOW_KINDS.has(kind)) {
                const radiusX = width / 2 + padding;
                const radiusY = kind === 'tree'
                    ? height * 0.36 + padding
                    : height * 0.42 + padding;
                ctx.beginPath();
                ctx.ellipse(0, kind === 'tree' ? height * -0.05 : 0, radiusX, radiusY, 0.16, 0, Math.PI * 2);
                return;
            }
            if (kind === 'tent') {
                ctx.beginPath();
                ctx.moveTo(-width / 2 - padding, height / 2 + padding);
                ctx.lineTo(-width * 0.08, -height / 2 - padding);
                ctx.lineTo(width * 0.08, -height / 2 - padding);
                ctx.lineTo(width / 2 + padding, height / 2 + padding);
                ctx.closePath();
                return;
            }
            roundRect(
                ctx,
                -width / 2 - padding,
                -height / 2 - padding,
                width + padding * 2,
                height + padding * 2,
                Math.min(9, Math.max(2, minSize * 0.22 + padding * 0.35)),
            );
        };

        // A wide low-opacity silhouette plus a tighter contact silhouette
        // produces a soft readable shadow without an expensive per-frame blur.
        ctx.save();
        ctx.translate(localOffsetX * 1.16, localOffsetY * 1.16);
        ctx.fillStyle = 'rgba(7, 12, 8, 0.09)';
        traceShadowShape(softPad);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(localOffsetX * 0.78, localOffsetY * 0.78);
        ctx.fillStyle = `rgba(7, 11, 8, ${coreAlpha})`;
        traceShadowShape(Math.min(2.5, softPad * 0.42));
        ctx.fill();
        ctx.restore();
    }

    drawObstacle(ctx, o, allowCache = true) {
        const kind = o.kind || 'crate';
        // Bridge rails are authoritative collision shapes. Their matching
        // visuals are drawn directly with the bridge deck so no detached wall
        // sprites can drift or double-render on top of the crossing.
        if (kind === 'wall' && o.role === 'bridgeRail') return;
        if (allowCache && (kind === 'field' || kind === 'bridge')
            && this.drawCachedSurfaceLayer(ctx, o, kind, cacheCtx => this.drawObstacle(cacheCtx, o, false))) return;
        if (allowCache && this.drawCachedObstacle(ctx, o, kind)) return;

        // Roads and water are now handled via layered passes
        if (kind === 'road' || kind === 'roadJunction' || kind === 'trail_path' || kind === 'river' || kind === 'river_path' || kind === 'water') return;

        const shake = allowCache ? this.getObstacleHitShake(o) : { x: 0, y: 0 };
        ctx.save();
        ctx.translate(o.x + shake.x, o.y + shake.y);
        ctx.rotate(o.rotation || 0);
        this.drawPersistentCastShadow(ctx, o);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        if (kind === 'houseFloor') {
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            // Floor with gradient for depth
            const floorColors = {
                mansion: { main: '#596168', dark: '#474f55', line: 'rgba(215,228,232,0.07)' },
                warehouse: { main: '#515e64', dark: '#414c52', line: 'rgba(200,220,228,0.07)' },
                ironworks: { main: '#3f4a4f', dark: '#293237', line: 'rgba(190,218,226,0.11)' },
                brick: { main: '#6c625b', dark: '#514943', line: 'rgba(235,213,190,0.08)' },
                lodge: { main: '#625c4d', dark: '#48443a', line: 'rgba(227,218,180,0.08)' },
                cabin: { main: '#766b59', dark: '#5f5648', line: 'rgba(236,220,187,0.10)' },
                barn: { main: '#75665a', dark: '#5c5048', line: 'rgba(235,216,196,0.09)' },
                town: { main: '#69766c', dark: '#566259', line: 'rgba(220,234,222,0.09)' },
                house: { main: '#6d766e', dark: '#59635b', line: 'rgba(224,236,226,0.08)' },
            };
            const fc = floorColors[o.variant] || { main: '#62676a', dark: '#50565a', line: 'rgba(215,225,228,0.06)' };
            const floorGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
            floorGrad.addColorStop(0, fc.main);
            floorGrad.addColorStop(1, fc.dark);
            ctx.fillStyle = floorGrad;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 5);
            ctx.fill();
            // Alternating square plates make industrial interiors readable;
            // homes use staggered boards so every building is not the same grid.
            ctx.strokeStyle = fc.line;
            ctx.lineWidth = 1;
            const tiled = ['ironworks', 'warehouse', 'mansion', 'brick'].includes(o.variant);
            const tileStep = o.variant === 'ironworks' ? 72 : o.variant === 'warehouse' ? 62 : 54;
            if (tiled) {
                let row = 0;
                for (let iy = -o.h / 2 + 7; iy < o.h / 2 - 7; iy += tileStep, row++) {
                    let column = 0;
                    for (let ix = -o.w / 2 + 7; ix < o.w / 2 - 7; ix += tileStep, column++) {
                        ctx.fillStyle = (row + column) % 2 === 0
                            ? 'rgba(255,255,255,0.025)'
                            : 'rgba(8,12,14,0.035)';
                        ctx.fillRect(ix, iy, Math.min(tileStep, o.w / 2 - 7 - ix), Math.min(tileStep, o.h / 2 - 7 - iy));
                        ctx.strokeStyle = fc.line;
                        ctx.strokeRect(ix, iy, Math.min(tileStep, o.w / 2 - 7 - ix), Math.min(tileStep, o.h / 2 - 7 - iy));
                    }
                }
            } else {
                const boardH = 28;
                for (let iy = -o.h / 2 + boardH; iy < o.h / 2; iy += boardH) {
                    ctx.beginPath();
                    ctx.moveTo(-o.w / 2 + 7, iy);
                    ctx.lineTo(o.w / 2 - 7, iy);
                    ctx.stroke();
                }
                ctx.strokeStyle = 'rgba(25,20,15,0.10)';
                for (let row = 0, iy = -o.h / 2; iy < o.h / 2; row++, iy += boardH) {
                    const stagger = row % 2 ? 55 : 0;
                    for (let ix = -o.w / 2 + 110 - stagger; ix < o.w / 2; ix += 110) {
                        ctx.beginPath();
                        ctx.moveTo(ix, iy + 2);
                        ctx.lineTo(ix, Math.min(iy + boardH - 2, o.h / 2 - 7));
                        ctx.stroke();
                    }
                }
            }
            if (o.variant === 'ironworks') {
                // Broad central combat lane with readable steel plates and hazard borders.
                const laneW = Math.min(560, o.w * 0.34);
                ctx.fillStyle = 'rgba(12, 18, 21, 0.18)';
                ctx.fillRect(-laneW / 2, -o.h / 2 + 16, laneW, o.h - 32);
                ctx.strokeStyle = 'rgba(232, 174, 48, 0.58)';
                ctx.lineWidth = 7;
                ctx.setLineDash([22, 18]);
                ctx.beginPath();
                ctx.moveTo(-laneW / 2, -o.h / 2 + 22);
                ctx.lineTo(-laneW / 2, o.h / 2 - 22);
                ctx.moveTo(laneW / 2, -o.h / 2 + 22);
                ctx.lineTo(laneW / 2, o.h / 2 - 22);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = 'rgba(186, 205, 211, 0.32)';
                for (let i = 0; i < 18; i++) {
                    const rx = -o.w / 2 + 28 + seededNoise(o.x * 0.01 + i, o.y * 0.01) * (o.w - 56);
                    const ry = -o.h / 2 + 28 + seededNoise(o.y * 0.01 + i, o.x * 0.01 + 11) * (o.h - 56);
                    ctx.beginPath();
                    ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            // Subtle inner border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.lineWidth = 1;
            roundRect(ctx, -o.w / 2 + 3, -o.h / 2 + 3, o.w - 6, o.h - 6, 4);
            ctx.stroke();
        } else if (kind === 'door') {
            const horizontal = o.w >= o.h;
            const longSize = horizontal ? o.w : o.h;
            const shortSize = horizontal ? o.h : o.w;
            const panelLength = Math.max(26, longSize - 8);
            const panelThickness = clamp(shortSize * 0.42, 7, 11);
            const industrial = ['warehouse', 'metal', 'ironworks'].includes(o.variant);
            const wooden = ['cabin', 'lodge', 'barn'].includes(o.variant);
            const panelColor = industrial ? '#9fc8d1' : wooden ? '#c7aa77' : '#dce2df';
            const panelDark = industrial ? '#6f99a3' : wooden ? '#96754a' : '#aeb9b5';
            const target = o.isOpen ? 1 : 0;
            const previous = this._doorOpenProgress.get(o.id) ?? target;
            const blend = 1 - Math.exp(-15 * Math.max(0.001, this._frameDt || 1 / 60));
            const progress = previous + (target - previous) * blend;
            this._doorOpenProgress.set(o.id, Math.abs(target - progress) < 0.002 ? target : progress);

            // The threshold fills the actual opening, while the panel begins
            // at one wall edge and swings around that fixed hinge.
            ctx.save();
            if (!horizontal) ctx.rotate(Math.PI / 2);
            ctx.fillStyle = 'rgba(20, 25, 27, 0.64)';
            roundRect(ctx, -longSize / 2, -Math.max(3, shortSize * 0.18), longSize, Math.max(6, shortSize * 0.36), 2);
            ctx.fill();
            ctx.fillStyle = '#252c30';
            ctx.fillRect(-longSize / 2 - 3, -shortSize / 2 - 2, 6, shortSize + 4);
            ctx.fillRect(longSize / 2 - 3, -shortSize / 2 - 2, 6, shortSize + 4);

            const swingDirection = (String(o.id).charCodeAt(String(o.id).length - 1) % 2 ? 1 : -1);
            ctx.translate(-panelLength / 2, 0);
            ctx.rotate(swingDirection * progress * Math.PI * 0.48);
            const doorGrad = ctx.createLinearGradient(0, -panelThickness / 2, 0, panelThickness / 2);
            doorGrad.addColorStop(0, panelColor);
            doorGrad.addColorStop(1, panelDark);
            ctx.fillStyle = '#11161a';
            roundRect(ctx, -3, -panelThickness / 2 - 3, panelLength + 6, panelThickness + 6, 3);
            ctx.fill();
            ctx.fillStyle = doorGrad;
            roundRect(ctx, 0, -panelThickness / 2, panelLength, panelThickness, 1.5);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.38)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(4, -panelThickness / 2 + 1.5);
            ctx.lineTo(panelLength - 4, -panelThickness / 2 + 1.5);
            ctx.stroke();
            ctx.fillStyle = '#252c30';
            ctx.beginPath();
            ctx.arc(2, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (kind === 'wall' || kind === 'interiorWall') {
            // Wall with gradient and brick/stone texture
            const wallColors = {
                stone: { main: '#807a6c', dark: '#6a6558', highlight: 'rgba(200,195,180,0.12)' },
                warehouse: { main: '#48565e', dark: '#374249', highlight: 'rgba(160,185,200,0.10)' },
                metal: { main: '#38464d', dark: '#222c31', highlight: 'rgba(176,214,225,0.16)' },
                ironworks: { main: '#38464d', dark: '#222c31', highlight: 'rgba(176,214,225,0.16)' },
                brick: { main: '#835447', dark: '#5d3931', highlight: 'rgba(235,194,169,0.13)' },
                lodge: { main: '#53614b', dark: '#354137', highlight: 'rgba(203,220,177,0.12)' },
            };
            const wc = wallColors[o.variant] || { main: '#596268', dark: '#424b50', highlight: 'rgba(208,224,230,0.11)' };
            const wallGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
            wallGrad.addColorStop(0, wc.main);
            wallGrad.addColorStop(1, wc.dark);
            ctx.fillStyle = wallGrad;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.fill();
            // Top highlight edge
            ctx.fillStyle = wc.highlight;
            if (o.w > o.h) ctx.fillRect(-o.w / 2 + 3, -o.h / 2 + 2, o.w - 6, Math.max(2, o.h * 0.18));
            else ctx.fillRect(-o.w / 2 + 2, -o.h / 2 + 3, Math.max(2, o.w * 0.18), o.h - 6);
            // Stone/brick texture
            if (o.variant === 'stone') {
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.lineWidth = 0.8;
                const brickH = 14;
                const brickW = 22;
                if (o.w > o.h) {
                    for (let by = -o.h / 2 + brickH; by < o.h / 2; by += brickH) {
                        ctx.beginPath();
                        ctx.moveTo(-o.w / 2 + 3, by);
                        ctx.lineTo(o.w / 2 - 3, by);
                        ctx.stroke();
                    }
                } else {
                    for (let bx = -o.w / 2 + brickW; bx < o.w / 2; bx += brickW) {
                        ctx.beginPath();
                        ctx.moveTo(bx, -o.h / 2 + 3);
                        ctx.lineTo(bx, o.h / 2 - 3);
                        ctx.stroke();
                    }
                }
            } else if (o.variant === 'brick') {
                ctx.strokeStyle = 'rgba(38, 20, 16, 0.20)';
                ctx.lineWidth = 0.9;
                const course = 12;
                if (o.w > o.h) {
                    for (let bx = -o.w / 2 + 16; bx < o.w / 2; bx += 32) {
                        ctx.beginPath();
                        ctx.moveTo(bx, -o.h / 2 + 2);
                        ctx.lineTo(bx, o.h / 2 - 2);
                        ctx.stroke();
                    }
                    ctx.beginPath();
                    ctx.moveTo(-o.w / 2 + 2, 0);
                    ctx.lineTo(o.w / 2 - 2, 0);
                    ctx.stroke();
                } else {
                    for (let by = -o.h / 2 + course; by < o.h / 2; by += course) {
                        ctx.beginPath();
                        ctx.moveTo(-o.w / 2 + 2, by);
                        ctx.lineTo(o.w / 2 - 2, by);
                        ctx.stroke();
                    }
                }
            } else if (o.variant === 'metal' || o.variant === 'ironworks') {
                ctx.strokeStyle = 'rgba(8, 13, 16, 0.34)';
                ctx.lineWidth = 1.2;
                const panelStep = 52;
                if (o.w > o.h) {
                    for (let px = -o.w / 2 + panelStep; px < o.w / 2; px += panelStep) {
                        ctx.beginPath();
                        ctx.moveTo(px, -o.h / 2 + 2);
                        ctx.lineTo(px, o.h / 2 - 2);
                        ctx.stroke();
                    }
                } else {
                    for (let py = -o.h / 2 + panelStep; py < o.h / 2; py += panelStep) {
                        ctx.beginPath();
                        ctx.moveTo(-o.w / 2 + 2, py);
                        ctx.lineTo(o.w / 2 - 2, py);
                        ctx.stroke();
                    }
                }
            }
            // Outline
            ctx.strokeStyle = '#171d21';
            ctx.lineWidth = kind === 'interiorWall' ? 2.5 : 3;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.stroke();
        } else if (kind === 'furniture' || kind === 'machine') {
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            const furnitureVariant = kind === 'machine' ? 'machine' : o.variant;
            if (furnitureVariant === 'machine' || furnitureVariant === 'industrial') {
                const machineGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
                machineGrad.addColorStop(0, '#526068');
                machineGrad.addColorStop(1, '#273136');
                ctx.fillStyle = machineGrad;
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 5);
                ctx.fill();
                ctx.strokeStyle = '#11181c';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = '#141c20';
                roundRect(ctx, -o.w * 0.32, -o.h * 0.24, o.w * 0.64, o.h * 0.30, 3);
                ctx.fill();
                ctx.fillStyle = '#65c5d8';
                ctx.fillRect(-o.w * 0.24, -o.h * 0.16, o.w * 0.20, 5);
                ctx.fillStyle = '#e0ad3e';
                ctx.beginPath();
                ctx.arc(o.w * 0.18, -o.h * 0.09, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(234, 178, 52, 0.72)';
                ctx.lineWidth = 5;
                ctx.setLineDash([9, 7]);
                ctx.beginPath();
                ctx.moveTo(-o.w / 2 + 8, o.h / 2 - 9);
                ctx.lineTo(o.w / 2 - 8, o.h / 2 - 9);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (furnitureVariant === 'locker') {
                ctx.fillStyle = '#43535c';
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
                ctx.fill();
                ctx.strokeStyle = '#202a2f';
                ctx.lineWidth = 2;
                ctx.stroke();
                const columns = Math.max(1, Math.round(o.w / 28));
                for (let i = 1; i < columns; i++) {
                    const x = -o.w / 2 + (i / columns) * o.w;
                    ctx.beginPath();
                    ctx.moveTo(x, -o.h / 2 + 3);
                    ctx.lineTo(x, o.h / 2 - 3);
                    ctx.stroke();
                }
                ctx.fillStyle = 'rgba(191, 216, 224, 0.36)';
                for (let i = 0; i < columns; i++) {
                    const x = -o.w / 2 + ((i + 0.5) / columns) * o.w;
                    ctx.fillRect(x - 5, -o.h / 2 + 7, 10, 2);
                    ctx.fillRect(x - 5, -o.h / 2 + 12, 10, 2);
                }
            } else if (furnitureVariant === 'workbench') {
                ctx.fillStyle = '#29343a';
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
                ctx.fill();
                ctx.strokeStyle = '#11181b';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.fillStyle = '#8a5a34';
                ctx.fillRect(-o.w / 2 + 5, -o.h / 2 + 5, o.w - 10, Math.max(8, o.h * 0.32));
                ctx.fillStyle = '#cf9e3d';
                ctx.fillRect(-o.w * 0.16, 1, o.w * 0.32, 4);
                ctx.fillStyle = '#718089';
                ctx.beginPath();
                ctx.arc(o.w * 0.27, o.h * 0.12, 5, 0, Math.PI * 2);
                ctx.fill();
            } else if (furnitureVariant === 'bed') {
                // Bed frame
                ctx.fillStyle = '#5a4a36';
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 4);
                ctx.fill();
                // Mattress/blanket
                const bedGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
                bedGrad.addColorStop(0, '#4a6878');
                bedGrad.addColorStop(1, '#3d5868');
                ctx.fillStyle = bedGrad;
                roundRect(ctx, -o.w / 2 + 3, -o.h / 2 + 3, o.w - 6, o.h - 6, 3);
                ctx.fill();
                // Pillow
                ctx.fillStyle = '#c8bfae';
                roundRect(ctx, -o.w / 2 + 6, -o.h / 2 + 5, o.w - 12, Math.max(8, o.h * 0.25), 4);
                ctx.fill();
                // Blanket fold line
                ctx.strokeStyle = 'rgba(255,255,255,0.10)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-o.w / 2 + 8, o.h * 0.05);
                ctx.lineTo(o.w / 2 - 8, o.h * 0.05);
                ctx.stroke();
            } else {
                // Table
                ctx.fillStyle = '#6d4a2f';
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
                ctx.fill();
                // Table surface highlight
                const tableGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
                tableGrad.addColorStop(0, 'rgba(255,240,200,0.12)');
                tableGrad.addColorStop(0.5, 'rgba(255,240,200,0.04)');
                tableGrad.addColorStop(1, 'rgba(0,0,0,0.06)');
                ctx.fillStyle = tableGrad;
                roundRect(ctx, -o.w / 2 + 2, -o.h / 2 + 2, o.w - 4, o.h - 4, 2);
                ctx.fill();
                // Legs (corner dots)
                ctx.fillStyle = 'rgba(40, 28, 16, 0.55)';
                const legR = 3;
                ctx.beginPath();
                ctx.arc(-o.w / 2 + 6, -o.h / 2 + 6, legR, 0, Math.PI * 2);
                ctx.arc(o.w / 2 - 6, -o.h / 2 + 6, legR, 0, Math.PI * 2);
                ctx.arc(-o.w / 2 + 6, o.h / 2 - 6, legR, 0, Math.PI * 2);
                ctx.arc(o.w / 2 - 6, o.h / 2 - 6, legR, 0, Math.PI * 2);
                ctx.fill();
                // Outline
                ctx.strokeStyle = 'rgba(30, 20, 10, 0.25)';
                ctx.lineWidth = 1;
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
                ctx.stroke();
            }
        } else if (kind === 'tree') {
            const r = Math.max(o.w, o.h) / 2;
            const treeVariant = o.variant || 'grove';
            const hue = o.hue ?? 118;
            // Trunk
            ctx.fillStyle = treeVariant === 'birch' ? '#c6bfa7' : '#5c3a1e';
            roundRect(ctx, -r * 0.14, -r * 0.05, r * 0.28, r * 0.52, r * 0.07);
            ctx.fill();
            ctx.fillStyle = treeVariant === 'birch' ? 'rgba(66, 60, 52, 0.52)' : 'rgba(90, 65, 35, 0.45)';
            roundRect(ctx, -r * 0.06, 0, r * 0.12, r * 0.38, r * 0.04);
            ctx.fill();
            if (treeVariant === 'pine' || treeVariant === 'giantPine') {
                // Layered, irregular conifer rings remain readable from above.
                const layers = treeVariant === 'giantPine' ? 4 : 3;
                for (let layer = 0; layer < layers; layer++) {
                    const layerRadius = r * (0.9 - layer * 0.15);
                    const points = 18;
                    ctx.fillStyle = `hsl(${hue + layer * 3}, ${34 + layer * 3}%, ${22 + layer * 6}%)`;
                    ctx.beginPath();
                    for (let point = 0; point < points; point++) {
                        const angle = (point / points) * Math.PI * 2 + layer * 0.19;
                        const radius = layerRadius * (point % 2 === 0 ? 1 : 0.68);
                        const px = Math.cos(angle) * radius - layer * r * 0.035;
                        const py = Math.sin(angle) * radius * 0.9 - r * (0.1 + layer * 0.05);
                        if (point === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.fillStyle = `hsl(${hue + 12}, 42%, 42%)`;
                ctx.beginPath();
                ctx.arc(-r * 0.2, -r * 0.4, r * 0.13, 0, Math.PI * 2);
                ctx.fill();
            } else if (treeVariant === 'ancientOak') {
                // Several broad lobes make old oaks look massive without a
                // larger collision box or any animated foliage.
                ctx.fillStyle = `hsl(${hue}, 40%, 24%)`;
                for (let lobe = 0; lobe < 8; lobe++) {
                    const angle = (lobe / 8) * Math.PI * 2 + 0.18;
                    ctx.beginPath();
                    ctx.arc(Math.cos(angle) * r * 0.34, Math.sin(angle) * r * 0.29 - r * 0.12, r * 0.51, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.fillStyle = `hsl(${hue + 7}, 43%, 34%)`;
                for (let lobe = 0; lobe < 5; lobe++) {
                    const angle = (lobe / 5) * Math.PI * 2 - 0.42;
                    ctx.beginPath();
                    ctx.arc(Math.cos(angle) * r * 0.25 - r * 0.08, Math.sin(angle) * r * 0.22 - r * 0.23, r * 0.34, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (treeVariant === 'willowTree') {
                ctx.fillStyle = `hsl(${hue}, 42%, 25%)`;
                for (let lobe = 0; lobe < 10; lobe++) {
                    const angle = (lobe / 10) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.ellipse(Math.cos(angle) * r * 0.34, Math.sin(angle) * r * 0.3 - r * 0.08,
                        r * 0.48, r * 0.24, angle, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.strokeStyle = `hsl(${hue + 8}, 44%, 37%)`;
                ctx.lineWidth = Math.max(1.5, r * 0.045);
                for (let branch = 0; branch < 8; branch++) {
                    const angle = (branch / 8) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(0, -r * 0.12);
                    ctx.quadraticCurveTo(Math.cos(angle) * r * 0.42, Math.sin(angle) * r * 0.3,
                        Math.cos(angle) * r * 0.72, Math.sin(angle) * r * 0.62);
                    ctx.stroke();
                }
            } else {
                const birchLight = treeVariant === 'birch' ? 7 : 0;
                ctx.fillStyle = `hsl(${hue}, 36%, ${26 + birchLight}%)`;
                ctx.beginPath();
                ctx.arc(0, -r * 0.12, r * 0.82, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = `hsl(${hue + 4}, 40%, ${32 + birchLight}%)`;
                ctx.beginPath();
                ctx.arc(-r * 0.08, -r * 0.18, r * 0.62, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = `hsl(${hue + 10}, 44%, ${38 + birchLight}%)`;
                ctx.beginPath();
                ctx.arc(-r * 0.16, -r * 0.28, r * 0.38, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = `hsl(${hue + 14}, 48%, ${44 + birchLight}%)`;
                ctx.beginPath();
                ctx.arc(-r * 0.22, -r * 0.34, r * 0.16, 0, Math.PI * 2);
                ctx.fill();
            }
            if (treeVariant !== 'pine' && treeVariant !== 'giantPine' && treeVariant !== 'willowTree') {
                ctx.strokeStyle = 'rgba(16, 30, 14, 0.32)';
                ctx.lineWidth = Math.max(2.2, r * 0.045);
                ctx.beginPath();
                ctx.arc(0, -r * 0.12, r * 0.84, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (kind === 'bush') {
            const r = Math.max(o.w, o.h) / 2;
            const hue = o.hue ?? 105;
            ctx.shadowBlur = 0;

            if (o.variant === 'juniper') {
                for (let layer = 0; layer < 3; layer++) {
                    const points = 18;
                    const layerR = r * (0.88 - layer * 0.18);
                    ctx.fillStyle = `hsl(${hue + layer * 5}, ${34 + layer * 4}%, ${22 + layer * 7}%)`;
                    ctx.beginPath();
                    for (let i = 0; i < points; i++) {
                        const angle = (i / points) * Math.PI * 2 + layer * 0.21;
                        const radius = layerR * (i % 2 === 0 ? 1 : 0.62);
                        const x = Math.cos(angle) * radius - layer * 2;
                        const y = Math.sin(angle) * radius * 0.78 - layer * 3;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            } else if (o.variant === 'willow') {
                ctx.strokeStyle = `hsl(${hue - 8}, 34%, 24%)`;
                ctx.lineWidth = 2;
                for (let i = 0; i < 10; i++) {
                    const angle = (i / 10) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(0, 2);
                    ctx.quadraticCurveTo(Math.cos(angle) * r * 0.42, Math.sin(angle) * r * 0.28, Math.cos(angle) * r * 0.82, Math.sin(angle) * r * 0.68);
                    ctx.stroke();
                    ctx.fillStyle = `hsl(${hue + (i % 3) * 5}, 42%, ${30 + (i % 2) * 7}%)`;
                    ctx.beginPath();
                    ctx.ellipse(Math.cos(angle) * r * 0.68, Math.sin(angle) * r * 0.54, r * 0.30, r * 0.13, angle, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                const lobeCount = o.variant === 'bramble' ? 9 : 7;
                ctx.fillStyle = `hsl(${hue}, 34%, 23%)`;
                ctx.beginPath();
                for (let i = 0; i < lobeCount; i++) {
                    const angle = (i / lobeCount) * Math.PI * 2;
                    const radius = r * (0.38 + seededNoise(o.x * 0.03 + i, o.y * 0.03) * 0.16);
                    ctx.moveTo(Math.cos(angle) * r * 0.45, Math.sin(angle) * r * 0.35);
                    ctx.arc(Math.cos(angle) * r * 0.45, Math.sin(angle) * r * 0.35, radius, 0, Math.PI * 2);
                }
                ctx.fill();
                ctx.fillStyle = `hsl(${hue + 8}, 42%, 34%)`;
                for (let i = 0; i < lobeCount; i++) {
                    const angle = (i / lobeCount) * Math.PI * 2 + 0.3;
                    ctx.beginPath();
                    ctx.ellipse(Math.cos(angle) * r * 0.36, Math.sin(angle) * r * 0.29 - r * 0.10, r * 0.31, r * 0.20, angle, 0, Math.PI * 2);
                    ctx.fill();
                }
                if (o.variant === 'berry' || o.variant === 'flowering') {
                    ctx.fillStyle = o.variant === 'berry' ? '#a83c4b' : '#eee2c6';
                    for (let i = 0; i < 8; i++) {
                        const angle = i * 2.399;
                        const distance = r * (0.18 + (i % 3) * 0.17);
                        ctx.beginPath();
                        ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance - r * 0.10, o.variant === 'berry' ? 2.3 : 2.8, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                if (o.variant === 'bramble') {
                    ctx.strokeStyle = 'rgba(190, 205, 151, 0.42)';
                    ctx.lineWidth = 1;
                    for (let i = 0; i < 7; i++) {
                        const angle = (i / 7) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.moveTo(Math.cos(angle) * r * 0.48, Math.sin(angle) * r * 0.4);
                        ctx.lineTo(Math.cos(angle) * r * 0.82, Math.sin(angle) * r * 0.67);
                        ctx.stroke();
                    }
                }
            }
        } else if (kind === 'grassTuft') {
            const halfW = o.w / 2;
            const halfH = o.h / 2;
            ctx.lineCap = 'round';
            for (let i = 0; i < 11; i++) {
                const t = i / 10;
                const x = -halfW * 0.72 + t * halfW * 1.44;
                const sway = (seededNoise(o.x * 0.02 + i, o.y * 0.02) - 0.5) * halfW * 0.6;
                ctx.strokeStyle = `hsl(${(o.hue ?? 88) + (i % 3) * 5}, ${32 + (i % 2) * 8}%, ${o.variant === 'dry' ? 38 : 27 + (i % 4) * 4}%)`;
                ctx.lineWidth = 1.4 + (i % 3) * 0.35;
                ctx.beginPath();
                ctx.moveTo(x, halfH * 0.48);
                ctx.quadraticCurveTo(x + sway * 0.35, 0, x + sway, -halfH * (0.55 + (i % 4) * 0.12));
                ctx.stroke();
            }
        } else if (kind === 'wildflowers') {
            const halfW = o.w / 2;
            const halfH = o.h / 2;
            ctx.strokeStyle = '#456338';
            ctx.lineWidth = 1.3;
            for (let i = 0; i < 9; i++) {
                const angle = i * 2.399;
                const distance = (i % 4) / 4 * halfW * 0.9;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance * 0.55;
                ctx.beginPath();
                ctx.moveTo(x, halfH * 0.55);
                ctx.quadraticCurveTo(x - 2, y + 3, x, y - halfH * 0.28);
                ctx.stroke();
                const flowerHue = ((o.hue ?? 45) + i * 31) % 360;
                ctx.fillStyle = `hsl(${flowerHue}, 62%, ${i % 3 === 0 ? 72 : 61}%)`;
                for (let petal = 0; petal < 5; petal++) {
                    const petalAngle = (petal / 5) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.arc(x + Math.cos(petalAngle) * 2.5, y - halfH * 0.28 + Math.sin(petalAngle) * 2.5, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.fillStyle = '#e7b849';
                ctx.beginPath();
                ctx.arc(x, y - halfH * 0.28, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (kind === 'reeds') {
            const halfW = o.w / 2;
            const halfH = o.h / 2;
            for (let i = 0; i < 10; i++) {
                const x = -halfW * 0.75 + (i / 9) * halfW * 1.5;
                const topY = -halfH * (0.45 + (i % 4) * 0.14);
                ctx.strokeStyle = `hsl(${(o.hue ?? 82) + (i % 3) * 4}, 38%, ${27 + (i % 3) * 5}%)`;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(x, halfH * 0.55);
                ctx.quadraticCurveTo(x + (i % 2 ? 3 : -3), 0, x + (i % 3 - 1) * 3, topY);
                ctx.stroke();
                if (o.variant === 'cattails' && i % 3 === 0) {
                    ctx.fillStyle = '#59402d';
                    roundRect(ctx, x - 2 + (i % 3 - 1) * 3, topY - 5, 4, 9, 2);
                    ctx.fill();
                }
            }
        } else if (kind === 'stump') {
            const r = Math.min(o.w, o.h) / 2;
            ctx.fillStyle = '#604126';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#a77a49';
            ctx.beginPath();
            ctx.arc(-2, -2, r * 0.65, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(82, 49, 25, 0.56)';
            ctx.lineWidth = 1.2;
            for (const ring of [0.24, 0.45]) {
                ctx.beginPath();
                ctx.arc(-2, -2, r * ring, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.strokeStyle = '#49643a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(r * 0.08, r * 0.05, r * 0.67, -0.1, 1.25);
            ctx.stroke();
        } else if (kind === 'fallenLog') {
            const halfW = o.w / 2;
            const halfH = o.h / 2;
            const logGradient = ctx.createLinearGradient(0, -halfH, 0, halfH);
            logGradient.addColorStop(0, o.variant === 'birch' ? '#c0b69c' : '#725035');
            logGradient.addColorStop(0.42, o.variant === 'birch' ? '#aaa188' : '#68472f');
            logGradient.addColorStop(1, o.variant === 'birch' ? '#827b6c' : '#4d3423');
            ctx.fillStyle = logGradient;
            roundRect(ctx, -halfW, -halfH, o.w, o.h, halfH * 0.72);
            ctx.fill();
            ctx.strokeStyle = 'rgba(225, 184, 121, 0.16)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-halfW + halfH * 0.55, -halfH * 0.62);
            ctx.lineTo(halfW - halfH * 0.55, -halfH * 0.62);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(43, 28, 18, 0.52)';
            ctx.lineWidth = 1.2;
            for (let x = -halfW + 14; x < halfW - 8; x += 15) {
                ctx.beginPath();
                ctx.moveTo(x, -halfH * 0.65);
                ctx.lineTo(x + 5, halfH * 0.65);
                ctx.stroke();
            }
            ctx.fillStyle = '#b68b57';
            ctx.beginPath();
            ctx.ellipse(-halfW + 2, 0, halfH * 0.68, halfH * 0.88, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(79, 50, 27, 0.55)';
            ctx.beginPath();
            ctx.ellipse(-halfW + 2, 0, halfH * 0.36, halfH * 0.52, 0, 0, Math.PI * 2);
            ctx.stroke();
            if (o.variant === 'mossy') {
                ctx.strokeStyle = '#547044';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(-halfW * 0.25, -halfH * 0.66);
                ctx.quadraticCurveTo(0, -halfH, halfW * 0.45, -halfH * 0.58);
                ctx.stroke();
            }
        } else if (kind === 'mushrooms') {
            for (let i = 0; i < 8; i++) {
                const angle = i * 2.399;
                const distance = 4 + (i % 4) * 3;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance * 0.7;
                ctx.fillStyle = '#d9c7a2';
                ctx.fillRect(x - 1, y, 2, 5);
                ctx.fillStyle = `hsl(${(o.hue ?? 24) + i * 2}, 52%, ${42 + (i % 3) * 6}%)`;
                ctx.beginPath();
                ctx.ellipse(x, y, 4, 2.6, angle, Math.PI, Math.PI * 2);
                ctx.fill();
            }
        } else if (kind === 'roadMarker') {
            ctx.fillStyle = '#c9c5b3';
            roundRect(ctx, -o.w * 0.34, -o.h * 0.46, o.w * 0.68, o.h * 0.88, 4);
            ctx.fill();
            ctx.fillStyle = '#e8e2c9';
            roundRect(ctx, -o.w * 0.23, -o.h * 0.39, o.w * 0.46, o.h * 0.20, 2);
            ctx.fill();
            ctx.fillStyle = o.variant === 'trail' ? '#d7a84e' : '#cc5b43';
            roundRect(ctx, -o.w * 0.20, -o.h * 0.36, o.w * 0.40, o.h * 0.11, 2);
            ctx.fill();
        } else if (kind === 'lampPost') {
            const lampRadius = Math.min(o.w, o.h) * 0.30;
            ctx.fillStyle = '#343a38';
            ctx.beginPath();
            ctx.arc(0, 0, lampRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#e1c67b';
            ctx.beginPath();
            ctx.arc(0, 0, lampRadius * 0.58, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1f2423';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, lampRadius * 0.82, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#252b29';
            ctx.beginPath();
            ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'mailbox') {
            const boxColor = o.hue === 205 ? '#42697b' : o.hue === 2 ? '#8a4d42' : '#596a4c';
            ctx.fillStyle = '#63472c';
            roundRect(ctx, -2.8, -o.h * 0.08, 5.6, o.h * 0.54, 2);
            ctx.fill();
            ctx.fillStyle = boxColor;
            roundRect(ctx, -o.w * 0.44, -o.h * 0.34, o.w * 0.88, o.h * 0.48, 5);
            ctx.fill();
            ctx.strokeStyle = 'rgba(24, 27, 24, 0.62)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.strokeStyle = '#b55446';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(o.w * 0.24, -o.h * 0.24);
            ctx.lineTo(o.w * 0.24, -o.h * 0.48);
            ctx.lineTo(o.w * 0.38, -o.h * 0.48);
            ctx.stroke();
        } else if (kind === 'bench') {
            ctx.fillStyle = '#4a4d48';
            for (const x of [-o.w * 0.34, o.w * 0.34]) {
                roundRect(ctx, x - 2.5, -o.h * 0.36, 5, o.h * 0.72, 2);
                ctx.fill();
            }
            ctx.fillStyle = '#87623b';
            for (const y of [-o.h * 0.23, 0, o.h * 0.23]) {
                roundRect(ctx, -o.w * 0.48, y - 3.2, o.w * 0.96, 6.4, 2);
                ctx.fill();
            }
            ctx.strokeStyle = 'rgba(45, 29, 17, 0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -o.h * 0.23 - 3);
            ctx.lineTo(0, -o.h * 0.23 + 3);
            ctx.stroke();
        } else if (kind === 'picnicTable') {
            ctx.fillStyle = '#735236';
            for (const y of [-o.h * 0.36, o.h * 0.36]) {
                roundRect(ctx, -o.w * 0.47, y - o.h * 0.09, o.w * 0.94, o.h * 0.18, 3);
                ctx.fill();
            }
            ctx.fillStyle = '#987047';
            roundRect(ctx, -o.w * 0.36, -o.h * 0.24, o.w * 0.72, o.h * 0.48, 4);
            ctx.fill();
            ctx.strokeStyle = 'rgba(50, 32, 18, 0.46)';
            ctx.lineWidth = 1.2;
            for (const y of [-o.h * 0.08, o.h * 0.08]) {
                ctx.beginPath();
                ctx.moveTo(-o.w * 0.34, y);
                ctx.lineTo(o.w * 0.34, y);
                ctx.stroke();
            }
        } else if (kind === 'signpost') {
            ctx.fillStyle = '#5d4027';
            roundRect(ctx, -3, -o.h * 0.42, 6, o.h * 0.84, 2);
            ctx.fill();
            ctx.fillStyle = '#8a643d';
            ctx.beginPath();
            ctx.moveTo(-o.w / 2, -o.h * 0.30);
            ctx.lineTo(o.w * 0.34, -o.h * 0.30);
            ctx.lineTo(o.w / 2, -o.h * 0.12);
            ctx.lineTo(o.w * 0.34, o.h * 0.06);
            ctx.lineTo(-o.w / 2, o.h * 0.06);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(38, 25, 14, 0.55)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#c4aa78';
            ctx.beginPath();
            ctx.arc(-o.w * 0.28, -o.h * 0.12, 1.7, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'hayBale') {
            const baleGradient = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
            baleGradient.addColorStop(0, '#c7a64e');
            baleGradient.addColorStop(1, '#8e7136');
            ctx.fillStyle = baleGradient;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, Math.min(8, o.h / 3));
            ctx.fill();
            ctx.strokeStyle = 'rgba(87, 63, 27, 0.58)';
            ctx.lineWidth = 2;
            for (const x of [-o.w * 0.24, o.w * 0.24]) {
                ctx.beginPath();
                ctx.moveTo(x, -o.h / 2 + 2);
                ctx.lineTo(x, o.h / 2 - 2);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(245, 216, 118, 0.32)';
            ctx.lineWidth = 1;
            for (let y = -o.h * 0.28; y <= o.h * 0.28; y += 6) {
                ctx.beginPath();
                ctx.moveTo(-o.w / 2 + 4, y);
                ctx.lineTo(o.w / 2 - 4, y + 2);
                ctx.stroke();
            }
        } else if (kind === 'barrel') {
            const r = Math.max(o.w, o.h) / 2;
            // Metallic body gradient
            const barrelGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.2, 0, 0, 0, r);
            barrelGrad.addColorStop(0, `hsl(${o.hue ?? 22}, 48%, 48%)`);
            barrelGrad.addColorStop(0.5, `hsl(${o.hue ?? 22}, 44%, 37%)`);
            barrelGrad.addColorStop(1, `hsl(${o.hue ?? 22}, 40%, 28%)`);
            ctx.fillStyle = barrelGrad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            // Metal rim
            ctx.strokeStyle = 'rgba(20,18,15,0.5)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            // Metal bands
            ctx.strokeStyle = 'rgba(200,195,180,0.18)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
            ctx.stroke();
            // Rivet highlights
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            // Top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.beginPath();
            ctx.ellipse(-r * 0.15, -r * 0.2, r * 0.35, r * 0.22, -0.3, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'sandbag') {
            // Stacked sandbags look
            const bagH = Math.max(10, o.h / 3);
            const bags = Math.max(2, Math.round(o.h / bagH));
            for (let i = 0; i < bags; i++) {
                const by = -o.h / 2 + i * (o.h / bags);
                const bh = o.h / bags;
                const offset = (i % 2) * 4 - 2;
                ctx.fillStyle = i % 2 === 0 ? '#a3926a' : '#96855c';
                roundRect(ctx, -o.w / 2 + offset, by, o.w - Math.abs(offset), bh - 1, 5);
                ctx.fill();
                // Bag stitching line
                ctx.strokeStyle = 'rgba(60, 48, 24, 0.22)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(-o.w / 4 + offset, by + bh * 0.5);
                ctx.lineTo(o.w / 4 + offset, by + bh * 0.5);
                ctx.stroke();
            }
            // Overall outline
            ctx.strokeStyle = 'rgba(48,40,24,0.32)';
            ctx.lineWidth = 2;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 6);
            ctx.stroke();
            // Highlight on top edge
            ctx.strokeStyle = 'rgba(255,240,200,0.10)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-o.w / 2 + 6, -o.h / 2 + 2);
            ctx.lineTo(o.w / 2 - 6, -o.h / 2 + 2);
            ctx.stroke();
        } else if (kind === 'tent') {
            // Canvas tent with ridge
            const tentGrad = ctx.createLinearGradient(-o.w / 2, 0, o.w / 2, 0);
            tentGrad.addColorStop(0, `hsl(${o.hue ?? 82}, 28%, 30%)`);
            tentGrad.addColorStop(0.5, `hsl(${o.hue ?? 82}, 32%, 38%)`);
            tentGrad.addColorStop(1, `hsl(${o.hue ?? 82}, 28%, 30%)`);
            ctx.fillStyle = tentGrad;
            ctx.beginPath();
            ctx.moveTo(-o.w / 2, o.h / 2);
            ctx.lineTo(-o.w * 0.05, -o.h / 2);
            ctx.lineTo(o.w * 0.05, -o.h / 2);
            ctx.lineTo(o.w / 2, o.h / 2);
            ctx.closePath();
            ctx.fill();
            // Outline
            ctx.strokeStyle = 'rgba(18,20,16,0.42)';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Ridge pole
            ctx.strokeStyle = 'rgba(255,240,200,0.18)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, -o.h / 2 + 4);
            ctx.lineTo(0, o.h / 2 - 3);
            ctx.stroke();
            // Canvas fold lines
            ctx.strokeStyle = 'rgba(0,0,0,0.10)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(-o.w * 0.28, o.h * 0.1);
            ctx.lineTo(-o.w * 0.03, -o.h * 0.38);
            ctx.moveTo(o.w * 0.28, o.h * 0.1);
            ctx.lineTo(o.w * 0.03, -o.h * 0.38);
            ctx.stroke();
            // Guy rope dots (ground stakes)
            ctx.fillStyle = 'rgba(80, 70, 50, 0.45)';
            ctx.beginPath();
            ctx.arc(-o.w / 2 - 6, o.h / 2 + 4, 3, 0, Math.PI * 2);
            ctx.arc(o.w / 2 + 6, o.h / 2 + 4, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'rock') {
            // More natural irregular rock shape
            const hw = o.w / 2;
            const hh = o.h / 2;
            // Base rock shape
            const rockGrad = ctx.createLinearGradient(-hw, -hh, hw * 0.6, hh * 0.6);
            rockGrad.addColorStop(0, `hsl(${o.hue ?? 218}, 14%, 48%)`);
            rockGrad.addColorStop(0.6, `hsl(${o.hue ?? 218}, 12%, 38%)`);
            rockGrad.addColorStop(1, `hsl(${o.hue ?? 218}, 10%, 30%)`);
            ctx.fillStyle = rockGrad;
            ctx.beginPath();
            ctx.moveTo(-hw * 0.78, -hh * 0.12);
            ctx.lineTo(-hw * 0.52, -hh * 0.68);
            ctx.quadraticCurveTo(-hw * 0.2, -hh * 0.82, hw * 0.08, -hh * 0.72);
            ctx.lineTo(hw * 0.58, -hh * 0.48);
            ctx.quadraticCurveTo(hw * 0.82, -hh * 0.14, hw * 0.72, hh * 0.24);
            ctx.lineTo(hw * 0.38, hh * 0.62);
            ctx.quadraticCurveTo(hw * 0.1, hh * 0.78, -hw * 0.22, hh * 0.56);
            ctx.lineTo(-hw * 0.64, hh * 0.32);
            ctx.quadraticCurveTo(-hw * 0.86, hh * 0.08, -hw * 0.78, -hh * 0.12);
            ctx.closePath();
            ctx.fill();
            // Outline
            ctx.strokeStyle = 'rgba(20,24,27,0.32)';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Crack/vein line
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-hw * 0.3, -hh * 0.4);
            ctx.quadraticCurveTo(hw * 0.05, -hh * 0.1, hw * 0.2, hh * 0.3);
            ctx.stroke();
            // Top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.ellipse(-hw * 0.2, -hh * 0.35, hw * 0.22, hh * 0.12, -0.4, 0, Math.PI * 2);
            ctx.fill();
            // Moss spot
            ctx.fillStyle = 'rgba(58, 82, 48, 0.18)';
            ctx.beginPath();
            ctx.ellipse(hw * 0.15, hh * 0.28, hw * 0.16, hh * 0.1, 0.3, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'container') {
            // Shipping container with corrugated texture
            const contGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
            contGrad.addColorStop(0, `hsl(${o.hue ?? 205}, 46%, 40%)`);
            contGrad.addColorStop(0.5, `hsl(${o.hue ?? 205}, 42%, 34%)`);
            contGrad.addColorStop(1, `hsl(${o.hue ?? 205}, 38%, 28%)`);
            ctx.fillStyle = contGrad;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.fill();
            // Corrugated lines
            ctx.strokeStyle = 'rgba(0,0,0,0.10)';
            ctx.lineWidth = 0.8;
            const corrStep = 8;
            for (let cx = -o.w / 2 + corrStep; cx < o.w / 2; cx += corrStep) {
                ctx.beginPath();
                ctx.moveTo(cx, -o.h / 2 + 4);
                ctx.lineTo(cx, o.h / 2 - 4);
                ctx.stroke();
            }
            // Outline
            ctx.strokeStyle = 'rgba(10,14,18,0.52)';
            ctx.lineWidth = 2.5;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.stroke();
            // Corner reinforcements
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            roundRect(ctx, -o.w / 2, -o.h / 2, 10, o.h, 2);
            ctx.fill();
            roundRect(ctx, o.w / 2 - 10, -o.h / 2, 10, o.h, 2);
            ctx.fill();
            // ID plate
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            roundRect(ctx, -o.w * 0.15, -o.h / 2 + 4, o.w * 0.3, 10, 2);
            ctx.fill();
            // Top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(-o.w / 2 + 12, -o.h / 2 + 3, o.w - 24, 3);
        } else if (kind === 'bridge') {
            const halfW = o.w / 2;
            const halfH = o.h / 2;
            const deck = ctx.createLinearGradient(0, -halfH, 0, halfH);
            deck.addColorStop(0, '#555956');
            deck.addColorStop(0.48, '#444947');
            deck.addColorStop(1, '#343a38');
            ctx.fillStyle = '#2b302f';
            roundRect(ctx, -halfW - 7, -halfH - 8, o.w + 14, o.h + 16, 8);
            ctx.fill();
            ctx.fillStyle = deck;
            roundRect(ctx, -halfW, -halfH, o.w, o.h, 5);
            ctx.fill();

            // Concrete end caps and expansion joints make the crossing feel
            // connected to the road instead of like a generic rectangular prop.
            ctx.fillStyle = '#77786e';
            for (const x of [-halfW + 11, halfW - 21]) {
                roundRect(ctx, x, -halfH + 5, 10, o.h - 10, 2);
                ctx.fill();
            }
            ctx.strokeStyle = 'rgba(21, 25, 24, 0.55)';
            ctx.lineWidth = 2;
            for (let x = -halfW + 54; x < halfW - 32; x += 58) {
                ctx.beginPath();
                ctx.moveTo(x, -halfH + 8);
                ctx.lineTo(x, halfH - 8);
                ctx.stroke();
            }

            // Raised rails cast their own tight edge shade and retain a small
            // sun-facing highlight for depth at every zoom level.
            for (const side of [-1, 1]) {
                const y = side * (halfH - 8);
                ctx.strokeStyle = 'rgba(11, 15, 14, 0.48)';
                ctx.lineWidth = 11;
                ctx.beginPath();
                ctx.moveTo(-halfW + 10, y + 4);
                ctx.lineTo(halfW - 10, y + 4);
                ctx.stroke();
                ctx.strokeStyle = '#7d8580';
                ctx.lineWidth = 7;
                ctx.beginPath();
                ctx.moveTo(-halfW + 10, y);
                ctx.lineTo(halfW - 10, y);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(224, 231, 222, 0.30)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-halfW + 12, y - 2.5);
                ctx.lineTo(halfW - 12, y - 2.5);
                ctx.stroke();
            }

            ctx.strokeStyle = 'rgba(225, 211, 151, 0.72)';
            ctx.lineWidth = 3;
            ctx.setLineDash([22, 17]);
            ctx.beginPath();
            ctx.moveTo(-halfW + 24, 0);
            ctx.lineTo(halfW - 24, 0);
            ctx.stroke();
            ctx.setLineDash([]);

            // Continue the highway edge lines across the deck so both ends
            // visually lock onto the underlying road rather than reading as a
            // separate prop placed on top of it.
            ctx.strokeStyle = 'rgba(238, 240, 232, 0.46)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (const y of [-halfH + 21, halfH - 21]) {
                ctx.moveTo(-halfW + 8, y);
                ctx.lineTo(halfW - 8, y);
            }
            ctx.stroke();

            ctx.fillStyle = 'rgba(205, 207, 194, 0.28)';
            ctx.fillRect(-halfW + 8, -halfH + 14, 5, o.h - 28);
            ctx.fillRect(halfW - 13, -halfH + 14, 5, o.h - 28);
            ctx.strokeStyle = 'rgba(12, 16, 15, 0.62)';
            ctx.lineWidth = 2;
            roundRect(ctx, -halfW, -halfH, o.w, o.h, 5);
            ctx.stroke();
        } else if (kind === 'field') {
            this.drawOrganicField(ctx, o);
        } else {
            // Fallback: generic crate
            const crateGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
            crateGrad.addColorStop(0, `hsl(${o.hue ?? 30}, 40%, 40%)`);
            crateGrad.addColorStop(1, `hsl(${o.hue ?? 30}, 36%, 28%)`);
            ctx.fillStyle = crateGrad;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.fill();
            // Outline
            ctx.strokeStyle = 'rgba(22,20,18,0.42)';
            ctx.lineWidth = 2.5;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.stroke();
            ctx.shadowBlur = 0;
            // Cross-brace pattern
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-o.w / 2 + 6, -o.h / 2 + 6);
            ctx.lineTo(o.w / 2 - 6, o.h / 2 - 6);
            ctx.moveTo(o.w / 2 - 6, -o.h / 2 + 6);
            ctx.lineTo(-o.w / 2 + 6, o.h / 2 - 6);
            ctx.stroke();
            // Center nail/bolt
            ctx.fillStyle = 'rgba(180,170,140,0.28)';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    getCachedSurfacePath(o, key, tracePath) {
        if (typeof Path2D === 'undefined' || !o) return null;
        let paths = this._surfacePathCache.get(o);
        if (!paths) {
            paths = new Map();
            this._surfacePathCache.set(o, paths);
        }
        let path = paths.get(key);
        if (!path) {
            path = new Path2D();
            tracePath(path);
            paths.set(key, path);
        }
        return path;
    }

    fillSurfacePath(ctx, o, key, tracePath) {
        const path = this.getCachedSurfacePath(o, key, tracePath);
        if (path) ctx.fill(path);
        else {
            tracePath(ctx);
            ctx.fill();
        }
    }

    strokeSurfacePath(ctx, o, key, tracePath) {
        const path = this.getCachedSurfacePath(o, key, tracePath);
        if (path) ctx.stroke(path);
        else {
            tracePath(ctx);
            ctx.stroke();
        }
    }

    clipSurfacePath(ctx, o, key, tracePath) {
        const path = this.getCachedSurfacePath(o, key, tracePath);
        if (path) ctx.clip(path);
        else {
            tracePath(ctx);
            ctx.clip();
        }
    }

    rebuildSurfaceChunkSources() {
        const tile = this._surfaceChunkTileSize;
        const buckets = this._surfaceChunkSources;
        buckets.clear();
        const add = (obstacle, type, padding) => {
            const halfW = (obstacle._renderHalfW ?? Math.abs(Number(obstacle.w) || 0) / 2) + padding;
            const halfH = (obstacle._renderHalfH ?? Math.abs(Number(obstacle.h) || 0) / 2) + padding;
            const minGridX = Math.floor((obstacle.x - halfW) / tile);
            const maxGridX = Math.floor((obstacle.x + halfW - 0.001) / tile);
            const minGridY = Math.floor((obstacle.y - halfH) / tile);
            const maxGridY = Math.floor((obstacle.y + halfH - 0.001) / tile);
            for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
                for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
                    const key = gridX + ':' + gridY;
                    let bucket = buckets.get(key);
                    if (!bucket) {
                        bucket = { fields: [], water: [], roads: [] };
                        buckets.set(key, bucket);
                    }
                    bucket[type].push(obstacle);
                }
            }
        };
        for (const obstacle of this.fieldObstacles) add(obstacle, 'fields', 40);
        for (const obstacle of this.waterObstacles) add(obstacle, 'water', 50);
        // roadObstacles is already layer-sorted, so every bucket preserves the
        // exact trail -> road -> junction draw order.
        for (const obstacle of this.roadObstacles) add(obstacle, 'roads', 64);
    }

    invalidateSurfaceChunksForObstacle(obstacle) {
        if (!obstacle || !SURFACE_KINDS.has(obstacle.kind)) return;
        const tile = this._surfaceChunkTileSize;
        const rotation = Number(obstacle.rotation) || 0;
        const cos = Math.abs(Math.cos(rotation));
        const sin = Math.abs(Math.sin(rotation));
        const rawHalfW = Math.abs(Number(obstacle.w) || 0) / 2;
        const rawHalfH = Math.abs(Number(obstacle.h) || 0) / 2;
        const halfW = cos * rawHalfW + sin * rawHalfH + 64;
        const halfH = sin * rawHalfW + cos * rawHalfH + 64;
        const minGridX = Math.floor((obstacle.x - halfW) / tile);
        const maxGridX = Math.floor((obstacle.x + halfW - 0.001) / tile);
        const minGridY = Math.floor((obstacle.y - halfH) / tile);
        const maxGridY = Math.floor((obstacle.y + halfH - 0.001) / tile);
        for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
            for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
                const key = gridX + ':' + gridY;
                const sprite = this._surfaceChunkCache.get(key);
                if (!sprite) continue;
                this._surfaceChunkCachePixels -= sprite.pixels || 0;
                this._surfaceChunkCache.delete(key);
            }
        }
    }

    buildSurfaceChunk(gridX, gridY) {
        if (typeof document === 'undefined') return null;
        const tile = this._surfaceChunkTileSize;
        const scale = 1.25;
        const bleed = 4;
        const left = gridX * tile;
        const top = gridY * tile;
        const expandedLeft = left - bleed;
        const expandedTop = top - bleed;
        const expandedRight = left + tile + bleed;
        const expandedBottom = top + tile + bleed;

        const key = gridX + ':' + gridY;
        const sources = this._surfaceChunkSources.get(key);
        const fields = sources?.fields || [];
        const water = sources?.water || [];
        const roads = sources?.roads || [];
        if (!fields.length && !water.length && !roads.length) {
            const emptySprite = { canvas: null, pixels: 0, left, top };
            this._surfaceChunkCache.set(key, emptySprite);
            return emptySprite;
        }

        const width = Math.round((tile + bleed * 2) * scale);
        const height = width;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const cacheCtx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (!cacheCtx) return null;

        const previousBounds = [this._viewLeft, this._viewTop, this._viewRight, this._viewBottom];
        const previousBuildingChunk = this._buildingSurfaceChunk;
        this._viewLeft = expandedLeft;
        this._viewTop = expandedTop;
        this._viewRight = expandedRight;
        this._viewBottom = expandedBottom;
        this._buildingSurfaceChunk = true;

        cacheCtx.imageSmoothingEnabled = true;
        cacheCtx.imageSmoothingQuality = 'medium';
        cacheCtx.scale(scale, scale);
        cacheCtx.translate(-expandedLeft, -expandedTop);
        try {
            for (const o of fields) this.drawObstacle(cacheCtx, o, false);
            for (const o of water) this.drawObstacleShore(cacheCtx, o, false);
            for (const o of roads) this.drawRoadShoulder(cacheCtx, o, false);
            for (const o of water) this.drawObstacleBody(cacheCtx, o, false);
            for (const o of roads) this.drawRoadBody(cacheCtx, o, false);
            for (const o of roads) this.drawRoadMarkings(cacheCtx, o, false);
        } finally {
            [this._viewLeft, this._viewTop, this._viewRight, this._viewBottom] = previousBounds;
            this._buildingSurfaceChunk = previousBuildingChunk;
        }

        const pixels = width * height;
        const sprite = {
            canvas,
            pixels,
            left,
            top,
            sourceX: Math.round(bleed * scale),
            sourceY: Math.round(bleed * scale),
            sourceSize: Math.round(tile * scale),
        };
        const maxPixels = Math.max(
            18_000_000,
            ((this._surfaceChunkRequiredCount || 1) + 2) * pixels,
        );
        while (this._surfaceChunkCache.size && this._surfaceChunkCachePixels + pixels > maxPixels) {
            const oldestKey = this._surfaceChunkCache.keys().next().value;
            const oldest = this._surfaceChunkCache.get(oldestKey);
            this._surfaceChunkCachePixels -= oldest?.pixels || 0;
            this._surfaceChunkCache.delete(oldestKey);
        }
        this._surfaceChunkCache.set(key, sprite);
        this._surfaceChunkCachePixels += pixels;
        return sprite;
    }

    prefetchSurfaceChunkAhead(camX, camY, minGridX, maxGridX, minGridY, maxGridY) {
        const previousX = this._lastSurfaceCamX;
        const previousY = this._lastSurfaceCamY;
        this._lastSurfaceCamX = camX;
        this._lastSurfaceCamY = camY;
        if (!Number.isFinite(previousX) || !Number.isFinite(previousY)
            || this._surfaceChunkBuildsThisFrame >= 1
            || this._cacheBuildsThisFrame >= 1) return;

        const dx = camX - previousX;
        const dy = camY - previousY;
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
        const candidates = this._surfacePrefetchCandidates;
        candidates.length = 0;
        let candidateCount = 0;
        if (Math.abs(dx) >= Math.abs(dy)) {
            const gridX = dx >= 0 ? maxGridX + 1 : minGridX - 1;
            for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
                const candidate = candidates[candidateCount] || (candidates[candidateCount] = {});
                candidate.gridX = gridX;
                candidate.gridY = gridY;
                candidate.distance = Math.abs((gridY + 0.5) * this._surfaceChunkTileSize - camY);
                candidateCount++;
            }
        } else {
            const gridY = dy >= 0 ? maxGridY + 1 : minGridY - 1;
            for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
                const candidate = candidates[candidateCount] || (candidates[candidateCount] = {});
                candidate.gridX = gridX;
                candidate.gridY = gridY;
                candidate.distance = Math.abs((gridX + 0.5) * this._surfaceChunkTileSize - camX);
                candidateCount++;
            }
        }
        candidates.length = candidateCount;
        candidates.sort((a, b) => a.distance - b.distance);
        for (const candidate of candidates) {
            const key = candidate.gridX + ':' + candidate.gridY;
            if (this._surfaceChunkCache.has(key)) continue;
            this._surfaceChunkBuildsThisFrame++;
            this._cacheBuildsThisFrame++;
            this.buildSurfaceChunk(candidate.gridX, candidate.gridY);
            break;
        }
    }

    drawSurfaceChunkFallback(ctx, gridX, gridY) {
        const key = gridX + ':' + gridY;
        const sources = this._surfaceChunkSources.get(key);
        if (!sources) return;
        const tile = this._surfaceChunkTileSize;
        ctx.save();
        ctx.beginPath();
        ctx.rect(gridX * tile, gridY * tile, tile, tile);
        ctx.clip();
        for (const obstacle of sources.fields) this.drawObstacle(ctx, obstacle, false);
        for (const obstacle of sources.water) this.drawObstacleShore(ctx, obstacle, false);
        for (const obstacle of sources.roads) this.drawRoadShoulder(ctx, obstacle, false);
        for (const obstacle of sources.water) this.drawObstacleBody(ctx, obstacle, false);
        for (const obstacle of sources.roads) this.drawRoadBody(ctx, obstacle, false);
        for (const obstacle of sources.roads) this.drawRoadMarkings(ctx, obstacle, false);
        ctx.restore();
    }

    drawSurfaceChunks(ctx, camX, camY, viewW, viewH, zoom) {
        if (typeof document === 'undefined' || !this.surfaceObstacles.length) return false;
        const tile = this._surfaceChunkTileSize;
        const halfW = viewW / Math.max(0.1, zoom) / 2 + 12;
        const halfH = viewH / Math.max(0.1, zoom) / 2 + 12;
        const minGridX = Math.floor((camX - halfW) / tile);
        const maxGridX = Math.floor((camX + halfW - 0.001) / tile);
        const minGridY = Math.floor((camY - halfH) / tile);
        const maxGridY = Math.floor((camY + halfH - 0.001) / tile);
        const required = this._surfaceChunkRequired;
        required.length = 0;
        let requiredCount = 0;
        this._surfaceChunkRequiredCount = (maxGridX - minGridX + 1) * (maxGridY - minGridY + 1);

        for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
            for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
                const key = gridX + ':' + gridY;
                let sprite = this._surfaceChunkCache.get(key);
                if (!sprite && this._surfaceChunkBuildsThisFrame < 1 && this._cacheBuildsThisFrame < 1) {
                    this._surfaceChunkBuildsThisFrame++;
                    this._cacheBuildsThisFrame++;
                    sprite = this.buildSurfaceChunk(gridX, gridY);
                }
                const requiredEntry = required[requiredCount] || (required[requiredCount] = {});
                requiredEntry.key = key;
                requiredEntry.sprite = sprite;
                requiredEntry.gridX = gridX;
                requiredEntry.gridY = gridY;
                requiredCount++;
            }
        }
        required.length = requiredCount;

        for (const { key, sprite, gridX, gridY } of required) {
            // Never switch the entire viewport back to expensive vector
            // rendering because one edge tile is cold. Only that tile uses the
            // clipped fallback, keeping every already-cached road pixel stable.
            if (!sprite) {
                this.drawSurfaceChunkFallback(ctx, gridX, gridY);
                continue;
            }
            this._surfaceChunkCache.delete(key);
            this._surfaceChunkCache.set(key, sprite);
            if (!sprite.canvas) continue;
            ctx.drawImage(
                sprite.canvas,
                sprite.sourceX,
                sprite.sourceY,
                sprite.sourceSize,
                sprite.sourceSize,
                sprite.left,
                sprite.top,
                tile,
                tile,
            );
        }
        this.prefetchSurfaceChunkAhead(camX, camY, minGridX, maxGridX, minGridY, maxGridY);
        return true;
    }

    drawCachedSurfaceLayer(ctx, o, layer, drawLayer) {
        if (typeof document === 'undefined' || !o?.id || this._buildingSurfaceCache) return false;

        const padding = layer === 'field' ? 48
            : o.kind === 'water' ? Math.ceil(Math.max(o.w || 0, o.h || 0) * 0.075 + 40)
                : layer === 'waterShore' ? 44
                    : layer === 'roadShoulder' ? 30 : 20;
        const halfW = o._renderHalfW ?? Math.abs(Number(o.w) || 0) / 2;
        const halfH = o._renderHalfH ?? Math.abs(Number(o.h) || 0) / 2;
        const worldWidth = Math.ceil(halfW * 2 + padding * 2);
        const worldHeight = Math.ceil(halfH * 2 + padding * 2);
        const worldArea = worldWidth * worldHeight;
        // Cache normal fields, ponds, junctions and local road/trail sections.
        // Giant map-spanning splines stay vector-rendered to avoid huge textures.
        if (!worldWidth || !worldHeight || worldWidth > 2800 || worldHeight > 2100 || worldArea > 2_650_000) return false;

        const scale = Math.min(1.75, Math.max(1, (this.targetZoom || 1) * (this.renderDpr || 1)));
        let objectKey = this._surfaceCacheKeyByObject.get(o);
        if (!objectKey) {
            const pointsKey = o.points?.length
                ? o.points.map(point => `${Math.round(point.x)},${Math.round(point.y)}`).join(';')
                : '';
            objectKey = [
                o.id, o.kind || '', o.variant || '', o.x, o.y, o.w, o.h, o.width || '',
                Number(o.rotation || 0).toFixed(3), pointsKey,
            ].join(':');
            this._surfaceCacheKeyByObject.set(o, objectKey);
        }
        const key = `${objectKey}:${layer}:${scale.toFixed(2)}`;
        let sprite = this._surfaceSpriteCache.get(key);
        if (sprite) {
            // Refresh recency so actively visible structures are not evicted by
            // one-off textures encountered while the camera is moving.
            this._surfaceSpriteCache.delete(key);
            this._surfaceSpriteCache.set(key, sprite);
        }
        if (!sprite) {
            // Large canvases are intentionally built one at a time so entering a
            // new area cannot turn one frame into a long cache-generation spike.
            if (this._surfaceCacheBuildsThisFrame >= 1 || this._cacheBuildsThisFrame >= 1) return false;
            this._surfaceCacheBuildsThisFrame++;
            this._cacheBuildsThisFrame++;

            const width = Math.ceil(worldWidth * scale);
            const height = Math.ceil(worldHeight * scale);
            const pixels = width * height;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const cacheCtx = canvas.getContext('2d', { alpha: true, desynchronized: true });
            if (!cacheCtx) return false;
            cacheCtx.imageSmoothingEnabled = true;
            cacheCtx.imageSmoothingQuality = 'medium';
            cacheCtx.translate(width / 2, height / 2);
            cacheCtx.scale(scale, scale);
            cacheCtx.translate(-o.x, -o.y);
            this._buildingSurfaceCache = true;
            try {
                drawLayer(cacheCtx);
            } finally {
                this._buildingSurfaceCache = false;
            }
            sprite = { canvas, worldWidth, worldHeight, pixels };

            // Bound the per-object fallback cache by actual texture area (~24 MB
            // RGBA); the steady-state chunk cache owns the larger surface budget.
            const maxPixels = 6_000_000;
            while (this._surfaceSpriteCache.size && this._surfaceCachePixels + pixels > maxPixels) {
                const oldestKey = this._surfaceSpriteCache.keys().next().value;
                const oldest = this._surfaceSpriteCache.get(oldestKey);
                this._surfaceCachePixels -= oldest?.pixels || 0;
                this._surfaceSpriteCache.delete(oldestKey);
            }
            this._surfaceSpriteCache.set(key, sprite);
            this._surfaceCachePixels += pixels;
        }

        ctx.drawImage(
            sprite.canvas,
            o.x - sprite.worldWidth / 2,
            o.y - sprite.worldHeight / 2,
            sprite.worldWidth,
            sprite.worldHeight,
        );
        return true;
    }
    drawCachedObstacle(ctx, o, kind) {
        if (typeof document === 'undefined' || !o?.id || !CACHEABLE_PROP_KINDS.has(kind)) return false;
        const maxCacheW = kind === 'houseFloor' ? 2000 : 320;
        const maxCacheH = kind === 'houseFloor' ? 1400 : 320;
        if (o.w > maxCacheW || o.h > maxCacheH || !o.w || !o.h) return false;

        // Cache at the same physical density the world is displayed at. The old
        // 1x sprites were enlarged by camera zoom, making props and floors soft.
        const scale = Math.min(1.6, Math.max(1, (this.targetZoom || 1) * (this.renderDpr || 1)));
        const key = [o.id, kind, o.variant || '', o.x, o.y, o.w, o.h, Number(o.rotation || 0).toFixed(3), o.orientation || '', o.role || '', scale.toFixed(2)].join(':');
        let sprite = this._obstacleSpriteCache.get(key);
        if (sprite) {
            this._obstacleSpriteCache.delete(key);
            this._obstacleSpriteCache.set(key, sprite);
        }
        if (!sprite) {
            // Spread cold prop-cache creation across frames. The vector fallback
            // is visually identical, while avoiding a burst when a town enters view.
            if (this._obstacleCacheBuildsThisFrame >= 1 || this._cacheBuildsThisFrame >= 1) return false;
            this._obstacleCacheBuildsThisFrame++;
            this._cacheBuildsThisFrame++;

            const rotated = Math.abs(o.rotation || 0) > 0.001;
            const extent = rotated ? Math.hypot(o.w, o.h) : 0;
            const worldWidth = Math.ceil((rotated ? extent : o.w) + 40);
            const worldHeight = Math.ceil((rotated ? extent : o.h) + 46);
            const width = Math.ceil(worldWidth * scale);
            const height = Math.ceil(worldHeight * scale);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const cacheCtx = canvas.getContext('2d', { alpha: true });
            if (!cacheCtx) return false;
            cacheCtx.imageSmoothingEnabled = true;
            cacheCtx.imageSmoothingQuality = 'high';
            cacheCtx.translate(width / 2, height / 2);
            cacheCtx.scale(scale, scale);
            cacheCtx.translate(-o.x, -o.y);
            this.drawObstacle(cacheCtx, o, false);
            const pixels = width * height;
            sprite = { canvas, width, height, worldWidth, worldHeight, pixels };

            const maxPixels = 12_000_000;
            while (this._obstacleSpriteCache.size && (
                this._obstacleSpriteCache.size >= 900
                || this._obstacleCachePixels + pixels > maxPixels
            )) {
                const oldestKey = this._obstacleSpriteCache.keys().next().value;
                const oldest = this._obstacleSpriteCache.get(oldestKey);
                this._obstacleCachePixels -= oldest?.pixels || 0;
                this._obstacleSpriteCache.delete(oldestKey);
            }
            this._obstacleSpriteCache.set(key, sprite);
            this._obstacleCachePixels += pixels;
        }

        const shake = this.getObstacleHitShake(o);
        ctx.drawImage(
            sprite.canvas,
            o.x + shake.x - sprite.worldWidth / 2,
            o.y + shake.y - sprite.worldHeight / 2,
            sprite.worldWidth,
            sprite.worldHeight,
        );
        return true;
    }
    drawChestBursts(ctx, currentHouse = null, currentRoom = null) {
        if (!this.chestBursts.length) return;
        const now = this._frameNow;
        let liveCount = 0;
        ctx.save();
        for (const burst of this.chestBursts) {
            if (now >= burst.endAt) continue;
            this.chestBursts[liveCount++] = burst;
            if (!this.isPointInView(burst.x, burst.y, 90)) continue;
            if (this.isPointHiddenByRooms(burst.x, burst.y, currentHouse, currentRoom)) continue;

            const t = clamp((now - burst.startedAt) / Math.max(1, burst.endAt - burst.startedAt), 0, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            const alpha = Math.max(0, 1 - t);
            const tierColor = RARITY_COLORS[burst.tier] || '#f5bd63';
            ctx.save();
            ctx.translate(burst.x, burst.y);

            ctx.globalAlpha = alpha * 0.72;
            ctx.strokeStyle = tierColor;
            ctx.lineWidth = 3 - t * 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 14 + ease * 48, 0, Math.PI * 2);
            ctx.stroke();

            ctx.globalAlpha = alpha * 0.38;
            ctx.strokeStyle = '#fff3c4';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 8 + ease * 31, 0, Math.PI * 2);
            ctx.stroke();

            // The lid flips away as the contents launch from the chest center.
            ctx.save();
            ctx.translate(0, -8 - Math.sin(t * Math.PI) * 28 - ease * 10);
            ctx.rotate(-0.08 + ease * 1.15);
            ctx.globalAlpha = Math.max(0, 1 - t * 1.25);
            ctx.fillStyle = burst.tier === 'rare' ? '#2f69b5'
                : burst.tier === 'military' ? '#53653d'
                    : '#8c4d27';
            ctx.strokeStyle = 'rgba(23, 13, 7, 0.85)';
            ctx.lineWidth = 2;
            roundRect(ctx, -21, -6, 42, 12, 3);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = tierColor;
            ctx.fillRect(-2, -6, 4, 12);
            ctx.restore();

            ctx.restore();
        }
        ctx.restore();
        this.chestBursts.length = liveCount;
    }

    drawLootContainer(ctx, l) {
        const type = l.type === 'deathCrate' ? 'death_crate' : (l.containerType || 'wood_crate');
        const palettes = {
            wood_crate: { top: '#a96b32', body: '#7a421f', trim: '#382014', mark: '#dca765' },
            supply_crate: { top: '#b78442', body: '#7b5328', trim: '#31483a', mark: '#e8c47d' },
            ammo_crate: { top: '#65734b', body: '#3f4b32', trim: '#20271b', mark: '#e7d76e' },
            medical_crate: { top: '#e6e3d7', body: '#b9b9ae', trim: '#355847', mark: '#e7f5eb' },
            armory_crate: { top: '#4b5657', body: '#283234', trim: '#12191a', mark: '#e0b84d' },
            death_crate: { top: '#56396e', body: '#30203e', trim: '#17101f', mark: '#d8b4fe' },
        };
        const palette = palettes[type] || palettes.wood_crate;
        const shake = this.getObstacleHitShake(l);
        const hpRatio = clamp((Number(l.hp) || Number(l.maxHp) || 1) / Math.max(1, Number(l.maxHp) || 1), 0, 1);

        ctx.save();
        ctx.translate(shake.x, shake.y);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.beginPath();
        ctx.ellipse(0, 12, 23, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(type === 'medical_crate' ? 0.025 : -0.045);

        ctx.fillStyle = palette.body;
        ctx.strokeStyle = palette.trim;
        ctx.lineWidth = 2.2;
        roundRect(ctx, -21, -13, 42, 28, 2.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = palette.top;
        roundRect(ctx, -21, -14, 42, 11, 2.5);
        ctx.fill();
        ctx.stroke();

        if (type === 'wood_crate' || type === 'supply_crate') {
            ctx.strokeStyle = type === 'supply_crate' ? '#31483a' : '#4b2918';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-16, -8); ctx.lineTo(15, 11);
            ctx.moveTo(16, -8); ctx.lineTo(-15, 11);
            ctx.stroke();
            ctx.fillStyle = palette.mark;
            ctx.fillRect(-3, -14, 6, 29);
        } else if (type === 'ammo_crate') {
            ctx.fillStyle = palette.mark;
            for (let x = -8; x <= 8; x += 8) {
                roundRect(ctx, x - 2, -7, 4, 14, 1.5);
                ctx.fill();
            }
            ctx.font = '900 6px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('AMMO', 0, 11);
        } else if (type === 'medical_crate') {
            ctx.fillStyle = '#2f8f5b';
            ctx.fillRect(-4, -10, 8, 20);
            ctx.fillRect(-11, -4, 22, 8);
        } else if (type === 'armory_crate') {
            ctx.fillStyle = palette.mark;
            ctx.fillRect(-18, -11, 5, 23);
            ctx.fillRect(13, -11, 5, 23);
            ctx.font = '900 7px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('ARM', 0, 3);
        } else {
            ctx.strokeStyle = palette.mark;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
            ctx.moveTo(0, -7); ctx.lineTo(0, 7);
            ctx.stroke();
        }

        if (hpRatio < 0.74) {
            ctx.strokeStyle = 'rgba(28, 18, 12, 0.82)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(-7, -12); ctx.lineTo(-2, -5); ctx.lineTo(-6, 2); ctx.lineTo(1, 9);
            if (hpRatio < 0.38) {
                ctx.moveTo(10, -10); ctx.lineTo(5, -2); ctx.lineTo(11, 5);
            }
            ctx.stroke();
        }
        ctx.restore();
    }
    drawLoot(ctx, l) {
        const color = l.type === 'ammo' ? (AMMO_COLORS[l.ammoType] || LOOT_COLORS.ammo) : (LOOT_COLORS[l.type] || '#d5d5d5');
        const isChest = l.type === 'chest' || l.type === 'deathCrate';
        const pulse = isChest ? 1 : (1 + Math.sin(this._frameNow / 190 + l.x * 0.03) * 0.06);
        const isBursting = !isChest && l._burstEndAt > this._frameNow && Number.isFinite(l.spawnX) && Number.isFinite(l.spawnY);
        const burstDuration = Math.max(1, (l._burstEndAt || 0) - (l._burstStartedAt || 0));
        const burstT = isBursting
            ? clamp((this._frameNow - l._burstStartedAt) / burstDuration, 0, 1)
            : 1;
        const burstEase = 1 - Math.pow(1 - burstT, 3);
        const arcHeight = l.type === 'weapon' ? 44 : 32;
        const drawX = isBursting ? lerp(l.spawnX, l.x, burstEase) : l.x;
        const drawY = isBursting
            ? lerp(l.spawnY, l.y, burstEase) - Math.sin(burstT * Math.PI) * arcHeight
            : l.y;
        const landingBounce = burstT > 0.72
            ? Math.sin(((burstT - 0.72) / 0.28) * Math.PI) * 0.16
            : 0;
        const burstScale = isBursting ? 0.48 + burstEase * 0.52 + landingBounce : 1;

        ctx.save();
        if (isBursting) {
            ctx.fillStyle = `rgba(4, 7, 5, ${0.12 + burstEase * 0.24})`;
            ctx.beginPath();
            ctx.ellipse(l.x, l.y + 10, 10 + burstEase * 8, 3 + burstEase * 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.translate(drawX, drawY);
        if (isBursting) ctx.rotate((1 - burstEase) * (l._burstSpin || 0));
        ctx.scale(pulse * burstScale, pulse * burstScale);

        if (isChest) {
            this.drawLootContainer(ctx, l);
        } else {
            if (!isBursting) {
                ctx.fillStyle = 'rgba(6, 9, 7, 0.34)';
                ctx.beginPath();
                ctx.ellipse(0, 10, 18, 7, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            const groundGlow = ctx.createRadialGradient(0, 0, 3, 0, 0, 25);
            groundGlow.addColorStop(0, color + '38');
            groundGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = groundGlow;
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.translate(0, -2);
            ctx.fillStyle = color;
            ctx.strokeStyle = 'rgba(8, 11, 9, 0.9)';
            ctx.lineWidth = 1.8;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;

            if (l.type === 'weapon') {
                if (l.weaponType === 'pistol') {
                    // M9
                    ctx.rotate(-0.22);

                    // Gunmetal gray slide
                    ctx.fillStyle = '#4b5563';
                    roundRect(ctx, -6, -4, 14, 4.5, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Grip
                    ctx.save();
                    ctx.translate(-3, 0);
                    ctx.rotate(0.35);
                    ctx.fillStyle = '#1f2937';
                    roundRect(ctx, -2, 0, 4.5, 8.5, 1.2);
                    ctx.fill();
                    ctx.stroke();

                    // Tan grip panel
                    ctx.fillStyle = '#a16207';
                    roundRect(ctx, -1, 1.5, 2.5, 5.5, 0.8);
                    ctx.fill();
                    ctx.restore();

                    // Trigger guard
                    ctx.strokeStyle = 'rgba(8, 11, 9, 0.95)';
                    ctx.beginPath();
                    ctx.arc(0.5, 1.2, 2.2, 0, Math.PI * 2);
                    ctx.stroke();

                    // Barrel tip
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(8, -3, 2, 2.5);
                } else if (l.weaponType === 'revolver') {
                    // OT-38
                    ctx.rotate(-0.15);

                    // Steel cylinder
                    ctx.fillStyle = '#9ca3af';
                    ctx.beginPath();
                    ctx.ellipse(-1, -1.5, 4.2, 4.2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    // Cylinder detail
                    ctx.fillStyle = '#374151';
                    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
                        ctx.beginPath();
                        ctx.arc(-1 + Math.cos(a) * 2.2, -1.5 + Math.sin(a) * 2.2, 0.9, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // Steel frame
                    ctx.fillStyle = '#cbd5e1';
                    roundRect(ctx, -6, -3.8, 8, 4, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Long barrel
                    roundRect(ctx, 2, -3.8, 12, 3, 0.8);
                    ctx.fill();
                    ctx.stroke();

                    // Ejector rod
                    ctx.fillStyle = '#4b5563';
                    ctx.fillRect(3, -0.8, 8, 1);

                    // Wooden grip
                    ctx.save();
                    ctx.translate(-4, 0);
                    ctx.rotate(0.55);
                    ctx.fillStyle = '#7c2d12'; // Mahogany wood
                    roundRect(ctx, -2.2, 1, 4.5, 9, 1.8);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                } else if (l.weaponType === 'smg') {
                    // MP5
                    ctx.rotate(-0.25);

                    // Skeletal stock
                    ctx.fillStyle = '#1f2937';
                    ctx.beginPath();
                    ctx.moveTo(-9, -2);
                    ctx.lineTo(-18, -4);
                    ctx.lineTo(-18, 4);
                    ctx.lineTo(-14, 2);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Main receiver
                    ctx.fillStyle = '#374151';
                    roundRect(ctx, -9, -5.5, 18, 9.5, 2);
                    ctx.fill();
                    ctx.stroke();

                    // Muzzle shroud
                    ctx.fillStyle = '#111827';
                    roundRect(ctx, 9, -3.5, 7, 3, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Curved magazine
                    ctx.save();
                    ctx.translate(1, 4);
                    ctx.rotate(-0.2);
                    ctx.fillStyle = '#111827';
                    roundRect(ctx, -2, 0, 3.8, 11, 1);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();

                    // Pistol grip
                    ctx.save();
                    ctx.translate(-5, 3.5);
                    ctx.rotate(0.4);
                    ctx.fillStyle = '#1f2937';
                    roundRect(ctx, -2, 0, 4, 7, 1);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                } else if (l.weaponType === 'shotgun') {
                    // M870
                    ctx.rotate(-0.18);

                    // Wooden Stock
                    ctx.fillStyle = '#78350f';
                    ctx.beginPath();
                    ctx.moveTo(-14, -2);
                    ctx.lineTo(-24, 0);
                    ctx.lineTo(-24, 6);
                    ctx.lineTo(-14, 3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Steel Receiver
                    ctx.fillStyle = '#4b5563';
                    roundRect(ctx, -14, -3.5, 14, 6.5, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Long dual barrel tube
                    ctx.fillStyle = '#1f2937';
                    ctx.fillRect(0, -3, 23, 2.5); // Barrel
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(0, -0.5, 21, 2.2); // Mag tube

                    // Wooden slide pump
                    ctx.fillStyle = '#92400e';
                    roundRect(ctx, 1, 1, 9, 3.5, 1);
                    ctx.fill();
                    ctx.stroke();
                } else if (l.weaponType === 'assault') {
                    // M416
                    ctx.rotate(-0.2);

                    // Composite stock
                    ctx.fillStyle = '#273024';
                    ctx.beginPath();
                    ctx.moveTo(-13, -2);
                    ctx.lineTo(-22, -1);
                    ctx.lineTo(-22, 6);
                    ctx.lineTo(-13, 3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Receiver
                    ctx.fillStyle = '#374151';
                    roundRect(ctx, -13, -4.2, 18, 7.5, 1.5);
                    ctx.fill();
                    ctx.stroke();

                    // Green handguard
                    ctx.fillStyle = '#273024';
                    roundRect(ctx, 5, -3.5, 10, 5.5, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Barrel & muzzle
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(15, -2.5, 15, 2.2);
                    ctx.fillRect(29, -3.5, 2.5, 4.2);

                    // Curved magazine
                    ctx.save();
                    ctx.translate(1.5, 3.3);
                    ctx.rotate(-0.12);
                    ctx.fillStyle = '#111827';
                    roundRect(ctx, -2, 0, 4, 8, 1);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();

                    // Scope
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(-5, -6.8, 10, 2.6); // Scope body
                    ctx.fillRect(-6, -7.8, 1.8, 4.6);
                    ctx.fillRect(3.5, -7.8, 1.8, 4.6);
                } else if (l.weaponType === 'dmr') {
                    // M39 EMR
                    ctx.rotate(-0.18);

                    // Tan Crane stock
                    ctx.fillStyle = '#b45309';
                    ctx.beginPath();
                    ctx.moveTo(-14, -2.5);
                    ctx.lineTo(-24, -1.5);
                    ctx.lineTo(-24, 6);
                    ctx.lineTo(-17, 5);
                    ctx.lineTo(-14, 3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Tan Receiver
                    ctx.fillStyle = '#d97706';
                    roundRect(ctx, -14, -4.5, 20, 8.2, 1.5);
                    ctx.fill();
                    ctx.stroke();

                    // Tan Handguard
                    ctx.fillStyle = '#b45309';
                    roundRect(ctx, 6, -4, 12, 7, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Long precision barrel
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(18, -2.5, 18, 2.2);
                    ctx.fillRect(35, -3.5, 3, 4.2);

                    // Bipod (folded)
                    ctx.fillStyle = '#6b7280';
                    ctx.fillRect(12, 3, 11, 1.5);

                    // Straight magazine
                    ctx.fillStyle = '#111827';

                    ctx.fillRect(0, 3.7, 4.5, 8.5);
                    ctx.stroke();

                    // Large sniper scope
                    ctx.fillStyle = '#1f2937';
                    ctx.fillRect(-7, -8, 12, 3.5);
                    ctx.fillRect(-8.5, -9, 2, 5.5);
                    ctx.fillRect(3.5, -9, 2, 5.5);
                    ctx.fillStyle = '#3b82f6'; // lens reflect
                    ctx.fillRect(-8, -8.5, 1, 4.5);
                } else if (l.weaponType === 'sniper') {
                    // Mosin-Nagant
                    ctx.rotate(-0.2);

                    // Olive stock
                    ctx.fillStyle = '#166534';
                    ctx.beginPath();
                    ctx.moveTo(-16, -3);
                    ctx.lineTo(-28, -1);
                    ctx.lineTo(-28, 6.5);
                    ctx.lineTo(-19, 5);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Thumbhole cut
                    ctx.fillStyle = 'rgba(8, 11, 9, 0.9)';
                    ctx.beginPath();
                    ctx.ellipse(-23, 2, 2.5, 1.8, 0, 0, Math.PI * 2);
                    ctx.fill();

                    // Long Receiver (Olive green)
                    ctx.fillStyle = '#166534';
                    roundRect(ctx, -16, -4.5, 22, 9, 2);
                    ctx.fill();
                    ctx.stroke();

                    // Handguard shroud
                    roundRect(ctx, 6, -4, 11, 7, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Ultra long Match Barrel
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(17, -2.5, 24, 2.5);
                    ctx.fillRect(40, -4, 4, 5.5);

                    // Bolt handle
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillRect(-8, -7.5, 2, 3);
                    ctx.beginPath();
                    ctx.arc(-7, -7.5, 1.5, 0, Math.PI * 2);
                    ctx.fill();

                    // Box magazine
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(-1, 4.5, 5.5, 6);
                    ctx.stroke();

                    // Sniper scope
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(-9, -9.5, 16, 4.2);
                    ctx.fillRect(-11, -11, 2.5, 7.2);
                    ctx.fillRect(5, -11, 2.5, 7.2);
                    ctx.fillStyle = '#60a5fa'; // lens glint
                    ctx.fillRect(-10.2, -10.3, 1, 5.8);
                } else if (l.weaponType === 'lmg') {
                    // M249
                    ctx.rotate(-0.16);

                    // Skeletal stock
                    ctx.strokeStyle = 'rgba(8, 11, 9, 0.9)';
                    ctx.lineWidth = 2.2;
                    ctx.beginPath();
                    ctx.moveTo(-12, -2.5);
                    ctx.lineTo(-24, -1);
                    ctx.lineTo(-24, 7);
                    ctx.lineTo(-16, 4);
                    ctx.closePath();
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(-16, 1);
                    ctx.lineTo(-24, 3);
                    ctx.stroke();

                    // Heavy Receiver
                    ctx.fillStyle = '#4b5563';
                    roundRect(ctx, -12, -5.8, 20, 10.5, 2);
                    ctx.fill();
                    ctx.stroke();

                    // Green handguard heat shield
                    ctx.fillStyle = '#3f4f39';
                    roundRect(ctx, 8, -5, 12, 8.5, 1.5);
                    ctx.fill();
                    ctx.stroke();

                    // Heavy barrel
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(20, -3.2, 14, 3.2);
                    ctx.fillRect(34, -4.2, 3, 5.2);

                    // Carry handle
                    ctx.beginPath();
                    ctx.arc(3, -7.5, 3.5, Math.PI, 0);
                    ctx.stroke();

                    // Folded bipod
                    ctx.fillStyle = '#4b5563';
                    ctx.fillRect(10, 3.5, 15, 1.8);

                    // Ammo Box Magazine
                    ctx.fillStyle = '#2c3727';
                    roundRect(ctx, -2.5, 4.7, 10.5, 11.5, 2);
                    ctx.fill();
                    ctx.stroke();

                    // Gold ammo links
                    ctx.fillStyle = '#eab308';
                    ctx.fillRect(-2, 2.5, 2, 4);
                    ctx.fillRect(0, 1.5, 2, 4);
                } else {
                    // Fallback
                    ctx.rotate(-0.22);
                    roundRect(ctx, -15, -5, 22, 9, 2);
                    ctx.fill();
                    ctx.stroke();
                }
            } else if (l.type === 'grenade') {
                ctx.fillStyle = '#334155';
                ctx.beginPath();
                ctx.arc(0, 2, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#f59e0b';
                roundRect(ctx, -4, -11, 8, 6, 2);
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = '#fef3c7';
                ctx.beginPath();
                ctx.moveTo(0, -11); ctx.lineTo(5, -16); ctx.lineTo(9, -14);
                ctx.stroke();
            } else if (l.type === 'medkit') {
                roundRect(ctx, -11, -10, 22, 20, 4);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#f5f7ef';
                roundRect(ctx, -2, -7, 4, 14, 1);
                ctx.fill();
                roundRect(ctx, -7, -2, 14, 4, 1);
                ctx.fill();
            } else if (l.type === 'armor') {
                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(11, -7);
                ctx.lineTo(8, 8);
                ctx.lineTo(0, 14);
                ctx.lineTo(-8, 8);
                ctx.lineTo(-11, -7);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.42)';
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(0, 9);
                ctx.stroke();
            } else if (l.type === 'ammo') {
                roundRect(ctx, -12, -9, 24, 18, 4);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'rgba(20, 22, 18, 0.72)';
                for (const x of [-6, 0, 6]) {
                    roundRect(ctx, x - 2, -6, 4, 11, 2);
                    ctx.fill();
                }
            } else {
                ctx.fillStyle = '#e5ba3d';
                ctx.beginPath();
                ctx.ellipse(-3, 2, 9, 7, -0.18, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(4, -3, 9, 7, 0.12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#6f5310';
                ctx.font = '900 9px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('$', 4, -3);
            }
            ctx.restore();

            const amount = l.type === 'armor' ? l.armorValue : l.amount;
            if ((Number(amount) || 0) > 1) {
                ctx.fillStyle = 'rgba(8, 10, 9, 0.9)';
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 1;
                roundRect(ctx, 8, -17, 19, 12, 4);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ffffff';
                ctx.font = '800 8px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`x${Math.round(amount)}`, 17.5, -11);
            }

            // Weapon name label below ground loot
            if (l.type === 'weapon' && l.weaponType) {
                const wLabel = WEAPON_LABELS[l.weaponType] || l.weaponType;
                ctx.fillStyle = 'rgba(8, 10, 9, 0.82)';
                ctx.strokeStyle = color + '55';
                ctx.lineWidth = 1;
                const labelW = Math.max(50, wLabel.length * 6 + 14);
                roundRect(ctx, -labelW / 2, 18, labelW, 14, 3);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = color;
                ctx.font = '800 8px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(wLabel, 0, 25);
            }

            // Proximity interaction ring when player is near
            if (this.me) {
                const dist = Math.hypot(this.me.x - l.x, this.me.y - l.y);
                if (dist < 60) {
                    const proximity = clamp(1 - dist / 60, 0, 1);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${proximity * 0.5})`;
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.lineDashOffset = -(this._frameNow / 60) % 8;
                    ctx.beginPath();
                    ctx.arc(0, 0, 22, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    if (l.type === 'weapon') {
                        ctx.fillStyle = 'rgba(8, 10, 9, 0.92)';
                        roundRect(ctx, -34, 35, 68, 16, 4);
                        ctx.fill();
                        ctx.fillStyle = '#ffffff';
                        ctx.font = '900 9px system-ui, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(this.me.weapon === 'fists' ? 'F  PICK UP' : 'F  SWAP', 0, 43);
                    }
                }
            }
        }
        ctx.restore();
    }

    initBulletGradients(ctx) {
        this.bulletGradients = {};
        for (const [wt, spec] of Object.entries(WEAPON_BULLET_SPECS)) {
            const tracer = ctx.createLinearGradient(-spec.trailLen, 0, spec.tipLen, 0);
            tracer.addColorStop(0, `rgba(${spec.rgb}, 0)`);
            tracer.addColorStop(0.48, `rgba(${spec.rgb}, 0.18)`);
            tracer.addColorStop(0.84, `rgba(${spec.rgb}, 0.76)`);
            tracer.addColorStop(1, '#ffffff');
            this.bulletGradients[wt] = tracer;
        }
    }

    drawBullet(ctx, b) {
        if (b.isGrenade || b.weaponType === 'grenade') {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(Math.atan2(b.vy || 0, b.vx || 1));
            ctx.fillStyle = '#374151';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-2, -8, 5, 4);
            ctx.restore();
            return;
        }
        const angle = Math.atan2(b.vy || 0, b.vx || 1);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);

        // Initialize bullet gradients lazily
        if (!this.bulletGradients) {
            this.initBulletGradients(ctx);
        }

        const wt = b.weaponType;
        const spec = WEAPON_BULLET_SPECS[wt] || WEAPON_BULLET_SPECS.default;
        const tracerGradient = this.bulletGradients[wt] || this.bulletGradients.default;

        ctx.lineCap = 'round';
        ctx.strokeStyle = tracerGradient;
        ctx.lineWidth = spec.thickness;
        ctx.beginPath();
        ctx.moveTo(-spec.trailLen, 0);
        ctx.lineTo(spec.tipLen, 0);
        ctx.stroke();

        ctx.restore();
    }

    drawDeathMarkers(ctx, currentHouse) {
        const now = this._frameNow;
        for (const marker of this.deathMarkers) {
            if (!this.isPointInView(marker.x, marker.y, 80)) continue;
            const markerHouse = this.findHouseContainingPoint(marker.x, marker.y);
            if (markerHouse && (!currentHouse || markerHouse.id !== currentHouse.id)) continue;

            const firstSeenAt = this._graveFirstSeenAt.get(marker.id) || now;
            const intro = clamp((now - firstSeenAt) / 380, 0, 1);
            const eased = 1 - Math.pow(1 - intro, 3);
            const age = Math.max(0, now - (marker.createdAt || firstSeenAt));
            const fade = age > 25000 ? clamp(1 - (age - 25000) / 5000, 0, 1) : 1;
            if (fade <= 0) continue;

            ctx.save();
            ctx.translate(marker.x, marker.y + (1 - eased) * 18);
            ctx.scale(0.72 + eased * 0.28, 0.72 + eased * 0.28);
            ctx.globalAlpha = fade;

            ctx.fillStyle = 'rgba(12, 15, 13, 0.3)';
            ctx.beginPath();
            ctx.ellipse(0, 10, 19, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4a4038';
            ctx.beginPath();
            ctx.ellipse(0, 8, 15, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowColor = 'rgba(0,0,0,0.34)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = '#737b7d';
            ctx.strokeStyle = '#343b3d';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 8);
            ctx.lineTo(-9, -11);
            ctx.quadraticCurveTo(-9, -22, 0, -24);
            ctx.quadraticCurveTo(9, -22, 9, -11);
            ctx.lineTo(10, 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = 'rgba(230,235,232,0.72)';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(0, -17);
            ctx.lineTo(0, -5);
            ctx.moveTo(-5, -12);
            ctx.lineTo(5, -12);
            ctx.stroke();

            ctx.fillStyle = 'rgba(235,240,237,0.82)';
            ctx.font = '800 7px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('RIP', 0, 1);
            ctx.restore();
        }
    }
    drawPlayer(ctx, p, showHud = true) {
        const r = 14;
        const isMe = p.isYou || p.id === this.myId;
        const knocked = p.hp <= 0;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.globalAlpha = knocked ? 0.45 : 1;

        // Weapon switch animation (scale bounce)
        if (isMe && this._weaponSwitchT > 0) {
            const s = 1 - Math.sin(this._weaponSwitchT * Math.PI) * 0.15;
            ctx.scale(s, s);
        }

        // Match the world's fixed top-left light even while the player turns.
        const playerRotation = Number(p.angle) || 0;
        const playerShadowX = Math.cos(playerRotation) * 5.5 + Math.sin(playerRotation) * 8;
        const playerShadowY = -Math.sin(playerRotation) * 5.5 + Math.cos(playerRotation) * 8;
        ctx.fillStyle = 'rgba(5, 9, 6, 0.27)';
        ctx.beginPath();
        ctx.ellipse(playerShadowX, playerShadowY, r * 0.9, r * 0.38, -playerRotation, 0, Math.PI * 2);
        ctx.fill();

        // Body circle — surviv.io style thick outline
        ctx.fillStyle = p.color || '#77c7c8';
        ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(14, 20, 18, 0.78)';
        ctx.lineWidth = isMe ? 2.35 : 1.85;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Body highlight
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(-3, -4, r * 0.32, 0, Math.PI * 2);
        ctx.fill();

        // Darker rim at bottom
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.arc(0, 3, r * 0.7, 0.3, Math.PI - 0.3);
        ctx.fill();

        this.drawWeapon(ctx, p.weapon, r, p.meleeStartedAt, p.meleeUntil, p.color, p.walkBob || 0, p.meleeHand);

        // Muzzle flash on self
        if (isMe && this._muzzleFlash > 0.1) {
            const barrelDist = weaponMuzzleDistance(p.weapon, r);
            ctx.save();
            ctx.globalAlpha = this._muzzleFlash * 0.9;
            const flashGrad = ctx.createRadialGradient(barrelDist, 0, 0.8, barrelDist, 0, 8);
            flashGrad.addColorStop(0, '#ffffff');
            flashGrad.addColorStop(0.3, '#ffee88');
            flashGrad.addColorStop(0.7, '#ff8800');
            flashGrad.addColorStop(1, 'rgba(255, 136, 0, 0)');
            ctx.fillStyle = flashGrad;
            ctx.beginPath();
            ctx.arc(barrelDist, 0, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // Reload progress ring near weapon
        if (p.reloading && p.reloadEndAtLocal && p.reloadMs && p.reloadEndAtLocal > this._frameNow) {
            const progress = clamp(1 - (p.reloadEndAtLocal - this._frameNow) / p.reloadMs, 0, 1);
            if (progress > 0 && progress < 1) {
                const ringX = r + 12;
                const ringY = -12;
                const ringRadius = 6;
                const ringLineWidth = 2.2;
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle + progress * Math.PI * 2;

                ctx.save();
                ctx.lineCap = 'round';

                // Track
                ctx.beginPath();
                ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
                ctx.lineWidth = ringLineWidth;
                ctx.stroke();

                // Progress
                ctx.beginPath();
                ctx.arc(ringX, ringY, ringRadius, startAngle, endAngle);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = ringLineWidth;
                ctx.stroke();

                ctx.restore();
            }
        }

        ctx.restore();

        // Background/preview surfaces can reuse the exact in-game character
        // renderer without also painting gameplay-only names and status bars.
        if (!showHud) return;

        const hpPct = clamp((p.hp || 0) / (p.maxHp || 100), 0, 1);
        const barW = 36;
        const barY = p.y - r - 15;
        ctx.fillStyle = 'rgba(10,14,12,0.62)';
        roundRect(ctx, p.x - barW / 2, barY, barW, 5, 2);
        ctx.fill();
        ctx.fillStyle = hpPct > 0.35 ? '#55d875' : '#ef544f';
        roundRect(ctx, p.x - barW / 2, barY, barW * hpPct, 5, 2);
        ctx.fill();
        if (p.armor > 0) {
            ctx.fillStyle = '#65a4ff';
            roundRect(ctx, p.x - barW / 2, barY + 7, barW * clamp(p.armor / 100, 0, 1), 3, 1.5);
            ctx.fill();
        }

        if (!this.hideNames || isMe) {
            ctx.fillStyle = isMe ? '#ffffff' : 'rgba(255,255,255,0.86)';
            ctx.font = '700 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.strokeText(p.username || 'Player', p.x, p.y - r - 20);
            ctx.fillText(p.username || 'Player', p.x, p.y - r - 20);
        }

        if (p.cashoutHoldActive || (isMe && this.hud.cashoutHoldStart)) {
            const startedAt = isMe && this.hud.cashoutHoldStart
                ? this.hud.cashoutHoldStart
                : p.cashoutHoldStartedAt;
            const progress = startedAt
                ? Math.min(1, Math.max(0, (this._frameNow - startedAt) / CASHOUT_HOLD_MS))
                : 0;
            // Keep this HUD ring at the same screen size when camera zoom changes.
            const baselineZoom = this.isMobileLayout ? 1.28 : 1.72;
            const overlayScale = baselineZoom / Math.max(0.01, this.zoom);
            drawCashoutProgressRing(ctx, p.x, p.y, (r + 12) * overlayScale, progress, {
                counterClockwise: true,
                lineWidth: 3.5 * overlayScale,
            });
        }
    }

    drawWeapon(ctx, weapon, r, meleeStartedAt = 0, meleeUntil = 0, playerColor = '#77c7c8', walkBob = 0, meleeHand = 'top') {
        ctx.fillStyle = '#222823';
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;

        let hands = null;

        if (weapon === 'fists') {
            const now = this._frameNow;
            const punching = meleeUntil > now && meleeStartedAt > 0;
            const duration = Math.max(1, meleeUntil - meleeStartedAt);
            const progress = punching ? clamp((now - meleeStartedAt) / duration, 0, 1) : 0;
            const strike = punching ? meleeStrikeMotion(progress, 0.27, 0.47) : 0;

            // The server alternates meleeHand for every accepted attack. Keep
            // that hand active for the full animation instead of always using
            // the upper hand. It travels forward exactly once; the other hand
            // stays tucked in guard instead of joining the attack.
            const leadSide = meleeHand === 'bottom' ? 1 : -1;
            const leadReach = r * 0.58 + r * 1.18 * strike;
            const leadY = leadSide * (10.8 - strike * 6.6);
            const guardReach = r * 0.48;
            const guardY = -leadSide * 11.2;
            const topHand = leadSide < 0
                ? { x: leadReach, y: leadY, lead: true }
                : { x: guardReach, y: guardY, lead: false };
            const bottomHand = leadSide > 0
                ? { x: leadReach, y: leadY, lead: true }
                : { x: guardReach, y: guardY, lead: false };

            for (const hand of [topHand, bottomHand]) drawPlayerHand(ctx, hand, playerColor);
            return;
        }

        if (weapon === 'knife') {
            const now = this._frameNow;
            const stabbing = meleeUntil > now && meleeStartedAt > 0;
            const duration = Math.max(1, meleeUntil - meleeStartedAt);
            const progress = stabbing ? clamp((now - meleeStartedAt) / duration, 0, 1) : 0;
            const stab = stabbing ? meleeStrikeMotion(progress, 0.25, 0.46) : 0;
            // A knife stays in the lower hand between attacks. Only unarmed
            // punches alternate; swapping the weapon itself looked unnatural.
            const knifeSide = 1;
            const weaponOffsetX = r * (0.16 + stab * 0.92);
            const weaponOffsetY = knifeSide * (8.6 - stab * 5.8);
            const knifeAngle = knifeSide * (-0.2 + stab * 0.06);
            const knifeHand = { x: weaponOffsetX + r * 0.25, y: weaponOffsetY };
            const guardHand = { x: r * 0.52, y: -knifeSide * 10.6 };

            ctx.save();
            ctx.translate(weaponOffsetX, weaponOffsetY);
            ctx.rotate(knifeAngle);

            // Compact textured handle, steel guard and pommel.
            ctx.strokeStyle = '#171d1b';
            ctx.lineWidth = 5.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(r * 0.08, 0.4);
            ctx.lineTo(r * 0.47, 0);
            ctx.stroke();
            ctx.strokeStyle = '#4c5a54';
            ctx.lineWidth = 1.15;
            for (let gripX = r * 0.14; gripX < r * 0.44; gripX += r * 0.1) {
                ctx.beginPath();
                ctx.moveTo(gripX, -2.1);
                ctx.lineTo(gripX + 1.2, 2.1);
                ctx.stroke();
            }
            ctx.fillStyle = '#303b38';
            ctx.strokeStyle = '#111816';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.arc(r * 0.06, 0.4, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#7e8c88';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(r * 0.47, -4.2);
            ctx.lineTo(r * 0.49, 4.2);
            ctx.stroke();

            // A narrower drop-point blade with a visible spine, bevel and a
            // genuinely sharp tip. Flat fills keep it cheap to render.
            const bladeStart = r * 0.5;
            const bladeShoulder = r * 1.22;
            const bladeTip = r * 1.58;
            ctx.fillStyle = '#9eabb0';
            ctx.strokeStyle = '#202b30';
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(bladeStart, -2.7);
            ctx.lineTo(bladeShoulder, -2.45);
            ctx.lineTo(bladeTip, 0);
            ctx.lineTo(bladeStart, 2.85);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#cbd3d5';
            ctx.beginPath();
            ctx.moveTo(bladeStart + 1.2, 0.65);
            ctx.lineTo(bladeTip, 0);
            ctx.lineTo(bladeStart + 1.2, 2.15);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(237,244,245,0.82)';
            ctx.lineWidth = 0.85;
            ctx.beginPath();
            ctx.moveTo(bladeStart + 1.4, -1.65);
            ctx.lineTo(bladeShoulder, -1.5);
            ctx.stroke();
            ctx.restore();

            for (const hand of [guardHand, knifeHand]) drawPlayerHand(ctx, hand, playerColor);
            return;
        }

        // Apply a gentle walk-bob sway to gun weapons & hands
        const bobAngle = walkBob * 0.055;
        const bobX = Math.abs(walkBob) * 0.7;
        ctx.save();
        ctx.translate(bobX, 0);
        ctx.rotate(bobAngle);

        // Firearms are drawn in the same local direction as the crosshair.
        // Keeping their important parts around y=0 makes them read as genuine
        // overhead silhouettes while the two hands remain visible at the sides.
        hands = drawHeldWeaponTopDown(ctx, weapon);
        // Draw hands gripping the gun (two-handed/one-handed)
        if (weapon !== 'fists' && hands) {
            for (const hand of hands) drawPlayerHand(ctx, hand, playerColor);
        }

        ctx.restore();
    }

    drawMobileAimGuide(ctx) {
        if (!this.inputEnabled || this.spectatorMode || !this.mobileAim.active) return;
        const x = this.viewW / 2;
        const y = this.viewH / 2;
        const angle = this.mobileAim.angle;
        const length = Math.min(150, Math.max(88, Math.min(this.viewW, this.viewH) * 0.3));
        const start = 24;
        const endX = x + Math.cos(angle) * length;
        const endY = y + Math.sin(angle) * length;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.setLineDash([8, 7]);
        ctx.strokeStyle = this.mobileAim.shooting ? 'rgba(255, 116, 102, 0.82)' : 'rgba(255, 255, 255, 0.58)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * start, y + Math.sin(angle) * start);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = this.mobileAim.shooting ? '#ff7466' : 'rgba(255,255,255,0.82)';
        ctx.beginPath();
        ctx.arc(endX, endY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    drawCrosshair(ctx) {
        if (!this.inputEnabled || this.spectatorMode || this.mobileAim.active) return;
        const x = this.mouse.x || this.viewW / 2;
        const y = this.mouse.y || this.viewH / 2;
        ctx.save();
        ctx.strokeStyle = this.mouse.down ? 'rgba(255, 226, 122, 0.9)' : 'rgba(255,255,255,0.72)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.moveTo(x - 16, y);
        ctx.lineTo(x - 7, y);
        ctx.moveTo(x + 7, y);
        ctx.lineTo(x + 16, y);
        ctx.moveTo(x, y - 16);
        ctx.lineTo(x, y - 7);
        ctx.moveTo(x, y + 7);
        ctx.lineTo(x, y + 16);
        ctx.stroke();
        ctx.restore();
    }

    drawHouseRoof(ctx, o, allowCache = true) {
        if (allowCache && this.drawCachedHouseRoof(ctx, o)) return;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);

        const variant = o.variant || 'house';
        const hw = o.w / 2;
        const hh = o.h / 2;

        // Stable two-stage roof shadow. Its direction stays fixed in world
        // space even if a future building is rotated.
        const roofRotation = Number(o.rotation) || 0;
        const roofWorldShadowX = 11;
        const roofWorldShadowY = 16;
        const roofLocalShadowX = Math.cos(roofRotation) * roofWorldShadowX + Math.sin(roofRotation) * roofWorldShadowY;
        const roofLocalShadowY = -Math.sin(roofRotation) * roofWorldShadowX + Math.cos(roofRotation) * roofWorldShadowY;
        ctx.save();
        ctx.translate(roofLocalShadowX * 1.16, roofLocalShadowY * 1.16);
        ctx.fillStyle = 'rgba(7, 11, 8, 0.13)';
        roundRect(ctx, -hw - 14, -hh - 13, o.w + 28, o.h + 26, 12);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(roofLocalShadowX * 0.78, roofLocalShadowY * 0.78);
        ctx.fillStyle = 'rgba(7, 10, 8, 0.34)';
        roundRect(ctx, -hw - 7, -hh - 7, o.w + 14, o.h + 14, 9);
        ctx.fill();
        ctx.restore();

        if (variant === 'ironworks') {
            // --- IRONWORKS: giant saw-tooth steel roof for the indoor PvP landmark ---
            const roofGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            roofGrad.addColorStop(0, '#536168');
            roofGrad.addColorStop(0.48, '#283238');
            roofGrad.addColorStop(1, '#46545b');
            ctx.fillStyle = roofGrad;
            roundRect(ctx, -hw - 5, -hh - 5, o.w + 10, o.h + 10, 8);
            ctx.fill();

            ctx.save();
            roundRect(ctx, -hw - 2, -hh - 2, o.w + 4, o.h + 4, 6);
            ctx.clip();
            const bayCount = 5;
            const bayW = o.w / bayCount;
            for (let bay = 0; bay < bayCount; bay++) {
                const bx = -hw + bay * bayW;
                ctx.fillStyle = bay % 2 === 0 ? 'rgba(167, 190, 198, 0.08)' : 'rgba(4, 9, 12, 0.13)';
                ctx.fillRect(bx, -hh, bayW, o.h);
                ctx.strokeStyle = 'rgba(8, 14, 18, 0.48)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(bx, -hh);
                ctx.lineTo(bx, hh);
                ctx.stroke();

                if (bay % 2 === 0) {
                    const skyW = Math.max(42, bayW * 0.24);
                    ctx.fillStyle = 'rgba(72, 139, 158, 0.58)';
                    roundRect(ctx, bx + bayW / 2 - skyW / 2, -hh * 0.72, skyW, o.h * 0.54, 4);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(12, 28, 34, 0.82)';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    ctx.strokeStyle = 'rgba(205, 235, 240, 0.18)';
                    ctx.lineWidth = 1.5;
                    for (let sy = -hh * 0.58; sy < -hh * 0.18; sy += 42) {
                        ctx.beginPath();
                        ctx.moveTo(bx + bayW / 2 - skyW / 2 + 4, sy);
                        ctx.lineTo(bx + bayW / 2 + skyW / 2 - 4, sy);
                        ctx.stroke();
                    }
                }
            }

            // Static vents, exhaust stacks and deterministic rust keep the roof alive
            // without adding animation work to every frame.
            const stackPositions = [
                [-0.39, -0.34], [-0.13, 0.31], [0.13, -0.30], [0.39, 0.33],
            ];
            for (const [sx, sy] of stackPositions) {
                const px = hw * sx * 2;
                const py = hh * sy * 2;
                ctx.fillStyle = 'rgba(0,0,0,0.34)';
                ctx.beginPath();
                ctx.arc(px + 6, py + 7, 20, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#718087';
                ctx.strokeStyle = '#1b252a';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(px, py, 19, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#121a1e';
                ctx.beginPath();
                ctx.arc(px, py, 10, 0, Math.PI * 2);
                ctx.fill();
            }

            for (let i = 0; i < 12; i++) {
                const rx = -hw + seededNoise(o.x * 0.01 + i, 17) * o.w;
                const ry = -hh + seededNoise(o.y * 0.01 + i, 41) * o.h;
                ctx.fillStyle = 'rgba(126, 64, 35, 0.16)';
                ctx.beginPath();
                ctx.arc(rx, ry, 10 + seededNoise(i, 7) * 22, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            ctx.strokeStyle = '#111a1f';
            ctx.lineWidth = 7;
            roundRect(ctx, -hw - 5, -hh - 5, o.w + 10, o.h + 10, 8);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(207, 224, 229, 0.20)';
            ctx.lineWidth = 2;
            roundRect(ctx, -hw + 5, -hh + 5, o.w - 10, o.h - 10, 5);
            ctx.stroke();

        } else if (variant === 'warehouse') {
            // --- WAREHOUSE: Corrugated sheet metal roof ---
            const mainColor = '#5c6b73';
            const shadowColor = '#3a444a';
            const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            grad.addColorStop(0, mainColor);
            grad.addColorStop(0.5, shadowColor);
            grad.addColorStop(1, mainColor);
            ctx.fillStyle = grad;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 6);
            ctx.fill();

            // Corrugation seams (vertical sheets)
            ctx.lineWidth = 1.5;
            const seamStep = 24;
            for (let xx = -hw + 6; xx < hw - 6; xx += seamStep) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
                ctx.beginPath();
                ctx.moveTo(xx, -hh - 2);
                ctx.lineTo(xx, hh + 2);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.beginPath();
                ctx.moveTo(xx + 1.5, -hh - 2);
                ctx.lineTo(xx + 1.5, hh + 2);
                ctx.stroke();
            }

            // Rust patches (grunge)
            const rustSpots = [
                { x: -hw * 0.4, y: -hh * 0.5, r: 24 },
                { x: hw * 0.55, y: hh * 0.3, r: 32 },
                { x: -hw * 0.6, y: hh * 0.4, r: 18 }
            ];
            rustSpots.forEach(s => {
                const rx = s.x;
                const ry = s.y;
                const rr = Math.min(s.r, o.w * 0.15, o.h * 0.15);
                if (rr > 5) {
                    const rustGrad = ctx.createRadialGradient(rx, ry, rr * 0.1, rx, ry, rr);
                    rustGrad.addColorStop(0, 'rgba(142, 78, 48, 0.22)');
                    rustGrad.addColorStop(0.5, 'rgba(112, 58, 32, 0.10)');
                    rustGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = rustGrad;
                    ctx.beginPath();

                    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            // Skylights (steel-framed glass panels)
            const skyW = Math.min(60, o.w * 0.22);
            const skyH = Math.min(40, o.h * 0.22);
            const skylightPositions = [
                { x: -hw * 0.45, y: -hh * 0.1 },
                { x: hw * 0.45, y: -hh * 0.1 }
            ];
            skylightPositions.forEach(pos => {
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.fillStyle = 'rgba(68, 122, 148, 0.75)';
                roundRect(ctx, -skyW/2, -skyH/2, skyW, skyH, 3);
                ctx.fill();
                ctx.strokeStyle = '#2d373c';
                ctx.lineWidth = 3;
                roundRect(ctx, -skyW/2, -skyH/2, skyW, skyH, 3);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(-skyW/2 + 8, -skyH/2 + 4);
                ctx.lineTo(skyW/2 - 12, skyH/2 - 4);
                ctx.moveTo(-skyW/2 + 20, -skyH/2 + 4);
                ctx.lineTo(skyW/2 - 4, skyH/2 - 10);
                ctx.stroke();
                ctx.restore();
            });

            // Rotating Ventilation Turbines
            const turbineRad = 16;
            const turbinePositions = [];
            if (o.w > 400) {
                turbinePositions.push({ x: -hw * 0.2, y: -hh * 0.4 });
                turbinePositions.push({ x: hw * 0.2, y: hh * 0.4 });
            } else {
                turbinePositions.push({ x: 0, y: -hh * 0.3 });
            }
            const fanAngle = (this._frameNow / 420) % (Math.PI * 2);
            turbinePositions.forEach(pos => {
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
                ctx.beginPath();
                ctx.arc(4, 5, turbineRad, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#414d54';
                ctx.strokeStyle = '#22292c';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, turbineRad, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = '#181e20';
                ctx.lineWidth = 3.5;
                for (let b = 0; b < 5; b++) {
                    const bladeAngle = fanAngle + (b * Math.PI * 2 / 5);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(bladeAngle) * (turbineRad - 3), Math.sin(bladeAngle) * (turbineRad - 3));
                    ctx.stroke();
                }
                ctx.fillStyle = '#6f808a';
                ctx.strokeStyle = '#22292c';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            });

            ctx.strokeStyle = '#252e32';
            ctx.lineWidth = 3.5;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 6);
            ctx.stroke();

        } else if (variant === 'brick') {
            // --- MOTEL / BRICK SHOP: low flat roof with a raised masonry parapet ---
            const roofGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            roofGrad.addColorStop(0, '#72584d');
            roofGrad.addColorStop(0.52, '#4b3c37');
            roofGrad.addColorStop(1, '#665046');
            ctx.fillStyle = roofGrad;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 5);
            ctx.fill();

            ctx.save();
            roundRect(ctx, -hw, -hh, o.w, o.h, 3);
            ctx.clip();
            ctx.strokeStyle = 'rgba(25, 15, 12, 0.20)';
            ctx.lineWidth = 1;
            for (let yy = -hh + 14; yy < hh; yy += 14) {
                ctx.beginPath();
                ctx.moveTo(-hw, yy);
                ctx.lineTo(hw, yy);
                ctx.stroke();
            }
            for (let yy = -hh + 14, row = 0; yy < hh; yy += 14, row++) {
                const offset = row % 2 ? 14 : 0;
                for (let xx = -hw + offset; xx < hw; xx += 28) {
                    ctx.beginPath();
                    ctx.moveTo(xx, yy - 14);
                    ctx.lineTo(xx, yy);
                    ctx.stroke();
                }
            }
            ctx.restore();

            ctx.strokeStyle = '#3b2822';
            ctx.lineWidth = 10;
            roundRect(ctx, -hw - 1, -hh - 1, o.w + 2, o.h + 2, 4);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(231, 185, 155, 0.24)';
            ctx.lineWidth = 2;
            roundRect(ctx, -hw + 6, -hh + 6, o.w - 12, o.h - 12, 2);
            ctx.stroke();

            // Static roof equipment keeps every motel wing recognizable while
            // remaining fully compatible with the existing roof sprite cache.
            const unitCount = o.w >= 500 ? 2 : 1;
            for (let i = 0; i < unitCount; i++) {
                const ux = unitCount === 1 ? hw * 0.25 : (i === 0 ? -hw * 0.35 : hw * 0.35);
                const uy = -hh * 0.12;
                ctx.fillStyle = 'rgba(0,0,0,0.27)';
                roundRect(ctx, ux - 22 + 4, uy - 15 + 5, 44, 30, 4);
                ctx.fill();
                ctx.fillStyle = '#657176';
                ctx.strokeStyle = '#272f32';
                ctx.lineWidth = 2.5;
                roundRect(ctx, ux - 22, uy - 15, 44, 30, 4);
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = 'rgba(20,27,29,0.7)';
                ctx.lineWidth = 1.5;
                for (let sx = ux - 14; sx <= ux + 14; sx += 7) {
                    ctx.beginPath();
                    ctx.moveTo(sx, uy - 9);
                    ctx.lineTo(sx, uy + 9);
                    ctx.stroke();
                }
            }

        } else if (variant === 'lodge') {
            // --- RANGER LODGE: muted green standing-seam roof ---
            const lodgeGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            lodgeGrad.addColorStop(0, '#596b55');
            lodgeGrad.addColorStop(0.5, '#34463b');
            lodgeGrad.addColorStop(1, '#52634e');
            ctx.fillStyle = lodgeGrad;
            roundRect(ctx, -hw - 6, -hh - 5, o.w + 12, o.h + 10, 6);
            ctx.fill();

            ctx.save();
            roundRect(ctx, -hw - 2, -hh - 2, o.w + 4, o.h + 4, 4);
            ctx.clip();
            const seamStep = 30;
            for (let xx = -hw + seamStep; xx < hw; xx += seamStep) {
                ctx.strokeStyle = 'rgba(14, 27, 20, 0.35)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(xx, -hh);
                ctx.lineTo(xx, hh);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(223, 236, 206, 0.10)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(xx + 2, -hh);
                ctx.lineTo(xx + 2, hh);
                ctx.stroke();
            }
            ctx.restore();

            const skyW = Math.min(74, o.w * 0.18);
            const skyH = Math.min(42, o.h * 0.20);
            ctx.fillStyle = 'rgba(74, 132, 142, 0.66)';
            ctx.strokeStyle = '#213137';
            ctx.lineWidth = 3;
            roundRect(ctx, -skyW / 2, -skyH / 2, skyW, skyH, 4);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(224, 246, 239, 0.28)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-skyW * 0.35, -skyH * 0.25);
            ctx.lineTo(skyW * 0.18, skyH * 0.25);
            ctx.stroke();

            ctx.strokeStyle = '#23332a';
            ctx.lineWidth = 4;
            roundRect(ctx, -hw - 6, -hh - 5, o.w + 12, o.h + 10, 6);
            ctx.stroke();

        } else if (variant === 'mansion' || variant === 'guesthouse') {
            // --- MANSION & GUESTHOUSE: Elegant Slate Tiles ---
            const baseColor = variant === 'mansion' ? '#434c54' : '#495b6c';
            const shadowColor = variant === 'mansion' ? '#2b3137' : '#313e4b';

            const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            grad.addColorStop(0, baseColor);
            grad.addColorStop(0.5, shadowColor);
            grad.addColorStop(1, baseColor);
            ctx.fillStyle = grad;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 7);
            ctx.fill();

            const tileH = 24;
            const tileW = 30;
            ctx.save();
            roundRect(ctx, -hw - 2, -hh - 2, o.w + 4, o.h + 4, 6);
            ctx.clip();
            for (let yy = -hh + tileH; yy < hh + tileH; yy += tileH) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(-hw, yy);
                ctx.lineTo(hw, yy);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-hw, yy - tileH + 1);
                ctx.lineTo(hw, yy - tileH + 1);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
                ctx.lineWidth = 1.5;
                const shift = (Math.round((yy + hh) / tileH) % 2) * (tileW / 2);
                for (let xx = -hw - tileW + shift; xx < hw + tileW; xx += tileW) {
                    ctx.beginPath();
                    ctx.moveTo(xx, yy - tileH);
                    ctx.lineTo(xx, yy);
                    ctx.stroke();
                }
            }
            ctx.restore();

            if (variant === 'mansion' && o.w > 300) {
                ctx.save();
                const domeW = o.w * 0.18;
                const domeH = o.h * 0.25;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                roundRect(ctx, -domeW/2 + 6, -domeH/2 + 8, domeW, domeH, 6);
                ctx.fill();
                ctx.fillStyle = 'rgba(48, 86, 102, 0.85)';
                roundRect(ctx, -domeW/2, -domeH/2, domeW, domeH, 6);
                ctx.fill();
                ctx.strokeStyle = '#1e2428';
                ctx.lineWidth = 3;
                roundRect(ctx, -domeW/2, -domeH/2, domeW, domeH, 6);
                ctx.stroke();
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-domeW/2, -domeH/2); ctx.lineTo(domeW/2, domeH/2);
                ctx.moveTo(domeW/2, -domeH/2); ctx.lineTo(-domeW/2, domeH/2);
                ctx.moveTo(0, -domeH/2); ctx.lineTo(0, domeH/2);
                ctx.moveTo(-domeW/2, 0); ctx.lineTo(domeW/2, 0);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.22)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(-domeW * 0.15, -domeH * 0.15, domeW * 0.2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            const chimPositions = [
                { x: -hw * 0.58, y: -hh - 6 },
                { x: hw * 0.58, y: -hh - 6 }
            ];
            chimPositions.forEach(pos => {
                ctx.save();
                ctx.translate(pos.x, pos.y);
                const cw = 20;
                const ch = 26;
                ctx.fillStyle = '#8f4f3b';
                ctx.strokeStyle = '#2b1915';
                ctx.lineWidth = 2.5;
                roundRect(ctx, -cw/2, -ch, cw, ch, 3);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#5c5450';
                ctx.fillRect(-cw/2 - 3, -ch, cw + 6, 5);
                ctx.strokeRect(-cw/2 - 3, -ch, cw + 6, 5);
                ctx.fillStyle = '#1a1816';
                ctx.beginPath();
                ctx.arc(-cw * 0.22, -ch + 2.5, 3.5, 0, Math.PI * 2);
                ctx.arc(cw * 0.22, -ch + 2.5, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            ctx.strokeStyle = variant === 'mansion' ? '#8f654b' : '#313e4b';
            ctx.lineWidth = 3.5;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 7);
            ctx.stroke();

        } else if (variant === 'barn') {
            // --- BARN: Gambrel Red Roof Panels ---
            const redMain = '#883b2d';
            const redDark = '#5c2219';
            const redLight = '#b25745';

            ctx.fillStyle = redMain;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 5);
            ctx.fill();

            const gGradLeft = ctx.createLinearGradient(-hw, 0, -hw * 0.45, 0);
            gGradLeft.addColorStop(0, redDark);
            gGradLeft.addColorStop(1, redMain);
            ctx.fillStyle = gGradLeft;
            ctx.fillRect(-hw, -hh, hw * 0.55, o.h);

            const gGradRight = ctx.createLinearGradient(hw * 0.45, 0, hw, 0);
            gGradRight.addColorStop(0, redMain);
            gGradRight.addColorStop(1, redDark);
            ctx.fillStyle = gGradRight;
            ctx.fillRect(hw * 0.45, -hh, hw * 0.55, o.h);

            const gGradCenter = ctx.createLinearGradient(0, -hh, 0, hh);
            gGradCenter.addColorStop(0, redLight);
            gGradCenter.addColorStop(0.5, redMain);
            gGradCenter.addColorStop(1, redDark);
            ctx.fillStyle = gGradCenter;
            ctx.fillRect(-hw * 0.45, -hh, o.w * 0.9, o.h);

            ctx.strokeStyle = 'rgba(0,0,0,0.22)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-hw * 0.45, -hh); ctx.lineTo(-hw * 0.45, hh);
            ctx.moveTo(hw * 0.45, -hh); ctx.lineTo(hw * 0.45, hh);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-hw * 0.45 + 1.5, -hh); ctx.lineTo(-hw * 0.45 + 1.5, hh);
            ctx.moveTo(hw * 0.45 - 1.5, -hh); ctx.lineTo(hw * 0.45 - 1.5, hh);
            ctx.stroke();

            ctx.save();
            const cupW = 32;
            const cupH = 32;
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            roundRect(ctx, -cupW/2 + 4, -cupH/2 + 5, cupW, cupH, 3);
            ctx.fill();
            ctx.fillStyle = redDark;
            ctx.strokeStyle = '#2b100b';
            ctx.lineWidth = 2.5;
            roundRect(ctx, -cupW/2, -cupH/2, cupW, cupH, 3);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ece8e5';
            ctx.beginPath();
            ctx.moveTo(-cupW/2 - 3, -cupH/2);
            ctx.lineTo(0, -cupH/2 - 12);
            ctx.lineTo(cupW/2 + 3, -cupH/2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            ctx.strokeStyle = '#f8f5f2';
            ctx.lineWidth = 4;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 5);
            ctx.stroke();

        } else if (variant === 'cabin') {
            // --- CABIN: Rustic Wood Shingles & Log Corners ---
            const mainWood = '#704f32';
            const darkWood = '#4a321d';

            const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            grad.addColorStop(0, mainWood);
            grad.addColorStop(0.5, darkWood);
            grad.addColorStop(1, mainWood);
            ctx.fillStyle = grad;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 4);
            ctx.fill();

            const rowH = 20;
            const shingleW = 28;
            ctx.save();
            roundRect(ctx, -hw - 2, -hh - 2, o.w + 4, o.h + 4, 3);
            ctx.clip();
            for (let yy = -hh + rowH; yy < hh + rowH; yy += rowH) {
                ctx.strokeStyle = 'rgba(25, 14, 6, 0.4)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-hw, yy);
                ctx.lineTo(hw, yy);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-hw, yy - rowH + 1);
                ctx.lineTo(hw, yy - rowH + 1);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(20, 10, 5, 0.28)';
                ctx.lineWidth = 1.5;
                const shift = (Math.round((yy + hh) / rowH) % 2) * (shingleW / 2);
                for (let xx = -hw - shingleW + shift; xx < hw + shingleW; xx += shingleW) {
                    ctx.beginPath();
                    ctx.moveTo(xx, yy - rowH);
                    ctx.lineTo(xx, yy);
                    ctx.stroke();
                }
            }
            ctx.restore();

            const logRad = 8;
            const logOffset = 2;
            const logPositions = [
                { x: -hw - logOffset, y: -hh + logOffset },
                { x: hw + logOffset, y: -hh + logOffset },
                { x: -hw - logOffset, y: hh - logOffset },
                { x: hw + logOffset, y: hh - logOffset }
            ];
            ctx.fillStyle = '#55371c';
            ctx.strokeStyle = '#2b1b0d';
            ctx.lineWidth = 1.8;
            logPositions.forEach(pos => {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, logRad, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, logRad * 0.5, 0, Math.PI * 2);
                ctx.stroke();
            });

            const mossPatches = [
                { x: -hw * 0.35, y: -hh * 0.32, r: 20 },
                { x: hw * 0.22, y: hh * 0.42, r: 24 }
            ];
            mossPatches.forEach(m => {
                ctx.save();
                ctx.translate(m.x, m.y);
                const mossGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, m.r);
                mossGrad.addColorStop(0, 'rgba(74, 104, 68, 0.28)');
                mossGrad.addColorStop(0.6, 'rgba(56, 82, 58, 0.14)');
                mossGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = mossGrad;
                ctx.beginPath();
                ctx.arc(0, 0, m.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            ctx.strokeStyle = '#321f10';
            ctx.lineWidth = 3.5;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 4);
            ctx.stroke();

        } else if (variant === 'garage') {
            // --- GARAGE: Flat Tar & Gravel Roof ---
            ctx.fillStyle = '#2d2e30';
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 5);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            for (let i = 0; i < 40; i++) {
                const rx = -hw + seededNoise(i, 1) * o.w;
                const ry = -hh + seededNoise(i, 2) * o.h;
                ctx.beginPath();
                ctx.arc(rx, ry, 1.5 + seededNoise(i, 3) * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
            for (let i = 0; i < 40; i++) {
                const rx = -hw + seededNoise(i, 4) * o.w;
                const ry = -hh + seededNoise(i, 5) * o.h;
                ctx.beginPath();
                ctx.arc(rx, ry, 1.5 + seededNoise(i, 6) * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            const pipePositions = [
                { x: -hw * 0.45, y: -hh * 0.4 },
                { x: hw * 0.35, y: hh * 0.4 }
            ];
            pipePositions.forEach(p => {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
                ctx.beginPath(); ctx.arc(3, 4, 8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#8e989f';
                ctx.strokeStyle = '#32373a';
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#0f1011';
                ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            });

            ctx.strokeStyle = '#4e5154';
            ctx.lineWidth = 3.5;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 5);
            ctx.stroke();

        } else {
            // --- DEFAULT HOUSE / VILLAGE / FARM / CAMP: simple coated metal tiles ---
            const tileColor = '#677177';
            const tileShadow = '#454f55';

            const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            grad.addColorStop(0, tileColor);
            grad.addColorStop(0.5, tileShadow);
            grad.addColorStop(1, tileColor);
            ctx.fillStyle = grad;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 7);
            ctx.fill();

            const rowH = 22;
            const tileW = 30;
            ctx.save();
            roundRect(ctx, -hw - 2, -hh - 2, o.w + 4, o.h + 4, 6);
            ctx.clip();
            for (let yy = -hh + rowH; yy < hh + rowH; yy += rowH) {
                ctx.strokeStyle = 'rgba(15, 24, 28, 0.28)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-hw, yy);
                ctx.lineTo(hw, yy);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-hw, yy - rowH + 1);
                ctx.lineTo(hw, yy - rowH + 1);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(10, 18, 22, 0.18)';
                ctx.lineWidth = 1;
                const shift = (Math.round((yy + hh) / rowH) % 2) * (tileW / 2);
                for (let xx = -hw - tileW + shift; xx < hw + tileW; xx += tileW) {
                    ctx.beginPath();
                    ctx.arc(xx + tileW/2, yy - rowH, tileW/2, 0, Math.PI);
                    ctx.stroke();
                }
            }
            ctx.restore();

            ctx.save();
            const chX = hw * 0.32;
            const chY = -hh - 8;
            const chW = 16;
            const chH = 22;
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(chX - chW/2 + 4, chY - chH + 5, chW, chH);
            ctx.fillStyle = '#65737a';
            ctx.strokeStyle = '#202b30';
            ctx.lineWidth = 2;
            roundRect(ctx, chX - chW/2, chY - chH, chW, chH, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#443f3c';
            ctx.fillRect(chX - chW/2 - 2, chY - chH, chW + 4, 3.5);
            ctx.strokeRect(chX - chW/2 - 2, chY - chH, chW + 4, 3.5);
            ctx.restore();

            ctx.strokeStyle = '#273238';
            ctx.lineWidth = 3.5;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 7);

            ctx.stroke();
        }

        // One restrained steel inset ties old houses to the newer landmarks
        // without adding noisy roof props or another expensive texture pass.
        if (variant !== 'ironworks' && variant !== 'brick') {
            ctx.strokeStyle = 'rgba(202, 220, 226, 0.18)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, -hw + 5, -hh + 5, o.w - 10, o.h - 10, 4);
            ctx.stroke();
        }

        // --- RIDGE LINE ---
        if (variant !== 'ironworks' && variant !== 'brick') {
            const ridgeColor = variant === 'warehouse' ? '#8b9aa0' : variant === 'mansion' ? '#7f9098' : variant === 'barn' ? '#d3dcdf' : '#89989e';
            ctx.strokeStyle = ridgeColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-hw + 12, 0);
            ctx.lineTo(hw - 12, 0);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-hw + 14, -1);
            ctx.lineTo(hw - 14, -1);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawCachedHouseRoof(ctx, o) {
        if (typeof document === 'undefined' || !o?.id) return false;
        // Huge landmarks would create multi-megabyte single sprites. Their
        // custom roof is uncommon, while normal houses gain most from caching.
        if (o.w > 2000 || o.h > 1400) return false;

        const scale = Math.min(1.6, Math.max(1, (this.targetZoom || 1) * (this.renderDpr || 1)));
        const key = [o.id, o.variant || '', o.x, o.y, o.w, o.h, Number(o.rotation || 0).toFixed(3), o.label || '', o.landmarkType || '', scale.toFixed(2)].join(':');
        let sprite = this._roofSpriteCache.get(key);
        if (sprite) {
            this._roofSpriteCache.delete(key);
            this._roofSpriteCache.set(key, sprite);
        }
        if (!sprite) {
            // Spread cache creation across frames to avoid an entry stutter
            // when several roofs enter the viewport at the same time.
            if (this._roofCacheBuildsThisFrame >= 1 || this._cacheBuildsThisFrame >= 1) return false;
            this._roofCacheBuildsThisFrame++;
            this._cacheBuildsThisFrame++;

            const rotated = Math.abs(o.rotation || 0) > 0.001;
            const extent = rotated ? Math.hypot(o.w, o.h) : 0;
            const worldWidth = Math.ceil((rotated ? extent : o.w) + 72);
            const worldHeight = Math.ceil((rotated ? extent : o.h) + 72);
            const width = Math.ceil(worldWidth * scale);
            const height = Math.ceil(worldHeight * scale);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const cacheCtx = canvas.getContext('2d', { alpha: true });
            if (!cacheCtx) return false;
            cacheCtx.imageSmoothingEnabled = true;
            cacheCtx.imageSmoothingQuality = 'high';
            cacheCtx.translate(width / 2, height / 2);
            cacheCtx.scale(scale, scale);
            cacheCtx.translate(-o.x, -o.y);
            this.drawHouseRoof(cacheCtx, o, false);
            const pixels = width * height;
            sprite = { canvas, width, height, worldWidth, worldHeight, pixels };

            // Higher-resolution roofs stay bounded so sharp graphics do not
            // turn into runaway GPU memory usage after crossing the whole map.
            const maxPixels = 12_000_000;
            while (this._roofSpriteCache.size && (
                this._roofSpriteCache.size >= 128
                || this._roofCachePixels + pixels > maxPixels
            )) {
                const oldestKey = this._roofSpriteCache.keys().next().value;
                const oldest = this._roofSpriteCache.get(oldestKey);
                this._roofCachePixels -= oldest?.pixels || 0;
                this._roofSpriteCache.delete(oldestKey);
            }
            this._roofSpriteCache.set(key, sprite);
            this._roofCachePixels += pixels;
        }

        ctx.drawImage(
            sprite.canvas,
            o.x - sprite.worldWidth / 2,
            o.y - sprite.worldHeight / 2,
            sprite.worldWidth,
            sprite.worldHeight,
        );
        return true;
    }
    drawVignette(ctx, W, H) {
        ctx.save();
        const radius = Math.max(W, H) * 0.72;
        const vigKey = `${W}:${H}`;
        if (vigKey !== this._cachedVignetteKey) {
            this._cachedVignetteGrad = ctx.createRadialGradient(W / 2, H / 2, radius * 0.25, W / 2, H / 2, radius);
            this._cachedVignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            this._cachedVignetteGrad.addColorStop(0.64, 'rgba(0, 0, 0, 0.08)');
            this._cachedVignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
            this._cachedDangerGrad = ctx.createRadialGradient(W / 2, H / 2, radius * 0.38, W / 2, H / 2, radius * 0.96);
            this._cachedDangerGrad.addColorStop(0, 'rgba(120, 0, 0, 0)');
            this._cachedDangerGrad.addColorStop(1, 'rgba(220, 32, 32, 0.72)');
            this._cachedVignetteKey = vigKey;
        }
        ctx.fillStyle = this._cachedVignetteGrad;
        ctx.fillRect(0, 0, W, H);

        const hpPct = clamp((this.hud.hp || 0) / (this.hud.maxHp || 100), 0, 1);
        if (hpPct > 0 && hpPct < 0.34) {
            ctx.globalAlpha = clamp((0.34 - hpPct) / 0.34, 0, 1) * 0.28;
            ctx.fillStyle = this._cachedDangerGrad;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
    }

    drawLootToast(ctx, W, H) {
        if (!this.lootToast || this.lootToast.expiresAt < this._frameNow) return;
        const now = this._frameNow;
        const items = this.lootToast.items || {};
        const lines = [];
        if (items.weaponLabel) lines.push(`+ ${items.weaponLabel}`);
        if (items.money) lines.push(`+$${Number(items.money).toFixed(2)}`);
        if (items.medkits) lines.push(`+${items.medkits} medkit${items.medkits === 1 ? '' : 's'}`);
        if (items.ammoAmount) lines.push(`+${items.ammoAmount} ${items.ammoType || ''} ammo`.replace('  ', ' '));
        if (items.armor) lines.push(`+${Math.round(items.armor)} armor`);
        const text = lines.length ? lines.join('   ') : 'Empty';
        const w = Math.min(W - 28, Math.max(220, Math.min(390, text.length * 7 + 72)));
        const x = W / 2 - w / 2;
        const baseY = Math.max(72, H * 0.11);
        const age = Math.max(0, now - (this.lootToast.shownAt || now));
        const enter = clamp(age / 180, 0, 1);
        const exit = clamp((this.lootToast.expiresAt - now) / 380, 0, 1);
        const y = baseY - (1 - enter) * 14;
        const accent = RARITY_COLORS[this.lootToast.tier] || '#d7c396';

        ctx.save();
        ctx.globalAlpha = Math.min(enter, exit);
        ctx.fillStyle = 'rgba(8, 12, 9, 0.84)';
        ctx.strokeStyle = accent + '88';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x, y, w, 48, 7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = accent;
        roundRect(ctx, x, y, 4, 48, 3);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 25, y + 24, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#11170f';
        ctx.font = '900 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', x + 25, y + 24);
        ctx.fillStyle = '#f0f4eb';
        ctx.font = '900 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.lootToast.source === 'ground' ? 'PICKED UP' : 'LOOTED', x + 43, y + 17);
        ctx.fillStyle = '#c4cec0';
        ctx.font = '800 11px system-ui, sans-serif';
        ctx.fillText(text, x + 43, y + 34);
        ctx.restore();
    }

    drawHud(ctx, W, H) {
        const pad = this.isMobileLayout ? 10 : 16;
        const panelW = this.isMobileLayout ? 164 : 190;
        const hpPct = clamp(this.hud.hp / (this.hud.maxHp || 100), 0, 1);
        const armorPct = clamp((this.hud.armor || 0) / 100, 0, 1);

        ctx.save();
        this.drawPanel(ctx, pad, pad, panelW, armorPct > 0 ? 76 : 58);
        ctx.fillStyle = '#785eff';
        ctx.font = '800 11px "Space Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('HEALTH', pad + 12, pad + 17);

        this.drawBar(ctx, pad + 12, pad + 26, panelW - 24, 12, hpPct, '#5fe08a', '#ef544f');
        if (armorPct > 0) {
            ctx.fillStyle = '#5c9cff';
            ctx.font = '700 9px "Space Mono", monospace';
            ctx.fillText('ARMOR', pad + 12, pad + 52);
            this.drawBar(ctx, pad + 12, pad + 58, panelW - 24, 7, armorPct, '#5c9cff', '#5c9cff');
        }

        const weaponLabel = WEAPON_LABELS[this.hud.weapon] || 'Fists';
        const ammoText = this.hud.weapon === 'fists' ? 'MELEE' : (this.hud.reloading ? 'RELOADING' : String(this.hud.ammo) + '/' + String(this.hud.clipSize));
        const weaponW = this.isMobileLayout ? 148 : 172;
        this.drawPanel(ctx, W - pad - weaponW, pad, weaponW, 58);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 13px "Outfit", sans-serif';
        ctx.fillText(weaponLabel, W - pad - 12, pad + 20);
        ctx.fillStyle = this.hud.reloading ? '#ffd45a' : '#5fe08a';
        ctx.font = '800 18px "Space Mono", monospace';
        ctx.fillText(ammoText, W - pad - 12, pad + 44);

        if (this.hud.kills > 0) {
            const text = String(this.hud.kills) + ' ELIMS';
            const w = 88;
            this.drawPanel(ctx, W / 2 - w / 2, pad, w, 30);
            ctx.fillStyle = '#ef544f';
            ctx.font = '800 12px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(text, W / 2, pad + 20);
        }
        ctx.restore();
    }

    drawPanel(ctx, x, y, w, h) {
        ctx.save();
        ctx.fillStyle = 'rgba(9, 10, 15, 0.9)';
        ctx.strokeStyle = 'rgba(120, 94, 255, 0.35)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x, y, w, h, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    drawBar(ctx, x, y, w, h, pct, ok, danger) {
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        roundRect(ctx, x, y, w, h, 3);
        ctx.fill();
        ctx.fillStyle = pct > 0.35 ? ok : danger;
        roundRect(ctx, x, y, w * pct, h, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 94, 255, 0.2)';
        ctx.lineWidth = 1;
        roundRect(ctx, x, y, w, h, 3);
        ctx.stroke();
    }

    drawMinimapPanel(ctx, W, H) {
        const viewHalfW = W / (2 * this.zoom);
        const viewHalfH = H / (2 * this.zoom);
        const isMobile = this.isMobileLayout;
        const cacheSize = isMobile ? 96 : 160;
        if (!this._minimapCanvas && typeof document !== 'undefined') {
            this._minimapCanvas = document.createElement('canvas');
            this._minimapCtx = this._minimapCanvas.getContext('2d', { alpha: true });
        }
        const now = performance.now();
        const targetCtx = this._minimapCtx || ctx;
        const shouldCache = !!this._minimapCtx;
        const needsRedraw = !shouldCache || now >= this._nextMinimapRenderAt
            || this._minimapCanvas.width !== cacheSize || this._minimapCanvas.height !== cacheSize;
        if (!needsRedraw) {
            ctx.drawImage(this._minimapCanvas, 0, 0);
            return;
        }
        if (shouldCache) {
            if (this._minimapCanvas.width !== cacheSize || this._minimapCanvas.height !== cacheSize) {
                this._minimapCanvas.width = cacheSize;
                this._minimapCanvas.height = cacheSize;
            }
            targetCtx.clearRect(0, 0, cacheSize, cacheSize);
            this._nextMinimapRenderAt = now + (1000 / 12);
        }
        const lootDots = this.minimap.food?.length
            ? this.minimap.food
            : this.loot
                .filter(l => l.type === 'chest' || l.type === 'deathCrate' || l.type === 'money')
                .map(l => ({ x: l.x, y: l.y, golden: l.type !== 'chest' }));
        const minimapPlayers = this.minimap.players?.length
            ? this.minimap.players
            : this.players.map(p => ({ x: p.x, y: p.y, isYou: p.isYou || p.id === this.myId }));
        drawGameMinimap(targetCtx, {
            screenW: shouldCache ? cacheSize : W,
            screenH: shouldCache ? cacheSize : H,
            isMobile,
            centerX: this.camera.x,
            centerY: this.camera.y,
            viewHalfW,
            viewHalfH,
            players: minimapPlayers,
            food: lootDots,
            obstacles: this.minimap.obstacles?.length ? this.minimap.obstacles : this.obstacles,
            zone: this.zone?.radius > 0 ? {
                cx: this.zone.x,
                cy: this.zone.y,
                radius: this.zone.radius,
            } : null,
            time: now,
        });
        if (shouldCache) ctx.drawImage(this._minimapCanvas, 0, 0);
    }

    // ========== NEW VISUAL FEEDBACK METHODS ==========

    spawnGrenadeExplosion(x, y) {
        const spawnedAt = Date.now();
        this.grenadeExplosions.push({ x, y, spawnedAt, duration: 760, radius: 145 });
        if (this.grenadeExplosions.length > 8) this.grenadeExplosions.shift();

        for (let i = 0; i < 34; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 70 + Math.random() * 190;
            const smoke = i >= 22;
            const life = smoke ? 0.65 + Math.random() * 0.35 : 0.28 + Math.random() * 0.24;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life,
                maxLife: life,
                size: smoke ? 9 + Math.random() * 11 : 3 + Math.random() * 6,
                color: smoke ? '#424844' : (Math.random() > 0.45 ? '#ffb020' : '#fff0a8'),
                type: smoke ? 'grenadeSmoke' : 'grenadeFire',
            });
        }
        this.cameraShake.intensity = Math.max(this.cameraShake.intensity || 0, 8);
    }

    drawGrenadeExplosions(ctx, currentHouse = null, currentRoom = null) {
        const now = this._frameNow || performance.now();
        compactTimedItems(this.grenadeExplosions, now);
        if (this.grenadeExplosions.length === 0) return;

        ctx.save();
        for (const explosion of this.grenadeExplosions) {
            if (!this.isPointInView(explosion.x, explosion.y, explosion.radius + 20)) continue;
            if (this.isPointHiddenByRooms(explosion.x, explosion.y, currentHouse, currentRoom)) continue;
            const t = clamp((now - explosion.spawnedAt) / explosion.duration, 0, 1);
            const blastT = Math.min(1, t / 0.42);
            const radius = explosion.radius * (1 - Math.pow(1 - blastT, 3));

            if (t < 0.28) {
                const flashRadius = 18 + radius * 0.68;
                const flash = ctx.createRadialGradient(explosion.x, explosion.y, 0, explosion.x, explosion.y, flashRadius);
                flash.addColorStop(0, `rgba(255,255,238,${0.95 * (1 - t / 0.28)})`);
                flash.addColorStop(0.28, `rgba(255,190,55,${0.8 * (1 - t / 0.28)})`);
                flash.addColorStop(1, 'rgba(230,65,12,0)');
                ctx.fillStyle = flash;
                ctx.beginPath();
                ctx.arc(explosion.x, explosion.y, flashRadius, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = Math.max(0, 1 - t) * 0.95;
            ctx.strokeStyle = t < 0.3 ? '#ffd166' : '#e26424';
            ctx.lineWidth = Math.max(2, 11 * (1 - t));
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
            ctx.stroke();

            if (t > 0.12) {
                ctx.globalAlpha = Math.max(0, 0.42 * (1 - t));
                ctx.fillStyle = '#282e2a';
                ctx.beginPath();
                ctx.arc(explosion.x, explosion.y, 28 + t * 38, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    drawParticles(ctx, currentHouse = null, currentRoom = null) {
        if (this.particles.length === 0) return;
        ctx.save();
        for (const p of this.particles) {
            if (!this.isPointInView(p.x, p.y, 24)) continue;
            if (this.isPointHiddenByRooms(p.x, p.y, currentHouse, currentRoom)) continue;
            const alpha = clamp(p.life / (p.maxLife || 0.2), 0, 1);
            ctx.globalAlpha = alpha;

            if (p.type === 'chestShard') {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation || 0);
                ctx.fillStyle = p.color || '#9a5c2d';
                ctx.strokeStyle = 'rgba(42, 22, 10, 0.55)';
                ctx.lineWidth = 0.8;
                ctx.fillRect(-p.size, -p.size * 0.42, p.size * 2, p.size * 0.84);
                ctx.strokeRect(-p.size, -p.size * 0.42, p.size * 2, p.size * 0.84);
                ctx.restore();
            } else if (p.type === 'shell') {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation || 0);
                ctx.fillStyle = p.color || '#d4af37';
                // Draw a tiny gold cylinder shell casing
                ctx.fillRect(-2.5, -0.9, 5, 1.8);
                // Draw a slightly darker rim for texture
                ctx.fillStyle = 'rgba(0,0,0,0.18)';
                ctx.fillRect(-2.5, -0.9, 1, 1.8);
                ctx.restore();
            } else if (p.type === 'grenadeSmoke') {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha * 0.42;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (1.35 - alpha * 0.35), 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'waterRing') {
                const age = 1 - alpha;
                ctx.globalAlpha = alpha * 0.72;
                ctx.strokeStyle = p.color || '#a9e7f5';
                ctx.lineWidth = 1.25;
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.size * (1 + age * 1.6), p.size * (0.38 + age * 0.55), 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (p.type === 'waterDroplet') {
                ctx.fillStyle = p.color || '#c5f1fa';
                ctx.globalAlpha = alpha * 0.88;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, p.size * alpha), 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = p.color || '#ffdd44';
                ctx.shadowColor = p.type === 'grenadeFire' ? p.color : 'transparent';
                ctx.shadowBlur = p.type === 'grenadeFire' ? 9 : 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    drawDamageNumbers(ctx, currentHouse = null, currentRoom = null) {
        const now = this._frameNow;
        compactTimedItems(this.damageNumbers, now);
        if (this.damageNumbers.length === 0) return;
        ctx.save();
        for (const d of this.damageNumbers) {
            if (!this.isPointInView(d.x, d.y, 48)) continue;
            if (this.isPointHiddenByRooms(d.x, d.y, currentHouse, currentRoom)) continue;
            const age = now - d.spawnedAt;
            const t = age / d.duration;
            const alpha = t < 0.2 ? t / 0.2 : Math.max(0, 1 - (t - 0.5) / 0.5);
            const yOffset = -t * 28;
            const scale = t < 0.15 ? 0.7 + t / 0.15 * 0.6 : 1.3 - t * 0.3;

            ctx.save();
            ctx.translate(d.x, d.y + yOffset);
            ctx.scale(scale, scale);
            ctx.globalAlpha = alpha;
            ctx.font = '900 14px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.strokeText(`-${d.amount}`, 0, 0);
            ctx.fillStyle = d.color || '#ff4444';
            ctx.fillText(`-${d.amount}`, 0, 0);
            ctx.restore();
        }
        ctx.restore();
    }

    drawDamageIndicators(ctx, W, H) {
        const now = this._frameNow;
        compactTimedItems(this.damageIndicators, now);
        if (this.damageIndicators.length === 0) return;
        const cx = W / 2;
        const cy = H / 2;
        const indicatorDist = Math.min(W, H) * 0.35;

        ctx.save();
        for (const d of this.damageIndicators) {
            const age = now - d.spawnedAt;
            const alpha = Math.max(0, 1 - age / d.duration) * d.intensity;
            const x = cx + Math.cos(d.angle) * indicatorDist;
            const y = cy + Math.sin(d.angle) * indicatorDist;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(d.angle);
            ctx.globalAlpha = alpha;

            // Red damage arc
            const grad = ctx.createLinearGradient(-30, 0, 30, 0);
            grad.addColorStop(0, 'rgba(255, 40, 30, 0)');
            grad.addColorStop(0.5, `rgba(255, 40, 30, ${0.8 * alpha})`);
            grad.addColorStop(1, 'rgba(255, 40, 30, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(4, -18);
            ctx.lineTo(12, 0);
            ctx.lineTo(4, 18);
            ctx.lineTo(0, 12);
            ctx.lineTo(6, 0);
            ctx.lineTo(0, -12);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    drawHitMarkers(ctx, W, H) {
        const now = this._frameNow;
        compactTimedItems(this.hitMarkers, now);
        if (this.hitMarkers.length === 0) return;
        const cx = W / 2;
        const cy = H / 2;

        ctx.save();
        for (const h of this.hitMarkers) {
            const age = now - h.spawnedAt;
            const t = age / h.duration;
            const alpha = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.3) / 0.7);
            const size = h.kill ? 14 : 10;
            const expand = t < 0.15 ? 1 + t * 4 : 1.6 - t * 0.6;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(expand, expand);
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = h.kill ? '#ff4444' : '#ffffff';
            ctx.lineWidth = h.kill ? 2.5 : 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-size, -size);
            ctx.lineTo(-size * 0.35, -size * 0.35);
            ctx.moveTo(size, -size);
            ctx.lineTo(size * 0.35, -size * 0.35);
            ctx.moveTo(-size, size);
            ctx.lineTo(-size * 0.35, size * 0.35);
            ctx.moveTo(size, size);

            ctx.lineTo(size * 0.35, size * 0.35);
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    }

    drawKillAnimation(ctx, W, H) {
        const now = this._frameNow;
        compactTimedItems(this.killAnimations, now);
        const animation = this.killAnimations[this.killAnimations.length - 1];
        if (!animation) return;

        const t = clamp((now - animation.spawnedAt) / animation.duration, 0, 1);
        const alpha = t < 0.12 ? t / 0.12 : t > 0.72 ? (1 - t) / 0.28 : 1;
        const pop = t < 0.22 ? 0.72 + Math.sin((t / 0.22) * Math.PI / 2) * 0.34 : 1;
        const cx = W / 2;
        const y = H * 0.3;

        ctx.save();
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.translate(cx, y);
        ctx.scale(pop, pop);

        const pulse = 30 + t * 42;
        ctx.strokeStyle = `rgba(239, 84, 79, ${Math.max(0, 0.55 * (1 - t))})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(8, 10, 10, 0.82)';
        ctx.strokeStyle = 'rgba(239, 84, 79, 0.68)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, -112, -27, 224, 54, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef544f';
        ctx.font = '900 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠  ELIMINATED', 0, -7);
        ctx.fillStyle = 'rgba(255,255,255,0.84)';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.fillText(this.hideNames ? '???' : animation.victimName, 0, 12);
        ctx.restore();
    }
    drawKillFeed(ctx, W, H) {
        if (this.killFeed.length === 0) return;
        const now = this._frameNow;
        const maxShow = this.isMobileLayout ? (H <= 330 ? 2 : 3) : 5;
        const entries = this.killFeed.slice(-maxShow);

        ctx.save();
        // React owns the top-right leaderboard layer, while the desktop minimap
        // occupies the first 146 px on the left. Keep the feed below either HUD.
        let y = this.isMobileLayout ? (H <= 390 ? 142 : 170) : 158;
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const age = now - e.shownAt;
            const alpha = age < 300 ? age / 300 : age > 4200 ? Math.max(0, 1 - (age - 4200) / 800) : 1;
            if (alpha <= 0) continue;

            ctx.globalAlpha = alpha;
            const killerDisplay = this.hideNames ? '???' : (e.killer || '?');
            const victimDisplay = this.hideNames ? '???' : (e.victim || '?');
            const weaponDisplay = String(e.weapon || 'fists').toUpperCase();
            const text = `${killerDisplay} ☠ ${victimDisplay} · ${weaponDisplay}`;
            const tw = Math.min(this.isMobileLayout ? 210 : 260, Math.max(128, text.length * 5.6 + 24));
            const x = this.isMobileLayout ? W - tw - 14 : 14;

            ctx.fillStyle = 'rgba(8, 10, 9, 0.72)';
            roundRect(ctx, x, y, tw, 22, 4);
            ctx.fill();

            ctx.font = '700 10px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            // Killer name
            ctx.fillStyle = '#ff6b6b';
            ctx.fillText(killerDisplay, x + 8, y + 11);

            // Skull icon
            const killerW = ctx.measureText(killerDisplay).width;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(' ☠ ', x + 8 + killerW, y + 11);

            // Victim name and weapon source
            const midW = ctx.measureText(' ☠ ').width;
            const victimX = x + 8 + killerW + midW;
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(victimDisplay, victimX, y + 11);
            const victimW = ctx.measureText(victimDisplay).width;
            const weaponX = victimX + victimW;
            const weaponSpace = Math.max(0, x + tw - 7 - weaponX);
            if (weaponSpace > 12) {
                ctx.fillStyle = 'rgba(215, 195, 150, 0.68)';
                ctx.font = '800 8px system-ui, sans-serif';
                ctx.fillText(` · ${weaponDisplay}`, weaponX, y + 11, weaponSpace);
            }

            y += 26;
        }
        ctx.restore();
    }

    drawLowAmmoWarning(ctx, W, H) {
        if (this._lowAmmoPulse <= 0) return;
        ctx.save();
        const pulse = 0.5 + Math.sin(this._frameNow / 200) * 0.5;
        ctx.globalAlpha = this._lowAmmoPulse * pulse * 0.25;
        const lowAmmoKey = `${W}:${H}`;
        if (lowAmmoKey !== this._cachedLowAmmoKey) {
            this._cachedLowAmmoGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
            this._cachedLowAmmoGrad.addColorStop(0, 'rgba(255, 160, 0, 0)');
            this._cachedLowAmmoGrad.addColorStop(1, 'rgba(255, 160, 0, 0.5)');
            this._cachedLowAmmoKey = lowAmmoKey;
        }
        ctx.fillStyle = this._cachedLowAmmoGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    drawFpsCounter(ctx, W, H) {
        const fps = this._fpsDisplay;
        if (!fps) return;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = fps >= 120 ? '#55d875' : fps >= 60 ? '#ffd45a' : '#ef544f';
        ctx.font = '700 12px "Space Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(`${fps} FPS`, W - 10, H - 22);
        ctx.restore();
    }

    spawnBloodDecal(x, y) {
        const size = 10 + Math.random() * 10;
        const dropletCount = 3 + Math.floor(size * 0.12);
        const droplets = [];
        for (let i = 0; i < dropletCount; i++) {
            const dist = size * (0.42 + Math.random() * 0.45);
            const angle = (i * Math.PI * 2) / dropletCount + (Math.random() - 0.5) * 0.6;
            droplets.push({
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
                radius: size * (0.10 + Math.random() * 0.1),
            });
        }
        this.bloodDecals.push({
            x: x + (Math.random() - 0.5) * 8,
            y: y + (Math.random() - 0.5) * 8,
            size,
            rotation: Math.random() * Math.PI * 2,
            opacity: 0.85,
            bornAt: Date.now(),
            fadeStartAt: Date.now() + 18000, // Stay solid for 18 seconds
            fadeDuration: 4000,             // Fade out over 4 seconds
            droplets,
        });
        // Cap to prevent memory leaks
        if (this.bloodDecals.length > 50) {
            this.bloodDecals.shift();
        }
    }

    drawBloodDecals(ctx) {
        const now = this._frameNow;
        for (let i = this.bloodDecals.length - 1; i >= 0; i--) {
            const d = this.bloodDecals[i];
            let alpha = d.opacity;
            if (now > d.fadeStartAt) {
                const elapsed = now - d.fadeStartAt;
                alpha = Math.max(0, d.opacity * (1 - elapsed / d.fadeDuration));
            }
            if (alpha <= 0) {
                this.bloodDecals.splice(i, 1);
                continue;
            }
            if (!this.isPointInView(d.x, d.y, d.size + 8)) continue;

            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rotation);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#9b1e1a'; // Deep organic blood red

            // Primary splatter circle
            ctx.beginPath();
            ctx.arc(0, 0, d.size * 0.44, 0, Math.PI * 2);
            ctx.fill();

            // Satellite droplets (splatter spray)
            for (const droplet of d.droplets || []) {
                ctx.beginPath();
                ctx.arc(droplet.x, droplet.y, droplet.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
}
