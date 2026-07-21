/** Client-side slither path/body — keeps head + body moving together at display rate. */

const SEG_SEP = 3.6;
const BASE_RADIUS = 6.2;
const MAX_RADIUS_SC = 3.15;
const MAX_LENGTH_SC = 1.65;
const SPAWN_SEGMENTS = 12;
const LENGTH_SC_DIV = 106;
const RADIUS_SC_DIV = 90;
const RADIUS_LOG_FACTOR = 0.59;
const SPACING_GROWTH_FACTOR = 0.32;
const MAX_PATH_POINTS = 3600;
const MIN_HEAD_RECORD = 0.38;

function distSq(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

function dist(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
}

export function segmentSpacingForSnake(snake) {
    if (snake?.wsep) return snake.wsep;
    if (snake?.sc) {
        const spacingSc = Math.min(MAX_LENGTH_SC, 1 + (snake.sc - 1) * SPACING_GROWTH_FACTOR);
        return SEG_SEP * spacingSc;
    }
    const radiusSc = (snake?.radius || BASE_RADIUS) / BASE_RADIUS;
    return SEG_SEP * Math.min(MAX_LENGTH_SC, 1 + (radiusSc - 1) * SPACING_GROWTH_FACTOR);
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
    if (arc >= required) return;

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
        segments.push({ x: tail.x, y: tail.y });
    }
    if (segments.length > targetCount) segments.length = targetCount;
}

/**
 * Place body segments along the head's traveled path at fixed spacing.
 */
export function updateBodyAlongPath(state, segments, spacing, headX, headY, angle = 0, fullSegmentCount = segments.length, minHeadRecord = MIN_HEAD_RECORD) {
    if (!segments.length) return;

    let path = state.path;
    if (!path || path.length < 2) {
        path = segments.map(s => ({ x: s.x, y: s.y }));
        state.path = path;
    }

    segments[0].x = headX;
    segments[0].y = headY;
    recordHeadOnPath(path, headX, headY, Math.max(0.08, spacing * minHeadRecord));

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
            const pathTail = path[path.length - 1];
            const pathPrev = path[Math.max(0, path.length - 2)];
            let dx = pathTail.x - pathPrev.x;
            let dy = pathTail.y - pathPrev.y;
            let d = Math.hypot(dx, dy);
            if (d < 1e-6) {
                dx = -Math.cos(angle);
                dy = -Math.sin(angle);
                d = 1;
            }
            const prev = segments[i - 1];
            segments[i].x = prev.x + (dx / d) * spacing;
            segments[i].y = prev.y + (dy / d) * spacing;
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
export function wsepForSc(sc) {
    return SEG_SEP * Math.min(MAX_LENGTH_SC, 1 + (Math.max(1, sc || 1) - 1) * SPACING_GROWTH_FACTOR);
}

export function continuousSc(sct, fam = 0) {
    const normalized = Math.max(2, sct) + Math.max(0, fam);
    const baseSegments = Math.min(normalized, SPAWN_SEGMENTS);
    const extraSegments = Math.max(0, normalized - SPAWN_SEGMENTS);
    return Math.min(
        MAX_RADIUS_SC,
        1 + (baseSegments - 2) / LENGTH_SC_DIV
            + Math.log1p(extraSegments / RADIUS_SC_DIV) * RADIUS_LOG_FACTOR,
    );
}

function continuousLengthSc(sct, fam = 0) {
    const radiusSc = continuousSc(sct, fam);
    return Math.min(MAX_LENGTH_SC, 1 + (radiusSc - 1) * SPACING_GROWTH_FACTOR);
}

export function continuousArcLength(sct, fam, spacing) {
    const sp = spacing ?? SEG_SEP * continuousLengthSc(sct, fam);
    return Math.max(sp, (Math.max(1, sct) - 1 + Math.max(0, fam)) * sp);
}

function spineArcLength(segments) {
    let arc = 0;
    for (let i = 1; i < segments.length; i++) {
        arc += dist(segments[i - 1].x, segments[i - 1].y, segments[i].x, segments[i].y);
    }
    return arc;
}

/** Trim or extend a spine polyline to an exact arc length (head at index 0). */
export function fitSpineToArcLength(segments, targetArc, maxExtension = 0) {
    if (!segments?.length || targetArc <= 0) return segments;
    const currentArc = spineArcLength(segments);
    if (Math.abs(currentArc - targetArc) < 0.08) return segments;

    if (currentArc > targetArc) {
        const out = [{ x: segments[0].x, y: segments[0].y }];
        let remain = targetArc;
        for (let i = 1; i < segments.length && remain > 1e-4; i++) {
            const ax = segments[i - 1].x;
            const ay = segments[i - 1].y;
            const bx = segments[i].x;
            const by = segments[i].y;
            const edge = dist(ax, ay, bx, by);
            if (edge <= remain + 1e-4) {
                out.push({ x: bx, y: by });
                remain -= edge;
            } else if (edge > 1e-6) {
                const t = remain / edge;
                out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t });
                remain = 0;
            }
        }
        return out.length > 1 ? out : segments;
    }

    // Downsampled curved spines are naturally shorter than their authoritative
    // arc. Never turn that compression into a long, straight synthetic tail;
    // only permit the caller's fractional between-segment growth.
    const extra = Math.min(targetArc - currentArc, Math.max(0, maxExtension));
    if (extra <= 0.0001) return segments;
    const n = segments.length;
    const tail = segments[n - 1];
    const prev = segments[Math.max(0, n - 2)];
    let dx = tail.x - prev.x;
    let dy = tail.y - prev.y;
    let d = Math.hypot(dx, dy);
    if (d < 1e-4) {
        for (let i = n - 1; i > 0; i--) {
            dx = segments[i].x - segments[i - 1].x;
            dy = segments[i].y - segments[i - 1].y;
            d = Math.hypot(dx, dy);
            if (d > 1e-4) break;
        }
    }
    if (d < 1e-4) return segments;
    const out = segments.slice();
    // Split visual growth across several tail points. One long synthetic edge
    // looked like a rigid stick and exposed a seam during large-snake turns.
    const averageEdge = currentArc / Math.max(1, n - 1);
    const maxTailStep = Math.max(1, Math.min(averageEdge || extra, 12));
    let remain = extra;
    let x = tail.x;
    let y = tail.y;
    while (remain > 1e-4) {
        const step = Math.min(maxTailStep, remain);
        x += (dx / d) * step;
        y += (dy / d) * step;
        out.push({ x, y });
        remain -= step;
    }
    return out;
}

/** Subdivide long edges so turns stay round on large snakes (Catmull-Rom Spline). */
export function densifySpine(spine, maxEdgeLen) {
    if (!spine || spine.length < 2 || maxEdgeLen <= 0) return spine;
    const out = [{ x: spine[0].x, y: spine[0].y }];
    for (let i = 1; i < spine.length; i++) {
        const p1 = spine[i - 1];
        const p2 = spine[i];
        const p0 = i >= 2 ? spine[i - 2] : p1;
        const p3 = i + 1 < spine.length ? spine[i + 1] : p2;

        const edge = dist(p1.x, p1.y, p2.x, p2.y);
        const steps = Math.max(1, Math.ceil(edge / maxEdgeLen));
        for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const t2 = t * t;
            const t3 = t2 * t;

            const x = 0.5 * (
                (2 * p1.x) +
                (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
            );
            const y = 0.5 * (
                (2 * p1.y) +
                (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
            );
            out.push({ x, y });
        }
    }
    return out;
}

/** Snap visual thickness to server after teleport or respawn. */
export function resetVisualGrowth(state, radius, fam = 0, sct = 1) {
    const sp = SEG_SEP * continuousLengthSc(sct, fam);
    state.visualRadius = radius ?? BASE_RADIUS * continuousSc(sct, fam);
    state.visualSpacing = sp;
    state.visualArcLen = continuousArcLength(sct, fam, sp);
    state._prevTargetSct = sct;
}

/** Ease display thickness and body length toward server sct+fam (slither.io fam model). */
function stepVisualGrowth(state, meta, dt) {
    const targetFam = meta.fam ?? 0;
    const targetSct = meta.segmentCount || 1;
    const targetSc = continuousSc(targetSct, targetFam);
    const targetSpacing = SEG_SEP * continuousLengthSc(targetSct, targetFam);
    const targetRadius = BASE_RADIUS * targetSc;
    const targetArc = continuousArcLength(targetSct, targetFam, targetSpacing);

    if (state.visualRadius == null) state.visualRadius = targetRadius;
    if (state.visualSpacing == null) state.visualSpacing = targetSpacing;
    if (state.visualArcLen == null) state.visualArcLen = targetArc;
    if (state._prevTargetSct == null) state._prevTargetSct = targetSct;
    state._prevTargetSct = targetSct;

    const radiusA = 1 - Math.exp(-dt / 1.6);
    const spacingA = 1 - Math.exp(-dt / 0.9);
    const arcA = 1 - Math.exp(-dt / 0.9);
    state.visualRadius += (targetRadius - state.visualRadius) * radiusA;
    state.visualSpacing += (targetSpacing - state.visualSpacing) * spacingA;
    state.visualArcLen += (targetArc - state.visualArcLen) * arcA;

    const visSc = state.visualRadius / BASE_RADIUS;
    return {
        radius: state.visualRadius,
        sc: visSc,
        arcLen: state.visualArcLen,
        spacing: state.visualSpacing,
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
    delete state._segmentVel;
}

/**
 * Interpolate between the previous and current server spine snapshots.
 * Avoids backward head jumps and path re-simulation fighting server data.
 */
export function stepSnakeBody(state, meta, serverSegments, serverAngle, dt, nowMs = performance.now(), options = {}) {
    const spineLen = serverSegments?.length || 0;
    if (spineLen === 0 || !serverSegments[0]) return;

    const serverHead = serverSegments[0];
    const growth = stepVisualGrowth(state, meta, dt);

    if (!state.segments[0]) {
        state.segments[0] = { x: serverHead.x, y: serverHead.y };
    }
    syncSegmentCount(state, spineLen, 1, serverHead, serverAngle ?? state.angle ?? 0);

    // Follow the newest spine continuously at display rate. A critically
    // damped follow preserves velocity across server updates, so bends do not
    // produce the speed pulses that a plain position lerp creates in the tail.
    const frameDt = Math.min(Math.max(dt || 0, 0), 0.1);
    const smoothTime = 0.06;
    const omega = 2 / smoothTime;
    const x = omega * frameDt;
    const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    let velocities = state._segmentVel;
    if (!velocities) {
        velocities = [];
        state._segmentVel = velocities;
    }
    while (velocities.length < spineLen) velocities.push({ x: 0, y: 0 });
    if (velocities.length > spineLen) velocities.length = spineLen;

    for (let i = 0; i < spineLen; i++) {
        const target = serverSegments[i];
        const seg = state.segments[i];
        const velocity = velocities[i];
        const changeX = seg.x - target.x;
        const changeY = seg.y - target.y;
        const tempX = (velocity.x + omega * changeX) * frameDt;
        const tempY = (velocity.y + omega * changeY) * frameDt;
        velocity.x = (velocity.x - omega * tempX) * decay;
        velocity.y = (velocity.y - omega * tempY) * decay;
        seg.x = target.x + (changeX + tempX) * decay;
        seg.y = target.y + (changeY + tempY) * decay;
    }
    const follow = 1 - Math.exp(-frameDt / 0.045);
    state.angle = lerpAngle(state.angle || 0, serverAngle || 0, follow);

    if (options.skipDensify) return;

    const visSpacing = growth.spacing ?? segmentSpacingForSnake({ sc: growth.sc, radius: growth.radius });
    const dense = densifySpine(state.segments, visSpacing * 0.45);
    const fractionalTail = Math.max(0, Math.min(1, meta.fam ?? 0)) * visSpacing;
    state.drawSpine = fitSpineToArcLength(
        dense,
        growth.arcLen ?? continuousArcLength(meta.segmentCount || 1, meta.fam ?? 0, visSpacing),
        fractionalTail,
    );
}
