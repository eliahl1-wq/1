export const SLITHER_SPECIAL_SKINS = Object.freeze([
    Object.freeze({
        id: 'aurora',
        value: 'aurora',
        productId: 'slither:aurora',
        name: 'Aurora Veil',
        usdPrice: 2,
        description: 'A flowing indigo, cyan, mint, and violet body with drifting star-like highlights.',
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
        description: 'An obsidian-to-solar gradient marked with glowing golden crescent sigils.',
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

export function drawSlitherSpecialDetails(ctx, skinId, points, radius, phase = 0) {
    if (!ctx || !Array.isArray(points) || points.length < 3 || radius <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    if (skinId === 'aurora') {
        const step = Math.max(7, Math.ceil(points.length / 30));
        let marker = 0;
        for (let i = 4; i < points.length - 1; i += step, marker++) {
            const point = points[i];
            const next = points[Math.min(points.length - 1, i + 1)];
            const angle = Math.atan2(point.y - next.y, point.x - next.x);
            const side = marker % 2 === 0 ? 1 : -1;
            const x = point.x + Math.sin(angle) * radius * 0.28 * side;
            const y = point.y - Math.cos(angle) * radius * 0.28 * side;
            const twinkle = 0.72 + Math.sin(phase + i * 1.7) * 0.22;
            const starRadius = Math.max(1.1, radius * (i % 3 === 0 ? 0.16 : 0.11));

            ctx.globalAlpha = twinkle;
            ctx.shadowColor = '#d9fff2';
            ctx.shadowBlur = radius * 0.42;
            ctx.fillStyle = i % 2 === 0 ? '#efffff' : '#d8c8ff';
            ctx.beginPath();
            ctx.arc(x, y, starRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.globalAlpha = twinkle * 0.48;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(0.7, radius * 0.055);
            ctx.beginPath();
            ctx.moveTo(x - starRadius * 2.2, y);
            ctx.lineTo(x + starRadius * 2.2, y);
            ctx.moveTo(x, y - starRadius * 2.2);
            ctx.lineTo(x, y + starRadius * 2.2);
            ctx.stroke();
        }
    } else if (skinId === 'eclipse') {
        const step = Math.max(10, Math.ceil(points.length / 22));
        for (let i = 5; i < points.length - 1; i += step) {
            const point = points[i];
            const next = points[Math.min(points.length - 1, i + 1)];
            const angle = Math.atan2(point.y - next.y, point.x - next.x);
            const pulse = 0.78 + Math.sin(phase * 0.65 + i * 0.9) * 0.15;
            const sigilRadius = Math.max(2.2, radius * 0.38);

            ctx.save();
            ctx.translate(point.x, point.y);
            ctx.rotate(angle + Math.PI * 0.5);
            ctx.globalAlpha = pulse;
            ctx.shadowColor = '#ffb24f';
            ctx.shadowBlur = radius * 0.36;
            ctx.strokeStyle = '#ffd27a';
            ctx.lineWidth = Math.max(1.1, radius * 0.1);
            ctx.beginPath();
            ctx.arc(0, 0, sigilRadius, -Math.PI * 0.72, Math.PI * 0.72);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = pulse * 0.75;
            ctx.strokeStyle = '#ff8a45';
            ctx.lineWidth = Math.max(0.65, radius * 0.05);
            ctx.beginPath();
            ctx.arc(sigilRadius * 0.2, 0, sigilRadius * 0.58, -Math.PI * 0.67, Math.PI * 0.67);
            ctx.stroke();
            ctx.restore();
        }
    }

    ctx.restore();
}
