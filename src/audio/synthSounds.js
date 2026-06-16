let audioCtx = null;
let unlocked = false;
let noiseBuffer = null;

const THROTTLE_MS = 36;
const STREAK_WINDOW_MS = 260;
const MAX_STREAK = 14;

let lastFoodEatAt = 0;
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

function getNoiseBuffer(ctx, durationSec = 0.05) {
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

/** Shared food plop — lower base, lighter tone, pitch rises on streaks. */
export function playFoodEatSound() {
    if (shouldThrottleFood()) return;
    unlockGameAudio();

    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const streak = nextFoodStreak();
    const t = ctx.currentTime;
    const lift = streak * 22;
    const freq = 240 + lift + (Math.random() - 0.5) * 16;
    const gain = 0.046 + Math.min(streak, 8) * 0.003;
    const duration = 0.052;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.linearRampToValueAtTime(gain, t + 0.002);
    master.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    master.connect(ctx.destination);

    const plop = ctx.createOscillator();
    const plopG = ctx.createGain();
    plop.type = 'sine';
    plop.frequency.setValueAtTime(freq * 1.08, t);
    plop.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.82, 40), t + duration * 0.8);
    plopG.gain.value = 0.85;
    plop.connect(plopG);
    plopG.connect(master);
    plop.start(t);
    plop.stop(t + duration + 0.02);

    const bright = ctx.createOscillator();
    const brightG = ctx.createGain();
    bright.type = 'sine';
    bright.frequency.setValueAtTime(freq * 1.85 + lift * 0.5, t);
    bright.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.5, 40), t + duration * 0.55);
    brightG.gain.value = 0.28;
    bright.connect(brightG);
    brightG.connect(master);
    bright.start(t);
    bright.stop(t + duration * 0.65);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx, duration);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 1.1 + lift;
    bp.Q.value = 1.1;
    const noiseG = ctx.createGain();
    noiseG.gain.value = 0.1;
    noise.connect(bp);
    bp.connect(noiseG);
    noiseG.connect(master);
    noise.start(t);
    noise.stop(t + duration * 0.45);
}

/** Darker thud when you eliminate someone (Slither / BR). */
export function playKillSound() {
    unlockGameAudio();
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const duration = 0.14;
    const gain = 0.055;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.linearRampToValueAtTime(gain, t + 0.004);
    master.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    master.connect(ctx.destination);

    const low = ctx.createOscillator();
    const lowG = ctx.createGain();
    low.type = 'triangle';
    low.frequency.setValueAtTime(155, t);
    low.frequency.exponentialRampToValueAtTime(72, t + duration);
    lowG.gain.value = 0.9;
    low.connect(lowG);
    lowG.connect(master);
    low.start(t);
    low.stop(t + duration + 0.02);

    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(58, t);
    sub.frequency.exponentialRampToValueAtTime(42, t + duration);
    subG.gain.value = 0.55;
    sub.connect(subG);
    subG.connect(master);
    sub.start(t);
    sub.stop(t + duration + 0.02);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx, duration);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(320, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + duration);
    const noiseG = ctx.createGain();
    noiseG.gain.value = 0.35;
    noise.connect(lp);
    lp.connect(noiseG);
    noiseG.connect(master);
    noise.start(t);
    noise.stop(t + duration);
}

/** Agar-only: slow quiet flooomp when absorbing another cell. */
export function playAgarAbsorbSound() {
    unlockGameAudio();
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const duration = 0.22;
    const gain = 0.03;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.linearRampToValueAtTime(gain, t + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    master.connect(ctx.destination);

    const tube = ctx.createOscillator();
    const tubeG = ctx.createGain();
    tube.type = 'sine';
    tube.frequency.setValueAtTime(118, t);
    tube.frequency.exponentialRampToValueAtTime(62, t + duration * 0.92);
    tubeG.gain.value = 0.75;
    tube.connect(tubeG);
    tubeG.connect(master);
    tube.start(t);
    tube.stop(t + duration + 0.03);

    const resonance = ctx.createOscillator();
    const resG = ctx.createGain();
    resonance.type = 'sine';
    resonance.frequency.setValueAtTime(185, t + 0.02);
    resonance.frequency.exponentialRampToValueAtTime(95, t + duration);
    resG.gain.setValueAtTime(0.0001, t + 0.02);
    resG.gain.linearRampToValueAtTime(0.35, t + 0.06);
    resG.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    resonance.connect(resG);
    resG.connect(master);
    resonance.start(t + 0.02);
    resonance.stop(t + duration + 0.03);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx, duration);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + duration);
    lp.Q.value = 0.7;
    const noiseG = ctx.createGain();
    noiseG.gain.setValueAtTime(0.0001, t);
    noiseG.gain.linearRampToValueAtTime(0.5, t + 0.025);
    noiseG.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.85);
    noise.connect(lp);
    lp.connect(noiseG);
    noiseG.connect(master);
    noise.start(t);
    noise.stop(t + duration);
}

function playCounterTick(progress = 0) {
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const dur = 0.014;
    const freq = 720 + progress * 180 + (Math.random() - 0.5) * 30;
    const gain = 0.042;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.linearRampToValueAtTime(gain, t + 0.0005);
    master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    master.connect(ctx.destination);

    const tick = ctx.createOscillator();
    const tickG = ctx.createGain();
    tick.type = 'triangle';
    tick.frequency.setValueAtTime(freq, t);
    tick.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.92, 40), t + dur);
    tickG.gain.value = 0.85;
    tick.connect(tickG);
    tickG.connect(master);
    tick.start(t);
    tick.stop(t + dur + 0.008);

    const click = ctx.createBufferSource();
    click.buffer = getNoiseBuffer(ctx, 0.012);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const clickG = ctx.createGain();
    clickG.gain.value = 0.35;
    click.connect(hp);
    hp.connect(clickG);
    clickG.connect(master);
    click.start(t);
    click.stop(t + 0.014);
}

export function stopCashoutCountUpSound() {
    if (cashoutTickTimer != null) {
        clearInterval(cashoutTickTimer);
        cashoutTickTimer = null;
    }
}

/** Brighter, faster counter ticks for cashout overlay. */
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
