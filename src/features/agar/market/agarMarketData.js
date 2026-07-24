import { AGAR, isAgarLaunchReady } from '../config/agarConfig';
import { dexScreenerMarketProvider } from './providers/dexScreenerMarketProvider';

/**
 * @typedef {Object} AgarMarketSnapshot
 * @property {number|null} price
 * @property {number|null} priceChange24h
 * @property {number|null} fdv
 * @property {number|null} marketCap
 * @property {number|null} liquidity
 * @property {number|null} volume24h
 * @property {number|null} holders
 * @property {unknown|null} chart
 * @property {string|null} updatedAt
 */

export const EMPTY_AGAR_MARKET_SNAPSHOT = Object.freeze({
    price: null,
    priceChange24h: null,
    fdv: null,
    marketCap: null,
    liquidity: null,
    volume24h: null,
    holders: null,
    chart: null,
    updatedAt: null,
});

const providers = new Map([
    ['dexscreener', dexScreenerMarketProvider],
]);

/**
 * Market providers implement:
 *   getSnapshot({ mint, signal }): Promise<AgarMarketSnapshot>
 *
 * DexScreener, Birdeye, or another provider can be registered without changing
 * any AGAR component.
 */
export function registerAgarMarketDataProvider(name, provider) {
    if (!name || typeof provider?.getSnapshot !== 'function') {
        throw new TypeError('An AGAR market provider must expose getSnapshot().');
    }
    providers.set(name, provider);
}

export async function getAgarMarketSnapshot({ signal, config = AGAR } = {}) {
    if (!isAgarLaunchReady(config)) return EMPTY_AGAR_MARKET_SNAPSHOT;

    const provider = providers.get(config.marketData.provider);
    if (!provider) {
        // TODO: Register any custom market adapter selected in configuration.
        return EMPTY_AGAR_MARKET_SNAPSHOT;
    }

    const snapshot = await provider.getSnapshot({
        mint: config.mint,
        signal,
        config,
    });
    return {
        ...EMPTY_AGAR_MARKET_SNAPSHOT,
        ...(snapshot || {}),
    };
}
