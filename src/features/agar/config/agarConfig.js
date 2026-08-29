import { PublicKey } from '@solana/web3.js';

const env = import.meta.env;

function readBoolean(value, fallback = false) {
    if (value == null || value === '') return fallback;
    return String(value).trim().toLowerCase() === 'true';
}

function readPositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Single source of truth for every AGAR feature.
 *
 * Launch checklist:
 * 1. Create the token outside this application.
 * 2. Set VITE_AGAR_MINT.
 * 3. Set VITE_AGAR_ENABLED=true.
 *
 * TODO: Add a holders provider and historical chart adapter before launch.
 * TODO: Upgrade the Jupiter handoff to embedded quote/signing when approved.
 */
export const AGAR = Object.freeze({
    enabled: readBoolean(env.VITE_AGAR_ENABLED, false),
    mint: env.VITE_AGAR_MINT?.trim() || '',
    decimals: readPositiveInteger(env.VITE_AGAR_DECIMALS, 6),
    name: env.VITE_AGAR_NAME?.trim() || 'AreniFi Coin',
    symbol: env.VITE_AGAR_SYMBOL?.trim() || 'ARENA',
    logoUrl: env.VITE_AGAR_LOGO_URL?.trim() || '/arenifi-coin-logo.png',
    balancePollIntervalMs: readPositiveInteger(env.VITE_AGAR_BALANCE_POLL_MS, 60_000),
    marketData: Object.freeze({
        provider: env.VITE_AGAR_MARKET_PROVIDER?.trim() || 'dexscreener',
        endpoint: env.VITE_AGAR_MARKET_ENDPOINT?.trim()
            || 'https://api.dexscreener.com/latest/dex/tokens/{mint}',
        chartUrl: env.VITE_AGAR_CHART_URL?.trim()
            || 'https://dexscreener.com/solana/{mint}?embed=1&theme=dark&trades=0&info=0',
        pollIntervalMs: readPositiveInteger(env.VITE_AGAR_MARKET_POLL_MS, 30_000),
    }),
    swap: Object.freeze({
        provider: env.VITE_AGAR_SWAP_PROVIDER?.trim() || 'account-jupiter',
        endpoint: env.VITE_AGAR_SWAP_ENDPOINT?.trim() || '/api/agar/swap',
    }),
    links: Object.freeze({
        axiom: env.VITE_AGAR_AXIOM_URL?.trim() || 'https://axiom.trade/t/{mint}?chain=sol',
        dexScreener: env.VITE_AGAR_DEXSCREENER_URL?.trim() || 'https://dexscreener.com/solana/{mint}',
        birdeye: env.VITE_AGAR_BIRDEYE_URL?.trim() || 'https://birdeye.so/token/{mint}?chain=solana',
    }),
    messages: Object.freeze({
        comingSoon: 'Coming Soon',
        notLaunched: 'AreniFi Coin has not launched yet.',
    }),
});

export function hasAgarMint(config = AGAR) {
    if (typeof config.mint !== 'string' || config.mint.trim().length === 0) return false;
    try {
        new PublicKey(config.mint);
        return true;
    } catch {
        return false;
    }
}

export function isAgarLaunchReady(config = AGAR) {
    return config.enabled === true && hasAgarMint(config);
}

export function buildAgarExternalUrl(template, config = AGAR) {
    if (!isAgarLaunchReady(config) || !template) return '';
    return template.replaceAll('{mint}', encodeURIComponent(config.mint));
}
