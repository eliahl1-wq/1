// UI fixture only. No live Clash Royale, Arenifi accounts or real balances.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.EXTERNAL_UI_ORIGIN || 'http://127.0.0.1:5179';
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const profile = { tag: '#P0Y', name: 'Fixture Player', trophies: 1234, clan: 'Fixture Clan', verifiedAt: new Date().toISOString() };
const stats = { wins: 0, draws: 0, losses: 0, winRate: null };
try {
    for (const kind of ['ordinary', 'denied', 'tester', 'admin']) {
        const page = await browser.newPage({ viewport: kind === 'tester' ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
        const errors = [], externalCalls = [];
        let linked = false, phase = null;
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => localStorage.setItem('token', 'ui-fixture-token'));
        await page.route('**/*', route => {
            const req = route.request(), url = new URL(req.url());
            if (url.pathname === '/ready') return route.fulfill({ json: { ready: true, status: 'ready' } });
            if (url.pathname === '/api/me') return route.fulfill({ json: { id: 'fixture', username: 'Tester', balanceSol: 0, solPrice: 100,
                ...(kind !== 'ordinary' ? { externalGamesAccess: true } : {}), isAdmin: kind === 'admin' } });
            if (url.pathname.startsWith('/api/external-games/')) {
                assert.equal(req.headers().authorization, 'Bearer ui-fixture-token');
                const path = url.pathname.replace('/api/external-games', '');
                externalCalls.push(path);
                if (kind === 'denied') return route.fulfill({ status: 404, json: {} });
                if (path === '/profile') return route.fulfill({ json: profile });
                if (path === '/link') { linked = true; return route.fulfill({ json: profile }); }
                if (path === '/queue') { phase = req.method() === 'POST' ? 'ready' : null; return route.fulfill({ json: {} }); }
                if (path === '/practice') { phase = 'battle'; return route.fulfill({ json: {} }); }
                if (path.endsWith('/ready')) { phase = 'battle'; return route.fulfill({ json: {} }); }
                if (path === '/admin') return route.fulfill({ json: { matches: [], queued: [], links: [], audit: [], paused: false, provider: { status: 'ok' } } });
                return route.fulfill({ json: { self: 'fixture', admin: kind === 'admin', profile: linked || kind === 'admin' ? profile : null, canQueue: true, matchmaking: kind === 'tester',
                    configured: true, tokenVerification: true, history: [], stats, match: phase ? { id: 'fixture-match', state: phase, ready: [],
                        players: [{ id: 'fixture', ...profile }, { id: 'other', ...profile, tag: '#Q2L', name: 'Other Player' }], hostId: 'fixture',
                        deadline: new Date(Date.now() + 45_000).toISOString(), battleUntil: new Date(Date.now() + 45_000).toISOString() } : null } });
            }
            if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
            return url.origin === origin ? route.continue() : route.abort();
        });
        await page.goto(`${origin}/external-games`);
        if (kind === 'ordinary' || kind === 'denied') {
            await page.waitForURL(`${origin}/`);
            await page.locator('nav.topbar').waitFor();
            assert.equal(await page.locator('.external-page').count(), 0);
            if (kind === 'ordinary') {
                assert.equal(await page.getByRole('button', { name: 'External Games', exact: true }).count(), 0);
                assert.deepEqual(externalCalls, []);
            } else assert.ok(externalCalls.length > 0 && externalCalls.every(path => path === '/state'));
        } else if (kind === 'tester') {
            await page.getByRole('button', { name: 'Connect account' }).click();
            await page.getByRole('textbox', { name: 'Player tag' }).fill('#P0Y');
            await page.getByRole('button', { name: 'Look up profile' }).click();
            await page.getByLabel('In-game API token').fill('fixtureonly');
            await page.getByRole('button', { name: 'Verify & connect' }).click();
            await page.getByRole('button', { name: 'Find Free Play match' }).click();
            await page.getByRole('button', { name: 'Accept match' }).click();
            await page.getByRole('heading', { name: 'Battle window', exact: true }).waitFor();
            assert.equal(await page.getByText('Internal operations', { exact: true }).count(), 0);
            assert.ok(await page.locator('.external-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        } else {
            assert.equal(await page.getByRole('button', { name: 'Find Free Play match' }).count(), 0);
            await page.getByLabel('Opponent’s Clash Royale player tag').fill('#Q2L');
            await page.getByRole('button', { name: 'Start private practice' }).click();
            await page.getByRole('heading', { name: 'Battle window', exact: true }).waitFor();
            await page.getByText('Internal operations', { exact: true }).click();
            await page.getByRole('button', { name: 'Load review' }).click();
            await page.getByRole('button', { name: 'Pause matchmaking' }).waitFor();
        }
        assert.deepEqual(errors, []);
        await page.close();
    }
    console.log('External Games: ordinary/stale-access redirects, mobile linking and ready check, admin review passed.');
} finally { await browser.close(); }
