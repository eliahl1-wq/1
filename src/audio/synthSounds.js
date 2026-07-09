let audioCtx = null;
let unlocked = false;
let noiseBuffer = null;

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

function getNoiseBuffer(ctx, durationSec = 0.03) {
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
    const len = Math.ceil(ctx.sampleRate * durationSec);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
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

/**
 * Synthesizes a realistic gunshot sound dynamically using Web Audio API oscillators and noise.
 * Generates an explosive base thud/pop (sine/triangle/sawtooth) and a high-velocity crack (white noise).
 */
export function playWeaponShootSound(weaponType) {
    const ctx = getCtx();
    if (!ctx || !unlocked || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.connect(ctx.destination);

    // Default configuration values
    let noiseDecay = 0.12;
    let noiseVolume = 0.25;
    let synthDecay = 0.12;
    let synthVolume = 0.45;
    let startHz = 240;
    let endHz = 60;
    let type = 'triangle';

    if (weaponType === 'fists') {
        // Melee swing: soft whoosh/punch
        noiseDecay = 0.05;
        noiseVolume = 0.03;
        synthDecay = 0.08;
        synthVolume = 0.18;
        startHz = 120;
        endHz = 40;
        type = 'sine';
    } else if (weaponType === 'pistol' || weaponType === 'revolver') {
        const isRev = weaponType === 'revolver';
        noiseDecay = isRev ? 0.18 : 0.10;
        noiseVolume = isRev ? 0.35 : 0.20;
        synthDecay = isRev ? 0.16 : 0.10;
        synthVolume = isRev ? 0.55 : 0.35;
        startHz = isRev ? 280 : 320;
        endHz = isRev ? 50 : 70;
        type = 'triangle';
    } else if (weaponType === 'smg') {
        noiseDecay = 0.08;
        noiseVolume = 0.15;
        synthDecay = 0.08;
        synthVolume = 0.28;
        startHz = 380;
        endHz = 85;
        type = 'sawtooth';
    } else if (weaponType === 'shotgun') {
        noiseDecay = 0.26;
        noiseVolume = 0.65;
        synthDecay = 0.22;
        synthVolume = 0.70;
        startHz = 180;
        endHz = 35;
        type = 'triangle';
    } else if (weaponType === 'assault' || weaponType === 'dmr') {
        const isDmr = weaponType === 'dmr';
        noiseDecay = isDmr ? 0.22 : 0.18;
        noiseVolume = isDmr ? 0.48 : 0.40;
        synthDecay = isDmr ? 0.18 : 0.15;
        synthVolume = isDmr ? 0.60 : 0.52;
        startHz = isDmr ? 220 : 250;
        endHz = isDmr ? 45 : 55;
        type = 'sawtooth';
    } else if (weaponType === 'sniper') {
        noiseDecay = 0.42;
        noiseVolume = 0.78;
        synthDecay = 0.32;
        synthVolume = 0.85;
        startHz = 160;
        endHz = 30;
        type = 'sawtooth';
    } else if (weaponType === 'lmg') {
        noiseDecay = 0.16;
        noiseVolume = 0.38;
        synthDecay = 0.14;
        synthVolume = 0.48;
        startHz = 280;
        endHz = 65;
        type = 'sawtooth';
    }

    // --- Noise Channel (gunshot blast crack/crackle) ---
    if (noiseVolume > 0 && noiseDecay > 0) {
        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = getNoiseBuffer(ctx, Math.max(0.5, noiseDecay));
        
        const noiseG = ctx.createGain();
        noiseG.gain.setValueAtTime(noiseVolume, t);
        noiseG.gain.exponentialRampToValueAtTime(0.0001, t + noiseDecay);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(weaponType === 'sniper' ? 2200 : weaponType === 'shotgun' ? 700 : 1200, t);

        noiseNode.connect(filter);
        filter.connect(noiseG);
        noiseG.connect(bus);
        
        noiseNode.start(t);
        noiseNode.stop(t + noiseDecay + 0.05);
    }

    // --- Synth Channel (explosive low-end thud) ---
    if (synthVolume > 0 && synthDecay > 0) {
        const osc = ctx.createOscillator();
        osc.type = type;
        
        const oscG = ctx.createGain();
        oscG.gain.setValueAtTime(synthVolume, t);
        oscG.gain.exponentialRampToValueAtTime(0.0001, t + synthDecay);

        osc.frequency.setValueAtTime(startHz, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(endHz, 20), t + synthDecay * 0.7);

        osc.connect(oscG);
        oscG.connect(bus);
        
        osc.start(t);
        osc.stop(t + synthDecay + 0.05);
    }
}

