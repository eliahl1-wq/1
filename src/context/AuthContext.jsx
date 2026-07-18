import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { syncMixpanelUser, resetMixpanel } from '../utils/mixpanel';
import { flagDiscoveryForSession } from '../constants/gamemodes';
import { API_URL } from '../utils/apiBase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Kontrollera om det finns en sparad inloggning när sidan startar
    useEffect(() => {
        const checkLoggedIn = async () => {
            // Kolla om vi har en token i URL:en (från Google OAuth redirect)
            const params = new URLSearchParams(window.location.search);
            const urlToken = params.get('token');
            if (urlToken) {
                localStorage.setItem('token', urlToken);
                setToken(urlToken);
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            const storedToken = urlToken || localStorage.getItem('token');
            if (storedToken) {
                console.log('AuthContext: Token hittades i localStorage, försöker validera.');
                try {
                    const baseUrl = API_URL;
                    const url = `${baseUrl}/api/me?t=${Date.now()}`;
                    
                    const res = await fetch(url, {
                        headers: { 
                            'Authorization': `Bearer ${storedToken}`,
                            'bypass-tunnel-reminders': 'true',
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    });
                    
                    const contentType = res.headers.get("content-type");
                    if (res.ok && contentType && contentType.includes("application/json")) {
                        const userData = await res.json();
                        const formattedUser = {
                            ...userData,
                            balance: userData.balanceSol,
                            balanceSol: userData.balanceSol,
                            balanceUsd: userData.balanceUsd,
                            solPrice: userData.solPrice,
                            freePlay: userData.freePlay,
                            isAdmin: userData.isAdmin,
                        };
                        setUser(formattedUser);
                        syncMixpanelUser(formattedUser);
                        console.log('AuthContext: Användardata från /api/me:', formattedUser);
                    } else {
                        console.log('AuthContext: /api/me misslyckades, tar bort token.');
                        if (res.status === 401 || res.status === 403) {
                            localStorage.removeItem('token');
                            setToken(null);
                        }
                    }
                } catch (err) {
                    console.error("AuthContext: Validering av token misslyckades:", err);
                }
            }
            setLoading(false);
        };
        checkLoggedIn();
    }, []);

    const refreshUser = useCallback(async () => {
        if (!token) return;

        const baseUrl = API_URL;
        const url = `${baseUrl}/api/me?t=${Date.now()}`;
        
        if (!baseUrl && !window.location.hostname.includes('localhost')) {
            console.error("❌ AuthContext: VITE_API_URL är inte definierad! Backend-anrop kommer misslyckas.");
        }

        try {
            const res = await fetch(url, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'bypass-tunnel-reminders': 'true',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            const contentType = res.headers.get("content-type");
            if (res.ok && contentType && contentType.includes("application/json")) {
                const userData = await res.json();
                const formattedUser = {
                    ...userData,
                    balance: userData.balanceSol,
                    balanceSol: userData.balanceSol,
                    balanceUsd: userData.balanceUsd,
                    solPrice: userData.solPrice,
                    freePlay: userData.freePlay,
                    isAdmin: userData.isAdmin,
                };
                console.log(`[AuthContext] Refresh lyckades. Ny balans: ${userData.balanceSol} SOL ($${userData.balanceUsd?.toFixed(2)} USD). URL: ${url}`);
                setUser(formattedUser);
                return formattedUser;
            }
        } catch (err) {
            console.error("AuthContext: Kunde inte uppdatera användardata:", err);
        }
    }, [token]);

    // Keep wallet data fresh outside live Surviv matches. During a match the
    // socket already carries the live balance, so polling /api/me is redundant.
    useEffect(() => {
        if (!token) return undefined;
        const poll = () => {
            if (document.hidden || window.location.pathname === '/surviv-game') return;
            refreshUser();
        };
        const interval = setInterval(poll, 15000);
        document.addEventListener('visibilitychange', poll);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', poll);
        };
    }, [token, refreshUser]);

    const login = (userData, newToken) => {
        localStorage.setItem('token', newToken);
        
        // Safely handle both nested response objects and direct user structures
        const base = userData.user || userData;
        const formattedUser = {
            ...base,
            balance: base.balanceSol || base.balance,
            balanceSol: base.balanceSol,
            balanceUsd: base.balanceUsd,
            solPrice: base.solPrice,
            freePlay: base.freePlay,
            isAdmin: base.isAdmin,
        };

        setUser(formattedUser);
        setToken(newToken);
        syncMixpanelUser(formattedUser);
        flagDiscoveryForSession();
        console.log('AuthContext: Användare inloggad, token sparad, user-state uppdaterad:', formattedUser);
    };

    const logout = () => {
        resetMixpanel();
        localStorage.removeItem('token');
        setUser(null);
        setToken(null);
        console.log('AuthContext: Användare utloggad, token borttagen, user-state rensad.');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading, isAuthenticated: !!token }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
