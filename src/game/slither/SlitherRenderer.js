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
        this.camera = { x: 0, y: 0 };
        this.zoom = 3.4;
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
        this.state = {
            snakes: tick.snakes ?? this.state.snakes,
            food: tick.food ?? this.state.food,
            you: tick.you ?? this.state.you,
            worldHalf: tick.worldHalf ?? this.state.worldHalf,
            zone: tick.zone !== undefined ? tick.zone : this.state.zone,
        };
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

    _drawBackground(ctx, W, H, cx, cy, worldHalf, toScreen) {
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, W, H);

        const gridStep = H / 18;
        const offsetX = ((W / 2 - cx * this.zoom) % gridStep + gridStep) % gridStep;
        const offsetY = ((H / 2 - cy * this.zoom) % gridStep + gridStep) % gridStep;

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.08;
        ctx.beginPath();
        for (let x = offsetX; x < W; x += gridStep) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
        }
        for (let y = offsetY; y < H; y += gridStep) {
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        const limit = worldHalf;
        const tl = toScreen(-limit, -limit);
        const br = toScreen(limit, limit);
        ctx.strokeStyle = 'rgba(124, 58, 255, 0.35)';
        ctx.lineWidth = 3;
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
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

    _drawFood(ctx, food, toScreen, W, H) {
        for (const f of food) {
            const { x: fx, y: fy } = toScreen(f.x, f.y);
            if (fx < -30 || fy < -30 || fx > W + 30 || fy > H + 30) continue;

            const r = f.radius || 5;
            const hue = f.hue ?? 120;

            ctx.beginPath();
            ctx.arc(fx, fy, r + 3, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, 90%, 55%, 0.25)`;
            ctx.fill();

            const grad = ctx.createRadialGradient(fx - r * 0.25, fy - r * 0.25, 0, fx, fy, r);
            grad.addColorStop(0, `hsl(${hue}, 100%, 85%)`);
            grad.addColorStop(0.55, `hsl(${hue}, 90%, 58%)`);
            grad.addColorStop(1, `hsl(${hue}, 80%, 38%)`);
            ctx.beginPath();
            ctx.arc(fx, fy, r, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
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

    _drawSnake(snake, toScreen) {
        const ctx = this.ctx;
        const segs = snake.segments || [];
        if (segs.length === 0) return;

        const headRadius = snake.radius || 6;
        const bodyRadius = headRadius * 0.92;
        const angle = snake.angle || 0;
        const color = snake.isYou ? '#7C58FF' : (snake.color || '#888888');
        const shimmer = this._frame * 0.15;

        for (let i = segs.length - 1; i >= 1; i--) {
            const { x: sx, y: sy } = toScreen(segs[i].x, segs[i].y);
            if (sx < -80 || sy < -80 || sx > this.W + 80 || sy > this.H + 80) continue;
            this._drawSnakeSegment(ctx, sx, sy, bodyRadius, color, false, angle, snake.boost, shimmer);
        }

        const { x: hx, y: hy } = toScreen(segs[0].x, segs[0].y);
        this._drawSnakeSegment(ctx, hx, hy, headRadius, color, true, angle, snake.boost, shimmer);

        if (snake.name) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = `bold ${Math.max(10, headRadius * 0.95)}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = 3;
            ctx.strokeText(snake.name, hx, hy - headRadius - 8);
            ctx.fillText(snake.name, hx, hy - headRadius - 8);
        }
    }

    draw() {
        const { snakes, food, worldHalf } = this.state;
        const ctx = this.ctx;
        const W = this.W;
        const H = this.H;

        const me = snakes.find(s => s.isYou);
        if (me?.segments?.[0]) {
            const head = me.segments[0];
            this.camera.x += (head.x - this.camera.x) * 0.28;
            this.camera.y += (head.y - this.camera.y) * 0.28;
        }

        const cx = this.camera.x;
        const cy = this.camera.y;
        const zoom = this.zoom;
        const toScreen = (wx, wy) => ({
            x: (wx - cx) * zoom + W / 2,
            y: (wy - cy) * zoom + H / 2,
        });

        this._drawBackground(ctx, W, H, cx, cy, worldHalf, toScreen);
        this._drawZone(ctx, toScreen, W, H);
        this._drawFood(ctx, food, toScreen, W, H);

        const sorted = [...snakes].sort((a, b) => {
            const ar = a.radius || 6;
            const br = b.radius || 6;
            return ar - br;
        });
        for (const snake of sorted) {
            this._drawSnake(snake, toScreen);
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
