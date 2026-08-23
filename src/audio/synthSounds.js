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
    input.gain.value = 0.82;
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
    output.gain.value = 0.55;
    compressor.connect(output);
    output.connect(getSurvivSfxOutput(ctx));
    gunshotMaster = { ctx, input: compressor };
    return compressor;
}

/** Begin fetching the compact original firearm library before the first shot. */
export function preloadSurvivGunshots() {
    if (gunshotFetchPromise) return gunshotFetchPromise;
    if (typeof fetch !== 'function') return Promise.resolve(false);

    const entries = Object.entries(SURVIV_GUNSHOT_FILES)
        .flatMap(([weapon, files]) => files.map((file, variant) => ({ weapon, file, variant })));
    gunshotFetchPromise = Promise.all(entries.map(async ({ weapon, file, variant }) => {
        const response = await fetch(`/audio/surviv/gunshots/${weapon}/${file}`, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Unable to load Surviv gunshot ${weapon}/${file}`);
        gunshotSampleData.set(`${weapon}:${variant}`, await response.arrayBuffer());
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
    output.gain.value = 0.72;
    compressor.connect(output);
    output.connect(getSurvivSfxOutput(ctx));
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
    const randomPitch = Math.pow(2, ((Math.random() - 0.5) * 0.9) / 12);
    const streakPitch = Math.pow(2, Math.min(streak, 7) * 0.16 / 12);
    const pitch = randomPitch * streakPitch;
    const levelVariation = 0.92 + Math.random() * 0.12;
    const chainDuck = 1 - Math.min(streak, 8) * 0.022;
    const duration = 0.058;

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.linearRampToValueAtTime(0.031 * levelVariation * chainDuck, t + 0.0012);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    bus.connect(getFoodPickupMaster(ctx));

    // Main tactile pluck: rounded sine with a small upward motion.
    const pop = ctx.createOscillator();
    const popG = ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(330 * pitch, t);
    pop.frequency.exponentialRampToValueAtTime(475 * pitch, t + 0.031);
    popG.gain.setValueAtTime(0.0001, t);
    popG.gain.linearRampToValueAtTime(0.68, t + 0.0015);
    popG.gain.exponentialRampToValueAtTime(0.0001, t + 0.052);
    const popTone = ctx.createBiquadFilter();
    popTone.type = 'lowpass';
    popTone.frequency.value = 1450;
    popTone.Q.value = 0.45;
    pop.connect(popTone);
    popTone.connect(popG);
    popG.connect(bus);
    pop.start(t);
    pop.stop(t + 0.06);

    // Muted low body gives a soft wooden/rubbery sense of contact.
    const body = ctx.createOscillator();
    const bodyG = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(155 * pitch, t);
    body.frequency.exponentialRampToValueAtTime(205 * pitch, t + 0.028);
    bodyG.gain.setValueAtTime(0.0001, t);
    bodyG.gain.linearRampToValueAtTime(0.22, t + 0.0025);
    bodyG.gain.exponentialRampToValueAtTime(0.0001, t + 0.043);
    const bodyTone = ctx.createBiquadFilter();
    bodyTone.type = 'lowpass';
    bodyTone.frequency.value = 760;
    bodyTone.Q.value = 0.35;
    body.connect(bodyTone);
    bodyTone.connect(bodyG);
    bodyG.connect(bus);
    body.start(t);
    body.stop(t + 0.05);

    // Very short filtered contact texture prevents the tone feeling synthetic.
    const contact = ctx.createBufferSource();
    contact.buffer = getNoiseBuffer(ctx, 0.009, streak + Math.floor(Math.random() * 8));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 980 * pitch;
    bp.Q.value = 0.75;
    const contactG = ctx.createGain();
    contactG.gain.setValueAtTime(0.13, t);
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

const BREAK_SOUND_PROFILES = Object.freeze({
    wood: { lowpass: 4300, body: 270, crack: 1850, level: 0.3, fragments: 5, duration: 0.25 },
    stone: { lowpass: 6500, body: 210, crack: 3150, level: 0.28, fragments: 7, duration: 0.29 },
    metal: { lowpass: 4700, body: 245, crack: 2350, level: 0.22, fragments: 4, duration: 0.23 },
    foliage: { lowpass: 3600, body: 190, crack: 1250, level: 0.25, fragments: 6, duration: 0.31 },
});

function normalizeBreakMaterial(material) {
    if (BREAK_SOUND_PROFILES[material]) return material;
    if (['crate', 'tree', 'furniture', 'door', 'container'].includes(material)) return 'wood';
    if (['rock', 'wall', 'concrete', 'stone'].includes(material)) return 'stone';
    if (['barrel', 'machine'].includes(material)) return 'metal';
    if (['bush', 'plant'].includes(material)) return 'foliage';
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
