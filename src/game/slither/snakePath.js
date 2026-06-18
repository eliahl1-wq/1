/** Client-side slither path/body — keeps head + body moving together at display rate. */

const SEG_SEP = 3.6;
const BASE_RADIUS = 6.2;
const MAX_SC = 6;
const SC_DIV = 106;
const MAX_PATH_POINTS = 560;
const MIN_HEAD_RECORD = 0.14;

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

/** Slither.io continuous scale from segment count + fractional fullness. */
export function continuousSc(sct, fam = 0) {
    return Math.min(MAX_SC, 1 + (Math.max(2, sct) - 2 + Math.max(0, fam)) / SC_DIV);
}

/** Snap visual thickness to server after teleport or respawn. */
export function resetVisualGrowth(state, radius, fam = 0, sct = 1) {
    state.visualRadius = radius ?? BASE_RADIUS * continuousSc(sct, fam);
    state.visualFam = fam;
    state._prevTargetSct = sct;
}

/** Ease display thickness and tail fullness toward server values. */
function stepVisualGrowth(state, meta, dt) {
    const targetFam = meta.fam ?? 0;
    const targetSct = meta.segmentCount || 1;
    const targetRadius = BASE_RADIUS * continuousSc(targetSct, targetFam);
    if (state.visualRadius == null) state.visualRadius = targetRadius;
    if (state.visualFam == null) state.visualFam = targetFam;
    if (state._prevTargetSct == null) state._prevTargetSct = targetSct;
    state._prevTargetSct = targetSct;

    const radiusA = 1 - Math.exp(-dt / 1.4);
    const famA = 1 - Math.exp(-dt / 1.1);
    state.visualRadius += (targetRadius - state.visualRadius) * radiusA;
    state.visualFam += (targetFam - state.visualFam) * famA;

    const visSc = state.visualRadius / BASE_RADIUS;
    return {
        radius: state.visualRadius,
        sc: visSc,
        fam: state.visualFam,
    };
}

export function extendSpineTail(segments, fam, spacing) {
    if (!segments.length || fam < 0.01 || spacing < 0.1) return segments;
    const n = segments.length;
    const tail = segments[n - 1];
    const prev = segments[Math.max(0, n - 2)];
    let dx = tail.x - prev.x;
    let dy = tail.y - prev.y;
    let d = Math.hypot(dx, dy);
    if (d < 1e-4 && n >= 3) {
        const p2 = segments[n - 3];
        dx = tail.x - p2.x;
        dy = tail.y - p2.y;
        d = Math.hypot(dx, dy);
    }
    if (d < 1e-4) return segments;
    const ext = fam * spacing;
    const out = segments.slice();
    out.push({ x: tail.x + (dx / d) * ext, y: tail.y + (dy / d) * ext });
    return out;
}

function lerpAngle(a, b, t) {
    let da = b - a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    return a + da * t;
}

function copySpineSnapshot(segments, maxPoints) {
    const n = Math.min(segments.length, maxPoints);
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
        out[i] = { x: segments[i].x, y: segments[i].y };
    }
    return out;
}

function spinePointAt(snap, idx) {
    const n = snap.length;
    if (n === 0) return { x: 0, y: 0 };
    return snap[Math.min(idx, n - 1)];
}

/** Reset snapshot interpolation after teleport / respawn. */
export function resetSnakeBodyTick(state) {
    delete state._snapA;
    delete state._snapB;
    delete state._snapAT;
    delete state._snapBT;
    delete state._snapAAngle;
    delete state._snapBAngle;
    delete state._tickMs;
    delete state._lastSnapKey;
}

/**
 * Interpolate between the previous and current server spine snapshots.
 * Avoids backward head jumps and path re-simulation fighting server data.
 */
export function stepSnakeBody(state, meta, serverSegments, serverAngle, dt, nowMs = performance.now()) {
    const spineLen = serverSegments?.length || 0;
    if (spineLen === 0 || !serverSegments[0]) return;

    const serverHead = serverSegments[0];
    const growth = stepVisualGrowth(state, meta, dt);

    if (!state.segments[0]) {
        state.segments[0] = { x: serverHead.x, y: serverHead.y };
    }
    syncSegmentCount(state, spineLen, 1, serverHead, serverAngle ?? state.angle ?? 0);

    const snapKey = `${serverHead.x}|${serverHead.y}|${spineLen}|${serverAngle || 0}`;
    if (state._lastSnapKey !== snapKey) {
        state._lastSnapKey = snapKey;
        if (state._snapB) {
            state._snapA = state._snapB;
            state._snapAT = state._snapBT;
            state._snapAAngle = state._snapBAngle;
            const gap = nowMs - (state._snapBT ?? nowMs);
            if (gap > 8 && gap < 500) {
                state._tickMs = state._tickMs ? state._tickMs * 0.88 + gap * 0.12 : gap;
            }
        }
        state._snapB = copySpineSnapshot(serverSegments, spineLen);
        state._snapBT = nowMs;
        state._snapBAngle = serverAngle || 0;
        if (!state._snapA) {
            state._snapA = copySpineSnapshot(serverSegments, spineLen);
            state._snapAT = state._snapBT;
            state._snapAAngle = state._snapBAngle;
        }
    }

    let t = 1;
    if (state._snapA && state._snapB && state._snapBT > state._snapAT) {
        t = (nowMs - state._snapAT) / (state._snapBT - state._snapAT);
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
    }

    const snapA = state._snapA || state._snapB;
    const snapB = state._snapB;
    for (let i = 0; i < spineLen; i++) {
        const a = spinePointAt(snapA, i);
        const b = spinePointAt(snapB, i);
        const seg = state.segments[i];
        seg.x = a.x + (b.x - a.x) * t;
        seg.y = a.y + (b.y - a.y) * t;
    }
    state.angle = lerpAngle(state._snapAAngle ?? state._snapBAngle, state._snapBAngle, t);

    const visFam = growth.fam ?? meta.fam ?? 0;
    const visSpacing = segmentSpacingForSnake({ sc: growth.sc ?? meta.sc, radius: growth.radius ?? meta.radius });
    state.drawSpine = extendSpineTail(state.segments, visFam, visSpacing);
}
