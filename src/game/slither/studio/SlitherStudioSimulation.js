import {
    SLITHER,
    balanceToSegmentCount,
    createSegments,
    processSlitherRoom,
    segmentSpacingForBalance,
    radiusScaleForSegmentCount,
    scaleForSegmentCount,
} from './engine/slither-engine.js';

const TICK_RATE = SLITHER.serverTickRate;
const TICK_MS = 1000 / TICK_RATE;
const NOOP_IO = { to: () => ({ emit: () => {} }) };

function createSeededRandom(seed) {
    let state = (Number(seed) || 1) >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(a, b, amount) {
    return a + (b - a) * amount;
}

function framePair(frames, time) {
    if (!frames?.length) return [null, null, 0];
    if (time <= frames[0].time) return [frames[0], frames[0], 0];
    for (let index = 1; index < frames.length; index += 1) {
        if (time <= frames[index].time) {
            const from = frames[index - 1];
            const to = frames[index];
            const span = Math.max(0.0001, to.time - from.time);
            return [from, to, clamp((time - from.time) / span, 0, 1)];
        }
    }
    const last = frames[frames.length - 1];
    return [last, last, 0];
}

function desiredPathPoint(path, time) {
    const [from, to, mix] = framePair(path, time);
    if (!from || !to) return null;
    return {
        x: lerp(from.x, to.x, mix),
        y: lerp(from.y, to.y, mix),
        boost: mix < 0.5 ? from.boost : to.boost,
    };
}

function segmentsFromTrail(trail, balance, fallbackX, fallbackY, fallbackAngle) {
    if (!Array.isArray(trail) || trail.length < 2) {
        return createSegments(fallbackX, fallbackY, balance, fallbackAngle);
    }

    const points = trail.map(point => ({
        x: Number(point.x) || 0,
        y: Number(point.y) || 0,
    }));
    const requiredCount = balanceToSegmentCount(balance);
    const spacing = segmentSpacingForBalance(balance);
    const segments = [{ ...points[0] }];
    let edgeIndex = 1;
    let cursor = { ...points[0] };
    let remainingOnEdge = Math.hypot(points[1].x - cursor.x, points[1].y - cursor.y);

    while (segments.length < requiredCount) {
        let distanceToPlace = spacing;
        while (distanceToPlace > remainingOnEdge && edgeIndex < points.length) {
            distanceToPlace -= remainingOnEdge;
            cursor = { ...points[edgeIndex] };
            edgeIndex += 1;
            if (edgeIndex < points.length) {
                remainingOnEdge = Math.hypot(
                    points[edgeIndex].x - cursor.x,
                    points[edgeIndex].y - cursor.y,
                );
            }
        }

        if (edgeIndex >= points.length || remainingOnEdge < 1e-6) {
            const last = points[points.length - 1];
            const previous = points[points.length - 2];
            const dx = last.x - previous.x;
            const dy = last.y - previous.y;
            const length = Math.max(1e-6, Math.hypot(dx, dy));
            cursor = {
                x: segments[segments.length - 1].x + (dx / length) * spacing,
                y: segments[segments.length - 1].y + (dy / length) * spacing,
            };
            segments.push(cursor);
            continue;
        }

        const target = points[edgeIndex];
        const mix = distanceToPlace / remainingOnEdge;
        cursor = {
            x: cursor.x + (target.x - cursor.x) * mix,
            y: cursor.y + (target.y - cursor.y) * mix,
        };
        remainingOnEdge -= distanceToPlace;
        segments.push({ ...cursor });
    }

    return segments;
}

function serializeSnake(snake, playerId) {
    const segmentCount = snake.segments.length;
    const visualSegmentCount = Math.max(segmentCount, Number(snake._studioVisualSegmentCount) || segmentCount);
    const radiusScale = radiusScaleForSegmentCount(visualSegmentCount);
    const lengthScale = scaleForSegmentCount(visualSegmentCount);
    const maxPoints = snake.id === playerId ? 120 : 72;
    const segments = [];
    const source = snake.segments;
    if (source.length <= maxPoints) {
        for (const point of source) segments.push({ x: point.x, y: point.y });
    } else {
        for (let index = 0; index < maxPoints; index += 1) {
            const sourceIndex = Math.round((index * (source.length - 1)) / (maxPoints - 1));
            segments.push({ x: source[sourceIndex].x, y: source[sourceIndex].y });
        }
    }
    return {
        id: snake.id,
        name: snake.username,
        balance: snake.balance,
        dollarBalance: snake.dollarBalance,
        color: snake.color,
        isBot: false,
        isYou: snake.id === playerId,
        segments,
        sct: visualSegmentCount,
        angle: snake.angle || 0,
        sc: radiusScale,
        fam: snake.fam ?? 0,
        wsep: SLITHER.segmentSepFactor * lengthScale,
        radius: SLITHER.baseRadius * radiusScale,
        boost: !!snake.boost,
    };
}

function makeActor(definition) {
    const start = definition.start || {};
    const angle = Number(start.angle) || 0;
    const balance = Math.max(1, Number(definition.balance) || 1);
    const x = Number(start.x) || 0;
    const y = Number(start.y) || 0;
    const segments = definition.initialTrail
        ? segmentsFromTrail(definition.initialTrail, balance, x, y, angle)
        : createSegments(x, y, balance, angle, Number(start.bend) || 0);
    return {
        id: definition.id,
        username: definition.name ?? '',
        isBot: false,
        balance,
        dollarBalance: balance,
        entryFeeUsd: 10,
        botStake: 1,
        kills: 0,
        color: definition.color || '#c080ff',
        segments,
        path: segments.map(point => ({ x: point.x, y: point.y })),
        inputDx: Math.cos(angle),
        inputDy: Math.sin(angle),
        boost: false,
        angle,
        fam: 0,
        spawnGraceUntil: 0,
        _studioVisualSegmentCount: Math.max(0, Number(definition.visualSegmentCount) || 0),
    };
}

function makeFood(random, definition, worldHalf) {
    const count = Math.max(0, Number(definition?.count) || 0);
    const radius = Math.min(worldHalf - 50, Number(definition?.radius) || worldHalf - 80);
    const food = [];
    for (let index = 0; index < count; index += 1) {
        const angle = random() * Math.PI * 2;
        const distance = Math.sqrt(random()) * radius;
        food.push({
            id: `studio-food-${index}`,
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            balance: 0.02,
            dollarValue: 0.02,
            hue: Math.floor(random() * 360),
            radius: SLITHER.foodRadius * (0.85 + random() * 0.45),
        });
    }
    return food;
}

export class SlitherStudioSimulation {
    constructor(scenario) {
        this.scenario = scenario;
        this.tick = 0;
        this.eventIndex = 0;
        this.random = createSeededRandom(scenario.seed);
        this.deathLog = [];
        const worldHalf = Number(scenario.worldHalf) || SLITHER.worldHalf;
        const actors = scenario.actors.map(makeActor);
        this.room = {
            id: `studio-${scenario.id || 'scene'}`,
            players: [],
            slitherBots: actors,
            sandboxStaticWorms: [],
            slitherFood: makeFood(this.random, scenario.food, worldHalf),
            spectators: [],
            foodPoolBalance: 1000,
            aiBudgetBalance: 0,
            ownerBalance: 0,
            entryFeeUsd: 10,
            isSandbox: true,
            sandboxBotAi: false,
            sandboxInvincible: false,
            sandboxWorldHalf: worldHalf,
            sandboxSpeedMultiplier: Number(scenario.speedMultiplier) || 1,
            isBattleRoyale: false,
        };
        this.events = [...(scenario.events || [])].sort((a, b) => a.time - b.time);
        this.actorDefinitions = new Map(scenario.actors.map(actor => [actor.id, actor]));
    }

    get elapsedSeconds() {
        return this.tick / TICK_RATE;
    }

    get durationSeconds() {
        return Math.max(1, Number(this.scenario.duration) || 15);
    }

    get finished() {
        return this.elapsedSeconds >= this.durationSeconds;
    }

    getActor(id) {
        return this.room.slitherBots.find(actor => actor.id === id) || null;
    }

    _applyEvents(time) {
        this._collisionTick = false;
        this._collisionActorId = null;
        while (this.eventIndex < this.events.length && this.events[this.eventIndex].time <= time) {
            const event = this.events[this.eventIndex];
            this.eventIndex += 1;
            const actor = this.getActor(event.actor);
            if (!actor) continue;

            if (event.action === 'boost') {
                actor._studioBoostUntil = time + Math.max(0, Number(event.duration) || 0);
            }
            if (event.action === 'aimAtBody') {
                actor._studioBodyTarget = {
                    target: event.target,
                    segment: Number(event.segment),
                    segmentRatio: Number(event.segmentRatio),
                    until: time + Math.max(0.25, Number(event.duration) || 2),
                    boost: event.boost !== false,
                };
            }


            if (event.action === 'crashInto') {
                const target = this.getActor(event.target);
                if (!target?.segments?.length) continue;
                const targetIndex = clamp(
                    Math.round(Number(event.segment) || target.segments.length * 0.45),
                    4,
                    target.segments.length - 1,
                );
                const point = target.segments[targetIndex];
                const previous = target.segments[Math.max(0, targetIndex - 2)] || point;
                const bodyAngle = Math.atan2(point.y - previous.y, point.x - previous.x);
                const approachAngle = bodyAngle + Math.PI / 2;
                actor.angle = approachAngle;
                actor.inputDx = Math.cos(approachAngle);
                actor.inputDy = Math.sin(approachAngle);
                actor.segments = createSegments(
                    point.x - Math.cos(approachAngle) * 1.5,
                    point.y - Math.sin(approachAngle) * 1.5,
                    actor.balance,
                    approachAngle,
                );
                actor._studioBoostUntil = time + 0.2;
                this._collisionTick = true;
                this._collisionActorId = actor.id;
            }
        }
    }

    _steerActors(time) {
        for (const actor of this.room.slitherBots) {
            const definition = this.actorDefinitions.get(actor.id);
            const head = actor.segments?.[0];
            if (!definition || !head) continue;
            if (time < (Number(definition.inactiveUntil) || 0)) {
                actor.frozen = true;
                continue;
            }
            actor.frozen = false;

            let target = desiredPathPoint(definition.path, time);
            const bodyCommand = definition.bodyTargets?.find(command => (
                time >= (Number(command.from) || 0)
                && time <= (Number(command.to) || this.durationSeconds)
            )) || (time <= (actor._studioBodyTarget?.until || -1) ? actor._studioBodyTarget : null);
            if (bodyCommand) {
                const bodyOwner = this.getActor(bodyCommand.target);
                if (bodyOwner?.segments?.length) {
                    const fallbackIndex = Math.round(bodyOwner.segments.length * 0.45);
                    const ratioIndex = Number.isFinite(bodyCommand.segmentRatio)
                        ? Math.round(bodyOwner.segments.length * bodyCommand.segmentRatio)
                        : fallbackIndex;
                    const index = clamp(Number.isFinite(bodyCommand.segment) ? bodyCommand.segment : ratioIndex, 4, bodyOwner.segments.length - 1);
                    const point = bodyOwner.segments[Math.round(index)];
                    target = { x: point.x, y: point.y, boost: bodyCommand.boost !== false };
                }
            }

            const foodCommand = definition.foodChase;
            const foodChaseActive = foodCommand
                && time >= (Number(foodCommand.from) || 0)
                && time <= (Number(foodCommand.to) || this.durationSeconds)
                && actor.dollarBalance < (Number(foodCommand.stopBalance) || Infinity);
            const foodChaseWindow = foodCommand
                && time >= (Number(foodCommand.from) || 0)
                && time <= (Number(foodCommand.to) || this.durationSeconds);
            if (!bodyCommand && foodChaseWindow && !foodChaseActive && foodCommand.exit) {
                target = { x: foodCommand.exit.x, y: foodCommand.exit.y, boost: false };
            }
            if (!bodyCommand && foodChaseActive) {
                let bestFood = null;
                let bestScore = Infinity;
                const headingX = Math.cos(actor.angle || 0);
                const headingY = Math.sin(actor.angle || 0);
                for (const food of this.room.slitherFood) {
                    if (foodCommand.deathDropOnly !== false && !food.deathDrop) continue;
                    if (foodCommand.ordered === true) {
                        bestFood = food;
                        break;
                    }
                    const dx = food.x - head.x;
                    const dy = food.y - head.y;
                    const distance = Math.hypot(dx, dy);
                    const behindPenalty = dx * headingX + dy * headingY < 0 ? 90 : 0;
                    const score = distance + behindPenalty;
                    if (score < bestScore) {
                        bestScore = score;
                        bestFood = food;
                    }
                }
                if (bestFood) {
                    target = { x: bestFood.x, y: bestFood.y, boost: foodCommand.boost === true };
                }
            }

            if (!target && definition.chase) {
                const chased = this.getActor(definition.chase.target);
                const chasedHead = chased?.segments?.[0];
                if (chasedHead) {
                    const lead = Number(definition.chase.lead) || 0;
                    target = {
                        x: chasedHead.x + Math.cos(chased.angle || 0) * lead,
                        y: chasedHead.y + Math.sin(chased.angle || 0) * lead,
                    };
                }
            }

            if (target) {
                actor.inputDx = target.x - head.x;
                actor.inputDy = target.y - head.y;
            }
            actor.boost = time < (actor._studioBoostUntil || 0) || target?.boost === true;
        }
    }

    step() {
        if (this.finished) return this.getRenderState();
        const time = this.elapsedSeconds;
        this._applyEvents(time);
        this._steerActors(time);

        const aliveBefore = new Map(this.room.slitherBots.map(actor => [actor.id, actor.dollarBalance]));
        const originalRandom = Math.random;
        Math.random = this.random;
        try {
            this.room.sandboxInvincible = false;
            if (this._collisionTick) {
                for (const actor of this.room.slitherBots) {
                    actor.frozen = actor.id !== this._collisionActorId;
                }
            }
            processSlitherRoom(this.room, NOOP_IO, null, null);
        } finally {
            for (const actor of this.room.slitherBots) actor.frozen = false;
            Math.random = originalRandom;
        }
        const deathFoodHue = Number(this.scenario.deathFoodHue);
        if (Number.isFinite(deathFoodHue)) {
            for (const food of this.room.slitherFood) {
                if (food.deathDrop) food.hue = deathFoodHue;
            }
        }
        this.tick += 1;
        for (const [id, balance] of aliveBefore) {
            if (!this.getActor(id) && !this.deathLog.some(entry => entry.id === id)) {
                this.deathLog.push({
                    id,
                    time: time + 1 / TICK_RATE,
                    balance,
                });
            }
        }
        return this.getRenderState();
    }

    getRenderState() {
        const playerId = this.scenario.playerId || this.scenario.actors[0]?.id;
        return {
            you: playerId,
            snakes: this.room.slitherBots.map(actor => serializeSnake(actor, playerId)),
            food: this.room.slitherFood.map(item => ({
                id: item.id,
                x: item.x,
                y: item.y,
                hue: item.hue,
                radius: item.radius || SLITHER.foodRadius,
                golden: !!item.golden,
                deathDrop: !!item.deathDrop,
            })),
            worldHalf: this.room.sandboxWorldHalf,
            circularMap: true,
            balance: this.getActor(playerId)?.dollarBalance || 0,
            minimap: [],
        };
    }

    getDiagnostics() {
        const playerId = this.scenario.playerId || this.scenario.actors[0]?.id;
        const player = this.getActor(playerId);
        return {
            time: this.elapsedSeconds,
            deaths: this.deathLog.map(entry => ({ ...entry })),
            playerAlive: !!player,
            playerBalance: player?.dollarBalance ?? 0,
        };
    }

    getCamera() {
        const [from, to, mix] = framePair(this.scenario.camera, this.elapsedSeconds);
        const fallbackId = this.scenario.playerId || this.scenario.actors[0]?.id;
        const followId = (mix < 0.5 ? from?.follow : to?.follow) || fallbackId;
        const actor = this.getActor(followId) || this.getActor(fallbackId);
        const head = actor?.segments?.[0] || { x: 0, y: 0 };
        return {
            x: head.x + lerp(Number(from?.offsetX) || 0, Number(to?.offsetX) || 0, mix),
            y: head.y + lerp(Number(from?.offsetY) || 0, Number(to?.offsetY) || 0, mix),
            zoom: lerp(Number(from?.zoom) || 1.35, Number(to?.zoom) || 1.35, mix),
        };
    }
}

export const STUDIO_TICK_MS = TICK_MS;
