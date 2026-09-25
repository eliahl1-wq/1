import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE
    ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/surviv-playtest.html');
    await page.locator('#status').filter({ hasText: 'simulation' }).waitFor();
    const shooting = () => page.evaluate(() => window.__survivPlaytest.renderer.getInputPayload().shooting);
    await page.mouse.move(1100, 600); await page.mouse.down();
    assert.equal(await shooting(), true, JSON.stringify(await page.evaluate(() => {
        const { renderer, me } = window.__survivPlaytest;
        return { hp: me.hp, input: renderer.getInputPayload(), mouse: renderer.mouse, enabled: renderer.inputEnabled,
            hit: document.elementFromPoint(1100, 600)?.tagName };
    })));
    await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'left' });
    assert.equal(await shooting(), false, 'chord release stops automatic fire');
    await page.mouse.up({ button: 'right' });
    await page.mouse.down(); await page.keyboard.down('d');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await shooting(), false);
    assert.equal(await page.evaluate(() => window.__survivPlaytest.renderer.getInputPayload().dx), 0);
    await page.keyboard.up('d'); await page.mouse.up();
    await page.mouse.down(); assert.equal(await shooting(), true, 'fresh press works after blur'); await page.mouse.up();

    // Mount the actual mobile component in a touch browser, with no accounts.
    const mobile = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto('http://127.0.0.1:5174/surviv-playtest.html');
    await mobile.locator('#status').filter({ hasText: 'simulation' }).waitFor();
    await mobile.evaluate(async () => {
        const reactModule = await import('/node_modules/.vite/deps/react.js');
        const React = reactModule.default || reactModule;
        const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { createRoot } = domModule.default || domModule;
        const { default: Controls } = await import('/src/components/SurvivMobileControls.jsx');
        const host = document.createElement('div'); document.body.appendChild(host);
        const style = document.createElement('style');
        style.textContent = '.surviv-mobile-controls{position:fixed;inset:90px 20px;display:flex;gap:100px;z-index:99}.surviv-mobile-stick{width:130px;height:130px;touch-action:none;background:#234}.surviv-mobile-actions{display:none}';
        document.head.appendChild(style);
        window.inputSamples = { move: [], aim: [] };
        createRoot(host).render(React.createElement(Controls, {
            onMove: (...p) => window.inputSamples.move.push(p), onAim: (...p) => window.inputSamples.aim.push(p),
        }));
    });
    const stick = mobile.getByRole('application', { name: 'Move', exact: true });
    await stick.waitFor();
    const bounds = await stick.boundingBox();
    await mobile.mouse.move(bounds.x + bounds.width * .85, bounds.y + bounds.height * .5);
    await mobile.mouse.down();
    assert.ok(await mobile.evaluate(() => Math.hypot(...window.inputSamples.move.at(-1).slice(0, 2)) > .1));
    await mobile.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
    assert.deepEqual(await mobile.evaluate(() => window.inputSamples.move.at(-1)), [0, 0, 0]);
    await mobile.mouse.up();
    await mobile.mouse.down();
    assert.ok(await mobile.evaluate(() => window.inputSamples.move.at(-1)[2] > .1), 'stick can be reacquired after interruption');
    await mobile.mouse.up();
    assert.deepEqual(errors, []);
    console.log('Desktop chord/release/focus and actual mobile joystick interruption checks passed.');
} finally { await browser.close(); }
