/**
 * Surviv client renderer - top-down shooter canvas.
 */

import { drawBalanceBadge } from '../balanceBadge.js';
import { drawCashoutProgressRing } from '../cashoutRing.js';
import { drawGameMinimap } from '../minimap.js';
import { playWeaponShootSound } from '../../audio/synthSounds.js';

const WEAPON_LABELS = {
    fists: 'Fists',
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
    weapon: '#f2774f',
};

const WEAPON_FIRE_RATE = {
    fists: 0, pistol: 280, revolver: 600, smg: 80, shotgun: 750,
    assault: 150, dmr: 350, sniper: 1400, lmg: 110,
};

const WEAPON_SHAKE = {
    fists: 0, pistol: 0.3, revolver: 0.8, smg: 0.15, shotgun: 1.0,
    assault: 0.3, dmr: 0.6, sniper: 1.4, lmg: 0.25,
};

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

function biomeAt() {
    return { base: '#3d6b35', alt: '#4a7a42', grass: 'rgba(45,88,38,0.22)' };
}

export class SurvivRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = { x: 0, y: 0 };
        this.zoom = 1;
        this.targetZoom = 1.08;
        this.worldHalf = 10000;
        this.myId = null;
        this.players = [];
        this.loot = [];
        this.bullets = [];
        this.obstacles = [];
        this.minimap = { players: [], food: [], obstacles: [] };
        this.houseFloors = [];
        this.roomZones = [];
        this.doorways = [];

        this.surfaceObstacles = [];
        this.sortedWorldObstacles = [];
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
            inventory: { weapons: ['fists'], medkits: 0, ammoPacks: 0, chestsOpened: 0 },
        };
        this.keys = { w: false, a: false, s: false, d: false };
        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false };
        this.mobileMove = { x: 0, y: 0 };
        this.mobileAim = { angle: 0, strength: 0, active: false, shooting: false };
        this.inputEnabled = true;
        this.spectatorMode = false;
        this.externalCameraGetter = null;
        this.inventoryOpen = false;
        this.running = false;
        this._raf = null;
        this._lastFrameAt = performance.now();
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
        // Kill feed
        this.killFeed = [];
        // Blood decals on the ground
        this.bloodDecals = [];
        // Previous player states for interpolation & tracking
        this._prevPlayers = new Map();
        this._interpPlayers = new Map();
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
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const parent = this.canvas.parentElement;
        const w = parent?.clientWidth || window.innerWidth;
        const h = parent?.clientHeight || window.innerHeight;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.viewW = w;
        this.viewH = h;
        this.targetZoom = w < 760 ? 0.86 : 1.08;
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

    resetSession() {
        this.players = [];
        this.loot = [];
        this.bullets = [];
        this.obstacles = [];
        this.minimap = { players: [], food: [], obstacles: [] };
        this.houseFloors = [];
        this.roomZones = [];
        this.doorways = [];
        this.surfaceObstacles = [];
        this.sortedWorldObstacles = [];
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
        if (!enabled) {
            this.mouse.down = false;
            this.clearMobileInput();
        }
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

    updateState(tick) {
        if (!tick) return;
        const receivedAt = Date.now();
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
            };
        };

        // Track melee starts before updating players
        const prevMeleeStarts = new Map();
        for (const p of this.players || []) {
            prevMeleeStarts.set(p.id, p.meleeStartedAt || 0);
        }

        const rawMe = tick.you || (tick.players || []).find(p => p.isYou || p.id === this.myId);
        const me = withLocalClocks(rawMe);
        const rawPlayers = (tick.players || []).map(withLocalClocks);
        this.players = me
            ? [me, ...rawPlayers.filter(p => p.id !== me.id && !p.isYou)]
            : rawPlayers;
        this.loot = tick.loot || [];

        // Accumulate walk cycle & bob for each player
        for (const p of this.players) {
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

        // Play sounds for newly triggered melee attacks
        for (const p of this.players || []) {
            const prevStart = prevMeleeStarts.get(p.id) || 0;
            if (p.meleeStartedAt > prevStart) {
                playWeaponShootSound('fists');
            }
        }

        // Play sounds for newly spawned bullets (fired by local player, remote players, or bots)
        const prevBulletIds = new Set((this.bullets || []).map(b => b.id));
        if (tick.bullets) {
            for (const b of tick.bullets) {
                if (!prevBulletIds.has(b.id)) {
                    playWeaponShootSound(b.weaponType || 'pistol');
                }
            }
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
                    const hitObstacle = this.obstacles.find(o => o.collidable !== false && this.pointInsideRect(o, b.x, b.y, 18));
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
        this.bullets = tick.bullets || [];
        const nextObstacles = tick.obstacles || [];
        if (nextObstacles !== this.obstacles) {
            this.obstacles = nextObstacles;
            this.rebuildObstacleRenderCache();
        }
        this.zone = tick.zone || null;
        this.minimap = tick.minimap || { players: [], food: [], obstacles: [] };

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
            if (this._prevAmmo >= 0 && me.ammo < this._prevAmmo && me.weapon !== 'fists' && !me.reloading) {
                this._muzzleFlash = 1.0;
                const shakeAmt = WEAPON_SHAKE[me.weapon] || 1;
                this.cameraShake.intensity += shakeAmt;
                // Spawn muzzle flash particles
                const angle = me.angle || 0;
                const barrelDist = me.weapon === 'sniper' ? 38 : me.weapon === 'shotgun' ? 30 : 24;
                const bx = me.x + Math.cos(angle) * barrelDist;
                const by = me.y + Math.sin(angle) * barrelDist;
                for (let i = 0; i < 4; i++) {
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
                // Spawn brass shell casing particle (ejects to the side/back)
                const ejectAngle = angle - Math.PI / 2.3 + (Math.random() - 0.5) * 0.4;
                const sx = me.x - Math.cos(angle) * 2;
                const sy = me.y - Math.sin(angle) * 2;
                this.particles.push({
                    x: sx,
                    y: sy,
                    vx: Math.cos(ejectAngle) * (42 + Math.random() * 28) - Math.cos(angle) * 8,
                    vy: Math.sin(ejectAngle) * (42 + Math.random() * 28) - Math.sin(angle) * 8,
                    life: 0.65 + Math.random() * 0.25,
                    maxLife: 0.9,
                    size: 3.5,
                    color: '#d4af37', // Brass gold color
                    type: 'shell',
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: 22 + Math.random() * 18,
                    bounceCount: 0,
                });
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
            if (!this.spectatorMode) {
                this.camera.x = lerp(this.camera.x, me.x, 0.42);
                this.camera.y = lerp(this.camera.y, me.y, 0.42);
            }
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
        if (len > 1e-6) {
            dx /= len;
            dy /= len;
        }
        // Recalculate mouse world coordinates because camera (and player) moved
        const w = this.screenToWorld(this.mouse.x, this.mouse.y);
        this.mouse.worldX = w.x;
        this.mouse.worldY = w.y;

        const pointerAimAngle = Math.atan2(
            this.mouse.worldY - this.camera.y,
            this.mouse.worldX - this.camera.x,
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
        if (k === 'q') return 'useMedkit';
        if (['1', '2', '3', '4'].includes(k)) return `equipSlot:${Number(k) - 1}`;
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
        const surfaceKinds = new Set(['road', 'houseFloor', 'field', 'water', 'river', 'bridge']);
        this.houseFloors = this.obstacles.filter(o => o.kind === 'houseFloor');
        this.roomZones = this.obstacles.filter(o => o.kind === 'roomZone');
        this.doorways = this.obstacles.filter(o => o.kind === 'door');
        this.surfaceObstacles = [];
        const solid = [];
        for (const o of this.obstacles) {
            if (o.kind === 'roomZone') continue;
            if (o.kind === 'furniture' || o.kind === 'interiorWall' || o.kind === 'wall' || o.kind === 'door') {
                const house = o.houseId
                    ? this.houseFloors.find(h => h.id === o.houseId)
                    : this.houseFloors.find(h => this.pointInsideRect(h, o.x, o.y, -2));
                o._insideHouseId = house?.id || null;
                const room = house
                    ? this.roomZones.find(r => r.houseId === house.id && this.pointInsideRect(r, o.x, o.y, 1))
                    : null;
                o._insideRoomId = room?.id || null;
            }
            if (surfaceKinds.has(o.kind)) this.surfaceObstacles.push(o);
            else solid.push(o);
        }
        this.sortedWorldObstacles = solid.sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
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
        return this.roomZones.find(r => r.houseId === houseId && this.pointInsideRect(r, x, y, -1)) || null;
    }

    getCurrentRoom(currentHouse) {
        if (!this.me || !currentHouse) return null;
        return this.findRoomContainingPoint(this.me.x, this.me.y, currentHouse);
    }

    usesInteriorFog(house) {
        if (!house) return false;
        const huge = house.w >= 430 || house.h >= 330;
        const corridorHouse = this.roomZones.some(r => r.houseId === house.id && r.variant === 'hallway');
        return huge && corridorHouse && (house.variant === 'mansion' || house.variant === 'warehouse');
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
        const house = this.findHouseContainingPoint(x, y);
        if (!house) return false;
        if (!currentHouse || house.id !== currentHouse.id) return true;
        if (!this.usesInteriorFog(currentHouse)) return false;
        // Houses with no rooms — never hide anything
        const hasRooms = this.roomZones.some(r => r.houseId === currentHouse.id);
        if (!hasRooms) return false;
        if (!currentRoom) return false;
        const room = this.findRoomContainingPoint(x, y, house);
        if (!room || room.id === currentRoom.id) return false;
        const strength = this.roomVisibilityStrength(room, currentRoom, this.me?.x ?? 0, this.me?.y ?? 0);
        return strength <= 0.18;
    }

    shouldDrawObstacle(o, currentHouse, currentRoom) {
        if (o.kind === 'roomZone') return false;
        if (o.kind === 'houseFloor') return !!currentHouse && currentHouse.id === o.id;
        if (o.kind === 'wall' || o.kind === 'interiorWall' || o.kind === 'door') {
            return !o._insideHouseId || (currentHouse && currentHouse.id === o._insideHouseId);
        }
        if (o.kind === 'furniture') {
            if (!o._insideHouseId) return true;
            if (!currentHouse || currentHouse.id !== o._insideHouseId) return false;
            // Small houses have no rooms — always show all contents
            if (!o._insideRoomId) return true;
            return !currentRoom || o._insideRoomId === currentRoom.id;
        }
        return true;
    }

    isLootHidden(l, currentHouse, currentRoom) {
        return this.isPointHiddenByRooms(l.x, l.y, currentHouse, currentRoom);
    }

    isPlayerHidden(p, currentHouse, currentRoom) {
        if (p.isYou || p.id === this.myId) return false;
        return this.isPointHiddenByRooms(p.x, p.y, currentHouse, currentRoom);
    }

    drawRoomShadows(ctx, currentHouse, currentRoom) {
        if (!currentHouse || !this.usesInteriorFog(currentHouse)) return;
        const zones = this.roomZones.filter(r => r.houseId === currentHouse.id);
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
    _gatherWallSegments(camX, camY, viewW, viewH, z) {
        const margin = 200;
        const halfW = viewW / z / 2 + margin;
        const halfH = viewH / z / 2 + margin;
        const minX = camX - halfW;
        const maxX = camX + halfW;
        const minY = camY - halfH;
        const maxY = camY + halfH;

        const segments = [];
        const blockingKinds = new Set(['wall', 'interiorWall', 'container', 'crate']);

        for (const o of this.obstacles) {
            if (!blockingKinds.has(o.kind)) continue;
            // Cull obstacles far from camera
            if (o.x + o.w / 2 < minX || o.x - o.w / 2 > maxX) continue;
            if (o.y + o.h / 2 < minY || o.y - o.h / 2 > maxY) continue;

            const hw = o.w / 2;
            const hh = o.h / 2;
            const corners = [
                { x: o.x - hw, y: o.y - hh },
                { x: o.x + hw, y: o.y - hh },
                { x: o.x + hw, y: o.y + hh },
                { x: o.x - hw, y: o.y + hh },
            ];
            // 4 edges of the rectangle
            segments.push(
                { ax: corners[0].x, ay: corners[0].y, bx: corners[1].x, by: corners[1].y },
                { ax: corners[1].x, ay: corners[1].y, bx: corners[2].x, by: corners[2].y },
                { ax: corners[2].x, ay: corners[2].y, bx: corners[3].x, by: corners[3].y },
                { ax: corners[3].x, ay: corners[3].y, bx: corners[0].x, by: corners[0].y },
            );
        }

        // Also add tree trunks as blocking segments (approximate as octagon)
        for (const o of this.obstacles) {
            if (o.kind !== 'tree') continue;
            if (o.x + o.w / 2 < minX || o.x - o.w / 2 > maxX) continue;
            if (o.y + o.h / 2 < minY || o.y - o.h / 2 > maxY) continue;
            const r = Math.min(o.w, o.h) * 0.32; // trunk radius (smaller than visual canopy)
            const sides = 6;
            for (let i = 0; i < sides; i++) {
                const a1 = (Math.PI * 2 * i) / sides;
                const a2 = (Math.PI * 2 * (i + 1)) / sides;
                segments.push({
                    ax: o.x + Math.cos(a1) * r,
                    ay: o.y + Math.sin(a1) * r,
                    bx: o.x + Math.cos(a2) * r,
                    by: o.y + Math.sin(a2) * r,
                });
            }
        }

        // Add world border segments
        const wh = this.worldHalf;
        segments.push(
            { ax: -wh, ay: -wh, bx: wh, by: -wh },
            { ax: wh, ay: -wh, bx: wh, by: wh },
            { ax: wh, ay: wh, bx: -wh, by: wh },
            { ax: -wh, ay: wh, bx: -wh, by: -wh },
        );

        return segments;
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
        const sweepCount = 256;
        for (let i = 0; i < sweepCount; i++) {
            angles.add((Math.PI * 2 * i) / sweepCount);
        }

        // Cast toward each nearby segment endpoint (with tiny offsets for precision)
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
    drawLineOfSightShadow(ctx, camX, camY, viewW, viewH, z) {
        if (!this.me) return;
        // Only apply shadows inside large houses (mansion, warehouse, hospital, etc.)
        const currentHouse = this.getCurrentHouse();
        if (!currentHouse || !this.usesInteriorFog(currentHouse)) return;

        const px = this.me.x;
        const py = this.me.y;
        const maxDist = 900;

        const segments = this._gatherWallSegments(camX, camY, viewW, viewH, z);
        const polygon = this._buildVisibilityPolygon(px, py, segments, maxDist);
        if (polygon.length < 3) return;

        ctx.save();

        // Shadow color — dark but not pitch black, like Among Us
        ctx.fillStyle = 'rgba(8, 10, 14, 0.78)';

        // Build a single path: big outer rect + visibility polygon
        // Even-odd fill rule means the overlap (the polygon) punches a hole in the rect
        const ext = (viewW + viewH) / z + 1000;
        ctx.beginPath();
        // Outer rectangle (the dark overlay covering the whole world)
        ctx.rect(camX - ext, camY - ext, ext * 2, ext * 2);
        // Visibility polygon (wound opposite direction — but evenodd handles it regardless)
        ctx.moveTo(polygon[0].x, polygon[0].y);
        for (let i = 1; i < polygon.length; i++) {
            ctx.lineTo(polygon[i].x, polygon[i].y);
        }
        ctx.closePath();
        ctx.fill('evenodd');

        // Soft radial fade at the edge of vision
        // Use destination-out on a SEPARATE save so it only erases from what we just drew
        // Instead, draw an additive dark ring just outside the polygon edge
        const edgeGrad = ctx.createRadialGradient(px, py, maxDist * 0.7, px, py, maxDist * 1.1);
        edgeGrad.addColorStop(0, 'rgba(8, 10, 14, 0)');
        edgeGrad.addColorStop(1, 'rgba(8, 10, 14, 0.5)');
        ctx.fillStyle = edgeGrad;
        ctx.beginPath();
        ctx.arc(px, py, maxDist * 1.1, 0, Math.PI * 2);
        ctx.fill();

        // Dynamic muzzle flash light bloom inside dark houses
        if (this._muzzleFlash > 0.05) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            const flashRadius = 140 + this._muzzleFlash * 220;
            const flashGrad = ctx.createRadialGradient(px, py, 0, px, py, flashRadius);
            // Strong cutout in center, fading at edges
            flashGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
            flashGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.4)');
            flashGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = flashGrad;
            ctx.beginPath();
            ctx.arc(px, py, flashRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }

    findInteractChest(requireCursor = true) {
        if (!this.me) return null;
        const currentHouse = this.getCurrentHouse();
        const currentRoom = this.getCurrentRoom(currentHouse);
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

    getNearbyChest() {
        return this.findInteractChest(false);
    }

    draw(dt = 1 / 60) {
        if (this.externalCameraGetter) {
            const cam = this.externalCameraGetter();
            if (cam) {
                this.camera.x = cam.x;
                this.camera.y = cam.y;
                if (cam.zoom) this.zoom = cam.zoom;
            }
        } else if (!this.spectatorMode) {
            this.zoom = lerp(this.zoom, this.targetZoom, clamp(dt * 5, 0, 1));
        }

        // Update camera shake
        if (this.cameraShake.intensity > 0.05) {
            this.cameraShake.x = (Math.random() - 0.5) * this.cameraShake.intensity * 2;
            this.cameraShake.y = (Math.random() - 0.5) * this.cameraShake.intensity * 2;
            this.cameraShake.intensity *= this.cameraShake.decay;
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
        this.particles = this.particles.filter(p => {
            if (p.type === 'shell') {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
                p.vx *= 0.94; // Less air friction than dust/sparks
                p.vy *= 0.94;
                if (p.rotation !== undefined) {
                    p.rotation += p.rotSpeed * dt;
                    p.rotSpeed *= 0.91; // Slow down rotational spin
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
                p.vx *= 0.92;
                p.vy *= 0.92;
            }
            return p.life > 0;
        });

        // Interpolate remote players
        const interpSpeed = clamp(dt * 12, 0.05, 0.6);
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

        ctx.fillStyle = '#2d5426';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(z, z);
        ctx.translate(-camX, -camY);

        this.drawTerrain(ctx, camX, camY, W, H, z);
        const currentHouse = this.getCurrentHouse();
        const currentRoom = this.getCurrentRoom(currentHouse);
        this.hoveredChestId = this.findInteractChest()?.id || null;
        // Pass 1: Draw fields (grass overlays, crops, dirt field bases)
        for (const o of this.surfaceObstacles) {
            if (o.kind === 'field' && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawObstacle(ctx, o);
            }
        }

        // Pass 2: Draw river & lake sandy shore bases
        for (const o of this.surfaceObstacles) {
            if ((o.kind === 'river' || o.kind === 'water') && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawObstacleShore(ctx, o);
            }
        }

        // Pass 3: Draw road gravel/dirt shoulders (under the asphalt)
        for (const o of this.surfaceObstacles) {
            if (o.kind === 'road' && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawRoadShoulder(ctx, o);
            }
        }

        // Pass 4: Draw river & lake water bodies (seamlessly on top of shores)
        for (const o of this.surfaceObstacles) {
            if ((o.kind === 'river' || o.kind === 'water') && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawObstacleBody(ctx, o);
            }
        }

        // Pass 5: Draw road asphalt & dirt bodies (seamlessly on top of shoulders)
        for (const o of this.surfaceObstacles) {
            if (o.kind === 'road' && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawRoadBody(ctx, o);
            }
        }

        // Pass 6: Draw road markings (yellow centerlines, white borders) & tire tracks
        for (const o of this.surfaceObstacles) {
            if (o.kind === 'road' && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawRoadMarkings(ctx, o);
            }
        }

        // Draw blood decals on the ground
        this.drawBloodDecals(ctx);

        // Pass 7: Draw bridges (go on top of road/river intersections)
        for (const o of this.surfaceObstacles) {
            if (o.kind === 'bridge' && this.shouldDrawObstacle(o, currentHouse, currentRoom)) {
                this.drawObstacle(ctx, o);
            }
        }

        this.drawWorldBorder(ctx);
        for (const o of this.houseFloors) {
            if (!currentHouse || currentHouse.id !== o.id) this.drawHouseRoof(ctx, o);
        }
        for (const o of this.sortedWorldObstacles) {
            if (this.shouldDrawObstacle(o, currentHouse, currentRoom)) this.drawObstacle(ctx, o);
        }
        // Only use the new LOS shadow system (replaces old room shadows)
        this.drawLineOfSightShadow(ctx, camX, camY, W, H, z);

        // Draw zone (gas circle)
        this.drawZone(ctx);

        for (const l of this.loot) {
            if (!this.isLootHidden(l, currentHouse, currentRoom)) this.drawLoot(ctx, l);
        }
        for (const b of this.bullets) {
            if (!this.isPointHiddenByRooms(b.x, b.y, currentHouse, currentRoom)) this.drawBullet(ctx, b);
        }
        // Draw players with interpolation
        for (const p of this.players) {
            if (this.isPlayerHidden(p, currentHouse, currentRoom)) continue;
            const isMe = p.isYou || p.id === this.myId;
            if (!isMe) {
                // Apply interpolated positions for remote players
                const ip = this._interpPlayers.get(p.id);
                if (ip) {
                    p.x = ip.x;
                    p.y = ip.y;
                    p.angle = ip.angle;
                }
            }
            this.drawPlayer(ctx, p);
        }

        // Draw particles (world space)
        this.drawParticles(ctx);

        // Draw floating damage numbers (world space)
        this.drawDamageNumbers(ctx);

        ctx.restore();

        // Screen-space overlays
        this.drawMobileAimGuide(ctx);
        this.drawCrosshair(ctx);
        this.drawVignette(ctx, W, H);
        this.drawDamageIndicators(ctx, W, H);
        this.drawHitMarkers(ctx, W, H);
        this.drawKillFeed(ctx, W, H);
        this.drawLowAmmoWarning(ctx, W, H);
        this.drawMinimapPanel(ctx, W, H);
        this.drawLootToast(ctx, W, H);
    }

    drawTerrain(ctx, camX, camY, viewW, viewH, z) {
        const tile = 96;
        const halfW = viewW / z / 2 + tile;
        const halfH = viewH / z / 2 + tile;
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
        const pulse = 0.5 + Math.sin(Date.now() / 400) * 0.5;
        ctx.strokeStyle = `rgba(255, 80, 40, ${0.5 + pulse * 0.3})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = -(Date.now() / 40) % 20;
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

        if (kind === 'river') {
            ctx.fillStyle = '#c9aa72';
            ctx.fillRect(-o.w / 2 - 10, -o.h / 2 - 14, o.w + 20, o.h + 28);
        } else if (kind === 'water') {
            ctx.fillStyle = '#c9aa72';
            ctx.beginPath();
            ctx.ellipse(0, 0, o.w / 2 + 14, o.h / 2 + 14, 0, 0, Math.PI * 2);
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

        if (kind === 'river') {
            ctx.fillStyle = '#2a5e7a';
            ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);

            // Subtle centerline highlight to give water depth without animation
            ctx.fillStyle = 'rgba(80, 160, 200, 0.12)';
            ctx.fillRect(-o.w / 2 + 4, -o.h / 2 + o.h * 0.3, o.w - 8, o.h * 0.4);
        } else if (kind === 'water') {
            ctx.fillStyle = '#2a5e7a';
            ctx.beginPath();
            ctx.ellipse(0, 0, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
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
                ctx.moveTo(-o.w / 2, -o.h / 2);
                for (let xx = -o.w / 2 + step; xx <= o.w / 2; xx += step) {
                    const wobble = Math.sin(xx * 0.05 + roadId) * 5 + Math.cos(xx * 0.12) * 3;
                    ctx.lineTo(xx, -o.h / 2 + wobble);
                }
                ctx.lineTo(o.w / 2, o.h / 2);
                for (let xx = o.w / 2 - step; xx >= -o.w / 2; xx -= step) {
                    const wobble = Math.sin(xx * 0.05 - roadId) * 5 + Math.cos(xx * 0.12) * 3;
                    ctx.lineTo(xx, o.h / 2 + wobble);
                }
                ctx.closePath();
            } else {
                ctx.moveTo(o.w / 2, -o.h / 2);
                for (let yy = -o.h / 2 + step; yy <= o.h / 2; yy += step) {
                    const wobble = Math.sin(yy * 0.05 + roadId) * 5 + Math.cos(yy * 0.12) * 3;
                    ctx.lineTo(o.w / 2 + wobble, yy);
                }
                ctx.lineTo(-o.w / 2, o.h / 2);
                    ctx.lineTo(-o.w / 2 + wobble, yy);
                }
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

        // Roads are always wide (o.w is length, o.h is width) due to how addRoad works
        const inset = o.h / 2 + 8; // Pull markings back from the ends to prevent intersection overlap

        if (o.variant === 'asphalt') {
            // Faint asphalt cracks
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.lineWidth = 1;
            const seedVal = Math.round(o.x + o.y);
            if (seedVal % 3 === 0) {
                ctx.beginPath();
                ctx.moveTo(-o.w * 0.25, -o.h * 0.1);
                ctx.lineTo(-o.w * 0.2, o.h * 0.1);
                ctx.lineTo(-o.w * 0.18, o.h * 0.05);
                ctx.stroke();
            }
            if (seedVal % 5 === 0) {
                ctx.beginPath();
                ctx.moveTo(o.w * 0.15, o.h * 0.25);
                ctx.lineTo(o.w * 0.22, o.h * 0.18);
                ctx.lineTo(o.w * 0.26, o.h * 0.32);
                ctx.stroke();
            }

            // 3. Center Yellow Dashed Line
            const startX = -o.w / 2 + inset;
            const endX = o.w / 2 - inset;
            
            if (startX < endX) {
                ctx.strokeStyle = 'rgba(235, 185, 60, 0.72)';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([18, 14]);
                ctx.beginPath();
                ctx.moveTo(startX, 0);
                ctx.lineTo(endX, 0);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 4. White Edge Lines
                ctx.strokeStyle = 'rgba(240, 240, 240, 0.52)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(startX, -o.h / 2 + 8);
                ctx.lineTo(endX, -o.h / 2 + 8);
                ctx.moveTo(startX, o.h / 2 - 8);
                ctx.lineTo(endX, o.h / 2 - 8);
                ctx.stroke();
            }
        } else {
            // --- DIRT ROAD TIRE TRACKS ---
            const startX = -o.w / 2 + inset;
            const endX = o.w / 2 - inset;
            
            if (startX < endX) {
                ctx.strokeStyle = '#524330';
                ctx.lineWidth = 3.5;
                const trackOff = o.h * 0.18;
                ctx.beginPath();
                ctx.moveTo(startX, -trackOff);
                ctx.lineTo(endX, -trackOff);
                ctx.moveTo(startX, trackOff);
                ctx.lineTo(endX, trackOff);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    drawObstacle(ctx, o) {
        const kind = o.kind || 'crate';
        
        // Roads and water are now handled via layered passes
        if (kind === 'road' || kind === 'river' || kind === 'water') return;

        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowColor = 'rgba(18, 22, 18, 0.35)';
        ctx.shadowBlur = 7;
        ctx.shadowOffsetY = 6;
        if (kind === 'houseFloor') {
            ctx.shadowBlur = 0;
            // Floor with gradient for depth
            const floorColors = {
                mansion: { main: '#665c50', dark: '#584e44', line: 'rgba(255,240,200,0.06)' },
                warehouse: { main: '#566268', dark: '#48545a', line: 'rgba(200,220,240,0.06)' },
            };
            const fc = floorColors[o.variant] || { main: '#75664f', dark: '#655840', line: 'rgba(255,240,210,0.06)' };
            const floorGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
            floorGrad.addColorStop(0, fc.main);
            floorGrad.addColorStop(1, fc.dark);
            ctx.fillStyle = floorGrad;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 5);
            ctx.fill();
            // Plank/tile lines
            ctx.strokeStyle = fc.line;
            ctx.lineWidth = 1;
            const tileStep = o.variant === 'warehouse' ? 52 : 46;
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
            // Subtle inner border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.lineWidth = 1;
            roundRect(ctx, -o.w / 2 + 3, -o.h / 2 + 3, o.w - 6, o.h - 6, 4);
            ctx.stroke();
        } else if (kind === 'door') {
            ctx.shadowBlur = 0;
            const frame = o.variant === 'warehouse' ? '#2f3b40' : o.variant === 'mansion' ? '#4c3828' : '#543722';
            // Light spill from inside
            const lightGrad = ctx.createRadialGradient(0, -o.h * 0.15, 4, 0, 0, Math.max(o.w, o.h) * 0.8);
            lightGrad.addColorStop(0, 'rgba(255, 220, 140, 0.18)');
            lightGrad.addColorStop(0.5, 'rgba(255, 200, 100, 0.06)');
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
            ctx.beginPath();
            ctx.moveTo(-o.w / 2 + 3, o.h / 2 - 3);
            ctx.lineTo(-o.w / 2 + 3, -o.h / 2 + 5);
            ctx.lineTo(o.w / 2 - 3, -o.h / 2 + 5);
            ctx.lineTo(o.w / 2 - 3, o.h / 2 - 3);
            ctx.stroke();
            // Threshold warm light
            ctx.fillStyle = 'rgba(238, 205, 138, 0.28)';
            roundRect(ctx, -o.w / 2 + 10, o.h / 2 - 8, o.w - 20, 8, 3);
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
            };
            const wc = wallColors[o.variant] || { main: '#70583f', dark: '#5a4630', highlight: 'rgba(200,180,140,0.10)' };
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
            }
            // Outline
            ctx.strokeStyle = 'rgba(24,20,16,0.42)';
            ctx.lineWidth = 2;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.stroke();
        } else if (kind === 'furniture') {
            ctx.shadowBlur = 0;
            if (o.variant === 'bed') {
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
            ctx.shadowBlur = 0;
            // Fields are drawn without outlines so they merge seamlessly
            // Background patches under POIs
            let fillGrad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
            if (o.variant === 'quarry') {
                fillGrad.addColorStop(0, '#756852');
                fillGrad.addColorStop(1, '#665943');
            } else if (o.variant === 'industrial') {
                fillGrad.addColorStop(0, '#5a544c');
                fillGrad.addColorStop(1, '#4e4942');
            } else if (o.variant === 'estate' || o.variant === 'mansion') {
                fillGrad.addColorStop(0, '#4a6042');
                fillGrad.addColorStop(1, '#3f5238');
            } else if (o.variant === 'woods' || o.variant === 'camp') {
                fillGrad.addColorStop(0, '#384d32');
                fillGrad.addColorStop(1, '#2d4028');
            } else {
                fillGrad.addColorStop(0, '#586b4e');
                fillGrad.addColorStop(1, '#4d5e44');
            }
            ctx.fillStyle = fillGrad;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 25);
            ctx.fill();
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

    drawLoot(ctx, l) {
        const color = LOOT_COLORS[l.type] || '#d5d5d5';
        const isChest = l.type === 'chest' || l.type === 'deathCrate';
        const pulse = isChest ? 1 : (1 + Math.sin(Date.now() / 190 + l.x * 0.03) * 0.06);
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.scale(pulse, pulse);

        if (isChest) {
            const hovered = this.hoveredChestId === l.id;
            const isDeathCrate = l.type === 'deathCrate';
            const tierColor = isDeathCrate ? '#a855f7' : (RARITY_COLORS[l.tier] || '#d7c396');
            const glowRad = 34 + Math.sin(Date.now() / 260 + l.x * 0.035) * 5;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
            ctx.beginPath();
            ctx.ellipse(0, 9, 23, 10, 0, 0, Math.PI * 2);
            ctx.fill();

            const glowGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, glowRad);
            glowGrad.addColorStop(0, tierColor + '42');
            glowGrad.addColorStop(0.5, tierColor + '18');
            glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
            ctx.fill();

            if (hovered) {
                ctx.save();
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 15;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3.2;
                roundRect(ctx, -23, -18, 46, 34, 8);
                ctx.stroke();
                ctx.restore();
            }

            const palette = isDeathCrate
                ? { lid: '#3b2654', body: '#271b35', trim: '#a855f7', dark: '#120b1d', lock: '#f5d0fe' }
                : l.tier === 'military'
                    ? { lid: '#4f5d38', body: '#2f3b25', trim: '#20291a', dark: '#10170d', lock: '#c8ff86' }
                    : l.tier === 'rare'
                        ? { lid: '#7a3f23', body: '#4d2919', trim: '#d29a36', dark: '#261208', lock: '#ffe08a' }
                        : { lid: '#8a5730', body: '#5b351f', trim: '#2f2018', dark: '#20120b', lock: '#ffd45a' };

            ctx.save();
            ctx.rotate(isDeathCrate ? 0.04 : -0.055);

            ctx.fillStyle = 'rgba(18, 11, 6, 0.55)';
            roundRect(ctx, -18, 7, 36, 5, 3);
            ctx.fill();

            const bodyGrad = ctx.createLinearGradient(0, -5, 0, 15);
            bodyGrad.addColorStop(0, palette.body);
            bodyGrad.addColorStop(1, palette.dark);
            ctx.fillStyle = bodyGrad;
            ctx.strokeStyle = 'rgba(9, 10, 8, 0.95)';
            ctx.lineWidth = 2;
            roundRect(ctx, -20, -4, 40, 21, 5);
            ctx.fill();
            ctx.stroke();

            const lidGrad = ctx.createLinearGradient(0, -19, 0, 3);
            lidGrad.addColorStop(0, palette.lid);
            lidGrad.addColorStop(0.72, palette.body);
            lidGrad.addColorStop(1, palette.dark);
            ctx.fillStyle = lidGrad;
            ctx.beginPath();
            ctx.moveTo(-20, -3);
            ctx.lineTo(-20, -8);
            ctx.quadraticCurveTo(-15, -19, 0, -19);
            ctx.quadraticCurveTo(15, -19, 20, -8);
            ctx.lineTo(20, -3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-14, -13);
            ctx.quadraticCurveTo(0, -17, 14, -13);
            ctx.stroke();

            ctx.fillStyle = palette.trim;
            roundRect(ctx, -21, -5, 42, 4, 2);
            ctx.fill();
            ctx.fillStyle = isDeathCrate ? '#1a1026' : palette.trim;
            roundRect(ctx, -13, -18, 5, 34, 2);
            ctx.fill();
            roundRect(ctx, 8, -18, 5, 34, 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
            roundRect(ctx, -17, -2, 34, 3, 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            roundRect(ctx, -5, -2, 10, 10, 3);
            ctx.fill();
            ctx.fillStyle = palette.lock;
            roundRect(ctx, -3, 0, 6, 6, 2);
            ctx.fill();

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
            ctx.lineWidth = 2;
            ctx.shadowColor = color;
            ctx.shadowBlur = 7;

            if (l.type === 'weapon') {
                ctx.rotate(-0.22);
                const longGun = ['assault', 'dmr', 'sniper', 'lmg', 'shotgun'].includes(l.weaponType);
                roundRect(ctx, -15, -5, longGun ? 29 : 22, 9, 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillRect(longGun ? 12 : 6, -2, longGun ? 13 : 10, 4);
                ctx.fillStyle = '#252b27';
                ctx.fillRect(-8, 4, 7, 7);
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
                    ctx.lineDashOffset = -(Date.now() / 60) % 8;
                    ctx.beginPath();
                    ctx.arc(0, 0, 22, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        }
        ctx.restore();
    }

    drawBullet(ctx, b) {
        const tail = Math.atan2(b.vy || 0, b.vx || 1);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(tail);

        let length = 22;
        let thickness = 3.2;
        let color = '#fcd04c'; // Default standard ammo yellow
        let isPellet = false;

        const wt = b.weaponType;
        if (wt === 'shotgun') {
            length = 9;
            thickness = 3.6;
            color = '#e07328';
            isPellet = true;
        } else if (wt === 'sniper') {
            length = 46;
            thickness = 4.6;
            color = '#e23131'; // Sniper red caliber
        } else if (wt === 'assault' || wt === 'dmr') {
            length = 34;
            thickness = 3.6;
            color = '#fce277'; // 5.56 yellow caliber
        } else if (wt === 'smg' || wt === 'lmg') {
            length = 24;
            thickness = 2.8;
            color = '#ff9100'; // 9mm orange caliber
        }

        // Draw clean tracers without performance-heavy dropshadows/glows
        if (isPellet) {
            // Colored outer shell
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, thickness, 0, Math.PI * 2);
            ctx.fill();

            // White inner core
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, thickness * 0.58, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Outer colored trace border
            ctx.fillStyle = color;
            roundRect(ctx, -length, -thickness / 2, length + 2, thickness, thickness / 2);
            ctx.fill();

            // Inner white core trace (makes it pop, like in surviv.io)
            ctx.fillStyle = '#ffffff';
            roundRect(ctx, -length + 2, -thickness * 0.28, length - 1, thickness * 0.56, thickness * 0.28);
            ctx.fill();
        }

        ctx.restore();
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

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 5;

        // Body circle — surviv.io style thick outline
        ctx.fillStyle = p.color || '#77c7c8';
        ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(14, 20, 18, 0.78)';
        ctx.lineWidth = isMe ? 3.5 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Body highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(-3, -4, r * 0.32, 0, Math.PI * 2);
        ctx.fill();

        // Darker rim at bottom
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.arc(0, 3, r * 0.7, 0.3, Math.PI - 0.3);
        ctx.fill();

        this.drawWeapon(ctx, p.weapon, r, p.meleeStartedAt, p.meleeUntil, p.color, p.walkBob || 0);

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
        if (p.reloading && p.reloadEndAtLocal && p.reloadMs && p.reloadEndAtLocal > Date.now()) {
            const progress = clamp(1 - (p.reloadEndAtLocal - Date.now()) / p.reloadMs, 0, 1);
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

        if (!p.isBot) {
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
            if (this.hud.cashoutEndAt > Date.now()) {
                const total = this.hud.cashoutTotal || 10;
                const left = Math.max(0, (this.hud.cashoutEndAt - Date.now()) / 1000);
                const progress = 1 - left / total;
                drawCashoutProgressRing(ctx, p.x, p.y, r + 12, progress, { counterClockwise: true });
            }
        }
    }

    drawWeapon(ctx, weapon, r, meleeStartedAt = 0, meleeUntil = 0, playerColor = '#77c7c8', walkBob = 0) {
        ctx.fillStyle = '#222823';
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;

        let hands = null;

        if (weapon === 'fists') {
            const now = Date.now();
            const punching = meleeUntil > now && meleeStartedAt > 0;
            const duration = Math.max(1, meleeUntil - meleeStartedAt);
            const progress = punching ? clamp((now - meleeStartedAt) / duration, 0, 1) : 0;
            const thrust = punching ? Math.sin(progress * Math.PI) : 0;
            const leadTop = Math.floor(meleeStartedAt / 430) % 2 === 0;
            
            // Fists bob forward/backward alternately when running
            const topReach = r * (0.76 + (leadTop ? 0.92 * thrust : 0.08 * thrust)) + walkBob * 3.2;
            const bottomReach = r * (0.76 + (!leadTop ? 0.92 * thrust : 0.08 * thrust)) - walkBob * 3.2;

            if (punching && thrust > 0.12) {
                ctx.save();
                ctx.globalAlpha = thrust * 0.48;
                ctx.strokeStyle = '#f5df9a';
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
            ctx.strokeStyle = punching ? 'rgba(255, 232, 158, 0.9)' : 'rgba(255,255,255,0.34)';
            ctx.lineWidth = punching ? 2 : 1.5;
            for (const hand of [{ x: topReach, y: -6 }, { x: bottomReach, y: 6 }]) {
                ctx.beginPath();
                ctx.arc(hand.x, hand.y, punching ? 6.2 : 5.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
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

    drawHouseRoof(ctx, o) {
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

        if (variant === 'warehouse') {
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
            const seamStep = 18;
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
                    rustGrad.addColorStop(0, 'rgba(142, 78, 48, 0.35)');
                    rustGrad.addColorStop(0.5, 'rgba(112, 58, 32, 0.18)');
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
            const fanAngle = (Date.now() / 420) % (Math.PI * 2);
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

            const tileH = 18;
            const tileW = 22;
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

            const rowH = 15;
            const shingleW = 20;
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
                mossGrad.addColorStop(0, 'rgba(74, 114, 52, 0.52)');
                mossGrad.addColorStop(0.6, 'rgba(56, 92, 38, 0.28)');
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
            // --- DEFAULT HOUSE / VILLAGE / FARM / CAMP: Terracotta Clay Tiles ---
            const tileColor = '#c85e3a';
            const tileShadow = '#8a3a22';

            const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
            grad.addColorStop(0, tileColor);
            grad.addColorStop(0.5, tileShadow);
            grad.addColorStop(1, tileColor);
            ctx.fillStyle = grad;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 7);
            ctx.fill();

            const rowH = 14;
            const tileW = 16;
            ctx.save();
            roundRect(ctx, -hw - 2, -hh - 2, o.w + 4, o.h + 4, 6);
            ctx.clip();
            for (let yy = -hh + rowH; yy < hh + rowH; yy += rowH) {
                ctx.strokeStyle = 'rgba(50, 16, 8, 0.32)';
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
                ctx.strokeStyle = 'rgba(40, 10, 5, 0.22)';
                ctx.lineWidth = 1.2;
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
            ctx.fillStyle = '#b44e32';
            ctx.strokeStyle = '#2b1008';
            ctx.lineWidth = 2;
            roundRect(ctx, chX - chW/2, chY - chH, chW, chH, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#443f3c';
            ctx.fillRect(chX - chW/2 - 2, chY - chH, chW + 4, 3.5);
            ctx.strokeRect(chX - chW/2 - 2, chY - chH, chW + 4, 3.5);
            ctx.restore();

            ctx.strokeStyle = '#4e1c0d';
            ctx.lineWidth = 3.5;
            roundRect(ctx, -hw - 4, -hh - 4, o.w + 8, o.h + 8, 7);
            ctx.stroke();
        }

        // --- RIDGE LINE ---
        const ridgeColor = variant === 'warehouse' ? '#78878c' : variant === 'mansion' ? '#8b7659' : variant === 'barn' ? '#ece8e5' : '#b25032';
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

        // --- DOORWAY HIGHLIGHT ---
        const door = this.doorways.find(d => d.houseId === o.id);
        if (door) {
            const doorX = door.x - o.x;
            const doorY = door.y - o.y;
            const doorW = Math.max(door.w, 86);
            const lipH = Math.max(28, door.h * 1.15);
            
            ctx.fillStyle = 'rgba(10, 8, 5, 0.88)';
            roundRect(ctx, doorX - doorW / 2, doorY - lipH / 2, doorW, lipH, 6);
            ctx.fill();
            
            const trimColor = variant === 'warehouse' ? '#252e32' : variant === 'mansion' ? '#2f261f' : '#2c211b';
            ctx.fillStyle = trimColor;
            roundRect(ctx, doorX - doorW / 2 - 10, doorY - lipH / 2 - 5, 10, lipH + 7, 3);
            ctx.fill();
            roundRect(ctx, doorX + doorW / 2, doorY - lipH / 2 - 5, 10, lipH + 7, 3);
            ctx.fill();

            const entryGlow = ctx.createRadialGradient(doorX, doorY, 4, doorX, doorY, lipH * 1.25);
            entryGlow.addColorStop(0, 'rgba(255, 215, 130, 0.24)');
            entryGlow.addColorStop(0.5, 'rgba(255, 200, 110, 0.08)');
            entryGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = entryGlow;
            ctx.fillRect(doorX - doorW, doorY - lipH, doorW * 2, lipH * 2);

            ctx.fillStyle = 'rgba(236, 205, 140, 0.32)';
            roundRect(ctx, doorX - doorW / 2 + 10, doorY + lipH / 2 - 9, doorW - 20, 8, 3);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 238, 180, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(doorX - doorW / 2 + 11, doorY - lipH / 2 + 5);
            ctx.lineTo(doorX + doorW / 2 - 11, doorY - lipH / 2 + 5);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawVignette(ctx, W, H) {
        ctx.save();
        const radius = Math.max(W, H) * 0.72;
        const grad = ctx.createRadialGradient(W / 2, H / 2, radius * 0.25, W / 2, H / 2, radius);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.64, 'rgba(0, 0, 0, 0.08)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        const hpPct = clamp((this.hud.hp || 0) / (this.hud.maxHp || 100), 0, 1);
        if (hpPct > 0 && hpPct < 0.34) {
            ctx.globalAlpha = clamp((0.34 - hpPct) / 0.34, 0, 1) * 0.28;
            const danger = ctx.createRadialGradient(W / 2, H / 2, radius * 0.38, W / 2, H / 2, radius * 0.96);
            danger.addColorStop(0, 'rgba(120, 0, 0, 0)');
            danger.addColorStop(1, 'rgba(220, 32, 32, 0.72)');
            ctx.fillStyle = danger;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
    }

    drawLootToast(ctx, W, H) {
        if (!this.lootToast || this.lootToast.expiresAt < Date.now()) return;
        const now = Date.now();
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
        const pad = W < 760 ? 10 : 16;
        const panelW = W < 760 ? 164 : 190;
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
        const weaponW = W < 760 ? 148 : 172;
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
        drawGameMinimap(ctx, {
            screenW: W,
            screenH: H,
            isMobile: W < 760,
            centerX: this.camera.x,
            centerY: this.camera.y,
            viewHalfW,
            viewHalfH,
            players: minimapPlayers,
            food: lootDots,
            obstacles: this.minimap.obstacles?.length ? this.minimap.obstacles : this.obstacles,
            time: performance.now(),
        });

        // Draw zone circle on minimap
        if (this.zone && this.zone.radius > 0) {
            const minimapSize = W < 760 ? 90 : 128;
            const pad = W < 760 ? 8 : 14;
            const mx = W - pad - minimapSize / 2;
            const my = H - pad - minimapSize / 2;
            const scale = minimapSize / (this.worldHalf * 2);
            const zx = mx + (this.zone.x - this.camera.x) * scale + minimapSize / 2 - (this.camera.x + this.worldHalf) * scale;
            const zy = my + (this.zone.y - this.camera.y) * scale + minimapSize / 2 - (this.camera.y + this.worldHalf) * scale;
            // Simplified: draw zone relative to minimap center
            const zoneR = this.zone.radius * scale;
            const zoneCx = mx + (this.zone.x + this.worldHalf) * scale;
            const zoneCy = my + (this.zone.y + this.worldHalf) * scale;
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 80, 40, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(zoneCx, zoneCy, Math.max(1, zoneR), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    // ========== NEW VISUAL FEEDBACK METHODS ==========

    drawParticles(ctx) {
        if (this.particles.length === 0) return;
        ctx.save();
        for (const p of this.particles) {
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
                ctx.shadowColor = p.color || '#ffdd44';
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    drawDamageNumbers(ctx) {
        const now = Date.now();
        this.damageNumbers = this.damageNumbers.filter(d => now - d.spawnedAt < d.duration);
        if (this.damageNumbers.length === 0) return;
        ctx.save();
        for (const d of this.damageNumbers) {
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
        const now = Date.now();
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
        const now = Date.now();
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

    drawKillFeed(ctx, W, H) {
        if (this.killFeed.length === 0) return;
        const now = Date.now();
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
            ctx.fillStyle = '#ff6b6b';
            ctx.fillText(e.killer || '?', x + 8, y + 11);

            // Skull icon
            const killerW = ctx.measureText(e.killer || '?').width;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(' ☠ ', x + 8 + killerW, y + 11);

            // Victim name
            const midW = ctx.measureText(' ☠ ').width;
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(e.victim || '?', x + 8 + killerW + midW, y + 11);

            y += 26;
        }
        ctx.restore();
    }

    drawLowAmmoWarning(ctx, W, H) {
        if (this._lowAmmoPulse <= 0) return;
        ctx.save();
        const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.5;
        ctx.globalAlpha = this._lowAmmoPulse * pulse * 0.25;
        const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
        grad.addColorStop(0, 'rgba(255, 160, 0, 0)');
        grad.addColorStop(1, 'rgba(255, 160, 0, 0.5)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    spawnBloodDecal(x, y) {
        this.bloodDecals.push({
            x: x + (Math.random() - 0.5) * 8,
            y: y + (Math.random() - 0.5) * 8,
            size: 10 + Math.random() * 10,
            rotation: Math.random() * Math.PI * 2,
            opacity: 0.85,
            bornAt: Date.now(),
            fadeStartAt: Date.now() + 18000, // Stay solid for 18 seconds
            fadeDuration: 4000,             // Fade out over 4 seconds
        });
        // Cap to prevent memory leaks
        if (this.bloodDecals.length > 180) {
            this.bloodDecals.shift();
        }
    }

    drawBloodDecals(ctx) {
        const now = Date.now();
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
            const droplets = 3 + Math.floor(d.size * 0.12);
            for (let s = 0; s < droplets; s++) {
                const dist = d.size * (0.42 + Math.random() * 0.45);
                const a = (s * Math.PI * 2) / droplets + (Math.random() - 0.5) * 0.6;
                const sx = Math.cos(a) * dist;
                const sy = Math.sin(a) * dist;
                ctx.beginPath();
                ctx.arc(sx, sy, d.size * (0.10 + Math.random() * 0.1), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
}
