import { useCallback, useEffect, useState } from 'react';
import { AGAR, isAgarLaunchReady } from '../config/agarConfig';
import { API_URL } from '../../../utils/apiBase';

export function useAgarBalance(config = AGAR, accountAddress = '', authToken = '') {
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const launchReady = isAgarLaunchReady(config);
    const accountReady = Boolean(accountAddress && authToken);

    const refresh = useCallback(async () => {
        if (!accountReady || !launchReady) {
            setBalance(0);
            setError('');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/agar/balance`, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || 'Balance unavailable');
            }
            const next = Number(payload.balance);
            setBalance(Number.isFinite(next) ? next : 0);
            setError('');
        } catch {
            setError('Balance unavailable');
        } finally {
            setLoading(false);
        }
    }, [accountReady, authToken, launchReady]);

    useEffect(() => {
        refresh();
        if (!accountReady || !launchReady) return undefined;

        const poll = window.setInterval(refresh, config.balancePollIntervalMs);
        const onFocus = () => refresh();
        window.addEventListener('focus', onFocus);
        return () => {
            window.clearInterval(poll);
            window.removeEventListener('focus', onFocus);
        };
    }, [accountReady, config.balancePollIntervalMs, launchReady, refresh]);

    return {
        balance,
        accountReady,
        loading,
        error,
        refresh,
    };
}
