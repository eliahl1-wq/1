import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AGAR, isAgarLaunchReady } from '../config/agarConfig';
import { fetchAgarBalance } from './agarBalance';

export function useAgarBalance(config = AGAR) {
    const { connection } = useConnection();
    const { connected, publicKey } = useWallet();
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const launchReady = isAgarLaunchReady(config);

    const refresh = useCallback(async () => {
        if (!connected || !publicKey || !launchReady) {
            setBalance(0);
            setError('');
            return;
        }

        setLoading(true);
        try {
            const next = await fetchAgarBalance({
                connection,
                owner: publicKey,
                config,
            });
            setBalance(next);
            setError('');
        } catch {
            setError('Balance unavailable');
        } finally {
            setLoading(false);
        }
    }, [config, connected, connection, launchReady, publicKey]);

    useEffect(() => {
        refresh();
        if (!connected || !launchReady) return undefined;

        const poll = window.setInterval(refresh, config.balancePollIntervalMs);
        const onFocus = () => refresh();
        window.addEventListener('focus', onFocus);
        return () => {
            window.clearInterval(poll);
            window.removeEventListener('focus', onFocus);
        };
    }, [config.balancePollIntervalMs, connected, launchReady, refresh]);

    return {
        balance,
        connected,
        loading,
        error,
        refresh,
    };
}
