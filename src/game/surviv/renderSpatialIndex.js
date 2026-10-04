// Rendering broad phase only: preserve source order, exact bounds and all art.
// Long rivers/roads stay in an overflow list instead of occupying thousands of
// cells. Unlike collision, this index includes non-solid objects and roof bounds.
export function buildRenderSpatialIndex(source, cellSize = 512) {
    const cells = new Map(), oversized = [], entries = [];
    for (let order = 0; order < source.length; order++) {
        const object = source[order];
        const halfW = Math.abs(Number(object._renderHalfW ?? object.w / 2) || 0);
        const halfH = Math.abs(Number(object._renderHalfH ?? object.h / 2) || 0);
        const entry = { object, order, left: object.x - halfW, right: object.x + halfW,
            top: object.y - halfH, bottom: object.y + halfH, seen: 0 };
        entries.push(entry);
        const minX = Math.floor(entry.left / cellSize), maxX = Math.floor(entry.right / cellSize);
        const minY = Math.floor(entry.top / cellSize), maxY = Math.floor(entry.bottom / cellSize);
        if (!Number.isFinite(minX + maxX + minY + maxY)
            || (maxX - minX + 1) * (maxY - minY + 1) > 64) {
            oversized.push(entry);
            continue;
        }
        for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
            const key = `${x},${y}`;
            const bucket = cells.get(key);
            if (bucket) bucket.push(entry);
            else cells.set(key, [entry]);
        }
    }
    return { cells, oversized, entries, cellSize, query: 0 };
}

export function queryRenderSpatialIndex(index, bounds, target, metrics = null) {
    target.length = 0;
    const token = ++index.query;
    const { left, right, top, bottom } = bounds;
    const intersects = entry => entry.right >= left && entry.left <= right
        && entry.bottom >= top && entry.top <= bottom;
    const visit = entry => {
        if (entry.seen === token) return;
        entry.seen = token;
        if (metrics) metrics.candidates = (metrics.candidates || 0) + 1;
        if (intersects(entry)) target.push(entry);
    };
    const minX = Math.floor(left / index.cellSize), maxX = Math.floor(right / index.cellSize);
    const minY = Math.floor(top / index.cellSize), maxY = Math.floor(bottom / index.cellSize);
    // A very large spectator viewport is cheaper to scan once, and invalid
    // bounds must never create an unbounded cell traversal.
    const cellCount = (maxX - minX + 1) * (maxY - minY + 1);
    if (!Number.isFinite(cellCount) || cellCount > 256) {
        for (const entry of index.entries) visit(entry);
    } else {
        for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
            const bucket = index.cells.get(`${x},${y}`);
            if (bucket) for (const entry of bucket) visit(entry);
        }
        for (const entry of index.oversized) visit(entry);
    }
    target.sort((a, b) => a.order - b.order);
    for (let i = 0; i < target.length; i++) target[i] = target[i].object;
    return target;
}
