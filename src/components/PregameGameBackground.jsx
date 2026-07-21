import React, { useEffect, useRef } from 'react';
import { drawOrganicCell } from '../game/agar/render.js';
import { SlitherRenderer } from '../game/slither/SlitherRenderer.js';
import { SurvivRenderer } from '../game/surviv/SurvivRenderer.js';

const COLORS = ['#c080ff', '#9099ff', '#80d0d0', '#80ff80', '#eeee70', '#ffa060', '#ff9050', '#ff4040', '#e030e0'];
const SURVIV_WEAPONS = ['pistol', 'smg', 'shotgun', 'assault', 'dmr', 'sniper', 'lmg'];
const SURVIV_BULLET_SPEED = { pistol: 34, smg: 38, shotgun: 30, assault: 42, dmr: 48, sniper: 58, lmg: 40 };
const SURVIV_PLAYER_SPEED = 5.2 * 40;
const SURVIV_BACKGROUND_SPEED = SURVIV_PLAYER_SPEED * 0.36;
const SLITHER_START_SPEED = 120.625;
const AGAR_TICK_RATE = 40;
const SCENE_ZOOM = { slither: 2.15, surviv: 1.95, agar: 1.42 };

function mulberry32(seed) {
    return () => {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function familyForMode(mode) {
    if (String(mode || '').includes('slither')) return 'slither';
    if (mode === 'surviv') return 'surviv';
    return 'agar';
}

function selectedOrPalette(selected, index, random, randomTokens) {
    if (!selected || randomTokens.includes(selected)) return COLORS[index % COLORS.length];
    return index === 0 ? selected : COLORS[Math.floor(random() * COLORS.length)];
}

function darkerColor(hex) {
    const value = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(value)) return '#7046a8';
    const channels = [0, 2, 4].map((offset) => Math.max(0, parseInt(value.slice(offset, offset + 2), 16) - 32));
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function actorCount(family, width, height) {
    const areaScale = Math.sqrt((width * height) / (1440 * 900));
    const base = family === 'slither' ? 6 : 5;
    const min = 3;
    const max = family === 'slither' ? 8 : 6;
    return Math.max(min, Math.min(max, Math.round(base * areaScale)));
}

function sceneBounds(family, width, height) {
    const zoom = SCENE_ZOOM[family] || 1;
    const visibleWidth = width / zoom;
    const visibleHeight = height / zoom;
    return {
        left: (width - visibleWidth) / 2,
        right: (width + visibleWidth) / 2,
        top: (height - visibleHeight) / 2,
        bottom: (height + visibleHeight) / 2,
        width: visibleWidth,
        height: visibleHeight,
    };
}

function createActors(family, width, height, colors) {
    const bounds = sceneBounds(family, width, height);
    const seed = family === 'slither' ? 0x51A7E : family === 'surviv' ? 0x5A7A1 : 0xA6A2;
    const random = mulberry32(seed + Math.round(width) * 7 + Math.round(height) * 13);
    const count = actorCount(family, width, height);

    if (family === 'slither') {
        return Array.from({ length: count }, (_, index) => {
            const angle = random() * Math.PI * 2;
            const sizeRoll = random();
            const radius = 5.5 + Math.pow(sizeRoll, 1.45) * 17;
            const x = bounds.left + random() * bounds.width;
            const y = bounds.top + random() * bounds.height;
            const spacing = Math.max(3.4, radius * 0.45);
            const pointCount = 18 + Math.floor(Math.pow(random(), 0.72) * 92);
            const points = Array.from({ length: pointCount }, (__, pointIndex) => ({
                x: x - Math.cos(angle) * spacing * pointIndex,
                y: y - Math.sin(angle) * spacing * pointIndex,
            }));
            return {
                id: `pregame-snake-${index}`,
                x,
                y,
                angle,
                radius,
                spacing,
                points,
                speed: SLITHER_START_SPEED,
                phase: random() * Math.PI * 2,
                turnDirection: random() > 0.5 ? 1 : -1,
                nextTurn: 0.8 + random() * 3.8,
                turnIndex: Math.floor(random() * 1000),
                color: selectedOrPalette(colors.slither, index, random, ['random']),
                rainbow: colors.slither === 'random' && index === 0,
            };
        });
    }

    if (family === 'surviv') {
        return Array.from({ length: count }, (_, index) => {
            const angle = random() * Math.PI * 2;
            return {
                id: `pregame-surviv-${index}`,
                x: bounds.left + 30 + random() * Math.max(1, bounds.width - 60),
                y: bounds.top + 30 + random() * Math.max(1, bounds.height - 60),
                angle,
                phase: random() * Math.PI * 2,
                color: selectedOrPalette(colors.surviv, index, random, ['random', 'random_color']),
                weapon: SURVIV_WEAPONS[index % SURVIV_WEAPONS.length],
                nextTurn: 2.8 + random() * 4.8,
                nextShot: 0.8 + random() * 3.1,
                muzzle: 0,
            };
        });
    }

    return Array.from({ length: count }, (_, index) => {
        const balance = 2.5 + random() * 12;
        const angle = random() * Math.PI * 2;
        const speed = (6 / Math.pow(balance, 0.449)) * 1.45 * AGAR_TICK_RATE;
        return {
            id: `pregame-agar-${index}`,
            x: bounds.left + random() * bounds.width,
            y: bounds.top + random() * bounds.height,
            radius: 4 + Math.sqrt(balance * 18) * 6,
            balance,
            angle,
            speed,
            vX: Math.cos(angle) * Math.min(6, speed / AGAR_TICK_RATE),
            vY: Math.sin(angle) * Math.min(6, speed / AGAR_TICK_RATE),
            color: selectedOrPalette(colors.agar, index, random, ['random', 'rainbow']),
            borderColor: '#000000',
            phase: random() * Math.PI * 2,
        };
    });
}

function wrapActor(actor, family, width, height, margin) {
    const bounds = sceneBounds(family, width, height);
    let wrapped = false;
    if (actor.x < bounds.left - margin) { actor.x = bounds.right + margin; wrapped = true; }
    else if (actor.x > bounds.right + margin) { actor.x = bounds.left - margin; wrapped = true; }
    if (actor.y < bounds.top - margin) { actor.y = bounds.bottom + margin; wrapped = true; }
    else if (actor.y > bounds.bottom + margin) { actor.y = bounds.top - margin; wrapped = true; }
    return wrapped;
}

function updateSnakes(actors, dt, elapsed, width, height) {
    for (const actor of actors) {
        actor.nextTurn -= dt;
        if (actor.nextTurn <= 0) {
            const roll = Math.abs(Math.sin(actor.phase * 7.31 + actor.turnIndex * 12.9898));
            const direction = Math.sin(actor.phase + actor.turnIndex * 4.17) >= 0 ? 1 : -1;
            actor.angle += direction * (roll > 0.58 ? Math.PI / 2 : 0.28 + roll * 0.55);
            actor.turnIndex += 1;
            actor.nextTurn = 0.9 + Math.abs(Math.sin(actor.phase + actor.turnIndex * 2.13)) * 4.4;
        }
        const turn = Math.sin(elapsed * 0.00072 + actor.phase) * 0.16 + actor.turnDirection * 0.025;
        actor.angle += turn * dt;
        actor.x += Math.cos(actor.angle) * actor.speed * dt;
        actor.y += Math.sin(actor.angle) * actor.speed * dt;
        const wrapped = wrapActor(actor, 'slither', width, height, actor.radius * 8);
        if (wrapped) {
            for (let i = 0; i < actor.points.length; i++) {
                actor.points[i].x = actor.x - Math.cos(actor.angle) * actor.spacing * i;
                actor.points[i].y = actor.y - Math.sin(actor.angle) * actor.spacing * i;
            }
            continue;
        }

        actor.points[0].x = actor.x;
        actor.points[0].y = actor.y;
        for (let i = 1; i < actor.points.length; i++) {
            const previous = actor.points[i - 1];
            const point = actor.points[i];
            const dx = point.x - previous.x;
            const dy = point.y - previous.y;
            const distance = Math.max(0.0001, Math.hypot(dx, dy));
            point.x = previous.x + (dx / distance) * actor.spacing;
            point.y = previous.y + (dy / distance) * actor.spacing;
        }
    }
}

function drawSnakes(ctx, renderer, actors, width, height, frame) {
    renderer.ctx = ctx;
    renderer.W = width;
    renderer.H = height;
    renderer.camera.x = 0;
    renderer.camera.y = 0;
    renderer._frame = frame;
    renderer.hideOverlays = true;
    renderer.snakeThickness = 1;

    for (const actor of actors) {
        renderer._drawSnake({
            id: actor.id,
            angle: actor.angle,
            radius: actor.radius,
            color: actor.rainbow ? 'random' : actor.color,
            boost: false,
            isYou: false,
            segments: actor.points.map((point) => ({ x: point.x - width / 2, y: point.y - height / 2 })),
        }, null, 1);
    }
}

function updateAndDrawAgar(ctx, actors, dt, elapsed, width, height) {
    const borders = { left: -200, right: width + 200, top: -200, bottom: height + 200 };
    for (const actor of actors) {
        actor.angle += Math.sin(elapsed * 0.00045 + actor.phase) * 0.12 * dt;
        actor.x += Math.cos(actor.angle) * actor.speed * dt;
        actor.y += Math.sin(actor.angle) * actor.speed * dt;
        actor.vX = Math.cos(actor.angle) * Math.min(6, actor.speed / AGAR_TICK_RATE);
        actor.vY = Math.sin(actor.angle) * Math.min(6, actor.speed / AGAR_TICK_RATE);
        wrapActor(actor, 'agar', width, height, actor.radius + 20);
    }

    for (const actor of actors) {
        ctx.fillStyle = actor.color;
        ctx.strokeStyle = actor.borderColor === '#000000' ? darkerColor(actor.color) : actor.borderColor;
        ctx.lineWidth = 7;
        ctx.shadowBlur = 0;
        drawOrganicCell(actor, borders, ctx, actors, true);
    }
}

function updateAndDrawSurviv(ctx, renderer, actors, bullets, dt, elapsed, width, height) {
    for (const actor of actors) {
        actor.nextTurn -= dt;
        actor.nextShot -= dt;
        actor.muzzle = Math.max(0, actor.muzzle - dt);
        if (actor.nextTurn <= 0) {
            actor.angle += (Math.sin(elapsed * 0.001 + actor.phase) > 0 ? 1 : -1) * (0.35 + Math.abs(Math.sin(actor.phase)) * 0.75);
            actor.nextTurn = 3 + (Math.sin(actor.phase + elapsed * 0.0002) + 1) * 2.2;
        }

        actor.x += Math.cos(actor.angle) * SURVIV_BACKGROUND_SPEED * dt;
        actor.y += Math.sin(actor.angle) * SURVIV_BACKGROUND_SPEED * dt;
        wrapActor(actor, 'surviv', width, height, 42);

        if (actor.nextShot <= 0) {
            const speed = (SURVIV_BULLET_SPEED[actor.weapon] || 38) * 40;
            const spread = actor.weapon === 'shotgun' ? [-0.12, 0, 0.12] : [0];
            for (const offset of spread) {
                const angle = actor.angle + offset;
                bullets.push({
                    x: actor.x + Math.cos(angle) * 27,
                    y: actor.y + Math.sin(angle) * 27,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    weaponType: actor.weapon,
                    life: 0.72,
                });
            }
            actor.muzzle = 0.11;
            actor.nextShot = 1.8 + ((Math.sin(actor.phase + elapsed * 0.00031) + 1) * 0.9);
        }
    }

    for (let index = bullets.length - 1; index >= 0; index--) {
        const bullet = bullets[index];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;
        if (bullet.life <= 0 || bullet.x < -80 || bullet.x > width + 80 || bullet.y < -80 || bullet.y > height + 80) {
            bullets.splice(index, 1);
        }
    }

    renderer._frameNow = Date.now();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.filter = 'blur(6px)';
    ctx.shadowColor = 'rgba(255, 184, 74, 0.95)';
    ctx.shadowBlur = 28;
    for (const bullet of bullets) renderer.drawBullet(ctx, bullet);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(255, 218, 136, 0.9)';
    ctx.shadowBlur = 16;
    for (const bullet of bullets) renderer.drawBullet(ctx, bullet);
    ctx.restore();
    for (const actor of actors) {
        renderer._muzzleFlash = actor.muzzle > 0 ? actor.muzzle / 0.11 : 0;
        renderer.myId = actor.id;
        renderer.drawPlayer(ctx, {
            id: actor.id,
            isYou: true,
            x: actor.x,
            y: actor.y,
            angle: actor.angle,
            hp: 100,
            maxHp: 100,
            armor: 0,
            color: actor.color,
            weapon: actor.weapon,
            walkBob: Math.sin(elapsed * 0.012 + actor.phase),
        }, false);
    }
    renderer._muzzleFlash = 0;
    renderer.myId = null;
}

export default function PregameGameBackground({ mode, slitherColor, agarColor, survivColor }) {
    const canvasRef = useRef(null);
    const family = familyForMode(mode);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (!ctx) return undefined;

        const helperCanvas = document.createElement('canvas');
        const slitherRenderer = new SlitherRenderer(helperCanvas, { resizeToCanvas: true });
        slitherRenderer.destroy();
        helperCanvas.width = 1;
        helperCanvas.height = 1;

        const survivHelperCanvas = document.createElement('canvas');
        const survivRenderer = new SurvivRenderer(survivHelperCanvas);
        survivRenderer.destroy();
        survivHelperCanvas.width = 1;
        survivHelperCanvas.height = 1;
        survivRenderer.hideNames = true;

        const bullets = [];
        let actors = [];
        let width = 1;
        let height = 1;
        let dpr = 1;
        let raf = 0;
        let lastFrame = performance.now();
        let lastPaint = 0;
        let frame = 0;

        const resize = () => {
            width = Math.max(1, window.innerWidth);
            height = Math.max(1, window.innerHeight);
            const mobile = window.matchMedia?.('(pointer: coarse)')?.matches || width < 760;
            dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.25));
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            actors = createActors(family, width, height, {
                slither: slitherColor,
                agar: agarColor,
                surviv: survivColor,
            });
            bullets.length = 0;
        };

        const render = (now) => {
            raf = requestAnimationFrame(render);
            if (now - lastPaint < 1000 / 30) return;
            const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
            lastFrame = now;
            lastPaint = now;
            frame += 1;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';

            if (family === 'slither') {
                updateSnakes(actors, dt, now, width, height);
                drawSnakes(ctx, slitherRenderer, actors, width, height, frame);
            } else if (family === 'surviv') {
                updateAndDrawSurviv(ctx, survivRenderer, actors, bullets, dt, now, width, height);
            } else {
                updateAndDrawAgar(ctx, actors, dt, now, width, height);
            }
        };

        resize();
        window.addEventListener('resize', resize);
        raf = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
            slitherRenderer.destroy();
            survivRenderer.destroy();
        };
    }, [mode, slitherColor, agarColor, survivColor]);

    return (
        <div aria-hidden="true" style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--bg)',
            zIndex: -2,
            overflow: 'hidden',
            pointerEvents: 'none',
        }}>
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: family === 'agar' ? '38px 38px' : '44px 44px',
                opacity: 0.4,
                maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, transparent 75%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, transparent 75%)',
            }} />
            <canvas ref={canvasRef} style={{
                position: 'absolute',
                inset: 0,
                display: 'block',
                opacity: family === 'surviv' ? 0.62 : 0.58,
                filter: family === 'surviv'
                    ? 'blur(3.4px) saturate(1.4) brightness(1.12) drop-shadow(0 0 22px rgba(255,174,74,0.5))'
                    : family === 'slither'
                        ? 'blur(2.8px) saturate(1.3) brightness(1.1) drop-shadow(0 0 25px rgba(128,100,255,0.44))'
                        : 'blur(2.5px) saturate(1.24) brightness(1.07) drop-shadow(0 0 20px rgba(124,58,255,0.34))',
                transform: `scale(${SCENE_ZOOM[family] || 1})`,
                transformOrigin: 'center',
                willChange: 'contents',
            }} />
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse at center, rgba(12,13,18,0.05) 20%, rgba(12,13,18,0.68) 100%)',
            }} />
        </div>
    );
}