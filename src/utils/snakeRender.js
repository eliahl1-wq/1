export const snakeSegmentCache = new Map();
export const snakeShadowCache = new Map();
const SEGMENT_CACHE_MAX = 512;

function touchSegmentCache(key, canvas) {
    if (snakeSegmentCache.size >= SEGMENT_CACHE_MAX && !snakeSegmentCache.has(key)) {
        const oldest = snakeSegmentCache.keys().next().value;
        if (oldest != null) snakeSegmentCache.delete(oldest);
    }
    snakeSegmentCache.set(key, canvas);
    return canvas;
}

function parseColorHex(hex) {
    if (!hex || typeof hex !== 'string') return { r: 120, g: 120, b: 120 };
    const h = hex.replace('#', '');
    if (h.length === 3) {
        return {
            r: parseInt(h[0] + h[0], 16),
            g: parseInt(h[1] + h[1], 16),
            b: parseInt(h[2] + h[2], 16),
        };
    }
    if (h.length >= 6) {
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
        };
    }
    return { r: 120, g: 120, b: 120 };
}

// Ensure vibrant rainbow colors
export function normalizeColor(hex) {
    const { r, g, b } = parseColorHex(hex);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d > 0.0001) {
        if (max === rn) h = ((gn - bn) / d) % 6;
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    // Boost saturation and brightness
    const s = 0.85, l = 0.60;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rr = 0, gg = 0, bb = 0;
    if (h < 60) [rr, gg, bb] = [c, x, 0];
    else if (h < 120) [rr, gg, bb] = [x, c, 0];
    else if (h < 180) [rr, gg, bb] = [0, c, x];
    else if (h < 240) [rr, gg, bb] = [0, x, c];
    else if (h < 300) [rr, gg, bb] = [x, 0, c];
    else [rr, gg, bb] = [c, 0, x];
    
    return {
        r: Math.round((rr + m) * 255),
        g: Math.round((gg + m) * 255),
        b: Math.round((bb + m) * 255),
    };
}

export function getSnakeSegmentCanvas(radius, hexColor) {
    const key = `${Math.round(radius * 10)}_${hexColor}`;
    if (snakeSegmentCache.has(key)) return snakeSegmentCache.get(key);

    const R = radius;
    // Scale by device pixel ratio for crispness if desired, but 1x is fine for logic
    const s = Math.ceil(R);
    const canvasSize = s * 2;
    
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    
    const imgData = ctx.createImageData(canvasSize, canvasSize);
    const data = imgData.data;

    const col = normalizeColor(hexColor);
    const f = 1.416 * s;

    for (let t = 0; t < canvasSize; t++) {
        for (let e = 0; e < canvasSize; e++) {
            const dx = e - s + 0.5;
            const dy = t - s + 0.5;
            const n2 = dx * dx + dy * dy;
            const s2 = s * s;
            if (n2 >= s2) continue;

            const n = Math.sqrt(n2);
            
            // Cylindrical
            let r_cyl = Math.max(0, 1 - Math.abs(t - s) / s);
            r_cyl = Math.pow(r_cyl, 0.35);
            
            // Radial
            let r_rad = Math.max(0, 1 - n / f);
            
            let l = 0.625 * r_cyl + 0.375 * r_rad;
            let l_final = Math.max(0, Math.min(1, 1.12 * l));
            
            let h_val = s - n;
            let alpha = h_val < 1.5 ? Math.max(0, Math.min(1, h_val / 1.5)) : 1.0;
            
            const idx = (t * canvasSize + e) * 4;
            data[idx] = Math.min(255, col.r * l_final);
            data[idx+1] = Math.min(255, col.g * l_final);
            data[idx+2] = Math.min(255, col.b * l_final);
            data[idx+3] = alpha * 255;
        }
    }
    
    ctx.putImageData(imgData, 0, 0);
    return touchSegmentCache(key, canvas);
}

export function getSnakeShadowCanvas(radius) {
    const key = Math.round(radius * 10);
    if (snakeShadowCache.has(key)) return snakeShadowCache.get(key);

    const s = Math.ceil(radius);
    const canvasSize = s * 3; // larger to fit blur
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    const blurR = Math.max(2, 0.35 * s);
    const drawR = 0.95 * s;

    ctx.shadowColor = 'black';
    ctx.shadowBlur = blurR;
    ctx.shadowOffsetX = canvasSize; // draw off-screen to only show shadow
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'black';
    
    ctx.beginPath();
    // Offset by canvasSize left, so the shadow falls in the center
    ctx.arc(canvasSize / 2 - canvasSize, canvasSize / 2, drawR, 0, Math.PI * 2);
    ctx.fill();

    snakeShadowCache.set(key, canvas);
    return canvas;
}
