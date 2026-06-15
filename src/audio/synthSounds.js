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

/**
 * Barely-there UI click — filtered noise + low thump, no bright pling.
 * Rapid eats nudge filter/volume slightly, like a soft counter ticking.
 */
function playSoftClick({ centerFreq, q, gain, streak, duration }) {
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const dur = duration;
    const lift = Math.min(streak, 8) * 10;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.linearRampToValueAtTime(gain, t + 0.001);
    master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    master.connect(ctx.destination);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx, dur + 0.01);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = centerFreq + lift;
    bp.Q.value = q;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;

    noise.connect(bp);
    bp.connect(hp);
    hp.connect(master);
    noise.start(t);
    noise.stop(t + dur + 0.005);

    const thump = ctx.createOscillator();
    const thumpG = ctx.createGain();
    thump.type = 'sine';
    const thumpFreq = 88 + lift * 0.4;
    thump.frequency.setValueAtTime(thumpFreq, t);
    thump.frequency.exponentialRampToValueAtTime(Math.max(thumpFreq * 0.82, 40), t + dur);
    thumpG.gain.setValueAtTime(0.0001, t);
    thumpG.gain.linearRampToValueAtTime(gain * 0.55, t + 0.0015);
    thumpG.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.1);
    thump.connect(thumpG);
    thumpG.connect(master);
    thump.start(t);
    thump.stop(t + dur + 0.01);
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
        playSoftClick({
            centerFreq: 210,
            q: 1.4,
            gain: 0.014 + Math.min(agarStreak, 6) * 0.0012,
            streak: agarStreak,
            duration: 0.018,
        });
    } else {
        lastSlitherEatAt = now;
        const next = nextStreak(slitherStreak, slitherStreakAt);
        slitherStreak = next.streak;
        slitherStreakAt = next.at;
        playSoftClick({
            centerFreq: 245,
            q: 1.6,
            gain: 0.013 + Math.min(slitherStreak, 6) * 0.001,
            streak: slitherStreak,
            duration: 0.016,
        });
    }
}

/** Subtle click — Agar pellet pickup. */
export function playAgarEatSound() {
    playEatSound('agar');
}

/** Subtle click — Slither food pickup. */
export function playSlitherEatSound() {
    playEatSound('slither');
}
