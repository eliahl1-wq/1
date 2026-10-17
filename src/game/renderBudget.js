export const RECORDING_MODE_EVENT = 'game-recording-mode-change';
const KEY = 'game_recording_mode';
let recording = false;
try { if (typeof window !== 'undefined') recording = window.localStorage.getItem(KEY) === 'true'; } catch {}
export const getRecordingMode = () => recording;
export function setRecordingMode(enabled) {
    recording = !!enabled;
    try { window.localStorage.setItem(KEY, String(recording)); } catch {}
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(RECORDING_MODE_EVENT));
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
    if (event.key === KEY) setRecordingMode(event.newValue === 'true');
});

export function budgetedCanvasDpr({ width, height, baseDpr = 1, pixelBudget = 2_800_000, recordingMode = recording }) {
    const area = Math.max(1, (Number(width) || 1) * (Number(height) || 1));
    const budget = recordingMode ? Math.min(pixelBudget, 1_600_000) : pixelBudget;
    return Math.min(baseDpr, Math.sqrt(budget / area));
}

// Only gates paint work. Input, simulation, packets and animation clocks remain independent.
export function createGameFramePacer(isRecording = getRecordingMode) {
    let last = null, mode = null, credit = 0;
    return {
        reset() { last = null; credit = 0; },
        shouldDraw(now) {
            const nextMode = isRecording();
            if (nextMode !== mode) { mode = nextMode; last = null; credit = 0; }
            const interval = 1000 / (mode ? 60 : 144);
            if (last === null || now < last || now - last > 250) { last = now; credit = 0; return true; }
            const elapsed = now - last;
            last = now;
            credit = Math.min(interval * 2, credit + elapsed);
            const tolerance = Math.min(2, interval * .12);
            if (credit < interval - tolerance) return false;
            credit -= interval;
            return true;
        },
    };
}
