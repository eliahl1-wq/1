/**
 * Surviv client renderer — top-down shooter canvas.
 */

import { drawBalanceBadge } from '../balanceBadge.js';
import { drawCashoutProgressRing } from '../cashoutRing.js';

const WEAPON_LABELS = {
    pistol: 'Pistol',
    smg: 'SMG',
    shotgun: 'Shotgun',
    assault: 'Assault',
};

const LOOT_COLORS = {
    money: '#ffd060',
    medkit: '#60ff90',
    armor: '#60a0ff',
    ammo: '#c0c0c0',
    weapon: '#ff8060',
};

export class SurvivRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = { x: 0, y: 0 };
        this.zoom = 1;
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
    }

    destroy() {
        this.pause();
        window.removeEventListener('resize', this._onResize);
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
                this.camera.x = me.x;
                this.camera.y = me.y;
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
            dx, dy, aimAngle,
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
        if (k === 'r') return 'reload';
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

    draw() {
        if (this.externalCameraGetter) {
            const cam = this.externalCameraGetter();
            if (cam) {
                this.camera.x = cam.x;
                this.camera.y = cam.y;
                if (cam.zoom) this.zoom = cam.zoom;
            }
        }

        const ctx = this.ctx;
        const W = this.viewW;
        const H = this.viewH;
        const camX = this.camera.x;
        const camY = this.camera.y;
        const z = this.zoom;

        ctx.fillStyle = '#12141a';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(z, z);
        ctx.translate(-camX, -camY);

        this.drawGrid(ctx, camX, camY, W, H, z);
        this.drawZone(ctx);
        for (const o of this.obstacles) this.drawObstacle(ctx, o);
        for (const l of this.loot) this.drawLoot(ctx, l);
        for (const b of this.bullets) this.drawBullet(ctx, b);
        for (const p of this.players) this.drawPlayer(ctx, p);

        ctx.restore();
        this.drawHud(ctx, W, H);
        this.drawMinimapPanel(ctx, W, H);
    }

    drawGrid(ctx, camX, camY, viewW, viewH, z) {
        const step = 80;
        const halfW = viewW / z / 2 + step;
        const halfH = viewH / z / 2 + step;
        const startX = Math.floor((camX - halfW) / step) * step;
        const endX = Math.ceil((camX + halfW) / step) * step;
        const startY = Math.floor((camY - halfH) / step) * step;
        const endY = Math.ceil((camY + halfH) / step) * step;
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += step) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += step) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    }

    drawZone(ctx) {
        const { cx, cy, radius, shrinking } = this.zone;
        if (!radius) return;
        ctx.beginPath();
        ctx.arc(cx, cy, this.worldHalf, 0, Math.PI * 2);
        ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
        ctx.fillStyle = shrinking ? 'rgba(180, 40, 40, 0.22)' : 'rgba(120, 30, 30, 0.15)';
        ctx.fill('evenodd');
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = shrinking ? 'rgba(255, 80, 80, 0.55)' : 'rgba(255, 120, 120, 0.35)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    drawObstacle(ctx, o) {
        ctx.fillStyle = `hsl(${o.hue ?? 220}, 18%, 22%)`;
        ctx.strokeStyle = `hsl(${o.hue ?? 220}, 20%, 32%)`;
        ctx.lineWidth = 2;
        ctx.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
        ctx.strokeRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
    }

    drawLoot(ctx, l) {
        const color = LOOT_COLORS[l.type] || '#aaa';
        const pulse = 1 + Math.sin(Date.now() / 200 + l.x) * 0.08;
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        if (l.type === 'money') {
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 1);
        } else if (l.type === 'medkit') {
            ctx.fillRect(-8, -8, 16, 16);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-2, -6, 4, 12);
            ctx.fillRect(-6, -2, 12, 4);
        } else if (l.type === 'weapon') {
            ctx.fillRect(-10, -4, 18, 8);
            ctx.fillRect(6, -2, 8, 4);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawBullet(ctx, b) {
        ctx.fillStyle = '#ffe080';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    drawPlayer(ctx, p) {
        const r = 14;
        const isMe = p.isYou || p.id === this.myId;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);

        ctx.fillStyle = p.color || '#80d0d0';
        ctx.strokeStyle = isMe ? '#fff' : 'rgba(0,0,0,0.5)';
        ctx.lineWidth = isMe ? 2.5 : 1.5;
        ctx.shadowColor = p.color || '#80d0d0';
        ctx.shadowBlur = isMe ? 14 : 8;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.fillRect(r * 0.3, -3, r * 0.9, 6);

        ctx.restore();

        if (p.hp < p.maxHp) {
            const barW = 28;
            const pct = Math.max(0, p.hp / p.maxHp);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(p.x - barW / 2, p.y - r - 12, barW, 4);
            ctx.fillStyle = pct > 0.35 ? '#60dd60' : '#dd4040';
            ctx.fillRect(p.x - barW / 2, p.y - r - 12, barW * pct, 4);
        }

        if (!p.isBot) {
            ctx.fillStyle = '#fff';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.username || 'Player', p.x, p.y - r - 16);
        }

        if (isMe) {
            drawBalanceBadge(ctx, p.x, p.y + r + 14, this.hud.balance ?? p.dollarBalance ?? 0, true);
            if (this.hud.cashoutEndAt > Date.now()) {
                const total = this.hud.cashoutTotal || 10;
                const left = Math.max(0, (this.hud.cashoutEndAt - Date.now()) / 1000);
                const progress = 1 - left / total;
                drawCashoutProgressRing(ctx, p.x, p.y, r + 10, progress, { counterClockwise: true });
            }
        }
    }

    drawHud(ctx, W, H) {
        const pad = 16;
        const barW = 160;
        const hpPct = this.hud.hp / (this.hud.maxHp || 100);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(pad, pad, barW + 16, 52);
        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('HEALTH', pad + 8, pad + 14);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(pad + 8, pad + 18, barW, 8);
        ctx.fillStyle = hpPct > 0.35 ? '#50dd70' : '#dd4040';
        ctx.fillRect(pad + 8, pad + 18, barW * hpPct, 8);

        if (this.hud.armor > 0) {
            ctx.fillStyle = '#888';
            ctx.fillText('ARMOR', pad + 8, pad + 38);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(pad + 8, pad + 42, barW, 6);
            ctx.fillStyle = '#5090ff';
            ctx.fillRect(pad + 8, pad + 42, barW * (this.hud.armor / 100), 6);
        }

        const weaponLabel = WEAPON_LABELS[this.hud.weapon] || 'Pistol';
        const ammoText = this.hud.reloading ? 'RELOAD' : `${this.hud.ammo}/${this.hud.clipSize}`;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(W - pad - 120, pad, 120, 40);
        ctx.fillStyle = '#ccc';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(weaponLabel, W - pad - 8, pad + 16);
        ctx.fillStyle = '#888';
        ctx.font = '11px sans-serif';
        ctx.fillText(ammoText, W - pad - 8, pad + 32);

        if (this.hud.kills > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(W / 2 - 40, pad, 80, 24);
            ctx.fillStyle = '#ff8060';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.hud.kills} KILLS`, W / 2, pad + 16);
        }
    }

    drawMinimapPanel(ctx, W, H) {
        const size = 110;
        const x = W - size - 14;
        const y = H - size - 14;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const scale = size / (this.worldHalf * 2);

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (this.zone?.radius) {
            ctx.beginPath();
            ctx.arc(cx, cy, this.zone.radius * scale, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,100,100,0.4)';
            ctx.stroke();
        }

        for (const p of this.players) {
            const mx = cx + p.x * scale;
            const my = cy + p.y * scale;
            ctx.fillStyle = p.isYou ? '#fff' : (p.color || '#888');
            ctx.beginPath();
            ctx.arc(mx, my, p.isYou ? 3 : 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx + this.camera.x * scale, cy + this.camera.y * scale, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }
}
