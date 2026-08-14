let audioCtx = null;
let unlocked = false;
const noiseBuffers = new Map();
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
        duration: 0.15, volume: 0.068, impactHz: 165, contactHz: 560, textureHz: 1900,
        impactGain: 0.72, contactGain: 0.55, textureGain: 0.13, grains: 3, thumpHz: 76,
    },
    dirt: {
        duration: 0.15, volume: 0.071, impactHz: 190, contactHz: 720, textureHz: 2250,
        impactGain: 0.76, contactGain: 0.58, textureGain: 0.17, grains: 4, thumpHz: 82,
    },
    gravel: {
        duration: 0.17, volume: 0.066, impactHz: 245, contactHz: 1180, textureHz: 3400,
        impactGain: 0.72, contactGain: 0.52, textureGain: 0.22, grains: 7, thumpHz: 88,
    },
    asphalt: {
        duration: 0.12, volume: 0.066, impactHz: 280, contactHz: 980, textureHz: 2500,
        impactGain: 0.78, contactGain: 0.68, textureGain: 0.11, grains: 2, thumpHz: 92,
    },
    indoor: {
        duration: 0.13, volume: 0.061, impactHz: 315, contactHz: 1320, textureHz: 2850,
        impactGain: 0.72, contactGain: 0.76, textureGain: 0.10, grains: 2, thumpHz: 102,
    },
    wood: {
        duration: 0.15, volume: 0.064, impactHz: 225, contactHz: 820, textureHz: 2050,
        impactGain: 0.72, contactGain: 0.63, textureGain: 0.12, grains: 3, thumpHz: 96,
    },
    water: {
        duration: 0.25, volume: 0.082, impactHz: 240, contactHz: 1120, textureHz: 3100,
        impactGain: 0.64, contactGain: 0.86, textureGain: 0.18, grains: 5, thumpHz: 68,
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
        at, duration, attack = 0.003, gain, filterType = 'bandpass', frequency,
        q = 0.75, variation = 0, playbackRate = 1,
    } = options;
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx, duration + 0.025, variation);
    source.playbackRate.value = playbackRate;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(45, frequency), at);
    filter.Q.value = q;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(Math.max(0.0001, gain), at + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    source.start(at);
    source.stop(at + duration + 0.015);
}

function addFootstepThump(ctx, destination, at, duration, frequency, gain) {
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(Math.max(48, frequency), at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(42, frequency * 0.58), at + duration * 0.72);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.012);
}

/**
 * Layered Surviv footsteps: heel impact, sole contact and several tiny surface
 * grains. Each material has its own spectral profile, while deterministic
 * variation and alternating stereo placement prevent a repetitive loop.
 */
export function playSurvivFootstep(surface = 'ground', stepIndex = 0, intensity = 1) {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;

    const material = normalizeFootstepSurface(surface);
    const profile = FOOTSTEP_PROFILES[material];
    const t = ctx.currentTime;
    const strength = Math.max(0.68, Math.min(1.08, Number(intensity) || 1));
    const pitchJitter = 0.94 + footstepVariation(stepIndex, 1) * 0.12;
    const alternatingPitch = stepIndex % 2 === 0 ? 1.018 : 0.982;
    const pitch = pitchJitter * alternatingPitch;

    const bus = ctx.createGain();
    bus.gain.value = profile.volume * strength;
    const master = getFootstepMaster(ctx);
    if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        const side = stepIndex % 2 === 0 ? -1 : 1;
        panner.pan.value = side * (0.045 + footstepVariation(stepIndex, 3) * 0.025);
        bus.connect(panner);
        panner.connect(master);
    } else {
        bus.connect(master);
    }

    // Heel: a short filtered impact backed by a restrained low-frequency body.
    addFootstepNoise(ctx, bus, {
        at: t,
        duration: material === 'water' ? 0.075 : 0.047,
        attack: 0.0015,
        gain: profile.impactGain,
        filterType: 'lowpass',
        frequency: profile.impactHz * pitch,
        q: 0.68,
        variation: stepIndex * 3,
        playbackRate: pitch,
    });
    addFootstepThump(
        ctx,
        bus,
        t,
        material === 'water' ? 0.105 : 0.075,
        profile.thumpHz * pitch,
        material === 'water' ? 0.15 : 0.21,
    );

    // Sole contact arrives just after the heel and supplies most of the shoe or
    // splash character without producing the old electronic pitch sweep.
    addFootstepNoise(ctx, bus, {
        at: t + (material === 'water' ? 0.009 : 0.007),
        duration: profile.duration,
        attack: material === 'water' ? 0.012 : 0.005,
        gain: profile.contactGain,
        filterType: 'bandpass',
        frequency: profile.contactHz * pitch,
        q: material === 'indoor' ? 1.05 : 0.72,
        variation: stepIndex * 3 + 1,
        playbackRate: 0.96 + footstepVariation(stepIndex, 5) * 0.1,
    });

    // Toe-off gives the step a second, quieter movement instead of one flat hit.
    addFootstepNoise(ctx, bus, {
        at: t + (material === 'water' ? 0.07 : 0.045),
        duration: material === 'water' ? 0.15 : 0.07,
        attack: 0.005,
        gain: profile.contactGain * (material === 'water' ? 0.36 : 0.2),
        filterType: material === 'grass' ? 'highpass' : 'bandpass',
        frequency: profile.contactHz * (material === 'grass' ? 1.35 : 0.82) * pitch,
        q: 0.62,
        variation: stepIndex * 3 + 2,
        playbackRate: 0.9 + footstepVariation(stepIndex, 7) * 0.15,
    });

    // Small independently timed grains sell gravel, dirt, grass and droplets.
    for (let grain = 0; grain < profile.grains; grain++) {
        const grainNoise = footstepVariation(stepIndex * 11 + grain, 9);
        const grainAt = t + 0.018 + grain * (material === 'water' ? 0.024 : 0.012) + grainNoise * 0.011;
        const grainDuration = (material === 'water' ? 0.026 : 0.011) + grainNoise * 0.012;
        addFootstepNoise(ctx, bus, {
            at: grainAt,
            duration: grainDuration,
            attack: 0.001,
            gain: profile.textureGain * (0.72 + grainNoise * 0.5),
            filterType: 'bandpass',
            frequency: profile.textureHz * (0.74 + grainNoise * 0.62),
            q: material === 'gravel' ? 2.2 : material === 'water' ? 1.3 : 1.55,
            variation: stepIndex + grain + 6,
            playbackRate: 0.88 + grainNoise * 0.28,
        });
    }
    return true;
}
