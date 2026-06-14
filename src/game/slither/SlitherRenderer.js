/**
 * Server-authoritative slither renderer — slither.io-inspired visuals.
 */

import { drawCashoutProgressRing } from '../cashoutRing.js';
import bgTileUrl from './background_tile.png';

function parseColor(hex) {
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

function rgb({ r, g, b }, a = 1) {
    return `rgba(${r},${g},${b},${a})`;
}

function toHex({ r, g, b }) {
    return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Server colors come from util.randomColor() (same as agar) — any random hex,
 * sometimes as a { fill, border } object. Keep the random hue but remap it to
 * the vivid pastel range slither.io snakes use, so dark/muddy randoms still
 * look like the real game.
 */
function normalizeSnakeColor(color) {
    const raw = typeof color === 'object' && color !== null ? color.fill : color;
    const { r, g, b } = parseColor(raw);

    // RGB → hue
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

    // HSL(h, 68%, 66%) → RGB — slightly lighter slither.io pastels
    const s = 0.68, l = 0.66;
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
    return toHex({ r: (rr + m) * 255, g: (gg + m) * 255, b: (bb + m) * 255 });
}

/** Bucket colors so sprite cache stays small across many snakes. */
function bucketSnakeColor(color) {
    const cs = normalizeSnakeColor(color);
    const { r, g, b } = parseColor(cs);
    const step = 24;
    return toHex({
        r: Math.min(255, Math.round(r / step) * step),
        g: Math.min(255, Math.round(g / step) * step),
        b: Math.min(255, Math.round(b / step) * step),
    });
}

function shadeColor({ r, g, b }, amount) {
    return {
        r: Math.max(0, Math.min(255, r + amount)),
        g: Math.max(0, Math.min(255, g + amount)),
        b: Math.max(0, Math.min(255, b + amount)),
    };
}

export class SlitherRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.state = { snakes: [], food: [], you: null, worldHalf: 3000, zone: null };
        // Latest authoritative snakes from the server + smoothed render copies (interpolation)
        this.targetSnakes = [];
        this.smooth = new Map();
        this._foodDrawList = [];
        this.hud = { balance: 1, cashoutSeconds: 0, cashoutTotal: 10, holdProgress: 0, securingCashout: false };
        this.camera = { x: 0, y: 0 };
        this._cameraInit = false;
        this._lastFrameTime = 0;
        this.zoom = 2.65;
        this.baseZoom = 2.65;
        this.snakeThickness = 1.05;
        // Pre-rendered sprite caches — gradients are expensive to build per frame
        this._sprites = new Map();
        /** o.pr_imgs — normal + boost overlay canvases per (cs, radius) */
        this._prImgs = new Map();
        this._bgTileImage = null;
        this._bgPattern = null;
        this._bgPatternScale = 0;
        this._loadBgTile();
        this.inputDx = 0;
        this.inputDy = 0;
        this.boost = false;
        this.running = false;
        this._raf = null;
        this._frame = 0;
        this._renderSnakeBuf = [];
        this._sortedRenderSnakes = [];
        this._ptsBuf = [];
        this._denseBuf = [];
        this._bumpsBuf = [];
        this._renderPool = new Map();
        this._smoothSegPool = [];
        this._pointPool = [];
        this._bgCanvas = null;
        this._bgCacheKey = '';

        this._onResize = () => this.resize();
        this._onMouseMove = (e) => this._handleMouse(e);
        this._onMouseDown = (e) => {
            if (e.target !== this.canvas) return;
            this.boost = true;
            this._emitInput?.();
        };
        this._onMouseUp = (e) => {
            if (e.target !== this.canvas) return;
            this.boost = false;
            this._emitInput?.();
        };
        this._onTouchMove = (e) => {
            e.preventDefault();
            const t = e.touches[0];
            this._setInputFromScreen(t.clientX, t.clientY);
        };
        this._onTouchStart = (e) => {
            this.boost = true;
            const t = e.touches[0];
            this._setInputFromScreen(t.clientX, t.clientY);
            this._emitInput?.();
        };
        this._onTouchEnd = () => { this.boost = false; this._emitInput?.(); };

        window.addEventListener('resize', this._onResize);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mouseup', this._onMouseUp);
        document.addEventListener('touchmove', this._onTouchMove, { passive: false });
        document.addEventListener('touchstart', this._onTouchStart, { passive: false });
        document.addEventListener('touchend', this._onTouchEnd);

        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.W = this.canvas.width;
        this.H = this.canvas.height;
    }

    _setInputFromScreen(sx, sy) {
        const rect = this.canvas.getBoundingClientRect();
        const x = sx - rect.left - this.W / 2;
        const y = sy - rect.top - this.H / 2;
        const mag = Math.hypot(x, y);
        if (mag < 8) return;
        this.inputDx = (x / mag) * 4;
        this.inputDy = (y / mag) * 4;
    }

    setInputEmitter(fn) {
        this._emitInput = fn;
    }

    _handleMouse(e) {
        this._setInputFromScreen(e.clientX, e.clientY);
    }

    getInput() {
        return { dx: this.inputDx, dy: this.inputDy, boost: this.boost };
    }

    updateState(tick) {
        if (tick.snakes) {
            this.targetSnakes = tick.snakes;
            if (tick.you) {
                const me = tick.snakes.find(s => s.id === tick.you);
                if (me?.balance != null) this.hud.balance = me.balance;
            }
        }
        if (tick.food) {
            const list = this._foodDrawList;
            list.length = tick.food.length;
            for (let i = 0; i < tick.food.length; i++) {
                list[i] = tick.food[i];
            }
        }
        this.state = {
            snakes: tick.snakes ?? this.state.snakes,
            you: tick.you ?? this.state.you,
            worldHalf: tick.worldHalf ?? this.state.worldHalf,
            zone: tick.battleRoyale ? (tick.zone !== undefined ? tick.zone : this.state.zone) : null,
        };
        if (tick.battleRoyale !== undefined) {
            this.state.battleRoyale = !!tick.battleRoyale;
        }
    }

    _smoothSeg(s, i, x, y) {
        let p = s.segments[i];
        if (!p) {
            p = this._smoothSegPool[i] || { x: 0, y: 0 };
            this._smoothSegPool[i] = p;
            s.segments[i] = p;
        }
        p.x = x;
        p.y = y;
        return p;
    }

    _poolPoint(i, x, y) {
        let p = this._pointPool[i];
        if (!p) {
            p = { x: 0, y: 0 };
            this._pointPool[i] = p;
        }
        p.x = x;
        p.y = y;
        return p;
    }

    setHud(hud) {
        this.hud = { ...this.hud, ...hud };
    }

    /**
     * Exponential smoothing of every snake's segments toward the latest server
     * positions. Server ticks arrive at ~40Hz with jitter; rendering at 60fps
     * without this makes movement look choppy and teleporty.
     */
    _updateSmoothing(dt) {
        const SNAP_SQ = 220 * 220;
        const seen = new Set();
        const cx = this.camera.x;
        const cy = this.camera.y;
        const viewR = 3200;

        for (const snake of this.targetSnakes) {
            seen.add(snake.id);
            const tgt = snake.segments || [];
            const len = tgt.length;
            if (len === 0) continue;

            const head = tgt[0];
            const offScreen = head && !snake.isYou && (head.x - cx) ** 2 + (head.y - cy) ** 2 > viewR * viewR;

            let s = this.smooth.get(snake.id);
            if (!s) {
                s = { segments: [], angle: snake.angle || 0 };
                this.smooth.set(snake.id, s);
            }

            if (s.segments.length > len) s.segments.length = len;

            if (offScreen) {
                for (let i = 0; i < len; i++) this._smoothSeg(s, i, tgt[i].x, tgt[i].y);
                s.angle = snake.angle || 0;
                continue;
            }

            const tau = snake.isYou ? 0.038 : 0.075;
            const a = 1 - Math.exp(-dt / Math.max(tau, 0.0001));
            const stride = len > 72 ? Math.ceil(len / 72) : 1;

            for (let i = 0; i < len; i++) {
                if (i >= s.segments.length) this._smoothSeg(s, i, tgt[i].x, tgt[i].y);

                if (stride > 1 && i > 0 && i < len - 1 && i % stride !== 0) {
                    this._smoothSeg(s, i, tgt[i].x, tgt[i].y);
                    continue;
                }

                const dx = tgt[i].x - s.segments[i].x;
                const dy = tgt[i].y - s.segments[i].y;
                if (dx * dx + dy * dy > SNAP_SQ) {
                    s.segments[i].x = tgt[i].x;
                    s.segments[i].y = tgt[i].y;
                } else {
                    s.segments[i].x += dx * a;
                    s.segments[i].y += dy * a;
                }
            }

            let da = (snake.angle || 0) - s.angle;
            da = Math.atan2(Math.sin(da), Math.cos(da));
            s.angle += da * a;
        }

        for (const id of this.smooth.keys()) {
            if (!seen.has(id)) this.smooth.delete(id);
        }
        for (const id of this._renderPool.keys()) {
            if (!seen.has(id)) this._renderPool.delete(id);
        }
    }

    start() {
        if (this.running) return;
        this.running = true;
        const loop = () => {
            if (!this.running) return;
            this._frame++;
            this.draw();
            this._raf = requestAnimationFrame(loop);
        };
        this._raf = requestAnimationFrame(loop);
    }

    pause() {
        this.running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
    }

    /** Get (or build once) a cached sprite canvas. LRU eviction avoids full-cache clear stutters. */
    _getSprite(key, size, painter) {
        let s = this._sprites.get(key);
        if (s) {
            s._lastUsed = this._frame;
            return s;
        }
        if (this._sprites.size >= 220) {
            const entries = [...this._sprites.entries()]
                .sort((a, b) => (a[1]._lastUsed || 0) - (b[1]._lastUsed || 0));
            for (let i = 0; i < 40 && i < entries.length; i++) {
                this._sprites.delete(entries[i][0]);
            }
            if (this._prImgs.size > 48) {
                this._prImgs.clear();
            }
        }
        const cv = document.createElement('canvas');
        const sz = Math.max(2, Math.ceil(size));
        cv.width = sz;
        cv.height = sz;
        painter(cv.getContext('2d'), sz);
        cv._lastUsed = this._frame;
        this._sprites.set(key, cv);
        return cv;
    }

    _loadBgTile() {
        const img = new Image();
        img.onload = () => {
            this._bgTileImage = img;
            this._bgPattern = null;
            this._bgPatternScale = 0;
        };
        img.src = bgTileUrl;
    }

    /**
     * Scale slither.io bg tile so hex width ≈ 2.2× snake body (reference: body ~45% of hex).
     * Tile asset is ~9 hex across at 599px; base snake diameter ≈ 12.4 world units.
     */
    _getBgTileScale(img) {
        const snakeBodyDiam = 12.4;
        const hexToBody = 2.2;
        const hexesAcross = 9;
        return (snakeBodyDiam * hexToBody * hexesAcross) / img.naturalWidth;
    }

    /** Repeating slither.io hex tile — sized to match in-game reference. */
    _getBgPattern(ctx) {
        const img = this._bgTileImage;
        if (!img?.complete || !img.naturalWidth) return null;
        const scale = this._getBgTileScale(img);
        if (this._bgPattern && this._bgPatternScale === scale) return this._bgPattern;
        this._bgPattern = ctx.createPattern(img, 'repeat');
        this._bgPatternScale = scale;
        if (this._bgPattern?.setTransform) {
            this._bgPattern.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0]));
        }
        return this._bgPattern;
    }

    _drawBackground(ctx, W, H, cx, cy, worldHalf, toScreen, zoom) {
        if (!this._bgCanvas || this._bgCanvas.width !== W || this._bgCanvas.height !== H) {
            this._bgCanvas = this._bgCanvas || document.createElement('canvas');
            this._bgCanvas.width = W;
            this._bgCanvas.height = H;
            this._bgCacheKey = '';
        }

        const cacheKey = `${Math.round(cx / 64)}|${Math.round(cy / 64)}|${zoom.toFixed(2)}|${worldHalf}`;
        const bgCtx = this._bgCanvas.getContext('2d');
        if (cacheKey !== this._bgCacheKey) {
            this._bgCacheKey = cacheKey;
            bgCtx.setTransform(1, 0, 0, 1, 0, 0);
            bgCtx.fillStyle = '#1a1a1e';
            bgCtx.fillRect(0, 0, W, H);

            const pattern = this._getBgPattern(bgCtx);
            if (pattern) {
                bgCtx.save();
                bgCtx.translate(W / 2, H / 2);
                bgCtx.scale(zoom, zoom);
                bgCtx.translate(-cx, -cy);
                bgCtx.fillStyle = pattern;
                const vw = W / zoom;
                const vh = H / zoom;
                const margin = 240;
                bgCtx.fillRect(cx - vw / 2 - margin, cy - vh / 2 - margin, vw + margin * 2, vh + margin * 2);
                bgCtx.restore();
            }

            const limit = worldHalf;
            const tl = toScreen(-limit, -limit);
            const br = toScreen(limit, limit);
            const playW = br.x - tl.x;
            const playH = br.y - tl.y;
            bgCtx.save();
            bgCtx.fillStyle = 'rgba(72, 4, 9, 0.96)';
            bgCtx.beginPath();
            bgCtx.rect(0, 0, W, H);
            bgCtx.rect(tl.x, tl.y, playW, playH);
            bgCtx.fill('evenodd');
            bgCtx.strokeStyle = 'rgba(255, 45, 45, 0.28)';
            bgCtx.lineWidth = 14;
            bgCtx.strokeRect(tl.x, tl.y, playW, playH);
            bgCtx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
            bgCtx.lineWidth = 3;
            bgCtx.strokeRect(tl.x, tl.y, playW, playH);
            bgCtx.restore();
        }

        ctx.drawImage(this._bgCanvas, 0, 0);
    }

    /** Insert extra points between spine nodes so the body has slither.io-style bumps. */
    _densifySpine(pts, stepPx, out) {
        out.length = 0;
        if (pts.length < 2) {
            if (pts.length === 1) out.push(pts[0]);
            return out;
        }
        out.push(pts[0]);
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];
            const d = Math.hypot(b.x - a.x, b.y - a.y);
            const steps = Math.max(1, Math.ceil(d / stepPx));
            for (let s = 1; s <= steps; s++) {
                const t = s / steps;
                out.push(this._poolPoint(out.length, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
            }
        }
        return out;
    }

    /** Keep long snakes performant — evenly subsample excess bump points. */
    _capBumps(bumps, out, max = 65) {
        if (bumps.length <= max) {
            out.length = bumps.length;
            for (let i = 0; i < bumps.length; i++) out[i] = bumps[i];
            return out;
        }
        out.length = max;
        const step = (bumps.length - 1) / (max - 1);
        for (let i = 0; i < max; i++) out[i] = bumps[Math.round(i * step)];
        return out;
    }

    _drawZone(ctx, toScreen, W, H) {
        const zone = this.state.zone;
        if (!zone || zone.radius == null) return;

        const { x: zx, y: zy } = toScreen(zone.cx, zone.cy);
        const screenRadius = zone.radius * this.zoom;

        ctx.save();
        ctx.fillStyle = 'rgba(72, 4, 9, 0.9)';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(zx, zy, screenRadius, 0, Math.PI * 2, true);
        ctx.fill('evenodd');

        ctx.strokeStyle = 'rgba(255, 85, 85, 0.95)';
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(zx, zy, screenRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    /** Soft glowing orb — compact bloom, tighter falloff, more transparent. */
    _foodSprite(hue, rPx, golden, deathDrop) {
        const halo = Math.ceil(rPx * (golden ? 2.2 : deathDrop ? 1.95 : 1.7));
        const key = `f9|${golden ? 'g' : hue}|${rPx}|${deathDrop ? 1 : 0}`;
        return this._getSprite(key, halo * 2 + 4, (g, sz) => {
            const c = sz / 2;
            const grad = g.createRadialGradient(c, c, 0, c, c, halo);
            if (golden) {
                grad.addColorStop(0, 'hsla(48, 100%, 88%, 0.68)');
                grad.addColorStop(0.20, 'hsla(46, 95%, 70%, 0.48)');
                grad.addColorStop(0.42, 'hsla(42, 90%, 60%, 0.24)');
                grad.addColorStop(0.62, 'hsla(38, 85%, 52%, 0.08)');
                grad.addColorStop(0.78, 'hsla(36, 80%, 48%, 0.02)');
                grad.addColorStop(1, 'hsla(36, 80%, 46%, 0)');
            } else {
                const sat = deathDrop ? 95 : 88;
                grad.addColorStop(0, `hsla(${hue}, ${sat}%, 86%, 0.60)`);
                grad.addColorStop(0.22, `hsla(${hue}, ${sat}%, 68%, 0.42)`);
                grad.addColorStop(0.46, `hsla(${hue}, ${sat}%, 58%, 0.18)`);
                grad.addColorStop(0.64, `hsla(${hue}, ${sat}%, 52%, 0.05)`);
                grad.addColorStop(0.78, `hsla(${hue}, ${sat}%, 48%, 0.012)`);
                grad.addColorStop(1, `hsla(${hue}, ${sat}%, 46%, 0)`);
            }
            g.fillStyle = grad;
            g.fillRect(0, 0, sz, sz);
        });
    }

    _drawFood(ctx, foodList, toScreen, W, H, zoom) {
        for (let fi = 0; fi < foodList.length; fi++) {
            const f = foodList[fi];
            const { x: fx, y: fy } = toScreen(f.x, f.y);
            if (fx < -140 || fy < -140 || fx > W + 140 || fy > H + 140) continue;

            const hue = f.golden ? 48 : Math.round((f.hue ?? 120) / 12) * 12;

            // Server already sends golden at 2.4× radius — only a slight visual bump
            let sizeMul = 1;
            if (f.golden) {
                sizeMul = 1.12;
            } else if (f.deathDrop) {
                sizeMul = 1.25 + ((f.radius || 3) - 2) * 0.15;
            } else {
                let h = 0;
                const id = String(f.id ?? `${f.x},${f.y}`);
                for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
                sizeMul = 0.72 + (Math.abs(h) % 100) / 100 * 0.65;
            }

            const baseR = (f.radius || 3) * sizeMul;
            const screenR = Math.max(4.5, baseR * zoom * 1.65);
            const spriteR = 4;
            const sprite = this._foodSprite(hue, spriteR, !!f.golden, !!f.deathDrop);
            const size = sprite.width * (screenR / spriteR);
            const half = size / 2;
            ctx.drawImage(sprite, Math.round(fx - half), Math.round(fy - half), size, size);
        }
    }

    /** Paint one snake bead — layered skin tones, dorsal sheen, alternating stripe phase. */
    _paintSnakeSegment(g, c, rPx, cs, phase = 0) {
        const col = parseColor(cs);
        const shift = phase === 1 ? -14 : 0;
        const base = shadeColor(col, shift);
        const top = shadeColor(base, 20);
        const upper = shadeColor(base, 8);
        const lower = shadeColor(base, -11);
        const bottom = shadeColor(base, -18);
        const edge = shadeColor(base, -24);

        const lx = c - rPx * 0.04;
        const ly = c - rPx * 0.26;
        const body = g.createRadialGradient(lx, ly, rPx * 0.05, c, c + rPx * 0.10, rPx);
        body.addColorStop(0,    toHex(top));
        body.addColorStop(0.22, toHex(upper));
        body.addColorStop(0.46, toHex(base));
        body.addColorStop(0.68, toHex(lower));
        body.addColorStop(0.84, toHex(bottom));
        body.addColorStop(1,    toHex(edge));
        g.fillStyle = body;
        g.beginPath();
        g.arc(c, c, rPx, 0, Math.PI * 2);
        g.fill();

        const glossHi = shadeColor(base, 24);
        const gx = c;
        const gy = c - rPx * 0.27;
        const gloss = g.createRadialGradient(gx, gy, 0, gx, gy, rPx * 0.38);
        gloss.addColorStop(0, rgb(glossHi, 0.34));
        gloss.addColorStop(0.30, rgb(glossHi, 0.14));
        gloss.addColorStop(0.62, rgb(glossHi, 0.03));
        gloss.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gloss;
        g.beginPath();
        g.arc(c, c, rPx, 0, Math.PI * 2);
        g.fill();

        const spec = shadeColor(base, 28);
        const specGrad = g.createRadialGradient(c - rPx * 0.06, c - rPx * 0.31, 0, c - rPx * 0.06, c - rPx * 0.31, rPx * 0.17);
        specGrad.addColorStop(0, rgb(spec, 0.22));
        specGrad.addColorStop(0.6, rgb(spec, 0.04));
        specGrad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = specGrad;
        g.beginPath();
        g.arc(c, c, rPx, 0, Math.PI * 2);
        g.fill();

        // Baked overlap crease — ribbing without a second draw pass per bead
        const crease = shadeColor(base, -36);
        const cy = c + rPx * 0.15;
        const creaseGrad = g.createRadialGradient(c, cy, rPx * 0.10, c, cy, rPx * 0.78);
        creaseGrad.addColorStop(0, rgb(crease, phase === 1 ? 0.28 : 0.20));
        creaseGrad.addColorStop(0.45, rgb(crease, 0.08));
        creaseGrad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = creaseGrad;
        g.beginPath();
        g.arc(c, c, rPx, 0, Math.PI * 2);
        g.fill();
    }

    /**
     * Pre-render normal segment + boost overlay into o.pr_imgs cache.
     * Main loop only blits these — no arc/stroke work per frame.
     */
    _getSnakePrImgs(cs, rPx) {
        const key = `${cs}|${rPx}`;
        let pair = this._prImgs.get(key);
        if (pair) return pair;

        const normal = this._getSprite(`pr_norm_v14|${key}|0`, rPx * 2 + 4, (g, sz) => {
            this._paintSnakeSegment(g, sz / 2, rPx, cs, 0);
        });

        const alt = this._getSprite(`pr_norm_v14|${key}|1`, rPx * 2 + 4, (g, sz) => {
            this._paintSnakeSegment(g, sz / 2, rPx, cs, 1);
        });

        const col = parseColor(cs);
        const bright = shadeColor(col, 36);
        const pad = Math.max(2, Math.ceil(rPx * 0.1));
        const boost = this._getSprite(`pr_boost|${key}`, rPx * 2 + pad * 2, (g, sz) => {
            const c = sz / 2;
            const glowR = rPx + pad - 1;
            const aura = g.createRadialGradient(c, c, rPx * 0.96, c, c, glowR);
            aura.addColorStop(0, 'rgba(255,255,255,0)');
            aura.addColorStop(0.55, rgb(bright, 0.14));
            aura.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = aura;
            g.beginPath();
            g.arc(c, c, glowR, 0, Math.PI * 2);
            g.fill();

            g.strokeStyle = rgb(bright, 0.18);
            g.lineWidth = Math.max(1, rPx * 0.1);
            g.lineCap = 'round';
            g.beginPath();
            g.arc(c, c, rPx + 0.3, 0, Math.PI * 2);
            g.stroke();
        });

        pair = { normal, alt, boost };
        this._prImgs.set(key, pair);
        return pair;
    }

    _drawSnake(snake, toScreen, zoom) {
        const ctx = this.ctx;
        const segs = snake.segments || [];
        if (segs.length === 0) return;

        const gsc = zoom;
        const thick = this.snakeThickness ?? 1;
        const headRadius = (snake.radius || 6) * gsc * thick;
        const bodyRadius = headRadius * 0.96;
        const angle = snake.angle || 0;
        const cs = bucketSnakeColor(snake.color);
        const boosting = !!snake.boost;

        const pts = this._ptsBuf;
        let pi = 0;
        const stride = segs.length > 70 ? Math.ceil(segs.length / 55) : 1;
        for (let i = 0; i < segs.length; i += stride) {
            const scr = toScreen(segs[i].x, segs[i].y);
            pts[pi++] = this._poolPoint(pi - 1, scr.x, scr.y);
        }
        if (stride > 1) {
            const last = segs[segs.length - 1];
            const scr = toScreen(last.x, last.y);
            pts[pi++] = this._poolPoint(pi - 1, scr.x, scr.y);
        }
        pts.length = pi;

        let onScreen = false;
        for (let i = 0; i < pi; i++) {
            const p = pts[i];
            if (p.x > -120 && p.y > -120 && p.x < this.W + 120 && p.y < this.H + 120) {
                onScreen = true;
                break;
            }
        }
        if (!onScreen) return;

        const bumpStep = Math.max(2, bodyRadius * 0.50);
        const dense = this._densifySpine(pts, bumpStep, this._denseBuf);
        const bumps = this._capBumps(dense, this._bumpsBuf);
        if (bumps.length < 1) return;

        const r = Math.max(2.5, Math.round(bodyRadius / 2) * 2);
        const { normal, alt, boost: boostOverlay } = this._getSnakePrImgs(cs, r);
        const halfN = normal.width / 2;
        const halfB = boostOverlay.width / 2;

        for (let i = bumps.length - 1; i >= 0; i--) {
            const p = bumps[i];
            if (p.x < -80 || p.y < -80 || p.x > this.W + 80 || p.y > this.H + 80) continue;
            ctx.drawImage((i & 1) ? alt : normal, p.x - halfN, p.y - halfN);
        }

        // Pass 2: tight boost glow — lighter composite, no shadowBlur
        if (boosting) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.48;
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            for (let i = bumps.length - 1; i >= 0; i--) {
                const p = bumps[i];
                if (p.x < -80 || p.y < -80 || p.x > this.W + 80 || p.y > this.H + 80) continue;
                ctx.drawImage(boostOverlay, p.x - halfB, p.y - halfB);
            }
            ctx.restore();
        }

        // Head eyes (no segment shadow)
        const { x: hx, y: hy } = pts[0];
        const perpX = Math.sin(angle);
        const perpY = -Math.cos(angle);
        const fwdX = Math.cos(angle);
        const fwdY = Math.sin(angle);
        const eyeSide = headRadius * 0.44;
        const eyeFwd = headRadius * 0.5;
        const eyeR = Math.max(2.5, headRadius * 0.34);
        const pupilR = eyeR * 0.5;

        ctx.save();
        ctx.shadowBlur = 0;
        for (const side of [-1, 1]) {
            const ex = hx + fwdX * eyeFwd + perpX * eyeSide * side;
            const ey = hy + fwdY * eyeFwd + perpY * eyeSide * side;
            ctx.beginPath();
            ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.28)';
            ctx.lineWidth = Math.max(0.8, eyeR * 0.09);
            ctx.stroke();

            const px = ex + fwdX * eyeR * 0.42;
            const py = ey + fwdY * eyeR * 0.42;
            ctx.beginPath();
            ctx.arc(px, py, pupilR, 0, Math.PI * 2);
            ctx.fillStyle = '#101014';
            ctx.fill();
        }
        ctx.restore();

        if (snake.name) {
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.font = `bold ${Math.max(12, headRadius * 0.85)}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'rgba(0,0,0,0.55)';
            ctx.lineWidth = 3;
            ctx.strokeText(snake.name, hx, hy - headRadius - 12);
            ctx.fillText(snake.name, hx, hy - headRadius - 12);
        }
    }

    _drawBalanceBadge(ctx, screenX, screenY, balance, isMe) {
        const amount = (balance || 0).toFixed(2);
        const amountFont = 13;
        const unitFont = 10;
        const gap = 2;

        ctx.font = `800 ${amountFont}px ui-monospace, SFMono-Regular, monospace`;
        const amountW = ctx.measureText(amount).width;
        ctx.font = `600 ${unitFont}px ui-monospace, SFMono-Regular, monospace`;
        const unitW = ctx.measureText('$').width;

        const padX = 10;
        const pillW = unitW + gap + amountW + padX * 2;
        const pillH = amountFont + 10;
        const pillX = screenX - pillW / 2;
        const pillY = screenY;

        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
        ctx.fillStyle = isMe ? 'rgba(6, 12, 10, 0.82)' : 'rgba(8, 9, 13, 0.78)';
        ctx.fill();
        ctx.strokeStyle = isMe ? 'rgba(20, 241, 149, 0.35)' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = isMe ? 1.25 : 1;
        ctx.stroke();

        const midY = pillY + pillH / 2 + 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${unitFont}px ui-monospace, SFMono-Regular, monospace`;
        ctx.fillStyle = isMe ? 'rgba(20, 241, 149, 0.55)' : 'rgba(255,255,255,0.35)';
        ctx.fillText('$', pillX + padX, midY);

        ctx.font = `800 ${amountFont}px ui-monospace, SFMono-Regular, monospace`;
        ctx.fillStyle = isMe ? '#14F195' : 'rgba(255,255,255,0.92)';
        ctx.fillText(amount, pillX + padX + unitW + gap, midY);
        ctx.textAlign = 'center';
    }

    draw() {
        const { worldHalf } = this.state;
        const ctx = this.ctx;
        const W = this.W;
        const H = this.H;

        const now = performance.now();
        let dt = this._lastFrameTime ? (now - this._lastFrameTime) / 1000 : 1 / 60;
        this._lastFrameTime = now;
        if (dt > 0.1) dt = 0.1; // clamp after tab-switch / hitch

        this._updateSmoothing(dt);

        // Build render snakes without per-frame object spreads
        const renderSnakes = this._renderSnakeBuf;
        renderSnakes.length = 0;
        for (const snake of this.targetSnakes) {
            let rs = this._renderPool.get(snake.id);
            if (!rs) {
                rs = {};
                this._renderPool.set(snake.id, rs);
            }
            rs.id = snake.id;
            rs.color = snake.color;
            rs.radius = snake.radius;
            rs.boost = snake.boost;
            rs.isYou = snake.isYou;
            rs.name = snake.name;
            rs.balance = snake.balance;
            const s = this.smooth.get(snake.id);
            rs.segments = s ? s.segments : snake.segments;
            rs.angle = s ? s.angle : snake.angle;
            renderSnakes.push(rs);
        }

        const me = renderSnakes.find(s => s.isYou);
        if (me?.segments?.[0]) {
            const head = me.segments[0];
            if (!this._cameraInit) {
                this.camera.x = head.x;
                this.camera.y = head.y;
                this._cameraInit = true;
            } else {
                this.camera.x = head.x;
                this.camera.y = head.y;
            }

            // slither.io-style zoom-out as the snake grows
            const meR = me.radius || 6.2;
            const targetZoom = Math.min(this.baseZoom, Math.max(1.35, this.baseZoom * Math.pow(6.2 / meR, 0.4)));
            const za = 1 - Math.exp(-dt / 0.6);
            this.zoom += (targetZoom - this.zoom) * za;
        }

        const cx = this.camera.x;
        const cy = this.camera.y;
        const zoom = this.zoom;
        const toScreen = (wx, wy) => ({
            x: (wx - cx) * zoom + W / 2,
            y: (wy - cy) * zoom + H / 2,
        });

        this._drawBackground(ctx, W, H, cx, cy, worldHalf, toScreen, zoom);
        this._drawZone(ctx, toScreen, W, H);
        this._drawFood(ctx, this._foodDrawList, toScreen, W, H, zoom);

        const sorted = this._sortedRenderSnakes;
        sorted.length = 0;
        for (let i = 0; i < renderSnakes.length; i++) sorted.push(renderSnakes[i]);
        sorted.sort((a, b) => (a.radius || 6) - (b.radius || 6));

        const viewPad = 900;
        for (const snake of sorted) {
            const head = snake.segments?.[0];
            if (head && !snake.isYou) {
                const dx = head.x - cx;
                const dy = head.y - cy;
                if (dx * dx + dy * dy > viewPad * viewPad) continue;
            }
            this._drawSnake(snake, toScreen, zoom);
        }

        // Balance badge + cashout rings on your snake head
        if (me?.segments?.[0]) {
            const head = me.segments[0];
            const { x: hx, y: hy } = toScreen(head.x, head.y);
            const headRadius = (me.radius || 6) * zoom * (this.snakeThickness ?? 1);
            const { holdProgress, cashoutSeconds, cashoutTotal } = this.hud;

            if (holdProgress > 0 && cashoutSeconds <= 0) {
                drawCashoutProgressRing(ctx, hx, hy, headRadius + 12, holdProgress, { counterClockwise: true });
            }
            if (cashoutSeconds > 0) {
                const progress = cashoutSeconds / (cashoutTotal || 10);
                drawCashoutProgressRing(ctx, hx, hy, headRadius + 12, progress, { pulse: true });
            }

            this._drawBalanceBadge(ctx, hx, hy + headRadius + 14, me.balance ?? this.hud.balance ?? 1, true);
        }
    }

    destroy() {
        this.pause();
        window.removeEventListener('resize', this._onResize);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mousedown', this._onMouseDown);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('touchmove', this._onTouchMove);
        document.removeEventListener('touchstart', this._onTouchStart);
        document.removeEventListener('touchend', this._onTouchEnd);
    }
}
