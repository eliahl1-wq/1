/**
 * Server-authoritative slither renderer — slither.io-inspired visuals.
 */

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
        this.snakeThickness = 0.88;
        // Pre-rendered sprite caches — gradients are expensive to build per frame
        this._sprites = new Map();
        this._hexTile = null;
        this._hexPattern = null;
        this._vignette = null;
        this._vigKey = '';
        this.inputDx = 0;
        this.inputDy = 0;
        this.boost = false;
        this.running = false;
        this._raf = null;
        this._frame = 0;

        this._onResize = () => this.resize();
        this._onMouseMove = (e) => this._handleMouse(e);
        this._onMouseDown = () => { this.boost = true; this._emitInput?.(); };
        this._onMouseUp = () => { this.boost = false; this._emitInput?.(); };
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
        if (this._sprites.size > 400) this._sprites.clear();
        const cv = document.createElement('canvas');
        const sz = Math.max(2, Math.ceil(size));
        cv.width = sz;
        cv.height = sz;
        painter(cv.getContext('2d'), sz);
        this._sprites.set(key, cv);
        return cv;
    }

    /**
     * Seamless hex-grid tile (slither.io style), supersampled 3x and reused
     * as a repeating canvas pattern — drawing hundreds of hex paths per
     * frame was a major frame-time cost.
     */
    _getHexPattern(ctx) {
        if (this._hexPattern) return this._hexPattern;
        const R = 34;
        const S = 3; // supersample so the pattern stays crisp at zoom ~3
        const sqrt3 = Math.sqrt(3);
        const tw = 3 * R;
        const th = sqrt3 * R;

        const cv = document.createElement('canvas');
        cv.width = Math.round(tw * S);
        cv.height = Math.round(th * S);
        const g = cv.getContext('2d');
        g.scale(S, S);
        g.strokeStyle = 'rgba(255, 255, 255, 0.045)';
        g.fillStyle = 'rgba(255, 255, 255, 0.006)';
        g.lineWidth = 1.1;

        const hexAt = (hx, hy) => {
            g.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i;
                const px = hx + R * Math.cos(a);
                const py = hy + R * Math.sin(a);
                if (i === 0) g.moveTo(px, py);
                else g.lineTo(px, py);
            }
            g.closePath();
            g.fill();
            g.stroke();
        };

        // Flat-top hex lattice: period (3R, sqrt(3)R), offset column halfway
        for (const [hx, hy] of [
            [0, 0], [tw, 0], [0, th], [tw, th],
            [tw / 2, th / 2], [tw / 2, -th / 2], [tw / 2, th * 1.5],
        ]) {
            hexAt(hx, hy);
        }

        this._hexTile = cv;
        this._hexPattern = ctx.createPattern(cv, 'repeat');
        // Pattern pixels are world-units * S — scale back so it maps 1:1 to world space
        if (this._hexPattern.setTransform) {
            this._hexPattern.setTransform(new DOMMatrix([1 / S, 0, 0, 1 / S, 0, 0]));
        }
        return this._hexPattern;
    }

    /** Cached edge-darkening vignette, slither.io style. */
    _getVignette(W, H) {
        const key = `${W}x${H}`;
        if (this._vignette && this._vigKey === key) return this._vignette;
        const cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        const g = cv.getContext('2d');
        const grad = g.createRadialGradient(
            W / 2, H / 2, Math.min(W, H) * 0.35,
            W / 2, H / 2, Math.hypot(W, H) * 0.62,
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.55)');
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
        this._vignette = cv;
        this._vigKey = key;
        return cv;
    }

    _drawBackground(ctx, W, H, cx, cy, worldHalf, toScreen, zoom) {
        ctx.fillStyle = '#060608';
        ctx.fillRect(0, 0, W, H);

        // Hex grid: fill the visible world rect with the cached repeating pattern
        const pattern = this._getHexPattern(ctx);
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-cx, -cy);
        ctx.fillStyle = pattern;
        const vw = W / zoom;
        const vh = H / zoom;
        ctx.fillRect(cx - vw / 2 - 2, cy - vh / 2 - 2, vw + 4, vh + 4);
        ctx.restore();

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

        ctx.drawImage(this._getVignette(W, H), 0, 0);
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

    /** Compact food pellet — tight glow, no huge transparent halos. */
    _foodSprite(hue, rPx, golden, deathDrop) {
        const halo = Math.ceil(rPx * 1.45);
        const key = `f2|${golden ? 'g' : hue}|${rPx}|${deathDrop ? 1 : 0}`;
        return this._getSprite(key, halo * 2 + 2, (g, sz) => {
            const c = sz / 2;
            if (golden) {
                const grad = g.createRadialGradient(c, c, 0, c, c, halo);
                grad.addColorStop(0, 'hsla(52, 100%, 92%, 1)');
                grad.addColorStop(0.35, 'hsla(48, 100%, 65%, 0.95)');
                grad.addColorStop(0.7, 'hsla(48, 100%, 58%, 0.45)');
                grad.addColorStop(1, 'hsla(48, 100%, 55%, 0)');
                g.fillStyle = grad;
                g.fillRect(0, 0, sz, sz);
                return;
            }
            const grad = g.createRadialGradient(c, c, 0, c, c, halo);
            grad.addColorStop(0, `hsla(${hue}, 100%, 88%, 1)`);
            grad.addColorStop(0.4, `hsla(${hue}, 95%, 62%, ${deathDrop ? 0.95 : 0.85})`);
            grad.addColorStop(0.75, `hsla(${hue}, 90%, 55%, 0.25)`);
            grad.addColorStop(1, `hsla(${hue}, 90%, 50%, 0)`);
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
        const SPRITE_R = 2.5;
        for (const f of food) {
            const miss = f._missStreak || 0;
            if (miss > 8) continue;

            const { x: fx, y: fy } = toScreen(f.x, f.y);
            if (fx < -80 || fy < -80 || fx > W + 80 || fy > H + 80) continue;

            const screenR = Math.max(1.2, (f.radius || 2) * zoom * 0.55);
            const hue = f.golden ? 48 : Math.round((f.hue ?? 120) / 15) * 15;
            const sprite = this._foodSprite(hue, SPRITE_R, !!f.golden, !!f.deathDrop);
            const size = sprite.width * (screenR / SPRITE_R);
            const half = size / 2;
            const alpha = miss === 0 ? 1 : Math.max(0.35, 1 - miss * 0.08);
            ctx.globalAlpha = alpha;
            ctx.drawImage(sprite, Math.round(fx - half), Math.round(fy - half), size, size);
            ctx.globalAlpha = 1;
        }
    }

    _drawSnakeSegment(ctx, sx, sy, radius, color, isHead, angle, boost, shimmer) {
        const base = parseColor(color);
        const light = shadeColor(base, 55);
        const dark = shadeColor(base, -45);

        if (boost && shimmer) {
            ctx.beginPath();
            ctx.arc(sx, sy, radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${0.12 + Math.sin(shimmer) * 0.08})`;
            ctx.fill();
        }

        const grad = ctx.createRadialGradient(
            sx - radius * 0.35, sy - radius * 0.35, radius * 0.1,
            sx, sy, radius,
        );
        grad.addColorStop(0, rgb(light));
        grad.addColorStop(0.45, rgb(base));
        grad.addColorStop(1, rgb(dark));

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = rgb(dark, 0.55);
        ctx.lineWidth = Math.max(1, radius * 0.12);
        ctx.stroke();

        if (isHead) {
            const eyeOffset = radius * 0.42;
            const eyeR = Math.max(1.5, radius * 0.22);
            const perpX = Math.sin(angle);
            const perpY = -Math.cos(angle);
            const fwdX = Math.cos(angle);
            const fwdY = Math.sin(angle);

            for (const side of [-1, 1]) {
                const ex = sx + fwdX * eyeOffset * 0.35 + perpX * eyeOffset * side;
                const ey = sy + fwdY * eyeOffset * 0.35 + perpY * eyeOffset * side;
                ctx.beginPath();
                ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(ex + fwdX * eyeR * 0.35, ey + fwdY * eyeR * 0.35, eyeR * 0.55, 0, Math.PI * 2);
                ctx.fillStyle = '#111';
                ctx.fill();
            }
        }
    }

    /** Body-circle sprite per (color, radius) — gradient baked once, blitted many times. */
    _bodySprite(colorHex, rPx, band = false) {
        const key = `b3|${colorHex}|${rPx}|${band ? 1 : 0}`;
        return this._getSprite(key, (rPx + 2) * 2, (g, sz) => {
            const c = sz / 2;
            const base = parseColor(colorHex);
            const lit = band ? shadeColor(base, 38) : base;
            // Top highlight → base → dark belly rim, like slither.io's shaded scales
            const grad = g.createRadialGradient(c - rPx * 0.3, c - rPx * 0.42, rPx * 0.05, c, c, rPx);
            grad.addColorStop(0, rgb(shadeColor(lit, 62)));
            grad.addColorStop(0.35, rgb(shadeColor(lit, 18)));
            grad.addColorStop(0.72, rgb(lit));
            grad.addColorStop(1, rgb(shadeColor(lit, -62)));
            g.fillStyle = grad;
            g.beginPath();
            g.arc(c, c, rPx, 0, Math.PI * 2);
            g.fill();
            // Thin dark rim for a crisp edge
            g.beginPath();
            g.arc(c, c, rPx - 0.5, 0, Math.PI * 2);
            g.strokeStyle = rgb(shadeColor(base, -80), 0.45);
            g.lineWidth = 1;
            g.stroke();
        });
    }

    _drawSnake(snake, toScreen, zoom) {
        const ctx = this.ctx;
        const segs = snake.segments || [];
        if (segs.length === 0) return;

        const thick = this.snakeThickness ?? 1;
        const headRadius = (snake.radius || 6) * zoom * thick;
        const bodyRadius = headRadius * 0.94;
        const angle = snake.angle || 0;
        const baseHex = snake.isYou ? '#7C58FF' : (snake.color || '#888888');
        const base = parseColor(baseHex);
        const light = shadeColor(base, 55);

        const pts = [];
        for (let i = 0; i < segs.length; i++) {
            pts.push(toScreen(segs[i].x, segs[i].y));
        }

        const onScreen = pts.some(p => p.x > -100 && p.y > -100 && p.x < this.W + 100 && p.y < this.H + 100);
        if (!onScreen) return;

        const bumpStep = Math.max(4, bodyRadius * 0.62);
        const bumps = this._densifySpine(pts, bumpStep);

        // Boost glow: pulsing halo in the snake's own color, under everything
        if (snake.boost) {
            const pulse = 0.30 + 0.14 * Math.sin(this._frame * 0.35);
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(bumps[bumps.length - 1].x, bumps[bumps.length - 1].y);
            for (let i = bumps.length - 2; i >= 0; i--) ctx.lineTo(bumps[i].x, bumps[i].y);
            ctx.lineWidth = bodyRadius * 2 + Math.max(8, bodyRadius * 0.9);
            ctx.strokeStyle = rgb(light, pulse);
            ctx.stroke();
            ctx.restore();
        }

        // Soft dark underlay so the body pops off the dark floor
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(bumps[bumps.length - 1].x, bumps[bumps.length - 1].y);
        for (let i = bumps.length - 2; i >= 0; i--) ctx.lineTo(bumps[i].x, bumps[i].y);
        ctx.lineWidth = bodyRadius * 2 + 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.stroke();
        ctx.restore();

        // Body circles, tail → head, tapering over the last stretch.
        // Every few bumps a lighter "band" circle fakes slither.io's ring stripes.
        const headScreen = pts[0];
        const skipNearHead = headRadius * 1.2;
        const taperCount = Math.min(bumps.length - 1, Math.max(6, Math.round(bumps.length * 0.22)));
        const bandEvery = Math.max(3, Math.round((bodyRadius * 2.1) / bumpStep));

        for (let i = bumps.length - 1; i >= 1; i--) {
            const p = bumps[i];
            if (Math.hypot(p.x - headScreen.x, p.y - headScreen.y) < skipNearHead) continue;
            if (p.x < -60 || p.y < -60 || p.x > this.W + 60 || p.y > this.H + 60) continue;

            const fromTail = bumps.length - 1 - i;
            let rf = 1;
            if (fromTail < taperCount) {
                const t = fromTail / taperCount;
                rf = 0.45 + 0.55 * t;
            }
            const r = Math.max(2, Math.round(bodyRadius * rf));
            const band = i % bandEvery === 0;
            const sprite = this._bodySprite(baseHex, r, band);
            const half = sprite.width / 2;
            ctx.drawImage(sprite, p.x - half, p.y - half);
        }

        // Head — slightly bigger than the body, like slither.io
        const { x: hx, y: hy } = pts[0];
        const rHead = Math.max(2, Math.round(headRadius * 1.04));
        const headSprite = this._bodySprite(baseHex, rHead);
        ctx.drawImage(headSprite, hx - headSprite.width / 2, hy - headSprite.width / 2);

        // Big cartoonish eyes with pupils that look where the snake is heading
        const perpX = Math.sin(angle);
        const perpY = -Math.cos(angle);
        const fwdX = Math.cos(angle);
        const fwdY = Math.sin(angle);
        const eyeSide = headRadius * 0.52;
        const eyeFwd = headRadius * 0.32;
        const eyeR = Math.max(2.5, headRadius * 0.38);
        const pupilR = eyeR * 0.52;
        for (const side of [-1, 1]) {
            const ex = hx + fwdX * eyeFwd + perpX * eyeSide * side;
            const ey = hy + fwdY * eyeFwd + perpY * eyeSide * side;
            // Sclera with subtle dark outline
            ctx.beginPath();
            ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = Math.max(1, eyeR * 0.12);
            ctx.stroke();
            // Pupil pushed toward travel direction
            const px = ex + fwdX * (eyeR - pupilR) * 0.75;
            const py = ey + fwdY * (eyeR - pupilR) * 0.75;
            ctx.beginPath();
            ctx.arc(px, py, pupilR, 0, Math.PI * 2);
            ctx.fillStyle = '#15151c';
            ctx.fill();
            // Tiny specular glint
            ctx.beginPath();
            ctx.arc(px - pupilR * 0.3, py - pupilR * 0.3, pupilR * 0.28, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fill();
        }

        if (snake.name) {
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.font = `bold ${Math.max(11, headRadius * 0.95)}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 3;
            ctx.strokeText(snake.name, hx, hy - headRadius - 10);
            ctx.fillText(snake.name, hx, hy - headRadius - 10);
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

        // Balance badge only — cashout timer lives in the React HUD (no canvas rings)
        if (me?.segments?.[0]) {
            const head = me.segments[0];
            const { x: hx, y: hy } = toScreen(head.x, head.y);
            const headRadius = (me.radius || 6) * zoom * (this.snakeThickness ?? 1);
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
