import React, { useEffect, useRef } from 'react';
import { drawOrganicCell } from '../game/agar/render.js';
import { SlitherRenderer } from '../game/slither/SlitherRenderer.js';
import { rebuildPathFromSegments, updateBodyAlongPath } from '../game/slither/snakePath.js';
import { SurvivRenderer } from '../game/surviv/SurvivRenderer.js';
import { parseFlagSkin } from '../constants/flagSkins.js';

const COLORS = ['#c080ff', '#9099ff', '#80d0d0', '#80ff80', '#eeee70', '#ffa060', '#ff9050', '#ff4040', '#e030e0'];
const SURVIV_WEAPONS = ['pistol', 'smg', 'shotgun', 'assault', 'dmr', 'sniper', 'lmg'];
const SURVIV_BULLET_SPEED = { pistol: 34, smg: 38, shotgun: 30, assault: 42, dmr: 48, sniper: 58, lmg: 40 };
const SURVIV_PLAYER_SPEED = 5.2 * 40;
const SURVIV_BACKGROUND_SPEED = SURVIV_PLAYER_SPEED * 0.26;
const SLITHER_START_SPEED = 120.625;
const SLITHER_BACKGROUND_SPEED = SLITHER_START_SPEED * 0.82;
const AGAR_TICK_RATE = 40;
const AGAR_BACKGROUND_SPEED_MULTIPLIER = 0.42;
const SCENE_ZOOM = { slither: 2, surviv: 2.35, agar: 1.42 };


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

function slitherDimensionsForBalance(balance) {
    const pointCount = Math.min(1200, 12 + Math.floor(Math.max(0, balance - 1) * 100 * 0.125));
    const baseSegments = Math.min(pointCount, 12);
    const extraSegments = Math.max(0, pointCount - 12);
    const radiusScale = Math.min(
        3.15,
        1 + (baseSegments - 2) / 106 + Math.log1p(extraSegments / 90) * 0.59,
    );
    const spacingScale = Math.min(1.65, 1 + (radiusScale - 1) * 0.32);
    return {
        pointCount,
        radius: 6.2 * radiusScale,
        spacing: 3.6 * spacingScale,
    };
}

function createActors(family, width, height, colors) {
    const bounds = sceneBounds(family, width, height);
    const random = Math.random;
    const count = actorCount(family, width, height);

    if (family === 'slither') {
        return Array.from({ length: count }, (_, index) => {
            const balance = 1 + Math.pow(random(), 1.15) * 8;
            const { radius, spacing, pointCount } = slitherDimensionsForBalance(balance);
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
                balance,
                radius,
                spacing,
                points,
                pathState: { path: points.map((point) => ({ ...point })) },
                speed: SLITHER_BACKGROUND_SPEED,
                phase: random() * Math.PI * 2,
                noiseOffset: random() * 1000,
                noiseScale: 0.62 + random() * 0.48,
                maxAngleChange: 0.055 + random() * 0.035,
                turnVelocity: 0,
                targetTurnVelocity: (random() > 0.5 ? 1 : -1) * (0.025 + random() * 0.04),
                nextTurnChange: 0.25 + random() * 0.55,
                avoidDirection: 0,
                spawnDelay: index === 0 ? random() * 0.5 : 0.9 * index + random() * 1.6,
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
                muzzleAngle: angle,
                targetId: null,
                targetLock: 0,
                outsideTime: 0,
                spawnGeneration: 0,
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
            spawnDelay: index === 0 ? random() * 0.35 : 1.15 * index + random() * 1.35,
        };
    });
}

function respawnActor(actor, family, width, height) {
    const bounds = sceneBounds(family, width, height);
    // Keep slow Surviv actors close enough to the edge to enter the scene.
    const spawnMargin = family === 'surviv'
        ? 18 + Math.random() * 22
        : 55 + Math.random() * 110;
    const position = spawnFromEdge(bounds, Math.random, spawnMargin);
    const angle = inwardAngle(position, width, height, Math.random);
    actor.x = position.x;
    actor.y = position.y;
    actor.angle = angle;
    if (family === 'surviv') {
        actor.movementAngle = angle;
        actor.movementMode = 'wander';
        actor.nextDecision = 0.7 + Math.random() * 0.8;
        actor.targetId = null;
        actor.targetLock = 0;
        actor.outsideTime = 0;
        actor.spawnGeneration = (actor.spawnGeneration || 0) + 1;
    }
}

function wrapActor(actor, family, width, height, margin) {
    const bounds = sceneBounds(family, width, height);
    const outside = actor.x < bounds.left - margin
        || actor.x > bounds.right + margin
        || actor.y < bounds.top - margin
        || actor.y > bounds.bottom + margin;
    if (!outside) return false;
    respawnActor(actor, family, width, height);
    return true;
}

function isInsideScene(actor, family, width, height, padding = 0) {
    const bounds = sceneBounds(family, width, height);
    return actor.x >= bounds.left - padding
        && actor.x <= bounds.right + padding
        && actor.y >= bounds.top - padding
        && actor.y <= bounds.bottom + padding;
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

function updateSnakes(actors, dt, elapsed, width, height) {
    for (const actor of actors) {
        if (actor.spawnDelay > 0) {
            actor.spawnDelay = Math.max(0, actor.spawnDelay - dt);
            continue;
        }

        actor.nextTurnChange -= dt;
        if (actor.nextTurnChange <= 0) {
            const sharpTurn = Math.random() > 0.7;
            const direction = Math.random() > 0.5 ? 1 : -1;
            const magnitude = sharpTurn
                ? 0.065 + Math.random() * 0.035
                : 0.025 + Math.random() * 0.04;
            actor.targetTurnVelocity = direction * magnitude;
            actor.nextTurnChange = 0.28 + Math.random() * 0.72;
        }

        const noiseClock = elapsed * 0.005 + actor.noiseOffset;
        const noise = 0.5 * Math.sin(noiseClock * 0.8)
            + 0.3 * Math.sin(noiseClock * 1.2)
            + 0.2 * Math.sin(noiseClock * 1.8);
        let desiredTurnVelocity = actor.targetTurnVelocity + noise * 0.018 * actor.noiseScale;
        const avoidanceDirection = snakeAvoidanceDirection(actor, actors);
        if (avoidanceDirection !== 0) {
            actor.avoidDirection = avoidanceDirection;
            desiredTurnVelocity = actor.avoidDirection * actor.maxAngleChange;
        }

        const sizeTurnScale = Math.max(0.62, Math.min(1, Math.pow(7.2 / actor.radius, 0.5)));
        const maxTurnVelocity = actor.maxAngleChange * sizeTurnScale;
        desiredTurnVelocity = Math.max(-maxTurnVelocity, Math.min(maxTurnVelocity, desiredTurnVelocity));
        const turnSmoothing = 1 - Math.exp(-dt * 7.5);
        actor.turnVelocity += (desiredTurnVelocity - actor.turnVelocity) * turnSmoothing;
        actor.angle += actor.turnVelocity * dt * 60;
        actor.x += Math.cos(actor.angle) * actor.speed * dt;
        actor.y += Math.sin(actor.angle) * actor.speed * dt;

        const bodyLength = actor.spacing * Math.max(1, actor.points.length - 1);
        const wrapped = wrapActor(actor, 'slither', width, height, bodyLength + actor.radius * 2);
        if (wrapped) {
            actor.spawnDelay = 0.7 + Math.random() * 3.2;
            for (let i = 0; i < actor.points.length; i++) {
                actor.points[i].x = actor.x - Math.cos(actor.angle) * actor.spacing * i;
                actor.points[i].y = actor.y - Math.sin(actor.angle) * actor.spacing * i;
            }
            rebuildPathFromSegments(actor.pathState, actor.points);
            continue;
        }

        updateBodyAlongPath(
            actor.pathState,
            actor.points,
            actor.spacing,
            actor.x,
            actor.y,
            actor.angle,
            actor.points.length,
            0.08,
        );
    }
}

function drawSnakes(ctx, renderer, actors, width, height, frame) {
    renderer.ctx = ctx;
    renderer.W = width;
    renderer.H = height;
    renderer.camera.x = width / 2;
    renderer.camera.y = height / 2;
    renderer._frame = frame;
    renderer.hideOverlays = true;
    renderer.snakeThickness = 1;

    for (const actor of actors) {
        if (actor.spawnDelay > 0) continue;
        renderer._drawSnake({
            id: actor.id,
            angle: actor.angle,
            radius: actor.radius,
            color: actor.rainbow ? 'random' : actor.color,
            boost: false,
            isYou: false,
            segments: actor.points,
            renderStepMultiplier: 2.25,
        }, null, 1);
    }
}

function updateAndDrawAgar(ctx, actors, dt, elapsed, width, height) {
    const borders = { left: -200, right: width + 200, top: -200, bottom: height + 200 };
    for (const actor of actors) {
        if (actor.spawnDelay > 0) {
            actor.spawnDelay = Math.max(0, actor.spawnDelay - dt);
            continue;
        }
        actor.angle += Math.sin(elapsed * 0.00045 + actor.phase) * 0.12 * dt;
        actor.x += Math.cos(actor.angle) * actor.speed * dt;
        actor.y += Math.sin(actor.angle) * actor.speed * dt;
        actor.vX = Math.cos(actor.angle) * Math.min(6, actor.speed / AGAR_TICK_RATE);
        actor.vY = Math.sin(actor.angle) * Math.min(6, actor.speed / AGAR_TICK_RATE);
        if (wrapActor(actor, 'agar', width, height, actor.radius + 20)) {
            actor.spawnDelay = 0.8 + Math.random() * 2.4;
        }
    }

    for (const actor of actors) {
        if (actor.spawnDelay > 0) continue;
        const flagCode = parseFlagSkin(actor.color);
        ctx.fillStyle = flagCode ? '#ffffff' : actor.color;
        ctx.strokeStyle = flagCode ? '#16161d' : actor.borderColor === '#000000' ? darkerColor(actor.color) : actor.borderColor;
        ctx.lineWidth = 7;
        ctx.shadowColor = flagCode ? '#000000' : actor.color;
        ctx.shadowBlur = 8;
        drawOrganicCell(actor, borders, ctx, actors, true);
    }
}

function survivTargetForActor(actor, actors, dt) {
    actor.targetLock = Math.max(0, actor.targetLock - dt);
    let target = actor.targetLock > 0
        ? actors.find((candidate) => candidate.id === actor.targetId && candidate !== actor)
        : null;

    if (!target) {
        let nearestDistance = Infinity;
        for (const candidate of actors) {
            if (candidate === actor) continue;
            const candidateDistance = Math.hypot(candidate.x - actor.x, candidate.y - actor.y);
            if (candidateDistance < nearestDistance) {
                target = candidate;
                nearestDistance = candidateDistance;
            }
        }
        actor.targetId = target?.id || null;
        actor.targetGeneration = target?.spawnGeneration || 0;
        actor.targetLock = 1.8 + Math.abs(Math.sin(actor.phase + actor.decisionIndex)) * 2.2;
    }

    // A recycled target can jump to the opposite edge while keeping the same id.
    if (target && actor.targetGeneration !== (target.spawnGeneration || 0)) {
        actor.targetId = null;
        actor.targetLock = 0;
        target = null;
    }

    return {
        target,
        distance: target ? Math.hypot(target.x - actor.x, target.y - actor.y) : Infinity,
    };
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

function drawSurvivMuzzleBurst(ctx, actor) {
    if (actor.muzzle <= 0) return;
    const strength = Math.max(0, Math.min(1, actor.muzzle / 0.11));
    const angle = actor.muzzleAngle ?? actor.angle;
    const x = actor.x + Math.cos(angle) * 29;
    const y = actor.y + Math.sin(angle) * 29;
    const radius = 46 + strength * 68;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `rgba(255, 249, 218, ${0.34 * strength})`);
    glow.addColorStop(0.22, `rgba(255, 202, 92, ${0.2 * strength})`);
    glow.addColorStop(0.58, `rgba(255, 158, 64, ${0.08 * strength})`);
    glow.addColorStop(1, 'rgba(255, 126, 42, 0)');

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(8px)';
    ctx.fillStyle = glow;
    ctx.shadowColor = 'rgba(255, 174, 64, 0.35)';
    ctx.shadowBlur = 26 * strength;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function updateAndDrawSurviv(ctx, renderer, actors, bullets, dt, elapsed, width, height) {
    for (const actor of actors) {
        actor.nextDecision -= dt;
        actor.nextStrafe -= dt;
        actor.nextShot -= dt;
        actor.muzzle = Math.max(0, actor.muzzle - dt);

        const { target, distance } = survivTargetForActor(actor, actors, dt);
        // Avoid rapid left/right flips when two actors pass very close together.
        const targetAngle = target && distance > 58
            ? Math.atan2(target.y - actor.y, target.x - actor.x)
            : actor.angle;
        const range = survivPreferredRange(actor.weapon);
        const actorInside = isInsideScene(actor, 'surviv', width, height, 8);
        actor.outsideTime = actorInside ? 0 : actor.outsideTime + dt;

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
        if (!actorInside) {
            desiredMovementAngle = Math.atan2(height / 2 - actor.y, width / 2 - actor.x);
            actor.movementScale = 1;
        } else if (actor.movementMode === 'retreat') desiredMovementAngle += Math.PI;
        else if (actor.movementMode === 'strafe') {
            desiredMovementAngle += actor.strafeSide * Math.PI / 2;
            desiredMovementAngle += Math.sin(elapsed * 0.0032 + actor.phase) * 0.2;
        } else if (actor.movementMode === 'wander') {
            desiredMovementAngle = actor.movementAngle + Math.sin(elapsed * 0.0014 + actor.phase) * 0.45;
        } else {
            desiredMovementAngle += Math.sin(elapsed * 0.0019 + actor.phase) * 0.12;
        }

        actor.movementAngle = turnToward(actor.movementAngle, desiredMovementAngle, 2.1 * dt);
        actor.angle = turnToward(actor.angle, targetAngle, 0.9 * dt);
        actor.x += Math.cos(actor.movementAngle) * SURVIV_BACKGROUND_SPEED * actor.movementScale * dt;
        actor.y += Math.sin(actor.movementAngle) * SURVIV_BACKGROUND_SPEED * actor.movementScale * dt;
        const wrapped = wrapActor(actor, 'surviv', width, height, 190);
        if (wrapped) continue;
        if (actor.outsideTime > 6.5) {
            respawnActor(actor, 'surviv', width, height);
            continue;
        }

        const targetInside = target && isInsideScene(target, 'surviv', width, height, 20);
        if (actorInside && targetInside && actor.nextShot <= 0) {
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
            actor.muzzle = 0.11;
            actor.muzzleAngle = shotAngle;
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
        drawSurvivMuzzleBurst(ctx, actor);
        renderer._muzzleFlash = actor.muzzle > 0 ? (actor.muzzle / 0.11) * 0.45 : 0;
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

export default function PregameGameBackground({ mode, slitherColor, agarColor, survivColor, paused = false }) {
    const canvasRef = useRef(null);
    const family = familyForMode(mode);

    useEffect(() => {
        if (paused) return undefined;
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
            const maxDpr = family === 'slither' ? (mobile ? 0.78 : 0.82) : (mobile ? 1.35 : 1.25);
            dpr = Math.max(family === 'slither' ? 0.7 : 1, Math.min(window.devicePixelRatio || 1, maxDpr));
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
            if (now - lastPaint < 12) return;
            lastPaint = now;
            const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
            lastFrame = now;
            frame += 1;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';

            if (family === 'slither') {
                let remaining = dt;
                while (remaining > 0) {
                    const step = Math.min(1 / 60, remaining);
                    updateSnakes(actors, step, now - remaining * 1000, width, height);
                    remaining -= step;
                }
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
    }, [mode, slitherColor, agarColor, survivColor, paused]);

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
                willChange: 'transform',
            }} />
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse at center, rgba(12,13,18,0.05) 20%, rgba(12,13,18,0.68) 100%)',
            }} />
        </div>
    );
}
