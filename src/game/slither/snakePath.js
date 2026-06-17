/** Client-side slither path/body — keeps head + body moving together at display rate. */

const SEG_SEP = 3.6;
const BASE_RADIUS = 6.2;
const MAX_PATH_POINTS = 560;
const MIN_HEAD_RECORD = 0.14;
/** Cap simulated spine points — render resamples anyway; saves CPU on long snakes. */
const MAX_SIM_SEGMENTS = 240;

function distSq(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

function dist(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
}

export function segmentSpacingForSnake(snake) {
    if (snake?.sc) return SEG_SEP * snake.sc;
    const r = snake?.radius || BASE_RADIUS;
    return Math.max(2.6, r * (SEG_SEP / BASE_RADIUS));
}

function pathArcLength(path, end = path.length) {
    let arc = 0;
    const last = Math.min(end, path.length) - 1;
    for (let i = 0; i < last; i++) {
        arc += dist(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
    }
    return arc;
}

function trimPath(path, maxArcLength) {
    if (path.length <= 2) return;
    let arc = pathArcLength(path);
    while (path.length > 2 && (arc > maxArcLength || path.length > MAX_PATH_POINTS)) {
        const last = path.pop();
        const prev = path[path.length - 1];
        arc -= dist(prev.x, prev.y, last.x, last.y);
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
    while (arc < required && path.length < MAX_PATH_POINTS) {
        const add = Math.min(spacing, required - arc);
        last = { x: last.x + dirX * add, y: last.y + dirY * add };
        path.push(last);
        arc += add;
    }
}

function recordHeadOnPath(path, headX, headY, minDist) {
    const minDistSq = minDist * minDist;
    if (!path.length) {
        path.push({ x: headX, y: headY });
        return;
    }
    if (distSq(path[0].x, path[0].y, headX, headY) > minDistSq) {
        path.unshift({ x: headX, y: headY });
    } else {
        path[0].x = headX;
        path[0].y = headY;
    }
}

function syncSegmentCount(state, targetCount, spacing, refHead, angle = 0) {
    const segments = state.segments;
    while (segments.length < targetCount) {
        const tail = segments[segments.length - 1] || refHead;
        const prev = segments.length >= 2 ? segments[segments.length - 2] : tail;
        let dx = tail.x - prev.x;
        let dy = tail.y - prev.y;
        const d = Math.hypot(dx, dy);
        if (d > 1e-6) {
            dx /= d;
            dy /= d;
        } else {
            dx = -Math.cos(angle);
            dy = -Math.sin(angle);
        }
        segments.push({ x: tail.x - dx * spacing, y: tail.y - dy * spacing });
    }
    if (segments.length > targetCount) segments.length = targetCount;
}

/**
 * Place body segments along the head's traveled path at fixed spacing.
 */
export function updateBodyAlongPath(state, segments, spacing, headX, headY, angle = 0, fullSegmentCount = segments.length) {
    if (!segments.length) return;

    let path = state.path;
    if (!path || path.length < 2) {
        path = segments.map(s => ({ x: s.x, y: s.y }));
        state.path = path;
    }

    segments[0].x = headX;
    segments[0].y = headY;
    recordHeadOnPath(path, headX, headY, Math.max(0.22, spacing * MIN_HEAD_RECORD));

    ensurePathArcLength(path, fullSegmentCount, spacing, angle);

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

    trimPath(path, fullSegmentCount * spacing + spacing * 4);
}

/** Rebuild path history from an authoritative spine (respawn / teleport). */
export function rebuildPathFromSegments(state, segments) {
    const path = [];
    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        if (!s) continue;
        if (path.length > 0) {
            const prev = path[path.length - 1];
            if (distSq(prev.x, prev.y, s.x, s.y) < 0.01) continue;
        }
        path.push({ x: s.x, y: s.y });
    }
    if (path.length < 2 && segments[0]) {
        const h = segments[0];
        path.push({ x: h.x - 4, y: h.y });
    }
    state.path = path;
}

/** Snap visual size/length to server after teleport or respawn. */
export function resetVisualGrowth(state, radius, segmentCount) {
    state.visualRadius = radius ?? BASE_RADIUS;
    state.visualSegCount = segmentCount ?? state.segments?.length ?? 1;
}

/**
 * Ease display length and radius toward server values so eating reads as
 * gradual growth — authoritative balance/segment totals are unchanged.
 */
function stepVisualGrowth(state, meta, targetSegCount, dt) {
    const targetRadius = meta.radius || BASE_RADIUS;
    if (state.visualRadius == null) state.visualRadius = targetRadius;
    if (state.visualSegCount == null) state.visualSegCount = targetSegCount;

    const radiusA = 1 - Math.exp(-dt / 0.16);
    state.visualRadius += (targetRadius - state.visualRadius) * radiusA;

    if (state.visualSegCount < targetSegCount) {
        const growA = 1 - Math.exp(-dt / 0.1);
        state.visualSegCount += (targetSegCount - state.visualSegCount) * growA;
    } else if (state.visualSegCount > targetSegCount) {
        const shrinkA = 1 - Math.exp(-dt / 0.06);
        state.visualSegCount += (targetSegCount - state.visualSegCount) * shrinkA;
    }

    return {
        segCount: Math.max(1, Math.round(state.visualSegCount)),
        radius: state.visualRadius,
        sc: state.visualRadius / BASE_RADIUS,
    };
}

/**
 * Smooth head toward server, derive body from path history.
 * Only used for the local snake — remote snakes use spine lerp instead.
 */
export function stepSnakeBody(state, meta, serverHead, serverAngle, dt, headTau = 0.014) {
    const len = meta.segmentCount || 0;
    if (len === 0 || !serverHead) return;

    const simCount = Math.min(len, MAX_SIM_SEGMENTS);
    // Visual growth only affects render radius — body uses authoritative server size.
    stepVisualGrowth(state, meta, simCount, dt);
    const spacing = segmentSpacingForSnake(meta);

    if (!state.segments[0]) {
        state.segments[0] = { x: serverHead.x, y: serverHead.y };
    }

    syncSegmentCount(state, simCount, spacing, serverHead, state.angle ?? serverAngle ?? 0);

    const head = state.segments[0];

    if (state._prevSrvHead) {
        const vx = serverHead.x - state._prevSrvHead.x;
        const vy = serverHead.y - state._prevSrvHead.y;
        if (vx * vx + vy * vy > 0.0001) {
            state._extrapX = vx;
            state._extrapY = vy;
        } else {
            state._extrapX = 0;
            state._extrapY = 0;
        }
    }
    state._prevSrvHead = { x: serverHead.x, y: serverHead.y };

    const targetX = serverHead.x + (state._extrapX || 0) * 0.85;
    const targetY = serverHead.y + (state._extrapY || 0) * 0.85;

    const headA = 1 - Math.exp(-dt / Math.max(headTau, 0.0001));
    head.x += (targetX - head.x) * headA;
    head.y += (targetY - head.y) * headA;

    let da = (serverAngle || 0) - (state.angle || 0);
    da = Math.atan2(Math.sin(da), Math.cos(da));
    state.angle = (state.angle || 0) + da * headA;

    updateBodyAlongPath(state, state.segments, spacing, head.x, head.y, state.angle, len);
}
