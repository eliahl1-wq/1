// Original procedural artwork shared by the real renderers and shop previews.
export const SIGNATURE_SKINS = Object.freeze([
    { id: 'prism', value: 'prism', productId: 'agar:prism', gameMode: 'agar', name: 'Prism Core', usdPrice: 2, baseColor: '#161333', colors: ['#161333', '#7855d6', '#cda4ff', '#64cfde', '#b792ff'], badgeGradient: 'linear-gradient(135deg, #161333, #9974ec, #77e1df)', description: 'A shattered amethyst geode with floating crystal spires, orbiting fragments and shifting pearlescent light deep inside its fractured shell.' },
    { id: 'warden', value: 'warden', productId: 'surviv:warden', gameMode: 'surviv', name: 'Copper Warden', usdPrice: 2, baseColor: '#18282e', colors: ['#18282e', '#e6ddd0', '#b76c45', '#f4bc86', '#bc7953'], badgeGradient: 'linear-gradient(135deg, #18282e, #bc7953, #eee2ce)', description: 'An artisan expedition outfit: hammered copper panels, ivory field cloth, a jade compass insignia and matching plated gloves.' },
]);

export function getSignatureSkin(value) {
    return SIGNATURE_SKINS.find(skin => skin.id === value || skin.productId === value) || null;
}

let motionPreference;
export function skinAnimationTime() {
    if (typeof window === 'undefined') return 0;
    motionPreference ||= window.matchMedia('(prefers-reduced-motion: reduce)');
    return motionPreference.matches ? 0 : performance.now() * 0.001;
}

function polygon(ctx, points, fill, stroke = null, width = 0.012) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
const polar = (angle, r) => [Math.cos(angle) * r, Math.sin(angle) * r];

// Only two bounded textures are cached. Fine facets never regenerate per cell/frame.
let prismShell;
let wardenSuit;
function texture(paint) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.translate(256, 256);
    ctx.scale(256, 256);
    paint(ctx);
    return canvas;
}

function paintPrismShell(ctx) {
    const base = ctx.createRadialGradient(-0.2, -0.3, 0, 0, 0, 1.15);
    base.addColorStop(0, '#44396b'); base.addColorStop(0.55, '#17142e'); base.addColorStop(1, '#080c1b');
    ctx.fillStyle = base; ctx.fillRect(-1, -1, 2, 2);
    const palette = ['#334366', '#505092', '#6153a4', '#8c72b9', '#287482', '#386380', '#453e77'];
    for (let i = 0; i < 24; i++) {
        const a = i * Math.PI / 12;
        const b = a + Math.PI / 12;
        const mid = a + 0.1;
        const inner = 0.64 + Math.sin(i * 2.3) * 0.07;
        polygon(ctx, [polar(a, 1.03), polar(b, 1.03), polar(mid, inner)], palette[i % 7], '#a3bdda55', 0.009);
        polygon(ctx, [polar(a, 1.03), polar(mid, inner), polar(a - 0.08, 0.75)], palette[(i + 3) % 7]);
        // Broken luminous fault-lines and detached inner crystal teeth.
        const tip = polar(mid + 0.035, inner - (i % 3 === 0 ? 0.17 : 0.07));
        polygon(ctx, [polar(a + 0.02, 0.79), polar(b - 0.045, 0.8), tip], i % 3 ? '#797bba' : '#87ced5', '#bedaf455', 0.006);
        ctx.strokeStyle = i % 3 ? '#a699ff80' : '#9dfbeac0'; ctx.lineWidth = 0.009;
        ctx.beginPath(); ctx.moveTo(...polar(a + 0.015, 0.97)); ctx.lineTo(...polar(a + 0.12, 0.83)); ctx.lineTo(...tip); ctx.stroke();
    }
    const well = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 0.66);
    well.addColorStop(0, '#6651a5'); well.addColorStop(0.6, '#211c46'); well.addColorStop(1, '#11112700');
    ctx.fillStyle = well; ctx.beginPath(); ctx.arc(0, 0, 0.67, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c0e6ff8f'; ctx.lineWidth = 0.013;
    ctx.beginPath(); ctx.arc(0, 0, 0.97, 0, Math.PI * 2); ctx.stroke();
    // Three uneven seams make the shell read as broken mineral, not a wheel.
    for (const [angle, length] of [[0.35, 0.34], [2.6, 0.27], [4.8, 0.42]]) {
        ctx.save(); ctx.rotate(angle);
        polygon(ctx, [[0.99,-0.026],[0.85,0.014],[0.76,-0.033],[1-length,0.024],[0.77,0.005],[0.86,0.051],[1.02,0.02]], '#0b1021');
        ctx.strokeStyle = '#9cf4e5'; ctx.lineWidth = 0.008;
        ctx.beginPath();ctx.moveTo(0.98,-0.035);ctx.lineTo(0.85,0.006);ctx.lineTo(0.76,-0.041);ctx.stroke();
        ctx.restore();
    }
    // Embedded mineral flecks are deterministic and baked into the texture.
    for (let i = 0; i < 38; i++) {
        const a = i * 2.39996;
        const r = 0.77 + ((i * 13) % 19) / 100;
        const [x,y] = polar(a,r);
        polygon(ctx, [[x-0.011,y],[x,y-0.018],[x+0.016,y+0.004]], i % 4 ? '#c0b8e85a' : '#acffdfba');
    }
}

function crystal(ctx, x, y, size, angle) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(size, size);
    polygon(ctx, [[0,-1], [0.48,-0.24], [0.33,0.59], [-0.04,1], [-0.45,0.31], [-0.38,-0.4]], '#8070ce', '#ddd6ff', 0.025);
    polygon(ctx, [[0,-1], [0.08,-0.17], [-0.04,1], [-0.45,0.31], [-0.38,-0.4]], '#8f90e2');
    polygon(ctx, [[0,-1], [0.48,-0.24], [0.08,-0.17]], '#f5efff');
    polygon(ctx, [[0.08,-0.17], [0.48,-0.24], [0.33,0.59], [-0.04,1]], '#534a95');
    polygon(ctx, [[0.08,-0.17], [-0.38,-0.4], [0,-1]], '#b9fff0');
    ctx.strokeStyle = '#f4ecff'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(0,-0.88); ctx.lineTo(0.08,-0.17); ctx.lineTo(-0.04,0.84); ctx.stroke();
    ctx.restore();
}

// Caller clips to the organic boundary, including split-cell deformation.
export function drawPrismSkin(ctx, x, y, radius) {
    prismShell ||= texture(paintPrismShell);
    const t = skinAnimationTime();
    ctx.save(); ctx.translate(x,y); ctx.scale(radius,radius);
    ctx.drawImage(prismShell, -1,-1,2,2);
    const breathe = 0.75 + Math.sin(t * 1.3) * 0.13;
    const halo = ctx.createRadialGradient(0,0,0.04,0,0,0.56);
    halo.addColorStop(0, `rgba(176,142,255,${breathe})`); halo.addColorStop(0.55, '#7764d955'); halo.addColorStop(1, '#6f58c900');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0,0,0.56,0,Math.PI*2); ctx.fill();
    // Refraction fans shift beneath the solid crystals, with no external halo.
    ctx.save(); ctx.rotate(Math.sin(t * 0.24) * 0.32);
    for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 0.4 + 0.23;
        const fan = ctx.createLinearGradient(0,0,...polar(a,0.73));
        fan.addColorStop(0,'#9cefd829'); fan.addColorStop(0.6,'#b29cf51b'); fan.addColorStop(1,'#718fe800');
        polygon(ctx, [[-0.02,0.01],polar(a-0.14,0.76),polar(a+0.11,0.76)],fan);
    }
    ctx.restore();
    ctx.save(); ctx.rotate(t * 0.1);
    ctx.strokeStyle = '#c7b7ff70'; ctx.lineWidth = 0.008;
    for (let i=0;i<3;i++) { const a=i*Math.PI*2/3; ctx.beginPath(); ctx.ellipse(0,0,0.55,0.37,a,a+0.15,a+1.75); ctx.stroke(); }
    if (radius >= 24) for (let i=0;i<6;i++) {
        const a=i*Math.PI/3; const [sx,sy]=polar(a,0.5);
        crystal(ctx,sx,sy,0.085+(i%2)*0.025,a+0.4);
    }
    ctx.restore();
    crystal(ctx,-0.17,0.035,0.29,-0.42);
    crystal(ctx,0.2,0.085,0.26,0.53);
    crystal(ctx,0,-0.065+Math.sin(t*1.1)*0.022,0.43,0.1);
    // A moving specular seam gives the central spire a glass-like surface.
    ctx.save();ctx.globalAlpha=0.2+Math.max(0,Math.sin(t*0.8))*0.35;
    polygon(ctx,[[-0.025,-0.46],[0.034,-0.15],[0.01,0.32],[-0.006,-0.1]],'#ffffff');
    ctx.restore();
    // Sparse, slow glints; no per-frame particles or unbounded allocations.
    for(let i=0;i<5;i++) {
        const a=i*2.4; const [sx,sy]=polar(a,0.72+(i%2)*0.12);
        const s=0.009+Math.max(0,Math.sin(t*0.9+i*1.8))*0.02;
        polygon(ctx,[[sx-s,sy],[sx,sy-s*2.4],[sx+s,sy],[sx,sy+s*2.4]],'#ddfff3');
    }
    ctx.restore();
}

function paintWardenSuit(ctx) {
    ctx.fillStyle='#14272d';ctx.fillRect(-1,-1,2,2);
    // Woven field cloth is cached, so tiny weave lines cost nothing per frame.
    ctx.lineWidth=0.006;ctx.strokeStyle='#b1d5c414';
    for(let i=-24;i<=24;i++) {
        const p=i/24;ctx.beginPath();ctx.moveTo(-1,p);ctx.lineTo(1,p+0.28);ctx.moveTo(p,-1);ctx.lineTo(p+0.2,1);ctx.stroke();
    }
    // A recessed copper perimeter, interrupted by the two ivory shoulder panels.
    const copper=ctx.createLinearGradient(-1,-1,0.8,1);
    copper.addColorStop(0,'#f4d2a1');copper.addColorStop(0.38,'#b97848');copper.addColorStop(0.7,'#71412d');copper.addColorStop(1,'#dc9a62');
    ctx.strokeStyle=copper;ctx.lineWidth=0.19;ctx.beginPath();ctx.arc(0,0,0.82,0,Math.PI*2);ctx.stroke();
    for(const side of [-1,1]) {
        polygon(ctx,[[-0.46,side*0.34],[-0.23,side*0.81],[0.28,side*0.81],[0.55,side*0.54],[0.23,side*0.36]],'#e9e1cf','#101d25',0.045);
        ctx.strokeStyle='#fff9e6';ctx.lineWidth=0.025;ctx.beginPath();ctx.moveTo(-0.22,side*0.74);ctx.lineTo(0.22,side*0.74);ctx.lineTo(0.42,side*0.55);ctx.stroke();
        polygon(ctx,[[-0.3,side*0.36],[-0.2,side*0.61],[-0.09,side*0.64],[0.02,side*0.36]],'#c18354');
        for(let i=0;i<3;i++) {ctx.fillStyle='#395454';ctx.fillRect(0.17+i*0.09,side*0.52-0.025,0.045,0.09);}
    }
    // Central stitched placket and hexagonal jade insignia, not an equipment icon.
    polygon(ctx,[[-0.72,-0.31],[-0.46,-0.45],[0.56,-0.26],[0.7,0],[0.56,0.26],[-0.46,0.45],[-0.72,0.31]],'#243d40','#091a20',0.035);
    ctx.strokeStyle='#c69464';ctx.lineWidth=0.028;ctx.beginPath();ctx.moveTo(-0.65,-0.29);ctx.lineTo(-0.32,-0.36);ctx.lineTo(0.51,-0.22);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-0.65,0.29);ctx.lineTo(-0.32,0.36);ctx.lineTo(0.51,0.22);ctx.stroke();
    polygon(ctx,[[-0.27,-0.26],[0.02,-0.37],[0.28,-0.2],[0.28,0.2],[0.02,0.37],[-0.27,0.26]],copper,'#091b24',0.035);
    polygon(ctx,[[-0.19,-0.17],[0.01,-0.26],[0.2,-0.13],[0.2,0.13],[0.01,0.26],[-0.19,0.17]],'#122f39','#eccda1',0.015);
    polygon(ctx,[[-0.1,0],[0.015,-0.19],[0.12,0],[0.015,0.19]],'#76d2c4');
    polygon(ctx,[[-0.1,0],[0.015,-0.19],[0.015,0.19]],'#d0f0d8');
    for(const side of [-1,1]) for(let i=0;i<3;i++) {ctx.fillStyle='#a4b6a5';ctx.fillRect(-0.58+i*0.09,side*0.15,0.04,0.025);}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.fillStyle='#f4c996';ctx.beginPath();ctx.arc(...polar(a,0.82),0.026,0,Math.PI*2);ctx.fill();}
    // Asymmetric hammered copper shoulder; ivory opposite panel stays visible.
    polygon(ctx,[[-0.62,-0.43],[-0.39,-0.83],[0.06,-0.9],[0.44,-0.72],[0.53,-0.49],[0.12,-0.39],[-0.2,-0.5]],copper,'#14252b',0.045);
    polygon(ctx,[[-0.36,-0.75],[0.06,-0.81],[0.34,-0.67],[0.14,-0.55],[-0.24,-0.62]],'#d8aa76');
    ctx.strokeStyle='#ffdfb1';ctx.lineWidth=0.025;ctx.beginPath();ctx.moveTo(-0.43,-0.68);ctx.lineTo(-0.34,-0.78);ctx.lineTo(0.06,-0.85);ctx.lineTo(0.39,-0.7);ctx.stroke();
    for(let i=0;i<11;i++) {
        const x=-0.27+(i%4)*0.14;const y=-0.7+Math.floor(i/4)*0.047;
        ctx.fillStyle=i%2?'#885d3c38':'#fff2c936';ctx.beginPath();ctx.ellipse(x,y,0.025,0.012,0.4,0,Math.PI*2);ctx.fill();
    }
    // A directional compass crest is deliberately separate from equipment tiers.
    ctx.strokeStyle='#94dfc6';ctx.lineWidth=0.016;
    for(let i=0;i<4;i++) { const a=i*Math.PI/2;ctx.beginPath();ctx.moveTo(...polar(a,0.13));ctx.lineTo(...polar(a,0.22));ctx.stroke(); }
    polygon(ctx,[[0,-0.2],[0.072,-0.04],[0,0.15],[-0.072,-0.04]],'#b4f3d5','#122f39',0.014);
    // Small stitched rank bars on the ivory sleeve remain legible when zoomed out.
    ctx.strokeStyle='#8f553a';ctx.lineWidth=0.042;
    for(let i=0;i<2;i++) {const y=0.56+i*0.1;ctx.beginPath();ctx.moveTo(-0.1,y);ctx.lineTo(0.03,y+0.055);ctx.lineTo(0.16,y);ctx.stroke();}
}

export function drawWardenOutfit(ctx, radius) {
    wardenSuit ||= texture(paintWardenSuit);
    ctx.save();ctx.beginPath();ctx.arc(0,0,radius-1.5,0,Math.PI*2);ctx.clip();
    ctx.drawImage(wardenSuit,-radius,-radius,radius*2,radius*2);ctx.restore();
}

export function drawWardenGlove(ctx, x, y, radius) {
    ctx.save();ctx.translate(x,y);ctx.scale(radius,radius);
    ctx.beginPath();ctx.arc(0,0,0.82,0,Math.PI*2);ctx.clip();
    polygon(ctx,[[-0.75,-0.7],[-0.3,-0.8],[-0.15,0.8],[-0.62,0.8]],'#b47a50');
    polygon(ctx,[[-0.15,-0.53],[0.46,-0.55],[0.71,-0.19],[0.7,0.33],[0.31,0.56],[-0.15,0.43]],'#d09e70','#654932',0.08);
    ctx.fillStyle='#283e42';ctx.fillRect(0.02,-0.36,0.36,0.65);
    ctx.fillStyle='#9fe3d4';ctx.fillRect(0.08,-0.31,0.09,0.22);ctx.fillRect(0.24,-0.31,0.09,0.22);
    // Three separate knuckle plates, stitched cuff and a restrained edge glint.
    for(let i=0;i<3;i++) {
        const y=-0.33+i*0.24;
        polygon(ctx,[[0.36,y],[0.62,y+0.02],[0.65,y+0.16],[0.37,y+0.17]],i%2?'#bd814f':'#e4ba83','#644831',0.025);
    }
    ctx.strokeStyle='#f3d9a9';ctx.lineWidth=0.034;
    ctx.beginPath();ctx.moveTo(-0.1,-0.51);ctx.lineTo(0.43,-0.52);ctx.lineTo(0.61,-0.32);ctx.stroke();
    for(let i=0;i<4;i++) {ctx.fillStyle='#f1dab3';ctx.fillRect(-0.57,-0.43+i*0.24,0.09,0.04);}
    ctx.restore();
}
