/**
 * Default slither.io snake colors (rcv/cv 0–8).
 * Extracted from the official client rrs/ggs/bbs tables.
 */
export const SLITHER_DEFAULT_COLORS = [
    '#c080ff', // 0 lavender-purple
    '#9099ff', // 1 indigo-blue
    '#80d0d0', // 2 turquoise-cyan
    '#80ff80', // 3 lime-green
    '#eeee70', // 4 tinted-yellow
    '#ffa060', // 5 orange
    '#ff9050', // 6 pink-red
    '#ff4040', // 7 dark-red
    '#e030e0', // 8 magenta
];

function parseHex(hex) {
    const h = (hex || '#808080').replace('#', '');
    if (h.length === 3) {
        return {
            r: parseInt(h[0] + h[0], 16),
            g: parseInt(h[1] + h[1], 16),
            b: parseInt(h[2] + h[2], 16),
        };
    }
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

/** Map any server color to the nearest official slither.io default skin color. */
export function normalizeSlitherColor(color) {
    const raw = typeof color === 'object' && color !== null ? color.fill : color;
    if (typeof raw === 'string') {
        const lower = raw.toLowerCase();
        if (SLITHER_DEFAULT_COLORS.includes(lower)) return lower;
    }

    const { r, g, b } = parseHex(raw);
    let best = SLITHER_DEFAULT_COLORS[0];
    let bestDist = Infinity;
    for (const hex of SLITHER_DEFAULT_COLORS) {
        const c = parseHex(hex);
        const dist = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
        if (dist < bestDist) {
            bestDist = dist;
            best = hex;
        }
    }
    return best;
}
