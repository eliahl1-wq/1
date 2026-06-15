let audioCtx = null;
let unlocked = false;

const THROTTLE_MS = 40;
let lastAgarEatAt = 0;
let lastSlitherEatAt = 0;

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

function playBlip({ type, freqStart, freqEnd, duration, gain }) {
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 40), t + duration);

    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
}

/** Soft bubbly pop — Agar pellet pickup. */
export function playAgarEatSound() {
    const now = performance.now();
    if (now - lastAgarEatAt < THROTTLE_MS) return;
    lastAgarEatAt = now;
    unlockGameAudio();

    playBlip({
        type: 'sine',
        freqStart: 260 + Math.random() * 50,
        freqEnd: 480 + Math.random() * 80,
        duration: 0.07,
        gain: 0.11,
    });
}

/** Crisp short blip — Slither food pickup. */
export function playSlitherEatSound() {
    const now = performance.now();
    if (now - lastSlitherEatAt < THROTTLE_MS) return;
    lastSlitherEatAt = now;
    unlockGameAudio();

    playBlip({
        type: 'triangle',
        freqStart: 400 + Math.random() * 90,
        freqEnd: 720 + Math.random() * 60,
        duration: 0.045,
        gain: 0.09,
    });
}
