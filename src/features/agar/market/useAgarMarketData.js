import { useEffect, useState } from 'react';
import { AGAR, isAgarLaunchReady } from '../config/agarConfig';
import {
    EMPTY_AGAR_MARKET_SNAPSHOT,
    getAgarMarketSnapshot,
} from './agarMarketData';

export function useAgarMarketData(config = AGAR) {
    const [snapshot, setSnapshot] = useState(EMPTY_AGAR_MARKET_SNAPSHOT);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const launchReady = isAgarLaunchReady(config);

    useEffect(() => {
        if (!launchReady) {
            setSnapshot(EMPTY_AGAR_MARKET_SNAPSHOT);
            setLoading(false);
            setError('');
            return undefined;
        }

        let active = true;
        let controller;

        const load = async () => {
            controller?.abort();
            controller = new AbortController();
            setLoading(true);
            try {
                const next = await getAgarMarketSnapshot({
                    signal: controller.signal,
                    config,
                });
                if (active) {
                    setSnapshot(next);
                    setError('');
                }
            } catch (requestError) {
                if (active && requestError?.name !== 'AbortError') {
                    setError('Market data unavailable');
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        load();
        const poll = window.setInterval(load, config.marketData.pollIntervalMs);
        return () => {
            active = false;
            controller?.abort();
            window.clearInterval(poll);
        };
    }, [config, launchReady]);

    return { snapshot, loading, error, launchReady };
}
