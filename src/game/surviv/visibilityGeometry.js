// Original renderer geometry. The spatial tree changes ray search cost, not
// ray count, shadow shape, intersection tolerance or visibility distance.
const ENDPOINT_EPSILON = 1e-7;
const LEAF_SIZE = 6;

export function getHouseBoundarySegments(house) {
    const points = Array.isArray(house.footprint) && house.footprint.length >= 3
        ? house.footprint
        : [{ x: -house.w / 2, y: -house.h / 2 }, { x: house.w / 2, y: -house.h / 2 },
            { x: house.w / 2, y: house.h / 2 }, { x: -house.w / 2, y: house.h / 2 }];
    const angle = Number(house.rotation) || 0;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const world = points.map(p => ({
        x: house.x + p.x * cos - p.y * sin,
        y: house.y + p.x * sin + p.y * cos,
    }));
    return world.map((p, i) => ({ ax: p.x, ay: p.y, bx: world[(i + 1) % world.length].x, by: world[(i + 1) % world.length].y }));
}

// Append, rather than begin, so this can also punch a true L/T-shaped hole in
// the exterior even-odd shadow mask. No temporary arrays in the frame path.
export function appendHouseFootprintPath(ctx, house, rectangleInset = 0) {
    const footprint = house.footprint;
    ctx.save();
    ctx.translate(house.x, house.y);
    if (house.rotation) ctx.rotate(house.rotation);
    if (Array.isArray(footprint) && footprint.length >= 3) {
        ctx.moveTo(footprint[0].x, footprint[0].y);
        for (let i = 1; i < footprint.length; i++) ctx.lineTo(footprint[i].x, footprint[i].y);
        ctx.closePath();
    } else {
        ctx.rect(-house.w / 2 + rectangleInset, -house.h / 2 + rectangleInset,
            house.w - rectangleInset * 2, house.h - rectangleInset * 2);
    }
    ctx.restore();
}

export function buildVisibilityRayIndex(segments) {
    if (!segments.length) return null;
    const ordered = segments.map(s => {
        const dx = s.bx - s.ax, dy = s.by - s.ay;
        // Segment endpoint tolerance must be reflected in the broad phase too.
        const padX = Math.abs(dx) * ENDPOINT_EPSILON + ENDPOINT_EPSILON;
        const padY = Math.abs(dy) * ENDPOINT_EPSILON + ENDPOINT_EPSILON;
        return { ax: s.ax, ay: s.ay, dx, dy,
            minX: Math.min(s.ax, s.bx) - padX, maxX: Math.max(s.ax, s.bx) + padX,
            minY: Math.min(s.ay, s.by) - padY, maxY: Math.max(s.ay, s.by) + padY };
    });
    const nodes = [];
    function build(start, end) {
        const node = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, start, end, left: -1, right: -1 };
        const index = nodes.push(node) - 1;
        for (let i = start; i < end; i++) {
            const s = ordered[i];
            node.minX = Math.min(node.minX, s.minX); node.maxX = Math.max(node.maxX, s.maxX);
            node.minY = Math.min(node.minY, s.minY); node.maxY = Math.max(node.maxY, s.maxY);
        }
        if (end - start <= LEAF_SIZE) return index;
        const splitX = node.maxX - node.minX >= node.maxY - node.minY;
        const part = ordered.slice(start, end).sort(splitX
            ? (a, b) => (a.minX + a.maxX) - (b.minX + b.maxX)
            : (a, b) => (a.minY + a.maxY) - (b.minY + b.maxY));
        for (let i = 0; i < part.length; i++) ordered[start + i] = part[i];
        const middle = (start + end) >>> 1;
        node.left = build(start, middle); node.right = build(middle, end);
        node.splitX = splitX;
        return index;
    }
    build(0, ordered.length);
    return { nodes, segments: ordered, stack: new Int32Array(nodes.length) };
}

export function castVisibilityRay(index, px, py, rdx, rdy, maxDist, out, metrics = null) {
    let closest = maxDist;
    if (!index) { out.x = px + rdx * closest; out.y = py + rdy * closest; return out; }
    const { nodes, segments, stack } = index;
    const inverseX = rdx === 0 ? 0 : 1 / rdx;
    const inverseY = rdy === 0 ? 0 : 1 / rdy;
    let pending = 1; stack[0] = 0;
    while (pending) {
        const node = nodes[stack[--pending]];
        let near = 0, far = closest;
        if (rdx === 0) {
            if (px < node.minX || px > node.maxX) continue;
        } else {
            const a = (node.minX - px) * inverseX, b = (node.maxX - px) * inverseX;
            near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
        }
        if (rdy === 0) {
            if (py < node.minY || py > node.maxY) continue;
        } else {
            const a = (node.minY - py) * inverseY, b = (node.maxY - py) * inverseY;
            near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
        }
        if (near > far) continue;
        if (node.left >= 0) {
            // Near-side first usually finds the blocking wall before distant rooms.
            const forward = node.splitX ? rdx >= 0 : rdy >= 0;
            stack[pending++] = forward ? node.right : node.left;
            stack[pending++] = forward ? node.left : node.right;
            continue;
        }
        for (let i = node.start; i < node.end; i++) {
            if (metrics) metrics.segmentTests++;
            const s = segments[i];
            const denominator = rdx * s.dy - rdy * s.dx;
            if (Math.abs(denominator) < 1e-10) continue;
            const originDx = s.ax - px, originDy = s.ay - py;
            const t = (originDx * s.dy - originDy * s.dx) / denominator;
            if (t < 0 || t >= closest) continue;
            const u = (originDx * rdy - originDy * rdx) / denominator;
            if (u >= -ENDPOINT_EPSILON && u <= 1 + ENDPOINT_EPSILON) closest = t;
        }
    }
    out.x = px + rdx * closest; out.y = py + rdy * closest;
    return out;
}
