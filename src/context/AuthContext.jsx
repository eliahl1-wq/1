import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

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
                    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');
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
                        setUser(userData);
                        console.log('AuthContext: Användardata från /api/me:', userData);
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

        const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');
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
                console.log(`[AuthContext] Refresh lyckades. Ny balans: ${userData.balance}. URL: ${url}`);
                setUser(userData);
                return userData;
            }
        } catch (err) {
            console.error("AuthContext: Kunde inte uppdatera användardata:", err);
        }
    }, [token]);

    const login = (userData, newToken) => {
        localStorage.setItem('token', newToken);
        setUser(userData);
        setToken(newToken);
        console.log('AuthContext: Användare inloggad, token sparad, user-state uppdaterad:', userData);
    };

    const logout = () => {
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