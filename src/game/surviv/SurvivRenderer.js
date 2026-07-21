/**
 * Surviv client renderer - top-down shooter canvas.
 */

import { drawBalanceBadge } from '../balanceBadge.js';
import { drawGameEmote } from '../../components/GameSocialOverlay.jsx';
import { drawCashoutProgressRing } from '../cashoutRing.js';
import { drawGameMinimap } from '../minimap.js';

const WEAPON_LABELS = {
    fists: 'Fists',
    knife: 'Combat Knife',
    pistol: 'M9 Pistol',
    revolver: 'R8 Revolver',
    smg: 'Vector SMG',
    shotgun: 'Pump Shotgun',
    assault: 'Scout Rifle',
    dmr: 'Falcon DMR',
    sniper: 'AWM Sniper',
    lmg: 'M249 LMG',
};

const RARITY_COLORS = {
    common: '#d7c396',
    rare: '#71a7ff',
    military: '#c985ff',
};

const LOOT_COLORS = {
    money: '#ffd45a',
    medkit: '#5fe08a',
    armor: '#5d9cff',
    ammo: '#d7d1bb',
    grenade: '#f59e0b',
    weapon: '#f2774f',
};

const WEAPON_FIRE_RATE = {
    fists: 0, knife: 340, pistol: 280, revolver: 600, smg: 80, shotgun: 750,
    assault: 150, dmr: 350, sniper: 1400, lmg: 110,
};

const WEAPON_SHAKE = {
    fists: 0, knife: 0.25, pistol: 0.3, revolver: 0.8, smg: 0.15, shotgun: 1.0,
    assault: 0.3, dmr: 0.6, sniper: 1.4, lmg: 0.25,
};

const WEAPON_BULLET_SPEED = {
    pistol: 34, revolver: 44, smg: 38, shotgun: 30,
    assault: 42, dmr: 48, sniper: 58, lmg: 40,
};

const WEAPON_BULLET_SPECS = {
    shotgun: {
        trailLen: 12,
        slugLen: 3,
        thickness: 1.4,
        glowColorStart: 'rgba(240, 120, 30, 0)',
        glowColorMid: 'rgba(240, 120, 30, 0.15)',
        glowColorEnd: 'rgba(240, 120, 30, 0.4)',
        glowColorTip: 'rgba(255, 200, 100, 0.5)',
        coreColorStart: 'rgba(255, 200, 100, 0)',
        coreColorMid: 'rgba(255, 200, 100, 0.3)',
        coreColorEnd: 'rgba(255, 200, 100, 0.9)'
    },
    sniper: {
        trailLen: 38,
        slugLen: 6,
        thickness: 2.8,
        glowColorStart: 'rgba(0, 140, 255, 0)',
        glowColorMid: 'rgba(0, 140, 255, 0.18)',
        glowColorEnd: 'rgba(0, 140, 255, 0.45)',
        glowColorTip: 'rgba(230, 245, 255, 0.55)',
        coreColorStart: 'rgba(230, 245, 255, 0)',
        coreColorMid: 'rgba(230, 245, 255, 0.45)',
        coreColorEnd: 'rgba(230, 245, 255, 0.95)'
    },
    revolver: {
        trailLen: 22,
        slugLen: 5,
        thickness: 2.2,
        glowColorStart: 'rgba(255, 110, 20, 0)',
        glowColorMid: 'rgba(255, 110, 20, 0.15)',
        glowColorEnd: 'rgba(255, 110, 20, 0.4)',
        glowColorTip: 'rgba(255, 235, 180, 0.5)',
        coreColorStart: 'rgba(255, 235, 180, 0)',
        coreColorMid: 'rgba(255, 235, 180, 0.35)',
        coreColorEnd: 'rgba(255, 235, 180, 0.9)'
    },
    pistol: {
        trailLen: 18,
        slugLen: 4,
        thickness: 1.6,
        glowColorStart: 'rgba(230, 160, 40, 0)',
        glowColorMid: 'rgba(230, 160, 40, 0.12)',
        glowColorEnd: 'rgba(230, 160, 40, 0.35)',
        glowColorTip: 'rgba(255, 245, 200, 0.45)',
        coreColorStart: 'rgba(255, 245, 200, 0)',
        coreColorMid: 'rgba(255, 245, 200, 0.3)',
        coreColorEnd: 'rgba(255, 245, 200, 0.9)'
    },
    assault: {
        trailLen: 26,
        slugLen: 5,
        thickness: 2.1,
        glowColorStart: 'rgba(255, 180, 50, 0)',
        glowColorMid: 'rgba(255, 180, 50, 0.15)',
        glowColorEnd: 'rgba(255, 180, 50, 0.38)',
        glowColorTip: 'rgba(255, 255, 240, 0.5)',
        coreColorStart: 'rgba(255, 255, 240, 0)',
        coreColorMid: 'rgba(255, 255, 240, 0.35)',
        coreColorEnd: 'rgba(255, 255, 240, 0.9)'
    },
    dmr: {
        trailLen: 28,
        slugLen: 5,
        thickness: 2.3,
        glowColorStart: 'rgba(255, 190, 60, 0)',
        glowColorMid: 'rgba(255, 190, 60, 0.15)',
        glowColorEnd: 'rgba(255, 190, 60, 0.4)',
        glowColorTip: 'rgba(255, 255, 245, 0.5)',
        coreColorStart: 'rgba(255, 255, 245, 0)',
        coreColorMid: 'rgba(255, 255, 245, 0.35)',
        coreColorEnd: 'rgba(255, 255, 245, 0.9)'
    },
    smg: {
        trailLen: 16,
        slugLen: 4,
        thickness: 1.7,
        glowColorStart: 'rgba(255, 140, 40, 0)',
        glowColorMid: 'rgba(255, 140, 40, 0.12)',
        glowColorEnd: 'rgba(255, 140, 40, 0.35)',
        glowColorTip: 'rgba(255, 240, 210, 0.45)',
        coreColorStart: 'rgba(255, 240, 210, 0)',
        coreColorMid: 'rgba(255, 240, 210, 0.3)',
        coreColorEnd: 'rgba(255, 240, 210, 0.9)'
    },
    lmg: {
        trailLen: 18,
        slugLen: 4,
        thickness: 1.8,
        glowColorStart: 'rgba(255, 150, 50, 0)',
        glowColorMid: 'rgba(255, 150, 50, 0.12)',
        glowColorEnd: 'rgba(255, 150, 50, 0.35)',
        glowColorTip: 'rgba(255, 235, 200, 0.45)',
        coreColorStart: 'rgba(255, 235, 200, 0)',
        coreColorMid: 'rgba(255, 235, 200, 0.3)',
        coreColorEnd: 'rgba(255, 235, 200, 0.9)'
    },
    default: {
        trailLen: 22,
        slugLen: 5,
        thickness: 1.8,
        glowColorStart: 'rgba(200, 200, 200, 0)',
        glowColorMid: 'rgba(200, 200, 200, 0.1)',
        glowColorEnd: 'rgba(200, 200, 200, 0.3)',
        glowColorTip: 'rgba(255, 255, 255, 0.4)',
        coreColorStart: 'rgba(255, 255, 255, 0)',
        coreColorMid: 'rgba(255, 255, 255, 0.3)',
        coreColorEnd: 'rgba(255, 255, 255, 0.9)'
    }
};

const SURFACE_KINDS = new Set(['road', 'houseFloor', 'field', 'water', 'river', 'river_path', 'bridge']);
const LOS_BLOCKING_KINDS = new Set(['wall', 'interiorWall', 'container', 'crate']);
const HOUSE_BOUND_PROP_KINDS = new Set(['furniture', 'machine', 'container', 'crate', 'barrel']);
const CACHEABLE_PROP_KINDS = new Set([
    'tree', 'bush', 'rock', 'container', 'crate', 'barrel',
    'door', 'furniture', 'machine', 'sandbag',
]);

function obstacleRenderSignature(obstacles) {
    let hash = 2166136261;
    const mixString = (value) => {
        const text = String(value ?? '');
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
    };
    const mixNumber = (value) => {
        hash ^= Math.round((Number(value) || 0) * 10);
        hash = Math.imul(hash, 16777619);
    };

    for (const o of obstacles) {
        mixString(o.id);
        mixString(o.kind);
        mixString(o.variant);
        mixString(o.houseId);
        mixString(o.role);
        mixString(o.orientation);
        mixString(o.entranceRole);
        mixString(o.landmarkType);
        mixString(o.label);
        mixNumber(o.x);
        mixNumber(o.y);
        mixNumber(o.w);
        mixNumber(o.h);
        mixNumber(o.rotation);
        mixNumber(o.width);
        mixNumber(o.collidable === false ? 0 : 1);
        mixNumber(o.hp);
        mixNumber(o.maxHp);
    }
    return `${obstacles.length}:${hash >>> 0}`;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
};

function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
}

function seededNoise(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

function traceSmoothWaterPath(ctx, points, originX = 0, originY = 0) {
    if (!points?.length) return;
    const local = points.map(point => ({ x: point.x - originX, y: point.y - originY }));
    ctx.beginPath();
    ctx.moveTo(local[0].x, local[0].y);
    for (let i = 1; i < local.length - 1; i++) {
        const current = local[i];
        const next = local[i + 1];
        ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    const last = local[local.length - 1];
    ctx.lineTo(last.x, last.y);
}

function traceOrganicPond(ctx, obstacle, padding = 0) {
    const count = 24;
    const rx = obstacle.w / 2 + padding;
    const ry = obstacle.h / 2 + padding;
    const points = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const wobble = 1
            + Math.sin(angle * 3 + obstacle.x * 0.007) * 0.055
            + Math.sin(angle * 5 + obstacle.y * 0.009) * 0.035;
        points.push({ x: Math.cos(angle) * rx * wobble, y: Math.sin(angle) * ry * wobble });
    }
    ctx.beginPath();
    const firstMid = {
        x: (points[count - 1].x + points[0].x) / 2,
        y: (points[count - 1].y + points[0].y) / 2,
    };
    ctx.moveTo(firstMid.x, firstMid.y);
    for (let i = 0; i < count; i++) {
        const point = points[i];
        const next = points[(i + 1) % count];
        ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
    }
    ctx.closePath();
}

function biomeAt() {
    return { base: '#3d6b35', alt: '#4a7a42', grass: 'rgba(45,88,38,0.22)' };
}

export class SurvivRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        // The game paints every pixel each frame, so an opaque low-latency
        // context avoids unnecessary alpha compositing with the DOM.
        this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        this.camera = { x: 0, y: 0 };
        this.zoom = 1;
        this.targetZoom = 1.08;
        this.isMobileLayout = false;
        this.worldHalf = 10000;
        this.myId = null;
        this.players = [];
        this.worldEmotes = new Map();
        this.loot = [];
        this.bullets = [];
        this.localShotTracers = [];
        this.obstacles = [];
        this.minimap = { players: [], food: [], obstacles: [] };
        this.houseFloors = [];
        this.roomZones = [];
        this.doorways = [];

        this.surfaceObstacles = [];
        this.fieldObstacles = [];
        this.waterObstacles = [];
        this.roadObstacles = [];
        this.bridgeObstacles = [];
        this.sortedWorldObstacles = [];
        this._roomZonesByHouseId = new Map();
        this._doorwaysByHouseId = new Map();
        this._interiorFogHouseIds = new Set();
        this._losSegmentsByHouseId = new Map();
        this._renderObstaclesByHouseId = new Map();
        this._collisionBuckets = new Map();
        this._obstacleRenderSignature = '';
        this._obstacleRevision = 0;
        this._viewLeft = -Infinity;
        this._viewRight = Infinity;
        this._viewTop = -Infinity;
        this._viewBottom = Infinity;
        this._terrainTexture = null;
        this._terrainPattern = null;
        this.zone = null;
        this.me = null;
        this.hoveredChestId = null;
        this.lootToast = null;
        this.lastLootId = null;
        this.hud = {
            balance: 0,
            hp: 100,
            maxHp: 100,
            armor: 0,
            weapon: 'fists',
            ammo: 15,
            clipSize: 15,
            reloading: false,
            kills: 0,
            cashoutEndAt: 0,
            cashoutTotal: 10,
            cashoutSeconds: 0,
            inventory: { weapons: [], medkits: 0, ammoPacks: 0, chestsOpened: 0 },
        };
        this.keys = { w: false, a: false, s: false, d: false };
        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false };
        this.mobileMove = { x: 0, y: 0 };
        this.mobileAim = { angle: 0, strength: 0, active: false, shooting: false };
        this.inputEnabled = true;
        this.spectatorMode = false;
        this.externalCameraGetter = null;
        this.inventoryOpen = false;
        this.hideNames = localStorage.getItem('hide_player_names') === 'true';
        this.running = false;
        this._raf = null;
        this._lastFrameAt = performance.now();
        this._frameNow = Date.now();
        // Cached gradients to avoid per-frame allocation
        this._cachedZoneGlowGrad = null;
        this._cachedZoneGlowKey = '';
        this._cachedVignetteGrad = null;
        this._cachedVignetteKey = '';
        this._cachedDangerGrad = null;
        this._cachedDangerKey = '';
        this._cachedLowAmmoGrad = null;
        this._cachedLowAmmoKey = '';
        // FPS counter
        this._fpsFrames = 0;
        this._fpsLastSampleAt = performance.now();
        this._fpsDisplay = 0;
        this._onResize = () => this.resize();
        window.addEventListener('resize', this._onResize);

        // --- New visual feedback systems ---
        // Particle system (muzzle flash, bullet impacts, debris)
        this.particles = [];
        // Hit marker (center-screen X when you deal damage)
        this.hitMarkers = [];
        // Damage direction indicators (red arcs at screen edge)
        this.damageIndicators = [];
        // Floating damage numbers
        this.damageNumbers = [];
        // Camera shake
        this.cameraShake = { x: 0, y: 0, intensity: 0, decay: 0.88 };
        // Kill feed and server-synced death presentation
        this.killFeed = [];
        this.deathMarkers = [];
        this.killAnimations = [];
        this._seenDeathMarkerIds = new Set();
        this._graveFirstSeenAt = new Map();
        // Blood decals on the ground
        this.bloodDecals = [];
        // Previous player states for interpolation & tracking
        this._prevPlayers = new Map();
        this._interpPlayers = new Map();
        this._interpMe = null;
        this._interpBullets = new Map();
        this._currentVisibilityPolygon = null;
        this._currentVisibilityHouseId = null;
        this._losCacheKey = '';
        this._losCachedPolygon = null;
        this._minimapCanvas = null;
        this._minimapCtx = null;
        this._nextMinimapRenderAt = 0;
        this._roofSpriteCache = new Map();
        this._roofCacheBuildsThisFrame = 0;
        this._obstacleSpriteCache = new Map();
        this._obstacleCacheBuildsThisFrame = 0;
        // Previous HP for detecting damage
        this._prevHp = 100;
        // Previous ammo for detecting shots fired
        this._prevAmmo = -1;
        this._prevWeapon = 'fists';
        // Weapon switch animation
        this._weaponSwitchT = 0;
        this._weaponSwitchFrom = 'fists';
        // Muzzle flash
        this._muzzleFlash = 0;
        // Low ammo pulse
        this._lowAmmoPulse = 0;
        // Player alive count
        this.aliveCount = 0;

        this.resize();
    }

    resize() {
        const parent = this.canvas.parentElement;
        const w = parent?.clientWidth || window.innerWidth;
        const h = parent?.clientHeight || window.innerHeight;
        // Surviv can be raster-heavy. A restrained adaptive cap keeps Retina
        // canvases sharp without paying the old 4x pixel cost at DPR 2.
        const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0;
        this.isMobileLayout = coarsePointer || w < 760;
        const dprCap = w * h >= 1500000 ? 1 : (this.isMobileLayout ? 1 : 1.25);
        const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.viewW = w;
        this.viewH = h;
        this._terrainPattern = null;
        this.targetZoom = this.isMobileLayout ? 0.86 : 1.08;
        if (!this.spectatorMode) this.zoom = this.targetZoom;
    }

    destroy() {
        this.pause();
        window.removeEventListener('resize', this._onResize);
    }

    start() {
        if (this.running) return;
        this.running = true;

        this._lastFrameAt = performance.now();
        const loop = (now) => {
            if (!this.running) return;
            const dt = Math.min(0.05, Math.max(0.001, (now - this._lastFrameAt) / 1000));
            this._lastFrameAt = now;
            this.draw(dt);
            this._raf = requestAnimationFrame(loop);
        };
        this._raf = requestAnimationFrame(loop);
    }

    pause() {
        this.running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
    }

    showEmote(payload) {
        if (!payload?.playerId || !payload?.emote) return;
        const now = performance.now();
        this.worldEmotes.set(payload.playerId, { emote: payload.emote, startedAt: now, expiresAt: now + 2600 });
    }

    resetSession() {
        this.players = [];
        this.worldEmotes.clear();
        this.loot = [];
        this.bullets = [];
        this.localShotTracers = [];
        this.deathMarkers = [];
        this.killAnimations = [];
        this._seenDeathMarkerIds.clear();
        this._graveFirstSeenAt.clear();
        this.obstacles = [];
        this.minimap = { players: [], food: [], obstacles: [] };
        this.houseFloors = [];
        this.roomZones = [];
        this.doorways = [];
        this._currentVisibilityPolygon = null;
        this._currentVisibilityHouseId = null;
        this._losCacheKey = '';
        this._losCachedPolygon = null;
        this.surfaceObstacles = [];
        this.fieldObstacles = [];
        this.waterObstacles = [];
        this.roadObstacles = [];
        this.bridgeObstacles = [];
        this.sortedWorldObstacles = [];
        this._roomZonesByHouseId.clear();
        this._doorwaysByHouseId.clear();
        this._interiorFogHouseIds.clear();
        this._losSegmentsByHouseId.clear();
        this._renderObstaclesByHouseId.clear();
        this._obstacleRenderSignature = '';
        this._obstacleRevision++;
        this._roofSpriteCache.clear();
        this._obstacleSpriteCache.clear();
        this.me = null;
        this.zone = null;
        this.hoveredChestId = null;
        this.lootToast = null;
        this.lastLootId = null;
        this.particles = [];
        this.hitMarkers = [];
        this.damageIndicators = [];
        this.damageNumbers = [];
        this.killFeed = [];
        this.bloodDecals = [];
        this._prevPlayers.clear();
        this._interpPlayers.clear();
        this._seenDeathMarkerIds.clear();
        this._prevHp = 100;
        this._prevAmmo = -1;
        this._prevWeapon = 'fists';
        this.camera.x = 0;
        this.camera.y = 0;
        this.hud = {
            ...this.hud,
            balance: 0,
            hp: 100,
            maxHp: 100,
            armor: 0,
            weapon: 'fists',
            ammo: 0,
            clipSize: 0,
            reloading: false,
            kills: 0,
            cashoutEndAt: 0,
            cashoutSeconds: 0,
            inventory: { weapons: [], medkits: 0, ammoPacks: 0, chestsOpened: 0 },
        };
        this.clearInput();
        this._interpMe = null;
        this._interpBullets.clear();
        this.myId = null;
    }

    setMyId(id) {
        this.myId = id;
    }

    setHud(patch) {
        Object.assign(this.hud, patch);
    }

    setInputEnabled(enabled) {
        this.inputEnabled = enabled;
        if (!enabled) this.clearInput();
    }

    setSpectatorMode(on, cam) {
        this.spectatorMode = on;
        if (cam) {
            this.camera.x = cam.x;
            this.camera.y = cam.y;
            if (cam.zoom) this.zoom = cam.zoom;
        } else if (!on) {
            this.zoom = this.targetZoom;
        }
    }

    setExternalCameraGetter(fn) {
        this.externalCameraGetter = fn;
    }

    setHoldStart(atMs) {
        this.hud.cashoutHoldStart = atMs;
    }

    _ingestLocalSnapshot(me, receivedAt) {
        if (!me) {
            this._interpMe = null;
            return;
        }

        const angle = Number(me.angle) || 0;
        const state = this._interpMe;
        if (!state || state.id !== me.id) {
            this._interpMe = {
                id: me.id,
                x: me.x,
                y: me.y,
                angle,
                targetX: me.x,
                targetY: me.y,
                targetAngle: angle,
                serverX: me.x,
                serverY: me.y,
                vx: 0,
                vy: 0,
                receivedAt,
            };
            if (!this.externalCameraGetter && !this.spectatorMode) {
                this.camera.x = me.x;
                this.camera.y = me.y;
            }
            return;
        }

        const elapsed = clamp((receivedAt - state.receivedAt) / 1000, 0.001, 0.25);
        const correctionDistance = Math.hypot(me.x - state.x, me.y - state.y);
        if (correctionDistance > 180) {
            state.x = me.x;
            state.y = me.y;
            state.vx = 0;
            state.vy = 0;
        } else {
            const measuredVx = (me.x - state.serverX) / elapsed;
            const measuredVy = (me.y - state.serverY) / elapsed;
            state.vx = lerp(state.vx, measuredVx, 0.72);
            state.vy = lerp(state.vy, measuredVy, 0.72);
        }
        state.targetX = me.x;
        state.targetY = me.y;
        state.targetAngle = angle;
        state.serverX = me.x;
        state.serverY = me.y;
        state.receivedAt = receivedAt;
    }

    _advanceInterpolatedWorld(dt, now) {
        const state = this._interpMe;
        if (!state || !this.me || state.id !== this.me.id) return;

        // The server publishes movement at 40 Hz. A tiny, bounded velocity lead
        // fills the gaps between snapshots without changing authoritative state.
        const leadSeconds = clamp((now - state.receivedAt) / 1000, 0, 0.04);
        const targetX = state.targetX + state.vx * leadSeconds;
        const targetY = state.targetY + state.vy * leadSeconds;
        const positionAlpha = 1 - Math.exp(-Math.min(dt, 0.05) * 34);
        const angleAlpha = 1 - Math.exp(-Math.min(dt, 0.05) * 42);
        state.x = lerp(state.x, targetX, positionAlpha);
        state.y = lerp(state.y, targetY, positionAlpha);
        state.angle = lerpAngle(state.angle, state.targetAngle, angleAlpha);

        this.me.x = state.x;
        this.me.y = state.y;
        this.me.angle = state.angle;
        if (!this.externalCameraGetter && !this.spectatorMode) {
            this.camera.x = state.x;
            this.camera.y = state.y;
        }
    }

    _ingestBulletSnapshots(bullets, receivedAt) {
        const activeIds = new Set();
        for (const bullet of bullets) {
            activeIds.add(bullet.id);
            const previous = this._interpBullets.get(bullet.id);
            if (!previous) {
                this._interpBullets.set(bullet.id, {
                    x: bullet.x,
                    y: bullet.y,
                    targetX: bullet.x,
                    targetY: bullet.y,
                    vx: Number(bullet.vx) || 0,
                    vy: Number(bullet.vy) || 0,
                    receivedAt,
                });
                continue;
            }
            if (Math.hypot(bullet.x - previous.x, bullet.y - previous.y) > 220) {
                previous.x = bullet.x;
                previous.y = bullet.y;
            }
            previous.targetX = bullet.x;
            previous.targetY = bullet.y;
            previous.vx = Number(bullet.vx) || 0;
            previous.vy = Number(bullet.vy) || 0;
            previous.receivedAt = receivedAt;
        }
        for (const id of this._interpBullets.keys()) {
            if (!activeIds.has(id)) this._interpBullets.delete(id);
        }
    }

    _advanceBulletInterpolation(dt, now) {
        const alpha = 1 - Math.exp(-Math.min(dt, 0.05) * 46);
        for (const bullet of this.bullets) {
            const state = this._interpBullets.get(bullet.id);
            if (!state) continue;
            // Bullet velocity is expressed per 40 Hz simulation step.
            const leadTicks = clamp((now - state.receivedAt) / 25, 0, 1.15);
            const targetX = state.targetX + state.vx * leadTicks;
            const targetY = state.targetY + state.vy * leadTicks;
            state.x = lerp(state.x, targetX, alpha);
            state.y = lerp(state.y, targetY, alpha);
            bullet.x = state.x;
            bullet.y = state.y;
        }
    }

    updateState(tick) {
        if (!tick) return;
        const receivedAt = Date.now();
        const animationReceivedAt = performance.now();
        const withLocalClocks = (player) => {
            if (!player) return null;
            const meleeRemainingMs = Number(player.meleeRemainingMs) || 0;
            return {
                ...player,
                reloadEndAtLocal: player.reloading
                    ? receivedAt + Math.max(0, Number(player.reloadRemainingMs) || 0)
                    : 0,
                meleeStartedAt: meleeRemainingMs > 0
                    ? receivedAt - Math.max(0, 280 - meleeRemainingMs)
                    : player.meleeStartedAt || 0,
                meleeUntil: meleeRemainingMs > 0
                    ? receivedAt + meleeRemainingMs
                    : player.meleeUntil || 0,
                meleeHand: player.meleeHand || 'top',
            };
        };


        const rawMe = tick.you || (tick.players || []).find(p => p.isYou || p.id === this.myId);
        const me = withLocalClocks(rawMe);
        this._ingestLocalSnapshot(me, animationReceivedAt);
        const rawPlayers = (tick.players || []).map(withLocalClocks);
        this.players = me
            ? [me, ...rawPlayers.filter(p => p.id !== me.id && !p.isYou)]
            : rawPlayers;
        this.loot = tick.loot || [];
        this.deathMarkers = Array.isArray(tick.deathMarkers) ? tick.deathMarkers : [];
        const activeMarkerIds = new Set();
        for (const marker of this.deathMarkers) {
            activeMarkerIds.add(marker.id);
            if (!this._graveFirstSeenAt.has(marker.id)) this._graveFirstSeenAt.set(marker.id, receivedAt);
            if (this._seenDeathMarkerIds.has(marker.id)) continue;
            this._seenDeathMarkerIds.add(marker.id);
            if (marker.killerId === this.myId) {
                this.killAnimations.push({
                    id: marker.id,
                    victimName: marker.victimName || 'Player',
                    weaponType: marker.weaponType || 'fists',
                    spawnedAt: receivedAt,
                    duration: 1350,
                });
                for (let i = 0; i < 14; i++) {
                    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.18;
                    const speed = 55 + Math.random() * 90;
                    this.particles.push({
                        x: marker.x,
                        y: marker.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 0.45 + Math.random() * 0.25,
                        maxLife: 0.7,
                        size: 1.8 + Math.random() * 2.2,
                        color: i % 3 === 0 ? '#ffd166' : '#ef544f',
                        type: 'killBurst',
                    });
                }
            }
        }
        for (const id of this._graveFirstSeenAt.keys()) {
            if (!activeMarkerIds.has(id)) this._graveFirstSeenAt.delete(id);
        }

        // Accumulate walk cycle & bob for each player
        const activePlayerIds = new Set();
        for (const p of this.players) {
            activePlayerIds.add(p.id);
            const prevPos = this._prevPlayers.get(p.id) || { x: p.x, y: p.y };
            const distMoved = Math.hypot(p.x - prevPos.x, p.y - prevPos.y);
            if (distMoved > 0.05 && distMoved < 40) {
                p.walkCycle = (p.walkCycle || 0) + distMoved * 0.16;
                p.walkBob = Math.sin(p.walkCycle);
            } else {
                p.walkBob = (p.walkBob || 0) * 0.85;
                if (Math.abs(p.walkBob) < 0.01) p.walkBob = 0;
            }
            this._prevPlayers.set(p.id, { x: p.x, y: p.y });
        }
        for (const playerId of this._prevPlayers.keys()) {
            if (!activePlayerIds.has(playerId)) this._prevPlayers.delete(playerId);
        }
        while (this._seenDeathMarkerIds.size > 200) {
            this._seenDeathMarkerIds.delete(this._seenDeathMarkerIds.values().next().value);
        }

        // Track disappeared bullets for impact particles
        const prevBullets = this.bullets || [];
        const currentBulletIds = new Set((tick.bullets || []).map(b => b.id));
        for (const b of prevBullets) {
            if (!currentBulletIds.has(b.id)) {
                // Bullet disappeared! Spawn impact particles at b.x, b.y
                const angle = Math.atan2(b.vy || 0, b.vx || 1);
                let hitType = 'spark'; // Default spark
                let hitColor = '#ffd45a';

                // Check if near any player (excluding owner, though target confirms are handled specifically, general debris is nice)
                const hitPlayer = this.players.find(p => (p.hp || 0) > 0 && Math.hypot(p.x - b.x, p.y - b.y) < 22);
                if (hitPlayer) {
                    hitType = 'blood';
                    hitColor = '#ef544f';
                    this.spawnBloodDecal(b.x, b.y);
                } else {
                    // Check if near any obstacle
                    const hitObstacle = this.findCollisionObstacleAt(b.x, b.y, 18);
                    if (hitObstacle) {
                        if (hitObstacle.kind === 'tree' || hitObstacle.variant === 'wood' || hitObstacle.kind === 'crate') {
                            hitType = 'wood';
                            hitColor = '#8c5b2f';
                        } else if (hitObstacle.kind === 'rock' || hitObstacle.variant === 'stone') {
                            hitType = 'rock';
                            hitColor = '#7a7a7a';
                        } else if (hitObstacle.kind === 'container' || hitObstacle.kind === 'wall') {
                            hitType = 'spark';
                            hitColor = '#ffd45a';
                        }
                    }
                }

                // Spawn 3-6 particles spraying in opposite direction of bullet
                const count = hitType === 'blood' ? 6 : hitType === 'spark' ? 3 : 4;
                for (let i = 0; i < count; i++) {
                    const spread = (Math.random() - 0.5) * 1.2;
                    const pAngle = angle + Math.PI + spread; // Spray backwards
                    const speed = 40 + Math.random() * 80;
                    this.particles.push({
                        x: b.x,
                        y: b.y,
                        vx: Math.cos(pAngle) * speed,
                        vy: Math.sin(pAngle) * speed,
                        life: 0.2 + Math.random() * 0.15,
                        maxLife: 0.35,
                        size: hitType === 'blood' ? 2.5 + Math.random() * 2 : 1.5 + Math.random() * 2,
                        color: hitColor,
                        type: hitType,
                    });
                }
            }
        }
        if (this.particles.length > 80) {
            this.particles.splice(0, this.particles.length - 80);
        }
        const nextBullets = tick.bullets || [];
        this._ingestBulletSnapshots(nextBullets, animationReceivedAt);
        this.bullets = nextBullets;
        // Static world snapshots may arrive less frequently than movement
        // ticks. Retain the last snapshot when omitted, and only rebuild the
        // expensive render cache when its actual contents changed.
        if (Array.isArray(tick.obstacles)) {
            const previousObstacles = new Map(this.obstacles.map(obstacle => [obstacle.id, obstacle]));
            for (const obstacle of tick.obstacles) {
                const previous = previousObstacles.get(obstacle.id);
                if (previous?._hitAt) obstacle._hitAt = previous._hitAt;
                if (previous && Number.isFinite(previous.hp) && obstacle.hp < previous.hp) {
                    obstacle._hitAt = receivedAt;
                }
            }
            const nextSignature = obstacleRenderSignature(tick.obstacles);
            if (nextSignature !== this._obstacleRenderSignature) {
                this.obstacles = tick.obstacles;
                this._obstacleRenderSignature = nextSignature;
                this.rebuildObstacleRenderCache();
            }
        }
        this.zone = tick.zone || null;
        if (tick.minimap) this.minimap = tick.minimap;

        // Count alive players
        this.aliveCount = tick.aliveCount ?? rawPlayers.filter(p => (p.hp || 0) > 0).length;

        // Store interpolation targets for remote players
        for (const p of this.players) {
            if (p.isYou || p.id === this.myId) continue;
            const prev = this._interpPlayers.get(p.id);
            if (prev) {
                prev.targetX = p.x;
                prev.targetY = p.y;
                prev.targetAngle = p.angle || 0;
            } else {
                this._interpPlayers.set(p.id, {
                    x: p.x, y: p.y, angle: p.angle || 0,
                    targetX: p.x, targetY: p.y, targetAngle: p.angle || 0,
                });
            }
        }
        // Clean up disconnected players
        const activeIds = new Set(this.players.map(p => p.id));
        for (const [id] of this._interpPlayers) {
            if (!activeIds.has(id)) this._interpPlayers.delete(id);
        }

        this.me = me || null;
        if (me?.lastLoot && me.lastLoot.id !== this.lastLootId) {
            this.lastLootId = me.lastLoot.id;
            this.lootToast = { ...me.lastLoot, shownAt: Date.now(), expiresAt: Date.now() + 2200 };
            this.inventoryOpen = true;
        }
        if (me) {
            // Detect damage taken → spawn damage indicator + screen shake
            const hpDelta = (me.hp || 0) - this._prevHp;
            if (hpDelta < -0.5 && this._prevHp > 0) {
                const dmgAmt = Math.abs(hpDelta);
                // Camera shake proportional to damage
                this.cameraShake.intensity += clamp(dmgAmt * 0.3, 1, 8);
                // Damage direction indicator (try to find nearest enemy direction)
                let damageAngle = Math.random() * Math.PI * 2;
                const enemies = rawPlayers.filter(p => !p.isYou && p.id !== this.myId && (p.hp || 0) > 0);
                if (enemies.length > 0) {
                    let closest = enemies[0];
                    let closestDist = Infinity;
                    for (const e of enemies) {
                        const d = Math.hypot(e.x - me.x, e.y - me.y);
                        if (d < closestDist) { closestDist = d; closest = e; }
                    }
                    damageAngle = Math.atan2(closest.y - me.y, closest.x - me.x);
                }
                this.damageIndicators.push({
                    angle: damageAngle,
                    spawnedAt: Date.now(),
                    duration: 900,
                    intensity: clamp(dmgAmt / 30, 0.4, 1),
                });
                // Damage number on self
                this.damageNumbers.push({
                    x: me.x + (Math.random() - 0.5) * 16,
                    y: me.y - 20,
                    amount: Math.round(dmgAmt),
                    spawnedAt: Date.now(),
                    duration: 900,
                    color: '#ff4444',
                });
            }
            this._prevHp = me.hp || 0;

            // Detect shots fired → muzzle flash + camera recoil
            if (this._prevAmmo >= 0 && me.ammo < this._prevAmmo && me.weapon === this._prevWeapon && me.weapon !== 'fists' && !me.reloading) {
                this._muzzleFlash = 1.0;
                const shakeAmt = WEAPON_SHAKE[me.weapon] || 1;
                this.cameraShake.intensity += shakeAmt;
                // Spawn muzzle flash particles
                const angle = me.angle || 0;
                const barrelDist = me.weapon === 'sniper' ? 38 : me.weapon === 'shotgun' ? 30 : 24;
                const bx = me.x + Math.cos(angle) * barrelDist;
                const by = me.y + Math.sin(angle) * barrelDist;
                // Predict a short local tracer immediately. A close-range shot can
                // hit between server snapshots and otherwise never be rendered.
                const pelletCount = me.weapon === 'shotgun' ? 3 : 1;
                const speed = (WEAPON_BULLET_SPEED[me.weapon] || 38) * 40;
                for (let i = 0; i < pelletCount; i++) {
                    const spread = pelletCount > 1 ? (i - (pelletCount - 1) / 2) * 0.1 : 0;
                    this.localShotTracers.push({
                        id: `local:${receivedAt}:${i}`,
                        x: bx,
                        y: by,
                        vx: Math.cos(angle + spread) * speed,
                        vy: Math.sin(angle + spread) * speed,
                        weaponType: me.weapon,
                        life: 0.11,
                    });
                }
                for (let i = 0; i < 2; i++) {
                    const spread = (Math.random() - 0.5) * 0.6;
                    const speed = 60 + Math.random() * 80;
                    this.particles.push({
                        x: bx, y: by,
                        vx: Math.cos(angle + spread) * speed,
                        vy: Math.sin(angle + spread) * speed,
                        life: 0.15 + Math.random() * 0.1,
                        maxLife: 0.2,
                        size: 2 + Math.random() * 3,
                        color: Math.random() > 0.5 ? '#ffdd44' : '#ff8800',
                        type: 'muzzle',
                    });
                }
            }
            this._prevAmmo = me.ammo ?? this._prevAmmo;

            // Detect weapon switch → animation
            if (me.weapon !== this._prevWeapon) {
                this._weaponSwitchT = 1.0;
                this._weaponSwitchFrom = this._prevWeapon;
                this._prevWeapon = me.weapon;
            }

            // Low ammo warning pulse
            if (me.weapon !== 'fists' && !me.reloading && me.ammo <= 3 && me.ammo > 0) {
                this._lowAmmoPulse = Math.max(this._lowAmmoPulse, 0.5);
            }

            this.hud.hp = me.hp;
            this.hud.maxHp = me.maxHp;
            this.hud.armor = me.armor;
            this.hud.weapon = me.weapon;
            this.hud.ammo = me.ammo;
            this.hud.clipSize = me.clipSize;
            this.hud.reloading = me.reloading;
            this.hud.kills = me.kills;
            if (me.inventory) this.hud.inventory = me.inventory;
        }
        if (tick.dollarBalance != null) {
            this.hud.balance = tick.dollarBalance;
        }

        // Kill feed from server
        if (tick.killFeed) {
            for (const entry of tick.killFeed) {
                this.killFeed.push({ ...entry, shownAt: Date.now() });
            }
        }
        // Also detect kills from the 'you' data
        if (tick.killNotify) {
            this.killFeed.push({
                killer: me?.username || 'You',
                victim: tick.killNotify.victim || 'Player',
                weapon: tick.killNotify.weapon || me?.weapon || 'fists',
                shownAt: Date.now(),
            });
            // Hit marker for kill
            this.hitMarkers.push({ spawnedAt: Date.now(), duration: 600, kill: true });
        }
        // Detect hit events
        if (tick.hitConfirm) {
            this.hitMarkers.push({ spawnedAt: Date.now(), duration: 350, kill: false });
            // Spawn damage number on target
            if (tick.hitConfirm.targetX != null) {
                this.damageNumbers.push({
                    x: tick.hitConfirm.targetX + (Math.random() - 0.5) * 10,

                    y: tick.hitConfirm.targetY - 18,
                    amount: Math.round(tick.hitConfirm.damage || 0),
                    spawnedAt: Date.now(),
                    duration: 800,
                    color: '#ffffff',
                });
            }
        }
        // Keep kill feed trimmed
        const now = Date.now();
        this.killFeed = this.killFeed.filter(e => now - e.shownAt < 5000);
    }

    screenToWorld(sx, sy) {
        const cx = this.viewW / 2;
        const cy = this.viewH / 2;
        return {
            x: (sx - cx) / this.zoom + this.camera.x,
            y: (sy - cy) / this.zoom + this.camera.y,
        };
    }

    setMobileMove(dx, dy) {
        this.mobileMove.x = clamp(Number(dx) || 0, -1, 1);
        this.mobileMove.y = clamp(Number(dy) || 0, -1, 1);
    }

    setMobileAim(dx, dy, magnitude = 0) {
        const strength = clamp(Number(magnitude) || 0, 0, 1);
        this.mobileAim.strength = strength;
        this.mobileAim.active = strength > 0.08;
        if (this.mobileAim.active) {
            this.mobileAim.angle = Math.atan2(Number(dy) || 0, Number(dx) || 0);
        }
        this.mobileAim.shooting = strength > 0.3;
    }

    clearMobileInput() {
        this.mobileMove.x = 0;
        this.mobileMove.y = 0;
        this.mobileAim.strength = 0;
        this.mobileAim.active = false;
        this.mobileAim.shooting = false;
    }

    clearInput() {
        this.keys.w = false;
        this.keys.a = false;
        this.keys.s = false;
        this.keys.d = false;
        this.mouse.down = false;
        this.clearMobileInput();
    }

    getInputPayload() {
        let dx = this.mobileMove.x;
        let dy = this.mobileMove.y;
        if (Math.hypot(dx, dy) < 0.04) {
            dx = 0;
            dy = 0;
            if (this.keys.w) dy -= 1;
            if (this.keys.s) dy += 1;
            if (this.keys.a) dx -= 1;
            if (this.keys.d) dx += 1;
        }
        const len = Math.hypot(dx, dy);
        if (len > 1) {
            dx /= len;
            dy /= len;
        }
        // Recalculate mouse world coordinates because camera (and player) moved
        const w = this.screenToWorld(this.mouse.x, this.mouse.y);
        this.mouse.worldX = w.x;
        this.mouse.worldY = w.y;

        const aimOrigin = this.me || this.camera;
        const pointerAimAngle = Math.atan2(
            this.mouse.worldY - aimOrigin.y,
            this.mouse.worldX - aimOrigin.x,
        );
        const aimAngle = this.mobileAim.active ? this.mobileAim.angle : pointerAimAngle;
        return {
            dx,
            dy,
            aimAngle,
            shooting: (this.mouse.down || this.mobileAim.shooting) && this.inputEnabled,
            reload: false,
        };
    }

    handleKeyDown(e) {
        const k = e.key.toLowerCase();
        if (e.repeat && ['r', 'h', 'f', 'g', '1', '2', '3'].includes(k)) return null;
        if (k === 'tab') {
            if (!e.repeat) this.inventoryOpen = !this.inventoryOpen;
            e.preventDefault();
            return null;
        }
        if (k === 'w' || k === 'arrowup') this.keys.w = true;
        if (k === 'a' || k === 'arrowleft') this.keys.a = true;
        if (k === 's' || k === 'arrowdown') this.keys.s = true;
        if (k === 'd' || k === 'arrowright') this.keys.d = true;
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' '].includes(k)) {
            e.preventDefault();
        }
        if (k === 'r') return 'reload';
        if (k === 'h') return 'useMedkit';
        if (k === 'f') return 'pickupWeapon';
        if (k === 'g') return 'throwGrenade';
        if (['1', '2', '3'].includes(k)) return `equipSlot:${Number(k) - 1}`;
        return null;
    }

    handleKeyUp(e) {
        const k = e.key.toLowerCase();
        if (k === 'w' || k === 'arrowup') this.keys.w = false;
        if (k === 'a' || k === 'arrowleft') this.keys.a = false;
        if (k === 's' || k === 'arrowdown') this.keys.s = false;
        if (k === 'd' || k === 'arrowright') this.keys.d = false;
    }

    handlePointerMove(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = clientX - rect.left;
        this.mouse.y = clientY - rect.top;
        const w = this.screenToWorld(this.mouse.x, this.mouse.y);
        this.mouse.worldX = w.x;
        this.mouse.worldY = w.y;
        this.hoveredChestId = this.findInteractChest()?.id || null;
    }

    handlePointerDown() {
        if (!this.inputEnabled || this.spectatorMode) return null;
        const chest = this.findInteractChest();
        if (chest) {
            this.hoveredChestId = chest.id;
            this.mouse.down = false;
            return 'openChest:' + chest.id;
        }
        this.mouse.down = true;
        return null;
    }

    handlePointerUp() {
        this.mouse.down = false;
    }

    rebuildObstacleRenderCache() {
        this.houseFloors = [];
        this.roomZones = [];
        this.doorways = [];
        this.surfaceObstacles = [];
        this.fieldObstacles = [];
        this.waterObstacles = [];
        this.roadObstacles = [];
        this.bridgeObstacles = [];
        this._roomZonesByHouseId.clear();
        this._doorwaysByHouseId.clear();
        this._interiorFogHouseIds.clear();
        this._losSegmentsByHouseId.clear();
        this._renderObstaclesByHouseId.clear();
        this._collisionBuckets.clear();

        const hasSplineRiver = this.obstacles.some(obstacle => obstacle.kind === 'river_path');
        for (const o of this.obstacles) {
            if (o.kind === 'houseFloor') this.houseFloors.push(o);
            else if (o.kind === 'roomZone') {
                this.roomZones.push(o);
                if (o.houseId) {
                    let rooms = this._roomZonesByHouseId.get(o.houseId);
                    if (!rooms) {
                        rooms = [];
                        this._roomZonesByHouseId.set(o.houseId, rooms);
                    }
                    rooms.push(o);
                }
            } else if (o.kind === 'door') {
                this.doorways.push(o);
                if (o.houseId) {
                    let doors = this._doorwaysByHouseId.get(o.houseId);
                    if (!doors) {
                        doors = [];
                        this._doorwaysByHouseId.set(o.houseId, doors);
                    }
                    doors.push(o);
                }
            }
        }

        const housesById = new Map(this.houseFloors.map(h => [h.id, h]));
        const solid = [];
        for (const o of this.obstacles) {
            if (o.kind === 'roomZone') continue;
            const rotation = Number(o.rotation) || 0;
            const cos = Math.abs(Math.cos(rotation));
            const sin = Math.abs(Math.sin(rotation));
            const halfW = Math.abs(Number(o.w) || 0) / 2;
            const halfH = Math.abs(Number(o.h) || 0) / 2;
            o._renderHalfW = cos * halfW + sin * halfH;
            o._renderHalfH = sin * halfW + cos * halfH;

            if (!SURFACE_KINDS.has(o.kind) && o.kind !== 'roomZone') {
                const house = o.houseId
                    ? housesById.get(o.houseId)
                    : this.houseFloors.find(h => this.pointInsideRect(h, o.x, o.y, -2));
                o._insideHouseId = house?.id || null;
                const houseRooms = house ? (this._roomZonesByHouseId.get(house.id) || []) : [];
                const room = house
                    ? houseRooms.find(r => this.pointInsideRect(r, o.x, o.y, 1))
                    : null;
                o._insideRoomId = room?.id || null;
            }
            if (SURFACE_KINDS.has(o.kind)) {
                this.surfaceObstacles.push(o);
                if (o.kind === 'field') this.fieldObstacles.push(o);
                else if (o.kind === 'road') this.roadObstacles.push(o);
                else if (o.kind === 'bridge') this.bridgeObstacles.push(o);
                else if (o.kind === 'water' || o.kind === 'river_path' || (o.kind === 'river' && !hasSplineRiver)) {
                    this.waterObstacles.push(o);
                }
            } else {
                solid.push(o);
            }
        }
        this.sortedWorldObstacles = solid.sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
        for (const obstacle of this.sortedWorldObstacles) {
            if (!obstacle._insideHouseId) continue;
            const houseObstacles = this._renderObstaclesByHouseId.get(obstacle._insideHouseId);
            if (houseObstacles) houseObstacles.push(obstacle);
            else this._renderObstaclesByHouseId.set(obstacle._insideHouseId, [obstacle]);
        }
        const collisionCell = 400;
        for (const obstacle of solid) {
            if (obstacle.collidable === false || !obstacle.w || !obstacle.h) continue;
            const minX = Math.floor((obstacle.x - obstacle.w / 2) / collisionCell);
            const maxX = Math.floor((obstacle.x + obstacle.w / 2) / collisionCell);
            const minY = Math.floor((obstacle.y - obstacle.h / 2) / collisionCell);
            const maxY = Math.floor((obstacle.y + obstacle.h / 2) / collisionCell);
            for (let gx = minX; gx <= maxX; gx++) {
                for (let gy = minY; gy <= maxY; gy++) {
                    const key = gx + ',' + gy;
                    const bucket = this._collisionBuckets.get(key);
                    if (bucket) bucket.push(obstacle);
                    else this._collisionBuckets.set(key, [obstacle]);
                }
            }
        }

        for (const house of this.houseFloors) {
            const huge = house.w >= 430 || house.h >= 330;
            const hasHallway = (this._roomZonesByHouseId.get(house.id) || []).some(r => r.variant === 'hallway');
            if (huge && hasHallway && (house.variant === 'mansion' || house.variant === 'warehouse' || house.variant === 'ironworks')) {
                this._interiorFogHouseIds.add(house.id);
            }

            // Build LOS geometry once per static world snapshot. The complete
            // boundary intentionally seals every doorway while a player is in.
            const minX = house.x - house.w / 2;
            const maxX = house.x + house.w / 2;
            const minY = house.y - house.h / 2;
            const maxY = house.y + house.h / 2;
            const segments = [
                { ax: minX, ay: minY, bx: maxX, by: minY },
                { ax: maxX, ay: minY, bx: maxX, by: maxY },
                { ax: maxX, ay: maxY, bx: minX, by: maxY },
                { ax: minX, ay: maxY, bx: minX, by: minY },
            ];
            for (const obstacle of solid) {
                if (obstacle._insideHouseId !== house.id || !LOS_BLOCKING_KINDS.has(obstacle.kind)) continue;
                const left = obstacle.x - obstacle.w / 2;
                const right = obstacle.x + obstacle.w / 2;
                const top = obstacle.y - obstacle.h / 2;
                const bottom = obstacle.y + obstacle.h / 2;
                segments.push(
                    { ax: left, ay: top, bx: right, by: top },
                    { ax: right, ay: top, bx: right, by: bottom },
                    { ax: right, ay: bottom, bx: left, by: bottom },
                    { ax: left, ay: bottom, bx: left, by: top },
                );
            }
            this._losSegmentsByHouseId.set(house.id, segments);
        }
        this._obstacleRevision++;
        this._losCacheKey = '';
        this._roofSpriteCache.clear();
        this._obstacleSpriteCache.clear();
    }

    findCollisionObstacleAt(x, y, padding = 0) {
        const cell = 400;
        const gx = Math.floor(x / cell);
        const gy = Math.floor(y / cell);
        const seen = new Set();
        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                const bucket = this._collisionBuckets.get((gx + ox) + ',' + (gy + oy));
                if (!bucket) continue;
                for (const obstacle of bucket) {
                    if (seen.has(obstacle.id)) continue;
                    seen.add(obstacle.id);
                    if (this.pointInsideRect(obstacle, x, y, padding)) return obstacle;
                }
            }
        }
        return null;
    }

    setViewBounds(camX, camY, viewW, viewH, z, pad = 160) {
        const halfW = viewW / (2 * z) + pad;
        const halfH = viewH / (2 * z) + pad;
        this._viewLeft = camX - halfW;
        this._viewRight = camX + halfW;
        this._viewTop = camY - halfH;
        this._viewBottom = camY + halfH;
    }

    isObstacleInView(o, pad = 0) {
        const halfW = (o._renderHalfW ?? Math.abs(Number(o.w) || 0) / 2) + pad;
        const halfH = (o._renderHalfH ?? Math.abs(Number(o.h) || 0) / 2) + pad;
        return o.x + halfW >= this._viewLeft && o.x - halfW <= this._viewRight
            && o.y + halfH >= this._viewTop && o.y - halfH <= this._viewBottom;
    }

    isPointInView(x, y, pad = 0) {
        return x + pad >= this._viewLeft && x - pad <= this._viewRight
            && y + pad >= this._viewTop && y - pad <= this._viewBottom;
    }

    pointInsideRect(o, x, y, pad = 0) {
        return x >= o.x - o.w / 2 - pad && x <= o.x + o.w / 2 + pad
            && y >= o.y - o.h / 2 - pad && y <= o.y + o.h / 2 + pad;
    }

    findHouseContainingPoint(x, y) {
        return this.houseFloors.find(o => this.pointInsideRect(o, x, y, -2)) || null;
    }

    getCurrentHouse() {
        if (!this.me) return null;
        return this.findHouseContainingPoint(this.me.x, this.me.y);
    }

    findRoomContainingPoint(x, y, house = null) {
        const houseId = house?.id || this.findHouseContainingPoint(x, y)?.id;
        if (!houseId) return null;
        return (this._roomZonesByHouseId.get(houseId) || []).find(r => this.pointInsideRect(r, x, y, -1)) || null;
    }

    getCurrentRoom(currentHouse) {
        if (!this.me || !currentHouse) return null;
        return this.findRoomContainingPoint(this.me.x, this.me.y, currentHouse);
    }

    usesInteriorFog(house) {
        return !!house && this._interiorFogHouseIds.has(house.id);
    }

    roomVisibilityStrength(room, currentRoom, playerX, playerY) {
        if (!room || !currentRoom) return 0;
        if (room.id === currentRoom.id) return 1;
        const dx = room.x - currentRoom.x;
        const dy = room.y - currentRoom.y;
        const centerDist = Math.hypot(dx, dy);
        const playerDist = Math.hypot(room.x - playerX, room.y - playerY);
        const touches = Math.abs(dx) < (room.w + currentRoom.w) * 0.56
            && Math.abs(dy) < (room.h + currentRoom.h) * 0.56;
        // Adjacent rooms get good visibility
        if (touches && centerDist < Math.max(room.w + currentRoom.w, room.h + currentRoom.h) * 0.82) return 0.55;
        // Nearby rooms get partial visibility based on distance
        if (playerDist < 320) return 0.32;
        if (playerDist < 500) return 0.22;
        // All rooms get minimum ambient visibility (can see contours/walls, not pitch black)
        return 0.15;
    }

    isPointHiddenByRooms(x, y, currentHouse, currentRoom) {
        let house = currentHouse;
        if (currentHouse) {
            if (!this.pointInsideRect(currentHouse, x, y, -2)) return true;
        } else {
            house = this.findHouseContainingPoint(x, y);
        }
        if (!house) return false;
        if (!currentHouse || house.id !== currentHouse.id) return true;
        if (!this.usesInteriorFog(currentHouse)) return false;
        // Houses with no rooms never hide anything.
        const hasRooms = this.roomZones.some(r => r.houseId === currentHouse.id);
        if (!hasRooms || !currentRoom) return false;
        const room = this.findRoomContainingPoint(x, y, house);
        if (!room || room.id === currentRoom.id) return false;
        const strength = this.roomVisibilityStrength(room, currentRoom, this.me?.x ?? 0, this.me?.y ?? 0);
        return strength <= 0.18;
    }
    shouldDrawObstacle(o, currentHouse, currentRoom) {
        if (o.kind === 'roomZone') return false;
        if (o.kind === 'houseFloor') return !!currentHouse && currentHouse.id === o.id;
        // The exterior is fully shadowed while indoors. Do not spend the frame
        // drawing outdoor roads, water, roofs and props underneath that mask.
        if (currentHouse) {
            const belongsToCurrentHouse = o._insideHouseId === currentHouse.id || o.houseId === currentHouse.id;
            if (!belongsToCurrentHouse) return false;
            if (HOUSE_BOUND_PROP_KINDS.has(o.kind) && o._insideRoomId && currentRoom) {
                return o._insideRoomId === currentRoom.id;
            }
            return true;
        }
        if (o.kind === 'wall' || o.kind === 'interiorWall' || o.kind === 'door') return !o._insideHouseId;
        if (HOUSE_BOUND_PROP_KINDS.has(o.kind)) return !o._insideHouseId;
        return true;
    }
    isLootHidden(l, currentHouse, currentRoom) {
        if (this.isPointHiddenByRooms(l.x, l.y, currentHouse, currentRoom)) return true;
        if (this.isPointHiddenByLineOfSight(l.x, l.y, currentHouse)) return true;
        return false;
    }

    pointInPolygon(x, y, polygon) {
        if (!polygon || polygon.length < 3) return false;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;
            const intersects = ((yi > y) !== (yj > y))
                && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
            if (intersects) inside = !inside;
        }
        return inside;
    }

    isPointHiddenByLineOfSight(x, y, currentHouse) {
        if (!currentHouse || !this.usesInteriorFog(currentHouse)) return false;
        if (!this._currentVisibilityPolygon || this._currentVisibilityHouseId !== currentHouse.id) return false;
        return !this.pointInPolygon(x, y, this._currentVisibilityPolygon);
    }

    isPlayerHidden(p, currentHouse, currentRoom) {
        if (p.isYou || p.id === this.myId) return false;
        if (this.isPointHiddenByRooms(p.x, p.y, currentHouse, currentRoom)) return true;
        return this.isPointHiddenByLineOfSight(p.x, p.y, currentHouse);
    }

    drawRoomShadows(ctx, currentHouse, currentRoom) {
        if (!currentHouse || !this.usesInteriorFog(currentHouse)) return;
        const zones = this._roomZonesByHouseId.get(currentHouse.id) || [];
        if (!zones.length || !currentRoom || !this.me) return;
        ctx.save();

        // Softer base shadow (dimmed, not pitch black)

        ctx.fillStyle = 'rgba(8, 10, 14, 0.42)';
        roundRect(ctx, currentHouse.x - currentHouse.w / 2 + 8, currentHouse.y - currentHouse.h / 2 + 8, currentHouse.w - 16, currentHouse.h - 16, 7);
        ctx.fill();

        // Cut out visible rooms with smooth edges
        ctx.globalCompositeOperation = 'destination-out';
        for (const room of zones) {
            const strength = this.roomVisibilityStrength(room, currentRoom, this.me.x, this.me.y);
            if (strength <= 0) continue;
            const pad = room.id === currentRoom.id ? 38 : 18;
            ctx.globalAlpha = strength;
            // Use softer rounded rectangles for room cutouts
            roundRect(ctx, room.x - room.w / 2 - pad, room.y - room.h / 2 - pad, room.w + pad * 2, room.h + pad * 2, 24);
            ctx.fill();
        }

        // Doorway light leaks — cut light around all doorways in the house
        for (const door of this.doorways) {
            if (door.houseId !== currentHouse.id) continue;
            const doorGlow = ctx.createRadialGradient(door.x, door.y, 8, door.x, door.y, 110);
            doorGlow.addColorStop(0, 'rgba(0,0,0,0.6)');
            doorGlow.addColorStop(0.5, 'rgba(0,0,0,0.25)');
            doorGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 0.65;
            ctx.fillStyle = doorGlow;
            ctx.beginPath();
            ctx.arc(door.x, door.y, 110, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player glow — larger, softer radius so you can see around yourself
        const r = currentHouse.variant === 'mansion' ? 380 : 310;
        const glow = ctx.createRadialGradient(this.me.x, this.me.y, 20, this.me.x, this.me.y, r);
        glow.addColorStop(0, 'rgba(0,0,0,1)');
        glow.addColorStop(0.35, 'rgba(0,0,0,0.85)');
        glow.addColorStop(0.65, 'rgba(0,0,0,0.45)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(this.me.x, this.me.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // Subtle warm border on current room (softer, not harsh)
        ctx.strokeStyle = 'rgba(255, 230, 170, 0.08)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, currentRoom.x - currentRoom.w / 2, currentRoom.y - currentRoom.h / 2, currentRoom.w, currentRoom.h, 12);
        ctx.stroke();
        ctx.restore();
    }

    // ── Among Us-style Line-of-Sight Shadow System ──────────────────────────

    /**
     * Gather wall segments (edges of rectangles) from all solid obstacles
     * that should block line of sight.
     */
    _gatherWallSegments(camX, camY, viewW, viewH, z, currentHouse) {
        return this._losSegmentsByHouseId.get(currentHouse?.id) || [];
    }
    /**
     * Ray-segment intersection.
     * Returns parameter t along the ray (0 = origin, 1+ = distance).
     * Returns Infinity if no intersection.
     */
    _raySegmentIntersect(rx, ry, rdx, rdy, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const denom = rdx * dy - rdy * dx;
        if (Math.abs(denom) < 1e-10) return Infinity;
        const t = ((ax - rx) * dy - (ay - ry) * dx) / denom;
        const u = ((ax - rx) * rdy - (ay - ry) * rdx) / denom;
        if (t >= 0 && u >= 0 && u <= 1) return t;
        return Infinity;
    }

    /**
     * Cast a single ray from (px,py) at angle, returning the closest intersection point.
     */
    _castRay(px, py, angle, segments, maxDist) {
        const rdx = Math.cos(angle);
        const rdy = Math.sin(angle);
        let closest = maxDist;
        for (let i = 0; i < segments.length; i++) {
            const s = segments[i];
            const t = this._raySegmentIntersect(px, py, rdx, rdy, s.ax, s.ay, s.bx, s.by);
            if (t < closest) closest = t;
        }
        return { x: px + rdx * closest, y: py + rdy * closest };
    }

    /**
     * Build the visibility polygon by casting rays toward all wall endpoints
     * plus sweep rays for smooth edges.
     */
    _buildVisibilityPolygon(px, py, segments, maxDist) {
        // All angles normalized to [0, 2π]
        const normalize = a => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const angles = new Set();

        // Add sweep rays for smooth coverage between wall corners
        // Exact endpoint rays keep corners crisp; 16 sweep rays keep indoor
        // 900px-radius edge sub-pixel smooth without the old O(256 * segments)
        // intersection cost every animation frame.
        const sweepCount = 12;
        for (let i = 0; i < sweepCount; i++) {
            angles.add((Math.PI * 2 * i) / sweepCount);
        }

        // Cast around each nearby segment endpoint so corners stay sealed and stable.
        const epsilon = 0.00005;
        const epRangeSq = (maxDist + 200) * (maxDist + 200);
        for (const s of segments) {
            const d1sq = (s.ax - px) * (s.ax - px) + (s.ay - py) * (s.ay - py);
            const d2sq = (s.bx - px) * (s.bx - px) + (s.by - py) * (s.by - py);
            if (d1sq < epRangeSq) {
                const a1 = normalize(Math.atan2(s.ay - py, s.ax - px));
                angles.add(normalize(a1 - epsilon));
                angles.add(a1);
                angles.add(normalize(a1 + epsilon));
            }
            if (d2sq < epRangeSq) {
                const a2 = normalize(Math.atan2(s.by - py, s.bx - px));
                angles.add(normalize(a2 - epsilon));
                angles.add(a2);
                angles.add(normalize(a2 + epsilon));
            }
        }

        // Sort all angles 0 → 2π, then cast rays
        const sortedAngles = [...angles].sort((a, b) => a - b);
        const polygon = [];
        for (const angle of sortedAngles) {
            polygon.push(this._castRay(px, py, angle, segments, maxDist));
        }

        return polygon;
    }

    /**
     * Draw Among Us-style line-of-sight shadows using even-odd fill.
     * A large outer rectangle + the visibility polygon are drawn with 'evenodd'
     * fill rule, so only the area OUTSIDE the polygon is filled with darkness.
     */
    drawLineOfSightShadow(ctx, camX, camY, viewW, viewH, z, knownCurrentHouse = null) {
        this._currentVisibilityPolygon = null;
        this._currentVisibilityHouseId = null;
        if (!this.me) return;
        // Only apply shadows inside large houses (mansion, warehouse, hospital, etc.)
        const currentHouse = knownCurrentHouse || this.getCurrentHouse();
        if (!currentHouse || !this.usesInteriorFog(currentHouse)) return;

        const px = this.me.x;
        const py = this.me.y;
        const maxDist = 900;

        const cacheKey = `${currentHouse.id}:${this._obstacleRevision}:${Math.round(px / 12)}:${Math.round(py / 12)}`;
        let polygon = this._losCachedPolygon;
        if (cacheKey !== this._losCacheKey || !polygon) {
            const segments = this._gatherWallSegments(camX, camY, viewW, viewH, z, currentHouse);
            polygon = this._buildVisibilityPolygon(px, py, segments, maxDist);
            this._losCacheKey = cacheKey;
            this._losCachedPolygon = polygon;
        }
        if (polygon.length < 3) return;
        this._currentVisibilityPolygon = polygon;
        this._currentVisibilityHouseId = currentHouse.id;

        ctx.save();

        // Shadow color - lighter and more atmospheric for the interior
        ctx.fillStyle = 'rgba(12, 15, 22, 0.65)';

        // Build a single path: big outer rect + visibility polygon
        // Even-odd fill rule means the overlap (the polygon) punches a hole in the rect
        const ext = (viewW + viewH) / z + 1000;
        ctx.beginPath();
        // Outer rectangle (the dark overlay covering the whole world)
        ctx.rect(camX - ext, camY - ext, ext * 2, ext * 2);
        // Visibility polygon
        ctx.moveTo(polygon[0].x, polygon[0].y);
        for (let i = 1; i < polygon.length; i++) {
            ctx.lineTo(polygon[i].x, polygon[i].y);
        }
        ctx.closePath();
        ctx.fill('evenodd');

        // One polygon mask is enough; extra full-screen gradients made large interiors expensive.

        ctx.restore();
    }

    drawExteriorHouseShadow(ctx, camX, camY, viewW, viewH, z, currentHouse) {
        if (!currentHouse) return;
        const ext = (viewW + viewH) / z + 600;
        const inset = 2;
        ctx.save();
        ctx.fillStyle = 'rgba(7, 10, 15, 0.48)';
        ctx.beginPath();
        ctx.rect(camX - ext, camY - ext, ext * 2, ext * 2);
        ctx.rect(
            currentHouse.x - currentHouse.w / 2 + inset,
            currentHouse.y - currentHouse.h / 2 + inset,
            currentHouse.w - inset * 2,
            currentHouse.h - inset * 2,
        );
        ctx.fill('evenodd');
        ctx.restore();
    }
    findInteractChest(
        requireCursor = true,
        currentHouse = this.getCurrentHouse(),
        currentRoom = this.getCurrentRoom(currentHouse),
    ) {
        if (!this.me) return null;
        let best = null;
        let bestCursor = Infinity;
        for (const l of this.loot) {
            if (l.type !== 'chest' && l.type !== 'deathCrate') continue;
            if (this.isLootHidden(l, currentHouse, currentRoom)) continue;
            if (Math.hypot(this.me.x - l.x, this.me.y - l.y) > 96) continue;
            const cursorDist = requireCursor
                ? Math.hypot(this.mouse.worldX - l.x, this.mouse.worldY - l.y)
                : Math.hypot(this.me.x - l.x, this.me.y - l.y);
            if ((!requireCursor || cursorDist < 34) && cursorDist < bestCursor) {
                best = l;
                bestCursor = cursorDist;
            }
        }
        return best;
    }

    getNearbyGroundWeapon() {
        if (!this.me) return null;
        let nearest = null;
        let nearestDist = 58;
        for (const item of this.loot) {
            if (item.type !== 'weapon' || !item.weaponType) continue;
            const distance = Math.hypot(this.me.x - item.x, this.me.y - item.y);
            if (distance < nearestDist) {
                nearest = item;
                nearestDist = distance;
            }
        }
        return nearest;
    }

    getNearbyChest() {
        return this.findInteractChest(false);
    }

    draw(dt = 1 / 60) {
        this._frameNow = Date.now();
        this._roofCacheBuildsThisFrame = 0;
        this._obstacleCacheBuildsThisFrame = 0;
        // FPS counter
        this._fpsFrames++;
        const fpsSampleElapsed = performance.now() - this._fpsLastSampleAt;
        if (fpsSampleElapsed >= 500) {
            this._fpsDisplay = Math.round(this._fpsFrames / (fpsSampleElapsed / 1000));
            this._fpsFrames = 0;
            this._fpsLastSampleAt = performance.now();
        }
        if (this.externalCameraGetter) {
            const cam = this.externalCameraGetter();
            if (cam) {
                this.camera.x = cam.x;
                this.camera.y = cam.y;
                if (cam.zoom) this.zoom = cam.zoom;
            }
        } else if (!this.spectatorMode) {
            this.zoom = lerp(this.zoom, this.targetZoom, 1 - Math.exp(-Math.min(dt, 0.05) * 5));
        }

        const animationNow = performance.now();
        this._advanceInterpolatedWorld(dt, animationNow);
        this._advanceBulletInterpolation(dt, animationNow);

        // Update camera shake
        if (this.cameraShake.intensity > 0.05) {
            this.cameraShake.x = (Math.random() - 0.5) * this.cameraShake.intensity * 2;
            this.cameraShake.y = (Math.random() - 0.5) * this.cameraShake.intensity * 2;
            this.cameraShake.intensity *= Math.pow(this.cameraShake.decay, dt * 60);
        } else {
            this.cameraShake.x = 0;
            this.cameraShake.y = 0;
            this.cameraShake.intensity = 0;
        }

        // Decay weapon switch animation
        if (this._weaponSwitchT > 0) this._weaponSwitchT = Math.max(0, this._weaponSwitchT - dt * 6);
        // Decay muzzle flash
        if (this._muzzleFlash > 0) this._muzzleFlash = Math.max(0, this._muzzleFlash - dt * 12);
        // Decay low ammo pulse
        if (this._lowAmmoPulse > 0) this._lowAmmoPulse = Math.max(0, this._lowAmmoPulse - dt * 2);

        // Update particles
        let liveParticleCount = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.type === 'shell') {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
                p.vx *= Math.pow(0.94, dt * 60); // Frame-rate independent air friction
                p.vy *= Math.pow(0.94, dt * 60);
                if (p.rotation !== undefined) {
                    p.rotation += p.rotSpeed * dt;
                    p.rotSpeed *= Math.pow(0.91, dt * 60); // Slow down rotational spin
                }
                // Simulate a tiny brass bounce on the ground
                if (p.bounceCount !== undefined && p.bounceCount < 2) {
                    const speed = Math.hypot(p.vx, p.vy);
                    if (speed < 12 && p.bounceCount === 0) {
                        p.bounceCount = 1;
                        const bAngle = Math.random() * Math.PI * 2;
                        p.vx = Math.cos(bAngle) * 25;
                        p.vy = Math.sin(bAngle) * 25;
                    }
                }
            } else {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
                p.vx *= Math.pow(0.92, dt * 60);
                p.vy *= Math.pow(0.92, dt * 60);
            }
            if (p.life > 0) this.particles[liveParticleCount++] = p;
        }
        this.particles.length = liveParticleCount;

        let liveTracerCount = 0;
        for (const tracer of this.localShotTracers) {
            tracer.x += tracer.vx * dt;
            tracer.y += tracer.vy * dt;
            tracer.life -= dt;
            if (tracer.life > 0) this.localShotTracers[liveTracerCount++] = tracer;
        }
        this.localShotTracers.length = liveTracerCount;

        // Interpolate remote players with the same response at 60, 120 or 144 Hz.
        const interpSpeed = 1 - Math.exp(-Math.min(dt, 0.05) * 18);
        for (const [id, ip] of this._interpPlayers) {
            ip.x = lerp(ip.x, ip.targetX, interpSpeed);
            ip.y = lerp(ip.y, ip.targetY, interpSpeed);
            ip.angle = lerpAngle(ip.angle, ip.targetAngle, interpSpeed);
        }

        const ctx = this.ctx;
        const W = this.viewW;
        const H = this.viewH;
        const camX = this.camera.x + this.cameraShake.x;
        const camY = this.camera.y + this.cameraShake.y;
        const z = this.zoom;
        this.setViewBounds(camX, camY, W, H, z);

        ctx.fillStyle = '#2d5426';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(z, z);
        ctx.translate(-camX, -camY);

        this.drawTerrain(ctx, camX, camY, W, H, z);
        const currentHouse = this.getCurrentHouse();
        const currentRoom = this.getCurrentRoom(currentHouse);
        this.hoveredChestId = this.findInteractChest(true, currentHouse, currentRoom)?.id || null;
        // Pass 1: Draw fields (grass overlays, crops, dirt field bases)
        for (const o of this.fieldObstacles) {
            if (this.isObstacleInView(o, 32) && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawObstacle(ctx, o);
            }
        }

        // Pass 2: Draw river & lake sandy shore bases
        for (const o of this.waterObstacles) {
            if (this.isObstacleInView(o, 40) && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawObstacleShore(ctx, o);
            }
        }

        // Pass 3: Draw road gravel/dirt shoulders (under the asphalt)
        for (const o of this.roadObstacles) {
            if (this.isObstacleInView(o, 32) && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawRoadShoulder(ctx, o);
            }
        }

        // Pass 4: Draw river & lake water bodies (seamlessly on top of shores)
        for (const o of this.waterObstacles) {
            if (this.isObstacleInView(o, 40) && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawObstacleBody(ctx, o);
            }
        }

        // Pass 5: Draw road asphalt & dirt bodies (seamlessly on top of shoulders)
        for (const o of this.roadObstacles) {
            if (this.isObstacleInView(o, 32) && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawRoadBody(ctx, o);
            }
        }

        // Pass 6: Draw road markings (yellow centerlines, white borders) & tire tracks
        for (const o of this.roadObstacles) {
            if (this.isObstacleInView(o, 32) && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawRoadMarkings(ctx, o);
            }
        }

        // Draw blood decals on the ground
        this.drawBloodDecals(ctx);

        // Pass 7: Draw bridges (go on top of road/river intersections)
        for (const o of this.bridgeObstacles) {
            if (this.isObstacleInView(o, 48) && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawObstacle(ctx, o);
            }
        }

        this.drawWorldBorder(ctx);
        if (currentHouse && this.isObstacleInView(currentHouse, 80)) {
            this.drawObstacle(ctx, currentHouse);
        }
        if (!currentHouse) {
            for (const o of this.houseFloors) {
                if ((!currentHouse || currentHouse.id !== o.id) && this.isObstacleInView(o, 80)) this.drawHouseRoof(ctx, o);
            }
        }
        const visibleWorldObstacles = currentHouse
            ? (this._renderObstaclesByHouseId.get(currentHouse.id) || [])
            : this.sortedWorldObstacles;
        for (const o of visibleWorldObstacles) {
            if (this.isObstacleInView(o, 48) && this.shouldDrawObstacle(o, currentHouse, currentRoom)) this.drawObstacle(ctx, o);
        }
        this.drawDeathMarkers(ctx, currentHouse);
        // Only use the new LOS shadow system (replaces old room shadows)
        this.drawLineOfSightShadow(ctx, camX, camY, W, H, z, currentHouse);

        // Draw zone (gas circle)
        this.drawZone(ctx);

        for (const l of this.loot) {
            if (this.isPointInView(l.x, l.y, 70) && !this.isLootHidden(l, currentHouse, currentRoom)) this.drawLoot(ctx, l);
        }
        for (const b of this.bullets) {
            if (this.isPointInView(b.x, b.y, 110) && !this.isPointHiddenByRooms(b.x, b.y, currentHouse, currentRoom)) this.drawBullet(ctx, b);
        }
        for (const b of this.localShotTracers) {
            if (this.isPointInView(b.x, b.y, 110) && !this.isPointHiddenByRooms(b.x, b.y, currentHouse, currentRoom)) {
                this.drawBullet(ctx, b);
            }
        }

        // Draw players with interpolation
        for (const p of this.players) {
            const isMe = p.isYou || p.id === this.myId;
            if (!isMe) {
                // Apply interpolated positions before visibility checks so enemies do not
                // leak through house shadows from an older server position.
                const ip = this._interpPlayers.get(p.id);
                if (ip) {
                    p.x = ip.x;
                    p.y = ip.y;
                    p.angle = ip.angle;
                }
            }
            if (!this.isPointInView(p.x, p.y, 90)) continue;
            if (this.isPlayerHidden(p, currentHouse, currentRoom)) continue;
            this.drawPlayer(ctx, p);
        }

        const emoteNow = performance.now();
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${32 / this.zoom}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        for (const [playerId, activeEmote] of this.worldEmotes) {
            if (activeEmote.expiresAt <= emoteNow) { this.worldEmotes.delete(playerId); continue; }
            const player = this.players.find((candidate) => candidate.id === playerId);
            if (!player || !this.isPointInView(player.x, player.y, 90)) continue;
            if (this.isPlayerHidden(player, currentHouse, currentRoom)) continue;
            const progress = Math.min(1, (emoteNow - activeEmote.startedAt) / 2600);
            ctx.globalAlpha = Math.min(1, (1 - progress) * 3);
            const emoteX = player.x;
            const emoteY = player.y - (player.radius || 14) - (28 + progress * 10) / this.zoom;
            if (!drawGameEmote(ctx, activeEmote.emote, emoteX, emoteY, 42 / this.zoom)) {
                ctx.fillText(activeEmote.emote, emoteX, emoteY);
            }
        }
        ctx.restore();

        // Draw particles (world space)
        this.drawParticles(ctx, currentHouse, currentRoom);

        // Draw floating damage numbers (world space)
        this.drawDamageNumbers(ctx, currentHouse, currentRoom);

        // Softly shade the exterior while all moving entities stay hidden.
        this.drawExteriorHouseShadow(ctx, camX, camY, W, H, z, currentHouse);

        ctx.restore();

        // Screen-space overlays
        this.drawMobileAimGuide(ctx);
        this.drawCrosshair(ctx);
        this.drawVignette(ctx, W, H);
        this.drawDamageIndicators(ctx, W, H);
        this.drawHitMarkers(ctx, W, H);
        this.drawKillAnimation(ctx, W, H);
        this.drawKillFeed(ctx, W, H);
        this.drawLowAmmoWarning(ctx, W, H);
        this.drawMinimapPanel(ctx, W, H);
        this.drawLootToast(ctx, W, H);
        if (import.meta.env.DEV) this.drawFpsCounter(ctx, W, H);
    }

    getTerrainPattern(ctx) {
        if (this._terrainPattern) return this._terrainPattern;
        if (typeof document === 'undefined' || typeof ctx.createPattern !== 'function') return null;

        try {
            if (!this._terrainTexture) {
                const tile = 96;
                const size = tile * 8;
                const texture = document.createElement('canvas');
                texture.width = size;
                texture.height = size;
                const textureCtx = texture.getContext('2d');
                if (!textureCtx) return null;
                this._terrainTexture = texture;
                this.drawTerrain(textureCtx, size / 2, size / 2, size, size, 1, false);
            }
            this._terrainPattern = ctx.createPattern(this._terrainTexture, 'repeat');
        } catch {
            this._terrainPattern = null;
        }
        return this._terrainPattern;
    }

    drawTerrain(ctx, camX, camY, viewW, viewH, z, allowPattern = true) {
        const tile = 96;
        const halfW = viewW / z / 2 + tile;
        const halfH = viewH / z / 2 + tile;

        if (allowPattern) {
            const terrainPattern = this.getTerrainPattern(ctx);
            if (terrainPattern) {
                ctx.fillStyle = terrainPattern;
                ctx.fillRect(camX - halfW, camY - halfH, halfW * 2, halfH * 2);
                return;
            }
        }

        const startX = Math.floor((camX - halfW) / tile) * tile;
        const endX = Math.ceil((camX + halfW) / tile) * tile;
        const startY = Math.floor((camY - halfH) / tile) * tile;
        const endY = Math.ceil((camY + halfH) / tile) * tile;

        const viewBiome = biomeAt(camX, camY);
        ctx.fillStyle = viewBiome.base;
        ctx.fillRect(camX - halfW, camY - halfH, halfW * 2, halfH * 2);

        for (let x = startX; x <= endX; x += tile) {
            for (let y = startY; y <= endY; y += tile) {
                const n = seededNoise(x / tile, y / tile);
                const n2 = seededNoise(x / tile + 100, y / tile + 100);
                const b = biomeAt(x + tile / 2, y + tile / 2);

                // Subtle color variation per tile
                if (n > 0.55) {
                    ctx.fillStyle = n > 0.72 ? b.grass : `rgba(52,92,42,${0.08 + n2 * 0.1})`;
                    ctx.fillRect(x, y, tile, tile);
                } else {
                    ctx.fillStyle = `rgba(180,172,130,${0.02 + n * 0.04})`;
                    ctx.fillRect(x, y, tile, tile);
                }

                // Multiple organic grass patches
                if (n > 0.68) {
                    ctx.fillStyle = b.grass;
                    // Primary grass blob
                    ctx.beginPath();
                    ctx.ellipse(
                        x + tile * (0.3 + n2 * 0.4),
                        y + tile * (0.3 + n * 0.4),
                        tile * (0.12 + n2 * 0.14),
                        tile * (0.04 + n * 0.04),
                        n * 5, 0, Math.PI * 2
                    );
                    ctx.fill();
                }
                if (n > 0.82) {
                    // Secondary small grass tuft
                    ctx.fillStyle = `rgba(38,78,32,${0.18 + n2 * 0.12})`;
                    ctx.beginPath();
                    ctx.ellipse(
                        x + tile * (0.6 + n * 0.25),
                        y + tile * (0.2 + n2 * 0.5),
                        tile * 0.08, tile * 0.03,
                        n2 * 3, 0, Math.PI * 2
                    );
                    ctx.fill();
                }
                if (n > 0.92) {
                    // Third tiny detail patch
                    ctx.fillStyle = 'rgba(28,65,24,0.14)';
                    ctx.beginPath();
                    ctx.arc(x + tile * n2, y + tile * n, tile * 0.06, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Softer, more subtle grid
        ctx.strokeStyle = 'rgba(20,35,22,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += tile) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += tile) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    }

    drawWorldBorder(ctx) {
        const wh = this.worldHalf;
        ctx.strokeStyle = 'rgba(24, 32, 28, 0.65)';
        ctx.lineWidth = 18;
        ctx.strokeRect(-wh, -wh, wh * 2, wh * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-wh + 10, -wh + 10, wh * 2 - 20, wh * 2 - 20);
    }

    drawZone(ctx) {
        if (!this.zone) return;
        const { x, y, radius, targetX, targetY, targetRadius } = this.zone;
        if (!radius || radius <= 0) return;

        ctx.save();
        // Draw danger zone fog outside safe circle
        const wh = this.worldHalf + 200;
        ctx.fillStyle = 'rgba(180, 40, 20, 0.22)';
        ctx.beginPath();
        ctx.rect(-wh, -wh, wh * 2, wh * 2);
        ctx.arc(x, y, radius, 0, Math.PI * 2, true);
        ctx.fill();

        // Animated zone border
        const pulse = 0.5 + Math.sin(this._frameNow / 400) * 0.5;
        ctx.strokeStyle = `rgba(255, 80, 40, ${0.5 + pulse * 0.3})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = -(this._frameNow / 40) % 20;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Inner glow
        const glowGrad = ctx.createRadialGradient(x, y, radius - 20, x, y, radius + 8);
        glowGrad.addColorStop(0, 'rgba(255, 60, 30, 0)');
        glowGrad.addColorStop(0.7, 'rgba(255, 60, 30, 0.08)');
        glowGrad.addColorStop(1, 'rgba(255, 60, 30, 0.18)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
        ctx.arc(x, y, Math.max(0, radius - 20), 0, Math.PI * 2, true);
        ctx.fill();

        // Draw target zone if shrinking
        if (targetRadius != null && targetRadius > 0 && targetRadius < radius) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.arc(targetX ?? x, targetY ?? y, targetRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    }

    drawObstacleShore(ctx, o) {
        const kind = o.kind || 'crate';
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowBlur = 0;

        if (kind === 'river_path') {
            if (o.points && o.points.length > 0) {
                ctx.strokeStyle = '#c9aa72';
                ctx.lineWidth = o.width + 28;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                traceSmoothWaterPath(ctx, o.points, o.x, o.y);
                ctx.stroke();
            }
        } else if (kind === 'river') {
            ctx.fillStyle = '#c9aa72';
            ctx.fillRect(-o.w / 2 - 10, -o.h / 2 - 14, o.w + 20, o.h + 28);
        } else if (kind === 'water') {
            ctx.fillStyle = '#c9aa72';
            traceOrganicPond(ctx, o, 16);
            ctx.fill();
        }
        ctx.restore();
    }

    drawRoadShoulder(ctx, o) {
        if (o.variant !== 'asphalt') return;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#655745';
        const isHorizontal = o.w > o.h;
        if (isHorizontal) {
            roundRect(ctx, -o.w / 2, -o.h / 2 - 12, o.w, o.h + 24, 10);
        } else {
            roundRect(ctx, -o.w / 2 - 12, -o.h / 2, o.w + 24, o.h, 10);
        }
        ctx.fill();
        ctx.restore();
    }

    drawObstacleBody(ctx, o) {
        const kind = o.kind || 'crate';
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowBlur = 0;

        if (kind === 'river_path') {
            if (o.points && o.points.length > 0) {
                // Water body
                ctx.strokeStyle = '#2a5e7a';
                ctx.lineWidth = o.width;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                traceSmoothWaterPath(ctx, o.points, o.x, o.y);
                ctx.stroke();

                // Centerline highlight
                ctx.strokeStyle = 'rgba(80, 160, 200, 0.12)';
                ctx.lineWidth = o.width * 0.4;
                ctx.stroke();
            }
        } else if (kind === 'river') {
            ctx.fillStyle = '#2a5e7a';
            ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);

            // Subtle centerline highlight to give water depth without animation
            ctx.fillStyle = 'rgba(80, 160, 200, 0.12)';
            ctx.fillRect(-o.w / 2 + 4, -o.h / 2 + o.h * 0.3, o.w - 8, o.h * 0.4);
        } else if (kind === 'water') {
            ctx.fillStyle = '#2a5e7a';
            traceOrganicPond(ctx, o);
            ctx.fill();

            // Subtle inner highlight ring (lighter center)
            ctx.strokeStyle = 'rgba(80, 160, 200, 0.14)';
            ctx.lineWidth = Math.max(2, Math.min(o.w, o.h) * 0.06);
            ctx.beginPath();
            ctx.ellipse(0, 0, o.w / 2 * 0.6, o.h / 2 * 0.6, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawRoadBody(ctx, o) {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowBlur = 0;

        if (o.variant === 'asphalt') {
            ctx.fillStyle = '#2b2c28'; // Dark asphalt gray
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 5);
            ctx.fill();
        } else {
            // --- DIRT ROAD WITH IRREGULAR EDGES ---
            ctx.fillStyle = '#7a684c';
            ctx.beginPath();
            const step = 28;
            const roadId = Math.round(o.x + o.y);
            const isHorizontal = o.w > o.h;

            if (isHorizontal) {
                const halfW = o.w / 2;
                ctx.moveTo(-halfW, -o.h / 2);
                for (let xx = -halfW + step; xx < halfW; xx += step) {
                    const wobble = Math.sin(xx * 0.05 + roadId) * 5 + Math.cos(xx * 0.12) * 3;
                    ctx.lineTo(xx, -o.h / 2 + wobble);
                }
                ctx.lineTo(halfW, -o.h / 2);
                ctx.lineTo(halfW, o.h / 2);
                for (let xx = halfW - step; xx > -halfW; xx -= step) {
                    const wobble = Math.sin(xx * 0.05 - roadId) * 5 + Math.cos(xx * 0.12) * 3;
                    ctx.lineTo(xx, o.h / 2 + wobble);
                }
                ctx.lineTo(-halfW, o.h / 2);
                ctx.closePath();
            } else {
                const halfH = o.h / 2;
                ctx.moveTo(o.w / 2, -halfH);
                for (let yy = -halfH + step; yy < halfH; yy += step) {
                    const wobble = Math.sin(yy * 0.05 + roadId) * 5 + Math.cos(yy * 0.12) * 3;
                    ctx.lineTo(o.w / 2 + wobble, yy);
                }
                ctx.lineTo(o.w / 2, halfH);
                ctx.lineTo(-o.w / 2, halfH);
                for (let yy = halfH - step; yy > -halfH; yy -= step) {
                    const wobble = Math.sin(yy * 0.05 - roadId) * 5 + Math.cos(yy * 0.12) * 3;
                    ctx.lineTo(-o.w / 2 + wobble, yy);
                }
                ctx.lineTo(-o.w / 2, -halfH);
                ctx.closePath();
            }
            ctx.fill();
        }
        ctx.restore();
    }

    drawRoadMarkings(ctx, o) {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowBlur = 0;

        const isHorizontal = o.w >= o.h;
        const length = isHorizontal ? o.w : o.h;
        const width = isHorizontal ? o.h : o.w;
        const inset = Math.min(68, Math.max(18, width * 0.52));
        const visible = this.getVisibleRoadAxisRange(o, isHorizontal, 180);
        const start = Math.max(-length / 2 + inset, visible.start);
        const end = Math.min(length / 2 - inset, visible.end);

        const line = (a, b, offset = 0) => {
            if (isHorizontal) {
                ctx.moveTo(a, offset);
                ctx.lineTo(b, offset);
            } else {
                ctx.moveTo(offset, a);
                ctx.lineTo(offset, b);
            }
        };

        if (o.variant === 'asphalt') {
            // Faint asphalt cracks, rotated with the road direction.
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.34)';
            ctx.lineWidth = 1;
            const seedVal = Math.round(o.x + o.y);
            const crackA = -length * 0.22;
            const crackB = length * 0.18;
            if (seedVal % 3 === 0) {
                ctx.beginPath();
                if (isHorizontal) {
                    ctx.moveTo(crackA, -width * 0.12);
                    ctx.lineTo(crackA + 18, width * 0.08);
                    ctx.lineTo(crackA + 28, width * 0.02);
                } else {
                    ctx.moveTo(-width * 0.12, crackA);
                    ctx.lineTo(width * 0.08, crackA + 18);
                    ctx.lineTo(width * 0.02, crackA + 28);
                }
                ctx.stroke();
            }
            if (seedVal % 5 === 0) {
                ctx.beginPath();
                if (isHorizontal) {
                    ctx.moveTo(crackB, width * 0.18);
                    ctx.lineTo(crackB + 18, width * 0.08);
                    ctx.lineTo(crackB + 28, width * 0.22);
                } else {
                    ctx.moveTo(width * 0.18, crackB);
                    ctx.lineTo(width * 0.08, crackB + 18);
                    ctx.lineTo(width * 0.22, crackB + 28);
                }
                ctx.stroke();
            }

            if (start < end) {
                // Center yellow dashed line follows the actual road direction.
                ctx.strokeStyle = 'rgba(235, 185, 60, 0.76)';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([18, 18]);
                ctx.beginPath();
                // Use the road's fixed local endpoints so the dash phase stays
                // world-anchored without emitting dozens of segments per frame.
                line(-length / 2 + inset, length / 2 - inset, 0);
                ctx.stroke();
                ctx.setLineDash([]);

                // White edge lines on both sides, also direction-aware.
                ctx.strokeStyle = 'rgba(240, 240, 240, 0.52)';
                ctx.lineWidth = 1.5;
                const edge = width / 2 - 8;
                ctx.beginPath();
                line(start, end, -edge);
                line(start, end, edge);
                ctx.stroke();
            }
        } else {
            ctx.strokeStyle = '#524330';
            ctx.lineWidth = 3.5;
            const trackOff = width * 0.18;
            ctx.beginPath();
            line(-length / 2, length / 2, -trackOff);
            line(-length / 2, length / 2, trackOff);
            ctx.stroke();
        }
        ctx.restore();
    }

    getVisibleRoadAxisRange(o, isHorizontal, padding = 160) {
        const angle = -(o.rotation || 0);
        const cos = Math.cos(angle);

        const sin = Math.sin(angle);
        const corners = [
            [this._viewLeft, this._viewTop],
            [this._viewRight, this._viewTop],
            [this._viewRight, this._viewBottom],
            [this._viewLeft, this._viewBottom],
        ];
        let min = Infinity;
        let max = -Infinity;
        for (const [worldX, worldY] of corners) {
            const dx = worldX - o.x;
            const dy = worldY - o.y;
            const localX = dx * cos - dy * sin;
            const localY = dx * sin + dy * cos;
            const axis = isHorizontal ? localX : localY;
            min = Math.min(min, axis);
            max = Math.max(max, axis);
        }
        const halfLength = (isHorizontal ? o.w : o.h) / 2;
        return {
            start: Math.max(-halfLength, min - padding),
            end: Math.min(halfLength, max + padding),
        };
    }

    getFieldPalette(variant) {
        const palettes = {
            quarry: { base: 'rgba(122, 109, 84, 0.46)', detail: 'rgba(90, 78, 58, 0.24)', line: 'rgba(58, 49, 35, 0.18)' },
            industrial: { base: 'rgba(98, 92, 82, 0.34)', detail: 'rgba(68, 63, 56, 0.20)', line: 'rgba(46, 42, 36, 0.16)' },
            ruins: { base: 'rgba(105, 99, 82, 0.30)', detail: 'rgba(74, 67, 52, 0.18)', line: 'rgba(45, 39, 30, 0.14)' },
            crop: { base: 'rgba(78, 103, 45, 0.32)', detail: 'rgba(58, 86, 35, 0.22)', line: 'rgba(35, 67, 25, 0.22)' },
            farm: { base: 'rgba(67, 93, 40, 0.24)', detail: 'rgba(86, 88, 43, 0.18)', line: 'rgba(44, 72, 27, 0.16)' },
            estate: { base: 'rgba(55, 82, 50, 0.22)', detail: 'rgba(78, 101, 58, 0.14)', line: 'rgba(30, 59, 28, 0.10)' },
            mansion: { base: 'rgba(55, 82, 50, 0.22)', detail: 'rgba(78, 101, 58, 0.14)', line: 'rgba(30, 59, 28, 0.10)' },
            town: { base: 'rgba(58, 87, 50, 0.20)', detail: 'rgba(87, 94, 59, 0.12)', line: 'rgba(32, 62, 28, 0.10)' },
            village: { base: 'rgba(59, 91, 48, 0.19)', detail: 'rgba(92, 101, 58, 0.12)', line: 'rgba(31, 63, 28, 0.10)' },
            camp: { base: 'rgba(48, 76, 40, 0.20)', detail: 'rgba(73, 94, 48, 0.14)', line: 'rgba(25, 52, 23, 0.10)' },
            woods: { base: 'rgba(42, 72, 36, 0.20)', detail: 'rgba(30, 62, 28, 0.15)', line: 'rgba(18, 45, 18, 0.08)' },
            scrub: { base: 'rgba(62, 87, 43, 0.18)', detail: 'rgba(79, 91, 44, 0.13)', line: 'rgba(39, 64, 26, 0.08)' },
            wetlands: { base: 'rgba(45, 76, 55, 0.20)', detail: 'rgba(40, 87, 68, 0.12)', line: 'rgba(22, 56, 45, 0.10)' },
            'snow-woods': { base: 'rgba(118, 132, 122, 0.20)', detail: 'rgba(92, 117, 108, 0.13)', line: 'rgba(65, 91, 83, 0.10)' },
            'snow-lab': { base: 'rgba(118, 132, 122, 0.22)', detail: 'rgba(88, 105, 101, 0.14)', line: 'rgba(62, 81, 78, 0.10)' },
        };
        return palettes[variant] || { base: 'rgba(58, 88, 48, 0.18)', detail: 'rgba(84, 98, 56, 0.12)', line: 'rgba(30, 60, 26, 0.09)' };
    }

    drawOrganicField(ctx, o) {
        const hw = o.w / 2;
        const hh = o.h / 2;
        const palette = this.getFieldPalette(o.variant);
        const variantSeed = String(o.variant || 'field').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const steps = 10;

        ctx.save();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = -hw + t * o.w;
            const wobble = (seededNoise((o.x + x) * 0.013, (o.y - hh) * 0.013 + variantSeed) - 0.5) * 72;
            const y = -hh + wobble;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const y = -hh + t * o.h;
            const wobble = (seededNoise((o.x + hw) * 0.013 + variantSeed, (o.y + y) * 0.013) - 0.5) * 72;
            ctx.lineTo(hw + wobble, y);
        }
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = hw - t * o.w;
            const wobble = (seededNoise((o.x + x) * 0.013, (o.y + hh) * 0.013 - variantSeed) - 0.5) * 72;
            ctx.lineTo(x, hh + wobble);
        }
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const y = hh - t * o.h;
            const wobble = (seededNoise((o.x - hw) * 0.013 - variantSeed, (o.y + y) * 0.013) - 0.5) * 72;
            ctx.lineTo(-hw + wobble, y);
        }
        ctx.closePath();
        ctx.fillStyle = palette.base;
        ctx.fill();
        ctx.clip();

        const detailCount = Math.max(5, Math.min(18, Math.round((o.w * o.h) / 85000)));
        for (let i = 0; i < detailCount; i++) {
            const n1 = seededNoise(o.x * 0.019 + i * 17.31, o.y * 0.019 + variantSeed);
            const n2 = seededNoise(o.x * 0.017 - i * 9.77, o.y * 0.017 - variantSeed);
            const x = -hw + n1 * o.w;
            const y = -hh + n2 * o.h;
            const rw = 70 + seededNoise(i + variantSeed, o.x * 0.01) * 150;
            const rh = 20 + seededNoise(o.y * 0.01, i - variantSeed) * 56;
            ctx.fillStyle = i % 3 === 0 ? palette.line : palette.detail;
            ctx.beginPath();
            ctx.ellipse(x, y, rw, rh, n1 * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        if (o.variant === 'crop') {
            ctx.strokeStyle = palette.line;
            ctx.lineWidth = 2.2;
            for (let x = -hw + 18; x < hw; x += 28) {
                ctx.beginPath();
                ctx.moveTo(x, -hh + 10);
                ctx.lineTo(x + 12 * Math.sin((o.y + x) * 0.01), hh - 10);
                ctx.stroke();
            }
        }

        if (o.variant === 'quarry' || o.variant === 'industrial' || o.variant === 'ruins') {
            ctx.fillStyle = palette.line;
            for (let i = 0; i < detailCount; i++) {
                const n1 = seededNoise(o.x * 0.021 + i * 5.7, o.y * 0.021);
                const n2 = seededNoise(o.x * 0.015, o.y * 0.015 + i * 11.2);
                ctx.beginPath();
                ctx.arc(-hw + n1 * o.w, -hh + n2 * o.h, 4 + n1 * 8, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    getObstacleHitShake(o) {
        const elapsed = this._frameNow - (o?._hitAt || 0);
        if (elapsed < 0 || elapsed >= 190) return { x: 0, y: 0 };
        const strength = (1 - elapsed / 190) * 4.2;
        const phase = elapsed * 0.11 + String(o.id || '').length;
        return {
            x: Math.sin(phase) * strength,
            y: Math.cos(phase * 1.37) * strength * 0.65,
        };
    }

    drawObstacle(ctx, o, allowCache = true) {
        const kind = o.kind || 'crate';
        if (allowCache && this.drawCachedObstacle(ctx, o, kind)) return;

        // Roads and water are now handled via layered passes
        if (kind === 'road' || kind === 'river' || kind === 'water') return;

        const shake = allowCache ? this.getObstacleHitShake(o) : { x: 0, y: 0 };
        ctx.save();
        ctx.translate(o.x + shake.x, o.y + shake.y);
        ctx.rotate(o.rotation || 0);
        const useSoftShadow = false; // Shadows baked into sprite cache instead
        ctx.shadowColor = useSoftShadow ? 'rgba(18, 22, 18, 0.32)' : 'transparent';
        ctx.shadowBlur = useSoftShadow ? 5 : 0;
        ctx.shadowOffsetY = useSoftShadow ? 4 : 0;
        if (kind === 'houseFloor') {
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            // Floor with gradient for depth
            const floorColors = {
                mansion: { main: '#596168', dark: '#474f55', line: 'rgba(215,228,232,0.07)' },
                warehouse: { main: '#515e64', dark: '#414c52', line: 'rgba(200,220,228,0.07)' },
                ironworks: { main: '#3f4a4f', dark: '#293237', line: 'rgba(190,218,226,0.11)' },
            };
            const fc = floorColors[o.variant] || { main: '#62676a', dark: '#50565a', line: 'rgba(215,225,228,0.06)' };
            const floorGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
            floorGrad.addColorStop(0, fc.main);
            floorGrad.addColorStop(1, fc.dark);
            ctx.fillStyle = floorGrad;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 5);
            ctx.fill();
            // Plank/tile lines
            ctx.strokeStyle = fc.line;
            ctx.lineWidth = 1;
            const tileStep = o.variant === 'ironworks' ? 72 : o.variant === 'warehouse' ? 64 : 58;
            for (let ix = -o.w / 2 + tileStep; ix < o.w / 2; ix += tileStep) {
                ctx.beginPath();
                ctx.moveTo(ix, -o.h / 2 + 8);
                ctx.lineTo(ix, o.h / 2 - 8);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(25, 20, 15, 0.14)';
            for (let iy = -o.h / 2 + tileStep; iy < o.h / 2; iy += tileStep) {
                ctx.beginPath();
                ctx.moveTo(-o.w / 2 + 8, iy);
                ctx.lineTo(o.w / 2 - 8, iy);
                ctx.stroke();
            }
            if (o.variant === 'ironworks') {
                // Broad central combat lane with readable steel plates and hazard borders.
                const laneW = Math.min(560, o.w * 0.34);
                ctx.fillStyle = 'rgba(12, 18, 21, 0.18)';
                ctx.fillRect(-laneW / 2, -o.h / 2 + 16, laneW, o.h - 32);
                ctx.strokeStyle = 'rgba(232, 174, 48, 0.58)';
                ctx.lineWidth = 7;
                ctx.setLineDash([22, 18]);
                ctx.beginPath();
                ctx.moveTo(-laneW / 2, -o.h / 2 + 22);
                ctx.lineTo(-laneW / 2, o.h / 2 - 22);
                ctx.moveTo(laneW / 2, -o.h / 2 + 22);
                ctx.lineTo(laneW / 2, o.h / 2 - 22);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = 'rgba(186, 205, 211, 0.32)';
                for (let i = 0; i < 18; i++) {
                    const rx = -o.w / 2 + 28 + seededNoise(o.x * 0.01 + i, o.y * 0.01) * (o.w - 56);
                    const ry = -o.h / 2 + 28 + seededNoise(o.y * 0.01 + i, o.x * 0.01 + 11) * (o.h - 56);
                    ctx.beginPath();
                    ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            // Subtle inner border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.lineWidth = 1;
            roundRect(ctx, -o.w / 2 + 3, -o.h / 2 + 3, o.w - 6, o.h - 6, 4);
            ctx.stroke();
        } else if (kind === 'door') {
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            const industrial = o.variant === 'ironworks' || o.variant === 'metal';
            const frame = industrial ? '#11191d' : o.variant === 'warehouse' ? '#26343a' : o.variant === 'mansion' ? '#303a40' : '#354045';
            // Light spill from inside
            const lightGrad = ctx.createRadialGradient(0, -o.h * 0.15, 4, 0, 0, Math.max(o.w, o.h) * 0.8);
            lightGrad.addColorStop(0, industrial ? 'rgba(157, 220, 235, 0.22)' : 'rgba(255, 220, 140, 0.18)');
            lightGrad.addColorStop(0.5, industrial ? 'rgba(95, 180, 205, 0.08)' : 'rgba(255, 200, 100, 0.06)');
            lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = lightGrad;
            ctx.fillRect(-o.w * 0.7, -o.h * 0.7, o.w * 1.4, o.h * 1.4);
            // Dark doorway opening
            ctx.fillStyle = 'rgba(6, 5, 3, 0.85)';
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 5);
            ctx.fill();
            // Frame
            ctx.strokeStyle = frame;
            ctx.lineWidth = 5;
            roundRect(ctx, -o.w / 2 + 2, -o.h / 2 + 2, o.w - 4, o.h - 4, 4);
            ctx.stroke();
            // Threshold warm light
            ctx.fillStyle = industrial ? 'rgba(118, 205, 224, 0.32)' : 'rgba(238, 205, 138, 0.28)';
            const doorSide = o.orientation || o.role;
            const verticalDoor = doorSide === 'east' || doorSide === 'west';
            if (verticalDoor) {
                const thresholdX = doorSide === 'west' ? -o.w / 2 : o.w / 2 - 8;
                roundRect(ctx, thresholdX, -o.h / 2 + 10, 8, o.h - 20, 3);
            } else {
                const thresholdY = doorSide === 'north' ? -o.h / 2 : o.h / 2 - 8;
                roundRect(ctx, -o.w / 2 + 10, thresholdY, o.w - 20, 8, 3);
            }
            ctx.fill();
            // Top highlight
            ctx.strokeStyle = 'rgba(255,255,255,0.14)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-o.w / 2 + 10, -o.h / 2 + 9);
            ctx.lineTo(o.w / 2 - 10, -o.h / 2 + 9);
            ctx.stroke();
        } else if (kind === 'wall' || kind === 'interiorWall') {
            // Wall with gradient and brick/stone texture
            const wallColors = {
                stone: { main: '#807a6c', dark: '#6a6558', highlight: 'rgba(200,195,180,0.12)' },
                warehouse: { main: '#48565e', dark: '#374249', highlight: 'rgba(160,185,200,0.10)' },
                metal: { main: '#38464d', dark: '#222c31', highlight: 'rgba(176,214,225,0.16)' },
                ironworks: { main: '#38464d', dark: '#222c31', highlight: 'rgba(176,214,225,0.16)' },
            };
            const wc = wallColors[o.variant] || { main: '#596268', dark: '#424b50', highlight: 'rgba(208,224,230,0.11)' };
            const wallGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
            wallGrad.addColorStop(0, wc.main);
            wallGrad.addColorStop(1, wc.dark);
            ctx.fillStyle = wallGrad;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.fill();
            // Top highlight edge
            ctx.fillStyle = wc.highlight;
            if (o.w > o.h) ctx.fillRect(-o.w / 2 + 3, -o.h / 2 + 2, o.w - 6, Math.max(2, o.h * 0.18));
            else ctx.fillRect(-o.w / 2 + 2, -o.h / 2 + 3, Math.max(2, o.w * 0.18), o.h - 6);
            // Stone/brick texture
            if (o.variant === 'stone') {
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.lineWidth = 0.8;
                const brickH = 14;
                const brickW = 22;
                if (o.w > o.h) {
                    for (let by = -o.h / 2 + brickH; by < o.h / 2; by += brickH) {
                        ctx.beginPath();
                        ctx.moveTo(-o.w / 2 + 3, by);
                        ctx.lineTo(o.w / 2 - 3, by);
                        ctx.stroke();
                    }
                } else {
                    for (let bx = -o.w / 2 + brickW; bx < o.w / 2; bx += brickW) {
                        ctx.beginPath();
                        ctx.moveTo(bx, -o.h / 2 + 3);
                        ctx.lineTo(bx, o.h / 2 - 3);
                        ctx.stroke();
                    }
                }
            } else if (o.variant === 'metal' || o.variant === 'ironworks') {
                ctx.strokeStyle = 'rgba(8, 13, 16, 0.34)';
                ctx.lineWidth = 1.2;
                const panelStep = 52;
                if (o.w > o.h) {
                    for (let px = -o.w / 2 + panelStep; px < o.w / 2; px += panelStep) {
                        ctx.beginPath();
                        ctx.moveTo(px, -o.h / 2 + 2);
                        ctx.lineTo(px, o.h / 2 - 2);
                        ctx.stroke();
                    }
                } else {
                    for (let py = -o.h / 2 + panelStep; py < o.h / 2; py += panelStep) {
                        ctx.beginPath();
                        ctx.moveTo(-o.w / 2 + 2, py);
                        ctx.lineTo(o.w / 2 - 2, py);
                        ctx.stroke();
                    }
                }
            }
            // Outline
            ctx.strokeStyle = 'rgba(24,20,16,0.42)';
            ctx.lineWidth = 2;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.stroke();
        } else if (kind === 'furniture' || kind === 'machine') {
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            const furnitureVariant = kind === 'machine' ? 'machine' : o.variant;
            if (furnitureVariant === 'machine' || furnitureVariant === 'industrial') {
                const machineGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
                machineGrad.addColorStop(0, '#526068');
                machineGrad.addColorStop(1, '#273136');
                ctx.fillStyle = machineGrad;
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 5);
                ctx.fill();
                ctx.strokeStyle = '#11181c';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = '#141c20';
                roundRect(ctx, -o.w * 0.32, -o.h * 0.24, o.w * 0.64, o.h * 0.30, 3);
                ctx.fill();
                ctx.fillStyle = '#65c5d8';
                ctx.fillRect(-o.w * 0.24, -o.h * 0.16, o.w * 0.20, 5);
                ctx.fillStyle = '#e0ad3e';
                ctx.beginPath();
                ctx.arc(o.w * 0.18, -o.h * 0.09, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(234, 178, 52, 0.72)';
                ctx.lineWidth = 5;
                ctx.setLineDash([9, 7]);
                ctx.beginPath();
                ctx.moveTo(-o.w / 2 + 8, o.h / 2 - 9);
                ctx.lineTo(o.w / 2 - 8, o.h / 2 - 9);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (furnitureVariant === 'locker') {
                ctx.fillStyle = '#43535c';
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
                ctx.fill();
                ctx.strokeStyle = '#202a2f';
                ctx.lineWidth = 2;
                ctx.stroke();
                const columns = Math.max(1, Math.round(o.w / 28));
                for (let i = 1; i < columns; i++) {
                    const x = -o.w / 2 + (i / columns) * o.w;
                    ctx.beginPath();
                    ctx.moveTo(x, -o.h / 2 + 3);
                    ctx.lineTo(x, o.h / 2 - 3);
                    ctx.stroke();
                }
                ctx.fillStyle = 'rgba(191, 216, 224, 0.36)';
                for (let i = 0; i < columns; i++) {
                    const x = -o.w / 2 + ((i + 0.5) / columns) * o.w;
                    ctx.fillRect(x - 5, -o.h / 2 + 7, 10, 2);
                    ctx.fillRect(x - 5, -o.h / 2 + 12, 10, 2);
                }
            } else if (furnitureVariant === 'workbench') {
                ctx.fillStyle = '#29343a';
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
                ctx.fill();
                ctx.strokeStyle = '#11181b';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.fillStyle = '#8a5a34';
                ctx.fillRect(-o.w / 2 + 5, -o.h / 2 + 5, o.w - 10, Math.max(8, o.h * 0.32));
                ctx.fillStyle = '#cf9e3d';
                ctx.fillRect(-o.w * 0.16, 1, o.w * 0.32, 4);
                ctx.fillStyle = '#718089';
                ctx.beginPath();
                ctx.arc(o.w * 0.27, o.h * 0.12, 5, 0, Math.PI * 2);
                ctx.fill();
            } else if (furnitureVariant === 'bed') {
                // Bed frame
                ctx.fillStyle = '#5a4a36';
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 4);
                ctx.fill();
                // Mattress/blanket
                const bedGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
                bedGrad.addColorStop(0, '#4a6878');
                bedGrad.addColorStop(1, '#3d5868');
                ctx.fillStyle = bedGrad;
                roundRect(ctx, -o.w / 2 + 3, -o.h / 2 + 3, o.w - 6, o.h - 6, 3);
                ctx.fill();
                // Pillow
                ctx.fillStyle = '#c8bfae';
                roundRect(ctx, -o.w / 2 + 6, -o.h / 2 + 5, o.w - 12, Math.max(8, o.h * 0.25), 4);
                ctx.fill();
                // Blanket fold line
                ctx.strokeStyle = 'rgba(255,255,255,0.10)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-o.w / 2 + 8, o.h * 0.05);
                ctx.lineTo(o.w / 2 - 8, o.h * 0.05);
                ctx.stroke();
            } else {
                // Table
                ctx.fillStyle = '#6d4a2f';
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
                ctx.fill();
                // Table surface highlight
                const tableGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
                tableGrad.addColorStop(0, 'rgba(255,240,200,0.12)');
                tableGrad.addColorStop(0.5, 'rgba(255,240,200,0.04)');
                tableGrad.addColorStop(1, 'rgba(0,0,0,0.06)');
                ctx.fillStyle = tableGrad;
                roundRect(ctx, -o.w / 2 + 2, -o.h / 2 + 2, o.w - 4, o.h - 4, 2);
                ctx.fill();
                // Legs (corner dots)
                ctx.fillStyle = 'rgba(40, 28, 16, 0.55)';
                const legR = 3;
                ctx.beginPath();
                ctx.arc(-o.w / 2 + 6, -o.h / 2 + 6, legR, 0, Math.PI * 2);
                ctx.arc(o.w / 2 - 6, -o.h / 2 + 6, legR, 0, Math.PI * 2);
                ctx.arc(-o.w / 2 + 6, o.h / 2 - 6, legR, 0, Math.PI * 2);
                ctx.arc(o.w / 2 - 6, o.h / 2 - 6, legR, 0, Math.PI * 2);
                ctx.fill();
                // Outline
                ctx.strokeStyle = 'rgba(30, 20, 10, 0.25)';
                ctx.lineWidth = 1;
                roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
                ctx.stroke();
            }
        } else if (kind === 'tree') {
            const r = Math.max(o.w, o.h) / 2;
            // Ground shadow
            ctx.shadowBlur = 0;

            ctx.fillStyle = 'rgba(10, 18, 8, 0.22)';
            ctx.beginPath();
            ctx.ellipse(r * 0.05, r * 0.35, r * 0.72, r * 0.32, 0.15, 0, Math.PI * 2);
            ctx.fill();
            // Trunk
            ctx.fillStyle = '#5c3a1e';
            roundRect(ctx, -r * 0.14, -r * 0.05, r * 0.28, r * 0.52, r * 0.07);
            ctx.fill();
            ctx.fillStyle = 'rgba(90, 65, 35, 0.45)';
            roundRect(ctx, -r * 0.06, 0, r * 0.12, r * 0.38, r * 0.04);
            ctx.fill();
            // Main canopy (bottom layer, darker)
            ctx.fillStyle = `hsl(${o.hue ?? 118}, 36%, 26%)`;
            ctx.beginPath();
            ctx.arc(0, -r * 0.12, r * 0.82, 0, Math.PI * 2);
            ctx.fill();
            // Mid canopy layer
            ctx.fillStyle = `hsl(${(o.hue ?? 118) + 4}, 40%, 32%)`;
            ctx.beginPath();
            ctx.arc(-r * 0.08, -r * 0.18, r * 0.62, 0, Math.PI * 2);
            ctx.fill();
            // Top highlight canopy
            ctx.fillStyle = `hsl(${(o.hue ?? 118) + 10}, 44%, 38%)`;
            ctx.beginPath();
            ctx.arc(-r * 0.16, -r * 0.28, r * 0.38, 0, Math.PI * 2);
            ctx.fill();
            // Light highlight spot
            ctx.fillStyle = `hsl(${(o.hue ?? 118) + 14}, 48%, 44%)`;
            ctx.beginPath();
            ctx.arc(-r * 0.22, -r * 0.34, r * 0.16, 0, Math.PI * 2);
            ctx.fill();
            // Canopy outline
            ctx.strokeStyle = 'rgba(16, 30, 14, 0.32)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, -r * 0.12, r * 0.82, 0, Math.PI * 2);
            ctx.stroke();
        } else if (kind === 'bush') {
            const r = Math.max(o.w, o.h) / 2;
            ctx.shadowBlur = 3;
            // Ground shadow
            ctx.fillStyle = 'rgba(10, 18, 8, 0.18)';
            ctx.beginPath();
            ctx.ellipse(0, r * 0.18, r * 0.58, r * 0.24, 0, 0, Math.PI * 2);
            ctx.fill();
            // Dark base blobs
            ctx.fillStyle = `hsl(${(o.hue ?? 105)}, 32%, 24%)`;
            ctx.beginPath();
            ctx.arc(-r * 0.2, r * 0.02, r * 0.48, 0, Math.PI * 2);
            ctx.arc(r * 0.18, r * 0.04, r * 0.46, 0, Math.PI * 2);
            ctx.arc(-r * 0.02, -r * 0.18, r * 0.42, 0, Math.PI * 2);
            ctx.fill();
            // Lighter top blobs
            ctx.fillStyle = `hsl(${(o.hue ?? 105) + 6}, 36%, 32%)`;
            ctx.beginPath();
            ctx.arc(-r * 0.14, -r * 0.06, r * 0.34, 0, Math.PI * 2);
            ctx.arc(r * 0.12, -r * 0.04, r * 0.32, 0, Math.PI * 2);
            ctx.fill();
            // Highlight spot
            ctx.fillStyle = `hsl(${(o.hue ?? 105) + 12}, 40%, 38%)`;
            ctx.beginPath();
            ctx.arc(-r * 0.08, -r * 0.18, r * 0.18, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'barrel') {
            const r = Math.max(o.w, o.h) / 2;
            // Metallic body gradient
            const barrelGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.2, 0, 0, 0, r);
            barrelGrad.addColorStop(0, `hsl(${o.hue ?? 22}, 48%, 48%)`);
            barrelGrad.addColorStop(0.5, `hsl(${o.hue ?? 22}, 44%, 37%)`);
            barrelGrad.addColorStop(1, `hsl(${o.hue ?? 22}, 40%, 28%)`);
            ctx.fillStyle = barrelGrad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            // Metal rim
            ctx.strokeStyle = 'rgba(20,18,15,0.5)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            // Metal bands
            ctx.strokeStyle = 'rgba(200,195,180,0.18)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
            ctx.stroke();
            // Rivet highlights
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            // Top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.beginPath();
            ctx.ellipse(-r * 0.15, -r * 0.2, r * 0.35, r * 0.22, -0.3, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'sandbag') {
            // Stacked sandbags look
            const bagH = Math.max(10, o.h / 3);
            const bags = Math.max(2, Math.round(o.h / bagH));
            for (let i = 0; i < bags; i++) {
                const by = -o.h / 2 + i * (o.h / bags);
                const bh = o.h / bags;
                const offset = (i % 2) * 4 - 2;
                ctx.fillStyle = i % 2 === 0 ? '#a3926a' : '#96855c';
                roundRect(ctx, -o.w / 2 + offset, by, o.w - Math.abs(offset), bh - 1, 5);
                ctx.fill();
                // Bag stitching line
                ctx.strokeStyle = 'rgba(60, 48, 24, 0.22)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(-o.w / 4 + offset, by + bh * 0.5);
                ctx.lineTo(o.w / 4 + offset, by + bh * 0.5);
                ctx.stroke();
            }
            // Overall outline
            ctx.strokeStyle = 'rgba(48,40,24,0.32)';
            ctx.lineWidth = 2;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 6);
            ctx.stroke();
            // Highlight on top edge
            ctx.strokeStyle = 'rgba(255,240,200,0.10)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-o.w / 2 + 6, -o.h / 2 + 2);
            ctx.lineTo(o.w / 2 - 6, -o.h / 2 + 2);
            ctx.stroke();
        } else if (kind === 'tent') {
            // Canvas tent with ridge
            const tentGrad = ctx.createLinearGradient(-o.w / 2, 0, o.w / 2, 0);
            tentGrad.addColorStop(0, `hsl(${o.hue ?? 82}, 28%, 30%)`);
            tentGrad.addColorStop(0.5, `hsl(${o.hue ?? 82}, 32%, 38%)`);
            tentGrad.addColorStop(1, `hsl(${o.hue ?? 82}, 28%, 30%)`);
            ctx.fillStyle = tentGrad;
            ctx.beginPath();
            ctx.moveTo(-o.w / 2, o.h / 2);
            ctx.lineTo(-o.w * 0.05, -o.h / 2);
            ctx.lineTo(o.w * 0.05, -o.h / 2);
            ctx.lineTo(o.w / 2, o.h / 2);
            ctx.closePath();
            ctx.fill();
            // Outline
            ctx.strokeStyle = 'rgba(18,20,16,0.42)';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Ridge pole
            ctx.strokeStyle = 'rgba(255,240,200,0.18)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, -o.h / 2 + 4);
            ctx.lineTo(0, o.h / 2 - 3);
            ctx.stroke();
            // Canvas fold lines
            ctx.strokeStyle = 'rgba(0,0,0,0.10)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(-o.w * 0.28, o.h * 0.1);
            ctx.lineTo(-o.w * 0.03, -o.h * 0.38);
            ctx.moveTo(o.w * 0.28, o.h * 0.1);
            ctx.lineTo(o.w * 0.03, -o.h * 0.38);
            ctx.stroke();
            // Guy rope dots (ground stakes)
            ctx.fillStyle = 'rgba(80, 70, 50, 0.45)';
            ctx.beginPath();
            ctx.arc(-o.w / 2 - 6, o.h / 2 + 4, 3, 0, Math.PI * 2);
            ctx.arc(o.w / 2 + 6, o.h / 2 + 4, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'rock') {
            // More natural irregular rock shape
            const hw = o.w / 2;
            const hh = o.h / 2;
            // Base rock shape
            const rockGrad = ctx.createLinearGradient(-hw, -hh, hw * 0.6, hh * 0.6);
            rockGrad.addColorStop(0, `hsl(${o.hue ?? 218}, 14%, 48%)`);
            rockGrad.addColorStop(0.6, `hsl(${o.hue ?? 218}, 12%, 38%)`);
            rockGrad.addColorStop(1, `hsl(${o.hue ?? 218}, 10%, 30%)`);
            ctx.fillStyle = rockGrad;
            ctx.beginPath();
            ctx.moveTo(-hw * 0.78, -hh * 0.12);
            ctx.lineTo(-hw * 0.52, -hh * 0.68);
            ctx.quadraticCurveTo(-hw * 0.2, -hh * 0.82, hw * 0.08, -hh * 0.72);
            ctx.lineTo(hw * 0.58, -hh * 0.48);
            ctx.quadraticCurveTo(hw * 0.82, -hh * 0.14, hw * 0.72, hh * 0.24);
            ctx.lineTo(hw * 0.38, hh * 0.62);
            ctx.quadraticCurveTo(hw * 0.1, hh * 0.78, -hw * 0.22, hh * 0.56);
            ctx.lineTo(-hw * 0.64, hh * 0.32);
            ctx.quadraticCurveTo(-hw * 0.86, hh * 0.08, -hw * 0.78, -hh * 0.12);
            ctx.closePath();
            ctx.fill();
            // Outline
            ctx.strokeStyle = 'rgba(20,24,27,0.32)';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Crack/vein line
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-hw * 0.3, -hh * 0.4);
            ctx.quadraticCurveTo(hw * 0.05, -hh * 0.1, hw * 0.2, hh * 0.3);
            ctx.stroke();
            // Top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.ellipse(-hw * 0.2, -hh * 0.35, hw * 0.22, hh * 0.12, -0.4, 0, Math.PI * 2);
            ctx.fill();
            // Moss spot
            ctx.fillStyle = 'rgba(58, 82, 48, 0.18)';
            ctx.beginPath();
            ctx.ellipse(hw * 0.15, hh * 0.28, hw * 0.16, hh * 0.1, 0.3, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'container') {
            // Shipping container with corrugated texture
            const contGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
            contGrad.addColorStop(0, `hsl(${o.hue ?? 205}, 46%, 40%)`);
            contGrad.addColorStop(0.5, `hsl(${o.hue ?? 205}, 42%, 34%)`);
            contGrad.addColorStop(1, `hsl(${o.hue ?? 205}, 38%, 28%)`);
            ctx.fillStyle = contGrad;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.fill();
            // Corrugated lines
            ctx.strokeStyle = 'rgba(0,0,0,0.10)';
            ctx.lineWidth = 0.8;
            const corrStep = 8;
            for (let cx = -o.w / 2 + corrStep; cx < o.w / 2; cx += corrStep) {
                ctx.beginPath();
                ctx.moveTo(cx, -o.h / 2 + 4);
                ctx.lineTo(cx, o.h / 2 - 4);
                ctx.stroke();
            }
            // Outline
            ctx.strokeStyle = 'rgba(10,14,18,0.52)';
            ctx.lineWidth = 2.5;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.stroke();
            // Corner reinforcements
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            roundRect(ctx, -o.w / 2, -o.h / 2, 10, o.h, 2);
            ctx.fill();
            roundRect(ctx, o.w / 2 - 10, -o.h / 2, 10, o.h, 2);
            ctx.fill();
            // ID plate
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            roundRect(ctx, -o.w * 0.15, -o.h / 2 + 4, o.w * 0.3, 10, 2);
            ctx.fill();
            // Top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(-o.w / 2 + 12, -o.h / 2 + 3, o.w - 24, 3);
        } else if (kind === 'field') {
            this.drawOrganicField(ctx, o);
        } else {
            // Fallback: generic crate
            const crateGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
            crateGrad.addColorStop(0, `hsl(${o.hue ?? 30}, 40%, 40%)`);
            crateGrad.addColorStop(1, `hsl(${o.hue ?? 30}, 36%, 28%)`);
            ctx.fillStyle = crateGrad;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.fill();
            // Outline
            ctx.strokeStyle = 'rgba(22,20,18,0.42)';
            ctx.lineWidth = 2.5;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.stroke();
            ctx.shadowBlur = 0;
            // Cross-brace pattern
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-o.w / 2 + 6, -o.h / 2 + 6);
            ctx.lineTo(o.w / 2 - 6, o.h / 2 - 6);
            ctx.moveTo(o.w / 2 - 6, -o.h / 2 + 6);
            ctx.lineTo(-o.w / 2 + 6, o.h / 2 - 6);
            ctx.stroke();
            // Center nail/bolt
            ctx.fillStyle = 'rgba(180,170,140,0.28)';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawCachedObstacle(ctx, o, kind) {
        if (typeof document === 'undefined' || !o?.id || !CACHEABLE_PROP_KINDS.has(kind)) return false;
        if (o.w > 320 || o.h > 320 || !o.w || !o.h) return false;

        const key = o.id + ':' + this._obstacleRevision;
        let sprite = this._obstacleSpriteCache.get(key);
        if (!sprite) {
            if (this._obstacleCacheBuildsThisFrame >= 8) return false;
            this._obstacleCacheBuildsThisFrame++;

            const rotated = Math.abs(o.rotation || 0) > 0.001;
            const extent = rotated ? Math.hypot(o.w, o.h) : 0;
            const width = Math.ceil((rotated ? extent : o.w) + 40);
            const height = Math.ceil((rotated ? extent : o.h) + 46);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const cacheCtx = canvas.getContext('2d', { alpha: true });
            if (!cacheCtx) return false;
            cacheCtx.translate(width / 2 - o.x, height / 2 - o.y);
            this.drawObstacle(cacheCtx, o, false);
            sprite = { canvas, width, height };

            if (this._obstacleSpriteCache.size >= 320) {
                const oldestKey = this._obstacleSpriteCache.keys().next().value;
                this._obstacleSpriteCache.delete(oldestKey);
            }
            this._obstacleSpriteCache.set(key, sprite);
        }

        const shake = this.getObstacleHitShake(o);
        ctx.drawImage(
            sprite.canvas,
            Math.round(o.x + shake.x - sprite.width / 2),
            Math.round(o.y + shake.y - sprite.height / 2),
        );
        return true;
    }

    drawLoot(ctx, l) {
        const color = LOOT_COLORS[l.type] || '#d5d5d5';
        const isChest = l.type === 'chest' || l.type === 'deathCrate';
        const pulse = isChest ? 1 : (1 + Math.sin(this._frameNow / 190 + l.x * 0.03) * 0.06);
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.scale(pulse, pulse);

        if (isChest) {
            const hovered = this.hoveredChestId === l.id;
            const isDeathCrate = l.type === 'deathCrate';
            const tierColor = isDeathCrate ? '#a855f7' : (RARITY_COLORS[l.tier] || '#d7c396');
            const glowRad = 34 + Math.sin(this._frameNow / 260 + l.x * 0.035) * 5;

            // Base shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
            ctx.beginPath();
            ctx.ellipse(0, 11, 23, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            // Glow Aura
            const glowGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, glowRad);
            glowGrad.addColorStop(0, tierColor + '46');
            glowGrad.addColorStop(0.5, tierColor + '18');
            glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
            ctx.fill();

            const palette = isDeathCrate
                ? { lid: '#442e5d', body: '#2d203b', trim: '#a855f7', dark: '#150e1c', lock: '#f5d0fe', glow: '#bf7afc' }
                : l.tier === 'military'
                    ? { lid: '#485735', body: '#2f3b25', trim: '#1b2416', dark: '#0c120a', lock: '#a3e635', glow: '#bef264' }
                    : l.tier === 'rare'
                        ? { lid: '#22488a', body: '#162e5c', trim: '#fbbf24', dark: '#0a1730', lock: '#fef08a', glow: '#60a5fa' }
                        : { lid: '#7c3a27', body: '#502315', trim: '#ca8a04', dark: '#2b1008', lock: '#fbbf24', glow: '#f59e0b' };

            ctx.save();
            ctx.rotate(isDeathCrate ? 0.045 : -0.055);

            // Apply interactive glow when hovered
            if (hovered) {
                ctx.shadowColor = palette.glow;
                ctx.shadowBlur = 12 + Math.sin(this._frameNow / 110) * 3;
            }

            if (isDeathCrate) {
                // Death Crate: Gothic Obsidian/Skull Coffin
                // Body (lower part)
                const bodyGrad = ctx.createLinearGradient(0, 0, 0, 12);
                bodyGrad.addColorStop(0, palette.body);
                bodyGrad.addColorStop(1, palette.dark);
                ctx.fillStyle = bodyGrad;
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2.2;
                roundRect(ctx, -19, 0, 38, 12, 3);
                ctx.fill();
                ctx.stroke();

                // Lid (upper part)
                const lidGrad = ctx.createLinearGradient(0, -15, 0, -1);
                lidGrad.addColorStop(0, palette.lid);
                lidGrad.addColorStop(1, palette.body);
                ctx.fillStyle = lidGrad;
                roundRect(ctx, -20, -15, 40, 14, 4);
                ctx.fill();
                ctx.stroke();

                // Bone/silver corners
                ctx.fillStyle = '#94a3b8';
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 1;
                // Top corners
                roundRect(ctx, -20.5, -15.5, 6, 6, 1); ctx.fill(); ctx.stroke();
                roundRect(ctx, 14.5, -15.5, 6, 6, 1); ctx.fill(); ctx.stroke();
                // Bottom corners
                roundRect(ctx, -19.5, 7, 5, 5.5, 1); ctx.fill(); ctx.stroke();
                roundRect(ctx, 14.5, 7, 5, 5.5, 1); ctx.fill(); ctx.stroke();

                // Glowing purple runes/skull on lid
                ctx.save();
                ctx.shadowColor = '#d8b4fe';
                ctx.shadowBlur = 8;
                ctx.strokeStyle = '#c084fc';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                // Draw a simple glowing stylized runic cross/emblem
                ctx.moveTo(-7, -8); ctx.lineTo(7, -8);
                ctx.moveTo(0, -12); ctx.lineTo(0, -4);
                ctx.stroke();
                ctx.restore();

                // Neon trim line dividing lid & body
                ctx.fillStyle = palette.trim;
                roundRect(ctx, -21, -1, 42, 2.5, 1);
                ctx.fill();

                // Mystic Lock Gem
                ctx.fillStyle = '#ec4899';
                ctx.beginPath();
                ctx.moveTo(0, -3);
                ctx.lineTo(4, 1);
                ctx.lineTo(0, 5);
                ctx.lineTo(-4, 1);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            else if (l.tier === 'military') {
                // Military Container Crate
                // Body (lower container)
                const bodyGrad = ctx.createLinearGradient(0, 0, 0, 12);
                bodyGrad.addColorStop(0, palette.body);
                bodyGrad.addColorStop(1, palette.dark);
                ctx.fillStyle = bodyGrad;
                ctx.strokeStyle = '#0c120a';
                ctx.lineWidth = 2.2;
                roundRect(ctx, -19, 0, 38, 12, 2);
                ctx.fill();
                ctx.stroke();

                // Hazard stripes on body
                ctx.strokeStyle = '#a3e635';
                ctx.lineWidth = 2.2;
                ctx.beginPath();

                ctx.moveTo(-10, 1); ctx.lineTo(-6, 11);
                ctx.moveTo(-3, 1); ctx.lineTo(1, 11);
                ctx.moveTo(4, 1); ctx.lineTo(8, 11);
                ctx.stroke();

                // Lid (armored top)
                const lidGrad = ctx.createLinearGradient(0, -14, 0, -1);
                lidGrad.addColorStop(0, '#5c6f44'); // highlight
                lidGrad.addColorStop(0.5, palette.lid);
                lidGrad.addColorStop(1, palette.body);
                ctx.fillStyle = lidGrad;
                ctx.strokeStyle = '#0c120a';
                ctx.lineWidth = 2.2;
                roundRect(ctx, -20, -14, 40, 13, 3);
                ctx.fill();
                ctx.stroke();

                // Reinforcing structural ribs (vertical lines on lid)
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(-13, -13, 3, 11);
                ctx.fillRect(-5, -13, 3, 11);
                ctx.fillRect(3, -13, 3, 11);
                ctx.fillRect(11, -13, 3, 11);

                // Heavy black corner bindings
                ctx.fillStyle = palette.trim;
                ctx.fillRect(-20.5, -14.5, 4.5, 13.5);
                ctx.fillRect(16, -14.5, 4.5, 13.5);
                ctx.fillRect(-19.5, 0, 4, 12);
                ctx.fillRect(15.5, 0, 4, 12);

                // Lid lip / seal
                ctx.fillStyle = '#1b2416';
                roundRect(ctx, -21, -1.5, 42, 2.5, 1);
                ctx.fill();
                ctx.stroke();

                // Center digital keypad / status LED
                ctx.fillStyle = '#1e293b';
                roundRect(ctx, -4, -3, 8, 8, 1.5);
                ctx.fill();
                ctx.stroke();
                // Glowing LED
                ctx.fillStyle = hovered ? '#22c55e' : '#ef4444';
                ctx.beginPath();
                ctx.arc(0, 1, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
            else if (l.tier === 'rare') {
                // Rare Blue/Gold Chest
                // Body (lower chest)
                const bodyGrad = ctx.createLinearGradient(0, 0, 0, 12);
                bodyGrad.addColorStop(0, palette.body);
                bodyGrad.addColorStop(1, palette.dark);
                ctx.fillStyle = bodyGrad;
                ctx.strokeStyle = '#050f24';
                ctx.lineWidth = 2.2;
                roundRect(ctx, -19, 0, 38, 12, 2);
                ctx.fill();
                ctx.stroke();

                // Lid (slanted/curved metallic blue)
                const lidGrad = ctx.createLinearGradient(0, -14, 0, -1);
                lidGrad.addColorStop(0, '#3b82f6'); // light blue highlight
                lidGrad.addColorStop(0.5, palette.lid);
                lidGrad.addColorStop(1, palette.body);
                ctx.fillStyle = lidGrad;
                ctx.strokeStyle = '#050f24';
                ctx.lineWidth = 2.2;
                roundRect(ctx, -20, -14, 40, 13, 3);
                ctx.fill();
                ctx.stroke();

                // Diagonal metallic gloss lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-12, -13); ctx.lineTo(-4, -2);
                ctx.moveTo(4, -13); ctx.lineTo(12, -2);
                ctx.stroke();

                // Gold trim bands
                ctx.fillStyle = palette.trim;
                // Corner protectors
                ctx.beginPath();
                ctx.moveTo(-20, -14); ctx.lineTo(-14, -14); ctx.lineTo(-14, -11);
                ctx.lineTo(-17, -11); ctx.lineTo(-17, -1); ctx.lineTo(-20, -1);
                ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(20, -14); ctx.lineTo(14, -14); ctx.lineTo(14, -11);
                ctx.lineTo(17, -11); ctx.lineTo(17, -1); ctx.lineTo(20, -1);
                ctx.closePath(); ctx.fill(); ctx.stroke();
                // Bottom corners
                ctx.fillRect(-19, 0, 4, 12); ctx.strokeRect(-19, 0, 4, 12);
                ctx.fillRect(15, 0, 4, 12); ctx.strokeRect(15, 0, 4, 12);

                // Lid dividing gold lip
                ctx.fillStyle = palette.trim;
                roundRect(ctx, -20.5, -1.5, 41, 2.5, 1);
                ctx.fill();
                ctx.stroke();

                // Ornate silver plate with glowing cyan lock core
                ctx.fillStyle = '#cbd5e1';
                roundRect(ctx, -5, -4, 10, 9, 2);
                ctx.fill();
                ctx.stroke();
                // Cyan energy core
                ctx.save();
                ctx.shadowColor = '#22d3ee';
                ctx.shadowBlur = 8;
                ctx.fillStyle = '#06b6d4';
                ctx.beginPath();
                ctx.arc(0, 0.5, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            else {
                // Common Wooden Chest
                // Body (lower wood panel)
                const bodyGrad = ctx.createLinearGradient(0, 0, 0, 12);
                bodyGrad.addColorStop(0, palette.body);
                bodyGrad.addColorStop(1, palette.dark);
                ctx.fillStyle = bodyGrad;
                ctx.strokeStyle = '#1a0802';
                ctx.lineWidth = 2.2;
                roundRect(ctx, -18, 0, 36, 12, 2);
                ctx.fill();
                ctx.stroke();

                // Wood grain lines on body
                ctx.strokeStyle = 'rgba(0,0,0,0.22)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-17, 4); ctx.lineTo(17, 4);
                ctx.moveTo(-17, 8); ctx.lineTo(17, 8);
                ctx.stroke();

                // Lid (curved wood top)
                const lidGrad = ctx.createLinearGradient(0, -14, 0, -1);
                lidGrad.addColorStop(0, '#92400e'); // rich warm wood highlight
                lidGrad.addColorStop(0.48, palette.lid);
                lidGrad.addColorStop(1, palette.body);
                ctx.fillStyle = lidGrad;
                ctx.strokeStyle = '#1a0802';
                ctx.lineWidth = 2.2;
                roundRect(ctx, -20, -14, 40, 13, 3);
                ctx.fill();
                ctx.stroke();

                // Wood grain lines on lid
                ctx.strokeStyle = 'rgba(0,0,0,0.18)';
                ctx.beginPath();
                ctx.moveTo(-19, -9); ctx.lineTo(19, -9);
                ctx.moveTo(-19, -5); ctx.lineTo(19, -5);
                ctx.stroke();

                // Dark rusty iron bands
                ctx.fillStyle = '#374151';
                ctx.fillRect(-13, -14, 4, 26);
                ctx.fillRect(9, -14, 4, 26);
                ctx.strokeStyle = '#111827';
                ctx.lineWidth = 1;
                ctx.strokeRect(-13, -14, 4, 26);
                ctx.strokeRect(9, -14, 4, 26);

                // Lid dividing trim
                ctx.fillStyle = '#5c3116';
                roundRect(ctx, -20.5, -1.5, 41, 2.5, 1);
                ctx.fill();
                ctx.stroke();

                // Brass Lock hasp & padlock
                ctx.fillStyle = palette.trim; // Golden brass
                roundRect(ctx, -4, -3, 8, 8, 2);
                ctx.fill();
                ctx.stroke();
                // Keyhole
                ctx.fillStyle = '#111827';
                ctx.fillRect(-0.8, 0, 1.6, 4);
                ctx.beginPath();
                ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        } else {
            ctx.fillStyle = 'rgba(6, 9, 7, 0.34)';
            ctx.beginPath();
            ctx.ellipse(0, 10, 18, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            const groundGlow = ctx.createRadialGradient(0, 0, 3, 0, 0, 25);
            groundGlow.addColorStop(0, color + '38');
            groundGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = groundGlow;
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.translate(0, -2);
            ctx.fillStyle = color;
            ctx.strokeStyle = 'rgba(8, 11, 9, 0.9)';
            ctx.lineWidth = 1.8;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;

            if (l.type === 'weapon') {
                if (l.weaponType === 'pistol') {
                    // M9 Pistol
                    ctx.rotate(-0.22);

                    // Gunmetal gray slide
                    ctx.fillStyle = '#4b5563';
                    roundRect(ctx, -6, -4, 14, 4.5, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Grip
                    ctx.save();
                    ctx.translate(-3, 0);
                    ctx.rotate(0.35);
                    ctx.fillStyle = '#1f2937';
                    roundRect(ctx, -2, 0, 4.5, 8.5, 1.2);
                    ctx.fill();
                    ctx.stroke();

                    // Tan grip panel
                    ctx.fillStyle = '#a16207';
                    roundRect(ctx, -1, 1.5, 2.5, 5.5, 0.8);
                    ctx.fill();
                    ctx.restore();

                    // Trigger guard
                    ctx.strokeStyle = 'rgba(8, 11, 9, 0.95)';
                    ctx.beginPath();
                    ctx.arc(0.5, 1.2, 2.2, 0, Math.PI * 2);
                    ctx.stroke();

                    // Barrel tip
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(8, -3, 2, 2.5);
                } else if (l.weaponType === 'revolver') {
                    // R8 Revolver
                    ctx.rotate(-0.15);

                    // Steel cylinder
                    ctx.fillStyle = '#9ca3af';
                    ctx.beginPath();
                    ctx.ellipse(-1, -1.5, 4.2, 4.2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    // Cylinder detail
                    ctx.fillStyle = '#374151';
                    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
                        ctx.beginPath();
                        ctx.arc(-1 + Math.cos(a) * 2.2, -1.5 + Math.sin(a) * 2.2, 0.9, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // Steel frame
                    ctx.fillStyle = '#cbd5e1';
                    roundRect(ctx, -6, -3.8, 8, 4, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Long barrel
                    roundRect(ctx, 2, -3.8, 12, 3, 0.8);
                    ctx.fill();
                    ctx.stroke();

                    // Ejector rod
                    ctx.fillStyle = '#4b5563';
                    ctx.fillRect(3, -0.8, 8, 1);

                    // Wooden grip
                    ctx.save();
                    ctx.translate(-4, 0);
                    ctx.rotate(0.55);
                    ctx.fillStyle = '#7c2d12'; // Mahogany wood
                    roundRect(ctx, -2.2, 1, 4.5, 9, 1.8);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                } else if (l.weaponType === 'smg') {
                    // Vector SMG
                    ctx.rotate(-0.25);

                    // Skeletal stock
                    ctx.fillStyle = '#1f2937';
                    ctx.beginPath();
                    ctx.moveTo(-9, -2);
                    ctx.lineTo(-18, -4);
                    ctx.lineTo(-18, 4);
                    ctx.lineTo(-14, 2);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Main receiver
                    ctx.fillStyle = '#374151';
                    roundRect(ctx, -9, -5.5, 18, 9.5, 2);
                    ctx.fill();
                    ctx.stroke();

                    // Muzzle shroud
                    ctx.fillStyle = '#111827';
                    roundRect(ctx, 9, -3.5, 7, 3, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Curved magazine
                    ctx.save();
                    ctx.translate(1, 4);
                    ctx.rotate(-0.2);
                    ctx.fillStyle = '#111827';
                    roundRect(ctx, -2, 0, 3.8, 11, 1);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();

                    // Pistol grip
                    ctx.save();
                    ctx.translate(-5, 3.5);
                    ctx.rotate(0.4);
                    ctx.fillStyle = '#1f2937';
                    roundRect(ctx, -2, 0, 4, 7, 1);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                } else if (l.weaponType === 'shotgun') {
                    // Pump Shotgun
                    ctx.rotate(-0.18);

                    // Wooden Stock
                    ctx.fillStyle = '#78350f';
                    ctx.beginPath();
                    ctx.moveTo(-14, -2);
                    ctx.lineTo(-24, 0);
                    ctx.lineTo(-24, 6);
                    ctx.lineTo(-14, 3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Steel Receiver
                    ctx.fillStyle = '#4b5563';
                    roundRect(ctx, -14, -3.5, 14, 6.5, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Long dual barrel tube
                    ctx.fillStyle = '#1f2937';
                    ctx.fillRect(0, -3, 23, 2.5); // Barrel
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(0, -0.5, 21, 2.2); // Mag tube

                    // Wooden slide pump
                    ctx.fillStyle = '#92400e';
                    roundRect(ctx, 1, 1, 9, 3.5, 1);
                    ctx.fill();
                    ctx.stroke();
                } else if (l.weaponType === 'assault') {
                    // Scout Rifle
                    ctx.rotate(-0.2);

                    // Composite stock
                    ctx.fillStyle = '#273024';
                    ctx.beginPath();
                    ctx.moveTo(-13, -2);
                    ctx.lineTo(-22, -1);
                    ctx.lineTo(-22, 6);
                    ctx.lineTo(-13, 3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Receiver
                    ctx.fillStyle = '#374151';
                    roundRect(ctx, -13, -4.2, 18, 7.5, 1.5);
                    ctx.fill();
                    ctx.stroke();

                    // Green handguard
                    ctx.fillStyle = '#273024';
                    roundRect(ctx, 5, -3.5, 10, 5.5, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Barrel & muzzle
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(15, -2.5, 15, 2.2);
                    ctx.fillRect(29, -3.5, 2.5, 4.2);

                    // Curved magazine
                    ctx.save();
                    ctx.translate(1.5, 3.3);
                    ctx.rotate(-0.12);
                    ctx.fillStyle = '#111827';
                    roundRect(ctx, -2, 0, 4, 8, 1);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();

                    // Scope
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(-5, -6.8, 10, 2.6); // Scope body
                    ctx.fillRect(-6, -7.8, 1.8, 4.6);
                    ctx.fillRect(3.5, -7.8, 1.8, 4.6);
                } else if (l.weaponType === 'dmr') {
                    // Falcon DMR
                    ctx.rotate(-0.18);

                    // Tan Crane stock
                    ctx.fillStyle = '#b45309';
                    ctx.beginPath();
                    ctx.moveTo(-14, -2.5);
                    ctx.lineTo(-24, -1.5);
                    ctx.lineTo(-24, 6);
                    ctx.lineTo(-17, 5);
                    ctx.lineTo(-14, 3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Tan Receiver
                    ctx.fillStyle = '#d97706';
                    roundRect(ctx, -14, -4.5, 20, 8.2, 1.5);
                    ctx.fill();
                    ctx.stroke();

                    // Tan Handguard
                    ctx.fillStyle = '#b45309';
                    roundRect(ctx, 6, -4, 12, 7, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Long precision barrel
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(18, -2.5, 18, 2.2);
                    ctx.fillRect(35, -3.5, 3, 4.2);

                    // Bipod (folded)
                    ctx.fillStyle = '#6b7280';
                    ctx.fillRect(12, 3, 11, 1.5);

                    // Straight magazine
                    ctx.fillStyle = '#111827';

                    ctx.fillRect(0, 3.7, 4.5, 8.5);
                    ctx.stroke();

                    // Large sniper scope
                    ctx.fillStyle = '#1f2937';
                    ctx.fillRect(-7, -8, 12, 3.5);
                    ctx.fillRect(-8.5, -9, 2, 5.5);
                    ctx.fillRect(3.5, -9, 2, 5.5);
                    ctx.fillStyle = '#3b82f6'; // lens reflect
                    ctx.fillRect(-8, -8.5, 1, 4.5);
                } else if (l.weaponType === 'sniper') {
                    // AWM Sniper
                    ctx.rotate(-0.2);

                    // Olive stock
                    ctx.fillStyle = '#166534';
                    ctx.beginPath();
                    ctx.moveTo(-16, -3);
                    ctx.lineTo(-28, -1);
                    ctx.lineTo(-28, 6.5);
                    ctx.lineTo(-19, 5);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Thumbhole cut
                    ctx.fillStyle = 'rgba(8, 11, 9, 0.9)';
                    ctx.beginPath();
                    ctx.ellipse(-23, 2, 2.5, 1.8, 0, 0, Math.PI * 2);
                    ctx.fill();

                    // Long Receiver (Olive green)
                    ctx.fillStyle = '#166534';
                    roundRect(ctx, -16, -4.5, 22, 9, 2);
                    ctx.fill();
                    ctx.stroke();

                    // Handguard shroud
                    roundRect(ctx, 6, -4, 11, 7, 1);
                    ctx.fill();
                    ctx.stroke();

                    // Ultra long Match Barrel
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(17, -2.5, 24, 2.5);
                    ctx.fillRect(40, -4, 4, 5.5);

                    // Bolt handle
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillRect(-8, -7.5, 2, 3);
                    ctx.beginPath();
                    ctx.arc(-7, -7.5, 1.5, 0, Math.PI * 2);
                    ctx.fill();

                    // Box magazine
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(-1, 4.5, 5.5, 6);
                    ctx.stroke();

                    // Sniper scope
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(-9, -9.5, 16, 4.2);
                    ctx.fillRect(-11, -11, 2.5, 7.2);
                    ctx.fillRect(5, -11, 2.5, 7.2);
                    ctx.fillStyle = '#60a5fa'; // lens glint
                    ctx.fillRect(-10.2, -10.3, 1, 5.8);
                } else if (l.weaponType === 'lmg') {
                    // M249 LMG
                    ctx.rotate(-0.16);

                    // Skeletal stock
                    ctx.strokeStyle = 'rgba(8, 11, 9, 0.9)';
                    ctx.lineWidth = 2.2;
                    ctx.beginPath();
                    ctx.moveTo(-12, -2.5);
                    ctx.lineTo(-24, -1);
                    ctx.lineTo(-24, 7);
                    ctx.lineTo(-16, 4);
                    ctx.closePath();
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(-16, 1);
                    ctx.lineTo(-24, 3);
                    ctx.stroke();

                    // Heavy Receiver
                    ctx.fillStyle = '#4b5563';
                    roundRect(ctx, -12, -5.8, 20, 10.5, 2);
                    ctx.fill();
                    ctx.stroke();

                    // Green handguard heat shield
                    ctx.fillStyle = '#3f4f39';
                    roundRect(ctx, 8, -5, 12, 8.5, 1.5);
                    ctx.fill();
                    ctx.stroke();

                    // Heavy barrel
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(20, -3.2, 14, 3.2);
                    ctx.fillRect(34, -4.2, 3, 5.2);

                    // Carry handle
                    ctx.beginPath();
                    ctx.arc(3, -7.5, 3.5, Math.PI, 0);
                    ctx.stroke();

                    // Folded bipod
                    ctx.fillStyle = '#4b5563';
                    ctx.fillRect(10, 3.5, 15, 1.8);

                    // Ammo Box Magazine
                    ctx.fillStyle = '#2c3727';
                    roundRect(ctx, -2.5, 4.7, 10.5, 11.5, 2);
                    ctx.fill();
                    ctx.stroke();

                    // Gold ammo links
                    ctx.fillStyle = '#eab308';
                    ctx.fillRect(-2, 2.5, 2, 4);
                    ctx.fillRect(0, 1.5, 2, 4);
                } else {
                    // Fallback
                    ctx.rotate(-0.22);
                    roundRect(ctx, -15, -5, 22, 9, 2);
                    ctx.fill();
                    ctx.stroke();
                }
            } else if (l.type === 'grenade') {
                ctx.fillStyle = '#334155';
                ctx.beginPath();
                ctx.arc(0, 2, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#f59e0b';
                roundRect(ctx, -4, -11, 8, 6, 2);
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = '#fef3c7';
                ctx.beginPath();
                ctx.moveTo(0, -11); ctx.lineTo(5, -16); ctx.lineTo(9, -14);
                ctx.stroke();
            } else if (l.type === 'medkit') {
                roundRect(ctx, -11, -10, 22, 20, 4);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#f5f7ef';
                roundRect(ctx, -2, -7, 4, 14, 1);
                ctx.fill();
                roundRect(ctx, -7, -2, 14, 4, 1);
                ctx.fill();
            } else if (l.type === 'armor') {
                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(11, -7);
                ctx.lineTo(8, 8);
                ctx.lineTo(0, 14);
                ctx.lineTo(-8, 8);
                ctx.lineTo(-11, -7);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.42)';
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(0, 9);
                ctx.stroke();
            } else if (l.type === 'ammo') {
                roundRect(ctx, -12, -9, 24, 18, 4);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#6f684f';
                for (const x of [-6, 0, 6]) {
                    roundRect(ctx, x - 2, -6, 4, 11, 2);
                    ctx.fill();
                }
            } else {
                ctx.fillStyle = '#e5ba3d';
                ctx.beginPath();
                ctx.ellipse(-3, 2, 9, 7, -0.18, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(4, -3, 9, 7, 0.12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#6f5310';
                ctx.font = '900 9px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('$', 4, -3);
            }
            ctx.restore();

            const amount = l.type === 'armor' ? l.armorValue : l.amount;
            if ((Number(amount) || 0) > 1) {
                ctx.fillStyle = 'rgba(8, 10, 9, 0.9)';
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 1;
                roundRect(ctx, 8, -17, 19, 12, 4);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ffffff';
                ctx.font = '800 8px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`x${Math.round(amount)}`, 17.5, -11);
            }

            // Weapon name label below ground loot
            if (l.type === 'weapon' && l.weaponType) {
                const wLabel = WEAPON_LABELS[l.weaponType] || l.weaponType;
                ctx.fillStyle = 'rgba(8, 10, 9, 0.82)';
                ctx.strokeStyle = color + '55';
                ctx.lineWidth = 1;
                const labelW = Math.max(50, wLabel.length * 6 + 14);
                roundRect(ctx, -labelW / 2, 18, labelW, 14, 3);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = color;
                ctx.font = '800 8px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(wLabel, 0, 25);
            }

            // Proximity interaction ring when player is near
            if (this.me) {
                const dist = Math.hypot(this.me.x - l.x, this.me.y - l.y);
                if (dist < 60) {
                    const proximity = clamp(1 - dist / 60, 0, 1);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${proximity * 0.5})`;
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.lineDashOffset = -(this._frameNow / 60) % 8;
                    ctx.beginPath();
                    ctx.arc(0, 0, 22, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    if (l.type === 'weapon') {
                        ctx.fillStyle = 'rgba(8, 10, 9, 0.92)';
                        roundRect(ctx, -34, 35, 68, 16, 4);
                        ctx.fill();
                        ctx.fillStyle = '#ffffff';
                        ctx.font = '900 9px system-ui, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(this.me.weapon === 'fists' ? 'F  PICK UP' : 'F  SWAP', 0, 43);
                    }
                }
            }
        }
        ctx.restore();
    }

    initBulletGradients(ctx) {
        this.bulletGradients = {};
        for (const [wt, spec] of Object.entries(WEAPON_BULLET_SPECS)) {
            const { trailLen, slugLen } = spec;

            // 1. Glow Gradient
            const glowGrad = ctx.createLinearGradient(-trailLen, 0, slugLen, 0);
            glowGrad.addColorStop(0, spec.glowColorStart);
            glowGrad.addColorStop(0.35, spec.glowColorMid);
            glowGrad.addColorStop(0.75, spec.glowColorEnd);
            glowGrad.addColorStop(1, spec.glowColorTip);

            // 2. Core Gradient
            const coreGrad = ctx.createLinearGradient(-trailLen * 0.75, 0, slugLen, 0);
            coreGrad.addColorStop(0, spec.coreColorStart);
            coreGrad.addColorStop(0.45, spec.coreColorMid);
            coreGrad.addColorStop(0.85, spec.coreColorEnd);
            coreGrad.addColorStop(1, '#ffffff');

            this.bulletGradients[wt] = { glowGrad, coreGrad };
        }
    }

    drawBullet(ctx, b) {
        if (b.isGrenade || b.weaponType === 'grenade') {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(Math.atan2(b.vy || 0, b.vx || 1));
            ctx.fillStyle = '#374151';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-2, -8, 5, 4);
            ctx.restore();
            return;
        }
        const angle = Math.atan2(b.vy || 0, b.vx || 1);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);

        // Initialize bullet gradients lazily
        if (!this.bulletGradients) {
            this.initBulletGradients(ctx);
        }

        const wt = b.weaponType;
        const spec = WEAPON_BULLET_SPECS[wt] || WEAPON_BULLET_SPECS.default;
        const grads = this.bulletGradients[wt] || this.bulletGradients.default;

        ctx.lineCap = 'round';

        // 1. Outer motion-blur glow (wide stroke)
        ctx.beginPath();
        ctx.strokeStyle = grads.glowGrad;
        ctx.lineWidth = spec.thickness * 2.2;
        ctx.moveTo(-spec.trailLen, 0);
        ctx.lineTo(spec.slugLen, 0);
        ctx.stroke();

        // 2. Inner sharp bullet core (narrower stroke)
        ctx.beginPath();
        ctx.strokeStyle = grads.coreGrad;
        ctx.lineWidth = spec.thickness;
        ctx.moveTo(-spec.trailLen * 0.75, 0);
        ctx.lineTo(spec.slugLen, 0);
        ctx.stroke();

        ctx.restore();
    }

    drawDeathMarkers(ctx, currentHouse) {
        const now = this._frameNow;
        for (const marker of this.deathMarkers) {
            if (!this.isPointInView(marker.x, marker.y, 80)) continue;
            const markerHouse = this.findHouseContainingPoint(marker.x, marker.y);
            if (markerHouse && (!currentHouse || markerHouse.id !== currentHouse.id)) continue;

            const firstSeenAt = this._graveFirstSeenAt.get(marker.id) || now;
            const intro = clamp((now - firstSeenAt) / 380, 0, 1);
            const eased = 1 - Math.pow(1 - intro, 3);
            const age = Math.max(0, now - (marker.createdAt || firstSeenAt));
            const fade = age > 25000 ? clamp(1 - (age - 25000) / 5000, 0, 1) : 1;
            if (fade <= 0) continue;

            ctx.save();
            ctx.translate(marker.x, marker.y + (1 - eased) * 18);
            ctx.scale(0.72 + eased * 0.28, 0.72 + eased * 0.28);
            ctx.globalAlpha = fade;

            ctx.fillStyle = 'rgba(12, 15, 13, 0.3)';
            ctx.beginPath();
            ctx.ellipse(0, 10, 19, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4a4038';
            ctx.beginPath();
            ctx.ellipse(0, 8, 15, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowColor = 'rgba(0,0,0,0.34)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = '#737b7d';
            ctx.strokeStyle = '#343b3d';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 8);
            ctx.lineTo(-9, -11);
            ctx.quadraticCurveTo(-9, -22, 0, -24);
            ctx.quadraticCurveTo(9, -22, 9, -11);
            ctx.lineTo(10, 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = 'rgba(230,235,232,0.72)';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(0, -17);
            ctx.lineTo(0, -5);
            ctx.moveTo(-5, -12);
            ctx.lineTo(5, -12);
            ctx.stroke();

            ctx.fillStyle = 'rgba(235,240,237,0.82)';
            ctx.font = '800 7px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('RIP', 0, 1);
            ctx.restore();
        }
    }
    drawPlayer(ctx, p) {
        const r = 14;
        const isMe = p.isYou || p.id === this.myId;
        const knocked = p.hp <= 0;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.globalAlpha = knocked ? 0.45 : 1;

        // Weapon switch animation (scale bounce)
        if (isMe && this._weaponSwitchT > 0) {
            const s = 1 - Math.sin(this._weaponSwitchT * Math.PI) * 0.15;
            ctx.scale(s, s);
        }

        // Shadow — cheap opaque ellipse instead of expensive shadowBlur
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 5, r * 0.85, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body circle — surviv.io style thick outline
        ctx.fillStyle = p.color || '#77c7c8';
        ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(14, 20, 18, 0.78)';
        ctx.lineWidth = isMe ? 3.5 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Body highlight
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(-3, -4, r * 0.32, 0, Math.PI * 2);
        ctx.fill();

        // Darker rim at bottom
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.arc(0, 3, r * 0.7, 0.3, Math.PI - 0.3);
        ctx.fill();

        this.drawWeapon(ctx, p.weapon, r, p.meleeStartedAt, p.meleeUntil, p.color, p.walkBob || 0, p.meleeHand);

        // Muzzle flash on self
        if (isMe && this._muzzleFlash > 0.1) {
            const barrelDist = p.weapon === 'sniper' ? r * 2.2 : p.weapon === 'shotgun' ? r * 1.5 : r * 1.1;
            ctx.save();
            ctx.globalAlpha = this._muzzleFlash * 0.9;
            const flashGrad = ctx.createRadialGradient(barrelDist, 0, 1, barrelDist, 0, 12);
            flashGrad.addColorStop(0, '#ffffff');
            flashGrad.addColorStop(0.3, '#ffee88');
            flashGrad.addColorStop(0.7, '#ff8800');
            flashGrad.addColorStop(1, 'rgba(255, 136, 0, 0)');
            ctx.fillStyle = flashGrad;
            ctx.beginPath();
            ctx.arc(barrelDist, 0, 12, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // Reload progress ring near weapon
        if (p.reloading && p.reloadEndAtLocal && p.reloadMs && p.reloadEndAtLocal > this._frameNow) {
            const progress = clamp(1 - (p.reloadEndAtLocal - this._frameNow) / p.reloadMs, 0, 1);
            if (progress > 0 && progress < 1) {
                const ringX = r + 12;
                const ringY = -12;
                const ringRadius = 6;
                const ringLineWidth = 2.2;
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle + progress * Math.PI * 2;

                ctx.save();
                ctx.lineCap = 'round';

                // Track
                ctx.beginPath();
                ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
                ctx.lineWidth = ringLineWidth;
                ctx.stroke();

                // Progress
                ctx.beginPath();
                ctx.arc(ringX, ringY, ringRadius, startAngle, endAngle);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = ringLineWidth;
                ctx.stroke();

                ctx.restore();
            }
        }

        ctx.restore();


        const hpPct = clamp((p.hp || 0) / (p.maxHp || 100), 0, 1);
        const barW = 36;
        const barY = p.y - r - 15;
        ctx.fillStyle = 'rgba(10,14,12,0.62)';
        roundRect(ctx, p.x - barW / 2, barY, barW, 5, 2);
        ctx.fill();
        ctx.fillStyle = hpPct > 0.35 ? '#55d875' : '#ef544f';
        roundRect(ctx, p.x - barW / 2, barY, barW * hpPct, 5, 2);
        ctx.fill();
        if (p.armor > 0) {
            ctx.fillStyle = '#65a4ff';
            roundRect(ctx, p.x - barW / 2, barY + 7, barW * clamp(p.armor / 100, 0, 1), 3, 1.5);
            ctx.fill();
        }

        if (!this.hideNames || isMe) {
            ctx.fillStyle = isMe ? '#ffffff' : 'rgba(255,255,255,0.86)';
            ctx.font = '700 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.strokeText(p.username || 'Player', p.x, p.y - r - 20);
            ctx.fillText(p.username || 'Player', p.x, p.y - r - 20);
        }

        if (isMe) {
            drawBalanceBadge(ctx, p.x, p.y + r + 15, this.hud.balance ?? p.dollarBalance ?? 0, true);
            if (this.hud.cashoutEndAt > this._frameNow) {
                const total = this.hud.cashoutTotal || 10;
                const left = Math.max(0, (this.hud.cashoutEndAt - this._frameNow) / 1000);
                const progress = 1 - left / total;
                drawCashoutProgressRing(ctx, p.x, p.y, r + 12, progress, { counterClockwise: true });
            }
        }
    }

    drawWeapon(ctx, weapon, r, meleeStartedAt = 0, meleeUntil = 0, playerColor = '#77c7c8', walkBob = 0, meleeHand = 'top') {
        ctx.fillStyle = '#222823';
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;

        let hands = null;

        if (weapon === 'fists') {
            const now = this._frameNow;
            const punching = meleeUntil > now && meleeStartedAt > 0;
            const duration = Math.max(1, meleeUntil - meleeStartedAt);
            const progress = punching ? clamp((now - meleeStartedAt) / duration, 0, 1) : 0;
            const thrust = punching ? Math.sin(progress * Math.PI) : 0;
            const leadTop = meleeHand !== 'bottom';

            // Keep one fist planted while the other punches; each melee attack
            // alternates hands on the server so it reads as one clean swing.
            const idleReach = r * 0.76;
            const punchReach = idleReach + r * 0.98 * thrust;
            const topReach = leadTop ? punchReach : idleReach;
            const bottomReach = leadTop ? idleReach : punchReach;

            if (punching && thrust > 0.12) {
                ctx.save();
                ctx.globalAlpha = thrust * 0.48;
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(r * 0.66, leadTop ? -7 : 7, r * (0.72 + thrust * 0.35), -0.5, 0.5);
                ctx.stroke();
                ctx.restore();
            }

            ctx.strokeStyle = 'rgba(14, 20, 18, 0.78)';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(r * 0.3, -6);
            ctx.lineTo(topReach, -6);
            ctx.moveTo(r * 0.3, 6);
            ctx.lineTo(bottomReach, 6);
            ctx.stroke();
            ctx.fillStyle = playerColor;
            ctx.strokeStyle = 'rgba(255,255,255,0.34)';
            ctx.lineWidth = punching ? 2 : 1.5;
            for (const hand of [{ x: topReach, y: -6 }, { x: bottomReach, y: 6 }]) {
                ctx.beginPath();
                ctx.arc(hand.x, hand.y, punching ? 6.2 : 5.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            return;
        }

        if (weapon === 'knife') {
            const now = this._frameNow;
            const swinging = meleeUntil > now && meleeStartedAt > 0;
            const duration = Math.max(1, meleeUntil - meleeStartedAt);
            const progress = swinging ? clamp((now - meleeStartedAt) / duration, 0, 1) : 0;
            const swing = swinging ? Math.sin(progress * Math.PI) : 0;
            ctx.save();
            ctx.rotate(-0.35 + swing * 0.95);
            ctx.strokeStyle = '#dbeafe';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(r * 0.28, 1);
            ctx.lineTo(r * 1.5, -2);
            ctx.stroke();
            ctx.strokeStyle = '#7c4a21';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(r * 0.15, 2);
            ctx.lineTo(r * 0.43, 1);
            ctx.stroke();
            ctx.fillStyle = playerColor;
            ctx.beginPath();
            ctx.arc(r * 0.12, 5, 5.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        // Apply a gentle walk-bob sway to gun weapons & hands
        const bobAngle = walkBob * 0.055;
        const bobX = Math.abs(walkBob) * 0.7;
        ctx.save();
        ctx.translate(bobX, 0);
        ctx.rotate(bobAngle);

        if (weapon === 'shotgun') {
            roundRect(ctx, r * 0.25, -3, r * 1.35, 6, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#8c5b2f';
            ctx.fillRect(r * 0.3, 2, 10, 4);
            hands = [{ x: r * 0.4, y: -4.5 }, { x: r * 1.1, y: 4.5 }];
        } else if (weapon === 'smg') {
            roundRect(ctx, r * 0.2, -4, r * 1.0, 8, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillRect(r * 0.68, 3, 5, 8);
            hands = [{ x: r * 0.35, y: -4.5 }, { x: r * 0.9, y: 4.5 }];
        } else if (weapon === 'assault' || weapon === 'dmr') {
            roundRect(ctx, r * 0.2, -4, r * (weapon === 'dmr' ? 1.8 : 1.55), 8, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillRect(r * 0.58, 3, 7, 9);
            if (weapon === 'dmr') ctx.fillRect(r * 1.25, -8, 10, 3);
            hands = [{ x: r * 0.4, y: -5 }, { x: r * (weapon === 'dmr' ? 1.35 : 1.2), y: 5 }];
        } else if (weapon === 'sniper') {
            roundRect(ctx, r * 0.16, -3, r * 2.05, 6, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#4a545a';
            ctx.fillRect(r * 0.65, -9, 18, 4);
            hands = [{ x: r * 0.35, y: -4.5 }, { x: r * 1.45, y: 4.5 }];
        } else if (weapon === 'lmg') {
            roundRect(ctx, r * 0.12, -5, r * 1.75, 10, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillRect(r * 0.5, 5, 12, 10);
            ctx.fillRect(r * 1.22, -2, 16, 4);
            hands = [{ x: r * 0.35, y: -5.5 }, { x: r * 1.3, y: 5.5 }];
        } else if (weapon === 'revolver') {
            roundRect(ctx, r * 0.22, -3, r * 0.98, 6, 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(r * 0.42, 0, 5, 0, Math.PI * 2);
            ctx.stroke();
            hands = [{ x: r * 0.45, y: -4.5 }, { x: r * 0.55, y: 4.5 }];
        } else if (weapon === 'pistol') {
            roundRect(ctx, r * 0.25, -3, r * 0.82, 6, 2);
            ctx.fill();
            ctx.stroke();
            hands = [{ x: r * 0.45, y: -4.5 }, { x: r * 0.55, y: 4.5 }];
        } else {
            roundRect(ctx, r * 0.25, -3, r * 0.82, 6, 2);
            ctx.fill();
            ctx.stroke();
            hands = [{ x: r * 0.4, y: -4.5 }, { x: r * 0.8, y: 4.5 }];
        }

        // Draw hands gripping the gun (two-handed/one-handed)
        if (weapon !== 'fists' && hands) {
            ctx.fillStyle = playerColor;
            ctx.strokeStyle = 'rgba(14, 20, 18, 0.78)';
            ctx.lineWidth = 1.8;
            for (const hand of hands) {
                ctx.beginPath();
                ctx.arc(hand.x, hand.y, 5.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    drawMobileAimGuide(ctx) {
        if (!this.inputEnabled || this.spectatorMode || !this.mobileAim.active) return;
        const x = this.viewW / 2;
        const y = this.viewH / 2;
        const angle = this.mobileAim.angle;
        const length = Math.min(150, Math.max(88, Math.min(this.viewW, this.viewH) * 0.3));
        const start = 24;
        const endX = x + Math.cos(angle) * length;
        const endY = y + Math.sin(angle) * length;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.setLineDash([8, 7]);
        ctx.strokeStyle = this.mobileAim.shooting ? 'rgba(255, 116, 102, 0.82)' : 'rgba(255, 255, 255, 0.58)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * start, y + Math.sin(angle) * start);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = this.mobileAim.shooting ? '#ff7466' : 'rgba(255,255,255,0.82)';
        ctx.beginPath();
        ctx.arc(endX, endY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    drawCrosshair(ctx) {
        if (!this.inputEnabled || this.spectatorMode || this.mobileAim.active) return;
        const x = this.mouse.x || this.viewW / 2;
        const y = this.mouse.y || this.viewH / 2;
        ctx.save();
        ctx.strokeStyle = this.hoveredChestId ? 'rgba(245, 207, 122, 0.95)' : this.mouse.down ? 'rgba(255, 226, 122, 0.9)' : 'rgba(255,255,255,0.72)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.moveTo(x - 16, y);
        ctx.lineTo(x - 7, y);
        ctx.moveTo(x + 7, y);
        ctx.lineTo(x + 16, y);
        ctx.moveTo(x, y - 16);
        ctx.lineTo(x, y - 7);
        ctx.moveTo(x, y + 7);
        ctx.lineTo(x, y + 16);
        ctx.stroke();
        ctx.restore();
    }

    drawHouseRoof(ctx, o, allowCache = true) {
        if (allowCache && this.drawCachedHouseRoof(ctx, o)) return;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);

        const variant = o.variant || 'house';
        const hw = o.w / 2;
        const hh = o.h / 2;

        // Drop shadow for the entire roof
        ctx.shadowColor = 'rgba(10, 14, 10, 0.45)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = 'rgba(15, 12, 10, 0.6)';
        roundRect(ctx, -hw - 10, -hh - 8, o.w + 20, o.h + 18, 9);
        ctx.fill();
        ctx.shadowBlur = 0; // Turn off shadows for interior details
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        if (variant === 'ironworks') {
            // --- IRONWORKS: giant saw-tooth steel roof for the indoor PvP landmark ---
            const roofGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            roofGrad.addColorStop(0, '#536168');
            roofGrad.addColorStop(0.48, '#283238');
            roofGrad.addColorStop(1, '#46545b');
            ctx.fillStyle = roofGrad;
            roundRect(ctx, -hw - 5, -hh - 5, o.w + 10, o.h + 10, 8);
            ctx.fill();

            ctx.save();
            roundRect(ctx, -hw - 2, -hh - 2, o.w + 4, o.h + 4, 6);
            ctx.clip();
            const bayCount = 5;
            const bayW = o.w / bayCount;
            for (let bay = 0; bay < bayCount; bay++) {
                const bx = -hw + bay * bayW;
                ctx.fillStyle = bay % 2 === 0 ? 'rgba(167, 190, 198, 0.08)' : 'rgba(4, 9, 12, 0.13)';
                ctx.fillRect(bx, -hh, bayW, o.h);
                ctx.strokeStyle = 'rgba(8, 14, 18, 0.48)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(bx, -hh);
                ctx.lineTo(bx, hh);
                ctx.stroke();

                if (bay % 2 === 0) {
                    const skyW = Math.max(42, bayW * 0.24);
                    ctx.fillStyle = 'rgba(72, 139, 158, 0.58)';
                    roundRect(ctx, bx + bayW / 2 - skyW / 2, -hh * 0.72, skyW, o.h * 0.54, 4);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(12, 28, 34, 0.82)';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    ctx.strokeStyle = 'rgba(205, 235, 240, 0.18)';
                    ctx.lineWidth = 1.5;
                    for (let sy = -hh * 0.58; sy < -hh * 0.18; sy += 42) {
                        ctx.beginPath();
                        ctx.moveTo(bx + bayW / 2 - skyW / 2 + 4, sy);
                        ctx.lineTo(bx + bayW / 2 + skyW / 2 - 4, sy);
                        ctx.stroke();
                    }
                }
            }

            // Static vents, exhaust stacks and deterministic rust keep the roof alive
            // without adding animation work to every frame.
            const stackPositions = [
                [-0.39, -0.34], [-0.13, 0.31], [0.13, -0.30], [0.39, 0.33],
            ];
            for (const [sx, sy] of stackPositions) {
                const px = hw * sx * 2;
                const py = hh * sy * 2;
                ctx.fillStyle = 'rgba(0,0,0,0.34)';
                ctx.beginPath();
                ctx.arc(px + 6, py + 7, 20, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#718087';
                ctx.strokeStyle = '#1b252a';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(px, py, 19, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#121a1e';
                ctx.beginPath();
                ctx.arc(px, py, 10, 0, Math.PI * 2);
                ctx.fill();
            }

            for (let i = 0; i < 12; i++) {
                const rx = -hw + seededNoise(o.x * 0.01 + i, 17) * o.w;
                const ry = -hh + seededNoise(o.y * 0.01 + i, 41) * o.h;
                ctx.fillStyle = 'rgba(126, 64, 35, 0.16)';
                ctx.beginPath();
                ctx.arc(rx, ry, 10 + seededNoise(i, 7) * 22, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            ctx.strokeStyle = '#111a1f';
            ctx.lineWidth = 7;
            roundRect(ctx, -hw - 5, -hh - 5, o.w + 10, o.h + 10, 8);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(207, 224, 229, 0.20)';
            ctx.lineWidth = 2;
            roundRect(ctx, -hw + 5, -hh + 5, o.w - 10, o.h - 10, 5);
            ctx.stroke();

            ctx.save();
            ctx.fillStyle = 'rgba(9, 15, 18, 0.66)';
            roundRect(ctx, -170, -32, 340, 64, 7);
            ctx.fill();
            ctx.strokeStyle = 'rgba(232, 174, 48, 0.72)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = 'rgba(226, 235, 236, 0.90)';
            ctx.font = '900 30px ui-sans-serif, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(o.label || 'IRONWORKS', 0, 1);
            ctx.restore();
        } else if (variant === 'warehouse') {
            // --- WAREHOUSE: Corrugated sheet metal roof ---
            const mainColor = '#5c6b73';
            const shadowColor = '#3a444a';
            const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            grad.addColorStop(0, mainColor);
            grad.addColorStop(0.5, shadowColor);
            grad.addColorStop(1, mainColor);
            ctx.fillStyle = grad;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 6);
            ctx.fill();

            // Corrugation seams (vertical sheets)
            ctx.lineWidth = 1.5;
            const seamStep = 24;
            for (let xx = -hw + 6; xx < hw - 6; xx += seamStep) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
                ctx.beginPath();
                ctx.moveTo(xx, -hh - 2);
                ctx.lineTo(xx, hh + 2);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.beginPath();
                ctx.moveTo(xx + 1.5, -hh - 2);
                ctx.lineTo(xx + 1.5, hh + 2);
                ctx.stroke();
            }

            // Rust patches (grunge)
            const rustSpots = [
                { x: -hw * 0.4, y: -hh * 0.5, r: 24 },
                { x: hw * 0.55, y: hh * 0.3, r: 32 },
                { x: -hw * 0.6, y: hh * 0.4, r: 18 }
            ];
            rustSpots.forEach(s => {
                const rx = s.x;
                const ry = s.y;
                const rr = Math.min(s.r, o.w * 0.15, o.h * 0.15);
                if (rr > 5) {
                    const rustGrad = ctx.createRadialGradient(rx, ry, rr * 0.1, rx, ry, rr);
                    rustGrad.addColorStop(0, 'rgba(142, 78, 48, 0.22)');
                    rustGrad.addColorStop(0.5, 'rgba(112, 58, 32, 0.10)');
                    rustGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = rustGrad;
                    ctx.beginPath();

                    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            // Skylights (steel-framed glass panels)
            const skyW = Math.min(60, o.w * 0.22);
            const skyH = Math.min(40, o.h * 0.22);
            const skylightPositions = [
                { x: -hw * 0.45, y: -hh * 0.1 },
                { x: hw * 0.45, y: -hh * 0.1 }
            ];
            skylightPositions.forEach(pos => {
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.fillStyle = 'rgba(68, 122, 148, 0.75)';
                roundRect(ctx, -skyW/2, -skyH/2, skyW, skyH, 3);
                ctx.fill();
                ctx.strokeStyle = '#2d373c';
                ctx.lineWidth = 3;
                roundRect(ctx, -skyW/2, -skyH/2, skyW, skyH, 3);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(-skyW/2 + 8, -skyH/2 + 4);
                ctx.lineTo(skyW/2 - 12, skyH/2 - 4);
                ctx.moveTo(-skyW/2 + 20, -skyH/2 + 4);
                ctx.lineTo(skyW/2 - 4, skyH/2 - 10);
                ctx.stroke();
                ctx.restore();
            });

            // Rotating Ventilation Turbines
            const turbineRad = 16;
            const turbinePositions = [];
            if (o.w > 400) {
                turbinePositions.push({ x: -hw * 0.2, y: -hh * 0.4 });
                turbinePositions.push({ x: hw * 0.2, y: hh * 0.4 });
            } else {
                turbinePositions.push({ x: 0, y: -hh * 0.3 });
            }
            const fanAngle = (this._frameNow / 420) % (Math.PI * 2);
            turbinePositions.forEach(pos => {
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
                ctx.beginPath();
                ctx.arc(4, 5, turbineRad, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#414d54';
                ctx.strokeStyle = '#22292c';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, turbineRad, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = '#181e20';
                ctx.lineWidth = 3.5;
                for (let b = 0; b < 5; b++) {
                    const bladeAngle = fanAngle + (b * Math.PI * 2 / 5);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(bladeAngle) * (turbineRad - 3), Math.sin(bladeAngle) * (turbineRad - 3));
                    ctx.stroke();
                }
                ctx.fillStyle = '#6f808a';
                ctx.strokeStyle = '#22292c';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            });

            ctx.strokeStyle = '#252e32';
            ctx.lineWidth = 3.5;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 6);
            ctx.stroke();

        } else if (variant === 'mansion' || variant === 'guesthouse') {
            // --- MANSION & GUESTHOUSE: Elegant Slate Tiles ---
            const baseColor = variant === 'mansion' ? '#434c54' : '#495b6c';
            const shadowColor = variant === 'mansion' ? '#2b3137' : '#313e4b';

            const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            grad.addColorStop(0, baseColor);
            grad.addColorStop(0.5, shadowColor);
            grad.addColorStop(1, baseColor);
            ctx.fillStyle = grad;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 7);
            ctx.fill();

            const tileH = 24;
            const tileW = 30;
            ctx.save();
            roundRect(ctx, -hw - 2, -hh - 2, o.w + 4, o.h + 4, 6);
            ctx.clip();
            for (let yy = -hh + tileH; yy < hh + tileH; yy += tileH) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(-hw, yy);
                ctx.lineTo(hw, yy);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-hw, yy - tileH + 1);
                ctx.lineTo(hw, yy - tileH + 1);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
                ctx.lineWidth = 1.5;
                const shift = (Math.round((yy + hh) / tileH) % 2) * (tileW / 2);
                for (let xx = -hw - tileW + shift; xx < hw + tileW; xx += tileW) {
                    ctx.beginPath();
                    ctx.moveTo(xx, yy - tileH);
                    ctx.lineTo(xx, yy);
                    ctx.stroke();
                }
            }
            ctx.restore();

            if (variant === 'mansion' && o.w > 300) {
                ctx.save();
                const domeW = o.w * 0.18;
                const domeH = o.h * 0.25;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                roundRect(ctx, -domeW/2 + 6, -domeH/2 + 8, domeW, domeH, 6);
                ctx.fill();
                ctx.fillStyle = 'rgba(48, 86, 102, 0.85)';
                roundRect(ctx, -domeW/2, -domeH/2, domeW, domeH, 6);
                ctx.fill();
                ctx.strokeStyle = '#1e2428';
                ctx.lineWidth = 3;
                roundRect(ctx, -domeW/2, -domeH/2, domeW, domeH, 6);
                ctx.stroke();
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-domeW/2, -domeH/2); ctx.lineTo(domeW/2, domeH/2);
                ctx.moveTo(domeW/2, -domeH/2); ctx.lineTo(-domeW/2, domeH/2);
                ctx.moveTo(0, -domeH/2); ctx.lineTo(0, domeH/2);
                ctx.moveTo(-domeW/2, 0); ctx.lineTo(domeW/2, 0);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.22)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(-domeW * 0.15, -domeH * 0.15, domeW * 0.2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            const chimPositions = [
                { x: -hw * 0.58, y: -hh - 6 },
                { x: hw * 0.58, y: -hh - 6 }
            ];
            chimPositions.forEach(pos => {
                ctx.save();
                ctx.translate(pos.x, pos.y);
                const cw = 20;
                const ch = 26;
                ctx.fillStyle = '#8f4f3b';
                ctx.strokeStyle = '#2b1915';
                ctx.lineWidth = 2.5;
                roundRect(ctx, -cw/2, -ch, cw, ch, 3);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#5c5450';
                ctx.fillRect(-cw/2 - 3, -ch, cw + 6, 5);
                ctx.strokeRect(-cw/2 - 3, -ch, cw + 6, 5);
                ctx.fillStyle = '#1a1816';
                ctx.beginPath();
                ctx.arc(-cw * 0.22, -ch + 2.5, 3.5, 0, Math.PI * 2);
                ctx.arc(cw * 0.22, -ch + 2.5, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            ctx.strokeStyle = variant === 'mansion' ? '#8f654b' : '#313e4b';
            ctx.lineWidth = 3.5;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 7);
            ctx.stroke();

        } else if (variant === 'barn') {
            // --- BARN: Gambrel Red Roof Panels ---
            const redMain = '#883b2d';
            const redDark = '#5c2219';
            const redLight = '#b25745';

            ctx.fillStyle = redMain;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 5);
            ctx.fill();

            const gGradLeft = ctx.createLinearGradient(-hw, 0, -hw * 0.45, 0);
            gGradLeft.addColorStop(0, redDark);
            gGradLeft.addColorStop(1, redMain);
            ctx.fillStyle = gGradLeft;
            ctx.fillRect(-hw, -hh, hw * 0.55, o.h);

            const gGradRight = ctx.createLinearGradient(hw * 0.45, 0, hw, 0);
            gGradRight.addColorStop(0, redMain);
            gGradRight.addColorStop(1, redDark);
            ctx.fillStyle = gGradRight;
            ctx.fillRect(hw * 0.45, -hh, hw * 0.55, o.h);

            const gGradCenter = ctx.createLinearGradient(0, -hh, 0, hh);
            gGradCenter.addColorStop(0, redLight);
            gGradCenter.addColorStop(0.5, redMain);
            gGradCenter.addColorStop(1, redDark);
            ctx.fillStyle = gGradCenter;
            ctx.fillRect(-hw * 0.45, -hh, o.w * 0.9, o.h);

            ctx.strokeStyle = 'rgba(0,0,0,0.22)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-hw * 0.45, -hh); ctx.lineTo(-hw * 0.45, hh);
            ctx.moveTo(hw * 0.45, -hh); ctx.lineTo(hw * 0.45, hh);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-hw * 0.45 + 1.5, -hh); ctx.lineTo(-hw * 0.45 + 1.5, hh);
            ctx.moveTo(hw * 0.45 - 1.5, -hh); ctx.lineTo(hw * 0.45 - 1.5, hh);
            ctx.stroke();

            ctx.save();
            const cupW = 32;
            const cupH = 32;
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            roundRect(ctx, -cupW/2 + 4, -cupH/2 + 5, cupW, cupH, 3);
            ctx.fill();
            ctx.fillStyle = redDark;
            ctx.strokeStyle = '#2b100b';
            ctx.lineWidth = 2.5;
            roundRect(ctx, -cupW/2, -cupH/2, cupW, cupH, 3);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ece8e5';
            ctx.beginPath();
            ctx.moveTo(-cupW/2 - 3, -cupH/2);
            ctx.lineTo(0, -cupH/2 - 12);
            ctx.lineTo(cupW/2 + 3, -cupH/2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            ctx.strokeStyle = '#f8f5f2';
            ctx.lineWidth = 4;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 5);
            ctx.stroke();

        } else if (variant === 'cabin') {
            // --- CABIN: Rustic Wood Shingles & Log Corners ---
            const mainWood = '#704f32';
            const darkWood = '#4a321d';

            const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            grad.addColorStop(0, mainWood);
            grad.addColorStop(0.5, darkWood);
            grad.addColorStop(1, mainWood);
            ctx.fillStyle = grad;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 4);
            ctx.fill();

            const rowH = 20;
            const shingleW = 28;
            ctx.save();
            roundRect(ctx, -hw - 2, -hh - 2, o.w + 4, o.h + 4, 3);
            ctx.clip();
            for (let yy = -hh + rowH; yy < hh + rowH; yy += rowH) {
                ctx.strokeStyle = 'rgba(25, 14, 6, 0.4)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-hw, yy);
                ctx.lineTo(hw, yy);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-hw, yy - rowH + 1);
                ctx.lineTo(hw, yy - rowH + 1);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(20, 10, 5, 0.28)';
                ctx.lineWidth = 1.5;
                const shift = (Math.round((yy + hh) / rowH) % 2) * (shingleW / 2);
                for (let xx = -hw - shingleW + shift; xx < hw + shingleW; xx += shingleW) {
                    ctx.beginPath();
                    ctx.moveTo(xx, yy - rowH);
                    ctx.lineTo(xx, yy);
                    ctx.stroke();
                }
            }
            ctx.restore();

            const logRad = 8;
            const logOffset = 2;
            const logPositions = [
                { x: -hw - logOffset, y: -hh + logOffset },
                { x: hw + logOffset, y: -hh + logOffset },
                { x: -hw - logOffset, y: hh - logOffset },
                { x: hw + logOffset, y: hh - logOffset }
            ];
            ctx.fillStyle = '#55371c';
            ctx.strokeStyle = '#2b1b0d';
            ctx.lineWidth = 1.8;
            logPositions.forEach(pos => {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, logRad, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, logRad * 0.5, 0, Math.PI * 2);
                ctx.stroke();
            });

            const mossPatches = [
                { x: -hw * 0.35, y: -hh * 0.32, r: 20 },
                { x: hw * 0.22, y: hh * 0.42, r: 24 }
            ];
            mossPatches.forEach(m => {
                ctx.save();
                ctx.translate(m.x, m.y);
                const mossGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, m.r);
                mossGrad.addColorStop(0, 'rgba(74, 104, 68, 0.28)');
                mossGrad.addColorStop(0.6, 'rgba(56, 82, 58, 0.14)');
                mossGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = mossGrad;
                ctx.beginPath();
                ctx.arc(0, 0, m.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            ctx.strokeStyle = '#321f10';
            ctx.lineWidth = 3.5;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 4);
            ctx.stroke();

        } else if (variant === 'garage') {
            // --- GARAGE: Flat Tar & Gravel Roof ---
            ctx.fillStyle = '#2d2e30';
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 5);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            for (let i = 0; i < 40; i++) {
                const rx = -hw + seededNoise(i, 1) * o.w;
                const ry = -hh + seededNoise(i, 2) * o.h;
                ctx.beginPath();
                ctx.arc(rx, ry, 1.5 + seededNoise(i, 3) * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
            for (let i = 0; i < 40; i++) {
                const rx = -hw + seededNoise(i, 4) * o.w;
                const ry = -hh + seededNoise(i, 5) * o.h;
                ctx.beginPath();
                ctx.arc(rx, ry, 1.5 + seededNoise(i, 6) * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            const pipePositions = [
                { x: -hw * 0.45, y: -hh * 0.4 },
                { x: hw * 0.35, y: hh * 0.4 }
            ];
            pipePositions.forEach(p => {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
                ctx.beginPath(); ctx.arc(3, 4, 8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#8e989f';
                ctx.strokeStyle = '#32373a';
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#0f1011';
                ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            });

            ctx.strokeStyle = '#4e5154';
            ctx.lineWidth = 3.5;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 5);
            ctx.stroke();

        } else {
            // --- DEFAULT HOUSE / VILLAGE / FARM / CAMP: simple coated metal tiles ---
            const tileColor = '#677177';
            const tileShadow = '#454f55';

            const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            grad.addColorStop(0, tileColor);
            grad.addColorStop(0.5, tileShadow);
            grad.addColorStop(1, tileColor);
            ctx.fillStyle = grad;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 7);
            ctx.fill();

            const rowH = 22;
            const tileW = 30;
            ctx.save();
            roundRect(ctx, -hw - 2, -hh - 2, o.w + 4, o.h + 4, 6);
            ctx.clip();
            for (let yy = -hh + rowH; yy < hh + rowH; yy += rowH) {
                ctx.strokeStyle = 'rgba(15, 24, 28, 0.28)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-hw, yy);
                ctx.lineTo(hw, yy);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-hw, yy - rowH + 1);
                ctx.lineTo(hw, yy - rowH + 1);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(10, 18, 22, 0.18)';
                ctx.lineWidth = 1;
                const shift = (Math.round((yy + hh) / rowH) % 2) * (tileW / 2);
                for (let xx = -hw - tileW + shift; xx < hw + tileW; xx += tileW) {
                    ctx.beginPath();
                    ctx.arc(xx + tileW/2, yy - rowH, tileW/2, 0, Math.PI);
                    ctx.stroke();
                }
            }
            ctx.restore();

            ctx.save();
            const chX = hw * 0.32;
            const chY = -hh - 8;
            const chW = 16;
            const chH = 22;
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(chX - chW/2 + 4, chY - chH + 5, chW, chH);
            ctx.fillStyle = '#65737a';
            ctx.strokeStyle = '#202b30';
            ctx.lineWidth = 2;
            roundRect(ctx, chX - chW/2, chY - chH, chW, chH, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#443f3c';
            ctx.fillRect(chX - chW/2 - 2, chY - chH, chW + 4, 3.5);
            ctx.strokeRect(chX - chW/2 - 2, chY - chH, chW + 4, 3.5);
            ctx.restore();

            ctx.strokeStyle = '#273238';
            ctx.lineWidth = 3.5;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 7);

            ctx.stroke();
        }

        // One restrained steel inset ties old houses to the newer landmarks
        // without adding noisy roof props or another expensive texture pass.
        if (variant !== 'ironworks') {
            ctx.strokeStyle = 'rgba(202, 220, 226, 0.18)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, -hw + 5, -hh + 5, o.w - 10, o.h - 10, 4);
            ctx.stroke();
        }

        // --- RIDGE LINE ---
        if (variant !== 'ironworks') {
            const ridgeColor = variant === 'warehouse' ? '#8b9aa0' : variant === 'mansion' ? '#7f9098' : variant === 'barn' ? '#d3dcdf' : '#89989e';
            ctx.strokeStyle = ridgeColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-hw + 12, 0);
            ctx.lineTo(hw - 12, 0);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-hw + 14, -1);
            ctx.lineTo(hw - 14, -1);
            ctx.stroke();
        }

        // --- DOORWAY HIGHLIGHTS ---
        // Large landmarks can have several entrances; render every one and keep
        // vertical service doors aligned with their actual wall orientation.
        const roofDoors = this._doorwaysByHouseId.get(o.id) || [];
        for (const door of roofDoors) {
            const doorX = door.x - o.x;
            const doorY = door.y - o.y;
            const doorSide = door.orientation || door.role;
            const verticalDoor = doorSide === 'east' || doorSide === 'west';
            const entryW = verticalDoor ? Math.max(28, door.w * 1.15) : Math.max(door.w, 86);
            const entryH = verticalDoor ? Math.max(door.h, 86) : Math.max(28, door.h * 1.15);
            const industrialEntry = variant === 'ironworks' || variant === 'warehouse' || variant === 'garage';

            ctx.fillStyle = 'rgba(10, 8, 5, 0.88)';
            roundRect(ctx, doorX - entryW / 2, doorY - entryH / 2, entryW, entryH, 6);
            ctx.fill();

            const trimColor = industrialEntry ? '#10181c' : variant === 'mansion' ? '#263238' : '#29353a';
            ctx.strokeStyle = trimColor;
            ctx.lineWidth = industrialEntry ? 9 : 7;
            roundRect(ctx, doorX - entryW / 2 - 3, doorY - entryH / 2 - 3, entryW + 6, entryH + 6, 7);
            ctx.stroke();

            const glowRadius = Math.max(entryW, entryH) * 0.9;
            const entryGlow = ctx.createRadialGradient(doorX, doorY, 4, doorX, doorY, glowRadius);
            entryGlow.addColorStop(0, industrialEntry ? 'rgba(112, 206, 226, 0.28)' : 'rgba(255, 215, 130, 0.24)');
            entryGlow.addColorStop(0.5, industrialEntry ? 'rgba(72, 161, 185, 0.10)' : 'rgba(255, 200, 110, 0.08)');
            entryGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = entryGlow;
            ctx.fillRect(doorX - glowRadius, doorY - glowRadius, glowRadius * 2, glowRadius * 2);

            ctx.fillStyle = industrialEntry ? 'rgba(232, 174, 48, 0.72)' : 'rgba(236, 205, 140, 0.32)';
            if (verticalDoor) {
                const thresholdX = doorSide === 'west' ? doorX - entryW / 2 : doorX + entryW / 2 - 8;
                roundRect(ctx, thresholdX, doorY - entryH / 2 + 10, 8, entryH - 20, 3);
            } else {
                const thresholdY = doorSide === 'north' ? doorY - entryH / 2 : doorY + entryH / 2 - 8;
                roundRect(ctx, doorX - entryW / 2 + 10, thresholdY, entryW - 20, 8, 3);
            }
            ctx.fill();
        }

        ctx.restore();
    }

    drawCachedHouseRoof(ctx, o) {
        if (typeof document === 'undefined' || !o?.id) return false;
        // Huge landmarks would create multi-megabyte single sprites. Their
        // custom roof is uncommon, while normal houses gain most from caching.
        if (o.w > 1400 || o.h > 1100) return false;

        const key = o.id + ':' + this._obstacleRevision;
        let sprite = this._roofSpriteCache.get(key);
        if (!sprite) {
            // Spread cache creation across frames to avoid an entry stutter
            // when several roofs enter the viewport at the same time.
            if (this._roofCacheBuildsThisFrame >= 4) return false;
            this._roofCacheBuildsThisFrame++;

            const rotated = Math.abs(o.rotation || 0) > 0.001;
            const extent = rotated ? Math.hypot(o.w, o.h) : 0;
            const width = Math.ceil((rotated ? extent : o.w) + 72);
            const height = Math.ceil((rotated ? extent : o.h) + 72);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const cacheCtx = canvas.getContext('2d', { alpha: true });
            if (!cacheCtx) return false;
            cacheCtx.translate(width / 2 - o.x, height / 2 - o.y);
            this.drawHouseRoof(cacheCtx, o, false);
            sprite = { canvas, width, height };

            if (this._roofSpriteCache.size >= 128) {
                const oldestKey = this._roofSpriteCache.keys().next().value;
                this._roofSpriteCache.delete(oldestKey);
            }
            this._roofSpriteCache.set(key, sprite);
        }

        ctx.drawImage(
            sprite.canvas,
            Math.round(o.x - sprite.width / 2),
            Math.round(o.y - sprite.height / 2),
        );
        return true;
    }

    drawVignette(ctx, W, H) {
        ctx.save();
        const radius = Math.max(W, H) * 0.72;
        const vigKey = `${W}:${H}`;
        if (vigKey !== this._cachedVignetteKey) {
            this._cachedVignetteGrad = ctx.createRadialGradient(W / 2, H / 2, radius * 0.25, W / 2, H / 2, radius);
            this._cachedVignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            this._cachedVignetteGrad.addColorStop(0.64, 'rgba(0, 0, 0, 0.08)');
            this._cachedVignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
            this._cachedDangerGrad = ctx.createRadialGradient(W / 2, H / 2, radius * 0.38, W / 2, H / 2, radius * 0.96);
            this._cachedDangerGrad.addColorStop(0, 'rgba(120, 0, 0, 0)');
            this._cachedDangerGrad.addColorStop(1, 'rgba(220, 32, 32, 0.72)');
            this._cachedVignetteKey = vigKey;
        }
        ctx.fillStyle = this._cachedVignetteGrad;
        ctx.fillRect(0, 0, W, H);

        const hpPct = clamp((this.hud.hp || 0) / (this.hud.maxHp || 100), 0, 1);
        if (hpPct > 0 && hpPct < 0.34) {
            ctx.globalAlpha = clamp((0.34 - hpPct) / 0.34, 0, 1) * 0.28;
            ctx.fillStyle = this._cachedDangerGrad;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
    }

    drawLootToast(ctx, W, H) {
        if (!this.lootToast || this.lootToast.expiresAt < this._frameNow) return;
        const now = this._frameNow;
        const items = this.lootToast.items || {};
        const lines = [];
        if (items.weaponLabel) lines.push(`+ ${items.weaponLabel}`);
        if (items.money) lines.push(`+$${Number(items.money).toFixed(2)}`);
        if (items.medkits) lines.push(`+${items.medkits} medkit${items.medkits === 1 ? '' : 's'}`);
        if (items.ammoPacks) lines.push(`+${items.ammoPacks} ammo`);
        if (items.armor) lines.push(`+${Math.round(items.armor)} armor`);
        const text = lines.length ? lines.join('   ') : 'Empty';
        const w = Math.min(W - 28, Math.max(220, Math.min(390, text.length * 7 + 72)));
        const x = W / 2 - w / 2;
        const baseY = Math.max(72, H * 0.11);
        const age = Math.max(0, now - (this.lootToast.shownAt || now));
        const enter = clamp(age / 180, 0, 1);
        const exit = clamp((this.lootToast.expiresAt - now) / 380, 0, 1);
        const y = baseY - (1 - enter) * 14;
        const accent = RARITY_COLORS[this.lootToast.tier] || '#d7c396';

        ctx.save();
        ctx.globalAlpha = Math.min(enter, exit);
        ctx.fillStyle = 'rgba(8, 12, 9, 0.84)';
        ctx.strokeStyle = accent + '88';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x, y, w, 48, 7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = accent;
        roundRect(ctx, x, y, 4, 48, 3);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 25, y + 24, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#11170f';
        ctx.font = '900 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', x + 25, y + 24);
        ctx.fillStyle = '#f0f4eb';
        ctx.font = '900 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.lootToast.source === 'ground' ? 'PICKED UP' : 'LOOTED', x + 43, y + 17);
        ctx.fillStyle = '#c4cec0';
        ctx.font = '800 11px system-ui, sans-serif';
        ctx.fillText(text, x + 43, y + 34);
        ctx.restore();
    }

    drawHud(ctx, W, H) {
        const pad = this.isMobileLayout ? 10 : 16;
        const panelW = this.isMobileLayout ? 164 : 190;
        const hpPct = clamp(this.hud.hp / (this.hud.maxHp || 100), 0, 1);
        const armorPct = clamp((this.hud.armor || 0) / 100, 0, 1);

        ctx.save();
        this.drawPanel(ctx, pad, pad, panelW, armorPct > 0 ? 76 : 58);
        ctx.fillStyle = '#785eff';
        ctx.font = '800 11px "Space Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('HEALTH', pad + 12, pad + 17);

        this.drawBar(ctx, pad + 12, pad + 26, panelW - 24, 12, hpPct, '#5fe08a', '#ef544f');
        if (armorPct > 0) {
            ctx.fillStyle = '#5c9cff';
            ctx.font = '700 9px "Space Mono", monospace';
            ctx.fillText('ARMOR', pad + 12, pad + 52);
            this.drawBar(ctx, pad + 12, pad + 58, panelW - 24, 7, armorPct, '#5c9cff', '#5c9cff');
        }

        const weaponLabel = WEAPON_LABELS[this.hud.weapon] || 'Fists';
        const ammoText = this.hud.weapon === 'fists' ? 'MELEE' : (this.hud.reloading ? 'RELOADING' : String(this.hud.ammo) + '/' + String(this.hud.clipSize));
        const weaponW = this.isMobileLayout ? 148 : 172;
        this.drawPanel(ctx, W - pad - weaponW, pad, weaponW, 58);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 13px "Outfit", sans-serif';
        ctx.fillText(weaponLabel, W - pad - 12, pad + 20);
        ctx.fillStyle = this.hud.reloading ? '#ffd45a' : '#5fe08a';
        ctx.font = '800 18px "Space Mono", monospace';
        ctx.fillText(ammoText, W - pad - 12, pad + 44);

        if (this.hud.kills > 0) {
            const text = String(this.hud.kills) + ' ELIMS';
            const w = 88;
            this.drawPanel(ctx, W / 2 - w / 2, pad, w, 30);
            ctx.fillStyle = '#ef544f';
            ctx.font = '800 12px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(text, W / 2, pad + 20);
        }
        ctx.restore();
    }

    drawPanel(ctx, x, y, w, h) {
        ctx.save();
        ctx.fillStyle = 'rgba(9, 10, 15, 0.9)';
        ctx.strokeStyle = 'rgba(120, 94, 255, 0.35)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x, y, w, h, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    drawBar(ctx, x, y, w, h, pct, ok, danger) {
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        roundRect(ctx, x, y, w, h, 3);
        ctx.fill();
        ctx.fillStyle = pct > 0.35 ? ok : danger;
        roundRect(ctx, x, y, w * pct, h, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 94, 255, 0.2)';
        ctx.lineWidth = 1;
        roundRect(ctx, x, y, w, h, 3);
        ctx.stroke();
    }

    drawMinimapPanel(ctx, W, H) {
        const viewHalfW = W / (2 * this.zoom);
        const viewHalfH = H / (2 * this.zoom);
        const lootDots = this.minimap.food?.length
            ? this.minimap.food
            : this.loot
                .filter(l => l.type === 'chest' || l.type === 'deathCrate' || l.type === 'money')
                .map(l => ({ x: l.x, y: l.y, golden: l.type !== 'chest' }));
        const minimapPlayers = this.minimap.players?.length
            ? this.minimap.players
            : this.players.map(p => ({ x: p.x, y: p.y, isYou: p.isYou || p.id === this.myId }));
        const isMobile = this.isMobileLayout;
        const cacheSize = isMobile ? 96 : 160;
        if (!this._minimapCanvas && typeof document !== 'undefined') {
            this._minimapCanvas = document.createElement('canvas');
            this._minimapCtx = this._minimapCanvas.getContext('2d', { alpha: true });
        }
        const now = performance.now();
        const targetCtx = this._minimapCtx || ctx;
        const shouldCache = !!this._minimapCtx;
        const needsRedraw = !shouldCache || now >= this._nextMinimapRenderAt
            || this._minimapCanvas.width !== cacheSize || this._minimapCanvas.height !== cacheSize;
        if (!needsRedraw) {
            ctx.drawImage(this._minimapCanvas, 0, 0);
            return;
        }
        if (shouldCache) {
            if (this._minimapCanvas.width !== cacheSize || this._minimapCanvas.height !== cacheSize) {
                this._minimapCanvas.width = cacheSize;
                this._minimapCanvas.height = cacheSize;
            }
            targetCtx.clearRect(0, 0, cacheSize, cacheSize);
            this._nextMinimapRenderAt = now + (1000 / 12);
        }
        drawGameMinimap(targetCtx, {
            screenW: shouldCache ? cacheSize : W,
            screenH: shouldCache ? cacheSize : H,
            isMobile,
            centerX: this.camera.x,
            centerY: this.camera.y,
            viewHalfW,
            viewHalfH,
            players: minimapPlayers,
            food: lootDots,
            obstacles: this.minimap.obstacles?.length ? this.minimap.obstacles : this.obstacles,
            zone: this.zone?.radius > 0 ? {
                cx: this.zone.x,
                cy: this.zone.y,
                radius: this.zone.radius,
            } : null,
            time: now,
        });
        if (shouldCache) ctx.drawImage(this._minimapCanvas, 0, 0);
    }

    // ========== NEW VISUAL FEEDBACK METHODS ==========

    drawParticles(ctx, currentHouse = null, currentRoom = null) {
        if (this.particles.length === 0) return;
        ctx.save();
        for (const p of this.particles) {
            if (!this.isPointInView(p.x, p.y, 24)) continue;
            if (this.isPointHiddenByRooms(p.x, p.y, currentHouse, currentRoom)) continue;
            const alpha = clamp(p.life / (p.maxLife || 0.2), 0, 1);
            ctx.globalAlpha = alpha;

            if (p.type === 'shell') {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation || 0);
                ctx.fillStyle = p.color || '#d4af37';
                // Draw a tiny gold cylinder shell casing
                ctx.fillRect(-2.5, -0.9, 5, 1.8);
                // Draw a slightly darker rim for texture
                ctx.fillStyle = 'rgba(0,0,0,0.18)';
                ctx.fillRect(-2.5, -0.9, 1, 1.8);
                ctx.restore();
            } else {
                ctx.fillStyle = p.color || '#ffdd44';
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    drawDamageNumbers(ctx, currentHouse = null, currentRoom = null) {
        const now = this._frameNow;
        this.damageNumbers = this.damageNumbers.filter(d => now - d.spawnedAt < d.duration);
        if (this.damageNumbers.length === 0) return;
        ctx.save();
        for (const d of this.damageNumbers) {
            if (!this.isPointInView(d.x, d.y, 48)) continue;
            if (this.isPointHiddenByRooms(d.x, d.y, currentHouse, currentRoom)) continue;
            const age = now - d.spawnedAt;
            const t = age / d.duration;
            const alpha = t < 0.2 ? t / 0.2 : Math.max(0, 1 - (t - 0.5) / 0.5);
            const yOffset = -t * 28;
            const scale = t < 0.15 ? 0.7 + t / 0.15 * 0.6 : 1.3 - t * 0.3;

            ctx.save();
            ctx.translate(d.x, d.y + yOffset);
            ctx.scale(scale, scale);
            ctx.globalAlpha = alpha;
            ctx.font = '900 14px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.strokeText(`-${d.amount}`, 0, 0);
            ctx.fillStyle = d.color || '#ff4444';
            ctx.fillText(`-${d.amount}`, 0, 0);
            ctx.restore();
        }
        ctx.restore();
    }

    drawDamageIndicators(ctx, W, H) {
        const now = this._frameNow;
        this.damageIndicators = this.damageIndicators.filter(d => now - d.spawnedAt < d.duration);
        if (this.damageIndicators.length === 0) return;
        const cx = W / 2;
        const cy = H / 2;
        const indicatorDist = Math.min(W, H) * 0.35;

        ctx.save();
        for (const d of this.damageIndicators) {
            const age = now - d.spawnedAt;
            const alpha = Math.max(0, 1 - age / d.duration) * d.intensity;
            const x = cx + Math.cos(d.angle) * indicatorDist;
            const y = cy + Math.sin(d.angle) * indicatorDist;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(d.angle);
            ctx.globalAlpha = alpha;

            // Red damage arc
            const grad = ctx.createLinearGradient(-30, 0, 30, 0);
            grad.addColorStop(0, 'rgba(255, 40, 30, 0)');
            grad.addColorStop(0.5, `rgba(255, 40, 30, ${0.8 * alpha})`);
            grad.addColorStop(1, 'rgba(255, 40, 30, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(4, -18);
            ctx.lineTo(12, 0);
            ctx.lineTo(4, 18);
            ctx.lineTo(0, 12);
            ctx.lineTo(6, 0);
            ctx.lineTo(0, -12);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    drawHitMarkers(ctx, W, H) {
        const now = this._frameNow;
        this.hitMarkers = this.hitMarkers.filter(h => now - h.spawnedAt < h.duration);
        if (this.hitMarkers.length === 0) return;
        const cx = W / 2;
        const cy = H / 2;

        ctx.save();
        for (const h of this.hitMarkers) {
            const age = now - h.spawnedAt;
            const t = age / h.duration;
            const alpha = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.3) / 0.7);
            const size = h.kill ? 14 : 10;
            const expand = t < 0.15 ? 1 + t * 4 : 1.6 - t * 0.6;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(expand, expand);
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = h.kill ? '#ff4444' : '#ffffff';
            ctx.lineWidth = h.kill ? 2.5 : 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-size, -size);
            ctx.lineTo(-size * 0.35, -size * 0.35);
            ctx.moveTo(size, -size);
            ctx.lineTo(size * 0.35, -size * 0.35);
            ctx.moveTo(-size, size);
            ctx.lineTo(-size * 0.35, size * 0.35);
            ctx.moveTo(size, size);

            ctx.lineTo(size * 0.35, size * 0.35);
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    }

    drawKillAnimation(ctx, W, H) {
        const now = this._frameNow;
        this.killAnimations = this.killAnimations.filter(animation => now - animation.spawnedAt < animation.duration);
        const animation = this.killAnimations[this.killAnimations.length - 1];
        if (!animation) return;

        const t = clamp((now - animation.spawnedAt) / animation.duration, 0, 1);
        const alpha = t < 0.12 ? t / 0.12 : t > 0.72 ? (1 - t) / 0.28 : 1;
        const pop = t < 0.22 ? 0.72 + Math.sin((t / 0.22) * Math.PI / 2) * 0.34 : 1;
        const cx = W / 2;
        const y = H * 0.3;

        ctx.save();
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.translate(cx, y);
        ctx.scale(pop, pop);

        const pulse = 30 + t * 42;
        ctx.strokeStyle = `rgba(239, 84, 79, ${Math.max(0, 0.55 * (1 - t))})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(8, 10, 10, 0.82)';
        ctx.strokeStyle = 'rgba(239, 84, 79, 0.68)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, -112, -27, 224, 54, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef544f';
        ctx.font = '900 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠  ELIMINATED', 0, -7);
        ctx.fillStyle = 'rgba(255,255,255,0.84)';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.fillText(this.hideNames ? '???' : animation.victimName, 0, 12);
        ctx.restore();
    }
    drawKillFeed(ctx, W, H) {
        if (this.killFeed.length === 0) return;
        const now = this._frameNow;
        const maxShow = 5;
        const entries = this.killFeed.slice(-maxShow);

        ctx.save();
        let y = 56;
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const age = now - e.shownAt;
            const alpha = age < 300 ? age / 300 : age > 4200 ? Math.max(0, 1 - (age - 4200) / 800) : 1;
            if (alpha <= 0) continue;

            ctx.globalAlpha = alpha;
            const text = `${e.killer || '?'}  ⊕  ${e.victim || '?'}`;
            const tw = Math.min(220, text.length * 7 + 32);
            const x = W - tw - 14;

            ctx.fillStyle = 'rgba(8, 10, 9, 0.72)';
            roundRect(ctx, x, y, tw, 22, 4);
            ctx.fill();

            ctx.font = '700 10px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            // Killer name
            const killerDisplay = this.hideNames ? '???' : (e.killer || '?');
            ctx.fillStyle = '#ff6b6b';
            ctx.fillText(killerDisplay, x + 8, y + 11);

            // Skull icon
            const killerW = ctx.measureText(killerDisplay).width;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(' ☠ ', x + 8 + killerW, y + 11);

            // Victim name
            const midW = ctx.measureText(' ☠ ').width;
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(this.hideNames ? '???' : (e.victim || '?'), x + 8 + killerW + midW, y + 11);

            y += 26;
        }
        ctx.restore();
    }

    drawLowAmmoWarning(ctx, W, H) {
        if (this._lowAmmoPulse <= 0) return;
        ctx.save();
        const pulse = 0.5 + Math.sin(this._frameNow / 200) * 0.5;
        ctx.globalAlpha = this._lowAmmoPulse * pulse * 0.25;
        const lowAmmoKey = `${W}:${H}`;
        if (lowAmmoKey !== this._cachedLowAmmoKey) {
            this._cachedLowAmmoGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
            this._cachedLowAmmoGrad.addColorStop(0, 'rgba(255, 160, 0, 0)');
            this._cachedLowAmmoGrad.addColorStop(1, 'rgba(255, 160, 0, 0.5)');
            this._cachedLowAmmoKey = lowAmmoKey;
        }
        ctx.fillStyle = this._cachedLowAmmoGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    drawFpsCounter(ctx, W, H) {
        const fps = this._fpsDisplay;
        if (!fps) return;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = fps >= 120 ? '#55d875' : fps >= 60 ? '#ffd45a' : '#ef544f';
        ctx.font = '700 12px "Space Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(`${fps} FPS`, W - 10, H - 22);
        ctx.restore();
    }

    spawnBloodDecal(x, y) {
        const size = 10 + Math.random() * 10;
        const dropletCount = 3 + Math.floor(size * 0.12);
        const droplets = [];
        for (let i = 0; i < dropletCount; i++) {
            const dist = size * (0.42 + Math.random() * 0.45);
            const angle = (i * Math.PI * 2) / dropletCount + (Math.random() - 0.5) * 0.6;
            droplets.push({
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
                radius: size * (0.10 + Math.random() * 0.1),
            });
        }
        this.bloodDecals.push({
            x: x + (Math.random() - 0.5) * 8,
            y: y + (Math.random() - 0.5) * 8,
            size,
            rotation: Math.random() * Math.PI * 2,
            opacity: 0.85,
            bornAt: Date.now(),
            fadeStartAt: Date.now() + 18000, // Stay solid for 18 seconds
            fadeDuration: 4000,             // Fade out over 4 seconds
            droplets,
        });
        // Cap to prevent memory leaks
        if (this.bloodDecals.length > 50) {
            this.bloodDecals.shift();
        }
    }

    drawBloodDecals(ctx) {
        const now = this._frameNow;
        for (let i = this.bloodDecals.length - 1; i >= 0; i--) {
            const d = this.bloodDecals[i];
            let alpha = d.opacity;
            if (now > d.fadeStartAt) {
                const elapsed = now - d.fadeStartAt;
                alpha = Math.max(0, d.opacity * (1 - elapsed / d.fadeDuration));
            }
            if (alpha <= 0) {
                this.bloodDecals.splice(i, 1);
                continue;
            }
            if (!this.isPointInView(d.x, d.y, d.size + 8)) continue;

            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rotation);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#9b1e1a'; // Deep organic blood red

            // Primary splatter circle
            ctx.beginPath();
            ctx.arc(0, 0, d.size * 0.44, 0, Math.PI * 2);
            ctx.fill();

            // Satellite droplets (splatter spray)
            for (const droplet of d.droplets || []) {
                ctx.beginPath();
                ctx.arc(droplet.x, droplet.y, droplet.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
}

