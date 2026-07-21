import React, { useEffect, useRef } from 'react';
import { drawOrganicCell } from '../game/agar/render.js';
import { SlitherRenderer } from '../game/slither/SlitherRenderer.js';
import { SurvivRenderer } from '../game/surviv/SurvivRenderer.js';

const COLORS = ['#c080ff', '#9099ff', '#80d0d0', '#80ff80', '#eeee70', '#ffa060', '#ff9050', '#ff4040', '#e030e0'];
const SURVIV_WEAPONS = ['pistol', 'smg', 'shotgun', 'assault', 'dmr', 'sniper', 'lmg'];
const SURVIV_BULLET_SPEED = { pistol: 34, smg: 38, shotgun: 30, assault: 42, dmr: 48, sniper: 58, lmg: 40 };
const SURVIV_PLAYER_SPEED = 5.2 * 40;
const SURVIV_BACKGROUND_SPEED = SURVIV_PLAYER_SPEED * 0.26;
const SLITHER_START_SPEED = 120.625;
const SLITHER_BACKGROUND_SPEED = SLITHER_START_SPEED * 0.72;
const AGAR_TICK_RATE = 40;
const AGAR_BACKGROUND_SPEED_MULTIPLIER = 0.42;
const SCENE_ZOOM = { slither: 2.15, surviv: 2.35, agar: 1.42 };


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
    const base = family === 'slither' ? 4 : family === 'surviv' ? 4 : 3;
    const min = family === 'surviv' ? 3 : 2;
    const max = family === 'surviv' ? 5 : 4;
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

function spawnFromEdge(bounds, random, margin) {
    const roll = random();
    if (roll < 0.4) return { x: bounds.right + margin, y: bounds.top + random() * bounds.height };
    if (roll < 0.6) return { x: bounds.left + random() * bounds.width, y: bounds.top - margin };
    if (roll < 0.8) return { x: bounds.left + random() * bounds.width, y: bounds.bottom + margin };
    return { x: bounds.left - margin, y: bounds.top + random() * bounds.height };
}

function inwardAngle(position, width, height, random) {
    return Math.atan2(height / 2 - position.y, width / 2 - position.x) + (random() - 0.5) * 1.05;
}

function createActors(family, width, height, colors) {
    const bounds = sceneBounds(family, width, height);
    const random = Math.random;
    const count = actorCount(family, width, height);

    if (family === 'slither') {
        return Array.from({ length: count }, (_, index) => {
            const sizeRoll = random();
            const radius = 5.5 + Math.pow(sizeRoll, 1.45) * 17;
            const spacing = Math.max(3.4, radius * 0.45);
            const pointCount = 16 + Math.floor(Math.pow(random(), 0.78) * 48);
            const position = spawnFromEdge(bounds, random, 25 + random() * 65);
            const x = position.x;
            const y = position.y;
            const angle = inwardAngle(position, width, height, random);
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
                speed: SLITHER_BACKGROUND_SPEED,
                phase: random() * Math.PI * 2,
                targetAngle: angle,
                nextTurn: 2.4 + random() * 4.2,
                turnIndex: Math.floor(random() * 1000),
                avoidDirection: 0,
                avoidTime: 0,
                color: selectedOrPalette(colors.slither, index, random, ['random']),
                rainbow: colors.slither === 'random' && index === 0,
            };
        });
    }

    if (family === 'surviv') {
        return Array.from({ length: count }, (_, index) => {
            const position = spawnFromEdge(bounds, random, 20 + random() * 45);
            const angle = inwardAngle(position, width, height, random);
            return {
                id: `pregame-surviv-${index}`,
                x: position.x,
                y: position.y,
                angle,
                phase: random() * Math.PI * 2,
                color: selectedOrPalette(colors.surviv, index, random, ['random', 'random_color']),
                weapon: SURVIV_WEAPONS[index % SURVIV_WEAPONS.length],
                movementAngle: angle,
                movementMode: 'wander',
                movementScale: 0.62 + random() * 0.3,
                strafeSide: random() > 0.5 ? 1 : -1,
                nextDecision: 0.9 + random() * 0.8,
                nextStrafe: 0.7 + random() * 1.3,
                decisionIndex: Math.floor(random() * 1000),
                nextShot: 0.35 + random() * 1.2,
                muzzle: 0,
            };
        });
    }

    return Array.from({ length: count }, (_, index) => {
        const balance = 2.5 + random() * 12;
        const radius = 4 + Math.sqrt(balance * 18) * 6;
        const position = spawnFromEdge(bounds, random, radius + 10 + random() * 40);
        const angle = inwardAngle(position, width, height, random);
        const speed = (6 / Math.pow(balance, 0.449))
            * 1.45
            * AGAR_TICK_RATE
            * AGAR_BACKGROUND_SPEED_MULTIPLIER;
        return {
            id: `pregame-agar-${index}`,
            x: position.x,
            y: position.y,
            radius,
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
    const outside = actor.x < bounds.left - margin
        || actor.x > bounds.right + margin
        || actor.y < bounds.top - margin
        || actor.y > bounds.bottom + margin;
    if (!outside) return false;

    const position = spawnFromEdge(bounds, Math.random, 55 + Math.random() * 110);
    const angle = inwardAngle(position, width, height, Math.random);
    actor.x = position.x;
    actor.y = position.y;
    actor.angle = angle;
    if (family === 'surviv') {
        actor.movementAngle = angle;
        actor.movementMode = 'wander';
        actor.nextDecision = 0.7 + Math.random() * 0.8;
    }
    return true;
}

function snakeAvoidanceDirection(actor, actors) {
    const lookAhead = 54 + actor.radius * 4;
    const lookX = actor.x + Math.cos(actor.angle) * lookAhead;
    const lookY = actor.y + Math.sin(actor.angle) * lookAhead;
    let nearestDistance = Infinity;
    let nearestX = 0;
    let nearestY = 0;

    for (const other of actors) {
        if (other === actor) continue;
        const stride = Math.max(2, Math.floor(other.points.length / 24));
        for (let index = 0; index < other.points.length; index += stride) {
            const point = other.points[index];
            const distance = Math.hypot(lookX - point.x, lookY - point.y);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestX = point.x;
                nearestY = point.y;
            }
        }
    }

    const safetyDistance = 46 + actor.radius * 2.8;
    if (nearestDistance >= safetyDistance) return 0;
    const obstacleAngle = Math.atan2(nearestY - actor.y, nearestX - actor.x);
    const obstacleSide = Math.sin(obstacleAngle - actor.angle);
    return obstacleSide >= 0 ? -1 : 1;
}

function updateSnakes(actors, dt, width, height) {
    for (const actor of actors) {
        actor.nextTurn -= dt;
        actor.avoidTime = Math.max(0, actor.avoidTime - dt);
        const avoidanceDirection = snakeAvoidanceDirection(actor, actors);
        if (avoidanceDirection !== 0) {
            if (actor.avoidTime <= 0) actor.avoidDirection = avoidanceDirection;
            actor.avoidTime = 1.1;
            actor.targetAngle = actor.angle + actor.avoidDirection * 1.02;
        } else if (actor.nextTurn <= 0 && actor.avoidTime <= 0) {
            const roll = Math.abs(Math.sin(actor.phase * 7.31 + actor.turnIndex * 12.9898));
            const direction = Math.sin(actor.phase + actor.turnIndex * 4.17) >= 0 ? 1 : -1;
            const targetTurn = roll > 0.84 ? Math.PI / 2 : 0.24 + roll * 0.72;
            actor.targetAngle = actor.angle + direction * targetTurn;
            actor.turnIndex += 1;
            actor.nextTurn = 2.6 + Math.abs(Math.sin(actor.phase + actor.turnIndex * 2.13)) * 4.8;
        }

        const angleDelta = Math.atan2(
            Math.sin(actor.targetAngle - actor.angle),
            Math.cos(actor.targetAngle - actor.angle),
        );
        const sizeTurnScale = Math.max(0.42, Math.min(1.05, Math.pow(8 / actor.radius, 0.55)));
        const maxTurn = 0.95 * sizeTurnScale * dt;
        actor.angle += Math.max(-maxTurn, Math.min(maxTurn, angleDelta));
        actor.x += Math.cos(actor.angle) * actor.speed * dt;
        actor.y += Math.sin(actor.angle) * actor.speed * dt;
        const bodyLength = actor.spacing * Math.max(1, actor.points.length - 1);
        const wrapped = wrapActor(actor, 'slither', width, height, bodyLength + actor.radius * 2);
        if (wrapped) {
            actor.targetAngle = actor.angle;
            actor.avoidTime = 0;
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
        ctx.save();
        ctx.shadowColor = actor.color;
        ctx.shadowBlur = 9;
        renderer._drawSnake({
            id: actor.id,
            angle: actor.angle,
            radius: actor.radius,
            color: actor.rainbow ? 'random' : actor.color,
            boost: false,
            isYou: false,
            segments: actor.points.map((point) => ({ x: point.x - width / 2, y: point.y - height / 2 })),
        }, null, 1);
        ctx.restore();
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
        ctx.shadowColor = actor.color;
        ctx.shadowBlur = 8;
        drawOrganicCell(actor, borders, ctx, actors, true);
    }
}

function nearestSurvivTarget(actor, actors) {
    let target = null;
    let distance = Infinity;
    for (const candidate of actors) {
        if (candidate === actor) continue;
        const candidateDistance = Math.hypot(candidate.x - actor.x, candidate.y - actor.y);
        if (candidateDistance < distance) {
            target = candidate;
            distance = candidateDistance;
        }
    }
    return { target, distance };
}

function survivPreferredRange(weapon) {
    if (weapon === 'shotgun') return { min: 80, max: 180 };
    if (weapon === 'sniper' || weapon === 'dmr') return { min: 220, max: 400 };
    if (weapon === 'assault' || weapon === 'lmg') return { min: 150, max: 300 };
    if (weapon === 'smg') return { min: 100, max: 220 };
    return { min: 120, max: 250 };
}

function turnToward(current, target, maxTurn) {
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + Math.max(-maxTurn, Math.min(maxTurn, delta));
}

function updateAndDrawSurviv(ctx, renderer, actors, bullets, dt, elapsed, width, height) {
    for (const actor of actors) {
        actor.nextDecision -= dt;
        actor.nextStrafe -= dt;
        actor.nextShot -= dt;
        actor.muzzle = Math.max(0, actor.muzzle - dt);

        const { target, distance } = nearestSurvivTarget(actor, actors);
        const targetAngle = target
            ? Math.atan2(target.y - actor.y, target.x - actor.x)
            : actor.movementAngle;
        const range = survivPreferredRange(actor.weapon);

        if (actor.nextStrafe <= 0) {
            actor.strafeSide *= -1;
            actor.nextStrafe = 0.7 + Math.abs(Math.sin(actor.phase + actor.decisionIndex)) * 1.5;
        }
        if (actor.nextDecision <= 0) {
            const variation = Math.abs(Math.sin(actor.phase * 3.7 + actor.decisionIndex * 1.91));
            if (!target) actor.movementMode = 'wander';
            else if (distance > range.max) actor.movementMode = variation > 0.18 ? 'approach' : 'strafe';
            else if (distance < range.min) actor.movementMode = variation > 0.28 ? 'retreat' : 'strafe';
            else actor.movementMode = variation > 0.16 ? 'strafe' : 'approach';
            actor.movementScale = 0.58 + variation * 0.38;
            actor.decisionIndex += 1;
            actor.nextDecision = 0.35 + variation * 0.75;
        }

        let desiredMovementAngle = targetAngle;
        if (actor.movementMode === 'retreat') desiredMovementAngle += Math.PI;
        else if (actor.movementMode === 'strafe') {
            desiredMovementAngle += actor.strafeSide * Math.PI / 2;
            desiredMovementAngle += Math.sin(elapsed * 0.0032 + actor.phase) * 0.2;
        } else if (actor.movementMode === 'wander') {
            desiredMovementAngle = actor.movementAngle + Math.sin(elapsed * 0.0014 + actor.phase) * 0.45;
        } else {
            desiredMovementAngle += Math.sin(elapsed * 0.0019 + actor.phase) * 0.12;
        }

        actor.movementAngle = turnToward(actor.movementAngle, desiredMovementAngle, 2.1 * dt);
        actor.angle = turnToward(actor.angle, targetAngle, 3.6 * dt);
        actor.x += Math.cos(actor.movementAngle) * SURVIV_BACKGROUND_SPEED * actor.movementScale * dt;
        actor.y += Math.sin(actor.movementAngle) * SURVIV_BACKGROUND_SPEED * actor.movementScale * dt;
        wrapActor(actor, 'surviv', width, height, 42);

        if (target && actor.nextShot <= 0) {
            const shotAngle = Math.atan2(target.y - actor.y, target.x - actor.x);
            const speed = (SURVIV_BULLET_SPEED[actor.weapon] || 38) * 40;
            const spread = actor.weapon === 'shotgun' ? [-0.12, 0, 0.12] : [0];
            for (const offset of spread) {
                const angle = shotAngle + offset;
                bullets.push({
                    x: actor.x + Math.cos(angle) * 27,
                    y: actor.y + Math.sin(angle) * 27,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    weaponType: actor.weapon,
                    life: 0.72,
                });
            }
            actor.angle = shotAngle;
            actor.muzzle = 0.11;
            actor.nextShot = 0.65 + Math.abs(Math.sin(actor.phase + actor.decisionIndex * 0.73)) * 0.85;
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
                updateSnakes(actors, dt, width, height);
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
                    ? 'blur(4.2px) saturate(1.35) brightness(1.1)'
                    : family === 'slither'
                        ? 'blur(4.2px) saturate(1.25) brightness(1.06)'
                        : 'blur(4.2px) saturate(1.2) brightness(1.05)',
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