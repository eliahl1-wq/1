// Local-only real Surviv renderer + MediaRecorder. No payments or external services.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
try {
    const page = await browser.newPage({ viewport: { width: 3840, height: 2160 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        return ['localhost', '127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort();
    });
    await page.goto(`${process.env.GAME_PLAYTEST_ORIGIN || 'http://127.0.0.1:5175'}/surviv-playtest.html`);
    await page.locator('#status').filter({ hasText: 'simulation' }).waitFor();
    const results = await page.evaluate(async () => {
        // Model another tab changing the persisted setting. This also reaches
        // every HMR module instance in the development renderer harness.
        const setRecordingMode = enabled => {
            const value = String(enabled);
            localStorage.setItem('game_recording_mode', value);
            window.dispatchEvent(new StorageEvent('storage', { key: 'game_recording_mode', newValue: value }));
        };
        const game = window.__survivPlaytest;
        game.reset('casino');
        const r = game.renderer;
        const results = [];
        for (const recording of [false, true, false]) {
            setRecordingMode(recording);
            await new Promise(resolve => setTimeout(resolve, 600));
            const width = r.canvas.width, height = r.canvas.height;
            const original = r.draw;
            const times = [];
            r.draw = function (...args) {
                const at = performance.now(); const result = original.apply(this, args);
                times.push(performance.now() - at); return result;
            };
            const stream = r.canvas.captureStream(0);
            const track = stream.getVideoTracks()[0];
            const requests = setInterval(() => track.requestFrame(), 1000 / 30);
            const recorder = new MediaRecorder(stream, { videoBitsPerSecond: 3_000_000 });
            let chunks = 0;
            recorder.ondataavailable = event => { if (event.data.size) chunks++; };
            recorder.start(100);
            await new Promise(resolve => setTimeout(resolve, 1800));
            await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
            stream.getTracks().forEach(track => track.stop());
            clearInterval(requests);
            r.draw = original;
            times.sort((a, b) => a - b);
            results.push({ recording, width, height, chunks, frames: times.length,
                medianDrawMs: times[Math.floor(times.length / 2)],
                p95DrawMs: times[Math.floor(times.length * .95)],
                stableSize: width === r.canvas.width && height === r.canvas.height });
        }
        return results;
    });
    assert.deepEqual(errors, []);
    assert.ok(results.every(result => result.chunks > 0 && result.frames >= 15 && result.stableSize), JSON.stringify(results));
    assert.ok(results[1].width * results[1].height <= 1_610_000);
    assert.ok(results[1].width * results[1].height < results[0].width * results[0].height);
    assert.deepEqual([results[0].width, results[0].height], [results[2].width, results[2].height]);
    console.log(JSON.stringify({ passed: true, results, errors }));
} finally { await browser.close(); }
