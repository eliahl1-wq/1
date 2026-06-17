/**
 * Server-authoritative slither renderer — slither.io-inspired visuals.
 */

import { drawCashoutProgressRing, getCashoutRingProgress } from '../cashoutRing.js';
import { drawBalanceBadge } from '../balanceBadge.js';
import { drawGameMinimap, normalizeMinimapData } from '../minimap.js';
import { getGameScreenSize, GAME_LAYOUT_CHANGE } from '../../utils/forcedLandscape.js';
import { unlockGameAudio } from '../../audio/synthSounds.js';
import { rebuildPathFromSegments, resetVisualGrowth, stepSnakeBody } from './snakePath.js';
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
        // Opaque canvas — background is fully painted every frame, so skipping the
        // alpha channel makes page compositing cheaper with no visual change.
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'medium';
        // Body sprites are authored at this supersample factor and blitted down,
        // which gives crisp, well-antialiased snake edges instead of upscaled-blurry ones.
        this._bodySS = 2;
        this.state = { snakes: [], food: [], you: null, worldHalf: 3000, zone: null, minimap: [] };
        // Latest authoritative snakes from the server + smoothed render copies (interpolation)
        this.targetSnakes = [];
        this.smooth = new Map();
        this._foodDrawList = [];
        this.hud = { balance: 1, cashoutSeconds: 0, cashoutTotal: 10, cashoutEndAt: 0, holdProgress: 0 };
        this.camera = { x: 0, y: 0 };
        this._cameraInit = false;
        this._lastFrameTime = 0;
        this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
        this.baseZoom = this.isMobile ? 2.05 : 2.65;
        this.zoom = this.baseZoom;
        this.snakeThickness = this.isMobile ? 1.0 : 0.9;
        this._dpr = 1;
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
        this._inputEnabled = true;
        this.spectatorMode = false;
        this._inputEmitQueued = false;
        this._lastTapAt = 0;
        this.running = false;
        this._raf = null;
        this._frame = 0;
        this._renderSnakeBuf = [];
        this._sortedRenderSnakes = [];
        this._bumpsBuf = [];
        this._renderPool = new Map();
        this._bumpPool = [];
        this._boostTrailPool = new Map();
        this._smoothSeen = new Set();
        this._screenScratch = { x: 0, y: 0 };
        this._perfEma = 16.7;
        this._quality = 1;
        this._minimapFallback = { players: [], food: [] };
        this._minimapFrame = 0;

        this._onResize = () => this.resize();
        this._onLayoutChange = () => this.resize();
        this._onMouseMove = (e) => this._handleMouse(e);
        this._onMouseDown = (e) => {
            if (!this._inputEnabled || this.spectatorMode) return;
            if (e.target !== this.canvas) return;
            unlockGameAudio();
            this.boost = true;
            this._emitInput?.();
        };
        this._onMouseUp = (e) => {
            if (!this._inputEnabled || this.spectatorMode) return;
            if (e.target !== this.canvas) return;
            this.boost = false;
            this._emitInput?.();
        };
        // slither.io mobile: press-and-hold steers (snake follows finger relative to
        // the head); boost is a double-tap-and-hold or a second finger — a plain
        // touch must NOT boost, otherwise steering bleeds mass on every turn.
        this._onTouchMove = (e) => {
            if (!this._inputEnabled || this.spectatorMode) return;
            e.preventDefault();
            const t = e.touches[0];
            if (t) this._setInputFromScreen(t.clientX, t.clientY);
        };
        this._onTouchStart = (e) => {
            if (!this._inputEnabled || this.spectatorMode) return;
            unlockGameAudio();
            const t = e.touches[0];
            if (t) this._setInputFromScreen(t.clientX, t.clientY);
            const now = Date.now();
            if (e.touches.length >= 2 || (now - this._lastTapAt) < 300) {
                this.boost = true;
            }
            this._lastTapAt = now;
            this._emitInput?.();
        };
        this._onTouchEnd = (e) => {
            if (!this._inputEnabled || this.spectatorMode) return;
            if (!e?.touches || e.touches.length === 0) this.boost = false;
            this._emitInput?.();
        };

        window.addEventListener('resize', this._onResize);
        window.addEventListener(GAME_LAYOUT_CHANGE, this._onLayoutChange);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mouseup', this._onMouseUp);
        document.addEventListener('touchmove', this._onTouchMove, { passive: false });
        document.addEventListener('touchstart', this._onTouchStart, { passive: false });
        document.addEventListener('touchend', this._onTouchEnd);

        this.resize();
    }

    resize() {
        const { width, height } = getGameScreenSize();
        const rawDpr = window.devicePixelRatio || 1;
        this._dpr = this.isMobile ? Math.min(1.75, rawDpr) : Math.min(2, rawDpr);
        if (this._dpr < 1) this._dpr = 1;
        this.canvas.width = Math.round(width * this._dpr);
        this.canvas.height = Math.round(height * this._dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.W = width;
        this.H = height;
    }

    _scheduleInputEmit() {
        if (this._inputEmitQueued) return;
        this._inputEmitQueued = true;
        requestAnimationFrame(() => {
            this._inputEmitQueued = false;
            this._emitInput?.();
        });
    }

    _setInputFromScreen(sx, sy) {
        if (!this._inputEnabled || this.spectatorMode) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = sx - rect.left - this.W / 2;
        const y = sy - rect.top - this.H / 2;
        const mag = Math.hypot(x, y);
        if (mag < 6) return;
        const ndx = (x / mag) * 4;
        const ndy = (y / mag) * 4;
        if (Math.abs(ndx - this.inputDx) < 0.02 && Math.abs(ndy - this.inputDy) < 0.02) return;
        this.inputDx = ndx;
        this.inputDy = ndy;
        this._scheduleInputEmit();
    }

    setInputEmitter(fn) {
        this._emitInput = fn;
    }

    setBoost(active) {
        this.boost = !!active;
        this._emitInput?.();
    }

    _handleMouse(e) {
        if (!this._inputEnabled || this.spectatorMode) return;
        this._setInputFromScreen(e.clientX, e.clientY);
    }

    getInput() {
        return { dx: this.inputDx, dy: this.inputDy, boost: this.boost };
    }

    updateState(tick) {
        if (tick.snakes) {
            this.targetSnakes = tick.snakes;
        }
        if (tick.food) {
            const list = this._foodDrawList;
            list.length = tick.food.length;
            for (let i = 0; i < tick.food.length; i++) {
                list[i] = tick.food[i];
            }
        }
        const isCompetitive = tick.competitiveSlither ?? this.state.competitiveSlither;
        const nextYou = tick.spectating
            ? null
            : (tick.you !== undefined ? tick.you : this.state.you);
        this.state = {
            snakes: tick.snakes ?? this.state.snakes,
            you: nextYou,
            worldHalf: tick.worldHalf ?? this.state.worldHalf,
            zone: isCompetitive
                ? (tick.zone !== undefined ? tick.zone : this.state.zone)
                : (tick.battleRoyale ? (tick.zone !== undefined ? tick.zone : this.state.zone) : null),
            minimap: tick.minimap ?? this.state.minimap,
            circularMap: tick.circularMap ?? this.state.circularMap,
            competitiveSlither: isCompetitive,
        };
        if (tick.battleRoyale !== undefined) {
            this.state.battleRoyale = !!tick.battleRoyale;
        }
        if (isCompetitive && tick.dollarBalance != null) {
            this.hud.balance = tick.dollarBalance;
        } else if (!isCompetitive && tick.balance != null && !tick.battleRoyale) {
            this.hud.balance = tick.balance;
        }
    }

    _smoothSeg(s, i, x, y) {
        let p = s.segments[i];
        if (!p) {
            p = { x: 0, y: 0 };
            s.segments[i] = p;
        }
        p.x = x;
        p.y = y;
        return p;
    }

    resetSession() {
        this.smooth.clear();
        this._renderPool.clear();
        this._boostTrailPool.clear();
        this._cameraInit = false;
        this.camera.x = 0;
        this.camera.y = 0;
        this.zoom = this.baseZoom;
        this.targetSnakes = [];
        this.state = { ...this.state, you: null };
    }

    removeSnake(id) {
        if (!id) return;
        this.smooth.delete(id);
        this._renderPool.delete(id);
        this._boostTrailPool.delete(id);
        this.targetSnakes = this.targetSnakes.filter(s => s.id !== id);
        if (this.state.you === id) {
            this.state = { ...this.state, you: null };
        }
    }

    setHud(hud) {
        for (const key in hud) {
            if (hud[key] !== undefined) this.hud[key] = hud[key];
        }
    }

    _isCashoutActive(nowMs = Date.now()) {
        const end = this.hud.cashoutEndAt;
        return end > 0 && end > nowMs;
    }

    setInputEnabled(enabled) {
        this._inputEnabled = !!enabled;
        if (!enabled) {
            this.inputDx = 0;
            this.inputDy = 0;
            this.boost = false;
        }
    }

    setSpectatorMode(active, camera) {
        this.spectatorMode = !!active;
        if (active && camera) {
            if (camera.x != null) this.camera.x = camera.x;
            if (camera.y != null) this.camera.y = camera.y;
            if (camera.zoom != null) this.zoom = camera.zoom;
            this._cameraInit = true;
        }
    }

    /**
     * Local snake: path body at display rate. Remote snakes: lerp spine only (cheaper).
     */
    _updateSmoothing(dt) {
        const SNAP_SQ = 220 * 220;
        const seen = this._smoothSeen;
        seen.clear();
        const cx = this.camera.x;
        const cy = this.camera.y;
        const viewR = 3200;

        for (const snake of this.targetSnakes) {
            seen.add(snake.id);
            const tgt = snake.segments || [];
            const spineLen = tgt.length;
            if (spineLen === 0 || !tgt[0]) continue;

            const segCount = snake.sct || spineLen;
            const head = tgt[0];
            const offScreen = head && !snake.isYou && (head.x - cx) ** 2 + (head.y - cy) ** 2 > viewR * viewR;

            let s = this.smooth.get(snake.id);
            if (!s) {
                s = { segments: [], angle: snake.angle || 0, path: null };
                this.smooth.set(snake.id, s);
                for (let i = 0; i < spineLen; i++) this._smoothSeg(s, i, tgt[i].x, tgt[i].y);
                s.angle = snake.angle || 0;
                if (snake.isYou) {
                    rebuildPathFromSegments(s, s.segments);
                    resetVisualGrowth(s, snake.radius, segCount);
                }
                continue;
            }

            const meta = {
                segmentCount: segCount,
                sc: snake.sc,
                radius: snake.radius,
            };

            if (snake.isYou) {
                const headDx = tgt[0].x - (s.segments[0]?.x ?? tgt[0].x);
                const headDy = tgt[0].y - (s.segments[0]?.y ?? tgt[0].y);
                if (headDx * headDx + headDy * headDy > SNAP_SQ) {
                    for (let i = 0; i < spineLen; i++) this._smoothSeg(s, i, tgt[i].x, tgt[i].y);
                    s.angle = snake.angle || 0;
                    rebuildPathFromSegments(s, s.segments);
                    resetVisualGrowth(s, snake.radius, segCount);
                    delete s._prevSrvHead;
                    delete s._extrapX;
                    delete s._extrapY;
                }
                stepSnakeBody(s, meta, tgt[0], snake.angle || 0, dt, 0.028);
                continue;
            }

            if (offScreen) {
                for (let i = 0; i < spineLen; i++) this._smoothSeg(s, i, tgt[i].x, tgt[i].y);
                s.angle = snake.angle || 0;
                continue;
            }

            const tau = 0.08;
            const a = 1 - Math.exp(-dt / tau);
            for (let i = 0; i < spineLen; i++) {
                if (i >= s.segments.length) this._smoothSeg(s, i, tgt[i].x, tgt[i].y);
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
            if (s.segments.length > spineLen) s.segments.length = spineLen;
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
        for (const id of this._boostTrailPool.keys()) {
            if (!seen.has(id)) this._boostTrailPool.delete(id);
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
        if (this._sprites.size >= 512) {
            const entries = [...this._sprites.entries()]
                .sort((a, b) => (a[1]._lastUsed || 0) - (b[1]._lastUsed || 0));
            for (let i = 0; i < 96 && i < entries.length; i++) {
                this._sprites.delete(entries[i][0]);
            }
            if (this._prImgs.size > 200) {
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

    _drawBackground(ctx, W, H, cx, cy, worldHalf, zoom) {
        ctx.fillStyle = '#1e1e24';
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
            ctx.fillRect(cx - vw / 2 - margin, cy - vh / 2 - margin, vw + margin * 2, vh + margin * 2);
            ctx.restore();
        }

        const limit = worldHalf;
        // Inline projection — toScreen() reuses a scratch object and must not be called twice here.
        const tlX = (-limit - cx) * zoom + W / 2;
        const tlY = (-limit - cy) * zoom + H / 2;
        const brX = (limit - cx) * zoom + W / 2;
        const brY = (limit - cy) * zoom + H / 2;
        const playW = brX - tlX;
        const playH = brY - tlY;
        ctx.save();
        ctx.fillStyle = 'rgba(72, 4, 9, 0.96)';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.rect(tlX, tlY, playW, playH);
        ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(255, 45, 45, 0.28)';
        ctx.lineWidth = 14;
        ctx.strokeRect(tlX, tlY, playW, playH);
        ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
        ctx.lineWidth = 3;
        ctx.strokeRect(tlX, tlY, playW, playH);
        ctx.restore();
    }

    _drawCircularBackground(ctx, W, H, cx, cy, worldHalf, zoom, zone) {
        ctx.fillStyle = '#1e1e24';
        ctx.fillRect(0, 0, W, H);

        const radius = zone?.radius ?? worldHalf;
        const pattern = this._getBgPattern(ctx);
        const { x: zx, y: zy } = { x: (0 - cx) * zoom + W / 2, y: (0 - cy) * zoom + H / 2 };
        const screenRadius = radius * zoom;

        if (pattern) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(zx, zy, screenRadius, 0, Math.PI * 2);
            ctx.clip();
            ctx.translate(W / 2, H / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-cx, -cy);
            ctx.fillStyle = pattern;
            const vw = W / zoom;
            const vh = H / zoom;
            const margin = 240;
            ctx.fillRect(cx - vw / 2 - margin, cy - vh / 2 - margin, vw + margin * 2, vh + margin * 2);
            ctx.restore();
        }

        ctx.save();
        ctx.fillStyle = 'rgba(72, 4, 9, 0.96)';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(zx, zy, screenRadius, 0, Math.PI * 2, true);
        ctx.fill('evenodd');

        const shrinking = zone?.shrinking;
        ctx.strokeStyle = shrinking ? 'rgba(255, 85, 85, 0.95)' : 'rgba(255, 60, 60, 0.9)';
        ctx.lineWidth = shrinking ? 5 : 3;
        if (shrinking) {
            ctx.setLineDash([14, 10]);
        }
        ctx.beginPath();
        ctx.arc(zx, zy, screenRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    _bumpPoint(i, x, y) {
        let p = this._bumpPool[i];
        if (!p) {
            p = { x: 0, y: 0 };
            this._bumpPool[i] = p;
        }
        p.x = x;
        p.y = y;
        return p;
    }

    /**
     * Render-only path interpolation: resample a spine at a fixed world-space
     * interval for stamping. Step is never widened — stamps stay tightly packed
     * even during fast motion. Output points are pooled via _bumpPoint.
     */
    _interpolateSnakeDrawPath(spine, stepWorld, maxPoints, out) {
        out.length = 0;
        const n = spine.length;
        if (n === 0) return out;
        if (n === 1) {
            out.push(this._bumpPoint(0, spine[0].x, spine[0].y));
            return out;
        }

        const step = Math.max(0.0001, stepWorld);
        let bi = 0;
        out.push(this._bumpPoint(bi++, spine[0].x, spine[0].y));

        let acc = 0;
        let ax = spine[0].x;
        let ay = spine[0].y;
        for (let i = 1; i < n && bi < maxPoints; i++) {
            const bx = spine[i].x;
            const by = spine[i].y;
            let dx = bx - ax;
            let dy = by - ay;
            let segLen = Math.sqrt(dx * dx + dy * dy);

            while (segLen > 0 && acc + segLen >= step && bi < maxPoints) {
                const t = (step - acc) / segLen;
                ax += dx * t;
                ay += dy * t;
                out.push(this._bumpPoint(bi++, ax, ay));
                acc = 0;
                dx = bx - ax;
                dy = by - ay;
                segLen = Math.sqrt(dx * dx + dy * dy);
            }
            acc += segLen;
            ax = bx;
            ay = by;
        }

        const tail = spine[n - 1];
        const last = out[out.length - 1];
        if (bi < maxPoints && (last.x !== tail.x || last.y !== tail.y)) {
            out.push(this._bumpPoint(bi, tail.x, tail.y));
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
        const halo = Math.ceil(rPx * (golden ? 2.6 : deathDrop ? 1.95 : 1.7));
        const key = `f10|${golden ? 'g' : hue}|${rPx}|${deathDrop ? 1 : 0}`;
        return this._getSprite(key, halo * 2 + 4, (g, sz) => {
            const c = sz / 2;
            const grad = g.createRadialGradient(c, c, 0, c, c, halo);
            if (golden) {
                // High quality golden orb: bright white-yellow core, strong gold mid, soft amber outer
                grad.addColorStop(0, 'hsla(55, 100%, 100%, 1)');
                grad.addColorStop(0.12, 'hsla(50, 100%, 85%, 0.95)');
                grad.addColorStop(0.30, 'hsla(45, 100%, 65%, 0.75)');
                grad.addColorStop(0.55, 'hsla(40, 100%, 50%, 0.35)');
                grad.addColorStop(0.80, 'hsla(35, 100%, 40%, 0.10)');
                grad.addColorStop(1, 'hsla(30, 100%, 30%, 0)');
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
        const now = performance.now();
        const cx = this.camera.x;
        const cy = this.camera.y;
        const halfW = W / 2 / zoom + 160 / zoom;
        const halfH = H / 2 / zoom + 160 / zoom;
        const simpleFood = this._quality < 0.45;
        const foodStride = this._quality < 0.38 ? 2 : 1;
        const skipMagnet = this._quality < 0.55;
        const skipWobble = false;

        // Magnet: food within this world radius of the mouth drifts toward it.
        const mouthValid = !skipMagnet && this._mouthValid;
        const mouthX = this._mouthX;
        const mouthY = this._mouthY;
        const attractR = ((this._mouthR || 6) * 3.6) + 54;
        const attractR2 = attractR * attractR;
        const maxPull = attractR * 0.42;

        for (let fi = 0; fi < foodList.length; fi += foodStride) {
            const f = foodList[fi];
            if (Math.abs(f.x - cx) > halfW || Math.abs(f.y - cy) > halfH) continue;

            // Per-food random phase so pulse/jiggle isn't synchronized across the field.
            if (f._phase == null) {
                let h = 0;
                const id = String(f.id ?? `${f.x},${f.y}`);
                for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
                f._phase = (Math.abs(h) % 1000) / 1000 * Math.PI * 2;
                f._sizeMul = 0.72 + (Math.abs(h) % 100) / 100 * 0.65;
            }

            // Live world position with a tiny wobble + magnet pull toward the mouth.
            let wx = f.x;
            let wy = f.y;

            const isGolden = !!f.golden;
            const hue = isGolden ? 48 : Math.round((f.hue ?? 120) / 12) * 12;

            let sizeMul = 1;
            let alpha = 1;

            if (!skipWobble) {
                if (isGolden) {
                    const pulse = Math.sin(now * 0.006 + f.x) * 0.15;
                    sizeMul = 0.85 + pulse;
                    wx += Math.sin(now * 0.003 + f.y) * 6;
                    wy += Math.cos(now * 0.0035 + f.x) * 6;
                    alpha = 0.75 + Math.sin(now * 0.008 + f.x + f.y) * 0.25;
                } else if (f.deathDrop) {
                    sizeMul = 1.25 + ((f.radius || 3) - 2) * 0.15;
                    sizeMul *= 1 + Math.sin(now * 0.0035 + f._phase) * 0.07;
                    wx += Math.sin(now * 0.0022 + f._phase) * 1.4;
                    wy += Math.cos(now * 0.0026 + f._phase * 1.3) * 1.4;
                } else {
                    sizeMul = f._sizeMul * (1 + Math.sin(now * 0.004 + f._phase) * 0.09);
                    wx += Math.sin(now * 0.0024 + f._phase) * 1.5;
                    wy += Math.cos(now * 0.0028 + f._phase * 1.3) * 1.5;
                }
            } else if (f.deathDrop) {
                sizeMul = 1.25 + ((f.radius || 3) - 2) * 0.15;
            } else if (!isGolden) {
                sizeMul = f._sizeMul;
            }

            // Magnet attraction — pull toward the mouth, easing in as it gets closer.
            if (mouthValid) {
                const dxm = mouthX - wx;
                const dym = mouthY - wy;
                const dist2 = dxm * dxm + dym * dym;
                if (dist2 < attractR2 && dist2 > 0.01) {
                    const dist = Math.sqrt(dist2);
                    const t = 1 - dist / attractR;
                    const pull = Math.min(t * t * maxPull, dist);
                    wx += (dxm / dist) * pull;
                    wy += (dym / dist) * pull;
                }
            }

            let { x: fx, y: fy } = toScreen(wx, wy);

            const baseR = (f.radius || 3) * sizeMul;
            const screenR = Math.max(4.5, baseR * zoom * 1.65);

            if (simpleFood && !isGolden) {
                ctx.globalAlpha = f.deathDrop ? 0.85 : 0.55;
                ctx.fillStyle = f.deathDrop
                    ? `hsla(${hue}, 95%, 62%, 0.75)`
                    : `hsla(${hue}, 82%, 58%, 0.5)`;
                ctx.beginPath();
                ctx.arc(fx, fy, screenR * 0.55, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                continue;
            }

            const spriteR = 4;
            const sprite = this._foodSprite(hue, spriteR, isGolden, !!f.deathDrop);
            const size = sprite.width * (screenR / spriteR);
            const half = size / 2;

            if (isGolden) {
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.globalCompositeOperation = 'lighter';
                ctx.drawImage(sprite, Math.round(fx - half), Math.round(fy - half), size, size);
                ctx.restore();
            } else {
                ctx.drawImage(sprite, Math.round(fx - half), Math.round(fy - half), size, size);
            }
        }
    }

    _blitSprite(ctx, sprite, x, y, scale = 1) {
        if (scale === 1) {
            const half = sprite.width >> 1;
            ctx.drawImage(sprite, (x - half) | 0, (y - half) | 0);
            return;
        }
        // Supersampled sprite — draw at its intended display size (downscale = crisp AA edges).
        const dw = sprite.width / scale;
        const dh = sprite.height / scale;
        ctx.drawImage(sprite, x - dw / 2, y - dh / 2, dw, dh);
    }

    /** Tangent angle at bump index (radians, toward head). */
    _bumpTangent(bumps, i) {
        if (bumps.length < 2) return 0;
        if (i <= 0) {
            const a = bumps[0];
            const b = bumps[1];
            return Math.atan2(a.y - b.y, a.x - b.x);
        }
        if (i >= bumps.length - 1) {
            const a = bumps[i];
            const b = bumps[i - 1];
            return Math.atan2(b.y - a.y, b.x - a.x);
        }
        const prev = bumps[i - 1];
        const next = bumps[i + 1];
        return Math.atan2(prev.y - next.y, prev.x - next.x);
    }

    /**
     * Glossy gel-like segment — radial body, top-left specular, bottom-right depth.
     * Designed to overlap heavily to form a continuous rubber-like tube.
     */
    _paintSnakeSegment(g, c, rPx, cs, phase = 0, contrast = 1) {
        const col = parseColor(cs);
        const k = contrast;
        
        // 1. Base Radial Gradient
        // Offset center slightly up to simulate top-down light
        const baseGrad = g.createRadialGradient(c, c - rPx * 0.16, rPx * 0.12, c, c, rPx);
        const centerCol = shadeColor(col, Math.round(12 * k));
        const midCol = col;
        const edgeCol = shadeColor(col, Math.round(-34 * k));
        
        baseGrad.addColorStop(0, toHex(centerCol));
        baseGrad.addColorStop(0.6, toHex(midCol));
        baseGrad.addColorStop(1, toHex(edgeCol));
        
        g.fillStyle = baseGrad;
        g.beginPath();
        g.arc(c, c, rPx, 0, Math.PI * 2);
        g.fill();

        // 2. Specular Highlight (Top band) — alternate phase shifts band like slither.io bumps
        const hiCol = shadeColor(col, Math.round(58 * k));
        const hiGrad = g.createLinearGradient(c, c - rPx, c, c + rPx);
        const hiStart = phase ? 0.07 : 0.05;
        const hiPeak = phase ? 0.16 : 0.13;
        const hiEnd = phase ? 0.28 : 0.25;
        hiGrad.addColorStop(hiStart, 'rgba(255,255,255,0)');
        hiGrad.addColorStop(hiPeak, rgb(hiCol, 0.26 * k));
        hiGrad.addColorStop(hiEnd, rgb(hiCol, 0.045 * k));
        hiGrad.addColorStop(hiEnd + 0.06, 'rgba(255,255,255,0)');
        
        g.fillStyle = hiGrad;
        g.fill();

        // 3. Ambient Shadow (Bottom)
        const shCol = shadeColor(col, Math.round(-52 * k));
        const shGrad = g.createLinearGradient(c, c - rPx, c, c + rPx);
        shGrad.addColorStop(0.68, 'rgba(0,0,0,0)');
        shGrad.addColorStop(0.94, rgb(shCol, 0.4 * k));
        shGrad.addColorStop(1.0, rgb(shCol, 0.56 * k));
        
        g.fillStyle = shGrad;
        g.fill();

        // 4. Soft edge vignette to hide metallic hard segment border.
        const edgeShadow = g.createRadialGradient(c, c, rPx * 0.72, c, c, rPx * 1.03);
        edgeShadow.addColorStop(0, 'rgba(0,0,0,0)');
        edgeShadow.addColorStop(0.88, 'rgba(0,0,0,0)');
        edgeShadow.addColorStop(1, rgb(shadeColor(col, -30), 0.16 * k));
        g.fillStyle = edgeShadow;
        g.beginPath();
        g.arc(c, c, rPx, 0, Math.PI * 2);
        g.fill();
    }

    /** Soft outer glow for additive body pass. Extremely subtle bloom. */
    _paintSnakeGlow(g, c, rPx, cs) {
        const col = parseColor(cs);
        const bright = shadeColor(col, 20);
        const glowR = rPx * 1.35;
        const grad = g.createRadialGradient(c, c, rPx * 0.4, c, c, glowR);
        grad.addColorStop(0, rgb(bright, 0.1));
        grad.addColorStop(0.5, rgb(col, 0.04));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(c, c, glowR, 0, Math.PI * 2);
        g.fill();
    }

    /**
     * Pre-render normal segment + optional glow/boost overlays into o.pr_imgs cache.
     * Heavy overlays are built lazily — remote snakes only need normal/alt/boostBody.
     */
    _getSnakePrImgs(cs, rPx, needs = {}) {
        const key = `${cs}|${rPx}`;
        let pair = this._prImgs.get(key);
        const bodySS = rPx <= 44 ? this._bodySS : rPx <= 84 ? 1.5 : 1.25;

        if (!pair) {
            pair = { bodySS };
            this._prImgs.set(key, pair);
        } else {
            pair.bodySS = bodySS;
        }

        const ssR = rPx * bodySS;
        const ssSize = ssR * 2 + 4;

        if (!pair.normal) {
            pair.normal = this._getSprite(`pr_norm_v21|${key}|0`, ssSize, (g, sz) => {
                this._paintSnakeSegment(g, sz / 2, ssR, cs, 0, 1);
            });
            pair.alt = this._getSprite(`pr_norm_v21|${key}|1`, ssSize, (g, sz) => {
                this._paintSnakeSegment(g, sz / 2, ssR, cs, 1, 1);
            });
            pair.boostBody = this._getSprite(`pr_norm_v21|${key}|boost`, ssSize, (g, sz) => {
                this._paintSnakeSegment(g, sz / 2, ssR, cs, 0, 1.25);
            });
        }

        if (needs.glow && !pair.glow) {
            const glowPad = Math.ceil(rPx * 0.45);
            pair.glow = this._getSprite(`pr_glow_v20|${key}`, rPx * 2 + glowPad * 2 + 4, (g, sz) => {
                this._paintSnakeGlow(g, sz / 2, rPx, cs);
            });
        }

        if (needs.boostOverlay && !pair.boostOverlay) {
            const col = parseColor(cs);
            const bright = shadeColor(col, 35);
            const pad = Math.max(3, Math.ceil(rPx * 0.2));
            pair.boostOverlay = this._getSprite(`pr_boost_v20|${key}`, rPx * 2 + pad * 2 + 6, (g, sz) => {
                const c = sz / 2;
                const glowR = rPx * 1.4 + pad;
                const aura = g.createRadialGradient(c, c, rPx * 0.5, c, c, glowR);
                aura.addColorStop(0, rgb(bright, 0.05));
                aura.addColorStop(0.4, rgb(bright, 0.15));
                aura.addColorStop(0.7, rgb(bright, 0.08));
                aura.addColorStop(1, 'rgba(255,255,255,0)');
                g.fillStyle = aura;
                g.beginPath();
                g.arc(c, c, glowR, 0, Math.PI * 2);
                g.fill();
            });
        }

        if (needs.trailGlow && !pair.trailGlow) {
            const col = parseColor(cs);
            const bright = shadeColor(col, 35);
            pair.trailGlow = this._getSprite(`pr_trail_v20|${key}`, rPx * 3 + 8, (g, sz) => {
                const c = sz / 2;
                const glowR = rPx * 1.7;
                const grad = g.createRadialGradient(c, c, 0, c, c, glowR);
                grad.addColorStop(0, rgb(bright, 0.12));
                grad.addColorStop(0.40, rgb(col, 0.06));
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                g.fillStyle = grad;
                g.beginPath();
                g.arc(c, c, glowR, 0, Math.PI * 2);
                g.fill();
            });
        }

        return pair;
    }

    /** Pre-rendered segment stamp cache — body sprites built once per color/radius. */
    _getSnakeSegmentStamp(cs, rPx, needs = {}) {
        return this._getSnakePrImgs(cs, rPx, needs);
    }

    _drawSnake(snake, toScreen, zoom) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        const segs = snake.drawSpine || snake.segments || [];
        if (segs.length === 0) {
            ctx.restore();
            return;
        }

        const gsc = zoom;
        const thick = this.snakeThickness ?? 1;
        const headRadius = (snake.radius || 6) * gsc * thick;
        const bodyRadius = headRadius;
        const angle = snake.angle || 0;
        // Cache the (expensive) HSL color bucketing across frames per snake.
        let cs = snake._csCache;
        if (cs === undefined || snake._csColor !== snake.color) {
            cs = bucketSnakeColor(snake.color);
            snake._csCache = cs;
            snake._csColor = snake.color;
        }
        const boosting = !!snake.boost;
        const isYou = !!snake.isYou;
        const pulse = 0.85 + 0.15 * Math.sin(this._frame * 0.16);

        // Cheap on-screen cull straight from the world-space spine before any resampling.
        const cx = this.camera.x;
        const cy = this.camera.y;
        const viewR = Math.hypot(this.W, this.H) / (2 * zoom) + 160;
        const viewR2 = viewR * viewR;
        let onScreen = false;
        const checkStride = Math.max(1, Math.floor(segs.length / 12));
        for (let i = 0; i < segs.length; i += checkStride) {
            const dx = segs[i].x - cx;
            const dy = segs[i].y - cy;
            if (dx * dx + dy * dy <= viewR2) { onScreen = true; break; }
        }
        if (!onScreen) {
            const tail = segs[segs.length - 1];
            const dx = tail.x - cx;
            const dy = tail.y - cy;
            if (dx * dx + dy * dy <= viewR2) onScreen = true;
        }
        if (!onScreen) {
            ctx.restore();
            return;
        }

        const worldRadius = snake.radius || 6;
        // Fixed visual stamp spacing — render-only, never affects movement physics.
        const stampStepWorld = Math.max(1, worldRadius * 0.25);
        const q = this._quality;
        const cashoutPerf = isYou && this._cashoutPerf;
        const qMul = Math.max(this.isMobile ? 0.88 : 0.78, q) * (cashoutPerf ? 0.88 : 1);
        const stampDensity = Math.max(1, (worldRadius * 0.38) / stampStepWorld);
        const maxStamps = Math.round(
            (isYou ? (boosting ? 110 : 92) : (boosting ? 48 : 38))
            * qMul
            * stampDensity
            * Math.min(1.25, 1 + segs.length / 300),
        );
        const bumps = this._interpolateSnakeDrawPath(segs, stampStepWorld, maxStamps, this._bumpsBuf);
        if (bumps.length < 1) {
            ctx.restore();
            return;
        }

        // Project bumps to screen once — stable world spacing, single projection.
        for (let i = 0; i < bumps.length; i++) {
            const b = bumps[i];
            const wx = b.x;
            const wy = b.y;
            b.x = (wx - cx) * zoom + this.W / 2;
            b.y = (wy - cy) * zoom + this.H / 2;
        }

        const hx = bumps[0].x;
        const hy = bumps[0].y;

        // Coarse radius buckets with hysteresis so sprite set doesn't swap every frame.
        const rawR = Math.max(4, Math.round(bodyRadius / 4) * 4);
        let r = rawR;
        if (snake._lastSpriteR != null && Math.abs(rawR - snake._lastSpriteR) < 8) {
            r = snake._lastSpriteR;
        } else {
            snake._lastSpriteR = rawR;
        }
        const prNeeds = {
            glow: isYou && !cashoutPerf && q >= 0.5,
            boostOverlay: isYou && boosting && !cashoutPerf && q >= 0.55,
            trailGlow: isYou && boosting && !cashoutPerf,
        };
        const { normal, alt, boostBody, glow, boostOverlay, trailGlow, bodySS } = this._getSnakeSegmentStamp(cs, r, prNeeds);
        const halfT = trailGlow ? trailGlow.width / 2 : 0;
        const halfB = boostOverlay ? boostOverlay.width / 2 : 0;
        const bumpCount = bumps.length;

        const headBump = bumps[0];

        let trail = this._boostTrailPool.get(snake.id);
        if (!trail) {
            trail = [];
            this._boostTrailPool.set(snake.id, trail);
        }
        if (isYou && boosting) {
            trail.unshift({ x: headBump.x, y: headBump.y, a: angle });
            if (trail.length > 6) trail.length = 6;
        } else if (trail.length > 0) {
            trail.length = 0;
        }

        // Motion blur trailing afterimages during boost (local snake only)
        if (isYou && boosting && !cashoutPerf && trailGlow && trail.length > 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let t = 1; t < trail.length; t++) {
                const tr = trail[t];
                ctx.globalAlpha = (1 - t / trail.length) * 0.12 * pulse;
                ctx.drawImage(trailGlow, tr.x - halfT, tr.y - halfT);
            }
            ctx.restore();
        }

        // Draw body segments (tail to head)
        for (let i = bumpCount - 1; i >= 0; i--) {
            const p = bumps[i];
            if (p.x < -80 || p.y < -80 || p.x > this.W + 80 || p.y > this.H + 80) continue;

            const isHead = i === 0;
            const sprite = (boosting && isHead) ? boostBody : ((i & 1) ? alt : normal);
            this._blitSprite(ctx, sprite, p.x, p.y, bodySS);
        }

        // Ambient glow — local snake only (doubles draw calls otherwise). The glow
        // sprite is large and additive, so stride the loop: overlapping bumps make
        // the gaps invisible while roughly halving this pass's fillrate.
        if (isYou && prNeeds.glow && glow) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = boosting ? 0.22 * pulse : 0.12;
            const glowStride = cashoutPerf ? 4 : (boosting ? 2 : 3);
            for (let i = bumpCount - 1; i >= 0; i -= glowStride) {
                const p = bumps[i];
                if (p.x < -80 || p.y < -80 || p.x > this.W + 80 || p.y > this.H + 80) continue;
                this._blitSprite(ctx, glow, p.x, p.y);
            }
            ctx.restore();
        }

        // Boost overlay (local snake only) — strided for the same reason as the glow.
        if (isYou && boosting && prNeeds.boostOverlay && boostOverlay) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = bumpCount - 1; i >= 0; i -= 2) {
                const p = bumps[i];
                if (p.x < -80 || p.y < -80 || p.x > this.W + 80 || p.y > this.H + 80) continue;
                const along = i / Math.max(1, bumpCount - 1);
                const headProx = 1 - along;

                ctx.globalAlpha = (0.22 + headProx * 0.22) * pulse;
                this._blitSprite(ctx, boostOverlay, p.x, p.y);
            }
            ctx.restore();
        }

        // Head and Eyes
        const perpX = Math.sin(angle);
        const perpY = -Math.cos(angle);
        const fwdX = Math.cos(angle);
        const fwdY = Math.sin(angle);
        
        // Head is exactly the same size as the body
        const headEyeRadius = headRadius;
        
        // Eye positioning
        const eyeSide = headEyeRadius * 0.35;
        const eyeFwd = headEyeRadius * 0.35;
        const eyeR = Math.max(2.5, headEyeRadius * 0.32);
        const pupilR = eyeR * 0.45;

        // Head boost glow
        if (boosting) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.25 * pulse;
            ctx.translate(hx + fwdX * headRadius * 0.08, hy + fwdY * headRadius * 0.08);
            ctx.rotate(angle);
            ctx.scale(1.12, 0.95);
            ctx.drawImage(boostOverlay, -halfB, -halfB);
            ctx.restore();
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        if (isYou || this._quality >= 0.68) {
            for (const side of [-1, 1]) {
                const ex = hx + fwdX * eyeFwd + perpX * eyeSide * side;
                const ey = hy + fwdY * eyeFwd + perpY * eyeSide * side;

                ctx.beginPath();
                ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();

                const px = ex + fwdX * eyeR * 0.4;
                const py = ey + fwdY * eyeR * 0.4;
                ctx.beginPath();
                ctx.arc(px, py, pupilR, 0, Math.PI * 2);
                ctx.fillStyle = '#000000';
                ctx.fill();
            }
        }

        if (snake.name && isYou) {
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.font = `bold ${Math.max(12, headEyeRadius * 0.85)}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'rgba(0,0,0,0.55)';
            ctx.lineWidth = 3;
            ctx.strokeText(snake.name, hx, hy - headEyeRadius - 12);
            ctx.fillText(snake.name, hx, hy - headEyeRadius - 12);
        }

        // Mobile steering arrow (slither.io "arrow mode") — points just ahead of the
        // head toward where the finger is steering the snake.
        if (isYou && this.isMobile) {
            const am = Math.hypot(this.inputDx, this.inputDy);
            const aang = am > 0.001 ? Math.atan2(this.inputDy, this.inputDx) : angle;
            const size = Math.max(11, Math.min(22, headRadius * 0.95));
            const gap = headRadius * 1.9 + size;
            const ax = hx + Math.cos(aang) * gap;
            const ay = hy + Math.sin(aang) * gap;

            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(aang);
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.moveTo(size, 0);
            ctx.lineTo(-size * 0.7, size * 0.7);
            ctx.lineTo(-size * 0.32, 0);
            ctx.lineTo(-size * 0.7, -size * 0.7);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }

    _drawBalanceBadge(ctx, screenX, screenY, balance, isMe) {
        drawBalanceBadge(ctx, screenX, screenY, balance, isMe);
    }

    draw() {
        const { worldHalf } = this.state;
        const ctx = this.ctx;
        const W = this.W;
        const H = this.H;

        const now = performance.now();
        let dt = this._lastFrameTime ? (now - this._lastFrameTime) / 1000 : 1 / 60;
        this._lastFrameTime = now;
        if (dt > 0.1) dt = 0.1;

        const frameMs = dt * 1000;
        this._perfEma = this._perfEma * 0.9 + frameMs * 0.1;
        const nowMs = Date.now();
        this._cashoutPerf = this._isCashoutActive(nowMs);
        const qFloor = this.isMobile ? 0.88 : 0.72;
        if (this._perfEma > 32) this._quality = Math.max(qFloor, 0.84);
        else if (this._perfEma > 24) this._quality = Math.min(this._quality, Math.max(qFloor, 0.94));
        else if (this._perfEma > 20) this._quality = Math.min(this._quality, Math.max(qFloor, 0.97));
        else if (this._perfEma < 15) this._quality = Math.min(1, this._quality + 0.025);
        if (this._cashoutPerf) {
            this._quality = Math.min(this._quality, this.isMobile ? 0.92 : 0.86);
        }

        ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

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
            const s = this.smooth.get(snake.id);
            rs.radius = (snake.isYou && s?.visualRadius != null) ? s.visualRadius : snake.radius;
            rs.boost = snake.boost;
            rs.isYou = snake.isYou;
            rs.name = snake.name;
            rs.balance = snake.balance;
            rs.segments = s ? s.segments : snake.segments;
            rs.drawSpine = (snake.isYou && s?.path?.length >= 2) ? s.path : rs.segments;
            rs.angle = s ? s.angle : snake.angle;
            renderSnakes.push(rs);
        }

        let me = null;
        for (let i = 0; i < renderSnakes.length; i++) {
            if (renderSnakes[i].isYou) {
                me = renderSnakes[i];
                break;
            }
        }
        if (this.spectatorMode) {
            // Camera driven externally while spectating.
        } else if (me?.segments?.[0]) {
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
            const minZoom = this.isMobile ? 0.95 : 1.35;
            const targetZoom = Math.min(this.baseZoom, Math.max(minZoom, this.baseZoom * Math.pow(6.2 / meR, 0.4)));
            const za = 1 - Math.exp(-dt / 0.6);
            this.zoom += (targetZoom - this.zoom) * za;
        }

        const cx = this.camera.x;
        const cy = this.camera.y;
        const zoom = this.zoom;

        // Player "mouth" point — slightly ahead of the head along the heading.
        // Food drifts toward this like a magnet when it gets close (see _drawFood).
        if (me?.segments?.[0]) {
            const h = me.segments[0];
            const a = me.angle || 0;
            const fwd = (me.radius || 6) * 0.8;
            this._mouthX = h.x + Math.cos(a) * fwd;
            this._mouthY = h.y + Math.sin(a) * fwd;
            this._mouthR = me.radius || 6;
            this._mouthValid = true;
        } else {
            this._mouthValid = false;
        }

        const scratch = this._screenScratch;
        const toScreen = (wx, wy) => {
            scratch.x = (wx - cx) * zoom + W / 2;
            scratch.y = (wy - cy) * zoom + H / 2;
            return scratch;
        };

        if (this.state.circularMap) {
            this._drawCircularBackground(ctx, W, H, cx, cy, worldHalf, zoom, this.state.zone);
        } else {
            this._drawBackground(ctx, W, H, cx, cy, worldHalf, zoom);
            this._drawZone(ctx, toScreen, W, H);
        }
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
            const { holdProgress, cashoutEndAt, cashoutTotal } = this.hud;
            const ringR = headRadius + 10;

            if (holdProgress > 0 && (!cashoutEndAt || cashoutEndAt <= Date.now())) {
                drawCashoutProgressRing(ctx, hx, hy, ringR, holdProgress, { counterClockwise: true });
            }
            if (cashoutEndAt && cashoutEndAt > Date.now()) {
                const progress = getCashoutRingProgress(cashoutEndAt, cashoutTotal || 10);
                drawCashoutProgressRing(ctx, hx, hy, ringR, progress);
            }

            this._drawBalanceBadge(
                ctx,
                hx,
                hy + headRadius + 14,
                this.hud.balance ?? me.dollarBalance ?? me.balance ?? 1,
                true,
            );
        }

        if (me?.segments?.[0] || this.spectatorMode) {
            const viewHalfW = W / (2 * zoom);
            const viewHalfH = H / (2 * zoom);
            if ((this._minimapFrame++ & 3) === 0 && !this._cashoutPerf) {
                const fbPlayers = this._minimapFallback.players;
                fbPlayers.length = 0;
                for (let i = 0; i < renderSnakes.length; i++) {
                    const s = renderSnakes[i];
                    if (!s.segments?.[0]) continue;
                    fbPlayers.push({
                        x: s.segments[0].x,
                        y: s.segments[0].y,
                        isYou: s.isYou,
                    });
                }
                const fbFood = this._minimapFallback.food;
                const foodList = this._foodDrawList;
                fbFood.length = foodList.length;
                for (let i = 0; i < foodList.length; i++) {
                    const f = foodList[i];
                    let entry = fbFood[i];
                    if (!entry) {
                        entry = {};
                        fbFood[i] = entry;
                    }
                    entry.x = f.x;
                    entry.y = f.y;
                    entry.golden = f.golden;
                    entry.hue = f.hue;
                }
            }
            const minimap = normalizeMinimapData(this.state.minimap, this._minimapFallback);
            drawGameMinimap(ctx, {
                screenW: W,
                screenH: H,
                isMobile: this.isMobile,
                centerX: cx,
                centerY: cy,
                viewHalfW,
                viewHalfH,
                players: minimap.players,
                food: minimap.food,
                zone: this.state.zone,
            });
        }
    }

    destroy() {
        this.pause();
        this._boostTrailPool.clear();
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener(GAME_LAYOUT_CHANGE, this._onLayoutChange);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mousedown', this._onMouseDown);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('touchmove', this._onTouchMove);
        document.removeEventListener('touchstart', this._onTouchStart);
        document.removeEventListener('touchend', this._onTouchEnd);
    }
}
