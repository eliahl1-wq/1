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

    // HSL(h, 68%, 60%) → RGB, the pastel band seen in slither.io
    const s = 0.68, l = 0.60;
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
        this.foodCache = new Map();
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
        this._emitInput?.();
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
            const seen = new Set();
            for (const f of tick.food) {
                seen.add(f.id);
                const prev = this.foodCache.get(f.id);
                this.foodCache.set(f.id, {
                    ...(prev || {}),
                    ...f,
                    _missStreak: 0,
                });
            }
            for (const [id, f] of this.foodCache) {
                if (!seen.has(id)) {
                    this.foodCache.set(id, { ...f, _missStreak: (f._missStreak || 0) + 1 });
                }
            }
        }
        this.state = {
            snakes: tick.snakes ?? this.state.snakes,
            food: Array.from(this.foodCache.values()),
            you: tick.you ?? this.state.you,
            worldHalf: tick.worldHalf ?? this.state.worldHalf,
            zone: tick.battleRoyale ? (tick.zone !== undefined ? tick.zone : this.state.zone) : null,
        };
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
        const SNAP_SQ = 220 * 220; // teleport/respawn → snap instead of slide

        const seen = new Set();
        for (const snake of this.targetSnakes) {
            seen.add(snake.id);
            const tgt = snake.segments || [];
            let s = this.smooth.get(snake.id);

            const tau = snake.isYou ? 0.038 : 0.075;
            const a = 1 - Math.exp(-dt / Math.max(tau, 0.0001));
            if (!s) {
                s = { segments: tgt.map(p => ({ x: p.x, y: p.y })), angle: snake.angle || 0 };
                this.smooth.set(snake.id, s);
                continue;
            }
            if (s.segments.length > tgt.length) s.segments.length = tgt.length;
            for (let i = 0; i < tgt.length; i++) {
                if (i >= s.segments.length) {
                    s.segments.push({ x: tgt[i].x, y: tgt[i].y });
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

    /** Get (or build once) a cached sprite canvas. */
    _getSprite(key, size, painter) {
        let s = this._sprites.get(key);
        if (s) return s;
        if (this._sprites.size > 400) {
            this._sprites.clear();
            this._prImgs.clear();
        }
        const cv = document.createElement('canvas');
        const sz = Math.max(2, Math.ceil(size));
        cv.width = sz;
        cv.height = sz;
        painter(cv.getContext('2d'), sz);
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
        ctx.fillStyle = '#161616';
        ctx.fillRect(0, 0, W, H);

        const pattern = this._getBgPattern(ctx);
        if (pattern) {
            ctx.save();
            ctx.translate(W / 2, H / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-cx, -cy);
            ctx.fillStyle = pattern;
            const vw = W / zoom;
            const vh = H / zoom;
            const margin = 240;
            // Rect must be centered on the camera (cx, cy) in world space —
            // centering on origin left gray areas away from the map center
            ctx.fillRect(cx - vw / 2 - margin, cy - vh / 2 - margin, vw + margin * 2, vh + margin * 2);
            ctx.restore();
        }

        // Red death zone outside playable square (slither.io style)
        const limit = worldHalf;
        const tl = toScreen(-limit, -limit);
        const br = toScreen(limit, limit);
        const playW = br.x - tl.x;
        const playH = br.y - tl.y;
        ctx.save();
        ctx.fillStyle = 'rgba(72, 4, 9, 0.96)';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.rect(tl.x, tl.y, playW, playH);
        ctx.fill('evenodd');
        // Soft inner glow on the border, then a crisp line
        ctx.strokeStyle = 'rgba(255, 45, 45, 0.28)';
        ctx.lineWidth = 14;
        ctx.strokeRect(tl.x, tl.y, playW, playH);
        ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
        ctx.lineWidth = 3;
        ctx.strokeRect(tl.x, tl.y, playW, playH);
        ctx.restore();
    }

    /** Insert extra points between spine nodes so the body has slither.io-style bumps. */
    _densifySpine(pts, stepPx) {
        if (pts.length < 2) return pts;
        const out = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];
            const d = Math.hypot(b.x - a.x, b.y - a.y);
            const steps = Math.max(1, Math.ceil(d / stepPx));
            for (let s = 1; s <= steps; s++) {
                const t = s / steps;
                out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            }
        }
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
                grad.addColorStop(0, 'hsla(48, 100%, 86%, 0.70)');
                grad.addColorStop(0.20, 'hsla(46, 95%, 66%, 0.50)');
                grad.addColorStop(0.42, 'hsla(42, 90%, 56%, 0.26)');
                grad.addColorStop(0.62, 'hsla(38, 85%, 50%, 0.09)');
                grad.addColorStop(0.78, 'hsla(36, 80%, 46%, 0.02)');
                grad.addColorStop(1, 'hsla(36, 80%, 46%, 0)');
            } else {
                const sat = deathDrop ? 95 : 88;
                grad.addColorStop(0, `hsla(${hue}, ${sat}%, 82%, 0.62)`);
                grad.addColorStop(0.22, `hsla(${hue}, ${sat}%, 64%, 0.44)`);
                grad.addColorStop(0.46, `hsla(${hue}, ${sat}%, 54%, 0.20)`);
                grad.addColorStop(0.64, `hsla(${hue}, ${sat}%, 50%, 0.06)`);
                grad.addColorStop(0.78, `hsla(${hue}, ${sat}%, 46%, 0.015)`);
                grad.addColorStop(1, `hsla(${hue}, ${sat}%, 46%, 0)`);
            }
            g.fillStyle = grad;
            g.fillRect(0, 0, sz, sz);
        });
    }

    /** Drop stale off-screen food; keep on-screen pellets through server view-culling gaps. */
    _pruneFoodCache(cx, cy, zoom, W, H, myHead, myRadius) {
        const margin = 480;
        const halfW = W / zoom / 2 + margin;
        const halfH = H / zoom / 2 + margin;
        for (const [id, f] of this.foodCache) {
            const miss = f._missStreak || 0;
            if (miss === 0) continue;

            const inView = Math.abs(f.x - cx) <= halfW && Math.abs(f.y - cy) <= halfH;

            // Eaten pellets: remove when near our head after a few missed ticks
            if (myHead && miss >= 3) {
                const dx = f.x - myHead.x;
                const dy = f.y - myHead.y;
                const eatR = (myRadius || 6) + (f.radius || 2) + 32;
                if (dx * dx + dy * dy <= eatR * eatR) {
                    this.foodCache.delete(id);
                    continue;
                }
            }

            // On-screen food: tolerate long culling gaps from server spatial filter
            if (inView) {
                if (miss >= 150) this.foodCache.delete(id);
                continue;
            }

            if (miss >= 40) this.foodCache.delete(id);
        }
    }

    _drawFood(ctx, food, toScreen, W, H, zoom) {
        for (const f of food) {
            const miss = f._missStreak || 0;
            if (miss > 8) continue;

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
            const screenR = Math.max(4.5, baseR * zoom * 1.4);
            const spriteR = 4;
            const sprite = this._foodSprite(hue, spriteR, !!f.golden, !!f.deathDrop);
            const size = sprite.width * (screenR / spriteR);
            const half = size / 2;
            const alpha = miss === 0 ? 1 : Math.max(0.35, 1 - miss * 0.08);
            ctx.globalAlpha = alpha;
            ctx.drawImage(sprite, Math.round(fx - half), Math.round(fy - half), size, size);
            ctx.globalAlpha = 1;
        }
    }

    /** Paint one snake segment — warm sphere highlight matching slither.io bead look. */
    _paintSnakeSegment(g, c, rPx, cs) {
        const col = parseColor(cs);
        const hi = shadeColor(col, 52);
        const lo = shadeColor(col, -30);
        const rim = {
            r: Math.max(0, col.r * 0.45),
            g: Math.max(0, col.g * 0.40),
            b: Math.max(0, col.b * 0.35),
        };

        const lx = c - rPx * 0.22;
        const ly = c - rPx * 0.30;
        const body = g.createRadialGradient(lx, ly, 0, c, c + rPx * 0.05, rPx);
        body.addColorStop(0,    toHex(hi));
        body.addColorStop(0.30, cs);
        body.addColorStop(0.68, toHex(lo));
        body.addColorStop(1,    toHex(rim));
        g.fillStyle = body;
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

        const normal = this._getSprite(`pr_norm_v9|${key}`, rPx * 2 + 4, (g, sz) => {
            this._paintSnakeSegment(g, sz / 2, rPx, cs);
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

        pair = { normal, boost };
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
        const cs = normalizeSnakeColor(snake.color);
        const boosting = !!snake.boost;

        const pts = [];
        for (let i = 0; i < segs.length; i++) {
            pts.push(toScreen(segs[i].x, segs[i].y));
        }

        const onScreen = pts.some(p => p.x > -120 && p.y > -120 && p.x < this.W + 120 && p.y < this.H + 120);
        if (!onScreen) return;

        const bumpStep = Math.max(2, bodyRadius * 0.50);
        const bumps = this._densifySpine(pts, bumpStep);
        if (bumps.length < 1) return;

        const r = Math.max(2.5, Math.round(bodyRadius));
        const { normal, boost: boostOverlay } = this._getSnakePrImgs(cs, r);
        const halfN = normal.width / 2;
        const halfB = boostOverlay.width / 2;

        // Pass 1: normal body — drawImage only
        for (let i = bumps.length - 1; i >= 0; i--) {
            const p = bumps[i];
            if (p.x < -80 || p.y < -80 || p.x > this.W + 80 || p.y > this.H + 80) continue;
            ctx.drawImage(normal, p.x - halfN, p.y - halfN);
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

        // Build render snakes from latest metadata + smoothed segments/angle
        const renderSnakes = this.targetSnakes.map(snake => {
            const s = this.smooth.get(snake.id);
            return s ? { ...snake, segments: s.segments, angle: s.angle } : snake;
        });

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
        this._pruneFoodCache(cx, cy, zoom, W, H, me?.segments?.[0], me?.radius);
        this._drawFood(ctx, Array.from(this.foodCache.values()), toScreen, W, H, zoom);

        const sorted = [...renderSnakes].sort((a, b) => {
            const ar = a.radius || 6;
            const br = b.radius || 6;
            return ar - br;
        });
        for (const snake of sorted) {
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
        this.running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        window.removeEventListener('resize', this._onResize);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mousedown', this._onMouseDown);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('touchmove', this._onTouchMove);
        document.removeEventListener('touchstart', this._onTouchStart);
        document.removeEventListener('touchend', this._onTouchEnd);
    }
}
