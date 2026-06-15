let audioCtx = null;
let unlocked = false;

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
 * Soft counter-style chime — subtle casino tick when blobs are eaten in quick succession.
 * Dual sine tones, low volume, gentle downward glide (no harsh arcade sweep).
 */
function playSoftChime({ baseFreq, streak, gain, decay }) {
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const pitchLift = streak * 16;
    const jitter = (Math.random() - 0.5) * 14;
    const freq = baseFreq + pitchLift + jitter;
    const attack = 0.004;
    const duration = decay;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.linearRampToValueAtTime(gain, t + attack);
    master.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    master.connect(ctx.destination);

    const tones = [
        { ratio: 1, level: 1 },
        { ratio: 2, level: 0.22 },
        { ratio: 1.498, level: streak >= 2 ? 0.14 : 0.08 },
    ];

    for (const tone of tones) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';

        const f0 = freq * tone.ratio;
        const f1 = f0 * 0.94;
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 40), t + duration * 0.65);

        g.gain.value = tone.level;
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + duration + 0.03);
    }

    // Very faint high tick on rapid chains — like digits ticking up
    if (streak >= 3) {
        const tick = ctx.createOscillator();
        const tickGain = ctx.createGain();
        tick.type = 'sine';
        const tickFreq = freq * 2.4 + streak * 8;
        tick.frequency.setValueAtTime(tickFreq, t + 0.012);
        tick.frequency.exponentialRampToValueAtTime(Math.max(tickFreq * 0.92, 40), t + 0.05);
        tickGain.gain.setValueAtTime(0.0001, t + 0.012);
        tickGain.gain.linearRampToValueAtTime(gain * 0.35, t + 0.018);
        tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
        tick.connect(tickGain);
        tickGain.connect(master);
        tick.start(t + 0.012);
        tick.stop(t + 0.07);
    }
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
        playSoftChime({
            baseFreq: 680,
            streak: agarStreak,
            gain: 0.032 + Math.min(agarStreak, 6) * 0.002,
            decay: 0.085,
        });
    } else {
        lastSlitherEatAt = now;
        const next = nextStreak(slitherStreak, slitherStreakAt);
        slitherStreak = next.streak;
        slitherStreakAt = next.at;
        playSoftChime({
            baseFreq: 760,
            streak: slitherStreak,
            gain: 0.028 + Math.min(slitherStreak, 6) * 0.002,
            decay: 0.072,
        });
    }
}

/** Soft counter chime — Agar pellet pickup. */
export function playAgarEatSound() {
    playEatSound('agar');
}

/** Soft counter chime — Slither food pickup. */
export function playSlitherEatSound() {
    playEatSound('slither');
}
