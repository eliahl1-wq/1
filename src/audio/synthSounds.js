let audioCtx = null;
let unlocked = false;
const noiseBuffers = new Map();
const footstepNoiseBuffers = new Map();
let footstepMaster = null;

const THROTTLE_MS = 38;
const STREAK_WINDOW_MS = 220;
const MAX_STREAK = 12;

let lastFoodEatAt = 0;
let foodStreak = 0;
let foodStreakAt = 0;

function getCtx() {
    return audioCtx;
}

function createCtx() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
}

function getNoiseBuffer(ctx, durationSec = 0.03, variation = 0) {
    const lengthKey = Math.ceil(durationSec * 1000);
    const key = `${ctx.sampleRate}:${lengthKey}:${variation & 15}`;
    const cached = noiseBuffers.get(key);
    if (cached) return cached;
    const len = Math.ceil(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let state = (0x9e3779b9 ^ Math.imul((variation | 0) + 1, 0x85ebca6b) ^ len) >>> 0;
    for (let i = 0; i < len; i++) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        data[i] = ((state >>> 0) / 0x80000000) - 1;
    }
    noiseBuffers.set(key, buffer);
    return buffer;
}

function getFootstepNoiseBuffer(ctx, durationSec, variation, roughness = 0.55) {
    const durationKey = Math.ceil(durationSec * 1000);
    const roughnessKey = Math.round(roughness * 10);
    const key = `${ctx.sampleRate}:${durationKey}:${variation & 31}:${roughnessKey}`;
    const cached = footstepNoiseBuffers.get(key);
    if (cached) return cached;

    const len = Math.ceil(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let state = (0x6d2b79f5 ^ Math.imul((variation | 0) + 7, 0x27d4eb2d) ^ len) >>> 0;
    let softNoise = 0;
    const dryAmount = Math.max(0.12, Math.min(0.88, roughness));
    for (let i = 0; i < len; i++) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        const whiteNoise = ((state >>> 0) / 0x80000000) - 1;
        softNoise += (whiteNoise - softNoise) * 0.16;
        data[i] = whiteNoise * dryAmount + softNoise * (1 - dryAmount);
    }
    footstepNoiseBuffers.set(key, buffer);
    return buffer;
}

/** Unlock audio after a user gesture (required by browsers). */
export function unlockGameAudio() {
    const ctx = createCtx();
    if (!ctx || unlocked) return;

    const prime = () => {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        unlocked = true;
    };

    if (ctx.state === 'suspended') {
        ctx.resume().then(prime).catch(() => {});
    } else {
        prime();
    }
}

function nextStreak() {
    const now = performance.now();
    if (now - foodStreakAt <= STREAK_WINDOW_MS) {
        foodStreak = Math.min(foodStreak + 1, MAX_STREAK);
    } else {
        foodStreak = 0;
    }
    foodStreakAt = now;
    return foodStreak;
}

/**
 * Minecraft-style item pickup pop — short, sharp, bubbly, organic plop.
 * Quick downward pitch swoop + soft body + tiny wet attack.
 */
export function playFoodEatSound() {
    const now = performance.now();
    if (now - lastFoodEatAt < THROTTLE_MS) return;
    lastFoodEatAt = now;

    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const streak = nextStreak();
    const lift = streak * 18;
    const jitter = (Math.random() - 0.5) * 70;
    const startHz = 780 + lift + jitter;
    const endHz = 310 + lift * 0.35 + jitter * 0.2;
    const duration = 0.048;
    const gain = 0.036;

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.linearRampToValueAtTime(gain, t + 0.0006);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    bus.connect(ctx.destination);

    // Main pop — fast downward glide (the iconic "boop").
    const pop = ctx.createOscillator();
    const popG = ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(startHz, t);
    pop.frequency.exponentialRampToValueAtTime(Math.max(endHz, 40), t + duration * 0.52);
    popG.gain.value = 0.72;
    pop.connect(popG);
    popG.connect(bus);
    pop.start(t);
    pop.stop(t + duration + 0.015);

    // Warm organic body underneath.
    const body = ctx.createOscillator();
    const bodyG = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(startHz * 0.52, t);
    body.frequency.exponentialRampToValueAtTime(Math.max(endHz * 0.75, 40), t + duration * 0.58);
    bodyG.gain.setValueAtTime(0.0001, t);
    bodyG.gain.linearRampToValueAtTime(0.28, t + 0.002);
    bodyG.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.7);
    body.connect(bodyG);
    bodyG.connect(bus);
    body.start(t);
    body.stop(t + duration + 0.015);

    // Bubbly wet attack — short bandpassed noise blip.
    const blip = ctx.createBufferSource();
    blip.buffer = getNoiseBuffer(ctx, 0.012);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = startHz * 1.15;
    bp.Q.value = 1.1;
    const blipG = ctx.createGain();
    blipG.gain.setValueAtTime(0.22, t);
    blipG.gain.exponentialRampToValueAtTime(0.0001, t + 0.014);
    blip.connect(bp);
    bp.connect(blipG);
    blipG.connect(bus);
    blip.start(t);
    blip.stop(t + 0.016);

    // Tiny high sparkle at the very start — the sharp "pickup" edge.
    const spark = ctx.createOscillator();
    const sparkG = ctx.createGain();
    spark.type = 'sine';
    spark.frequency.setValueAtTime(startHz * 1.45, t);
    spark.frequency.exponentialRampToValueAtTime(Math.max(startHz * 0.95, 40), t + 0.022);
    sparkG.gain.setValueAtTime(0.14, t);
    sparkG.gain.exponentialRampToValueAtTime(0.0001, t + 0.024);
    spark.connect(sparkG);
    sparkG.connect(bus);
    spark.start(t);
    spark.stop(t + 0.028);
}

const FOOTSTEP_PROFILES = Object.freeze({
    grass: {
        duration: 0.18, volume: 0.09, bodyLowpass: 230, bodyGain: 0.72,
        contactHighpass: 90, contactLowpass: 1250, contactGain: 0.66,
        toeHighpass: 340, toeLowpass: 2050, toeGain: 0.22,
        grainHighpass: 620, grainLowpass: 2900, textureGain: 0.075, grains: 4, roughness: 0.34,
    },
    dirt: {
        duration: 0.16, volume: 0.088, bodyLowpass: 280, bodyGain: 0.78,
        contactHighpass: 80, contactLowpass: 1420, contactGain: 0.7,
        toeHighpass: 260, toeLowpass: 1800, toeGain: 0.18,
        grainHighpass: 480, grainLowpass: 2650, textureGain: 0.082, grains: 4, roughness: 0.42,
    },
    gravel: {
        duration: 0.19, volume: 0.082, bodyLowpass: 340, bodyGain: 0.7,
        contactHighpass: 140, contactLowpass: 2300, contactGain: 0.62,
        toeHighpass: 480, toeLowpass: 2950, toeGain: 0.2,
        grainHighpass: 680, grainLowpass: 4100, textureGain: 0.095, grains: 8, roughness: 0.72,
    },
    asphalt: {
        duration: 0.125, volume: 0.083, bodyLowpass: 310, bodyGain: 0.82,
        contactHighpass: 145, contactLowpass: 1650, contactGain: 0.72,
        toeHighpass: 410, toeLowpass: 2150, toeGain: 0.13,
        grainHighpass: 700, grainLowpass: 3100, textureGain: 0.055, grains: 2, roughness: 0.56,
    },
    indoor: {
        duration: 0.13, volume: 0.078, bodyLowpass: 295, bodyGain: 0.76,
        contactHighpass: 165, contactLowpass: 1750, contactGain: 0.7,
        toeHighpass: 330, toeLowpass: 2050, toeGain: 0.13,
        grainHighpass: 720, grainLowpass: 2900, textureGain: 0.045, grains: 1, roughness: 0.46,
    },
    wood: {
        duration: 0.16, volume: 0.081, bodyLowpass: 265, bodyGain: 0.84,
        contactHighpass: 110, contactLowpass: 1380, contactGain: 0.7,
        toeHighpass: 280, toeLowpass: 1900, toeGain: 0.16,
        grainHighpass: 600, grainLowpass: 2600, textureGain: 0.052, grains: 2, roughness: 0.36,
    },
    water: {
        duration: 0.28, volume: 0.098, bodyLowpass: 205, bodyGain: 0.48,
        contactHighpass: 65, contactLowpass: 1850, contactGain: 0.72,
        toeHighpass: 320, toeLowpass: 2750, toeGain: 0.34,
        grainHighpass: 760, grainLowpass: 3900, textureGain: 0.075, grains: 5, roughness: 0.66,
    },
});

function footstepVariation(stepIndex, salt = 0) {
    const value = Math.sin((stepIndex + 1) * 12.9898 + (salt + 1) * 78.233) * 43758.5453;
    return value - Math.floor(value);
}

function normalizeFootstepSurface(surface) {
    if (FOOTSTEP_PROFILES[surface]) return surface;
    if (surface === 'road' || surface === 'service') return 'asphalt';
    if (surface === 'trail' || surface === 'ground') return 'grass';
    return 'grass';
}

function getFootstepMaster(ctx) {
    if (footstepMaster?.ctx === ctx) return footstepMaster.input;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.16;
    const output = ctx.createGain();
    output.gain.value = 0.82;
    compressor.connect(output);
    output.connect(ctx.destination);
    footstepMaster = { ctx, input: compressor };
    return compressor;
}

function addFootstepNoise(ctx, destination, options) {
    const {
        at, duration, attack = 0.003, gain, highpass = 45, lowpass = 2000,
        q = 0.36, variation = 0, playbackRate = 1, roughness = 0.55,
    } = options;
    const source = ctx.createBufferSource();
    source.buffer = getFootstepNoiseBuffer(ctx, duration + 0.035, variation, roughness);
    source.playbackRate.value = playbackRate;
    const highFilter = ctx.createBiquadFilter();
    highFilter.type = 'highpass';
    highFilter.frequency.setValueAtTime(Math.max(30, highpass), at);
    highFilter.Q.value = q;
    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.setValueAtTime(Math.max(highpass + 80, lowpass), at);
    lowFilter.Q.value = q;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(Math.max(0.0001, gain), at + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(highFilter);
    highFilter.connect(lowFilter);
    lowFilter.connect(envelope);
    envelope.connect(destination);
    source.start(at);
    source.stop(at + duration + 0.025);
}

/**
 * Layered Surviv footsteps made entirely from softly coloured noise. Broad,
 * low-resonance filters avoid a metallic ring while separate body, sole,
 * toe-off and loose-surface layers keep each material recognisable.
 */
export function playSurvivFootstep(surface = 'ground', stepIndex = 0, intensity = 1) {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;

    const material = normalizeFootstepSurface(surface);
    const profile = FOOTSTEP_PROFILES[material];
    const t = ctx.currentTime;
    const strength = Math.max(0.64, Math.min(1.06, Number(intensity) || 1));
    const pitchJitter = 0.965 + footstepVariation(stepIndex, 1) * 0.07;
    const alternatingPitch = stepIndex % 2 === 0 ? 1.008 : 0.992;
    const pitch = pitchJitter * alternatingPitch;

    const bus = ctx.createGain();
    bus.gain.value = profile.volume * strength;
    const master = getFootstepMaster(ctx);
    if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        const side = stepIndex % 2 === 0 ? -1 : 1;
        panner.pan.value = side * (0.018 + footstepVariation(stepIndex, 3) * 0.014);
        bus.connect(panner);
        panner.connect(master);
    } else {
        bus.connect(master);
    }

    // Heel/body: coloured low noise feels like weight hitting a surface. A
    // tonal oscillator is deliberately avoided because it sounds synthetic.
    addFootstepNoise(ctx, bus, {
        at: t,
        duration: material === 'water' ? 0.09 : 0.058,
        attack: 0.0025,
        gain: profile.bodyGain,
        highpass: 38,
        lowpass: profile.bodyLowpass * pitch,
        q: 0.32,
        variation: stepIndex * 3,
        playbackRate: pitch,
        roughness: 0.22,
    });

    // The broad sole layer provides contact and friction without a narrow,
    // resonant band that can ring like metal.
    addFootstepNoise(ctx, bus, {
        at: t + (material === 'water' ? 0.009 : 0.007),
        duration: profile.duration,
        attack: material === 'water' ? 0.014 : 0.006,
        gain: profile.contactGain,
        highpass: profile.contactHighpass * pitch,
        lowpass: profile.contactLowpass * pitch,
        q: 0.36,
        variation: stepIndex * 3 + 1,
        playbackRate: 0.975 + footstepVariation(stepIndex, 5) * 0.05,
        roughness: profile.roughness,
    });

    // A softer scrape at toe-off makes the foot roll over the ground.
    addFootstepNoise(ctx, bus, {
        at: t + (material === 'water' ? 0.07 : 0.045),
        duration: material === 'water' ? 0.17 : 0.085,
        attack: material === 'water' ? 0.018 : 0.009,
        gain: profile.toeGain,
        highpass: profile.toeHighpass * pitch,
        lowpass: profile.toeLowpass * pitch,
        q: 0.34,
        variation: stepIndex * 3 + 2,
        playbackRate: 0.96 + footstepVariation(stepIndex, 7) * 0.08,
        roughness: Math.min(0.78, profile.roughness + 0.08),
    });

    // A plank gives slightly under the heel, but stays muted instead of ringing.
    if (material === 'wood') {
        addFootstepNoise(ctx, bus, {
            at: t + 0.018,
            duration: 0.065,
            attack: 0.004,
            gain: 0.19,
            highpass: 55,
            lowpass: 520 * pitch,
            q: 0.3,
            variation: stepIndex * 5 + 4,
            playbackRate: pitch,
            roughness: 0.2,
        });
    }

    // Small independently timed grains sell gravel, dirt, grass and droplets.
    for (let grain = 0; grain < profile.grains; grain++) {
        const grainNoise = footstepVariation(stepIndex * 11 + grain, 9);
        const grainAt = t + 0.02 + grain * (material === 'water' ? 0.026 : 0.013) + grainNoise * 0.012;
        const grainDuration = (material === 'water' ? 0.032 : 0.014) + grainNoise * 0.014;
        addFootstepNoise(ctx, bus, {
            at: grainAt,
            duration: grainDuration,
            attack: 0.002,
            gain: profile.textureGain * (0.7 + grainNoise * 0.42),
            highpass: profile.grainHighpass * (0.82 + grainNoise * 0.18),
            lowpass: profile.grainLowpass * (0.88 + grainNoise * 0.16),
            q: 0.3,
            variation: stepIndex + grain + 6,
            playbackRate: 0.94 + grainNoise * 0.12,
            roughness: Math.min(0.86, profile.roughness + 0.12),
        });
    }
    return true;
}
