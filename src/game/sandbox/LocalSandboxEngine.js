const TAU = Math.PI * 2;
const COLORS = ['#67e8f9', '#818cf8', '#f472b6', '#fbbf24', '#4ade80', '#fb7185'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const random = (min, max) => min + Math.random() * (max - min);
const id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

export class LocalSandboxEngine {
    constructor(canvas, { mode = 'slither', username = 'Player', onState, onVitals, onFrame, inputProvider } = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.mode = mode;
        this.username = username;
        this.onState = onState;
        this.onVitals = onVitals;
        this.onFrame = onFrame;
        this.inputProvider = inputProvider;
        this.worldHalf = mode === 'slither' ? 900 : 3000;
        this.zone = { cx: mode === 'slither' ? 0 : 3000, cy: mode === 'slither' ? 0 : 3000, radius: this.worldHalf, shrinking: false };
        const center = mode === 'slither' ? 0 : 3000;
        this.player = this.makeEntity('player', center, center, 5, false, username);
        this.bots = [];
        this.statics = [];
        this.food = [];
        this.paused = false;
        this.speed = 1;
        this.botAi = true;
        this.invincible = true;
        this.health = 100;
        this.target = { x: center + 100, y: center };
        this.lastAt = performance.now();
        this.lastStateAt = 0;
        this.raf = 0;
        this.resizeObserver = null;
        this.onPointer = this.onPointer.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.loop = this.loop.bind(this);
    }

    makeEntity(prefix, x, y, size = 5, isBot = false, name = 'Bot') {
        const angle = random(0, TAU);
        return {
            id: id(prefix), name, username: name, x, y, size, balance: size,
            angle, targetAngle: angle, isBot, boost: false,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            body: Array.from({ length: clamp(Math.round(18 + size * 3), 18, 90) }, (_, i) => ({
                x: x - Math.cos(angle) * i * 5,
                y: y - Math.sin(angle) * i * 5,
            })),
        };
    }

    start() {
        if (this.mode === 'agar') {
            this.canvas.addEventListener('pointermove', this.onPointer);
            this.canvas.addEventListener('pointerdown', this.onPointer);
        }
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        this.resizeObserver = new ResizeObserver(() => this.resize());
        if (this.canvas.parentElement) this.resizeObserver.observe(this.canvas.parentElement);
        this.resize();
        this.control('spawnFood', { count: 80 });
        this.control('spawnBots', { count: 3, balance: 5 });
        this.emitState();
        this.raf = requestAnimationFrame(this.loop);
    }

    destroy() {
        cancelAnimationFrame(this.raf);
        this.resizeObserver?.disconnect();
        if (this.mode === 'agar') {
            this.canvas.removeEventListener('pointermove', this.onPointer);
            this.canvas.removeEventListener('pointerdown', this.onPointer);
        }
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
    }

    resize() {
        const rect = this.canvas.parentElement?.getBoundingClientRect();
        if (!rect?.width || !rect?.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(rect.width * dpr);
        this.canvas.height = Math.round(rect.height * dpr);
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.dpr = dpr;
    }

    onPointer(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scale = this.viewScale();
        this.target.x = this.player.x + (event.clientX - rect.left - rect.width / 2) / scale;
        this.target.y = this.player.y + (event.clientY - rect.top - rect.height / 2) / scale;
    }

    onKeyDown(event) { if (event.code === 'Space') this.player.boost = true; }
    onKeyUp(event) { if (event.code === 'Space') this.player.boost = false; }
    viewScale() { return this.mode === 'slither' ? 1.35 : 0.42; }

    control(action, params = {}) {
        switch (action) {
            case 'pause': this.paused = !!params.paused; break;
            case 'setSpeed': this.speed = clamp(Number(params.multiplier) || 1, 0.1, 5); break;
            case 'setBotAi': this.botAi = params.enabled !== false; break;
            case 'setInvincible': this.invincible = params.enabled !== false; break;
            case 'setWorldSize':
                this.worldHalf = clamp(Number(params.worldHalf) || this.worldHalf, 500, 5000);
                this.zone.radius = this.worldHalf;
                this.zone.shrinking = false;
                break;
            case 'setZoneRadius':
                this.zone.radius = clamp(Number(params.radius) || this.zone.radius, 100, this.worldHalf);
                this.zone.shrinking = false;
                break;
            case 'startZoneShrink':
                this.zone.shrinking = true;
                this.zone.startAt = performance.now();
                this.zone.startRadius = this.zone.radius;
                this.zone.endRadius = clamp(Number(params.endRadius) || 200, 100, this.zone.radius);
                this.zone.duration = Math.max(5000, Number(params.durationMs) || 120000);
                break;
            case 'stopZoneShrink': this.zone.shrinking = false; break;
            case 'spawnBots': {
                const count = clamp(Number(params.count) || 3, 1, 12 - this.bots.length);
                for (let i = 0; i < count; i += 1) {
                    const angle = random(0, TAU); const distance = random(100, this.zone.radius * 0.75);
                    this.bots.push(this.makeEntity('bot', this.zone.cx + Math.cos(angle) * distance, this.zone.cy + Math.sin(angle) * distance, Number(params.balance) || 5, true, `Bot ${this.bots.length + 1}`));
                }
                break;
            }
            case 'spawnFood': {
                const count = clamp(Number(params.count) || 50, 1, 500);
                for (let i = 0; i < count; i += 1) {
                    const angle = random(0, TAU); const distance = Math.sqrt(Math.random()) * this.zone.radius * 0.9;
                    this.food.push({ id: id('food'), x: this.zone.cx + Math.cos(angle) * distance, y: this.zone.cy + Math.sin(angle) * distance, hue: random(0, 360), radius: random(2.5, 5.5) });
                }
                this.food = this.food.slice(-500);
                break;
            }
            case 'addStaticWorm': {
                const entity = this.makeEntity('static', this.player.x + 80, this.player.y + 40, Number(params.balance) || 8, false, 'Static Worm');
                entity.angle = Number(params.angle) || 0; entity.bend = Number(params.bend) || 0;
                this.statics.push(entity); break;
            }
            case 'moveStaticWorm': {
                const entity = this.statics.find(item => item.id === params.id); if (!entity) break;
                const dx = (Number(params.x) || 0) - entity.x; const dy = (Number(params.y) || 0) - entity.y;
                entity.x += dx; entity.y += dy; entity.body.forEach(point => { point.x += dx; point.y += dy; });
                if (params.balance != null) entity.size = Number(params.balance) || entity.size;
                if (params.angle != null) entity.angle = Number(params.angle) || 0;
                break;
            }
            case 'setEntitySize': {
                const entity = [...this.bots, ...this.statics].find(item => item.id === params.id) || this.player;
                entity.size = clamp(Number(params.balance) || 5, 0.5, 200); entity.balance = entity.size; break;
            }
            case 'removeStaticWorm': this.statics = this.statics.filter(item => item.id !== params.id); break;
            case 'possessEntity': {
                const entity = [...this.bots, ...this.statics].find(item => item.id === params.id);
                if (entity) { const old = this.player; this.player = entity; this.player.isBot = false; this.bots = this.bots.filter(item => item !== entity); this.statics = this.statics.filter(item => item !== entity); old.name = `${old.name} (parked)`; this.statics.push(old); }
                break;
            }
            case 'clearEntities': this.bots = []; this.statics = []; this.food = []; this.health = 100; break;
            case 'abort': this.bots = []; this.statics = []; this.food = []; this.health = 100; this.paused = false; this.control('spawnFood', { count: 80 }); this.control('spawnBots', { count: 3 }); break;
            default: break;
        }
        this.emitState(action);
        return this.snapshot(action);
    }

    snapshot(lastAction) {
        return {
            active: true, local: true, paused: this.paused, speedMultiplier: this.speed,
            botAi: this.botAi, invincible: this.invincible, worldHalf: this.worldHalf,
            zone: { ...this.zone }, players: 1, bots: this.bots.length, food: this.food.length,
            staticWorms: this.statics.length,
            staticWormIds: this.statics.map(item => ({ id: item.id, name: item.name, balance: item.size, x: item.x, y: item.y, angle: item.angle || 0, bend: item.bend || 0 })),
            controllableEntities: [...this.statics.map(item => ({ id: item.id, name: item.name, balance: item.size, type: 'static', x: item.x, y: item.y })), ...this.bots.map(item => ({ id: item.id, name: item.name, balance: item.size, type: 'bot', x: item.x, y: item.y }))],
            lastAction,
        };
    }

    emitState(action) { this.onState?.(this.snapshot(action)); }

    loop(now) {
        const dt = Math.min(0.05, Math.max(0.001, (now - this.lastAt) / 1000)) * this.speed;
        this.lastAt = now;
        if (!this.paused) this.update(dt, now);
        if (this.onFrame) this.emitFrame();
        else this.draw();
        if (now - this.lastStateAt > 250) { this.lastStateAt = now; this.emitState(); }
        this.raf = requestAnimationFrame(this.loop);
    }

    update(dt, now) {
        if (this.zone.shrinking) {
            const progress = clamp((now - this.zone.startAt) / this.zone.duration, 0, 1);
            this.zone.radius = this.zone.startRadius + (this.zone.endRadius - this.zone.startRadius) * progress;
            if (progress >= 1) this.zone.shrinking = false;
        }
        const input = this.inputProvider?.();
        if (input && this.mode === 'slither') {
            const magnitude = Math.hypot(input.dx || 0, input.dy || 0);
            if (magnitude > 0.001) {
                this.target.x = this.player.x + (input.dx / magnitude) * 400;
                this.target.y = this.player.y + (input.dy / magnitude) * 400;
            }
            this.player.boost = !!input.boost;
        }
        this.moveEntity(this.player, this.target.x, this.target.y, dt, false);
        if (this.botAi) this.bots.forEach((bot, index) => {
            if (!bot.wanderAt || now > bot.wanderAt) { bot.wanderAt = now + random(700, 2200); bot.targetAngle += random(-1.2, 1.2); }
            this.moveEntity(bot, bot.x + Math.cos(bot.targetAngle) * 300, bot.y + Math.sin(bot.targetAngle) * 300, dt, true);
            if (index > 8) bot.boost = false;
        });
        this.consumeFood(this.player);
        this.bots.forEach(bot => this.consumeFood(bot));
        const distance = Math.hypot(this.player.x - this.zone.cx, this.player.y - this.zone.cy);
        const outside = distance > this.zone.radius;
        if (!this.invincible) this.health = clamp(this.health + (outside ? -34 : 18) * dt, 0, 100); else this.health = 100;
        this.onVitals?.({ zoneHealth: Math.round(this.health), outsideZone: outside });
    }

    moveEntity(entity, tx, ty, dt, bot) {
        const desired = Math.atan2(ty - entity.y, tx - entity.x);
        let delta = ((desired - entity.angle + Math.PI * 3) % TAU) - Math.PI;
        entity.angle += clamp(delta, -2.8 * dt, 2.8 * dt);
        const speed = (this.mode === 'slither' ? 125 : 175) * (entity.boost ? 1.55 : 1) * (bot ? 0.88 : 1);
        entity.x += Math.cos(entity.angle) * speed * dt; entity.y += Math.sin(entity.angle) * speed * dt;
        const min = this.mode === 'slither' ? -this.worldHalf : 0; const max = this.mode === 'slither' ? this.worldHalf : this.worldHalf * 2;
        entity.x = clamp(entity.x, min, max); entity.y = clamp(entity.y, min, max);
        if (this.mode === 'slither') {
            entity.body.unshift({ x: entity.x, y: entity.y });
            const spacing = 4; const filtered = [entity.body[0]];
            for (let i = 1; i < entity.body.length && filtered.length < clamp(Math.round(18 + entity.size * 3), 18, 90); i += 1) {
                const prev = filtered[filtered.length - 1]; const point = entity.body[i];
                if (Math.hypot(point.x - prev.x, point.y - prev.y) >= spacing) filtered.push(point);
            }
            entity.body = filtered;
        }
    }

    consumeFood(entity) {
        const reach = this.mode === 'slither' ? 14 + entity.size : 22 + entity.size * 2;
        this.food = this.food.filter(food => {
            if (Math.hypot(food.x - entity.x, food.y - entity.y) > reach) return true;
            entity.size = clamp(entity.size + 0.015, 0.5, 200); entity.balance = entity.size; return false;
        });
    }

    emitFrame() {
        if (this.mode === 'slither') {
            const serialize = (entity, isYou = false) => {
                const segments = entity.body.map(point => ({ x: point.x, y: point.y }));
                const sct = segments.length;
                const sc = Math.min(3.15, 1 + Math.log1p(Math.max(0, sct - 12) / 90) * 0.59);
                return {
                    id: entity.id,
                    name: entity.name,
                    balance: entity.size,
                    dollarBalance: entity.balance,
                    color: entity.color,
                    isBot: !!entity.isBot,
                    isYou,
                    segments,
                    sct,
                    angle: entity.angle || 0,
                    sc,
                    fam: 0,
                    wsep: 3.6 * Math.min(1.65, 1 + (sc - 1) * 0.32),
                    radius: 6.2 * sc,
                    boost: !!entity.boost,
                };
            };
            this.onFrame({
                mode: 'slither',
                tick: {
                    you: this.player.id,
                    snakes: [...this.statics.map(item => serialize(item)), ...this.bots.map(item => serialize(item)), serialize(this.player, true)],
                    food: this.food.map(item => ({ ...item, balance: 0.01, dollarValue: 0.01 })),
                    worldHalf: this.worldHalf,
                    zone: { ...this.zone },
                    competitiveSlither: true,
                    circularMap: true,
                    dollarBalance: this.player.balance,
                },
            });
            return;
        }
        const asUser = (entity) => ({
            id: entity.id,
            username: entity.name,
            color: entity.color,
            balance: entity.balance,
            dollarBalance: entity.balance,
            cells: [{
                id: entity.id + '_cell',
                x: entity.x,
                y: entity.y,
                balance: entity.size,
                radius: Math.max(18, 18 + entity.size * 1.8),
            }],
        });
        this.onFrame({
            mode: 'agar',
            player: asUser(this.player),
            users: [asUser(this.player), ...this.bots.map(asUser)],
            food: this.food.map(item => ({ ...item, balance: 0.01 })),
            zone: { ...this.zone },
        });
    }

    worldToScreen(x, y) {
        const scale = this.viewScale();
        return { x: (x - this.player.x) * scale + this.canvas.width / this.dpr / 2, y: (y - this.player.y) * scale + this.canvas.height / this.dpr / 2 };
    }

    draw() {
        const width = this.canvas.width / this.dpr; const height = this.canvas.height / this.dpr; const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = '#080a10'; ctx.fillRect(0, 0, width, height);
        const scale = this.viewScale(); const grid = 80 * scale; const offsetX = ((-this.player.x * scale) % grid + grid) % grid; const offsetY = ((-this.player.y * scale) % grid + grid) % grid;
        ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = offsetX; x < width; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = offsetY; y < height; y += grid) { ctx.moveTo(0, y); ctx.lineTo(width, y); } ctx.stroke();
        const zone = this.worldToScreen(this.zone.cx, this.zone.cy);
        ctx.strokeStyle = this.zone.shrinking ? '#fb7185' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(zone.x, zone.y, this.zone.radius * scale, 0, TAU); ctx.stroke();
        this.food.forEach(food => { const p = this.worldToScreen(food.x, food.y); if (p.x < -10 || p.y < -10 || p.x > width + 10 || p.y > height + 10) return; ctx.fillStyle = `hsl(${food.hue} 90% 62%)`; ctx.beginPath(); ctx.arc(p.x, p.y, food.radius, 0, TAU); ctx.fill(); });
        [...this.statics, ...this.bots, this.player].forEach(entity => this.drawEntity(entity));
        ctx.fillStyle = 'rgba(7,9,15,.78)'; ctx.fillRect(14, height - 48, 205, 34); ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui'; ctx.fillText(`LOCAL · ${this.mode.toUpperCase()} · $${entityBalance(this.player)}`, 26, height - 27);
        if (this.paused) { ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#fff'; ctx.font = '700 28px system-ui'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', width / 2, height / 2); ctx.textAlign = 'start'; }
    }

    drawEntity(entity) {
        const ctx = this.ctx; const scale = this.viewScale();
        if (this.mode === 'slither') {
            ctx.strokeStyle = entity.color; ctx.lineWidth = clamp((7 + entity.size * 0.45) * scale, 7, 24); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
            entity.body.forEach((point, index) => { const p = this.worldToScreen(point.x, point.y); if (!index) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.stroke();
            const head = this.worldToScreen(entity.x, entity.y); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(head.x + Math.cos(entity.angle - .6) * 5, head.y + Math.sin(entity.angle - .6) * 5, 2.2, 0, TAU); ctx.arc(head.x + Math.cos(entity.angle + .6) * 5, head.y + Math.sin(entity.angle + .6) * 5, 2.2, 0, TAU); ctx.fill();
        } else {
            const p = this.worldToScreen(entity.x, entity.y); const radius = clamp((24 + entity.size * 2) * scale, 12, 70); ctx.fillStyle = entity.color; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2; ctx.stroke();
        }
        const p = this.worldToScreen(entity.x, entity.y); ctx.fillStyle = '#fff'; ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(entity.name, p.x, p.y - 15); ctx.textAlign = 'start';
    }
}

function entityBalance(entity) { return Number(entity?.balance || entity?.size || 0).toFixed(2); }
