import { skinAnimationTime } from './signatureSkins.js';

export const SLITHER_SPECIAL_SKINS = Object.freeze([
    Object.freeze({
        id: 'leviathan', value: 'leviathan', productId: 'slither:leviathan',
        name: 'Leviathan', usdPrice: 2, baseColor: '#123b43',
        description: 'An abyssal jade dragon with overlapping scales, a gilded crown, amber slit eyes and pearl gills. A turquoise pulse runs down its crest while boosting.',
        bodyGradient: ['#071e2b', '#15404e', '#24665e', '#123946'],
        colors: ['#102e3c', '#216c75', '#49a69a', '#f0cc7b', '#64b9aa'],
        badgeGradient: 'linear-gradient(135deg, #102e3c, #49a69a 60%, #f0cc7b)',
    }),
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
    if (skin.id === 'leviathan') {
        strokeBodyGradient(ctx, points, metrics, skin.bodyGradient, radius * 1.9, 1);
        strokeBodyGradient(ctx, points, metrics, ['#1a7180', '#48bbaa', '#235162'], radius * 1.22, 0.72);
        strokeBodyGradient(ctx, points, metrics, ['#cbad6f', '#ebd8a0', '#5e865f'], radius * 0.17, boosting ? 0.95 : 0.58);
    } else if (skin.id === 'aurora') {
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

export function drawSlitherSpecialDetails(ctx, skinId, points, radius, phase = 0, boosting = false) {
    if (!ctx || !Array.isArray(points) || points.length < 3 || radius <= 0) return;
    const metrics = measureBodyPath(points);
    if (metrics.total <= radius * 2) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    if (skinId === 'leviathan') {
        ctx.globalCompositeOperation = 'source-over';
        const time = skinAnimationTime();
        // Arclength spacing keeps scales consistent as the body bends and grows.
        // The count is bounded independently of snake length.
        let marker = 0;
        for (let distance = Math.max(radius * 2.6, metrics.total - radius); distance > radius * 2.2 && marker < 100; distance -= Math.max(radius * 1.18, metrics.total / 100), marker++) {
            const point = sampleBodyPath(points, metrics, distance);
            ctx.save();
            ctx.translate(point.x, point.y);
            ctx.rotate(point.angle);
            // Paired, overlapping scale plates with a highlighted leading edge.
            for (const side of [-1, 1]) {
                ctx.fillStyle = marker % 2 ? '#246e70' : '#328c80';
                ctx.strokeStyle = '#0a303e'; ctx.lineWidth = radius * 0.08;
                ctx.beginPath();
                ctx.moveTo(radius * 0.62, side * radius * 0.16);
                ctx.quadraticCurveTo(radius * 0.35, side * radius * 0.79, -radius * 0.36, side * radius * 0.9);
                ctx.lineTo(-radius * 0.7, side * radius * 0.39);
                ctx.lineTo(-radius * 0.15, 0);
                ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = '#a9d6ac'; ctx.lineWidth = radius * 0.035;
                ctx.beginPath();ctx.moveTo(radius*0.42,side*radius*0.25);ctx.quadraticCurveTo(radius*0.15,side*radius*0.62,-radius*0.32,side*radius*0.73);ctx.stroke();
                // Bioluminescent gills stay inside the true body boundary.
                ctx.strokeStyle = `rgba(131,251,222,${0.38+Math.sin(time*1.4-marker*0.6)*0.18})`;
                ctx.lineWidth = radius * 0.055; ctx.beginPath();ctx.moveTo(-radius*0.1,side*radius*0.43);ctx.lineTo(-radius*0.37,side*radius*0.59);ctx.stroke();
            }
            // Gold dorsal blade, split into a pale and a shaded facet.
            ctx.fillStyle = '#d6b36c'; ctx.strokeStyle='#443f27';ctx.lineWidth=radius*0.045;
            ctx.beginPath();
            ctx.moveTo(radius*0.63,0);ctx.lineTo(-radius*0.13,-radius*0.28);ctx.lineTo(-radius*0.5,0);ctx.lineTo(-radius*0.13,radius*0.28);ctx.closePath();ctx.fill();ctx.stroke();
            ctx.fillStyle='#fbdf9d';ctx.beginPath();ctx.moveTo(radius*0.56,0);ctx.lineTo(-radius*0.13,-radius*0.24);ctx.lineTo(-radius*0.43,0);ctx.closePath();ctx.fill();
            // Inlaid pearls become a traveling crest pulse while boosting.
            const crestLight = boosting ? 0.55 + 0.4 * Math.pow(Math.max(0, Math.cos(time * 5 - distance / radius * 0.48)), 3) : 0.36;
            ctx.fillStyle=`rgba(172,255,226,${crestLight})`;
            ctx.beginPath();ctx.ellipse(-radius*0.04,0,radius*0.18,radius*0.11,0,0,Math.PI*2);ctx.fill();
            ctx.restore();
        }
        // A distinct head crown behind the existing eyes; no false horns/hitbox.
        const head=points[0]; const next=points[1];
        ctx.save();ctx.translate(head.x,head.y);ctx.rotate(Math.atan2(head.y-next.y,head.x-next.x));
        ctx.fillStyle='#163d43';ctx.strokeStyle='#d9bc78';ctx.lineWidth=radius*0.06;
        ctx.beginPath();ctx.moveTo(radius*0.1,0);ctx.lineTo(-radius*0.3,-radius*0.68);ctx.lineTo(-radius*1.05,-radius*0.48);ctx.lineTo(-radius*1.6,0);ctx.lineTo(-radius*1.05,radius*0.48);ctx.lineTo(-radius*0.3,radius*0.68);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.fillStyle='#f4d993';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-radius*0.8,-radius*0.18);ctx.lineTo(-radius*1.42,0);ctx.lineTo(-radius*0.8,radius*0.18);ctx.closePath();ctx.fill();
        ctx.fillStyle='#a5ffde';ctx.beginPath();ctx.ellipse(-radius*0.74,0,radius*0.19,radius*0.1,0,0,Math.PI*2);ctx.fill();
        // Twin swept crown plates and engraved gills stay within the head/neck.
        for(const side of [-1,1]) {
            ctx.fillStyle='#b28b50';ctx.strokeStyle='#233b39';ctx.lineWidth=radius*0.045;
            ctx.beginPath();ctx.moveTo(-radius*0.18,side*radius*0.57);ctx.lineTo(-radius*0.66,side*radius*0.83);ctx.lineTo(-radius*1.4,side*radius*0.51);ctx.lineTo(-radius*0.61,side*radius*0.51);ctx.closePath();ctx.fill();ctx.stroke();
            ctx.strokeStyle='#ffe2a4';ctx.lineWidth=radius*0.05;ctx.beginPath();ctx.moveTo(-radius*0.3,side*radius*0.59);ctx.lineTo(-radius*0.69,side*radius*0.75);ctx.lineTo(-radius*1.2,side*radius*0.53);ctx.stroke();
            for(let i=0;i<3;i++) {
                ctx.strokeStyle=i%2?'#78dcbf':'#e9e2b8';ctx.lineWidth=radius*0.055;
                ctx.beginPath();ctx.moveTo(-radius*(1.3+i*0.25),side*radius*0.28);ctx.lineTo(-radius*(1.4+i*0.25),side*radius*0.64);ctx.stroke();
            }
        }
        ctx.restore();
    } else if (skinId === 'aurora') {
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

// Shared head art: the live renderer and the shop use the same eye geometry.
export function drawLeviathanEyes(ctx, x, y, radius, angle) {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    for(const side of [-1,1]) {
        ctx.save();ctx.translate(radius*0.26,side*radius*0.4);ctx.rotate(side*0.16);
        ctx.fillStyle='#12323b';ctx.strokeStyle='#dcc286';ctx.lineWidth=radius*0.055;
        ctx.beginPath();ctx.ellipse(0,0,radius*0.4,radius*0.29,0,0,Math.PI*2);ctx.fill();ctx.stroke();
        const iris=ctx.createLinearGradient(-radius*0.22,-radius*0.2,radius*0.2,radius*0.2);
        iris.addColorStop(0,'#fff1b7');iris.addColorStop(0.55,'#eac66f');iris.addColorStop(1,'#bc7e35');
        ctx.fillStyle=iris;ctx.beginPath();ctx.ellipse(radius*0.04,0,radius*0.29,radius*0.22,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#0a2832';ctx.beginPath();ctx.ellipse(radius*0.09,0,radius*0.055,radius*0.18,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#faffec';ctx.beginPath();ctx.arc(-radius*0.035,-radius*0.08,radius*0.06,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }
    // Two discreet nostrils and a thin jade bridge distinguish the face.
    ctx.fillStyle='#071c24';
    for(const side of [-1,1]) {ctx.beginPath();ctx.ellipse(radius*0.76,side*radius*0.16,radius*0.07,radius*0.035,side*0.35,0,Math.PI*2);ctx.fill();}
    ctx.restore();
}
