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
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioCtx = new Ctx();
    }
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
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!unlocked) {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        unlocked = true;
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
    unlockGameAudio();

    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

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
