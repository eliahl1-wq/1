// Original top-down materials, drawn once by the existing obstacle sprite cache.
function polygon(ctx, points, fill, stroke = null) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.7; ctx.stroke(); }
}

export function drawCraftedOutdoorProp(ctx, o) {
    if (!['rock', 'barrel'].includes(o.kind) || !(o.w >= 12 && o.h >= 12)
        || !Number.isFinite(o.w + o.h)) return false;
    ctx.save();
    if (o.kind === 'rock') {
        const hw = o.w / 2, hh = o.h / 2;
        const hue = Number.isFinite(o.hue) ? o.hue : 218;
        const point = (x, y) => [x * hw, y * hh];
        const outline = [[-.78,-.12],[-.52,-.68],[.08,-.75],[.58,-.48],[.76,.04],
            [.7,.28],[.38,.62],[-.22,.61],[-.64,.32]].map(([x,y]) => point(x,y));
        polygon(ctx, outline, `hsl(${hue}, 10%, 35%)`, '#343e3e');
        // Broad facets describe volume without a glossy blob or fine noise.
        polygon(ctx, [outline[0],outline[1],outline[2],point(.11,-.1),point(-.34,.08)], `hsl(${hue}, 9%, 51%)`);
        polygon(ctx, [outline[2],outline[3],outline[4],point(.25,.22),point(.11,-.1)], `hsl(${hue}, 10%, 44%)`);
        polygon(ctx, [outline[0],point(-.34,.08),point(.25,.22),outline[6],outline[7],outline[8]], `hsl(${hue}, 9%, 40%)`);
        ctx.strokeStyle = 'rgba(223,229,222,.24)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(...outline[0]); ctx.lineTo(...outline[1]); ctx.lineTo(...outline[2]); ctx.stroke();
        ctx.strokeStyle = 'rgba(28,36,33,.35)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(-hw * .22, -hh * .29);
        ctx.lineTo(-hw * .06, -hh * .12); ctx.lineTo(-hw * .12, hh * .04);
        ctx.lineTo(hw * .11, hh * .15); ctx.stroke();
        polygon(ctx, [point(-.49,.27),point(-.25,.18),point(-.15,.32),point(-.26,.45),point(-.43,.42)], 'rgba(81,111,64,.36)');
    } else {
        const r = Math.min(o.w, o.h) / 2 - 1;
        const fuel = o.variant === 'fuel', water = o.variant === 'water';
        const hue = fuel ? 7 : water ? 198 : Number.isFinite(o.hue) ? o.hue : 22;
        ctx.fillStyle = `hsl(${hue}, 34%, 29%)`; ctx.strokeStyle = '#2e3431'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = `hsl(${hue}, 40%, 40%)`;
        ctx.beginPath(); ctx.arc(-.8,-1,r*.86,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(219,227,213,.30)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(-.8,-1,r*.87,Math.PI*.92,Math.PI*1.9); ctx.stroke();
        ctx.strokeStyle = 'rgba(22,32,29,.38)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(-.8,-1,r*.72,0,Math.PI*2); ctx.stroke();
        // Pressed ribs and bungs are readable at game scale.
        ctx.strokeStyle = 'rgba(18,29,25,.21)'; ctx.lineWidth = 1;
        for (const y of [-.38,.38]) {
            ctx.beginPath(); ctx.moveTo(-r*.55,r*y); ctx.lineTo(r*.53,r*y); ctx.stroke();
        }
        for (const [x,y,size] of [[.33,-.35,.13],[-.28,.34,.065]]) {
            ctx.fillStyle = '#313b36'; ctx.strokeStyle = 'rgba(214,221,208,.36)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(r*x,r*y,r*size,0,Math.PI*2); ctx.fill(); ctx.stroke();
        }
        if (fuel) {
            polygon(ctx, [[0,-r*.35],[r*.31,r*.21],[-r*.31,r*.21]], '#dbc883', '#5d432d');
            ctx.fillStyle = '#60452f'; ctx.fillRect(-.8,-r*.13,1.6,r*.19); ctx.fillRect(-.8,r*.12,1.6,1.6);
        } else if (water) {
            ctx.fillStyle = 'rgba(206,226,226,.68)'; ctx.beginPath(); ctx.moveTo(0,-r*.31);
            ctx.bezierCurveTo(-r*.36,r*.06,-r*.25,r*.27,0,r*.27);
            ctx.bezierCurveTo(r*.25,r*.27,r*.36,r*.06,0,-r*.31); ctx.fill();
        } else {
            ctx.strokeStyle = 'rgba(229,215,185,.20)'; ctx.lineWidth = 1.1;
            ctx.beginPath(); ctx.moveTo(-r*.18,-r*.15); ctx.lineTo(r*.17,r*.16); ctx.stroke();
        }
    }
    ctx.restore(); return true;
}
