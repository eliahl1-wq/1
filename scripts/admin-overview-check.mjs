// UI-only fixtures. No production accounts, database, wallets or payments.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GAME_PLAYTEST_ORIGIN || 'http://127.0.0.1:5177';
const output = '.local/admin-overview';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const errors = [];
let legacy = false;
function overview(days) {
    const daily = Array.from({ length: days }, (_, i) => ({ date: new Date(Date.UTC(2026, 10, 12 - days + 1 + i)).toISOString().slice(0, 10),
        visitors: i < 3 ? null : 25 + i * 3, registrations: 4 + i % 5, depositors: i % 4 + 1,
        paidGames: 10 + i * 2, freeGames: i % 7, depositsUsd: 12 + i, paidVolumeUsd: 50 + i * 5, cashoutUsd: 30 + i * 3, feesUsd: 3 + i / 2, ownerSweepUsd: 4 + i }));
    return { totalAccounts: 1200, totalDepositsUsd: 8410, depositCount: 650, ownerEarningsUsd: 874, ownerSweepCount: 24,
        ownerAccountCount: 4, ownerAccountBalanceUsd: 12, skinBuyerCount: 18,
        analytics: { schemaVersion: legacy ? 3 : 4, days, daily,
            totals: { newUsers: 84, uniquePlayers: 67, uniquePaidPlayers: 28, activeUsers: 112, games: 340,
                paidGames: 280, freeGames: 60, paidVolumeUsd: 1540, depositsUsd: 620, deposits: 62, ownerSweepUsd: 123,
                newUsersWhoPlayed: 38, newUsersWhoPaid: 16, accountWithdrawalsUsd: 132, accountWithdrawals: 8 },
            previous: { newUsers: 64, games: 280, depositsUsd: 410, paidVolumeUsd: 1200, ownerSweepUsd: 92 },
            changes: { newUsers: 31.3, games: 21.4, depositsUsd: 51.2 },
            averages: { gamesPerDay: 11.3, registrationsPerDay: 2.8, uniquePlayersPerDay: 12, paidEntryUsd: 5.5, gamesPerPlayer: 5.1 },
            rates: { newUserPlayPct: 45.2, newUserPaidPct: 19 },
            ...(legacy ? {} : { growth: { visitors: 743, visitorTrackingSince: '2026-11-05T14:00:00Z', visitorPeriodComplete: false,
                depositors: 42, previousDepositors: 32, firstDepositors: 21, previousFirstDepositors: 15, repeatDepositors: 21,
                newUsersWhoDeposited: 17, signupDepositPct: 20.2, returningPlayers: 24, returningPlayerPct: 35.8,
                signupBrowsers: 68, unattributedSignups: 8, averageDepositUsd: 10, netDepositsUsd: 488,
                devices: [{ _id: 'mobile', count: 430 }, { _id: 'desktop', count: 313 }] } }), modes: [],
        } };
}
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { localStorage.setItem('token', 'local-fixture-not-a-real-token'); });
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/ready') return route.fulfill({ json: { ready: true, status: 'ready' } });
        if (url.pathname.startsWith('/api/')) {
            let data = {};
            if (url.pathname === '/api/me') data = { id: 'fixture', username: 'eli', isAdmin: true, balanceSol: .1, balanceUsd: 10, solPrice: 100 };
            if (url.pathname.endsWith('/overview')) data = overview(Number(url.searchParams.get('days')) || 30);
            if (url.pathname.endsWith('/active-users')) data = { sitePresence: [{ username: 'Guest' }], currentlyInGame: 3 };
            return route.fulfill({ json: data });
        }
        return url.origin === origin ? route.continue() : route.abort();
    });
    await page.goto(`${origin}/admin`);
    await page.getByText('Unique visitors · 30D', { exact: true }).waitFor();
    assert.equal(await page.locator('.admin-overview-kpi').count(), 8);
    await page.locator('.admin-overview-kpi').first().click();
    await page.getByRole('img', { name: 'People trend chart' }).waitFor();
    assert.ok(await page.locator('.admin-overview-chart-summary').innerText().then(text => text.includes('Visitors / day')));
    await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
    for (const days of [1, 7, 90, 30]) {
        await page.getByRole('button', { name: `${days}D`, exact: true }).click();
        await page.getByText(`Unique visitors ${days === 1 ? 'today' : `· ${days}D`}`, { exact: true }).waitFor();
        await page.waitForTimeout(150);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
    const overflow = await page.locator('.admin-overview-dashboard').evaluate(el => el.scrollWidth - el.clientWidth);
    assert.ok(overflow <= 1, `dashboard overflows by ${overflow}px`);
    legacy = true;
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.getByText('Starts collecting after the backend update', { exact: true }).waitFor();
    assert.ok((await page.locator('.admin-overview-kpi').first().innerText()).includes('—'));
    await page.getByText('How these numbers are counted', { exact: true }).click();
    await page.getByText('The new analytics require the backend update.', { exact: false }).waitFor();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, cards: 8, periods: [1, 7, 30, 90], mobileOverflow: overflow,
        legacyBackend: 'missing values are unknown', screenshots: output, errors }));
} finally { await browser.close(); }
