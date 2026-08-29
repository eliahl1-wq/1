import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { syncMixpanelUser, resetMixpanel } from '../utils/mixpanel';
import { flagDiscoveryForSession } from '../constants/gamemodes';
import { API_URL } from '../utils/apiBase';

const AuthContext = createContext();
const BALANCE_GUARD_KEY = 'arenifi_pending_balance';

function formatUser(userData) {
    if (!userData) return null;
    const balanceSol = Number(userData.balanceSol ?? userData.balance ?? 0) || 0;
    const solPrice = Number(userData.solPrice ?? 0) || 0;
    const balanceUsd = Number(userData.balanceUsd ?? (balanceSol * solPrice)) || 0;
    return {
        ...userData,
        balance: balanceSol,
        balanceSol,
        balanceUsd,
        solPrice,
        freePlay: userData.freePlay,
        isAdmin: userData.isAdmin,
    };
}

function readBalanceGuard() {
    try {
        const guard = JSON.parse(sessionStorage.getItem(BALANCE_GUARD_KEY) || 'null');
        if (guard && Number(guard.expiresAt) > Date.now()) return guard;
    } catch { /* ignore invalid pending state */ }
    sessionStorage.removeItem(BALANCE_GUARD_KEY);
    return null;
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const userRef = useRef(null);
    const balanceGuardRef = useRef(readBalanceGuard());
    const refreshSequenceRef = useRef(0);

    const commitUser = useCallback((nextOrUpdater) => {
        setUser(current => {
            const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(current) : nextOrUpdater;
            userRef.current = next;
            return next;
        });
    }, []);

    const clearOptimisticBalance = useCallback(() => {
        balanceGuardRef.current = null;
        sessionStorage.removeItem(BALANCE_GUARD_KEY);
    }, []);

    const mergeServerUser = useCallback((userData, forceBalance = false) => {
        const serverUser = formatUser(userData);
        let displayedUser = serverUser;

        commitUser(current => {
            const guard = balanceGuardRef.current;
            const guardExpired = !guard || Number(guard.expiresAt) <= Date.now();
            const serverSol = Number(serverUser.balanceSol) || 0;
            const serverUsd = Number(serverUser.balanceUsd) || 0;
            const reachedTarget = guard?.direction === 'increase'
                ? serverSol >= Number(guard.targetSol) - 0.00000001
                : guard?.direction === 'decrease'
                    ? (serverSol <= Number(guard.targetSol) + 0.00000001
                        || serverUsd <= Number(guard.targetUsd) + 0.01)
                    : true;

            if (forceBalance || guardExpired || reachedTarget) {
                clearOptimisticBalance();
                displayedUser = serverUser;
                return serverUser;
            }

            // Keep the immediate visual balance while still accepting all other
            // fresh account fields from /api/me.
            displayedUser = {
                ...serverUser,
                balance: current?.balanceSol ?? guard.targetSol,
                balanceSol: current?.balanceSol ?? guard.targetSol,
                balanceUsd: current?.balanceUsd ?? guard.targetUsd,
                solPrice: serverUser.solPrice || current?.solPrice || 0,
            };
            return displayedUser;
        });

        return displayedUser;
    }, [clearOptimisticBalance, commitUser]);

    const applyOptimisticBalanceDelta = useCallback(({ usd = 0, sol = null, holdMs = 45000 } = {}) => {
        const usdDelta = Number(usd) || 0;
        commitUser(current => {
            if (!current) return current;
            const price = Number(current.solPrice) || 0;
            const currentSol = Number(current.balanceSol ?? current.balance ?? 0) || 0;
            const currentUsd = Number(current.balanceUsd ?? (currentSol * price)) || 0;
            const solDelta = sol == null
                ? (price > 0 ? usdDelta / price : 0)
                : (Number(sol) || 0);
            const targetSol = Math.max(0, currentSol + solDelta);
            const targetUsd = Math.max(0, currentUsd + usdDelta);
            const guard = {
                direction: usdDelta >= 0 && solDelta >= 0 ? 'increase' : 'decrease',
                targetSol,
                targetUsd,
                expiresAt: Date.now() + Math.max(5000, Number(holdMs) || 45000),
            };
            balanceGuardRef.current = guard;
            sessionStorage.setItem(BALANCE_GUARD_KEY, JSON.stringify(guard));
            return {
                ...current,
                balance: targetSol,
                balanceSol: targetSol,
                balanceUsd: targetUsd,
            };
        });
    }, [commitUser]);

    const refreshUser = useCallback(async (options = {}) => {
        if (!token) return undefined;
        const forceBalance = options?.forceBalance === true;
        const requestId = ++refreshSequenceRef.current;
        const url = API_URL + '/api/me?t=' + Date.now();

        if (!API_URL && !window.location.hostname.includes('localhost')) {
            console.error('AuthContext: VITE_API_URL is not defined.');
        }

        try {
            const res = await fetch(url, {
                cache: 'no-store',
                headers: {
                    Authorization: 'Bearer ' + token,
                    'bypass-tunnel-reminders': 'true',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Pragma: 'no-cache',
                },
            });
            const contentType = res.headers.get('content-type');
            if (!res.ok || !contentType?.includes('application/json')) return undefined;
            const userData = await res.json();

            // A slower, older request must never overwrite a newer balance.
            if (requestId !== refreshSequenceRef.current) return undefined;
            const formattedUser = mergeServerUser(userData, forceBalance);
            console.log('[AuthContext] Balance synced:', formattedUser?.balanceSol, 'SOL');
            return formattedUser;
        } catch (err) {
            console.error('AuthContext: Could not refresh user data:', err);
            return undefined;
        }
    }, [token, mergeServerUser]);

    useEffect(() => {
        const checkLoggedIn = async () => {
            const params = new URLSearchParams(window.location.search);
            const urlToken = params.get('token');
            if (urlToken) {
                localStorage.setItem('token', urlToken);
                setToken(urlToken);
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            const storedToken = urlToken || localStorage.getItem('token');
            if (storedToken) {
                try {
                    const res = await fetch(API_URL + '/api/me?t=' + Date.now(), {
                        cache: 'no-store',
                        headers: {
                            Authorization: 'Bearer ' + storedToken,
                            'bypass-tunnel-reminders': 'true',
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            Pragma: 'no-cache',
                        },
                    });
                    const contentType = res.headers.get('content-type');
                    if (res.ok && contentType?.includes('application/json')) {
                        const userData = await res.json();
                        const formattedUser = mergeServerUser(userData);
                        syncMixpanelUser(formattedUser);
                    } else if (res.status === 401 || res.status === 403) {
                        localStorage.removeItem('token');
                        setToken(null);
                        clearOptimisticBalance();
                    }
                } catch (err) {
                    console.error('AuthContext: Token validation failed:', err);
                }
            }
            setLoading(false);
        };
        checkLoggedIn();
    }, [clearOptimisticBalance, mergeServerUser]);

    // Poll often enough to pick up manual/external deposits, and sync
    // immediately when the tab becomes active or the connection returns.
    useEffect(() => {
        if (!token) return undefined;
        const poll = () => {
            if (document.hidden || window.location.pathname === '/surviv-game') return;
            refreshUser();
        };
        const interval = setInterval(poll, 15000);
        const onVisibility = () => { if (!document.hidden) poll(); };
        window.addEventListener('focus', poll);
        window.addEventListener('online', poll);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', poll);
            window.removeEventListener('online', poll);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [token, refreshUser]);

    const login = (userData, newToken) => {
        localStorage.setItem('token', newToken);
        const formattedUser = formatUser(userData.user || userData);
        clearOptimisticBalance();
        commitUser(formattedUser);
        setToken(newToken);
        syncMixpanelUser(formattedUser);
        flagDiscoveryForSession();
    };

    const logout = () => {
        resetMixpanel();
        localStorage.removeItem('token');
        clearOptimisticBalance();
        commitUser(null);
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            refreshUser,
            applyOptimisticBalanceDelta,
            clearOptimisticBalance,
            loading,
            isAuthenticated: !!token,
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
