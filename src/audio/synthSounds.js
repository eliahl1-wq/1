let audioCtx = null;
let unlocked = false;
let noiseBuffer = null;

const THROTTLE_MS = 38;
const STREAK_WINDOW_MS = 240;
const MAX_STREAK = 12;

let lastAgarEatAt = 0;
let lastSlitherEatAt = 0;
let agarStreak = 0;
let slitherStreak = 0;
let agarStreakAt = 0;
let slitherStreakAt = 0;

let cashoutTickTimer = null;

function getCtx() {
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioCtx = new Ctx();
    }
    return audioCtx;
}

function getNoiseBuffer(ctx, durationSec = 0.04) {
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

function nextStreak(prev, prevAt) {
    const now = performance.now();
    if (now - prevAt <= STREAK_WINDOW_MS) {
        return { streak: Math.min(prev + 1, MAX_STREAK), at: now };
    }
    return { streak: 0, at: now };
}

/** Soft plop — sine bubble with a touch of body, between click and pling. */
function playPloppyEat({ baseFreq, gain, streak, duration }) {
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const lift = Math.min(streak, 8) * 12;
    const freq = baseFreq + lift + (Math.random() - 0.5) * 18;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.linearRampToValueAtTime(gain, t + 0.003);
    master.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    master.connect(ctx.destination);

    const plop = ctx.createOscillator();
    const plopG = ctx.createGain();
    plop.type = 'sine';
    plop.frequency.setValueAtTime(freq * 1.12, t);
    plop.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.78, 40), t + duration * 0.85);
    plopG.gain.value = 1;
    plop.connect(plopG);
    plopG.connect(master);
    plop.start(t);
    plop.stop(t + duration + 0.02);

    const body = ctx.createOscillator();
    const bodyG = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(freq * 0.55, t);
    body.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.42, 40), t + duration);
    bodyG.gain.value = 0.35;
    body.connect(bodyG);
    bodyG.connect(master);
    body.start(t);
    body.stop(t + duration + 0.02);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx, duration);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 0.9;
    bp.Q.value = 0.9;
    const noiseG = ctx.createGain();
    noiseG.gain.value = 0.18;
    noise.connect(bp);
    bp.connect(noiseG);
    noiseG.connect(master);
    noise.start(t);
    noise.stop(t + duration * 0.5);
}

function playEatSound(kind) {
    unlockGameAudio();

    const isAgar = kind === 'agar';
    const now = performance.now();
    const lastAt = isAgar ? lastAgarEatAt : lastSlitherEatAt;
    if (now - lastAt < THROTTLE_MS) return;

    if (isAgar) {
        lastAgarEatAt = now;
        const next = nextStreak(agarStreak, agarStreakAt);
        agarStreak = next.streak;
        agarStreakAt = next.at;
        playPloppyEat({
            baseFreq: 320,
            gain: 0.048 + Math.min(agarStreak, 6) * 0.004,
            streak: agarStreak,
            duration: 0.058,
        });
    } else {
        lastSlitherEatAt = now;
        const next = nextStreak(slitherStreak, slitherStreakAt);
        slitherStreak = next.streak;
        slitherStreakAt = next.at;
        playPloppyEat({
            baseFreq: 360,
            gain: 0.044 + Math.min(slitherStreak, 6) * 0.0035,
            streak: slitherStreak,
            duration: 0.052,
        });
    }
}

/** Odometer-style tick while cashout numbers count up. */
function playCounterTick(progress = 0) {
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const dur = 0.028;
    const freq = 420 + progress * 140 + (Math.random() - 0.5) * 20;
    const gain = 0.038;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.linearRampToValueAtTime(gain, t + 0.001);
    master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    master.connect(ctx.destination);

    const tick = ctx.createOscillator();
    const tickG = ctx.createGain();
    tick.type = 'sine';
    tick.frequency.setValueAtTime(freq, t);
    tick.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.88, 40), t + dur);
    tickG.gain.value = 0.7;
    tick.connect(tickG);
    tickG.connect(master);
    tick.start(t);
    tick.stop(t + dur + 0.01);

    const click = ctx.createBufferSource();
    click.buffer = getNoiseBuffer(ctx, 0.015);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 280 + progress * 60;
    bp.Q.value = 1.2;
    const clickG = ctx.createGain();
    clickG.gain.value = 0.22;
    click.connect(bp);
    bp.connect(clickG);
    clickG.connect(master);
    click.start(t);
    click.stop(t + 0.018);
}

export function stopCashoutCountUpSound() {
    if (cashoutTickTimer != null) {
        clearInterval(cashoutTickTimer);
        cashoutTickTimer = null;
    }
}

/** Tick along with the cashout count-up overlay (default 1200 ms). */
export function startCashoutCountUpSound(amount, durationMs = 1200) {
    unlockGameAudio();
    stopCashoutCountUpSound();

    const tickCount = Math.min(Math.max(Math.round(Number(amount) * 2.5), 10), 28);
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

/** Soft plop — Agar pellet pickup. */
export function playAgarEatSound() {
    playEatSound('agar');
}

/** Soft plop — Slither food pickup. */
export function playSlitherEatSound() {
    playEatSound('slither');
}
