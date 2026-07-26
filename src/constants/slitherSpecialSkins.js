export const SLITHER_SPECIAL_SKINS = Object.freeze([
    Object.freeze({
        id: 'aurora',
        value: 'aurora',
        productId: 'slither:aurora',
        name: 'Aurora Veil',
        usdPrice: 2,
        description: 'A midnight shell carrying one continuous animated aurora ribbon, soft glow, and drifting stars.',
        baseColor: '#090c24',
        bodyGradient: Object.freeze(['#31206f', '#236bb5', '#26d8d0', '#91ffd2', '#a372ff']),
        coreGradient: Object.freeze(['#8b7cff', '#dffff7', '#66ffe2', '#f0dcff']),
        badgeGradient: 'linear-gradient(135deg, #17164f 0%, #256ea3 28%, #42d6b0 55%, #c2b5ff 78%, #8c6cff 100%)',
        colors: Object.freeze([
            '#17164f', '#1b285f', '#233c86', '#256ea3',
            '#21a7ad', '#42d6b0', '#8ae59f', '#c2e8ca',
            '#c2b5ff', '#a184ff', '#8c6cff', '#5549a8',
        ]),
    }),
    Object.freeze({
        id: 'eclipse',
        value: 'eclipse',
        productId: 'slither:eclipse',
        name: 'Solar Eclipse',
        usdPrice: 2,
        description: 'A matte void body split by a molten solar core with pulsing eclipse halos.',
        baseColor: '#07080d',
        bodyGradient: Object.freeze(['#07080d', '#12101b', '#1d1119', '#100b11']),
        coreGradient: Object.freeze(['#ff473d', '#ff8738', '#ffe295', '#ff7a32', '#a91f35']),
        badgeGradient: 'linear-gradient(135deg, #090a12 0%, #2a1e38 28%, #8c3348 52%, #ff8a45 76%, #ffd27a 100%)',
        colors: Object.freeze([
            '#090a12', '#0f1220', '#16192c', '#2a1e38',
            '#5f2749', '#8c3348', '#bd4d46', '#e36a42',
            '#ff8a45', '#ffad56', '#ffd27a', '#8f5a38',
        ]),
    }),
]);

export function getSlitherSpecialSkin(valueOrId) {
    return SLITHER_SPECIAL_SKINS.find(
        (skin) => skin.value === valueOrId || skin.id === valueOrId || skin.productId === valueOrId,
    ) || null;
}

export function isSlitherSpecialSkin(value) {
    return !!getSlitherSpecialSkin(value);
}

function colorAt(palette, amount) {
    const t = Math.max(0, Math.min(1, amount));
    const scaled = t * (palette.length - 1);
    const index = Math.min(palette.length - 2, Math.floor(scaled));
    const mix = scaled - index;
    const from = palette[index].slice(1);
    const to = palette[index + 1].slice(1);
    const channel = (offset) => Math.round(
        parseInt(from.slice(offset, offset + 2), 16) * (1 - mix)
        + parseInt(to.slice(offset, offset + 2), 16) * mix,
    );
    return `rgb(${channel(0)}, ${channel(2)}, ${channel(4)})`;
}

function measureBodyPath(points) {
    const distances = new Float32Array(points.length);
    for (let i = 1; i < points.length; i++) {
        distances[i] = distances[i - 1] + Math.hypot(
            points[i].x - points[i - 1].x,
            points[i].y - points[i - 1].y,
        );
    }
    return { distances, total: distances[distances.length - 1] };
}

function sampleBodyPath(points, metrics, distance) {
    const target = Math.max(0, Math.min(metrics.total, distance));
    let low = 1;
    let high = points.length - 1;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (metrics.distances[middle] < target) low = middle + 1;
        else high = middle;
    }
    const tailIndex = low;
    const headIndex = Math.max(0, tailIndex - 1);
    const span = Math.max(0.0001, metrics.distances[tailIndex] - metrics.distances[headIndex]);
    const mix = (target - metrics.distances[headIndex]) / span;
    const head = points[headIndex];
    const tail = points[tailIndex];
    return {
        x: head.x + (tail.x - head.x) * mix,
        y: head.y + (tail.y - head.y) * mix,
        angle: Math.atan2(head.y - tail.y, head.x - tail.x),
    };
}
function strokeBodyGradient(ctx, points, metrics, palette, width, alpha) {
    const tailIndex = points.length - 1;
    if (tailIndex < 1 || metrics.total <= 0) return;
    const chunkLength = Math.max(width * 4.5, metrics.total / 22);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;

    for (let tail = tailIndex; tail > 0;) {
        const targetDistance = Math.max(0, metrics.distances[tail] - chunkLength);
        let head = tail - 1;
        while (head > 0 && metrics.distances[head] > targetDistance) head--;
        const from = points[tail];
        const to = points[head];
        const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
        gradient.addColorStop(0, colorAt(palette, metrics.distances[tail] / metrics.total));
        gradient.addColorStop(1, colorAt(palette, metrics.distances[head] / metrics.total));
        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        for (let i = tail - 1; i >= head; i--) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        tail = head;
    }
}
export function drawSlitherSpecialBody(ctx, skinId, points, radius, phase = 0, boosting = false) {
    const skin = getSlitherSpecialSkin(skinId);
    if (!ctx || !skin || !Array.isArray(points) || points.length < 3 || radius <= 0) return;
    const pulse = 0.88 + Math.sin(phase * 0.72) * 0.12;
    const metrics = measureBodyPath(points);

    ctx.save();
    if (skin.id === 'aurora') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = '#49ffe4';
        ctx.shadowBlur = radius * (boosting ? 2.2 : 1.55);
        strokeBodyGradient(ctx, points, metrics, skin.bodyGradient, radius * 2.34, 0.24 * pulse);

        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        strokeBodyGradient(ctx, points, metrics, skin.bodyGradient, radius * 1.86, 0.97);

        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = '#d9fff7';
        ctx.shadowBlur = radius * 0.9;
        strokeBodyGradient(ctx, points, metrics, skin.coreGradient, radius * 0.38, 0.72 * pulse);
        ctx.shadowBlur = 0;
        strokeBodyGradient(ctx, points, metrics, ['#ffffff', '#aaffed', '#eadcff'], radius * 0.09, 0.7);
    } else if (skin.id === 'eclipse') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = '#ff572f';
        ctx.shadowBlur = radius * (boosting ? 2.35 : 1.45);
        strokeBodyGradient(ctx, points, metrics, ['#401122', '#ff4a34', '#ffb34f', '#551126'], radius * 2.25, 0.2 * pulse);

        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        strokeBodyGradient(ctx, points, metrics, skin.bodyGradient, radius * 1.92, 1);

        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = '#ff6a35';
        ctx.shadowBlur = radius * 1.05;
        strokeBodyGradient(ctx, points, metrics, skin.coreGradient, radius * 0.44, 0.93 * pulse);
        ctx.shadowColor = '#fff0b0';
        ctx.shadowBlur = radius * 0.45;
        strokeBodyGradient(ctx, points, metrics, ['#ff7440', '#fff3b8', '#ff8c37'], radius * 0.12, 0.84);
    }
    ctx.restore();
}

export function drawSlitherSpecialDetails(ctx, skinId, points, radius, phase = 0) {
    if (!ctx || !Array.isArray(points) || points.length < 3 || radius <= 0) return;
    const metrics = measureBodyPath(points);
    if (metrics.total <= radius * 2) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    if (skinId === 'aurora') {
        const spacing = radius * 4.8;
        let marker = 0;
        for (let distance = radius * 2.8; distance < metrics.total - radius * 1.5 && marker < 36; distance += spacing, marker++) {
            const point = sampleBodyPath(points, metrics, distance);
            const side = marker % 2 === 0 ? 1 : -1;
            const drift = Math.sin(phase * 0.8 + marker * 1.9) * radius * 0.14;
            const x = point.x + Math.sin(point.angle) * radius * (0.58 * side) + Math.cos(point.angle) * drift;
            const y = point.y - Math.cos(point.angle) * radius * (0.58 * side) + Math.sin(point.angle) * drift;
            const twinkle = 0.7 + Math.sin(phase + marker * 1.7) * 0.25;
            const starRadius = Math.max(1.1, radius * (marker % 3 === 0 ? 0.15 : 0.09));

            ctx.globalAlpha = twinkle;
            ctx.shadowColor = '#bffff0';
            ctx.shadowBlur = radius * 0.58;
            ctx.fillStyle = marker % 2 === 0 ? '#efffff' : '#d8c8ff';
            ctx.beginPath();
            ctx.arc(x, y, starRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.globalAlpha = twinkle * 0.5;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(0.7, radius * 0.055);
            ctx.beginPath();
            ctx.moveTo(x - starRadius * 2.4, y);
            ctx.lineTo(x + starRadius * 2.4, y);
            ctx.moveTo(x, y - starRadius * 2.4);
            ctx.lineTo(x, y + starRadius * 2.4);
            ctx.stroke();
        }
    } else if (skinId === 'eclipse') {
        const spacing = radius * 5.8;
        let marker = 0;
        for (let distance = radius * 3.2; distance < metrics.total - radius * 1.8 && marker < 28; distance += spacing, marker++) {
            const point = sampleBodyPath(points, metrics, distance);
            const pulse = 0.76 + Math.sin(phase * 0.75 + marker * 1.2) * 0.2;
            const sigilRadius = Math.max(2.5, radius * 0.5);

            ctx.save();
            ctx.translate(point.x, point.y);
            ctx.rotate(point.angle + Math.PI * 0.5);
            ctx.globalAlpha = pulse;
            ctx.shadowColor = '#ff7b3d';
            ctx.shadowBlur = radius * 0.72;
            ctx.strokeStyle = '#ffd67a';
            ctx.lineWidth = Math.max(1.15, radius * 0.09);
            ctx.beginPath();
            ctx.arc(0, 0, sigilRadius, -Math.PI * 0.73, Math.PI * 0.73);
            ctx.stroke();

            ctx.globalAlpha = pulse * 0.64;
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#ff5c35';
            ctx.lineWidth = Math.max(0.7, radius * 0.05);
            ctx.beginPath();
            ctx.arc(sigilRadius * 0.28, 0, sigilRadius * 0.64, -Math.PI * 0.68, Math.PI * 0.68);
            ctx.stroke();
            ctx.restore();
        }
    }

    ctx.restore();
}