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
    
    // Slight compression/distortion for the loud blast
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, t);
    compressor.knee.setValueAtTime(10, t);
    compressor.ratio.setValueAtTime(12, t);
    compressor.attack.setValueAtTime(0, t);
    compressor.release.setValueAtTime(0.25, t);
    
    bus.connect(compressor);
    compressor.connect(ctx.destination);

    let blastLen = 0.2;
    let punchHz = 150;
    let lowHz = 40;
    let filterHz = 1200;
    let isSuppressed = false;

    if (weaponType === 'fists') {
        blastLen = 0.08; punchHz = 120; lowHz = 40; filterHz = 300;
    } else if (weaponType === 'pistol' || weaponType === 'revolver') {
        blastLen = 0.25; punchHz = 350; lowHz = 50; filterHz = 2800;
    } else if (weaponType === 'smg') {
        blastLen = 0.18; punchHz = 400; lowHz = 60; filterHz = 3200;
    } else if (weaponType === 'shotgun') {
        blastLen = 0.45; punchHz = 200; lowHz = 35; filterHz = 1800;
    } else if (weaponType === 'assault' || weaponType === 'dmr') {
        blastLen = 0.35; punchHz = 250; lowHz = 45; filterHz = 2400;
    } else if (weaponType === 'sniper') {
        blastLen = 0.60; punchHz = 180; lowHz = 30; filterHz = 1500;
    } else if (weaponType === 'lmg') {
        blastLen = 0.35; punchHz = 300; lowHz = 50; filterHz = 2600;
    }

    if (weaponType === 'fists') {
        // Just a simple whoosh for fists
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(gain);
        gain.connect(bus);
        osc.start(t);
        osc.stop(t + 0.15);
        return;
    }

    // 1. Mechanical Firing Pin Click
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(4000, t);
    clickOsc.frequency.exponentialRampToValueAtTime(1000, t + 0.02);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.15, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    clickOsc.connect(clickGain);
    clickGain.connect(bus);
    clickOsc.start(t);
    clickOsc.stop(t + 0.03);

    // 2. High-Pressure Transient Punch (the physical impact)
    const punchOsc = ctx.createOscillator();
    punchOsc.type = weaponType === 'shotgun' || weaponType === 'sniper' ? 'sawtooth' : 'triangle';
    punchOsc.frequency.setValueAtTime(punchHz * 3, t);
    punchOsc.frequency.exponentialRampToValueAtTime(lowHz, t + 0.08);
    const punchGain = ctx.createGain();
    punchGain.gain.setValueAtTime(1.2, t);
    punchGain.gain.exponentialRampToValueAtTime(0.01, t + (weaponType === 'shotgun' ? 0.2 : 0.1));
    punchOsc.connect(punchGain);
    punchGain.connect(bus);
    punchOsc.start(t);
    punchOsc.stop(t + 0.25);

    // 3. Expanding Gas Blast (Noise)
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = getNoiseBuffer(ctx, blastLen + 0.2);
    
    // Add distortion to the noise for a harsh crack
    const waveShaper = ctx.createWaveShaper();
    const curve = new Float32Array(400);
    for (let i = 0; i < 400; i++) {
        const x = (i * 2) / 400 - 1;
        curve[i] = (Math.PI + 5) * x / (Math.PI + 5 * Math.abs(x));
    }
    waveShaper.curve = curve;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(filterHz, t);
    noiseFilter.Q.setValueAtTime(0.8, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(filterHz * 0.2, t + blastLen);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(weaponType === 'sniper' ? 1.5 : weaponType === 'shotgun' ? 1.2 : 0.8, t);
    // Sharp crack envelope
    noiseGain.gain.setTargetAtTime(0, t, blastLen / 4);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(waveShaper);
    waveShaper.connect(noiseGain);
    noiseGain.connect(bus);
    
    noiseNode.start(t);
    noiseNode.stop(t + blastLen + 0.1);


}

