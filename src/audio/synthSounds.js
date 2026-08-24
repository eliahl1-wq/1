let audioCtx = null;
let unlocked = false;
let survivSfxOutput = null;
const noiseBuffers = new Map();
const footstepSampleData = new Map();
const footstepSampleBuffers = new Map();
let footstepMaster = null;
let foodPickupMaster = null;
let actionSoundMaster = null;
let footstepFetchPromise = null;
let footstepDecodePromise = null;
let footstepDecodeContext = null;
let gunshotMaster = null;
let explosionMaster = null;
let gunshotFetchPromise = null;
let gunshotDecodePromise = null;
let gunshotDecodeContext = null;
const gunshotSampleData = new Map();
const gunshotBuffers = new Map();
const lastGunshotVariant = new Map();
const activeGunshotVoices = [];

const SURVIV_GUNSHOT_FILES = Object.freeze({
    pistol: ['pistol-1.wav', 'pistol-2.wav', 'pistol-3.wav'],
    revolver: ['revolver-1.wav', 'revolver-2.wav', 'revolver-3.wav'],
    smg: ['smg-1.wav', 'smg-2.wav', 'smg-3.wav'],
    assault: ['assault-1.wav', 'assault-2.wav', 'assault-3.wav'],
    shotgun: ['shotgun-1.wav', 'shotgun-2.wav', 'shotgun-3.wav'],
    dmr: ['dmr-1.wav', 'dmr-2.wav', 'dmr-3.wav'],
    sniper: ['sniper-1.wav', 'sniper-2.wav', 'sniper-3.wav'],
    lmg: ['lmg-1.wav', 'lmg-2.wav', 'lmg-3.wav'],
});

const SURVIV_GRENADE_EXPLOSION_FILES = Object.freeze([
    'grenade-1.wav',
    'grenade-2.wav',
    'grenade-3.wav',
]);

const SURVIV_DOOR_FILES = Object.freeze({
    wood: ['wood-1.wav', 'wood-2.wav', 'wood-3.wav'],
    metal: ['metal-1.wav', 'metal-2.wav', 'metal-3.wav'],
});

const SURVIV_GUNSHOT_MIX = Object.freeze({
    pistol: 0.86,
    revolver: 0.82,
    smg: 0.90,
    assault: 0.82,
    shotgun: 0.76,
    dmr: 0.78,
    sniper: 0.72,
    lmg: 0.84,
});

const MAX_GUNSHOT_VOICES = 28;

const THROTTLE_MS = 30;
const STREAK_WINDOW_MS = 220;
const MAX_STREAK = 10;

let lastFoodEatAt = 0;
let foodStreak = 0;
let foodStreakAt = 0;

const FOOTSTEP_SAMPLE_PATHS = Object.freeze({
    grass: [1, 2, 3, 4].map(index => `/audio/surviv/footsteps/grass/grass-${index}.ogg`),
    dirt: [1, 2, 3, 4].map(index => `/audio/surviv/footsteps/dirt/dirt-${index}.ogg`),
    gravel: [1, 2, 3, 4, 5].map(index => `/audio/surviv/footsteps/gravel/gravel-${index}.ogg`),
    asphalt: [1, 2, 3, 4].map(index => `/audio/surviv/footsteps/asphalt/asphalt-${index}.ogg`),
    indoor: [1, 2, 3, 4].map(index => `/audio/surviv/footsteps/indoor/indoor-${index}.ogg`),
    wood: [1, 2, 3, 4].map(index => `/audio/surviv/footsteps/wood/wood-${index}.ogg`),
    water: [1, 2, 3, 4, 5].map(index => `/audio/surviv/footsteps/water/water-${index}.ogg`),
    metal: [1, 2, 3, 4].map(index => `/audio/surviv/footsteps/metal/metal-${index}.ogg`),
});

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

function getSurvivSfxOutput(ctx) {
    if (survivSfxOutput?.ctx === ctx) return survivSfxOutput.input;
    const input = ctx.createGain();
    // A small global trim keeps every Surviv effect below its previous level
    // while preserving the carefully balanced differences between effects.
    input.gain.value = 0.64;
    input.connect(ctx.destination);
    survivSfxOutput = { ctx, input };
    return input;
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

export function preloadSurvivFootsteps() {
    if (footstepFetchPromise) return footstepFetchPromise;
    if (typeof fetch !== 'function') return Promise.resolve(false);

    footstepFetchPromise = Promise.all(
        Object.entries(FOOTSTEP_SAMPLE_PATHS).map(async ([material, paths]) => {
            const samples = await Promise.all(paths.map(async path => {
                const response = await fetch(path, { cache: 'force-cache' });
                if (!response.ok) throw new Error(`Unable to load footstep sample: ${path}`);
                return response.arrayBuffer();
            }));
            footstepSampleData.set(material, samples);
        }),
    ).then(() => true).catch(() => {
        footstepSampleData.clear();
        footstepFetchPromise = null;
        return false;
    });
    return footstepFetchPromise;
}

function decodeSurvivFootsteps(ctx) {
    if (footstepDecodeContext === ctx && footstepSampleBuffers.size > 0) return Promise.resolve(true);
    if (footstepDecodeContext === ctx && footstepDecodePromise) return footstepDecodePromise;

    footstepDecodeContext = ctx;
    footstepDecodePromise = (async () => {
        if (!await preloadSurvivFootsteps()) return false;
        const decodedMaterials = await Promise.all(
            [...footstepSampleData.entries()].map(async ([material, samples]) => [
                material,
                await Promise.all(samples.map(sample => ctx.decodeAudioData(sample.slice(0)))),
            ]),
        );
        footstepSampleBuffers.clear();
        decodedMaterials.forEach(([material, samples]) => footstepSampleBuffers.set(material, samples));
        return true;
    })().catch(() => {
        footstepSampleBuffers.clear();
        footstepDecodePromise = null;
        return false;
    });
    return footstepDecodePromise;
}

/** Unlock audio after a user gesture (required by browsers). */
export function unlockGameAudio() {
    const ctx = createCtx();
    if (!ctx) return;
    void decodeSurvivFootsteps(ctx);
    void decodeSurvivGunshots(ctx);
    if (unlocked) {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return;
    }

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

function getGunshotMaster(ctx) {
    if (gunshotMaster?.ctx === ctx) return gunshotMaster.input;

    // Preserve single-shot dynamics and catch only dense overlapping fire.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -4;
    compressor.knee.value = 5;
    compressor.ratio.value = 7;
    compressor.attack.value = 0.0015;
    compressor.release.value = 0.085;
    const output = ctx.createGain();
    // Keep reports clearly above footsteps, but leave more headroom for long
    // sessions and overlapping automatic fire.
    output.gain.value = 0.45;
    compressor.connect(output);
    output.connect(getSurvivSfxOutput(ctx));
    gunshotMaster = { ctx, input: compressor };
    return compressor;
}

/** Begin fetching the compact original firearm library before the first shot. */
export function preloadSurvivGunshots() {
    if (gunshotFetchPromise) return gunshotFetchPromise;
    if (typeof fetch !== 'function') return Promise.resolve(false);

    const gunshotEntries = Object.entries(SURVIV_GUNSHOT_FILES)
        .flatMap(([weapon, files]) => files.map((file, variant) => ({ weapon, file, variant })));
    const entries = [
        ...gunshotEntries.map(entry => ({
            key: `${entry.weapon}:${entry.variant}`,
            path: `/audio/surviv/gunshots/${entry.weapon}/${entry.file}`,
        })),
        ...SURVIV_GRENADE_EXPLOSION_FILES.map((file, variant) => ({
            key: `explosion:grenade:${variant}`,
            path: `/audio/surviv/explosions/grenade/${file}`,
        })),
        ...Object.entries(SURVIV_DOOR_FILES).flatMap(([material, files]) => files.map((file, variant) => ({
            key: `door:${material}:${variant}`,
            path: `/audio/surviv/doors/${material}/${file}`,
        }))),
    ];
    gunshotFetchPromise = Promise.all(entries.map(async ({ key, path }) => {
        const response = await fetch(path, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Unable to load Surviv combat sound ${path}`);
        gunshotSampleData.set(key, await response.arrayBuffer());
    })).then(() => true).catch((error) => {
        console.warn('Surviv gunshot preload failed:', error);
        gunshotSampleData.clear();
        gunshotFetchPromise = null;
        return false;
    });
    return gunshotFetchPromise;
}

function decodeSurvivGunshots(ctx) {
    if (gunshotDecodeContext === ctx && gunshotBuffers.size > 0) return Promise.resolve(true);
    if (gunshotDecodeContext === ctx && gunshotDecodePromise) return gunshotDecodePromise;

    gunshotDecodeContext = ctx;
    gunshotDecodePromise = (async () => {
        if (!await preloadSurvivGunshots()) return false;
        const decoded = await Promise.all([...gunshotSampleData.entries()].map(async ([key, encoded]) => [
            key,
            await ctx.decodeAudioData(encoded.slice(0)),
        ]));
        gunshotBuffers.clear();
        decoded.forEach(([key, buffer]) => gunshotBuffers.set(key, buffer));
        return true;
    })().catch((error) => {
        console.warn('Surviv gunshot decode failed:', error);
        gunshotBuffers.clear();
        gunshotDecodePromise = null;
        return false;
    });
    return gunshotDecodePromise;
}

function selectGunshotVariant(weapon, count) {
    const previous = lastGunshotVariant.get(weapon);
    let next = Math.floor(Math.random() * count);
    if (count > 1 && next === previous) {
        next = (next + 1 + Math.floor(Math.random() * (count - 1))) % count;
    }
    lastGunshotVariant.set(weapon, next);
    return next;
}

function retireGunshotVoice(voice) {
    const index = activeGunshotVoices.indexOf(voice);
    if (index >= 0) activeGunshotVoices.splice(index, 1);
}

/**
 * Play one firearm report. Distance changes spectral content as well as level:
 * far reports lose sub pressure and muzzle edge instead of merely becoming a
 * quieter copy of the close recording.
 */
export function playSurvivGunshot(weaponType, options = {}) {
    const ctx = getCtx();
    const files = SURVIV_GUNSHOT_FILES[weaponType];
    if (!ctx || !unlocked || ctx.state !== 'running' || !files) return false;
    if (!gunshotDecodePromise) void decodeSurvivGunshots(ctx);

    const variant = selectGunshotVariant(weaponType, files.length);
    const buffer = gunshotBuffers.get(`${weaponType}:${variant}`);
    if (!buffer) return false;

    const distance = Math.max(0, Number(options.distance) || 0);
    const distanceMix = Math.min(1, distance / 1450);
    const attenuation = 1 / (1 + 2.65 * Math.pow(distanceMix, 1.22));
    const levelJitter = 0.965 + Math.random() * 0.07;
    const pitchCents = (Math.random() - 0.5) * 20;
    const t = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.detune.value = pitchCents;
    const removeSub = ctx.createBiquadFilter();
    removeSub.type = 'highpass';
    removeSub.frequency.value = 27 + Math.pow(distanceMix, 1.25) * 155;
    removeSub.Q.value = 0.35;
    const softenCrack = ctx.createBiquadFilter();
    softenCrack.type = 'lowpass';
    softenCrack.frequency.value = 18_500 - Math.pow(distanceMix, 0.72) * 15_300;
    softenCrack.Q.value = 0.32;
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = (SURVIV_GUNSHOT_MIX[weaponType] || 0.8) * attenuation * levelJitter;

    source.connect(removeSub);
    removeSub.connect(softenCrack);
    softenCrack.connect(voiceGain);
    let finalNode = voiceGain;
    if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-0.82, Math.min(0.82, Number(options.pan) || 0));
        voiceGain.connect(panner);
        finalNode = panner;
    }
    finalNode.connect(getGunshotMaster(ctx));

    const voice = { source, distance, startedAt: t };
    activeGunshotVoices.push(voice);
    source.onended = () => retireGunshotVoice(voice);
    source.start(t);

    if (activeGunshotVoices.length > MAX_GUNSHOT_VOICES) {
        let victim = activeGunshotVoices[0];
        for (const candidate of activeGunshotVoices) {
            if (candidate.distance > victim.distance + 40
                || (candidate.distance >= victim.distance - 40 && candidate.startedAt < victim.startedAt)) {
                victim = candidate;
            }
        }
        if (victim !== voice || distance > 700) {
            try { victim.source.stop(); } catch { /* already ended */ }
            retireGunshotVoice(victim);
        }
    }
    return true;
}

function getExplosionMaster(ctx) {
    if (explosionMaster?.ctx === ctx) return explosionMaster.input;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -3;
    compressor.knee.value = 5;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.13;
    const output = ctx.createGain();
    output.gain.value = 0.62;
    compressor.connect(output);
    output.connect(getSurvivSfxOutput(ctx));
    explosionMaster = { ctx, input: compressor };
    return compressor;
}

export function playSurvivGrenadeExplosion(options = {}) {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;
    if (!gunshotDecodePromise) void decodeSurvivGunshots(ctx);

    const variant = selectGunshotVariant('explosion:grenade', SURVIV_GRENADE_EXPLOSION_FILES.length);
    const buffer = gunshotBuffers.get(`explosion:grenade:${variant}`);
    if (!buffer) return false;

    const distance = Math.max(0, Number(options.distance) || 0);
    const distanceMix = Math.min(1, distance / 1650);
    const attenuation = 1 / (1 + 2.35 * Math.pow(distanceMix, 1.16));
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.detune.value = (Math.random() - 0.5) * 14;

    const removeSub = ctx.createBiquadFilter();
    removeSub.type = 'highpass';
    removeSub.frequency.value = 24 + Math.pow(distanceMix, 1.2) * 138;
    removeSub.Q.value = 0.32;
    const softenBlast = ctx.createBiquadFilter();
    softenBlast.type = 'lowpass';
    softenBlast.frequency.value = 17_500 - Math.pow(distanceMix, 0.72) * 14_200;
    softenBlast.Q.value = 0.3;
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = attenuation * (0.96 + Math.random() * 0.08);

    source.connect(removeSub);
    removeSub.connect(softenBlast);
    softenBlast.connect(voiceGain);
    let finalNode = voiceGain;
    if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-0.82, Math.min(0.82, Number(options.pan) || 0));
        voiceGain.connect(panner);
        finalNode = panner;
    }
    finalNode.connect(getExplosionMaster(ctx));

    const voice = { source, distance, startedAt: t };
    activeGunshotVoices.push(voice);
    source.onended = () => retireGunshotVoice(voice);
    source.start(t);
    return true;
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

function getFoodPickupMaster(ctx) {
    if (foodPickupMaster) return foodPickupMaster;

    // A gentle shared compressor catches overlapping pickup tails without
    // flattening single pickups or making rapid food chains louder and harsher.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 16;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.055;

    const output = ctx.createGain();
    // This sound is shared by Agar and Slither. Preserve its previous effective
    // level while the Surviv-only output is reduced independently.
    output.gain.value = 0.59;
    compressor.connect(output);
    output.connect(ctx.destination);
    foodPickupMaster = compressor;
    return foodPickupMaster;
}

/**
 * Short tactile food pickup: a soft upward pluck, muted organic body and a
 * tiny filtered contact texture. Inspired by physical item feedback rather
 * than an arcade beep; pitch/level vary subtly between repeated pickups.
 */
export function playFoodEatSound() {
    const now = performance.now();
    if (now - lastFoodEatAt < THROTTLE_MS) return;
    lastFoodEatAt = now;

    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const streak = nextStreak();
    // Item-pickup feedback works best notably above its source pitch. Keep our
    // waveform original, but use a wider, higher variation range for that
    // familiar light inventory-pickup energy.
    const randomPitch = Math.pow(2, ((Math.random() - 0.5) * 2.2) / 12);
    const streakPitch = Math.pow(2, Math.min(streak, 7) * 0.28 / 12);
    const pitch = randomPitch * streakPitch;
    const levelVariation = 0.92 + Math.random() * 0.12;
    const chainDuck = 1 - Math.min(streak, 8) * 0.022;
    const duration = 0.048;

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.linearRampToValueAtTime(0.033 * levelVariation * chainDuck, t + 0.0008);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    bus.connect(getFoodPickupMaster(ctx));

    // Main tactile pluck: rounded sine with a small upward motion.
    const pop = ctx.createOscillator();
    const popG = ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(610 * pitch, t);
    pop.frequency.exponentialRampToValueAtTime(905 * pitch, t + 0.022);
    popG.gain.setValueAtTime(0.0001, t);
    popG.gain.linearRampToValueAtTime(0.7, t + 0.0009);
    popG.gain.exponentialRampToValueAtTime(0.0001, t + 0.043);
    const popTone = ctx.createBiquadFilter();
    popTone.type = 'lowpass';
    popTone.frequency.value = 2200;
    popTone.Q.value = 0.45;
    pop.connect(popTone);
    popTone.connect(popG);
    popG.connect(bus);
    pop.start(t);
    pop.stop(t + 0.05);

    // Muted low body gives a soft wooden/rubbery sense of contact.
    const body = ctx.createOscillator();
    const bodyG = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(285 * pitch, t);
    body.frequency.exponentialRampToValueAtTime(405 * pitch, t + 0.021);
    bodyG.gain.setValueAtTime(0.0001, t);
    bodyG.gain.linearRampToValueAtTime(0.2, t + 0.0018);
    bodyG.gain.exponentialRampToValueAtTime(0.0001, t + 0.036);
    const bodyTone = ctx.createBiquadFilter();
    bodyTone.type = 'lowpass';
    bodyTone.frequency.value = 1180;
    bodyTone.Q.value = 0.35;
    body.connect(bodyTone);
    bodyTone.connect(bodyG);
    bodyG.connect(bus);
    body.start(t);
    body.stop(t + 0.042);

    // Very short filtered contact texture prevents the tone feeling synthetic.
    const contact = ctx.createBufferSource();
    contact.buffer = getNoiseBuffer(ctx, 0.009, streak + Math.floor(Math.random() * 8));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1680 * pitch;
    bp.Q.value = 0.82;
    const contactG = ctx.createGain();
    contactG.gain.setValueAtTime(0.16, t);
    contactG.gain.exponentialRampToValueAtTime(0.0001, t + 0.01);
    contact.connect(bp);
    bp.connect(contactG);
    contactG.connect(bus);
    contact.start(t);
    contact.stop(t + 0.011);
}

function getActionSoundMaster(ctx) {
    if (actionSoundMaster?.ctx === ctx) return actionSoundMaster.input;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 10;
    compressor.ratio.value = 2.5;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.075;
    const output = ctx.createGain();
    output.gain.value = 0.7;
    compressor.connect(output);
    output.connect(getSurvivSfxOutput(ctx));
    actionSoundMaster = { ctx, input: compressor };
    return compressor;
}

function connectSpatialActionBus(ctx, bus, pan = 0) {
    const master = getActionSoundMaster(ctx);
    if (typeof ctx.createStereoPanner !== 'function') {
        bus.connect(master);
        return;
    }
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.78, Math.min(0.78, Number(pan) || 0));
    bus.connect(panner);
    panner.connect(master);
}

function actionDistanceGain(distance, range = 900) {
    const normalized = Math.max(0, Number(distance) || 0) / range;
    return 1 / (1 + 2.4 * Math.pow(normalized, 1.3));
}

function playMechanismClick(ctx, destination, at, options = {}) {
    const duration = Math.max(0.012, Number(options.duration) || 0.038);
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx, duration + 0.008, Number(options.variation) || 0);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = Math.max(240, Number(options.frequency) || 2450);
    band.Q.value = Math.max(0.35, Number(options.q) || 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, Number(options.level) || 0.11), at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(band);
    band.connect(gain);
    gain.connect(destination);
    source.start(at);
    source.stop(at + duration + 0.009);
}

/** Dry, non-tonal empty-magazine click. */
export function playSurvivDryFireSound() {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = 0.72;
    connectSpatialActionBus(ctx, bus, 0);
    playMechanismClick(ctx, bus, t, {
        frequency: 2950,
        q: 1.15,
        level: 0.12,
        duration: 0.027,
        variation: Math.floor(Math.random() * 16),
    });
    playMechanismClick(ctx, bus, t + 0.018, {
        frequency: 1180,
        q: 0.72,
        level: 0.055,
        duration: 0.035,
        variation: 4 + Math.floor(Math.random() * 12),
    });
    return true;
}

/** Magazine handling with a precise start/lock distinction. */
export function playSurvivReloadSound(phase = 'start', weaponFamily = 'pistol') {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;
    const heavy = ['shotgun', 'dmr', 'sniper', 'lmg'].includes(weaponFamily);
    const complete = phase === 'complete';
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = complete ? 0.68 : 0.58;
    connectSpatialActionBus(ctx, bus, 0);

    playMechanismClick(ctx, bus, t, {
        frequency: complete ? (heavy ? 1620 : 2240) : (heavy ? 1180 : 1780),
        q: complete ? 0.95 : 0.72,
        level: complete ? 0.145 : 0.105,
        duration: heavy ? 0.052 : 0.038,
        variation: Math.floor(Math.random() * 16),
    });
    playMechanismClick(ctx, bus, t + (complete ? 0.055 : 0.075), {
        frequency: complete ? (heavy ? 2750 : 3450) : (heavy ? 720 : 960),
        q: complete ? 1.12 : 0.55,
        level: complete ? 0.105 : 0.065,
        duration: complete ? 0.034 : 0.058,
        variation: 3 + Math.floor(Math.random() * 13),
    });
    return true;
}

/** Quiet cloth/mechanism cue for a successful weapon swap. */
export function playSurvivEquipSound(weaponFamily = 'pistol') {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;
    const heavy = ['shotgun', 'dmr', 'sniper', 'lmg'].includes(weaponFamily);
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = 0.46;
    connectSpatialActionBus(ctx, bus, 0);

    const cloth = ctx.createBufferSource();
    cloth.buffer = getNoiseBuffer(ctx, 0.095, Math.floor(Math.random() * 16));
    const clothBand = ctx.createBiquadFilter();
    clothBand.type = 'bandpass';
    clothBand.frequency.value = heavy ? 620 : 880;
    clothBand.Q.value = 0.48;
    const clothGain = ctx.createGain();
    clothGain.gain.setValueAtTime(0.075, t);
    clothGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    cloth.connect(clothBand);
    clothBand.connect(clothGain);
    clothGain.connect(bus);
    cloth.start(t);
    cloth.stop(t + 0.1);
    playMechanismClick(ctx, bus, t + 0.035, {
        frequency: heavy ? 1450 : 2250,
        level: heavy ? 0.09 : 0.075,
        duration: 0.033,
        variation: 5 + Math.floor(Math.random() * 11),
    });
    return true;
}

/** Compact pickup confirmation; useful without turning looting into a UI jingle. */
export function playSurvivPickupSound(kind = 'item') {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;
    const isWeapon = kind === 'weapon';
    const isAmmo = kind === 'ammo';
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = 0.54;
    connectSpatialActionBus(ctx, bus, 0);
    playMechanismClick(ctx, bus, t, {
        frequency: isWeapon ? 1320 : isAmmo ? 2050 : 1680,
        q: 0.72,
        level: isWeapon ? 0.115 : 0.085,
        duration: isWeapon ? 0.052 : 0.038,
        variation: Math.floor(Math.random() * 16),
    });
    playMechanismClick(ctx, bus, t + 0.035, {
        frequency: isWeapon ? 2380 : isAmmo ? 3180 : 2550,
        q: 1.05,
        level: isWeapon ? 0.075 : 0.06,
        duration: 0.028,
        variation: 4 + Math.floor(Math.random() * 12),
    });
    return true;
}

/** Soft medical-pack handling at the beginning and end of a heal. */
export function playSurvivHealSound(phase = 'start') {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;
    const t = ctx.currentTime;
    const complete = phase === 'complete';
    const bus = ctx.createGain();
    bus.gain.value = complete ? 0.48 : 0.42;
    connectSpatialActionBus(ctx, bus, 0);

    const rustle = ctx.createBufferSource();
    rustle.buffer = getNoiseBuffer(ctx, complete ? 0.13 : 0.18, Math.floor(Math.random() * 16));
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = complete ? 1850 : 1280;
    band.Q.value = 0.46;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(complete ? 0.075 : 0.09, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (complete ? 0.12 : 0.17));
    rustle.connect(band);
    band.connect(gain);
    gain.connect(bus);
    rustle.start(t);
    rustle.stop(t + (complete ? 0.14 : 0.19));
    if (complete) {
        playMechanismClick(ctx, bus, t + 0.035, {
            frequency: 2450,
            level: 0.055,
            duration: 0.03,
            variation: 7 + Math.floor(Math.random() * 9),
        });
    }
    return true;
}

/** A dry air/cloth movement for fists and a sharper air cut for knives. */
export function playSurvivMeleeSwing(weaponType = 'fists', options = {}) {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;
    const isKnife = weaponType === 'knife';
    const attenuation = actionDistanceGain(options.distance, 760);
    if (attenuation < 0.035) return false;
    const t = ctx.currentTime;
    const duration = isKnife ? 0.17 : 0.145;
    const pitch = 0.96 + Math.random() * 0.08;
    const bus = ctx.createGain();
    bus.gain.value = attenuation * (0.91 + Math.random() * 0.12);
    connectSpatialActionBus(ctx, bus, options.pan);

    const air = ctx.createBufferSource();
    air.buffer = getNoiseBuffer(ctx, duration + 0.02, Math.floor(Math.random() * 16));
    air.playbackRate.value = pitch;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(isKnife ? 620 : 230, t);
    highpass.frequency.exponentialRampToValueAtTime(isKnife ? 1250 : 410, t + duration);
    highpass.Q.value = 0.35;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(isKnife ? 7200 : 2850, t);
    lowpass.frequency.exponentialRampToValueAtTime(isKnife ? 4100 : 1750, t + duration);
    lowpass.Q.value = 0.42;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(isKnife ? 0.22 : 0.19, t + duration * 0.36);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    air.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(envelope);
    envelope.connect(bus);
    air.start(t);
    air.stop(t + duration + 0.02);

    // A quiet second pass gives the swing natural clothing/hand movement and
    // prevents consecutive attacks from feeling like a single repeated hiss.
    const cloth = ctx.createBufferSource();
    cloth.buffer = getNoiseBuffer(ctx, 0.075, Math.floor(Math.random() * 16));
    const clothBand = ctx.createBiquadFilter();
    clothBand.type = 'bandpass';
    clothBand.frequency.value = isKnife ? 2500 : 920;
    clothBand.Q.value = 0.58;
    const clothGain = ctx.createGain();
    clothGain.gain.setValueAtTime(0.0001, t + 0.035);
    clothGain.gain.linearRampToValueAtTime(isKnife ? 0.045 : 0.075, t + 0.047);
    clothGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.105);
    cloth.connect(clothBand);
    clothBand.connect(clothGain);
    clothGain.connect(bus);
    cloth.start(t + 0.035);
    cloth.stop(t + 0.115);
    return true;
}

/** Short spatial hinge movement and latch release for an opening door. */
export function playSurvivDoorOpenSound(material = 'wood', options = {}) {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;
    const metal = material === 'metal' || material === 'warehouse' || material === 'ironworks';
    const attenuation = actionDistanceGain(options.distance, 760);
    if (attenuation < 0.035) return false;
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    const closing = options.closing === true;
    bus.gain.value = attenuation * (closing ? 0.78 : 0.88) * (0.96 + Math.random() * 0.1);
    connectSpatialActionBus(ctx, bus, options.pan);

    const doorMaterial = metal ? 'metal' : 'wood';
    const samples = SURVIV_DOOR_FILES[doorMaterial];
    const variant = selectGunshotVariant(`door:${doorMaterial}`, samples.length);
    const recordedDoor = gunshotBuffers.get(`door:${doorMaterial}:${variant}`);
    if (recordedDoor) {
        const source = ctx.createBufferSource();
        source.buffer = recordedDoor;
        source.playbackRate.value = (closing ? 0.89 : 0.975) + Math.random() * 0.05;
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 38;
        highpass.Q.value = 0.32;
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = metal ? 7800 : 6200;
        lowpass.Q.value = 0.38;
        const sampleGain = ctx.createGain();
        sampleGain.gain.value = metal ? 0.76 : 0.82;
        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(sampleGain);
        sampleGain.connect(bus);
        source.start(t);
        if (closing) {
            playMechanismClick(ctx, bus, t + 0.31, {
                frequency: metal ? 1180 : 720,
                q: 0.55,
                level: metal ? 0.12 : 0.15,
                duration: metal ? 0.045 : 0.058,
                variation: 8 + Math.floor(Math.random() * 8),
            });
        }
        return true;
    }

    // Lightweight fallback while the recorded layers are still decoding.
    const hinge = ctx.createBufferSource();
    hinge.buffer = getNoiseBuffer(ctx, 0.19, Math.floor(Math.random() * 16));
    hinge.playbackRate.value = 0.93 + Math.random() * 0.1;
    const hingeBand = ctx.createBiquadFilter();
    hingeBand.type = 'bandpass';
    hingeBand.frequency.setValueAtTime(metal ? 1380 : 820, t);
    hingeBand.frequency.exponentialRampToValueAtTime(metal ? 720 : 430, t + 0.17);
    hingeBand.Q.value = metal ? 1.05 : 0.72;
    const hingeGain = ctx.createGain();
    hingeGain.gain.setValueAtTime(0.0001, t);
    hingeGain.gain.linearRampToValueAtTime(metal ? 0.11 : 0.135, t + 0.018);
    hingeGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.185);
    hinge.connect(hingeBand);
    hingeBand.connect(hingeGain);
    hingeGain.connect(bus);
    hinge.start(t);
    hinge.stop(t + 0.195);

    // The initial latch release gives the interaction a precise, responsive start.
    const latch = ctx.createBufferSource();
    latch.buffer = getNoiseBuffer(ctx, 0.035, 5 + Math.floor(Math.random() * 10));
    const latchBand = ctx.createBiquadFilter();
    latchBand.type = 'bandpass';
    latchBand.frequency.value = metal ? 3300 : 2050;
    latchBand.Q.value = 0.85;
    const latchGain = ctx.createGain();
    latchGain.gain.setValueAtTime(metal ? 0.11 : 0.085, t);
    latchGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.031);
    latch.connect(latchBand);
    latchBand.connect(latchGain);
    latchGain.connect(bus);
    latch.start(t);
    latch.stop(t + 0.038);

    // A quiet low wooden/steel body prevents the door from sounding paper-thin.
    const body = ctx.createBufferSource();
    body.buffer = getNoiseBuffer(ctx, 0.09, 2 + Math.floor(Math.random() * 12));
    const bodyLow = ctx.createBiquadFilter();
    bodyLow.type = 'lowpass';
    bodyLow.frequency.value = metal ? 390 : 275;
    bodyLow.Q.value = 0.38;
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(metal ? 0.075 : 0.09, t + 0.025);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.105);
    body.connect(bodyLow);
    bodyLow.connect(bodyGain);
    bodyGain.connect(bus);
    body.start(t + 0.025);
    body.stop(t + 0.115);
    return true;
}

const IMPACT_SOUND_PROFILES = Object.freeze({
    wood: { body: 245, contact: 1450, highpass: 62, lowpass: 3900, level: 0.17, duration: 0.105, flecks: 2 },
    stone: { body: 175, contact: 3250, highpass: 48, lowpass: 7200, level: 0.15, duration: 0.115, flecks: 3 },
    metal: { body: 310, contact: 4100, highpass: 85, lowpass: 7600, level: 0.135, duration: 0.085, flecks: 2 },
    foliage: { body: 155, contact: 980, highpass: 45, lowpass: 2700, level: 0.16, duration: 0.14, flecks: 3 },
    soft: { body: 120, contact: 650, highpass: 38, lowpass: 1750, level: 0.17, duration: 0.12, flecks: 1 },
});

function normalizeImpactMaterial(material) {
    if (IMPACT_SOUND_PROFILES[material]) return material;
    if (['crate', 'tree', 'stump', 'fallenLog', 'furniture', 'door', 'bench', 'signpost', 'container'].includes(material)) return 'wood';
    if (['rock', 'wall', 'interiorWall', 'concrete', 'stone'].includes(material)) return 'stone';
    if (['barrel', 'machine', 'locker', 'metal'].includes(material)) return 'metal';
    if (['bush', 'plant', 'foliage'].includes(material)) return 'foliage';
    if (['sandbag', 'tent', 'hayBale', 'soft'].includes(material)) return 'soft';
    return 'wood';
}

/** Short material-specific contact played for damage before an object breaks. */
export function playSurvivImpactSound(material = 'wood', options = {}) {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;
    const profile = IMPACT_SOUND_PROFILES[normalizeImpactMaterial(material)];
    const attenuation = actionDistanceGain(options.distance, 920);
    if (attenuation < 0.03) return false;
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = attenuation * (0.92 + Math.random() * 0.12);
    connectSpatialActionBus(ctx, bus, options.pan);

    const contact = ctx.createBufferSource();
    contact.buffer = getNoiseBuffer(ctx, profile.duration + 0.025, Math.floor(Math.random() * 16));
    contact.playbackRate.value = 0.95 + Math.random() * 0.1;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = profile.highpass;
    highpass.Q.value = 0.35;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = profile.lowpass;
    lowpass.Q.value = 0.42;
    const contactGain = ctx.createGain();
    contactGain.gain.setValueAtTime(0.0001, t);
    contactGain.gain.linearRampToValueAtTime(profile.level, t + 0.0012);
    contactGain.gain.exponentialRampToValueAtTime(0.0001, t + profile.duration);
    contact.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(contactGain);
    contactGain.connect(bus);

    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.value = profile.body;
    bodyFilter.Q.value = 0.38;
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(profile.level * 0.72, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + profile.duration * 0.72);
    contact.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(bus);
    contact.start(t);
    contact.stop(t + profile.duration + 0.025);

    for (let index = 0; index < profile.flecks; index++) {
        const offset = 0.008 + index * 0.011 + Math.random() * 0.007;
        const fleck = ctx.createBufferSource();
        fleck.buffer = getNoiseBuffer(ctx, 0.026, index + Math.floor(Math.random() * 12));
        const fleckBand = ctx.createBiquadFilter();
        fleckBand.type = 'bandpass';
        fleckBand.frequency.value = profile.contact * (0.82 + Math.random() * 0.36);
        fleckBand.Q.value = 0.62;
        const fleckGain = ctx.createGain();
        fleckGain.gain.setValueAtTime(profile.level * 0.32, t + offset);
        fleckGain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.021);
        fleck.connect(fleckBand);
        fleckBand.connect(fleckGain);
        fleckGain.connect(bus);
        fleck.start(t + offset);
        fleck.stop(t + offset + 0.026);
    }
    return true;
}

const BREAK_SOUND_PROFILES = Object.freeze({
    wood: { lowpass: 4300, body: 270, crack: 1850, level: 0.3, fragments: 5, duration: 0.25 },
    stone: { lowpass: 6500, body: 210, crack: 3150, level: 0.28, fragments: 7, duration: 0.29 },
    metal: { lowpass: 4700, body: 245, crack: 2350, level: 0.22, fragments: 4, duration: 0.23 },
    foliage: { lowpass: 3600, body: 190, crack: 1250, level: 0.25, fragments: 6, duration: 0.31 },
    soft: { lowpass: 2200, body: 135, crack: 780, level: 0.24, fragments: 3, duration: 0.27 },
});

function normalizeBreakMaterial(material) {
    if (BREAK_SOUND_PROFILES[material]) return material;
    if (['crate', 'tree', 'furniture', 'door', 'container'].includes(material)) return 'wood';
    if (['rock', 'wall', 'concrete', 'stone'].includes(material)) return 'stone';
    if (['barrel', 'machine'].includes(material)) return 'metal';
    if (['bush', 'plant'].includes(material)) return 'foliage';
    if (['sandbag', 'tent', 'hayBale', 'soft'].includes(material)) return 'soft';
    return 'wood';
}

/** Layered debris, impact body and irregular fragments for destroyed props. */
export function playSurvivBreakSound(material = 'wood', options = {}) {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;
    const profile = BREAK_SOUND_PROFILES[normalizeBreakMaterial(material)];
    const attenuation = actionDistanceGain(options.distance, 980);
    if (attenuation < 0.03) return false;
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = attenuation * (0.92 + Math.random() * 0.12);
    connectSpatialActionBus(ctx, bus, options.pan);

    const debris = ctx.createBufferSource();
    debris.buffer = getNoiseBuffer(ctx, profile.duration + 0.025, Math.floor(Math.random() * 16));
    debris.playbackRate.value = 0.96 + Math.random() * 0.08;
    const debrisHigh = ctx.createBiquadFilter();
    debrisHigh.type = 'highpass';
    debrisHigh.frequency.value = 55;
    debrisHigh.Q.value = 0.35;
    const debrisLow = ctx.createBiquadFilter();
    debrisLow.type = 'lowpass';
    debrisLow.frequency.value = profile.lowpass;
    debrisLow.Q.value = 0.45;
    const debrisGain = ctx.createGain();
    debrisGain.gain.setValueAtTime(0.0001, t);
    debrisGain.gain.linearRampToValueAtTime(profile.level, t + 0.002);
    debrisGain.gain.exponentialRampToValueAtTime(0.0001, t + profile.duration);
    debris.connect(debrisHigh);
    debrisHigh.connect(debrisLow);
    debrisLow.connect(debrisGain);
    debrisGain.connect(bus);

    const bodyLow = ctx.createBiquadFilter();
    bodyLow.type = 'lowpass';
    bodyLow.frequency.value = profile.body;
    bodyLow.Q.value = 0.45;
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.16, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.095);
    debris.connect(bodyLow);
    bodyLow.connect(bodyGain);
    bodyGain.connect(bus);
    debris.start(t);
    debris.stop(t + profile.duration + 0.03);

    for (let index = 0; index < profile.fragments; index++) {
        const variation = Math.random();
        const offset = 0.012 + index * 0.018 + variation * 0.019;
        const fragment = ctx.createBufferSource();
        fragment.buffer = getNoiseBuffer(ctx, 0.032, index + Math.floor(Math.random() * 12));
        fragment.playbackRate.value = 0.9 + variation * 0.22;
        const fragmentBand = ctx.createBiquadFilter();
        fragmentBand.type = 'bandpass';
        fragmentBand.frequency.value = profile.crack * (0.72 + variation * 0.62);
        fragmentBand.Q.value = 0.7;
        const fragmentGain = ctx.createGain();
        fragmentGain.gain.setValueAtTime(0.0001, t + offset);
        fragmentGain.gain.linearRampToValueAtTime(0.085 + variation * 0.055, t + offset + 0.0015);
        fragmentGain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.028);
        fragment.connect(fragmentBand);
        fragmentBand.connect(fragmentGain);
        fragmentGain.connect(bus);
        fragment.start(t + offset);
        fragment.stop(t + offset + 0.035);
    }
    return true;
}

const FOOTSTEP_PROFILES = Object.freeze({
    grass: { volume: 0.32, highpass: 55, lowpass: 4700, bodyGain: 0.055, bodyLowpass: 235, duration: 0.29, rate: 0.98 },
    dirt: { volume: 0.34, highpass: 48, lowpass: 2850, bodyGain: 0.072, bodyLowpass: 255, duration: 0.27, rate: 0.95 },
    gravel: { volume: 0.29, highpass: 70, lowpass: 6100, bodyGain: 0.045, bodyLowpass: 285, duration: 0.34, rate: 0.99 },
    asphalt: { volume: 0.30, highpass: 60, lowpass: 5100, bodyGain: 0.065, bodyLowpass: 295, duration: 0.24, rate: 1, presence: 2800, presenceGain: -2 },
    indoor: { volume: 0.27, highpass: 72, lowpass: 6300, bodyGain: 0.052, bodyLowpass: 300, duration: 0.22, rate: 1.01, presence: 3200, presenceGain: -2.5 },
    wood: { volume: 0.31, highpass: 48, lowpass: 4250, bodyGain: 0.08, bodyLowpass: 315, duration: 0.30, rate: 0.98, presence: 1900, presenceGain: -2 },
    water: { volume: 0.33, highpass: 35, lowpass: 4750, bodyGain: 0.05, bodyLowpass: 210, duration: 0.42, rate: 0.97 },
    metal: { volume: 0.22, highpass: 68, lowpass: 4500, bodyGain: 0.045, bodyLowpass: 270, duration: 0.25, rate: 1, presence: 2400, presenceGain: -5 },
});

function footstepVariation(stepIndex, salt = 0) {
    const value = Math.sin((stepIndex + 1) * 12.9898 + (salt + 1) * 78.233) * 43758.5453;
    return value - Math.floor(value);
}

function normalizeFootstepSurface(surface) {
    if (FOOTSTEP_PROFILES[surface]) return surface;
    if (surface === 'road' || surface === 'service' || surface === 'concrete' || surface === 'stone') return 'asphalt';
    if (surface === 'trail' || surface === 'ground') return 'grass';
    return 'grass';
}

function getFootstepMaster(ctx) {
    if (footstepMaster?.ctx === ctx) return footstepMaster.input;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 12;
    compressor.ratio.value = 2;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.09;
    const output = ctx.createGain();
    output.gain.value = 0.42;
    compressor.connect(output);
    output.connect(getSurvivSfxOutput(ctx));
    footstepMaster = { ctx, input: compressor };
    return compressor;
}

function connectFootstepTone(ctx, source, destination, profile, at) {
    const highFilter = ctx.createBiquadFilter();
    highFilter.type = 'highpass';
    highFilter.frequency.setValueAtTime(profile.highpass, at);
    highFilter.Q.value = 0.55;
    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.setValueAtTime(profile.lowpass, at);
    lowFilter.Q.value = 0.6;
    source.connect(highFilter);
    highFilter.connect(lowFilter);
    if (profile.presence) {
        const presence = ctx.createBiquadFilter();
        presence.type = 'peaking';
        presence.frequency.value = profile.presence;
        presence.Q.value = 0.75;
        presence.gain.value = profile.presenceGain;
        lowFilter.connect(presence);
        presence.connect(destination);
    } else {
        lowFilter.connect(destination);
    }
}

/**
 * Dry recorded shoe contacts, selected per material. Each step picks a nearby
 * take and receives tiny pitch, level and stereo changes so a running loop does
 * not repeat mechanically. The parallel low-passed path adds weight using the
 * recording itself rather than an oscillator or synthetic noise layer.
 */
export function playSurvivFootstep(surface = 'ground', stepIndex = 0, intensity = 1) {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return false;

    const material = normalizeFootstepSurface(surface);
    const profile = FOOTSTEP_PROFILES[material];
    const samples = footstepSampleBuffers.get(material);
    if (!samples?.length) {
        void decodeSurvivFootsteps(ctx);
        return false;
    }

    const t = ctx.currentTime;
    const strength = Math.max(0.64, Math.min(1.06, Number(intensity) || 1));
    const selectionVariation = footstepVariation(stepIndex, material.length);
    const sampleIndex = (stepIndex + Math.floor(selectionVariation * samples.length)) % samples.length;
    const pitchCents = (footstepVariation(stepIndex, 1) - 0.5) * 36 + (stepIndex % 2 === 0 ? -5 : 5);
    const playbackRate = profile.rate * Math.pow(2, pitchCents / 1200);
    const levelVariation = 0.94 + footstepVariation(stepIndex, 2) * 0.1;
    const duration = Math.min(profile.duration, samples[sampleIndex].duration / playbackRate);

    const bus = ctx.createGain();
    bus.gain.value = 1;
    const master = getFootstepMaster(ctx);
    if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        const side = stepIndex % 2 === 0 ? -1 : 1;
        panner.pan.value = side * (0.012 + footstepVariation(stepIndex, 3) * 0.01);
        bus.connect(panner);
        panner.connect(master);
    } else {
        bus.connect(master);
    }

    const source = ctx.createBufferSource();
    source.buffer = samples[sampleIndex];
    source.playbackRate.value = playbackRate;
    const mainEnvelope = ctx.createGain();
    const mainLevel = profile.volume * strength * levelVariation;
    mainEnvelope.gain.setValueAtTime(0.0001, t);
    mainEnvelope.gain.linearRampToValueAtTime(mainLevel, t + 0.0015);
    mainEnvelope.gain.setValueAtTime(mainLevel, t + Math.max(0.008, duration - 0.035));
    mainEnvelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    connectFootstepTone(ctx, source, mainEnvelope, profile, t);
    mainEnvelope.connect(bus);

    const bodyHighpass = ctx.createBiquadFilter();
    bodyHighpass.type = 'highpass';
    bodyHighpass.frequency.value = 34;
    const bodyLowpass = ctx.createBiquadFilter();
    bodyLowpass.type = 'lowpass';
    bodyLowpass.frequency.value = profile.bodyLowpass;
    bodyLowpass.Q.value = 0.4;
    const bodyEnvelope = ctx.createGain();
    bodyEnvelope.gain.setValueAtTime(profile.bodyGain * strength, t);
    bodyEnvelope.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(duration, 0.11));
    source.connect(bodyHighpass);
    bodyHighpass.connect(bodyLowpass);
    bodyLowpass.connect(bodyEnvelope);
    bodyEnvelope.connect(bus);

    source.start(t);
    source.stop(t + duration + 0.015);
    return true;
}
