function asFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function selectPrimaryPair(pairs, mint) {
    return [...pairs]
        .filter((pair) => (
            pair?.baseToken?.address === mint
            || pair?.quoteToken?.address === mint
        ))
        .sort((left, right) => (
            (Number(right?.liquidity?.usd) || 0)
            - (Number(left?.liquidity?.usd) || 0)
        ))[0] || null;
}

/**
 * Dormant until the AGAR launch gate is enabled and a mint is configured.
 * The UI consumes only the normalized snapshot returned here.
 */
export const dexScreenerMarketProvider = Object.freeze({
    async getSnapshot({ mint, signal, config }) {
        const template = config.marketData.endpoint;
        if (!template) return null;

        // TODO: Add backend caching/rate-limit protection if launch traffic requires it.
        const url = template.replaceAll('{mint}', encodeURIComponent(mint));
        const response = await fetch(url, {
            signal,
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`DexScreener request failed (${response.status})`);
        }

        const payload = await response.json();
        const pair = selectPrimaryPair(payload?.pairs || [], mint);
        if (!pair) return null;

        return {
            price: asFiniteNumber(pair.priceUsd),
            priceChange24h: asFiniteNumber(pair.priceChange?.h24),
            fdv: asFiniteNumber(pair.fdv),
            marketCap: asFiniteNumber(pair.marketCap),
            liquidity: asFiniteNumber(pair.liquidity?.usd),
            volume24h: asFiniteNumber(pair.volume?.h24),
            holders: null,
            chart: null,
            updatedAt: new Date().toISOString(),
        };
    },
});
