import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { AGAR, isAgarLaunchReady } from '../config/agarConfig';
import { fetchAgarBalance } from './agarBalance';

export function useAgarBalance(config = AGAR, accountAddress = '') {
    const { connection } = useConnection();
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const launchReady = isAgarLaunchReady(config);
    const accountPublicKey = useMemo(() => {
        if (!accountAddress) return null;
        try {
            return new PublicKey(accountAddress);
        } catch {
            return null;
        }
    }, [accountAddress]);

    const refresh = useCallback(async () => {
        if (!accountPublicKey || !launchReady) {
            setBalance(0);
            setError('');
            return;
        }

        setLoading(true);
        try {
            const next = await fetchAgarBalance({
                connection,
                owner: accountPublicKey,
                config,
            });
            setBalance(next);
            setError('');
        } catch {
            setError('Balance unavailable');
        } finally {
            setLoading(false);
        }
    }, [accountPublicKey, config, connection, launchReady]);

    useEffect(() => {
        refresh();
        if (!accountPublicKey || !launchReady) return undefined;

        const poll = window.setInterval(refresh, config.balancePollIntervalMs);
        const onFocus = () => refresh();
        window.addEventListener('focus', onFocus);
        return () => {
            window.clearInterval(poll);
            window.removeEventListener('focus', onFocus);
        };
    }, [accountPublicKey, config.balancePollIntervalMs, launchReady, refresh]);

    return {
        balance,
        accountReady: Boolean(accountPublicKey),
        loading,
        error,
        refresh,
    };
}
