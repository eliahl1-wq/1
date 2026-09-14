import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../utils/apiBase';

const ServerReadinessContext = createContext({ ready: false, updating: true, phase: 'checking' });
const POLL_INTERVAL_MS = 2500;
const REQUEST_TIMEOUT_MS = 4500;

export function ServerReadinessProvider({ children }) {
    const [state, setState] = useState({ ready: false, updating: true, phase: 'checking' });

    useEffect(() => {
        let active = true;
        let timer;
        let requestInFlight = false;

        const check = async () => {
            if (requestInFlight) return;
            requestInFlight = true;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            try {
                const response = await fetch(`${API_URL}/ready?t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' },
                    signal: controller.signal,
                });
                let payload = await response.json().catch(() => ({}));
                // Safe rolling bootstrap: the currently-live backend predates
                // /ready until this release coordinator is deployed once.
                if (response.status === 404) {
                    const legacyHealth = await fetch(`${API_URL}/api/health?t=${Date.now()}`, {
                        cache: 'no-store',
                        headers: { 'Cache-Control': 'no-cache' },
                        signal: controller.signal,
                    });
                    payload = { ready: legacyHealth.ok, status: legacyHealth.ok ? 'ready' : 'updating' };
                    if (!active) return;
                    setState({ ready: legacyHealth.ok, updating: !legacyHealth.ok, phase: payload.status });
                    return;
                }
                if (!active) return;
                const ready = response.ok && payload.ready === true;
                setState({
                    ready,
                    updating: !ready,
                    phase: payload.release?.phase || payload.status || (ready ? 'idle' : 'updating'),
                });
            } catch {
                if (active) setState({ ready: false, updating: true, phase: 'unavailable' });
            } finally {
                clearTimeout(timeout);
                requestInFlight = false;
                if (active) timer = setTimeout(check, POLL_INTERVAL_MS);
            }
        };

        check();
        window.addEventListener('online', check);
        return () => {
            active = false;
            clearTimeout(timer);
            window.removeEventListener('online', check);
        };
    }, []);

    const value = useMemo(() => state, [state]);
    return <ServerReadinessContext.Provider value={value}>{children}</ServerReadinessContext.Provider>;
}

export function useServerReadiness() {
    return useContext(ServerReadinessContext);
}

export function ServerUpdateBanner() {
    const { updating, phase } = useServerReadiness();
    if (!updating) return null;
    const releaseInProgress = phase === 'resetting' || phase === 'deploying';
    return (
        <div className="server-update-banner" role="status" aria-live="polite">
            <span className="server-update-banner__spinner" aria-hidden="true" />
            <span>
                <strong>{releaseInProgress ? 'Updating servers…' : 'Starting game server…'}</strong>
                <small>{releaseInProgress ? 'The new version will be ready shortly.' : 'Games will open automatically when startup is complete.'}</small>
            </span>
        </div>
    );
}
