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
        this.hud = { balance: 0, cashoutSeconds: 0, cashoutTotal: 20 };
        this.camera = { x: 0, y: 0 };
        this._cameraInit = false;
        this._lastFrameTime = 0;
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
        if (tick.snakes) this.targetSnakes = tick.snakes;
        this.state = {
            snakes: tick.snakes ?? this.state.snakes,
            food: tick.food ?? this.state.food,
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
            const tau = snake.isYou ? 0.03 : 0.055;
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

            if (f.golden) {
                const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.1;
                ctx.beginPath();
                ctx.arc(fx, fy, (r + 5) * pulse, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(48, 100%, 55%, 0.35)';
                ctx.fill();
                ctx.strokeStyle = 'hsl(45, 100%, 50%)';
                ctx.lineWidth = 2;
                ctx.stroke();
                const grad = ctx.createRadialGradient(fx - r * 0.2, fy - r * 0.2, 0, fx, fy, r);
                grad.addColorStop(0, 'hsl(52, 100%, 88%)');
                grad.addColorStop(0.5, 'hsl(48, 100%, 62%)');
                grad.addColorStop(1, 'hsl(40, 90%, 38%)');
                ctx.beginPath();
                ctx.arc(fx, fy, r, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
                continue;
            }

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
        const bodyRadius = headRadius * 0.9;
        const angle = snake.angle || 0;
        const baseHex = snake.isYou ? '#7C58FF' : (snake.color || '#888888');
        const base = parseColor(baseHex);
        const light = shadeColor(base, 70);
        const dark = shadeColor(base, -55);

        // Build screen-space path along the spine
        const pts = [];
        for (let i = 0; i < segs.length; i++) {
            const p = toScreen(segs[i].x, segs[i].y);
            pts.push(p);
        }

        // Cull if entirely off-screen
        const onScreen = pts.some(p => p.x > -100 && p.y > -100 && p.x < this.W + 100 && p.y < this.H + 100);
        if (!onScreen) return;

        const strokePath = (width, style) => {
            ctx.beginPath();
            ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            for (let i = pts.length - 2; i >= 0; i--) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = style;
            ctx.stroke();
        };

        // Boost aura
        if (snake.boost) {
            const glow = 0.25 + Math.sin(this._frame * 0.25) * 0.12;
            strokePath(bodyRadius * 2 + 8, rgb(light, glow));
        }

        // Dark outline
        strokePath(bodyRadius * 2 + 3, rgb(dark, 0.9));
        // Main body
        strokePath(bodyRadius * 2, rgb(base));
        // Soft inner shade for depth
        strokePath(bodyRadius * 1.35, rgb(shadeColor(base, 22), 0.9));
        // Glossy top highlight running along the spine
        strokePath(bodyRadius * 0.5, rgb(light, 0.55));

        // Pattern: alternating banding dots for a slithery texture
        for (let i = 1; i < pts.length; i += 2) {
            const p = pts[i];
            if (p.x < -40 || p.y < -40 || p.x > this.W + 40 || p.y > this.H + 40) continue;
            ctx.beginPath();
            ctx.arc(p.x, p.y, bodyRadius * 0.42, 0, Math.PI * 2);
            ctx.fillStyle = rgb(dark, 0.35);
            ctx.fill();
        }

        // Head
        const { x: hx, y: hy } = pts[0];
        const hGrad = ctx.createRadialGradient(
            hx - headRadius * 0.35, hy - headRadius * 0.35, headRadius * 0.1,
            hx, hy, headRadius,
        );
        hGrad.addColorStop(0, rgb(light));
        hGrad.addColorStop(0.5, rgb(base));
        hGrad.addColorStop(1, rgb(dark));
        ctx.beginPath();
        ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
        ctx.fillStyle = hGrad;
        ctx.fill();
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
        const total = this.hud.cashoutTotal || 20;
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

        const sorted = [...renderSnakes].sort((a, b) => {
            const ar = a.radius || 6;
            const br = b.radius || 6;
            return ar - br;
        });
        for (const snake of sorted) {
            this._drawSnake(snake, toScreen);
        }

        // HUD over my snake: balance badge + cashout exit timer (matches Agar)
        if (me?.segments?.[0]) {
            const head = me.segments[0];
            const { x: hx, y: hy } = toScreen(head.x, head.y);
            const headRadius = (me.radius || 6) * zoom;
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
