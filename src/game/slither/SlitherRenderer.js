/**
 * Server-authoritative slither renderer.
 * Draws state received from slitherTick events — no local simulation.
 */

export class SlitherRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.state = { snakes: [], food: [], you: null, worldHalf: 1000 };
        this.camera = { x: 0, y: 0 };
        this.inputDx = 0;
        this.inputDy = 0;
        this.boost = false;
        this.running = false;
        this._raf = null;

        this._onResize = () => this.resize();
        this._onMouseMove = (e) => this._handleMouse(e);
        this._onMouseDown = () => { this.boost = true; };
        this._onMouseUp = () => { this.boost = false; };
        this._onTouchMove = (e) => {
            e.preventDefault();
            const t = e.touches[0];
            this._setInputFromScreen(t.clientX, t.clientY);
        };
        this._onTouchStart = (e) => {
            this.boost = true;
            const t = e.touches[0];
            this._setInputFromScreen(t.clientX, t.clientY);
        };
        this._onTouchEnd = () => { this.boost = false; };

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
        const mag = Math.hypot(x, y) || 1;
        this.inputDx = (x / mag) * 4;
        this.inputDy = (y / mag) * 4;
    }

    _handleMouse(e) {
        this._setInputFromScreen(e.clientX, e.clientY);
    }

    getInput() {
        return { dx: this.inputDx, dy: this.inputDy, boost: this.boost };
    }

    updateState(tick) {
        this.state = {
            snakes: tick.snakes || [],
            food: tick.food || [],
            you: tick.you,
            worldHalf: tick.worldHalf || 1000,
        };
    }

    start() {
        if (this.running) return;
        this.running = true;
        const loop = () => {
            if (!this.running) return;
            this.draw();
            this._raf = requestAnimationFrame(loop);
        };
        this._raf = requestAnimationFrame(loop);
    }

    draw() {
        const { snakes, food, worldHalf } = this.state;
        const ctx = this.ctx;
        const W = this.W;
        const H = this.H;

        const me = snakes.find(s => s.isYou);
        if (me?.segments?.[0]) {
            const head = me.segments[0];
            this.camera.x += (head.x - this.camera.x) * 0.15;
            this.camera.y += (head.y - this.camera.y) * 0.15;
        }

        const cx = this.camera.x;
        const cy = this.camera.y;
        const toScreen = (wx, wy) => ({ x: wx - cx + W / 2, y: wy - cy + H / 2 });

        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, W, H);

        const step = 45;
        ctx.beginPath();
        ctx.strokeStyle = '#1d1d1f';
        ctx.lineWidth = 1;
        for (let x = (W / 2 - cx) % step; x < W; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
        }
        for (let y = (H / 2 - cy) % step; y < H; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
        }
        ctx.stroke();

        const limit = worldHalf;
        const tl = toScreen(-limit, -limit);
        ctx.strokeStyle = 'rgba(124, 58, 255, 0.35)';
        ctx.lineWidth = 3;
        ctx.strokeRect(tl.x, tl.y, limit * 2, limit * 2);

        for (const f of food) {
            const { x: fx, y: fy } = toScreen(f.x, f.y);
            if (fx < -20 || fy < -20 || fx > W + 20 || fy > H + 20) continue;
            ctx.beginPath();
            ctx.arc(fx, fy, 4, 0, Math.PI * 2);
            ctx.fillStyle = `hsl(${f.hue || 120}, 80%, 60%)`;
            ctx.fill();
        }

        for (const snake of snakes) {
            this._drawSnake(snake, toScreen);
        }
    }

    _drawSnake(snake, toScreen) {
        const ctx = this.ctx;
        const segs = snake.segments || [];
        if (segs.length === 0) return;

        const cents = Math.max(0, (snake.balance - 1) * 100);
        const radius = 8 * (1 + Math.pow(cents / 200, 0.35));
        const color = snake.isYou ? '#7C3AFF' : (snake.color || '#666');

        for (let i = segs.length - 1; i >= 1; i--) {
            const { x: sx, y: sy } = toScreen(segs[i].x, segs[i].y);
            if (sx < -50 || sy < -50 || sx > this.W + 50 || sy > this.H + 50) continue;
            ctx.beginPath();
            ctx.arc(sx, sy, radius * 0.75, 0, Math.PI * 2);
            ctx.fillStyle = snake.isYou ? 'rgba(124, 58, 255, 0.7)' : color;
            ctx.fill();
        }

        const { x: hx, y: hy } = toScreen(segs[0].x, segs[0].y);
        ctx.beginPath();
        ctx.arc(hx, hy, radius, 0, Math.PI * 2);
        ctx.fillStyle = snake.isYou ? '#7C3AFF' : color;
        ctx.fill();

        if (snake.name) {
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = 'bold 11px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(snake.name, hx, hy - radius - 6);
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
