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
        this.hud = { balance: 0, cashoutSeconds: 0, cashoutTotal: 10 };
        this.camera = { x: 0, y: 0 };
        this._cameraInit = false;
        this._lastFrameTime = 0;
        this.zoom = 3.2;
        this.baseZoom = 3.2;
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
        if (tick.snakes) this.targetSnakes = tick.snakes;
        const now = performance.now();
        if (tick.food) {
            const seen = new Set();
            for (const f of tick.food) {
                seen.add(f.id);
                this.foodCache.set(f.id, f);
            }
            for (const id of this.foodCache.keys()) {
                if (!seen.has(id)) this.foodCache.delete(id);
            }
        }
        this.state = {
            snakes: tick.snakes ?? this.state.snakes,
            food: Array.from(this.foodCache.values()),
            you: tick.you ?? this.state.you,
            worldHalf: tick.worldHalf ?? this.state.worldHalf,
            zone: tick.zone !== undefined ? tick.zone : this.state.zone,
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
            // Own snake snaps tighter for responsive control; others smoother
            // (tuned for 20Hz server broadcasts interpolated to 60fps)
            const tau = snake.isYou ? 0.045 : 0.075;
            const a = 1 - Math.exp(-dt / Math.max(tau, 0.0001));
            const tgt = snake.segments || [];
            let s = this.smooth.get(snake.id);
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
        const R = 52;
        const S = 3; // supersample so the pattern stays crisp at zoom ~3
        const sqrt3 = Math.sqrt(3);
        const tw = 3 * R;
        const th = sqrt3 * R;

        const cv = document.createElement('canvas');
        cv.width = Math.round(tw * S);
        cv.height = Math.round(th * S);
        const g = cv.getContext('2d');
        g.scale(S, S);
        g.strokeStyle = 'rgba(255, 255, 255, 0.085)';
        g.fillStyle = 'rgba(255, 255, 255, 0.012)';
        g.lineWidth = 1.2;

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

    _drawBackground(ctx, W, H, cx, cy, worldHalf, toScreen, zoom) {
        ctx.fillStyle = '#0d0d12';
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

        // Cached vignette (rebuilt only on resize)
        const vigKey = W + 'x' + H;
        if (this._vigKey !== vigKey) {
            const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.85);
            vig.addColorStop(0, 'rgba(0,0,0,0)');
            vig.addColorStop(1, 'rgba(0,0,0,0.28)');
            this._vignette = vig;
            this._vigKey = vigKey;
        }
        ctx.fillStyle = this._vignette;
        ctx.fillRect(0, 0, W, H);

        const limit = worldHalf;
        const tl = toScreen(-limit, -limit);
        const br = toScreen(limit, limit);
        ctx.strokeStyle = 'rgba(124, 58, 255, 0.35)';
        ctx.lineWidth = 3;
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
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
        ctx.fillStyle = 'rgba(255, 59, 48, 0.12)';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(zx, zy, screenRadius, 0, Math.PI * 2, true);
        ctx.fill('evenodd');

        ctx.strokeStyle = 'rgba(255, 107, 107, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(zx, zy, screenRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    /** Glowing food pellet baked into a sprite: soft halo + bright gradient core. */
    _foodSprite(hue, rPx, golden, deathDrop) {
        const halo = Math.ceil(rPx * 2.4);
        const key = `f|${golden ? 'g' : hue}|${rPx}|${deathDrop ? 1 : 0}`;
        return this._getSprite(key, halo * 2 + 2, (g, sz) => {
            const c = sz / 2;
            if (golden) {
                const haloGrad = g.createRadialGradient(c, c, rPx * 0.4, c, c, halo);
                haloGrad.addColorStop(0, 'hsla(48, 100%, 60%, 0.55)');
                haloGrad.addColorStop(1, 'hsla(48, 100%, 55%, 0)');
                g.fillStyle = haloGrad;
                g.fillRect(0, 0, sz, sz);
                const core = g.createRadialGradient(c - rPx * 0.25, c - rPx * 0.25, 0, c, c, rPx);
                core.addColorStop(0, 'hsl(52, 100%, 90%)');
                core.addColorStop(0.45, 'hsl(48, 100%, 65%)');
                core.addColorStop(1, 'hsl(40, 90%, 38%)');
                g.fillStyle = core;
                g.beginPath();
                g.arc(c, c, rPx, 0, Math.PI * 2);
                g.fill();
                return;
            }
            const haloA = deathDrop ? 0.5 : 0.38;
            const haloGrad = g.createRadialGradient(c, c, rPx * 0.4, c, c, halo);
            haloGrad.addColorStop(0, `hsla(${hue}, 95%, 60%, ${haloA})`);
            haloGrad.addColorStop(1, `hsla(${hue}, 95%, 58%, 0)`);
            g.fillStyle = haloGrad;
            g.fillRect(0, 0, sz, sz);
            const core = g.createRadialGradient(c - rPx * 0.28, c - rPx * 0.28, 0, c, c, rPx);
            core.addColorStop(0, `hsl(${hue}, 100%, 88%)`);
            core.addColorStop(0.45, `hsl(${hue}, 92%, 60%)`);
            core.addColorStop(1, `hsl(${hue}, 82%, 38%)`);
            g.fillStyle = core;
            g.beginPath();
            g.arc(c, c, rPx, 0, Math.PI * 2);
            g.fill();
        });
    }

    _drawFood(ctx, food, toScreen, W, H, zoom) {
        for (const f of food) {
            const { x: fx, y: fy } = toScreen(f.x, f.y);
            if (fx < -60 || fy < -60 || fx > W + 60 || fy > H + 60) continue;

            // Bucket hue/radius so a handful of sprites cover all pellets
            const rPx = Math.max(2, Math.round((f.radius || 5) * zoom));
            const hue = f.golden ? 48 : Math.round((f.hue ?? 120) / 12) * 12;
            const sprite = this._foodSprite(hue, rPx, !!f.golden, !!f.deathDrop);
            const half = sprite.width / 2;
            ctx.drawImage(sprite, fx - half, fy - half);
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
    _bodySprite(colorHex, rPx) {
        const key = `b|${colorHex}|${rPx}`;
        return this._getSprite(key, (rPx + 2) * 2, (g, sz) => {
            const c = sz / 2;
            const base = parseColor(colorHex);
            const grad = g.createRadialGradient(c - rPx * 0.35, c - rPx * 0.35, rPx * 0.08, c, c, rPx);
            grad.addColorStop(0, rgb(shadeColor(base, 45)));
            grad.addColorStop(0.5, rgb(base));
            grad.addColorStop(1, rgb(shadeColor(base, -55)));
            g.fillStyle = grad;
            g.beginPath();
            g.arc(c, c, rPx, 0, Math.PI * 2);
            g.fill();
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
        const light = shadeColor(base, 70);
        const dark = shadeColor(base, -55);

        const pts = [];
        for (let i = 0; i < segs.length; i++) {
            pts.push(toScreen(segs[i].x, segs[i].y));
        }

        const onScreen = pts.some(p => p.x > -100 && p.y > -100 && p.x < this.W + 100 && p.y < this.H + 100);
        if (!onScreen) return;

        const bumpStep = Math.max(4, bodyRadius * 0.72);
        const bumps = this._densifySpine(pts, bumpStep);

        // Dark under-stroke along spine for a clean outline
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(bumps[bumps.length - 1].x, bumps[bumps.length - 1].y);
        for (let i = bumps.length - 2; i >= 0; i--) ctx.lineTo(bumps[i].x, bumps[i].y);
        ctx.lineWidth = bodyRadius * 2 + 4;
        ctx.strokeStyle = rgb(dark, 0.85);
        ctx.stroke();
        ctx.restore();

        // Overlapping body circles (slither.io look) via cached sprites —
        // two radius buckets (tail/front) instead of a gradient per circle
        const rTail = Math.max(2, Math.round(bodyRadius * 0.9));
        const rFront = Math.max(2, Math.round(bodyRadius));
        const spriteTail = this._bodySprite(baseHex, rTail);
        const spriteFront = this._bodySprite(baseHex, rFront);
        const split = bumps.length * 0.45;
        for (let i = bumps.length - 1; i >= 0; i--) {
            const p = bumps[i];
            if (p.x < -60 || p.y < -60 || p.x > this.W + 60 || p.y > this.H + 60) continue;
            const sprite = i > split ? spriteTail : spriteFront;
            const half = sprite.width / 2;
            ctx.drawImage(sprite, p.x - half, p.y - half);
        }

        if (snake.boost) {
            const glow = 0.2 + Math.sin(this._frame * 0.25) * 0.1;
            ctx.beginPath();
            ctx.moveTo(bumps[bumps.length - 1].x, bumps[bumps.length - 1].y);
            for (let i = bumps.length - 2; i >= 0; i--) ctx.lineTo(bumps[i].x, bumps[i].y);
            ctx.lineWidth = bodyRadius * 2 + 10;
            ctx.lineCap = 'round';
            ctx.strokeStyle = rgb(light, glow);
            ctx.stroke();
        }

        // Head — slightly bigger sprite + outline ring
        const { x: hx, y: hy } = pts[0];
        const rHead = Math.max(2, Math.round(headRadius));
        const headSprite = this._bodySprite(baseHex, rHead);
        ctx.drawImage(headSprite, hx - headSprite.width / 2, hy - headSprite.width / 2);
        ctx.beginPath();
        ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1, headRadius * 0.14);
        ctx.strokeStyle = rgb(dark, 0.8);
        ctx.stroke();

        // Eyes
        const eyeOffset = headRadius * 0.5;
        const eyeR = Math.max(2, headRadius * 0.28);
        const perpX = Math.sin(angle);
        const perpY = -Math.cos(angle);
        const fwdX = Math.cos(angle);
        const fwdY = Math.sin(angle);
        for (const side of [-1, 1]) {
            const ex = hx + fwdX * eyeOffset * 0.45 + perpX * eyeOffset * side;
            const ey = hy + fwdY * eyeOffset * 0.45 + perpY * eyeOffset * side;
            ctx.beginPath();
            ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ex + fwdX * eyeR * 0.4, ey + fwdY * eyeR * 0.4, eyeR * 0.55, 0, Math.PI * 2);
            ctx.fillStyle = '#111';
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

    _drawCashoutOverlay(ctx, hx, hy, headRadius) {
        const total = this.hud.cashoutTotal || 10;
        const remaining = Math.max(0, this.hud.cashoutSeconds);
        const progress = remaining / total;
        const pulse = 0.7 + Math.sin(Date.now() * 0.009) * 0.3;
        const FULL = Math.PI * 2;

        const ringR = headRadius + 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(hx, hy, ringR, 0, FULL);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 5;
        ctx.stroke();

        if (progress > 0) {
            const start = -Math.PI / 2;
            const end = start + progress * FULL;
            ctx.beginPath();
            ctx.arc(hx, hy, ringR, start, end);
            const grad = ctx.createLinearGradient(hx - ringR, hy, hx + ringR, hy);
            grad.addColorStop(0, '#0DBF76');
            grad.addColorStop(1, '#14F195');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 5;
            ctx.globalAlpha = pulse;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        const label = 'SECURING';
        const timerText = `${remaining}s`;
        const labelSize = 9;
        const timerSize = 15;
        ctx.font = `700 ${labelSize}px system-ui, sans-serif`;
        const labelW = ctx.measureText(label).width;
        ctx.font = `900 ${timerSize}px ui-monospace, monospace`;
        const timerW = ctx.measureText(timerText).width;
        const pillW = Math.max(labelW, timerW) + 28;
        const pillH = labelSize + timerSize + 16;
        const pillX = hx - pillW / 2;
        const pillY = hy - headRadius - pillH - 22;

        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 12);
        ctx.fillStyle = 'rgba(6, 10, 8, 0.92)';
        ctx.fill();
        ctx.strokeStyle = `rgba(20, 241, 149, ${0.35 + pulse * 0.25})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const barPad = 10;
        const barY = pillY + pillH - 9;
        const barW = pillW - barPad * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.roundRect(pillX + barPad, barY, barW, 3, 2);
        ctx.fill();
        if (progress > 0) {
            ctx.fillStyle = '#14F195';
            ctx.beginPath();
            ctx.roundRect(pillX + barPad, barY, barW * progress, 3, 2);
            ctx.fill();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${labelSize}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText(label, hx, pillY + 12);
        ctx.font = `900 ${timerSize}px ui-monospace, monospace`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(timerText, hx, pillY + pillH * 0.52);
    }

    draw() {
        const { food, worldHalf } = this.state;
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
                const camA = 1 - Math.exp(-dt / 0.06);
                this.camera.x += (head.x - this.camera.x) * camA;
                this.camera.y += (head.y - this.camera.y) * camA;
            }

            // slither.io-style zoom-out as the snake grows
            const meR = me.radius || 6.2;
            const targetZoom = Math.min(this.baseZoom, Math.max(1.6, this.baseZoom * Math.pow(6.2 / meR, 0.4)));
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
        this._drawFood(ctx, food, toScreen, W, H, zoom);

        const sorted = [...renderSnakes].sort((a, b) => {
            const ar = a.radius || 6;
            const br = b.radius || 6;
            return ar - br;
        });
        for (const snake of sorted) {
            this._drawSnake(snake, toScreen, zoom);
        }

        // HUD over my snake: balance badge + cashout exit timer (matches Agar)
        if (me?.segments?.[0]) {
            const head = me.segments[0];
            const { x: hx, y: hy } = toScreen(head.x, head.y);
            const headRadius = (me.radius || 6) * zoom * (this.snakeThickness ?? 1);
            this._drawBalanceBadge(ctx, hx, hy + headRadius + 14, this.hud.balance ?? me.balance ?? 0, true);
            if (this.hud.cashoutSeconds > 0) {
                this._drawCashoutOverlay(ctx, hx, hy, headRadius);
            }
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
