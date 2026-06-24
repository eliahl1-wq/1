/**
 * Server-authoritative slither renderer — slither.io-inspired visuals.
 */

import { drawCashoutProgressRing, getCashoutRingProgress, CASHOUT_HOLD_MS } from '../cashoutRing.js';
import { drawBalanceBadge } from '../balanceBadge.js';
import { drawGameMinimap, normalizeMinimapData } from '../minimap.js';
import { getGameScreenSize, GAME_LAYOUT_CHANGE } from '../../utils/forcedLandscape.js';
import { unlockGameAudio } from '../../audio/synthSounds.js';
import { rebuildPathFromSegments, resetSnakeBodyTick, resetVisualGrowth, stepSnakeBody } from './snakePath.js';
import { getSnakeSegmentCanvas } from '../../utils/snakeRender.js';
// stackblur-canvas removed — sprites use soft gradients instead
import bgTileUrl from './background_tile.png';

/** Slither.io base body radius factor (protocol sc × base). */
const SLITHER_BASE_R = 6.2;

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

    // HSL(h, 60%, 58%) — brighter, more vivid slither pastels
    const s = 0.60, l = 0.58;
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
    if (color === 'random') return 'random';
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
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this._resizeToCanvas = options.resizeToCanvas === true;
        this._externalCameraGetter = null;
        this._sortDirty = true;
        this._foodAnimCache = new Map();
        this._slurpGhosts = [];
        this._mouthValid = false;
        this._mouthX = 0;
        this._mouthY = 0;
        this._mouthR = 6;
        this._holdStartAt = 0;
        this._mouseRafQueued = false;
        this._lastMouseX = 0;
        this._lastMouseY = 0;
        // Opaque canvas — background is fully painted every frame, so skipping the
        // alpha channel makes page compositing cheaper with no visual change.
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = this.isMobile ? 'high' : 'medium';
        // Body sprites are authored at this supersample factor and blitted down,
        // which gives crisp, well-antialiased snake edges instead of upscaled-blurry ones.
        this._bodySS = 2;
        this.state = { snakes: [], food: [], you: null, worldHalf: 3000, zone: null, minimap: [] };
        // Latest authoritative snakes from the server + smoothed render copies (interpolation)
        this.targetSnakes = [];
        this.smooth = new Map();
        this._foodDrawList = [];
        this._visibleFoodBuf = [];
        this._foodSpatialGrid = new Map();
        this._foodGridDirty = true;
        this._maxFoodDraw = 1000;
        this._slurpSetPool = new Set();
        this._foodNearBuf = [];
        this._FOOD_CELL = 64;
        this.hud = { balance: 1, cashoutSeconds: 0, cashoutTotal: 10, cashoutEndAt: 0, holdProgress: 0 };
        this.camera = { x: 0, y: 0 };
        this._cameraInit = false;
        this._holdActive = false;
        this._cashoutActive = false;
        this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
        this.baseZoom = this.isMobile ? 2.05 : 2.88;
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
        this._touchSteering = false;
        this.inputDx = 0;
        this.inputDy = 0;
        this.boost = false;
        this._inputEnabled = true;
        this.spectatorMode = false;
        this.hideOverlays = false;
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
        this._rainbowStampPack = null;
        this._minimapFallback = { players: [], food: [] };
        this._minimapFrame = 0;
        this._hlBlurCv = null;
        this._hlBlurCtx = null;

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
            this._touchSteering = true;
            const t = e.touches[0];
            if (t) this._setInputFromScreen(t.clientX, t.clientY);
        };
        this._onTouchStart = (e) => {
            if (!this._inputEnabled || this.spectatorMode) return;
            unlockGameAudio();
            this._touchSteering = true;
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
            if (!e?.touches || e.touches.length === 0) {
                this.boost = false;
                this._touchSteering = false;
            }
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
        let width;
        let height;
        if (this._resizeToCanvas) {
            const parent = this.canvas.parentElement;
            width = parent?.clientWidth || this.canvas.clientWidth || window.innerWidth;
            height = parent?.clientHeight || this.canvas.clientHeight || window.innerHeight;
        } else {
            ({ width, height } = getGameScreenSize());
        }
        const rawDpr = window.devicePixelRatio || 1;
        // Mobile: up to 2× retina backing store for sharper snakes/food on HiDPI screens.
        this._dpr = this.isMobile ? Math.min(2, rawDpr) : 1;
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
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
        if (this._mouseRafQueued) return;
        this._mouseRafQueued = true;
        requestAnimationFrame(() => {
            this._mouseRafQueued = false;
            this._setInputFromScreen(this._lastMouseX, this._lastMouseY);
        });
    }

    getInput() {
        return { dx: this.inputDx, dy: this.inputDy, boost: this.boost };
    }

    /** Guard against NaN/0 zoom — invalid zoom used to freeze the food grid loop at ~1 FPS. */
    _safeZoom(zoom = this.zoom) {
        const z = zoom || this.baseZoom || 1;
        return (z > 0.01 && Number.isFinite(z)) ? z : (this.baseZoom || 1);
    }

    updateState(tick) {
        if (tick.snakes) {
            this.targetSnakes = tick.snakes;
            this._sortDirty = true;
        }
        if (tick.food) {
            const prevById = new Map();
            for (let i = 0; i < this._foodDrawList.length; i++) {
                const pf = this._foodDrawList[i];
                if (pf?.id != null) prevById.set(pf.id, pf);
            }

            const list = this._foodDrawList;
            list.length = tick.food.length;
            const seenFood = new Set();
            for (let i = 0; i < tick.food.length; i++) {
                list[i] = tick.food[i];
                if (tick.food[i]?.id) seenFood.add(tick.food[i].id);
            }

            const ghostStart = performance.now();
            let ghostSpawned = 0;
            for (const [id, prev] of prevById) {
                if (seenFood.has(id)) continue;
                const anim = this._foodAnimCache.get(id);
                if (prev && this._mouthValid && ghostSpawned < 4) {
                    const foodR = prev.radius || 3;
                    const visualReach = (this._mouthR + foodR) * 1.55 + 14 + this._mouthR * 0.55;
                    const dx = this._mouthX - prev.x;
                    const dy = this._mouthY - prev.y;
                    const slurp = anim?.slurp ?? 0;
                    const pull = slurp * slurp;
                    if (dx * dx + dy * dy <= visualReach * visualReach || slurp > 0.12) {
                        this._spawnSlurpGhost({
                            x: prev.x + dx * Math.max(pull, slurp * 0.65) * 0.95,
                            y: prev.y + dy * Math.max(pull, slurp * 0.65) * 0.95,
                            hue: prev.hue ?? 120,
                            radius: prev.radius || 3,
                            phase: anim?.phase ?? 0,
                            sizeMul: anim?.sizeMul ?? 1,
                            start: ghostStart,
                        });
                        ghostSpawned++;
                    }
                }
                this._foodAnimCache.delete(id);
            }
            for (const id of this._foodAnimCache.keys()) {
                if (!seenFood.has(id)) this._foodAnimCache.delete(id);
            }
            this._foodGridDirty = true;
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

    _ensureFoodGrid() {
        if (!this._foodGridDirty) return;
        const grid = this._foodSpatialGrid;
        grid.clear();
        const src = this._foodDrawList;
        const cell = this._FOOD_CELL;
        for (let i = 0; i < src.length; i++) {
            const f = src[i];
            if (!f || f.x == null || f.y == null) continue;
            const key = (Math.floor(f.x / cell) + 2000) + (Math.floor(f.y / cell) + 2000) * 10000;
            let bucket = grid.get(key);
            if (!bucket) {
                bucket = [];
                grid.set(key, bucket);
            }
            bucket.push(f);
        }
        this._foodGridDirty = false;
    }

    _capVisibleFoodBuf(dest, cx, cy, maxCount) {
        if (dest.length <= maxCount) return;
        const priority = [];
        const normal = [];
        for (let i = 0; i < dest.length; i++) {
            const f = dest[i];
            if (f.golden || f.deathDrop) priority.push(f);
            else normal.push(f);
        }
        if (priority.length >= maxCount) {
            dest.length = 0;
            for (let i = 0; i < maxCount; i++) dest.push(priority[i]);
            return;
        }
        normal.sort((a, b) => {
            const da = (a.x - cx) ** 2 + (a.y - cy) ** 2;
            const db = (b.x - cx) ** 2 + (b.y - cy) ** 2;
            return da - db;
        });
        const keepNormal = maxCount - priority.length;
        dest.length = 0;
        for (let i = 0; i < priority.length; i++) dest.push(priority[i]);
        for (let i = 0; i < keepNormal && i < normal.length; i++) dest.push(normal[i]);
    }

    _rebuildVisibleFoodBuf(cx = this.camera.x, cy = this.camera.y, halfW = null, halfH = null) {
        const W = this.W;
        const H = this.H;
        const zoom = this._safeZoom();
        if (halfW == null) halfW = W / 2 / zoom + 160 / zoom;
        if (halfH == null) halfH = H / 2 / zoom + 160 / zoom;
        if (!Number.isFinite(halfW) || !Number.isFinite(halfH)) return;

        this._ensureFoodGrid();
        const grid = this._foodSpatialGrid;
        const cell = this._FOOD_CELL;
        const dest = this._visibleFoodBuf;
        dest.length = 0;

        const minCx = Math.max(-100, Math.min(100, Math.floor((cx - halfW) / cell)));
        const maxCx = Math.max(-100, Math.min(100, Math.floor((cx + halfW) / cell)));
        const minCy = Math.max(-100, Math.min(100, Math.floor((cy - halfH) / cell)));
        const maxCy = Math.max(-100, Math.min(100, Math.floor((cy + halfH) / cell)));
        if (isNaN(minCx) || isNaN(maxCx) || isNaN(minCy) || isNaN(maxCy)) return;

        for (let gx = minCx; gx <= maxCx; gx++) {
            for (let gy = minCy; gy <= maxCy; gy++) {
                const key = (gx + 2000) + (gy + 2000) * 10000;
                const bucket = grid.get(key);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const f = bucket[i];
                    if (!f || f.x == null || f.y == null) continue;
                    const dx = f.x - cx;
                    const dy = f.y - cy;
                    if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) dest.push(f);
                }
            }
        }

        if (dest.length > this._maxFoodDraw) {
            this._capVisibleFoodBuf(dest, cx, cy, this._maxFoodDraw);
        }
    }

    _foodNearPoint(grid, wx, wy, reach, out) {
        if (!out) out = this._foodNearBuf;
        out.length = 0;
        const cell = this._FOOD_CELL;
        const minCx = Math.max(-100, Math.min(100, Math.floor((wx - reach) / cell)));
        const maxCx = Math.max(-100, Math.min(100, Math.floor((wx + reach) / cell)));
        const minCy = Math.max(-100, Math.min(100, Math.floor((wy - reach) / cell)));
        const maxCy = Math.max(-100, Math.min(100, Math.floor((wy + reach) / cell)));
        if (isNaN(minCx) || isNaN(maxCx) || isNaN(minCy) || isNaN(maxCy)) return out;
        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cy = minCy; cy <= maxCy; cy++) {
                const key = (cx + 2000) + (cy + 2000) * 10000;
                const bucket = grid.get(key);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const f = bucket[i];
                    if (!f || f.x == null || f.y == null) continue;
                    out.push(f);
                }
            }
        }
        return out;
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

    /** Wall-clock hold start for Q / button hold ring (progress computed in draw loop). */
    setHoldStart(atMs) {
        this._holdStartAt = atMs ? atMs : 0;
    }

    _getHoldProgress(nowMs = performance.now()) {
        if (!this._holdStartAt) return 0;
        return Math.min(1, (nowMs - this._holdStartAt) / CASHOUT_HOLD_MS);
    }

    _isHoldActive(nowMs = performance.now()) {
        return this._holdStartAt > 0 && this._getHoldProgress(nowMs) < 1;
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

    setExternalCameraGetter(fn) {
        this._externalCameraGetter = typeof fn === 'function' ? fn : null;
    }

    setHideOverlays(hide) {
        this.hideOverlays = !!hide;
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
                    resetVisualGrowth(s, null, snake.fam ?? 0, segCount);
                }
                continue;
            }

            const meta = {
                segmentCount: segCount,
                fam: snake.fam ?? 0,
            };

            if (snake.isYou) {
                const headDx = tgt[0].x - (s.segments[0]?.x ?? tgt[0].x);
                const headDy = tgt[0].y - (s.segments[0]?.y ?? tgt[0].y);
                if (headDx * headDx + headDy * headDy > SNAP_SQ) {
                    for (let i = 0; i < spineLen; i++) this._smoothSeg(s, i, tgt[i].x, tgt[i].y);
                    s.angle = snake.angle || 0;
                    rebuildPathFromSegments(s, s.segments);
                    resetVisualGrowth(s, null, snake.fam ?? 0, segCount);
                    resetSnakeBodyTick(s);
                    delete s._prevSrvHead;
                    delete s._extrapX;
                    delete s._extrapY;
                }
                // Densify is done in _interpolateSnakeDrawPath at render time — skip here.
                stepSnakeBody(s, meta, tgt, snake.angle || 0, dt, performance.now(), { skipDensify: true });
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
            if (this.spectatorMode && this._externalCameraGetter) {
                const cam = this._externalCameraGetter();
                if (cam) {
                    if (cam.x != null) this.camera.x = cam.x;
                    if (cam.y != null) this.camera.y = cam.y;
                    if (cam.zoom != null) this.zoom = cam.zoom;
                }
            }
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
        if (this._sprites.size >= 4096) {
            const entries = [...this._sprites.entries()]
                .sort((a, b) => (a[1]._lastUsed || 0) - (b[1]._lastUsed || 0));
            for (let i = 0; i < 512 && i < entries.length; i++) {
                this._sprites.delete(entries[i][0]);
            }
            if (this._prImgs.size > 800) {
                const prEntries = [...this._prImgs.entries()]
                    .sort((a, b) => (a[1].normal?._lastUsed || 0) - (b[1].normal?._lastUsed || 0));
                for (let i = 0; i < 128 && i < prEntries.length; i++) {
                    this._prImgs.delete(prEntries[i][0]);
                }
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
        ctx.fillStyle = '#2c2c36';
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
        ctx.fillStyle = 'rgba(56, 10, 14, 0.88)';
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
        ctx.fillStyle = '#2c2c36';
        ctx.fillRect(0, 0, W, H);

        const radius = zone?.radius ?? worldHalf;
        const pattern = this._getBgPattern(ctx);
        const { x: zx, y: zy } = { x: (0 - cx) * zoom + W / 2, y: (0 - cy) * zoom + H / 2 };
        const screenRadius = radius * zoom;

        // Draw hex tile on full viewport (no clip — red mask below covers outside the circle).
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

        ctx.save();
        ctx.fillStyle = 'rgba(56, 10, 14, 0.88)';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(zx, zy, screenRadius, 0, Math.PI * 2, true);
        ctx.fill('evenodd');

        const shrinking = zone?.shrinking;
        ctx.strokeStyle = shrinking ? 'rgba(255, 85, 85, 0.95)' : 'rgba(255, 60, 60, 0.9)';
        ctx.lineWidth = shrinking ? 5 : 3;
        if (shrinking) {
            ctx.setLineDash([14, 10]);
        } else {
            ctx.setLineDash([]);
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

            let guard = 0;
            while (segLen > 0 && acc + segLen >= step && bi < maxPoints && guard++ < maxPoints) {
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

    /** Soft glowing orb — slither.io-style pinpoint with tight bloom. */
    _foodSprite(hue, rPx, golden, deathDrop) {
        const halo = Math.ceil(rPx * (golden ? 2.5 : deathDrop ? 1.8 : 1.52));
        const key = `f12|${golden ? 'g' : hue}|${rPx}|${deathDrop ? 1 : 0}`;
        return this._getSprite(key, halo * 2 + 4, (g, sz) => {
            const c = sz / 2;
            const grad = g.createRadialGradient(c, c, 0, c, c, halo);
            if (golden) {
                grad.addColorStop(0, 'hsla(55, 100%, 100%, 0.90)');
                grad.addColorStop(0.10, 'hsla(52, 100%, 92%, 0.72)');
                grad.addColorStop(0.28, 'hsla(46, 100%, 72%, 0.40)');
                grad.addColorStop(0.52, 'hsla(40, 100%, 54%, 0.18)');
                grad.addColorStop(0.78, 'hsla(35, 100%, 42%, 0.04)');
                grad.addColorStop(1, 'hsla(30, 100%, 30%, 0)');
            } else {
                const sat = deathDrop ? 92 : 90;
                grad.addColorStop(0, `hsla(${hue}, 18%, 100%, 0.90)`);
                grad.addColorStop(0.10, `hsla(${hue}, ${sat}%, 80%, 0.72)`);
                grad.addColorStop(0.26, `hsla(${hue}, ${sat}%, 64%, 0.50)`);
                grad.addColorStop(0.46, `hsla(${hue}, ${sat}%, 54%, 0.24)`);
                grad.addColorStop(0.66, `hsla(${hue}, ${sat}%, 48%, 0.08)`);
                grad.addColorStop(1, `hsla(${hue}, ${sat}%, 42%, 0)`);
            }
            g.fillStyle = grad;
            g.fillRect(0, 0, sz, sz);
        });
    }

    _spawnSlurpGhost({ x, y, hue, radius, phase, sizeMul, start }) {
        const ghosts = this._slurpGhosts;
        if (ghosts.length >= 10) ghosts.shift();
        ghosts.push({
            x,
            y,
            hue: hue ?? 120,
            radius: radius || 3,
            phase: phase ?? 0,
            sizeMul: sizeMul ?? 1,
            start: start ?? performance.now(),
            duration: 260,
        });
    }

    _drawFood(ctx, foodList, toScreen, W, H, zoom, dt = 1 / 60) {
        const now = performance.now();
        const cx = this.camera.x;
        const cy = this.camera.y;
        const safeZoom = this._safeZoom(zoom);
        const halfW = W / 2 / safeZoom + 160 / safeZoom;
        const halfH = H / 2 / safeZoom + 160 / safeZoom;
        const isCompetitive = !!this.state.competitiveSlither;
        const animateFood = !isCompetitive;
        const simpleFood = this._quality < 0.50;
        const foodStride = this._quality < 0.45 ? 3 : this._quality < 0.55 ? 2 : 1;
        const crowdedView = foodList.length > 140;
        const farCullR = Math.min(halfW, halfH) * 0.58;
        const farCullR2 = farCullR * farCullR;

        let deathDropCount = 0;
        if (crowdedView) {
            for (let i = 0; i < foodList.length; i++) {
                if (foodList[i]?.deathDrop) deathDropCount++;
            }
        }
        const heavyDeathCluster = deathDropCount > 70;
        const deathStride = heavyDeathCluster ? 2 : 1;

        const mouthValid = this._mouthValid;
        const mouthX = this._mouthX;
        const mouthY = this._mouthY;
        const mouthR = this._mouthR || 6;
        const slurpK = 1 - Math.exp(-dt / 0.11);
        const maxSlurpReach = (mouthR + 4) * 1.55 + 14 + mouthR * 0.55;
        const maxSlurpReach2 = maxSlurpReach * maxSlurpReach;

        this._ensureFoodGrid();
        const foodGrid = this._foodSpatialGrid;
        const slurpSet = this._slurpSetPool;
        slurpSet.clear();
        if (mouthValid && !this._holdActive && !crowdedView) {
            const near = this._foodNearPoint(foodGrid, mouthX, mouthY, maxSlurpReach);
            for (let ni = 0; ni < near.length; ni++) slurpSet.add(near[ni]);
        }

        for (let fi = 0; fi < foodList.length; fi += foodStride) {
            const f = foodList[fi];
            const dxCam = f.x - cx;
            const dyCam = f.y - cy;
            if (Math.abs(dxCam) > halfW || Math.abs(dyCam) > halfH) continue;

            if (f.deathDrop && crowdedView) {
                const d2cam = dxCam * dxCam + dyCam * dyCam;
                if (d2cam > farCullR2 && (fi & 1) === 1) continue;
                if (heavyDeathCluster && d2cam > farCullR2 * 0.32 && (fi & (deathStride - 1)) !== 0) continue;
            } else if (f.deathDrop && foodList.length > 90) {
                const d2cam = dxCam * dxCam + dyCam * dyCam;
                if (d2cam > farCullR2 * 1.35 && (fi & 3) === 3) continue;
            }

            let anim = f.id != null ? this._foodAnimCache.get(f.id) : null;
            if (!anim) {
                let h = 0;
                const id = String(f.id ?? `${f.x},${f.y}`);
                for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
                anim = {
                    phase: (Math.abs(h) % 1000) / 1000 * Math.PI * 2,
                    sizeMul: 0.78 + (Math.abs(h) % 100) / 100 * 0.55,
                    driftAmp: 1.5 + (Math.abs(h >> 4) % 90) / 90 * 1.4,
                    slurp: 0,
                };
                if (f.id != null) this._foodAnimCache.set(f.id, anim);
            }
            if (anim.slurp == null) anim.slurp = 0;
            if (anim.driftAmp == null) anim.driftAmp = 2.2;

            let wx = f.x;
            let wy = f.y;

            const isGolden = !!f.golden;
            const hue = isGolden ? 48 : Math.round((f.hue ?? 120) / 12) * 12;

            let sizeMul = 1;
            let alpha = 1;

            if (isGolden) {
                const pulse = Math.sin(now * 0.006 + f.x) * 0.15;
                sizeMul = 0.85 + pulse;
                alpha = 0.75 + Math.sin(now * 0.008 + f.x + f.y) * 0.25;
            } else if (f.deathDrop) {
                sizeMul = 1.15 + ((f.radius || 3) - 2) * 0.12;
            } else {
                sizeMul = anim.sizeMul * (1 + Math.sin(now * 0.004 + anim.phase) * 0.10);
                if (animateFood) {
                    const amp = anim.driftAmp;
                    wx += Math.sin(now * 0.0024 + anim.phase) * amp;
                    wy += Math.cos(now * 0.0028 + anim.phase * 1.3) * amp;
                }
            }

            const runSlurp = mouthValid && !this._holdActive && !f.deathDrop && !isGolden
                && (!crowdedView || ((wx - mouthX) ** 2 + (wy - mouthY) ** 2) < maxSlurpReach2 * 0.35)
                && (slurpSet.has(f) || anim.slurp > 0.001);

            if (runSlurp) {
                const dxm = mouthX - wx;
                const dym = mouthY - wy;
                const nearMouth = Math.abs(dxm) < maxSlurpReach && Math.abs(dym) < maxSlurpReach;

                if (nearMouth) {
                    const foodR = f.radius || 3;
                    const visualReach = (mouthR + foodR) * 1.55 + 14 + mouthR * 0.55;
                    const visualReach2 = visualReach * visualReach;
                    const dist2 = dxm * dxm + dym * dym;

                    let targetSlurp = 0;
                    if (dist2 < visualReach2) {
                        const dist = Math.sqrt(dist2);
                        const t = 1 - dist / visualReach;
                        targetSlurp = t * t;
                    }
                    anim.slurp += (targetSlurp - anim.slurp) * slurpK;
                } else if (anim.slurp > 0.001) {
                    anim.slurp += (0 - anim.slurp) * slurpK;
                }

                if (anim.slurp > 0.004) {
                    const pull = anim.slurp * anim.slurp;
                    wx += dxm * pull * 0.96;
                    wy += dym * pull * 0.96;
                    sizeMul *= Math.max(0.12, 1 - pull * 0.88);
                    alpha = Math.max(0.2, 1 - pull * 0.65);
                }
            }

            const { x: fx, y: fy } = toScreen(wx, wy);

            const baseR = (f.radius || 3) * sizeMul;
            const screenScale = isGolden ? 1.65 : (f.deathDrop ? 1.52 : 1.48);
            const screenR = Math.max(4.2, baseR * safeZoom * screenScale);

            if (simpleFood && !isGolden && !f.deathDrop) {
                ctx.globalAlpha = 0.58;
                ctx.fillStyle = `hsla(${hue}, 88%, 62%, 0.52)`;
                ctx.beginPath();
                ctx.arc(fx, fy, screenR * 0.52, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                continue;
            }

            if (screenR < 6 && !isGolden && !f.deathDrop) {
                ctx.globalAlpha = 0.65;
                ctx.fillStyle = `hsla(${hue}, 90%, 60%, 0.58)`;
                ctx.beginPath();
                ctx.arc(fx, fy, screenR * 0.55, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                continue;
            }

            if (f.deathDrop && heavyDeathCluster) {
                const d2cam = dxCam * dxCam + dyCam * dyCam;
                if (d2cam > farCullR2 * 0.25 || screenR < 7) {
                    ctx.globalAlpha = 0.72;
                    ctx.fillStyle = `hsla(${hue}, 90%, 58%, 0.62)`;
                    ctx.beginPath();
                    ctx.arc(fx, fy, screenR * 0.58, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    continue;
                }
            }

            const spriteR = 4;
            const sprite = this._foodSprite(hue, spriteR, isGolden, !!f.deathDrop);
            const size = sprite.width * (screenR / spriteR);
            const half = size / 2;

            if (isGolden) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = alpha;
                ctx.drawImage(sprite, Math.round(fx - half), Math.round(fy - half), size, size);
                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = 'source-over';
            } else {
                if (alpha < 0.99) {
                    ctx.globalAlpha = alpha;
                    ctx.drawImage(sprite, Math.round(fx - half), Math.round(fy - half), size, size);
                    ctx.globalAlpha = 1.0;
                } else {
                    ctx.drawImage(sprite, Math.round(fx - half), Math.round(fy - half), size, size);
                }
            }
        }

        this._drawSlurpGhosts(ctx, toScreen, zoom, now, mouthValid ? mouthX : null, mouthValid ? mouthY : null);
    }

    _drawSlurpGhosts(ctx, toScreen, zoom, now, mouthX, mouthY) {
        const ghosts = this._slurpGhosts;
        let kept = 0;
        for (let i = 0; i < ghosts.length; i++) {
            const g = ghosts[i];
            const elapsed = now - g.start;
            if (elapsed >= g.duration) continue;

            if (mouthX != null && mouthY != null) {
                g.mouthX = mouthX;
                g.mouthY = mouthY;
            } else if (g.mouthX == null || g.mouthY == null) {
                g.mouthX = g.x;
                g.mouthY = g.y;
            }

            const t = elapsed / g.duration;
            const ease = 1 - (1 - t) ** 3;
            const wx = g.x + (g.mouthX - g.x) * ease;
            const wy = g.y + (g.mouthY - g.y) * ease;
            const hue = Math.round((g.hue ?? 120) / 12) * 12;
            const sizeMul = (g.sizeMul ?? 1) * (1 - ease * 0.9);
            const baseR = (g.radius || 3) * sizeMul;
            const screenR = Math.max(3, baseR * zoom * 1.65);
            const spriteR = 4;
            const sprite = this._foodSprite(hue, spriteR, false, false);
            const size = sprite.width * (screenR / spriteR);
            const half = size / 2;
            const { x: fx, y: fy } = toScreen(wx, wy);

            ctx.globalAlpha = Math.max(0.12, 1 - ease * 0.88);
            ctx.drawImage(sprite, Math.round(fx - half), Math.round(fy - half), size, size);
            ctx.globalAlpha = 1.0;

            ghosts[kept++] = g;
        }
        ghosts.length = kept;
    }

    _blitSprite(ctx, sprite, x, y, scale = 1, angle = 0) {
        const half = sprite.width / scale / 2;
        const dw = sprite.width / scale;
        const dh = sprite.height / scale;
        if (angle === 0) {
            ctx.drawImage(sprite, (x - half) | 0, (y - half) | 0, dw, dh);
            return;
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
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

    _paintSnakeSegment(g, c, rPx, cs, contrast = 1) {
        const segmentCanvas = getSnakeSegmentCanvas(rPx, cs);
        g.save();
        g.translate(c, c);
        const half = segmentCanvas.width / 2;
        g.drawImage(segmentCanvas, -half, -half);
        g.restore();
    }

    /** Soft circular flank blob — stamped along the spine. */
    _getBodySideShadowDot(radius) {
        const dotR = Math.max(4, Math.ceil(radius * 0.52));
        const key = `side_sh_v3|${dotR}`;
        return this._getSprite(key, dotR * 2 + 20, (g, sz) => {
            const c = sz / 2;
            const grad = g.createRadialGradient(c, c, 0, c, c, dotR);
            grad.addColorStop(0, 'rgba(0,0,0,0.28)');
            grad.addColorStop(0.20, 'rgba(0,0,0,0.18)');
            grad.addColorStop(0.45, 'rgba(0,0,0,0.08)');
            grad.addColorStop(0.70, 'rgba(0,0,0,0.02)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grad;
            g.beginPath();
            g.arc(c, c, dotR, 0, Math.PI * 2);
            g.fill();
        });
    }

    /** Blurred flank shadow along the body — offset from spine, not on segments. */
    _blitBodySideShadow(ctx, bumps, count, radius, opts = {}) {
        if (count < 3) return;
        const q = opts.quality ?? 1;
        const isYou = !!opts.isYou;
        if (!isYou && q < 0.50) return;

        const sideDot = this._getBodySideShadowDot(radius);
        const sideHalf = sideDot.width / 2;
        const sideOff = radius * 0.88;
        const sideStride = Math.max(1, Math.round(count / (isYou ? 30 : 18)));

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = isYou ? 0.26 : 0.18;
        for (let i = count - 1; i >= 0; i -= sideStride) {
            const p = bumps[i];
            if (p.x < -80 || p.y < -80 || p.x > this.W + 80 || p.y > this.H + 80) continue;
            const tangent = this._bumpTangent(bumps, i);
            const perpX = Math.sin(tangent);
            const perpY = -Math.cos(tangent);
            for (const sign of [-1, 1]) {
                const sx = p.x + sign * perpX * sideOff;
                const sy = p.y + sign * perpY * sideOff;
                ctx.drawImage(sideDot, (sx - sideHalf) | 0, (sy - sideHalf) | 0);
            }
        }

        ctx.restore();
    }

    /** Soft spine highlight dot — stamped along spine. */
    _getSpineHighlightDot(radius, cs) {
        const dotR = Math.max(3, Math.ceil(radius * 0.38));
        const key = `hl_dot_v4|${cs}|${dotR}`;
        return this._getSprite(key, dotR * 2 + 6, (g, sz) => {
            const c = sz / 2;
            const col = parseColor(cs);
            const hi = shadeColor(col, 62);
            const grad = g.createRadialGradient(c, c, 0, c, c, dotR);
            grad.addColorStop(0, rgb(hi, 0.18));
            grad.addColorStop(0.22, rgb(hi, 0.10));
            grad.addColorStop(0.50, rgb(hi, 0.04));
            grad.addColorStop(0.78, rgb(hi, 0.01));
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = grad;
            g.beginPath();
            g.arc(c, c, dotR, 0, Math.PI * 2);
            g.fill();
        });
    }

    /** Stamp pre-blurred highlight dots along the spine — cheap, no per-frame blur. */
    _blitSpineHighlight(ctx, bumps, count, radius, cs, alphaMul = 1, opts = {}) {
        if (count < 3) return;
        const dot = this._getSpineHighlightDot(radius, cs);
        const half = dot.width / 2;
        const stride = Math.max(1, Math.round(count / 40));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 * alphaMul;
        for (let i = count - 1; i >= 0; i -= stride) {
            const p = bumps[i];
            if (p.x < -60 || p.y < -60 || p.x > this.W + 60 || p.y > this.H + 60) continue;
            ctx.drawImage(dot, (p.x - half) | 0, (p.y - half) | 0);
        }
        ctx.restore();
    }

    /** Turn strength [0,1] and sign (+1 left, -1 right) at bump — for crease shading in bends. */
    _bumpTurn(bumps, i) {
        if (i < 1 || i >= bumps.length - 1) return { strength: 0, side: 0 };
        const tPrev = this._bumpTangent(bumps, i - 1);
        const tNext = this._bumpTangent(bumps, i);
        let d = tNext - tPrev;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        if (Math.abs(d) < 0.04) return { strength: 0, side: 0 };
        return {
            strength: Math.min(1, Math.abs(d) / 0.48),
            side: d > 0 ? 1 : -1,
        };
    }

    /** Extra inner-edge shade on sharp bends — body-local multiply (no per-stamp blur). */
    _blitBendCrease(ctx, x, y, tangent, radius, turn) {
        if (turn.strength < 0.07) return;
        const r = radius * 0.94;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tangent);
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = Math.min(0.28, 0.08 + turn.strength * 0.18);
        const g = ctx.createLinearGradient(0, -r, 0, r);
        if (turn.side > 0) {
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(0.5, 'rgba(0,0,0,0)');
            g.addColorStop(0.78, 'rgba(0,0,0,0.18)');
            g.addColorStop(1, 'rgba(0,0,0,0.42)');
        } else {
            g.addColorStop(0, 'rgba(0,0,0,0.42)');
            g.addColorStop(0.22, 'rgba(0,0,0,0.18)');
            g.addColorStop(0.5, 'rgba(0,0,0,0)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /** Soft outer glow for additive body pass. */
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
            pair.normal = this._getSprite(`pr_norm_v39|${key}`, ssSize, (g, sz) => {
                this._paintSnakeSegment(g, sz / 2, ssR, cs, 1);
            });
            pair.boostBody = this._getSprite(`pr_norm_v39|${key}|boost`, ssSize, (g, sz) => {
                this._paintSnakeSegment(g, sz / 2, ssR, cs, 1.04);
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

    /** Cache all rainbow segment stamps once per snake draw (avoids per-bump lookups). */
    _getRainbowStamps(cacheR, prNeeds, bodyRadius) {
        const rainbowColors = [
            '#c080ff', '#9099ff', '#80d0d0', '#80ff80',
            '#eeee70', '#ffa060', '#ff9050', '#ff4040', '#e030e0',
        ];
        let pack = this._rainbowStampPack;
        if (!pack || pack.cacheR !== cacheR || pack.prKey !== `${prNeeds.glow}|${prNeeds.boostOverlay}|${prNeeds.trailGlow}`) {
            const stamps = new Array(rainbowColors.length);
            for (let i = 0; i < rainbowColors.length; i++) {
                stamps[i] = this._getSnakeSegmentStamp(rainbowColors[i], cacheR, prNeeds);
            }
            pack = { cacheR, prKey: `${prNeeds.glow}|${prNeeds.boostOverlay}|${prNeeds.trailGlow}`, colors: rainbowColors, stamps };
            this._rainbowStampPack = pack;
        }
        return pack;
    }

    _drawSnake(snake, toScreen, zoom) {
        const isYou = !!snake.isYou;

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

        const sc = snake.sc ?? ((snake.radius || SLITHER_BASE_R) / SLITHER_BASE_R);
        const bodyRadiusWorld = snake.radius || (SLITHER_BASE_R * sc);
        const stampStepWorld = Math.max(1.15, bodyRadiusWorld * 0.42);
        const q = this._quality;
        const holdActive = this._holdActive;
        const qMul = Math.max(this.isMobile ? 0.88 : 0.78, q);
        let arcLen = 0;
        if (segs.length > 1) {
            const dx0 = segs[1].x - segs[0].x;
            const dy0 = segs[1].y - segs[0].y;
            arcLen = Math.sqrt(dx0 * dx0 + dy0 * dy0) * (segs.length - 1);
        }
        const neededStamps = Math.ceil(arcLen / stampStepWorld) + 1;
        const stampCap = Math.round((
            boosting
                ? (this.isMobile ? 110 : 92)
                : (this.isMobile ? 98 : 85)
        ) * qMul);
        const maxStamps = Math.min(Math.max(neededStamps, 6), stampCap);
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

        const cacheR = Math.max(8, Math.round(bodyRadius / 8) * 8);
        const prNeeds = {
            glow: !holdActive && q >= 0.75,
            boostOverlay: boosting && q >= 0.8,
            trailGlow: boosting,
        };

        const isRainbow = (snake.color === 'random');
        const rainbowPack = isRainbow ? this._getRainbowStamps(cacheR, prNeeds, bodyRadius) : null;

        let normal, boostBody, glow, boostOverlay, trailGlow, bodySS, stampScale;
        if (!isRainbow) {
            const stamp = this._getSnakeSegmentStamp(cs, cacheR, prNeeds);
            normal = stamp.normal;
            boostBody = stamp.boostBody;
            glow = stamp.glow;
            boostOverlay = stamp.boostOverlay;
            trailGlow = stamp.trailGlow;
            bodySS = stamp.bodySS;
            stampScale = bodySS * (cacheR / bodyRadius);
        } else {
            const stamp = rainbowPack.stamps[0];
            trailGlow = stamp.trailGlow;
            boostOverlay = stamp.boostOverlay;
            bodySS = stamp.bodySS;
            stampScale = bodySS * (cacheR / bodyRadius);
        }
        const halfT = trailGlow ? trailGlow.width / 2 : 0;
        const halfB = boostOverlay ? boostOverlay.width / 2 : 0;
        const bumpCount = bumps.length;

        const headBump = bumps[0];

        let trail = this._boostTrailPool.get(snake.id);
        if (!trail) {
            trail = [];
            this._boostTrailPool.set(snake.id, trail);
        }
        if (boosting) {
            trail.unshift({ x: headBump.x, y: headBump.y, a: angle });
            if (trail.length > 6) trail.length = 6;
        } else if (trail.length > 0) {
            trail.length = 0;
        }

        if (boosting && trailGlow && trail.length > 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let t = 1; t < trail.length; t++) {
                const tr = trail[t];
                ctx.globalAlpha = (1 - t / trail.length) * 0.12 * pulse;
                ctx.drawImage(trailGlow, tr.x - halfT, tr.y - halfT);
            }
            ctx.restore();
        }

        // Body stamps — all snakes
        const dw = normal ? normal.width / stampScale : 0;
        const dh = normal ? normal.height / stampScale : 0;
        const half = dw / 2;

        for (let i = bumpCount - 1; i >= 0; i--) {
            const p = bumps[i];
            if (p.x < -80 || p.y < -80 || p.x > this.W + 80 || p.y > this.H + 80) continue;

            let sprite;
            let currentStampScale = stampScale;
            let currentDw = dw;
            let currentDh = dh;
            let currentHalf = half;

            if (isRainbow) {
                const colorIndex = Math.floor((this._frame * 0.12 + i * 0.35) % rainbowPack.colors.length);
                const stamp = rainbowPack.stamps[colorIndex];
                sprite = (boosting && i === 0) ? stamp.boostBody : stamp.normal;
                currentStampScale = stamp.bodySS * (cacheR / bodyRadius);
                currentDw = sprite.width / currentStampScale;
                currentDh = sprite.height / currentStampScale;
                currentHalf = currentDw / 2;
            } else {
                sprite = (boosting && i === 0) ? boostBody : normal;
            }

            // Tangent rotation only for your snake — other snakes use axis-aligned stamps (big CPU win).
            const tangent = isYou ? this._bumpTangent(bumps, i) : 0;

            if (tangent === 0) {
                ctx.drawImage(sprite, (p.x - currentHalf) | 0, (p.y - currentHalf) | 0, currentDw, currentDh);
            } else {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(tangent);
                ctx.drawImage(sprite, -currentDw / 2, -currentDh / 2, currentDw, currentDh);
                ctx.restore();
            }
        }

        // Spine highlight baked into the radial gradient. No separate blit pass needed.

        if (prNeeds.glow) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = boosting ? 0.22 * pulse : 0.12;
            const glowStride = boosting ? 4 : 5;
            for (let i = bumpCount - 1; i >= 0; i -= glowStride) {
                const p = bumps[i];
                if (p.x < -80 || p.y < -80 || p.x > this.W + 80 || p.y > this.H + 80) continue;
                let currentGlow = glow;
                let currentGlowScale = stampScale;
                if (isRainbow) {
                    const colorIndex = Math.floor((this._frame * 0.12 + i * 0.35) % rainbowPack.colors.length);
                    const stamp = rainbowPack.stamps[colorIndex];
                    currentGlow = stamp.glow;
                    currentGlowScale = stamp.bodySS * (cacheR / bodyRadius);
                }
                if (currentGlow) {
                    const gdw = currentGlow.width / currentGlowScale;
                    const gdh = currentGlow.height / currentGlowScale;
                    const ghalf = gdw / 2;
                    ctx.drawImage(currentGlow, (p.x - ghalf) | 0, (p.y - ghalf) | 0, gdw, gdh);
                }
            }
            ctx.restore();
        }

        if (boosting && prNeeds.boostOverlay && boostOverlay) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const bdw = boostOverlay.width / stampScale;
            const bdh = boostOverlay.height / stampScale;
            const bhalf = bdw / 2;
            for (let i = bumpCount - 1; i >= 0; i -= 4) {
                const p = bumps[i];
                if (p.x < -80 || p.y < -80 || p.x > this.W + 80 || p.y > this.H + 80) continue;
                const along = i / Math.max(1, bumpCount - 1);
                const headProx = 1 - along;
                ctx.globalAlpha = (0.22 + headProx * 0.22) * pulse;
                ctx.drawImage(boostOverlay, (p.x - bhalf) | 0, (p.y - bhalf) | 0, bdw, bdh);
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
        const eyeSide = headEyeRadius * 0.39;
        const eyeFwd = headEyeRadius * 0.31;
        const eyeR = Math.max(3, headEyeRadius * 0.43);
        const pupilR = eyeR * 0.48;

        if (boosting && boostOverlay) {
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

        if (!this.hideOverlays) {
            if (snake.name) {
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                const fontSize = Math.max(12, headEyeRadius * 0.85);
                ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                ctx.lineWidth = 3;
                const nameY = hy - headEyeRadius - 12;
                ctx.strokeText(snake.name, hx, nameY);
                ctx.fillText(snake.name, hx, nameY);
            }

            if (!this.isBattleRoyale) {
                const pillY = hy + headRadius + 14;
                const displayBalance = isYou 
                    ? (this.hud.balance ?? snake.dollarBalance ?? snake.balance) 
                    : (snake.dollarBalance ?? snake.balance);
                drawBalanceBadge(ctx, hx, pillY, displayBalance, isYou);
            }
        }

        // Mobile steering arrow — only while finger is on screen, further ahead of the head.
        if (this.isMobile && this._touchSteering) {
            const am = Math.hypot(this.inputDx, this.inputDy);
            if (am > 0.001) {
                const aang = Math.atan2(this.inputDy, this.inputDx);
                const size = Math.max(11, Math.min(22, headRadius * 0.95));
                const gap = headRadius * 3.5 + size * 1.35;
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
        this._holdActive = this._isHoldActive(nowMs);
        this._cashoutActive = this._isCashoutActive(nowMs);
        // Adaptive quality — targets ~120 FPS (8.3ms), degrades only under sustained load.
        const qFloor = 0.62;
        if (this._perfEma > 16) this._quality = Math.max(qFloor, this._quality - 0.06);
        else if (this._perfEma > 11) this._quality = Math.max(qFloor, this._quality - 0.02);
        else if (this._perfEma < 8.5) this._quality = Math.min(1, this._quality + 0.03);

        if (this._quality >= 0.88) {
            this.ctx.imageSmoothingQuality = 'high';
        } else if (this._quality < 0.72) {
            this.ctx.imageSmoothingQuality = 'low';
        } else {
            this.ctx.imageSmoothingQuality = 'medium';
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
            rs.radius = snake.isYou ? (s?.visualRadius ?? snake.radius) : snake.radius;
            rs.sc = snake.isYou
                ? ((s?.visualRadius ?? snake.radius) / 6.2)
                : (snake.sc ?? (rs.radius / 6.2));
            rs.fam = snake.fam ?? 0;
            rs.boost = snake.boost;
            rs.isYou = snake.isYou;
            rs.name = snake.name;
            rs.balance = snake.balance;
            rs.dollarBalance = snake.dollarBalance;
            rs.segments = s ? s.segments : snake.segments;
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

            // slither.io gsc zoom — snake shrinks on screen as sc grows
            const meR = me.radius || SLITHER_BASE_R;
            const meSc = me.sc ?? (meR / SLITHER_BASE_R);
            const minZoom = this.isMobile ? 0.85 : 1.32;
            const slitherGsc = Math.pow(1.094 / Math.max(1.05, meSc), 0.52);
            const targetZoom = Math.min(this.baseZoom, Math.max(minZoom, this.baseZoom * slitherGsc));
            const za = 1 - Math.exp(-dt / 0.6);
            this.zoom += (targetZoom - this.zoom) * za;
        }

        const cx = this.camera.x;
        const cy = this.camera.y;
        const zoom = this._safeZoom();

        // Mouth point for eat-range slurp animation (see _drawFood).
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
        const foodHalfW = W / 2 / zoom + 160 / zoom;
        const foodHalfH = H / 2 / zoom + 160 / zoom;
        this._rebuildVisibleFoodBuf(cx, cy, foodHalfW, foodHalfH);
        this._drawFood(ctx, this._visibleFoodBuf, toScreen, W, H, zoom, dt);

        const sorted = this._sortedRenderSnakes;
        if (this._sortDirty || sorted.length !== renderSnakes.length) {
            sorted.length = 0;
            for (let i = 0; i < renderSnakes.length; i++) sorted.push(renderSnakes[i]);
            sorted.sort((a, b) => (a.radius || 6) - (b.radius || 6));
            this._sortDirty = false;
        }

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
        if (me?.segments?.[0] && !this.hideOverlays) {
            const head = me.segments[0];
            const { x: hx, y: hy } = toScreen(head.x, head.y);
            const headRadius = (me.radius || 6) * zoom * (this.snakeThickness ?? 1);
            const { cashoutEndAt, cashoutTotal } = this.hud;
            const ringR = headRadius + 10;

            if (cashoutEndAt && cashoutEndAt > Date.now()) {
                const progress = getCashoutRingProgress(cashoutEndAt, cashoutTotal || 10);
                drawCashoutProgressRing(ctx, hx, hy, ringR, progress);
            }
        }

        if (!this.hideOverlays && (me?.segments?.[0] || this.spectatorMode)) {
            const viewHalfW = W / (2 * zoom);
            const viewHalfH = H / (2 * zoom);
            if ((this._minimapFrame++ & 7) === 0 && !this._cashoutActive && !this._holdActive) {
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
            }
            const skipMinimapFood = this._foodDrawList.length > 180;
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
                food: skipMinimapFood ? [] : minimap.food,
                zone: this.state.zone,
            });
        }
    }

    destroy() {
        this.pause();
        this._boostTrailPool.clear();
        this._sprites.clear();
        this._prImgs.clear();
        this._foodAnimCache.clear();
        this._slurpGhosts.length = 0;
        this._visibleFoodBuf.length = 0;
        this._foodSpatialGrid.clear();
        this._foodGridDirty = true;
        this._renderPool.clear();
        this.smooth.clear();
        this._holdStartAt = 0;
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
