// Original top-down artwork. All coordinates stay inside the authored footprint.
// These functions are baked by the renderer's existing bounded sprite caches.
const rect = (c, x, y, w, h, color, radius = 0, edge = null) => {
    c.fillStyle = color;
    c.beginPath(); c.roundRect(x, y, Math.max(.1, w), Math.max(.1, h), Math.max(0, Math.min(radius, w / 2, h / 2))); c.fill();
    if (edge) { c.strokeStyle = edge; c.lineWidth = 1.4; c.stroke(); }
};
const line = (c, x, y, xx, yy, color, width = 1) => {
    c.strokeStyle = color; c.lineWidth = width;
    c.beginPath(); c.moveTo(x, y); c.lineTo(xx, yy); c.stroke();
};
const dot = (c, x, y, r, color) => { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
const wood = (c, w, h) => {
    for (let i = 1; i < 4; i++) {
        const y = -h / 2 + h * i / 4;
        line(c, -w / 2 + 5, y, w / 2 - 5, y, 'rgba(43,29,19,.22)');
        line(c, -w / 2 + 6, y + 1, w / 2 - 6, y + 1, 'rgba(244,211,161,.14)');
    }
};

export function drawCraftedFurniture(c, o, variant) {
    const beds = ['bed', 'hospitalBed', 'bunkBed'];
    const seating = ['sofa', 'armchair', 'entryBench', 'prisonBench'];
    const cabinets = ['dresser', 'cabinet', 'locker', 'medicalCabinet', 'toolCabinet', 'ammoLocker', 'wardrobe', 'sideboard'];
    const tables = ['coffeeTable', 'nightstand', 'table', 'desk', 'workbench'];
    if (![...beds, ...seating, ...cabinets, ...tables].includes(variant)) return false;
    c.save();
    // One consistent local orientation; rotate the drawing, never its hitbox.
    const vertical = o.h > o.w;
    if (vertical) c.rotate(Math.PI / 2);
    const w = Math.max(o.w, o.h), h = Math.min(o.w, o.h), x = -w / 2, y = -h / 2;
    const unit = Math.min(1, h / 32);
    const metal = ['hospitalBed', 'bunkBed', 'prisonBench', 'locker', 'medicalCabinet', 'toolCabinet', 'ammoLocker', 'workbench'].includes(variant);
    const edge = metal ? '#29393b' : '#3b2d25';
    rect(c, x + 1, y + 3, w - 2, h - 4, edge, 3);
    if (beds.includes(variant)) {
        rect(c, x + 2, y + 2, w - 4, h - 6, metal ? '#a4b5b2' : '#94704e', 3, edge);
        rect(c, x + 7, y + 5, w - 14, h - 12, '#dedcd1', 4, '#a6aaa1');
        const colors = ['#708a8e', '#8a7972', '#73836d'];
        const color = variant === 'hospitalBed' ? '#a6c1bd' : variant === 'bunkBed' ? '#737f78' : colors[Math.abs(Math.floor((o.x || 0) * .13 + (o.y || 0) * .17)) % 3];
        rect(c, x + w * .32, y + 5, w * .68 - 7, h - 12, color, 3);
        rect(c, x + w * .32, y + 5, Math.max(4, w * .08), h - 12, '#b5c2b8', 1);
        const count = h > 58 ? 2 : 1;
        for (let i = 0; i < count; i++) {
            const ph = (h - 16) / count - 2;
            rect(c, x + 10, y + 8 + i * (ph + 3), w * .19, ph, '#f1eadb', 4, '#c2c0b6');
            line(c, x + 13, y + 11 + i * (ph + 3), x + w * .19 + 6, y + 11 + i * (ph + 3), '#fff7e9');
        }
        for (const offset of [.53, .77]) line(c, x + w * offset, y + 9, x + w * offset + 2, -y - 11, 'rgba(28,50,53,.14)');
        rect(c, x + 1, y + 1, 5 * unit, h - 4, metal ? '#a7b9b7' : '#674832', 1, edge);
        rect(c, -x - 6 * unit, y + 1, 4 * unit, h - 4, metal ? '#8eaaa9' : '#78563b', 1);
        if (metal) for (const yy of [y + 2, -y - 5]) line(c, x + 6, yy, -x - 6, yy, '#d1dcda', 2);
        if (variant === 'bunkBed') for (let i = 0; i < 3; i++) line(c, x + w * .63 + i * 6, -y - 7, x + w * .63 + i * 6, -y - 1, '#cfcebc', 2);
    } else if (seating.includes(variant)) {
        const soft = variant === 'sofa' || variant === 'armchair';
        if (soft) {
            rect(c, x + 2, y + 1, w - 4, h - 5, '#3e5752', 5, '#273c37');
            rect(c, x + 7, y + 3, w - 14, h * .25, '#7c9585', 3);
            const count = variant === 'armchair' ? 1 : w > 85 ? 3 : 2;
            const cw = (w - 18) / count;
            for (let i = 0; i < count; i++) {
                rect(c, x + 9 + i * cw, y + h * .31, cw - 2, h * .53, '#697f71', 3, '#425d51');
                line(c, x + 12 + i * cw, y + h * .36, x + 9 + (i + 1) * cw - 5, y + h * .36, '#95a58f');
            }
            for (const xx of [x + 2, -x - 8]) rect(c, xx, y + 6, 6, h - 13, '#8a9c87', 3, '#4a6254');
            if (w > 65) { rect(c, x + 13, y + h * .38, 12 * unit, 12 * unit, '#c3ad7b', 3, '#8c805c'); }
        } else {
            rect(c, x + 4, y + 3, w - 8, h - 8, metal ? '#728688' : '#a27b4d', 2, edge);
            for (let i = 1; i <= 2; i++) line(c, x + 5, y + 3 + (h - 8) * i / 3, -x - 5, y + 3 + (h - 8) * i / 3, metal ? '#526b6e' : '#705231', 1.5);
            for (const xx of [x + 8, -x - 8]) for (const yy of [y + 6, -y - 9]) dot(c, xx, yy, 1.3, metal ? '#d7e2d9' : '#d3b481');
        }
    } else if (cabinets.includes(variant)) {
        const color = variant === 'medicalCabinet' ? '#c7d3ca' : variant === 'ammoLocker' ? '#6e7c57' : metal ? '#74888a' : '#a07a50';
        rect(c, x + 1, y + 1, w - 2, h - 5, color, 2, edge);
        const bays = w > 85 ? 3 : 2;
        const bw = (w - 10) / bays;
        for (let i = 0; i < bays; i++) {
            const xx = x + 5 + i * bw;
            rect(c, xx, y + 5, bw - 3, h - 14, color, 1, metal ? '#516c6d' : '#785736');
            line(c, xx + 4, -y - 12, xx + Math.min(bw - 6, 13), -y - 12, '#2d3835', 2.5);
            line(c, xx + 4, -y - 13, xx + Math.min(bw - 6, 13), -y - 13, '#d1c19b', 1);
            if (metal) for (let j = 0; j < 3; j++) line(c, xx + 4, y + 8 + j * 3, xx + bw - 7, y + 8 + j * 3, '#4e6565');
        }
        if (variant === 'medicalCabinet') { rect(c, -5, -2, 10, 4, '#9e4540'); rect(c, -2, -5, 4, 10, '#9e4540'); }
    } else {
        rect(c, x + 1, y + 1, w - 2, h - 5, '#a17c51', 3, edge);
        wood(c, w - 3, h - 7);
        line(c, x + 4, y + 3, -x - 4, y + 3, '#cfb384', 1.5);
        if (variant === 'desk' || variant === 'workbench') {
            rect(c, x + 8, y + 7, w * .3, h - 18, variant === 'desk' ? '#d5cfad' : '#405d5b', 1, '#78785f');
            for (let i = 0; i < 3; i++) line(c, x + 11, y + 10 + i * 4, x + w * .29, y + 10 + i * 4, variant === 'desk' ? '#9eaa9d' : '#8aa79c');
            line(c, w * .18, -h * .17, w * .31, h * .12, '#374343', 3);
            dot(c, w * .28, -h * .15, 3, '#bba377');
        } else if (w > 35 && h > 25) {
            rect(c, -w * .25, -h * .2, w * .25, h * .35, '#596e71', 1, '#394d50');
            line(c, -w * .22, -h * .18, -w * .22, h * .1, '#bdc2aa');
            dot(c, w * .23, h * .07, Math.min(5, h * .13), '#d8c9a8');
            dot(c, w * .23, h * .07, Math.min(3, h * .08), '#584437');
        }
    }
    c.restore();
    return true;
}

export function drawRoofCourses(c, w, h, variant) {
    const metal = ['warehouse', 'ironworks', 'lodge', 'snow-lab', 'barn'].includes(variant);
    const stepY = metal ? 64 : 18;
    const stepX = metal ? 34 : 28;
    c.save(); c.beginPath(); c.rect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10); c.clip();
    for (let row = 0, y = -h / 2; y < h / 2; row++, y += stepY) {
        line(c, -w / 2, y + stepY - 2, w / 2, y + stepY - 2, 'rgba(12,22,25,.24)', 1.2);
        for (let x = -w / 2 - stepX + (metal ? 0 : row % 2 * stepX / 2); x < w / 2; x += stepX) {
            const tint = (row * 7 + Math.floor(x / stepX) * 3) % 5;
            rect(c, x + 1, y + 1, stepX - 2, stepY - 4, tint < 2 ? 'rgba(244,226,184,.045)' : 'rgba(10,24,28,.035)');
            line(c, x, y + 1, x, y + stepY - 2, 'rgba(12,21,24,.22)');
            line(c, x + 2, y + 2, x + stepX - 2, y + 2, 'rgba(235,234,208,.13)');
            if (metal) dot(c, x + 4, y + 7, 1, '#9faeaa');
        }
    }
    c.restore();
}

// Scan orthogonal outlines into roof wings. Each wing gets a hip/ridge instead
// of putting one rectangular roof over an L/T building's missing corners.
export function drawRoofWingRelief(c, footprint) {
    const levels = [...new Set(footprint.map(p => p.y))].sort((a, b) => a - b);
    const face = (points, color) => {
        c.beginPath(); c.moveTo(...points[0]);
        for (const p of points.slice(1)) c.lineTo(...p);
        c.closePath(); c.fillStyle = color; c.fill();
    };
    c.save();
    for (let row = 1; row < levels.length; row++) {
        const top = levels[row - 1], bottom = levels[row], mid = (top + bottom) / 2;
        const crossings = [];
        for (let i = 0; i < footprint.length; i++) {
            const a = footprint[i], b = footprint[(i + 1) % footprint.length];
            if ((a.y > mid) !== (b.y > mid)) crossings.push(a.x + (mid - a.y) * (b.x - a.x) / (b.y - a.y));
        }
        crossings.sort((a, b) => a - b);
        for (let i = 0; i + 1 < crossings.length; i += 2) {
            const left = crossings[i], right = crossings[i + 1];
            const hip = Math.min((bottom - top) * .5, (right - left) * .28);
            const r1 = [left + hip, mid], r2 = [right - hip, mid];
            face([[left, top], [right, top], r2, r1], 'rgba(239,245,212,.10)');
            face([[left, bottom], [right, bottom], r2, r1], 'rgba(8,18,24,.14)');
            face([[right, top], [right, bottom], r2], 'rgba(8,18,24,.22)');
            line(c, ...r1, ...r2, 'rgba(19,29,27,.55)', 4);
            line(c, r1[0], mid - 2, r2[0], mid - 2, 'rgba(228,235,213,.30)', 1.5);
            for (const [corner, ridge] of [[[left, top], r1], [[left, bottom], r1], [[right, top], r2], [[right, bottom], r2]]) {
                line(c, ...corner, ...ridge, 'rgba(20,30,29,.28)', 1.5);
            }
        }
    }
    c.restore();
}

export function drawInteriorAccessories(c, o, variant) {
    const w = o.w, h = o.h, hw = w / 2, hh = h / 2;
    if (Math.min(w, h) < 24) return;
    c.save();
    if (['bookshelf', 'displayShelf', 'storageShelf'].includes(variant)) {
        for (let i = 0; i < 5; i++) {
            if (w >= h) line(c, -hw + 9 + i * (w - 18) / 5, -hh + 10, -hw + 13 + i * (w - 18) / 5, -hh + 10, '#c9bf9f', 2);
            else line(c, -hw + 9, -hh + 9 + i * (h - 18) / 5, -hw + 9, -hh + 13 + i * (h - 18) / 5, '#c9bf9f', 2);
        }
    } else if (variant === 'diningTable') {
        for (const side of [-1, 1]) {
            dot(c, side * w * .16, 0, Math.min(w, h) * .12, '#d9d3b9');
            dot(c, side * w * .16, 0, Math.min(w, h) * .07, '#bdbba7');
        }
    } else if (variant === 'kitchenCounter') {
        const horizontal = w >= h;
        const x = horizontal ? -w * .25 : 0, y = horizontal ? 0 : -h * .25;
        line(c, x - 3, y - 4, x - 3, y - 11, '#d9ded5', 2.5);
        line(c, x - 3, y - 11, x + 3, y - 11, '#d9ded5', 2.5);
        dot(c, x, y + 2, 1.7, '#a9b9b4');
    } else if (variant === 'labBench') {
        const horizontal = w >= h;
        for (let i = 0; i < 3; i++) {
            const x = horizontal ? w * (.05 + i * .12) : w * .16;
            const y = horizontal ? 0 : h * (-.16 + i * .16);
            c.strokeStyle = '#6b918c'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 4.4, 0, Math.PI * 2); c.stroke();
            line(c, x - 1, y - 2, x - 1, y + 1, '#e4f3dc');
        }
    } else if (variant === 'toilet') {
        rect(c, -3, -Math.min(hw, hh) * .7, 6, 2, '#748b8d', 1);
    } else if (variant === 'bathtub' || variant === 'vanity') {
        const horizontal = w >= h;
        dot(c, horizontal ? w * .23 : 0, horizontal ? 0 : h * .23, 2, '#526f74');
        line(c, -4, -hh + 7, 4, -hh + 7, '#ebeee1', 2);
    } else if (variant === 'generator' || variant === 'machine' || variant === 'controlConsole') {
        rect(c, -hw + 9, hh - 10, Math.min(19, w * .24), 4, '#c5b375', 1);
        line(c, -hw + 12, hh - 10, -hw + 10, hh - 6, '#53584b', 2);
    } else if (variant === 'housePlant') {
        for (let i = 0; i < 7; i++) {
            const a = i * Math.PI * 2 / 7;
            line(c, Math.cos(a) * hw * .12, Math.sin(a) * hh * .12 - 2, Math.cos(a) * hw * .56, Math.sin(a) * hh * .56 - 2, 'rgba(186,201,127,.3)');
        }
    }
    c.restore();
}
