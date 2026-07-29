import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scenario = process.argv[2] || 'reference-coil-trap';
const frameDir = path.resolve(process.argv[3] || '.tmp-slither-render');
const debugPort = 9223;
const fps = 30;
const url = `http://127.0.0.1:4173/studio/slither/render?scenario=${encodeURIComponent(scenario)}`;

await rm(frameDir, { recursive: true, force: true });
await mkdir(frameDir, { recursive: true });
const profileDir = path.join(frameDir, 'chrome-profile');

const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=360,640',
    'about:blank',
], { stdio: 'ignore' });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getDebuggerTarget() {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        try {
            const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(res => res.json());
            const target = targets.find(item => item.type === 'page');
            if (target) return target;
        } catch {
            // Chrome is still starting.
        }
        await delay(100);
    }
    throw new Error('Could not connect to headless Chrome');
}

const target = await getDebuggerTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
});

function command(method, params = {}) {
    const id = nextId++;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
    const result = await command('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
    });
    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || 'Browser evaluation failed');
    }
    return result.result.value;
}

try {
    await command('Page.enable');
    await command('Runtime.enable');
    await command('Emulation.setDeviceMetricsOverride', {
        width: 360,
        height: 640,
        deviceScaleFactor: 1.6,
        mobile: false,
    });
    await command('Page.navigate', { url });

    let renderInfo;
    for (let attempt = 0; attempt < 150; attempt += 1) {
        renderInfo = await evaluate('window.__SLITHER_RENDER__?.ready ? ({ duration: window.__SLITHER_RENDER__.duration, fps: window.__SLITHER_RENDER__.fps }) : null');
        if (renderInfo) break;
        await delay(100);
    }
    if (!renderInfo) throw new Error('Slither render page did not become ready');

    // Wait for the production background texture and cached snake sprites.
    // Frame zero is rendered again by the capture loop after these are ready.
    await delay(750);

    const frameCount = Math.ceil(renderInfo.duration * fps);
    for (let frame = 0; frame < frameCount; frame += 1) {
        await evaluate(`window.__SLITHER_RENDER__.renderFrame(${frame}, ${fps})`);
        const shot = await command('Page.captureScreenshot', {
            format: 'jpeg',
            quality: 95,
            fromSurface: true,
            captureBeyondViewport: false,
        });
        const filename = `frame-${String(frame).padStart(5, '0')}.jpg`;
        await writeFile(path.join(frameDir, filename), Buffer.from(shot.data, 'base64'));
        if (frame % fps === 0) {
            process.stdout.write(`Rendered ${frame / fps}s / ${renderInfo.duration}s\n`);
        }
    }
    process.stdout.write(`Rendered ${frameCount} frames to ${frameDir}\n`);
} finally {
    socket.close();
    chrome.kill();
}
