import { normalizeEntryFee, DEFAULT_ENTRY_FEE, tierEconomy } from '../constants/economy.js';

let audioCtx = null;
let unlocked = false;
let noiseBuffer = null;

const THROTTLE_MS = 36;
const GOLDEN_THROTTLE_MS = 180;
const STREAK_WINDOW_MS = 260;
const MAX_STREAK = 14;

let lastFoodEatAt = 0;
let lastGoldenAt = 0;
let foodStreak = 0;
let foodStreakAt = 0;
let cashoutTickTimer = null;

function getCtx() {
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioCtx = new Ctx();
    }
    return audioCtx;
}

function getEntryFeeUsd() {
    return normalizeEntryFee(Number(localStorage.getItem('selected_entry_fee')) || DEFAULT_ENTRY_FEE);
}

export function isGoldenPickupDelta(delta) {
    if (delta <= 0) return false;
    const golden = tierEconomy(getEntryFeeUsd()).goldenBlobValue;
    return delta >= golden * 0.82 && delta <= golden * 1.28;
}

function getNoiseBuffer(ctx, durationSec = 0.06) {
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
    const len = Math.ceil(ctx.sampleRate * durationSec);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
}

/** Call once after a user gesture so browsers allow playback. */
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

function nextFoodStreak() {
    const now = performance.now();
    if (now - foodStreakAt <= STREAK_WINDOW_MS) {
        foodStreak = Math.min(foodStreak + 1, MAX_STREAK);
    } else {
        foodStreak = 0;
    }
    foodStreakAt = now;
    return foodStreak;
}

function shouldThrottleFood() {
    const now = performance.now();
    if (now - lastFoodEatAt < THROTTLE_MS) return true;
    lastFoodEatAt = now;
    return false;
}

function createBus(ctx, gain, duration, attack = 0.002) {
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.linearRampToValueAtTime(gain, t + attack);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    bus.connect(ctx.destination);
    return bus;
}

/** Layered sine partials with slight detune for a fuller tone. */
function addChimePartial(ctx, bus, {
    start = 0, duration, freq, freqEnd, level, detune = 0,
}) {
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 40), t + duration * 0.92);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + duration + 0.03);
}

function addSoftSparkle(ctx, bus, { start, duration, freq, level }) {
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.9, 40), t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.85);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
}

/** Shared food — bright kling with harmonic body, rises on streaks. */
export function playFoodEatSound() {
    if (shouldThrottleFood()) return;
    unlockGameAudio();

    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const streak = nextFoodStreak();
    const duration = 0.068;
    const lift = streak * 24;
    const base = 392 + lift + (Math.random() - 0.5) * 14;
    const gain = 0.042 + Math.min(streak, 8) * 0.0025;
    const bus = createBus(ctx, gain, duration, 0.0015);

    addChimePartial(ctx, bus, { duration, freq: base, freqEnd: base * 0.86, level: 0.5, detune: -4 });
    addChimePartial(ctx, bus, { duration, freq: base, freqEnd: base * 0.88, level: 0.5, detune: 5 });
    addChimePartial(ctx, bus, { start: 0.002, duration: duration * 0.95, freq: base * 2.01, freqEnd: base * 1.82, level: 0.38, detune: 0 });
    addSoftSparkle(ctx, bus, { start: 0.004, duration: duration * 0.55, freq: base * 3.04, level: 0.12 });
}

/** Golden blob — excited di-ding double kling (+ soft third sparkle). */
export function playGoldenFoodSound() {
    const now = performance.now();
    if (now - lastGoldenAt < GOLDEN_THROTTLE_MS) return;
    lastGoldenAt = now;
    lastFoodEatAt = now;
    unlockGameAudio();

    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const jitter = (Math.random() - 0.5) * 10;
    const di = 587 + jitter;
    const ding = 740 + jitter * 0.6;
    const sparkle = 880 + jitter * 0.4;
    const gain = 0.056;

    const bus1 = createBus(ctx, gain * 0.92, 0.12, 0.001);
    addChimePartial(ctx, bus1, { duration: 0.11, freq: di, freqEnd: di * 0.91, level: 0.55, detune: -3 });
    addChimePartial(ctx, bus1, { duration: 0.11, freq: di * 2.0, freqEnd: di * 1.85, level: 0.42, detune: 2 });
    addSoftSparkle(ctx, bus1, { start: 0.003, duration: 0.08, freq: di * 3.02, level: 0.18 });

    const bus2 = createBus(ctx, gain, 0.15, 0.001);
    addChimePartial(ctx, bus2, { start: 0.07, duration: 0.13, freq: ding, freqEnd: ding * 0.93, level: 0.58, detune: -2 });
    addChimePartial(ctx, bus2, { start: 0.07, duration: 0.13, freq: ding * 2.01, freqEnd: ding * 1.88, level: 0.48, detune: 4 });
    addChimePartial(ctx, bus2, { start: 0.075, duration: 0.1, freq: ding * 1.5, freqEnd: ding * 1.42, level: 0.22, detune: 0 });

    const bus3 = createBus(ctx, gain * 0.45, 0.09, 0.001);
    addSoftSparkle(ctx, bus3, { start: 0.115, duration: 0.085, freq: sparkle, level: 0.35 });
    addChimePartial(ctx, bus3, { start: 0.115, duration: 0.085, freq: sparkle * 1.26, freqEnd: sparkle * 1.15, level: 0.2, detune: 6 });
}

/** Darker layered thud on elimination. */
export function playKillSound() {
    unlockGameAudio();
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const duration = 0.16;
    const gain = 0.052;

    const bus = createBus(ctx, gain, duration, 0.003);

    const delay = ctx.createDelay();
    delay.delayTime.value = 0.055;
    const echo = ctx.createGain();
    echo.gain.value = 0.22;
    bus.connect(delay);
    delay.connect(echo);
    echo.connect(ctx.destination);

    addChimePartial(ctx, bus, { duration, freq: 148, freqEnd: 68, level: 0.65, detune: 0 });
    addChimePartial(ctx, bus, { duration: duration * 0.9, freq: 96, freqEnd: 52, level: 0.45, detune: -8 });

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx, duration);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(280, t);
    lp.frequency.exponentialRampToValueAtTime(75, t + duration);
    const noiseG = ctx.createGain();
    noiseG.gain.value = 0.28;
    noise.connect(lp);
    lp.connect(noiseG);
    noiseG.connect(bus);
    noise.start(t);
    noise.stop(t + duration);
}

/** Agar-only: slow absorb flooomp when eating another cell. */
export function playAgarAbsorbSound() {
    unlockGameAudio();
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const duration = 0.24;
    const gain = 0.034;
    const bus = createBus(ctx, gain, duration, 0.02);

    addChimePartial(ctx, bus, { duration, freq: 112, freqEnd: 58, level: 0.7, detune: 0 });
    addChimePartial(ctx, bus, { start: 0.025, duration: duration * 0.85, freq: 168, freqEnd: 88, level: 0.35, detune: -6 });

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx, duration);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.exponentialRampToValueAtTime(120, t + duration);
    bp.Q.value = 0.85;
    const noiseG = ctx.createGain();
    noiseG.gain.setValueAtTime(0.0001, t);
    noiseG.gain.linearRampToValueAtTime(0.32, t + 0.03);
    noiseG.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.88);
    noise.connect(bp);
    bp.connect(noiseG);
    noiseG.connect(bus);
    noise.start(t);
    noise.stop(t + duration);
}

function playCounterTick(progress = 0) {
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const duration = 0.024;
    const base = 548 + progress * 110 + (Math.random() - 0.5) * 18;
    const gain = 0.036;
    const bus = createBus(ctx, gain, duration, 0.001);

    addChimePartial(ctx, bus, { duration, freq: base, freqEnd: base * 0.92, level: 0.62, detune: -3 });
    addChimePartial(ctx, bus, { start: 0.002, duration: duration * 0.9, freq: base * 1.98, freqEnd: base * 1.86, level: 0.34, detune: 4 });

    const click = ctx.createBufferSource();
    click.buffer = getNoiseBuffer(ctx, 0.01);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = base * 1.35;
    bp.Q.value = 1.8;
    const clickG = ctx.createGain();
    clickG.gain.value = 0.1;
    click.connect(bp);
    bp.connect(clickG);
    clickG.connect(bus);
    click.start(ctx.currentTime);
    click.stop(ctx.currentTime + 0.012);
}

export function stopCashoutCountUpSound() {
    if (cashoutTickTimer != null) {
        clearInterval(cashoutTickTimer);
        cashoutTickTimer = null;
    }
}

export function startCashoutCountUpSound(amount, durationMs = 900) {
    unlockGameAudio();
    stopCashoutCountUpSound();

    const tickCount = Math.min(Math.max(Math.round(Number(amount) * 3.5), 14), 40);
    const intervalMs = durationMs / tickCount;
    let tick = 0;

    playCounterTick(0);

    cashoutTickTimer = setInterval(() => {
        tick += 1;
        if (tick >= tickCount) {
            stopCashoutCountUpSound();
            return;
        }
        playCounterTick(tick / tickCount);
    }, intervalMs);
}

/** @deprecated use playFoodEatSound */
export function playAgarEatSound() {
    playFoodEatSound();
}

/** @deprecated use playFoodEatSound */
export function playSlitherEatSound() {
    playFoodEatSound();
}
