/**
 * Surviv client renderer - top-down shooter canvas.
 */

import { drawBalanceBadge } from '../balanceBadge.js';
import { drawCashoutProgressRing } from '../cashoutRing.js';

const WEAPON_LABELS = {
    pistol: 'M9 Pistol',
    smg: 'Vector SMG',
    shotgun: 'Pump Shotgun',
    assault: 'Scout Rifle',
};

const LOOT_COLORS = {
    money: '#ffd45a',
    medkit: '#5fe08a',
    armor: '#5d9cff',
    ammo: '#d7d1bb',
    weapon: '#f2774f',
};

const LOOT_LABELS = {
    money: '$',
    medkit: '+',
    armor: 'A',
    ammo: 'AM',
    weapon: 'W',
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

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

export class SurvivRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = { x: 0, y: 0 };
        this.zoom = 1;
        this.targetZoom = 1.08;
        this.worldHalf = 2000;
        this.myId = null;
        this.players = [];
        this.loot = [];
        this.bullets = [];
        this.obstacles = [];
        this.zone = { cx: 0, cy: 0, radius: 2000, shrinking: false };
        this.hud = {
            balance: 2,
            hp: 100,
            maxHp: 100,
            armor: 0,
            weapon: 'pistol',
            ammo: 15,
            clipSize: 15,
            reloading: false,
            kills: 0,
            cashoutEndAt: 0,
            cashoutTotal: 10,
            cashoutSeconds: 0,
        };
        this.keys = { w: false, a: false, s: false, d: false };
        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false };
        this.inputEnabled = true;
        this.spectatorMode = false;
        this.externalCameraGetter = null;
        this.running = false;
        this._raf = null;
        this._lastFrameAt = performance.now();
        this._onResize = () => this.resize();
        window.addEventListener('resize', this._onResize);
        this.resize();
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = this.canvas.parentElement?.getBoundingClientRect();
        const w = rect?.width || window.innerWidth;
        const h = rect?.height || window.innerHeight;
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
        this.players = tick.players || [];
        this.loot = tick.loot || [];
        this.bullets = tick.bullets || [];
        this.obstacles = tick.obstacles || [];
        if (tick.zone) this.zone = tick.zone;

        const me = tick.you || this.players.find(p => p.isYou);
        if (me) {
            this.hud.hp = me.hp;
            this.hud.maxHp = me.maxHp;
            this.hud.armor = me.armor;
            this.hud.weapon = me.weapon;
            this.hud.ammo = me.ammo;
            this.hud.clipSize = me.clipSize;
            this.hud.reloading = me.reloading;
            this.hud.kills = me.kills;
            if (!this.spectatorMode) {
                this.camera.x = lerp(this.camera.x, me.x, 0.42);
                this.camera.y = lerp(this.camera.y, me.y, 0.42);
            }
        }
        if (tick.dollarBalance != null) {
            this.hud.balance = tick.dollarBalance;
        }
    }

    screenToWorld(sx, sy) {
        const cx = this.viewW / 2;
        const cy = this.viewH / 2;
        return {
            x: (sx - cx) / this.zoom + this.camera.x,
            y: (sy - cy) / this.zoom + this.camera.y,
        };
    }

    getInputPayload() {
        let dx = 0;
        let dy = 0;
        if (this.keys.w) dy -= 1;
        if (this.keys.s) dy += 1;
        if (this.keys.a) dx -= 1;
        if (this.keys.d) dx += 1;
        const len = Math.hypot(dx, dy);
        if (len > 1e-6) {
            dx /= len;
            dy /= len;
        }
        const aimAngle = Math.atan2(
            this.mouse.worldY - this.camera.y,
            this.mouse.worldX - this.camera.x,
        );
        return {
            dx,
            dy,
            aimAngle,
            shooting: this.mouse.down && this.inputEnabled,
            reload: false,
        };
    }

    handleKeyDown(e) {
        const k = e.key.toLowerCase();
        if (k === 'w' || k === 'arrowup') this.keys.w = true;
        if (k === 'a' || k === 'arrowleft') this.keys.a = true;
        if (k === 's' || k === 'arrowdown') this.keys.s = true;
        if (k === 'd' || k === 'arrowright') this.keys.d = true;
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' '].includes(k)) {
            e.preventDefault();
        }
        if (k === 'r') return 'reload';
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
    }

    handlePointerDown() {
        this.mouse.down = true;
    }

    handlePointerUp() {
        this.mouse.down = false;
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
        this.drawWorldBorder(ctx);
        this.drawZone(ctx);
        const sortedObstacles = [...this.obstacles].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
        for (const o of sortedObstacles) this.drawObstacle(ctx, o);
        for (const l of this.loot) this.drawLoot(ctx, l);
        for (const b of this.bullets) this.drawBullet(ctx, b);
        for (const p of this.players) this.drawPlayer(ctx, p);

        ctx.restore();
        this.drawCrosshair(ctx);
        this.drawHud(ctx, W, H);
        this.drawMinimapPanel(ctx, W, H);
        this.drawVignette(ctx, W, H);
    }

    drawTerrain(ctx, camX, camY, viewW, viewH, z) {
        const tile = 96;
        const halfW = viewW / z / 2 + tile;
        const halfH = viewH / z / 2 + tile;
        const startX = Math.floor((camX - halfW) / tile) * tile;
        const endX = Math.ceil((camX + halfW) / tile) * tile;
        const startY = Math.floor((camY - halfH) / tile) * tile;
        const endY = Math.ceil((camY + halfH) / tile) * tile;

        ctx.fillStyle = '#58764f';
        ctx.fillRect(camX - halfW, camY - halfH, halfW * 2, halfH * 2);

        for (let x = startX; x <= endX; x += tile) {
            for (let y = startY; y <= endY; y += tile) {
                const n = seededNoise(x / tile, y / tile);
                ctx.fillStyle = n > 0.62 ? 'rgba(44,74,45,0.15)' : 'rgba(221,214,165,0.05)';
                ctx.fillRect(x, y, tile, tile);
                if (n > 0.82) {
                    ctx.fillStyle = 'rgba(35,70,40,0.18)';
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

    drawZone(ctx) {
        const { cx, cy, radius, shrinking } = this.zone;
        if (!radius) return;
        const wh = this.worldHalf * 1.5;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - wh, cy - wh, wh * 2, wh * 2);
        ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
        ctx.fillStyle = shrinking ? 'rgba(73, 42, 87, 0.42)' : 'rgba(70, 42, 70, 0.27)';
        ctx.fill('evenodd');
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = shrinking ? 'rgba(214, 93, 255, 0.72)' : 'rgba(214, 145, 255, 0.45)';
        ctx.lineWidth = shrinking ? 5 : 3;
        ctx.shadowColor = 'rgba(214, 93, 255, 0.5)';
        ctx.shadowBlur = shrinking ? 18 : 8;
        ctx.stroke();
        ctx.restore();
    }

    drawObstacle(ctx, o) {
        const kind = o.kind || 'crate';
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation || 0);
        ctx.shadowColor = 'rgba(18, 22, 18, 0.35)';
        ctx.shadowBlur = 7;
        ctx.shadowOffsetY = 6;

        if (kind === 'tree') {
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
        const pulse = 1 + Math.sin(Date.now() / 190 + l.x * 0.03) * 0.06;
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.scale(pulse, pulse);
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(18, 18, 14, 0.55)';
        ctx.lineWidth = 2;

        if (l.type === 'weapon') {
            ctx.rotate(-0.2);
            roundRect(ctx, -15, -5, 24, 10, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillRect(7, -2, 12, 4);
        } else if (l.type === 'medkit') {
            roundRect(ctx, -10, -10, 20, 20, 3);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-2, -7, 4, 14);
            ctx.fillRect(-7, -2, 14, 4);
        } else if (l.type === 'armor') {
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.lineTo(11, -6);
            ctx.lineTo(8, 9);
            ctx.lineTo(0, 14);
            ctx.lineTo(-8, 9);
            ctx.lineTo(-11, -6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, l.type === 'money' ? 10 : 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.fillStyle = l.type === 'money' ? '#3f3007' : '#111';
        ctx.font = '700 8px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(LOOT_LABELS[l.type] || '?', 0, 1);
        ctx.restore();
    }

    drawBullet(ctx, b) {
        const tail = Math.atan2(b.vy || 0, b.vx || 1);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(tail);
        ctx.fillStyle = '#ffe38b';
        ctx.shadowColor = '#ffe38b';
        ctx.shadowBlur = 8;
        roundRect(ctx, -6, -2, 12, 4, 2);
        ctx.fill();
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

        this.drawWeapon(ctx, p.weapon, r);

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

    drawWeapon(ctx, weapon, r) {
        ctx.fillStyle = '#222823';
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;
        if (weapon === 'shotgun') {
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
        } else if (weapon === 'assault') {
            roundRect(ctx, r * 0.2, -4, r * 1.55, 8, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillRect(r * 0.58, 3, 7, 9);
        } else {
            roundRect(ctx, r * 0.25, -3, r * 0.82, 6, 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    drawCrosshair(ctx) {
        if (!this.inputEnabled || this.spectatorMode) return;
        const x = this.mouse.x || this.viewW / 2;
        const y = this.mouse.y || this.viewH / 2;
        ctx.save();
        ctx.strokeStyle = this.mouse.down ? 'rgba(255, 226, 122, 0.9)' : 'rgba(255,255,255,0.72)';
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

    drawHud(ctx, W, H) {
        const pad = W < 760 ? 10 : 16;
        const panelW = W < 760 ? 164 : 190;
        const hpPct = clamp(this.hud.hp / (this.hud.maxHp || 100), 0, 1);
        const armorPct = clamp((this.hud.armor || 0) / 100, 0, 1);

        ctx.save();
        this.drawPanel(ctx, pad, pad, panelW, armorPct > 0 ? 76 : 58);
        ctx.fillStyle = '#dce8d9';
        ctx.font = '800 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('SURVIVOR', pad + 12, pad + 17);
        this.drawBar(ctx, pad + 12, pad + 26, panelW - 24, 12, hpPct, '#4fdb73', '#ef504d');
        if (armorPct > 0) {
            ctx.fillStyle = '#9fb7d6';
            ctx.font = '700 9px system-ui, sans-serif';
            ctx.fillText('ARMOR', pad + 12, pad + 52);
            this.drawBar(ctx, pad + 12, pad + 58, panelW - 24, 7, armorPct, '#5c9cff', '#5c9cff');
        }

        const weaponLabel = WEAPON_LABELS[this.hud.weapon] || 'M9 Pistol';
        const ammoText = this.hud.reloading ? 'RELOADING' : `${this.hud.ammo}/${this.hud.clipSize}`;
        const weaponW = W < 760 ? 148 : 172;
        this.drawPanel(ctx, W - pad - weaponW, pad, weaponW, 58);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#dce8d9';
        ctx.font = '800 13px system-ui, sans-serif';
        ctx.fillText(weaponLabel, W - pad - 12, pad + 20);
        ctx.fillStyle = this.hud.reloading ? '#ffd45a' : '#b9c5b3';
        ctx.font = '800 18px system-ui, sans-serif';
        ctx.fillText(ammoText, W - pad - 12, pad + 44);

        if (this.hud.kills > 0) {
            const text = `${this.hud.kills} ELIMS`;
            const w = 88;
            this.drawPanel(ctx, W / 2 - w / 2, pad, w, 30);
            ctx.fillStyle = '#ff896b';
            ctx.font = '800 12px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(text, W / 2, pad + 20);
        }
        ctx.restore();
    }

    drawPanel(ctx, x, y, w, h) {
        ctx.save();
        ctx.fillStyle = 'rgba(18, 24, 20, 0.72)';
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;
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
        ctx.strokeStyle = 'rgba(255,255,255,0.13)';
        ctx.lineWidth = 1;
        roundRect(ctx, x, y, w, h, 3);
        ctx.stroke();
    }

    drawMinimapPanel(ctx, W, H) {
        const size = W < 760 ? 92 : 124;
        const x = W - size - 14;
        const y = H - size - 14;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const scale = size / (this.worldHalf * 2);

        ctx.save();
        ctx.fillStyle = 'rgba(18, 24, 20, 0.72)';
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1;
        roundRect(ctx, x, y, size, size, 7);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x + 6, y + 6, size - 12, size - 12);
        ctx.clip();

        ctx.fillStyle = '#58764f';
        ctx.fillRect(x + 6, y + 6, size - 12, size - 12);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.strokeRect(cx - this.worldHalf * scale, cy - this.worldHalf * scale, this.worldHalf * 2 * scale, this.worldHalf * 2 * scale);

        if (this.zone?.radius) {
            ctx.beginPath();
            ctx.arc(cx, cy, this.zone.radius * scale, 0, Math.PI * 2);
            ctx.strokeStyle = this.zone.shrinking ? 'rgba(214,93,255,0.78)' : 'rgba(214,145,255,0.46)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        for (const p of this.players) {
            const mx = cx + p.x * scale;
            const my = cy + p.y * scale;
            ctx.fillStyle = p.isYou || p.id === this.myId ? '#ffffff' : (p.isBot ? '#e5b66a' : '#ff735e');
            ctx.beginPath();
            ctx.arc(mx, my, p.isYou || p.id === this.myId ? 3.2 : 2.1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawVignette(ctx, W, H) {
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.72);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }
}