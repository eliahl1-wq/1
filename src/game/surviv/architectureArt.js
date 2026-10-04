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

const CRAFTED_FIXTURES = new Set([
    'kitchenCounter', 'labBench', 'bookshelf', 'displayShelf', 'storageShelf',
    'controlConsole', 'machine', 'industrial', 'generator', 'serverRack',
    'bathtub', 'vanity',
]);

// Appliances and shelves use the same long-axis orientation as furniture.
// Dimensions come from the authoritative blocker, so detail never invents a
// larger silhouette or changes collision. No time, randomness or blur filters:
// the complete result is suitable for the renderer's existing sprite cache.
export function drawCraftedFixtures(c, o, variant) {
    if (!CRAFTED_FIXTURES.has(variant)) return false;
    const w = Math.max(o.w, o.h), h = Math.min(o.w, o.h);
    if (!Number.isFinite(w) || !Number.isFinite(h) || h < 24) return false;
    c.save();
    if (o.h > o.w) c.rotate(Math.PI / 2);
    const x = -w / 2, y = -h / 2;
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    const s = Math.min(1, h / 34);
    const metal = !['bookshelf', 'displayShelf', 'bathtub', 'vanity'].includes(variant);
    const edge = metal ? '#25373b' : variant === 'bathtub' ? '#637c7f' : '#433226';
    const shell = variant === 'kitchenCounter' ? '#817f70' : variant === 'labBench' ? '#829e9a'
        : variant === 'bathtub' ? '#a9bcb8' : variant === 'vanity' ? '#8a7052'
        : metal ? '#738889' : '#997650';
    rect(c, x + 1, y + 3, w - 2, h - 4, edge, 3 * s);
    rect(c, x + 1, y + 1, w - 2, h - 5, shell, 3 * s, edge);

    if (variant === 'kitchenCounter' || variant === 'labBench') {
        const lab = variant === 'labBench';
        rect(c, x + 3, y + 3, w - 6, h - 9, lab ? '#d5e3db' : '#d0cdbc', 2 * s, lab ? '#66827d' : '#a19c85');
        const zoneW = (w - 16) * .35, zoneH = (h - 12) * .7;
        const zx = x + 7, zy = -zoneH / 2 - 1;
        if (lab) {
            // A work mat, specimen slide and pipette read as a laboratory, not
            // the kitchen's sink with three coloured dots pasted on top.
            rect(c, zx, zy, zoneW, zoneH, '#658e88', 2 * s, '#416964');
            rect(c, zx + zoneW * .14, zy + zoneH * .2, zoneW * .55, zoneH * .56, '#bdd3c4', s, '#8ea89d');
            dot(c, zx + zoneW * .4, zy + zoneH * .48, Math.min(2.5, zoneH * .13), '#819c78');
            line(c, zx + zoneW * .73, zy + 3, zx + zoneW * .85, zy + zoneH - 3, '#dedec3', 2 * s);
            const rackX = x + w * .55, rackW = Math.max(8, w * .31);
            rect(c, rackX, -h * .23, rackW, h * .37, '#536e69', 2 * s, '#395451');
            for (let i = 0; i < 3; i++) {
                const px = rackX + rackW * (.2 + i * .3), r = Math.min(4 * s, rackW * .11);
                dot(c, px, -h * .05, r + s, '#b0c6b9');
                dot(c, px, -h * .05, r, ['#7faaa1', '#ba9278', '#a3ad75'][i]);
                line(c, px - r * .35, -h * .05 - r * .4, px - r * .35, -h * .05 + r * .35, '#e9eee1', s);
            }
        } else {
            rect(c, zx, zy, zoneW, zoneH, '#8da3a0', 3 * s, '#697f7c');
            rect(c, zx + 3 * s, zy + 3 * s, zoneW - 6 * s, zoneH - 6 * s, '#536f71', 2 * s, '#b8c6ba');
            dot(c, zx + zoneW * .56, zy + zoneH * .55, 1.4 * s, '#c5cebf');
            const fx = zx + zoneW * .45;
            line(c, fx, zy + 2, fx, zy - 3 * s, '#394f52', 3 * s);
            line(c, fx, zy - 3 * s, fx + 5 * s, zy - 3 * s, '#d5ded0', 2 * s);
            const stoveX = x + w * .57, stoveW = w * .32;
            rect(c, stoveX, -h * .24, stoveW, h * .39, '#394746', 2 * s, '#66736b');
            for (const px of [.28, .73]) {
                const r = Math.min(4.8 * s, stoveW * .18);
                dot(c, stoveX + stoveW * px, -h * .04, r, '#7b8981');
                dot(c, stoveX + stoveW * px, -h * .04, r * .61, '#354141');
            }
        }
        line(c, x + 5, h / 2 - 5, w / 2 - 5, h / 2 - 5, lab ? '#9fb9ac' : '#a7a28a', 2 * s);
        for (const at of [.22, .72]) line(c, x + w * at, h / 2 - 4, x + w * at + Math.min(9, w * .1), h / 2 - 4, '#455650', 1.5 * s);
    } else if (['bookshelf', 'displayShelf', 'storageShelf'].includes(variant)) {
        const storage = variant === 'storageShelf';
        const bays = Math.max(2, Math.min(4, Math.floor(w / 35)));
        const bw = (w - 10) / bays;
        for (let i = 0; i < bays; i++) {
            const bx = x + 5 + i * bw, iw = bw - 3;
            rect(c, bx, y + 5, iw, h - 13, storage ? '#3a5054' : '#62472f', s);
            if (storage) {
                rect(c, bx + 2, y + 7, iw - 4, h - 18, i % 2 ? '#818d7a' : '#ad8959', s, '#404d42');
                line(c, bx + iw * .48, y + 8, bx + iw * .48, h / 2 - 12, '#d2c394', 2 * s);
                line(c, bx + 3, y + h * .48, bx + iw - 3, y + h * .48, '#5b6551', s);
            } else {
                const count = Math.max(2, Math.min(5, Math.floor(iw / 5)));
                const bookW = (iw - 4) / count;
                for (let b = 0; b < count; b++) {
                    const bx2 = bx + 2 + b * bookW;
                    const inset = (b + i) % 3 * 1.2 * s;
                    rect(c, bx2, y + 7 + inset, bookW - .9, h - 18 - inset, ['#92644e', '#6b8b8a', '#a89c74', '#7a865f'][(b + i) % 4], .5);
                    line(c, bx2 + .8, y + 10 + inset, bx2 + bookW - 1.8, y + 10 + inset, '#c4bf9a', s);
                }
            }
            if (i > 0) line(c, bx - 2, y + 4, bx - 2, h / 2 - 5, storage ? '#94a8a4' : '#bb9462', 2 * s);
        }
    } else if (variant === 'bathtub' || variant === 'vanity') {
        const bath = variant === 'bathtub';
        rect(c, x + 3, y + 3, w - 6, h - 9, '#dbe3d5', bath ? h * .28 : 2 * s, '#a5b9ad');
        const bw = bath ? w - 18 : w * .52, bh = bath ? h - 17 : h * .47;
        const bx = bath ? x + 9 : -bw / 2;
        rect(c, bx, -bh / 2 - 1, bw, bh, '#8faeac', bath ? bh * .4 : bh * .35, '#f1f1e5');
        rect(c, bx + 3 * s, -bh / 2 + 2 * s - 1, bw - 6 * s, bh - 5 * s, '#c1d2c8', bh * .25);
        const drain = bath ? bx + bw - 6 * s : bw * .23;
        dot(c, drain, 0, 1.6 * s, '#6e8782');
        const fx = bath ? bx + 5 * s : -bw * .15;
        line(c, fx, -bh / 2 - 2 * s, fx, -bh / 2 + 4 * s, '#536f6d', 3 * s);
        line(c, fx - s, -bh / 2 - 2 * s, fx - s, -bh / 2 + 3 * s, '#e2e9d9', 1.2 * s);
        if (!bath) rect(c, w * .29, -h * .05, w * .1, h * .16, '#d8c59a', s, '#adab8f');
    } else if (variant === 'serverRack') {
        rect(c, x + 4, y + 4, w - 8, h - 10, '#283b41', s, '#526a70');
        const count = Math.max(3, Math.min(6, Math.floor(w / 17)));
        const bay = (w - 12) / count;
        for (let i = 0; i < count; i++) {
            const px = x + 6 + i * bay;
            rect(c, px, y + 6, bay - 2, h - 15, i % 2 ? '#455d63' : '#344b52', s);
            for (let j = 0; j < 3; j++) line(c, px + 2, y + 10 + j * 3 * s, px + bay - 5, y + 10 + j * 3 * s, '#20343b', s);
            dot(c, px + bay / 2 - 1, h / 2 - 11 * s, 1.2 * s, i % 3 ? '#84b29b' : '#95b3bc');
        }
    } else if (variant === 'controlConsole') {
        const screenW = w * .45, screenH = h * .52;
        rect(c, x + 5, -screenH / 2 - 1, screenW, screenH, '#243b3d', 2 * s, '#98b3ab');
        rect(c, x + 8, -screenH / 2 + 2, screenW - 6, screenH - 6, '#72a4a0', s);
        const sy = -screenH / 2 + 5, sx = x + 11;
        line(c, sx, sy, sx + screenW * .28, sy, '#b2cbc0', s);
        line(c, sx, sy + 4 * s, sx + screenW * .46, sy + 4 * s, '#466e6b', s);
        line(c, sx, sy + 8 * s, sx + screenW * .2, sy + 8 * s, '#b2cbc0', s);
        for (let i = 0; i < 3; i++) {
            const px = x + w * (.65 + i * .1);
            dot(c, px, -h * .09, 3 * s, '#3c5657');
            dot(c, px, -h * .09 - s, 2 * s, ['#c3ad71', '#98ba9c', '#b28370'][i]);
            line(c, px - 2 * s, h * .12, px + 2 * s, h * .12, '#253c3f', 2 * s);
        }
    } else {
        // Machines and generators retain distinct mechanical silhouettes.
        const generator = variant === 'generator';
        const pw = w * (generator ? .57 : .7), ph = h - 14;
        rect(c, x + 6, -ph / 2 - 1, pw, ph, '#354b4e', 3 * s, '#95aaa4');
        for (let i = 0; i < 5; i++) {
            const px = x + 10 + (pw - 8) * i / 5;
            line(c, px, -ph / 2 + 3, px, ph / 2 - 3, '#6f8b8d', 2 * s);
            line(c, px + 2 * s, -ph / 2 + 3, px + 2 * s, ph / 2 - 3, '#223c40', s);
        }
        const capX = x + w * .83;
        dot(c, capX, -h * .1, Math.min(5 * s, w * .075), generator ? '#c2a866' : '#899f96');
        line(c, capX - 2 * s, -h * .1, capX + 2 * s, -h * .1, '#4e6659', 1.5 * s);
        rect(c, capX - 3 * s, h * .12, 6 * s, 3 * s, generator ? '#ac7a67' : '#cad0b1', s);
    }
    line(c, x + 4, y + 2, w / 2 - 4, y + 2, 'rgba(239,244,217,.36)', s);
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
