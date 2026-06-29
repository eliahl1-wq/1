/**
 * Surviv client renderer - top-down shooter canvas.
 */

import { drawBalanceBadge } from '../balanceBadge.js';
import { drawCashoutProgressRing } from '../cashoutRing.js';
import { drawGameMinimap } from '../minimap.js';

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
    fists: 0, pistol: 1.8, revolver: 4, smg: 0.8, shotgun: 5,
    assault: 1.5, dmr: 3, sniper: 7, lmg: 1.2,
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
        const me = tick.you || (tick.players || []).find(p => p.isYou || p.id === this.myId);
        const rawPlayers = tick.players || [];
        this.players = me
            ? [me, ...rawPlayers.filter(p => p.id !== me.id && !p.isYou)]
            : rawPlayers;
        this.loot = tick.loot || [];
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
        const surfaceKinds = new Set(['road', 'houseFloor', 'field', 'water']);
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
        if (touches && centerDist < Math.max(room.w + currentRoom.w, room.h + currentRoom.h) * 0.82) return 0.42;
        if (playerDist < 230) return 0.24;
        return 0;
    }

    isPointHiddenByRooms(x, y, currentHouse, currentRoom) {
        const house = this.findHouseContainingPoint(x, y);
        if (!house) return false;
        if (!currentHouse || house.id !== currentHouse.id) return true;
        if (!this.usesInteriorFog(currentHouse)) return false;
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
            return !currentRoom || !o._insideRoomId || o._insideRoomId === currentRoom.id;
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
        ctx.fillStyle = 'rgba(3, 4, 5, 0.74)';
        roundRect(ctx, currentHouse.x - currentHouse.w / 2 + 8, currentHouse.y - currentHouse.h / 2 + 8, currentHouse.w - 16, currentHouse.h - 16, 7);
        ctx.fill();

        ctx.globalCompositeOperation = 'destination-out';
        for (const room of zones) {
            const strength = this.roomVisibilityStrength(room, currentRoom, this.me.x, this.me.y);
            if (strength <= 0) continue;
            const pad = room.id === currentRoom.id ? 34 : 14;
            ctx.globalAlpha = strength;
            roundRect(ctx, room.x - room.w / 2 - pad, room.y - room.h / 2 - pad, room.w + pad * 2, room.h + pad * 2, 20);
            ctx.fill();
        }
        ctx.globalAlpha = 0.92;
        const r = currentHouse.variant === 'mansion' ? 310 : 255;
        const glow = ctx.createRadialGradient(this.me.x, this.me.y, 24, this.me.x, this.me.y, r);
        glow.addColorStop(0, 'rgba(0,0,0,1)');
        glow.addColorStop(0.62, 'rgba(0,0,0,0.72)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(this.me.x, this.me.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255, 230, 170, 0.12)';
        ctx.lineWidth = 2;
        roundRect(ctx, currentRoom.x - currentRoom.w / 2, currentRoom.y - currentRoom.h / 2, currentRoom.w, currentRoom.h, 10);
        ctx.stroke();
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

        const ctx = this.ctx;
        const W = this.viewW;
        const H = this.viewH;
        const camX = this.camera.x;
        const camY = this.camera.y;
        const z = this.zoom;

        ctx.fillStyle = '#48664a';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(z, z);
        ctx.translate(-camX, -camY);

        this.drawTerrain(ctx, camX, camY, W, H, z);
        const currentHouse = this.getCurrentHouse();
        const currentRoom = this.getCurrentRoom(currentHouse);
        this.hoveredChestId = this.findInteractChest()?.id || null;
        for (const o of this.surfaceObstacles) {
            if (this.shouldDrawObstacle(o, currentHouse, currentRoom)) this.drawObstacle(ctx, o);
        }
        this.drawWorldBorder(ctx);
        for (const o of this.houseFloors) {
            if (!currentHouse || currentHouse.id !== o.id) this.drawHouseRoof(ctx, o);
        }
        for (const o of this.sortedWorldObstacles) {
            if (this.shouldDrawObstacle(o, currentHouse, currentRoom)) this.drawObstacle(ctx, o);
        }
        this.drawRoomShadows(ctx, currentHouse, currentRoom);
        for (const l of this.loot) {
            if (!this.isLootHidden(l, currentHouse, currentRoom)) this.drawLoot(ctx, l);
        }
        for (const b of this.bullets) {
            if (!this.isPointHiddenByRooms(b.x, b.y, currentHouse, currentRoom)) this.drawBullet(ctx, b);
        }
        for (const p of this.players) {
            if (!this.isPlayerHidden(p, currentHouse, currentRoom)) this.drawPlayer(ctx, p);
        }

        ctx.restore();
        this.drawMobileAimGuide(ctx);
        this.drawCrosshair(ctx);
        this.drawVignette(ctx, W, H);
        // Handled by React UI overlay: this.drawHud(ctx, W, H);
        this.drawMinimapPanel(ctx, W, H);
        this.drawLootToast(ctx, W, H);

        // Handled by React UI overlay
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
                const b = biomeAt(x + tile / 2, y + tile / 2);
                ctx.fillStyle = n > 0.62 ? b.grass : 'rgba(221,214,165,0.05)';
                ctx.fillRect(x, y, tile, tile);
                if (n > 0.82) {
                    ctx.fillStyle = b.grass;
                    ctx.beginPath();
                    ctx.ellipse(x + tile * 0.4, y + tile * 0.55, tile * 0.24, tile * 0.07, n * 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        ctx.strokeStyle = 'rgba(25,40,28,0.16)';
        ctx.lineWidth = 1;
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

    drawZone() {
        return;
    }

    drawObstacle(ctx, o) {
        const kind = o.kind || 'crate';
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowColor = 'rgba(18, 22, 18, 0.35)';
        ctx.shadowBlur = 7;
        ctx.shadowOffsetY = 6;

        if (kind === 'road') {
            ctx.shadowBlur = 0;
            ctx.fillStyle = o.variant === 'asphalt' ? 'rgba(61, 65, 58, 0.76)' : 'rgba(117, 104, 76, 0.64)';
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 12);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.07)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-o.w / 2 + 14, 0);
            ctx.lineTo(o.w / 2 - 14, 0);
            ctx.stroke();
        } else if (kind === 'field') {
            ctx.shadowBlur = 0;
            const colors = {
                estate: 'rgba(75, 100, 62, 0.28)',
                industrial: 'rgba(86, 88, 78, 0.32)',
                quarry: 'rgba(112, 108, 96, 0.34)',
                crop: 'rgba(134, 122, 59, 0.32)',
                woods: 'rgba(44, 80, 45, 0.26)',
                farm: 'rgba(118, 105, 54, 0.24)',
                camp: 'rgba(73, 92, 62, 0.26)',
                scrub: 'rgba(119, 106, 63, 0.24)',
                wetlands: 'rgba(46, 86, 74, 0.22)',
                ruins: 'rgba(88, 86, 76, 0.28)',
                village: 'rgba(75, 94, 62, 0.22)',
                'snow-woods': 'rgba(186, 205, 202, 0.18)',
            };
            ctx.fillStyle = colors[o.variant] || 'rgba(68, 92, 61, 0.22)';
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 18);
            ctx.fill();
        } else if (kind === 'water') {
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(56, 104, 122, 0.58)';
            ctx.beginPath();
            ctx.ellipse(0, 0, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(194,228,225,0.18)';
            ctx.lineWidth = 3;
            ctx.stroke();
        } else if (kind === 'houseFloor') {
            ctx.shadowBlur = 0;
            const fill = o.variant === 'mansion' ? '#665c50' : o.variant === 'warehouse' ? '#566268' : '#75664f';
            ctx.fillStyle = fill;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 5);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 2;
            for (let ix = -o.w / 2 + 46; ix < o.w / 2; ix += 46) {
                ctx.beginPath();
                ctx.moveTo(ix, -o.h / 2 + 8);
                ctx.lineTo(ix, o.h / 2 - 8);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(25, 20, 15, 0.18)';
            for (let iy = -o.h / 2 + 46; iy < o.h / 2; iy += 46) {
                ctx.beginPath();
                ctx.moveTo(-o.w / 2 + 8, iy);
                ctx.lineTo(o.w / 2 - 8, iy);
                ctx.stroke();
            }
        } else if (kind === 'door') {
            ctx.shadowBlur = 0;
            const frame = o.variant === 'warehouse' ? '#2f3b40' : o.variant === 'mansion' ? '#4c3828' : '#543722';
            ctx.fillStyle = 'rgba(8, 7, 5, 0.88)';
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 5);
            ctx.fill();
            ctx.strokeStyle = frame;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(-o.w / 2 + 3, o.h / 2 - 3);
            ctx.lineTo(-o.w / 2 + 3, -o.h / 2 + 5);
            ctx.lineTo(o.w / 2 - 3, -o.h / 2 + 5);
            ctx.lineTo(o.w / 2 - 3, o.h / 2 - 3);
            ctx.stroke();
            ctx.fillStyle = 'rgba(238, 205, 138, 0.24)';
            roundRect(ctx, -o.w / 2 + 10, o.h / 2 - 8, o.w - 20, 8, 3);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.14)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-o.w / 2 + 10, -o.h / 2 + 9);
            ctx.lineTo(o.w / 2 - 10, -o.h / 2 + 9);
            ctx.stroke();
        } else if (kind === 'wall' || kind === 'interiorWall') {
            const wallFill = o.variant === 'stone' ? '#80796b' : o.variant === 'warehouse' ? '#425159' : '#70583f';
            ctx.fillStyle = wallFill;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 3);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            if (o.w > o.h) ctx.fillRect(-o.w / 2 + 3, -o.h / 2 + 2, o.w - 6, Math.max(2, o.h * 0.22));
            else ctx.fillRect(-o.w / 2 + 2, -o.h / 2 + 3, Math.max(2, o.w * 0.22), o.h - 6);
            ctx.strokeStyle = 'rgba(24,20,16,0.48)';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (kind === 'furniture') {
            ctx.shadowBlur = 0;
            ctx.fillStyle = o.variant === 'bed' ? '#4f6f82' : '#6d4a2f';
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 4);
            ctx.fill();
        } else if (kind === 'tree') {
            const r = Math.max(o.w, o.h) / 2;
            ctx.fillStyle = '#684321';
            roundRect(ctx, -r * 0.16, -r * 0.1, r * 0.32, r * 0.58, r * 0.08);
            ctx.fill();
            ctx.fillStyle = `hsl(${o.hue ?? 118}, 38%, 30%)`;
            ctx.beginPath();
            ctx.arc(0, -r * 0.1, r * 0.82, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `hsl(${(o.hue ?? 118) + 8}, 44%, 38%)`;
            ctx.beginPath();
            ctx.arc(-r * 0.18, -r * 0.28, r * 0.36, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(20, 35, 19, 0.36)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, -r * 0.1, r * 0.82, 0, Math.PI * 2);
            ctx.stroke();
        } else if (kind === 'bush') {
            const r = Math.max(o.w, o.h) / 2;
            ctx.shadowBlur = 4;
            ctx.fillStyle = 'hsl(' + (o.hue ?? 105) + ', 34%, 30%)';
            ctx.beginPath();
            ctx.arc(-r * 0.18, -r * 0.02, r * 0.55, 0, Math.PI * 2);
            ctx.arc(r * 0.2, r * 0.02, r * 0.52, 0, Math.PI * 2);
            ctx.arc(0, -r * 0.22, r * 0.48, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'barrel') {
            const r = Math.max(o.w, o.h) / 2;
            ctx.fillStyle = 'hsl(' + (o.hue ?? 22) + ', 44%, 37%)';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(20,18,15,0.45)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.16)';
            ctx.beginPath();
            ctx.moveTo(-r * 0.7, -r * 0.2);
            ctx.lineTo(r * 0.7, -r * 0.2);
            ctx.moveTo(-r * 0.7, r * 0.22);
            ctx.lineTo(r * 0.7, r * 0.22);
            ctx.stroke();
        } else if (kind === 'sandbag') {
            ctx.fillStyle = '#9b8a5e';
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(48,40,24,0.36)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.moveTo(0, -o.h / 2 + 3);
            ctx.lineTo(0, o.h / 2 - 3);
            ctx.stroke();
        } else if (kind === 'tent') {
            ctx.fillStyle = 'hsl(' + (o.hue ?? 82) + ', 30%, 34%)';
            ctx.beginPath();
            ctx.moveTo(-o.w / 2, o.h / 2);
            ctx.lineTo(0, -o.h / 2);
            ctx.lineTo(o.w / 2, o.h / 2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(18,20,16,0.45)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.14)';
            ctx.beginPath();
            ctx.moveTo(0, -o.h / 2 + 6);
            ctx.lineTo(0, o.h / 2 - 5);
            ctx.stroke();
        } else if (kind === 'rock') {
            ctx.fillStyle = `hsl(${o.hue ?? 218}, 12%, 42%)`;
            ctx.beginPath();
            ctx.moveTo(-o.w * 0.42, -o.h * 0.08);
            ctx.lineTo(-o.w * 0.18, -o.h * 0.42);
            ctx.lineTo(o.w * 0.3, -o.h * 0.36);
            ctx.lineTo(o.w * 0.46, o.h * 0.12);
            ctx.lineTo(o.w * 0.12, o.h * 0.42);
            ctx.lineTo(-o.w * 0.36, o.h * 0.28);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(20,24,27,0.36)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.13)';
            ctx.fillRect(-o.w * 0.2, -o.h * 0.24, o.w * 0.28, 3);
        } else {
            const isHouse = kind === 'house';
            const isContainer = kind === 'container';
            const fill = isHouse ? `hsl(${o.hue ?? 18}, 30%, 42%)` : isContainer ? `hsl(${o.hue ?? 205}, 42%, 34%)` : `hsl(${o.hue ?? 30}, 38%, 34%)`;
            ctx.fillStyle = fill;
            roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, isHouse ? 4 : 3);
            ctx.fill();
            ctx.strokeStyle = 'rgba(22,20,18,0.38)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.shadowBlur = 0;
            if (isHouse) {
                ctx.fillStyle = 'rgba(68,38,30,0.65)';
                ctx.fillRect(-o.w / 2 + 8, -o.h / 2 + 8, o.w - 16, 10);
                ctx.fillStyle = 'rgba(18,24,26,0.45)';
                ctx.fillRect(-o.w * 0.18, o.h * 0.05, o.w * 0.26, o.h * 0.35);
                ctx.fillStyle = 'rgba(239,209,124,0.55)';
                ctx.fillRect(o.w * 0.18, -o.h * 0.2, o.w * 0.18, o.h * 0.14);
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                const lines = isContainer ? 4 : 2;
                for (let i = 1; i <= lines; i++) {
                    const xx = -o.w / 2 + (o.w / (lines + 1)) * i;
                    ctx.moveTo(xx, -o.h / 2 + 5);
                    ctx.lineTo(xx, o.h / 2 - 5);
                }
                ctx.stroke();
            }
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
        }
        ctx.restore();
    }

    drawBullet(ctx, b) {
        const tail = Math.atan2(b.vy || 0, b.vx || 1);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(tail);

        let length = 20;
        let thickness = 3;
        let color = '#ffd45a';
        let glowColor = 'rgba(255, 212, 90, 0.4)';
        let isPellet = false;

        const wt = b.weaponType;
        if (wt === 'shotgun') {
            length = 8;
            thickness = 3.5;
            color = '#ff8c3b';
            glowColor = 'rgba(255, 140, 59, 0.5)';
            isPellet = true;
        } else if (wt === 'sniper') {
            length = 42;
            thickness = 4.5;
            color = '#ff3b3b';
            glowColor = 'rgba(255, 59, 59, 0.6)';
        } else if (wt === 'assault' || wt === 'dmr') {
            length = 32;
            thickness = 3.2;
            color = '#ffe38b';
            glowColor = 'rgba(255, 227, 139, 0.5)';
        } else if (wt === 'smg' || wt === 'lmg') {
            length = 22;
            thickness = 2.8;
            color = '#ffb03b';
            glowColor = 'rgba(255, 176, 59, 0.45)';
        }

        ctx.shadowColor = color;
        ctx.shadowBlur = isPellet ? 6 : 10;
        
        if (isPellet) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, thickness, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const grad = ctx.createLinearGradient(-length, 0, 4, 0);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            grad.addColorStop(0.3, glowColor);
            grad.addColorStop(0.8, color);
            grad.addColorStop(1, '#ffffff');
            
            ctx.fillStyle = grad;
            roundRect(ctx, -length, -thickness / 2, length + 4, thickness, thickness / 2);
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

        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = p.color || '#77c7c8';
        ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(14, 20, 18, 0.68)';
        ctx.lineWidth = isMe ? 3 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(-4, -5, r * 0.36, 0, Math.PI * 2);
        ctx.fill();

        this.drawWeapon(ctx, p.weapon, r, p.meleeStartedAt, p.meleeUntil, p.color);

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

    drawWeapon(ctx, weapon, r, meleeStartedAt = 0, meleeUntil = 0, playerColor = '#77c7c8') {
        ctx.fillStyle = '#222823';
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;
        if (weapon === 'fists') {
            const now = Date.now();
            const punching = meleeUntil > now && meleeStartedAt > 0;
            const duration = Math.max(1, meleeUntil - meleeStartedAt);
            const progress = punching ? clamp((now - meleeStartedAt) / duration, 0, 1) : 0;
            const thrust = punching ? Math.sin(progress * Math.PI) : 0;
            const leadTop = Math.floor(meleeStartedAt / 430) % 2 === 0;
            const topReach = r * (0.76 + (leadTop ? 0.92 * thrust : 0.08 * thrust));
            const bottomReach = r * (0.76 + (!leadTop ? 0.92 * thrust : 0.08 * thrust));

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
        } else if (weapon === 'shotgun') {
            roundRect(ctx, r * 0.25, -3, r * 1.35, 6, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#8c5b2f';
            ctx.fillRect(r * 0.3, 2, 10, 4);
        } else if (weapon === 'smg') {
            roundRect(ctx, r * 0.2, -4, r * 1.0, 8, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillRect(r * 0.68, 3, 5, 8);
        } else if (weapon === 'assault' || weapon === 'dmr') {
            roundRect(ctx, r * 0.2, -4, r * (weapon === 'dmr' ? 1.8 : 1.55), 8, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillRect(r * 0.58, 3, 7, 9);
            if (weapon === 'dmr') ctx.fillRect(r * 1.25, -8, 10, 3);
        } else if (weapon === 'sniper') {
            roundRect(ctx, r * 0.16, -3, r * 2.05, 6, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#4a545a';
            ctx.fillRect(r * 0.65, -9, 18, 4);
        } else if (weapon === 'lmg') {
            roundRect(ctx, r * 0.12, -5, r * 1.75, 10, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillRect(r * 0.5, 5, 12, 10);
            ctx.fillRect(r * 1.22, -2, 16, 4);
        } else if (weapon === 'revolver') {
            roundRect(ctx, r * 0.22, -3, r * 0.98, 6, 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(r * 0.42, 0, 5, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            roundRect(ctx, r * 0.25, -3, r * 0.82, 6, 2);
            ctx.fill();
            ctx.stroke();
        }
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
        const palette = o.variant === 'mansion'
            ? { main: '#74614a', dark: '#46382c', ridge: '#8b7659', trim: '#2f261f' }
            : o.variant === 'warehouse'
                ? { main: '#59686e', dark: '#344249', ridge: '#78878c', trim: '#263238' }
                : o.variant === 'barn'
                    ? { main: '#783f32', dark: '#4a241f', ridge: '#985747', trim: '#2c1714' }
                    : { main: '#6c513b', dark: '#3c2b22', ridge: '#80664c', trim: '#2c211b' };

        ctx.shadowColor = 'rgba(10, 14, 10, 0.42)';
        ctx.shadowBlur = 13;
        ctx.shadowOffsetY = 9;
        ctx.fillStyle = palette.trim;
        roundRect(ctx, -o.w / 2 - 9, -o.h / 2 - 7, o.w + 18, o.h + 16, 8);
        ctx.fill();
        ctx.shadowBlur = 0;

        const grad = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
        grad.addColorStop(0, palette.main);
        grad.addColorStop(1, palette.dark);
        ctx.fillStyle = grad;
        roundRect(ctx, -o.w / 2 - 4, -o.h / 2 - 4, o.w + 8, o.h + 8, 7);
        ctx.fill();

        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.moveTo(-o.w / 2 - 4, -o.h / 2 - 4);
        ctx.lineTo(0, -o.h / 2 - 32);
        ctx.lineTo(o.w / 2 + 4, -o.h / 2 - 4);
        ctx.lineTo(o.w / 2 + 2, o.h / 2 + 4);
        ctx.lineTo(0, o.h / 2 + 24);
        ctx.lineTo(-o.w / 2 - 2, o.h / 2 + 4);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.11)';
        ctx.lineWidth = 2;
        const shingleStep = o.variant === 'mansion' ? 54 : 42;
        for (let yy = -o.h / 2 + shingleStep; yy < o.h / 2; yy += shingleStep) {
            ctx.beginPath();
            ctx.moveTo(-o.w / 2 + 10, yy);
            ctx.lineTo(o.w / 2 - 10, yy - 8);
            ctx.stroke();
        }

        ctx.strokeStyle = palette.ridge;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -o.h / 2 - 28);
        ctx.lineTo(0, o.h / 2 + 20);
        ctx.stroke();

        const door = this.doorways.find(d => d.houseId === o.id);
        if (door) {
            const doorX = door.x - o.x;
            const doorY = door.y - o.y;
            const doorW = Math.max(door.w, 86);
            const lipH = Math.max(28, door.h * 1.15);
            ctx.fillStyle = 'rgba(12, 10, 8, 0.82)';
            roundRect(ctx, doorX - doorW / 2, doorY - lipH / 2, doorW, lipH, 6);
            ctx.fill();
            ctx.fillStyle = palette.trim;
            roundRect(ctx, doorX - doorW / 2 - 10, doorY - lipH / 2 - 5, 10, lipH + 7, 3);
            ctx.fill();
            roundRect(ctx, doorX + doorW / 2, doorY - lipH / 2 - 5, 10, lipH + 7, 3);
            ctx.fill();
            ctx.fillStyle = 'rgba(236, 205, 140, 0.28)';
            roundRect(ctx, doorX - doorW / 2 + 10, doorY + lipH / 2 - 9, doorW - 20, 8, 3);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 238, 180, 0.34)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(doorX - doorW / 2 + 11, doorY - lipH / 2 + 5);
            ctx.lineTo(doorX + doorW / 2 - 11, doorY - lipH / 2 + 5);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(12, 10, 8, 0.42)';
        ctx.lineWidth = 2;
        roundRect(ctx, -o.w / 2 - 4, -o.h / 2 - 4, o.w + 8, o.h + 8, 7);
        ctx.stroke();
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
    }
}
