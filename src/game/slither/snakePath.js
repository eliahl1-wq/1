/** Client-side slither path/body helpers — mirrors server slither-engine physics. */

const SEG_SEP = 3.6;
const BASE_RADIUS = 6.2;
const TURN_RATE = 4.8;
const NSP1 = 5.39;
const NSP2 = 0.4;
const NSP3 = 14;
const SLITHER_TICK = 125;
const SERVER_TICK = 40;
const SPEED_MUL = 1.2;
const WORLD_HALF = 3000;
const SLITHER_RADIUS = 21600;

function dist(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
}

export function segmentSpacingForSnake(snake) {
    if (snake?.sc) return SEG_SEP * snake.sc;
    const r = snake?.radius || BASE_RADIUS;
    return Math.max(2.6, r * (SEG_SEP / BASE_RADIUS));
}

export function speedPerSecond(sc, boosting = false) {
    const worldScale = (WORLD_HALF * 2) / (SLITHER_RADIUS * 2);
    const units = boosting ? NSP3 : NSP1 + NSP2 * sc;
    return (units * SLITHER_TICK * worldScale / SERVER_TICK) * SPEED_MUL;
}

export function turnRateRad(sc) {
    return TURN_RATE / (0.7 + 0.3 * Math.max(1, sc));
}

function pathArcLength(path) {
    let arc = 0;
    for (let i = 0; i < path.length - 1; i++) {
        arc += dist(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
    }
    return arc;
}

function trimPath(path, maxArcLength) {
    if (path.length <= 2) return;
    let arc = pathArcLength(path);
    while (path.length > 2 && arc > maxArcLength) {
        const last = path.pop();
        arc -= dist(path[path.length - 1].x, path[path.length - 1].y, last.x, last.y);
    }
}

function ensurePathArcLength(path, segmentCount, spacing, angle = 0) {
    const required = Math.max(spacing, (segmentCount - 1) * spacing);
    let arc = pathArcLength(path);
    if (arc >= required * 0.98) return;

    let dirX = 0;
    let dirY = 0;
    if (path.length >= 2) {
        const tail = path[path.length - 1];
        const prev = path[path.length - 2];
        dirX = tail.x - prev.x;
        dirY = tail.y - prev.y;
    }
    let d = Math.hypot(dirX, dirY);
    if (d < 1e-6) {
        dirX = -Math.cos(angle);
        dirY = -Math.sin(angle);
        d = 1;
    } else {
        dirX /= d;
        dirY /= d;
    }

    let last = path[path.length - 1];
    while (arc < required) {
        const add = Math.min(spacing, required - arc);
        last = { x: last.x + dirX * add, y: last.y + dirY * add };
        path.push(last);
        arc += add;
    }
}

/**
 * Place body segments along a head path at fixed spacing.
 * Mutates segments[1..] and state.path.
 */
export function updateBodyAlongPath(state, segments, spacing, headX, headY, angle = 0) {
    if (!segments.length) return;

    let path = state.path;
    if (!path || path.length < 2) {
        path = segments.map(s => ({ x: s.x, y: s.y }));
        state.path = path;
    }

    segments[0].x = headX;
    segments[0].y = headY;

    if (dist(path[0].x, path[0].y, headX, headY) > 0.01) {
        path.unshift({ x: headX, y: headY });
    } else {
        path[0].x = headX;
        path[0].y = headY;
    }

    ensurePathArcLength(path, segments.length, spacing, angle);

    let pathIndex = 0;
    let pathOffset = 0;

    for (let i = 1; i < segments.length; i++) {
        let need = spacing;
        let placed = false;

        while (need > 1e-6 && pathIndex < path.length - 1) {
            const ax = path[pathIndex].x;
            const ay = path[pathIndex].y;
            const bx = path[pathIndex + 1].x;
            const by = path[pathIndex + 1].y;
            const edgeLen = dist(ax, ay, bx, by);

            if (edgeLen < 1e-6) {
                pathIndex++;
                pathOffset = 0;
                continue;
            }

            const avail = edgeLen - pathOffset;

            if (avail >= need) {
                const t = (pathOffset + need) / edgeLen;
                segments[i].x = ax + (bx - ax) * t;
                segments[i].y = ay + (by - ay) * t;
                pathOffset += need;
                placed = true;
                need = 0;
            } else {
                need -= avail;
                pathIndex++;
                pathOffset = 0;
            }
        }

        if (!placed) {
            const tail = path[path.length - 1];
            segments[i].x = tail.x;
            segments[i].y = tail.y;
        }
    }

    trimPath(path, segments.length * spacing + spacing * 4);
}

/** Rebuild path history from an authoritative spine (respawn / large correction). */
export function rebuildPathFromSegments(state, segments) {
    state.path = segments.map(s => ({ x: s.x, y: s.y }));
}

/**
 * Advance the local snake each display frame: predict head from input,
 * gently correct toward server, then derive the body from path history.
 */
export function stepLocalSnake(state, meta, serverHead, dt, inputDx, inputDy, boosting) {
    const len = meta.segmentCount || 0;
    if (len === 0 || !serverHead) return;

    const spacing = segmentSpacingForSnake(meta);

    while (state.segments.length < len) {
        const tail = state.segments[state.segments.length - 1] || serverHead;
        const prev = state.segments.length >= 2
            ? state.segments[state.segments.length - 2]
            : tail;
        let dx = tail.x - prev.x;
        let dy = tail.y - prev.y;
        const d = Math.hypot(dx, dy);
        if (d > 1e-6) {
            dx /= d;
            dy /= d;
        } else {
            dx = -Math.cos(state.angle ?? meta.angle ?? 0);
            dy = -Math.sin(state.angle ?? meta.angle ?? 0);
        }
        state.segments.push({ x: tail.x - dx * spacing, y: tail.y - dy * spacing });
    }
    if (state.segments.length > len) state.segments.length = len;

    if (!state.segments[0]) {
        state.segments[0] = { x: serverHead.x, y: serverHead.y };
    }

    const head = state.segments[0];
    const sc = meta.sc || 1;
    let angle = state.angle ?? meta.angle ?? 0;

    const inputMag = Math.hypot(inputDx, inputDy);
    if (inputMag > 0.001) {
        const desired = Math.atan2(inputDy, inputDx);
        let da = desired - angle;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        const maxTurn = turnRateRad(sc) * dt;
        if (da > maxTurn) da = maxTurn;
        else if (da < -maxTurn) da = -maxTurn;
        angle += da;
    }
    state.angle = angle;

    const step = speedPerSecond(sc, boosting) * dt;
    head.x += Math.cos(angle) * step;
    head.y += Math.sin(angle) * step;

    const corr = 1 - Math.exp(-dt / 0.07);
    head.x += (serverHead.x - head.x) * corr;
    head.y += (serverHead.y - head.y) * corr;

    updateBodyAlongPath(state, state.segments, spacing, head.x, head.y, angle);
}

/**
 * Remote snakes: smooth the head toward server, derive body from path each frame.
 */
export function stepRemoteSnake(state, meta, serverHead, serverAngle, dt) {
    const len = meta.segmentCount || 0;
    if (len === 0 || !serverHead) return;

    const spacing = segmentSpacingForSnake(meta);

    while (state.segments.length < len) {
        const tail = state.segments[state.segments.length - 1] || serverHead;
        const prev = state.segments.length >= 2
            ? state.segments[state.segments.length - 2]
            : tail;
        let dx = tail.x - prev.x;
        let dy = tail.y - prev.y;
        const d = Math.hypot(dx, dy);
        if (d > 1e-6) {
            dx /= d;
            dy /= d;
        } else {
            dx = -Math.cos(state.angle ?? serverAngle ?? 0);
            dy = -Math.sin(state.angle ?? serverAngle ?? 0);
        }
        state.segments.push({ x: tail.x - dx * spacing, y: tail.y - dy * spacing });
    }
    if (state.segments.length > len) state.segments.length = len;

    if (!state.segments[0]) {
        state.segments[0] = { x: serverHead.x, y: serverHead.y };
    }

    const headA = 1 - Math.exp(-dt / 0.06);
    const head = state.segments[0];
    head.x += (serverHead.x - head.x) * headA;
    head.y += (serverHead.y - head.y) * headA;

    let da = (serverAngle || 0) - (state.angle || 0);
    da = Math.atan2(Math.sin(da), Math.cos(da));
    state.angle = (state.angle || 0) + da * headA;

    updateBodyAlongPath(
        state,
        state.segments,
        spacing,
        head.x,
        head.y,
        state.angle,
    );
}
