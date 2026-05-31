import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Kontrollera om det finns en sparad inloggning när sidan startar
    useEffect(() => {
        const checkLoggedIn = async () => {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                console.log('AuthContext: Token hittades i localStorage, försöker validera.');
                try {
                    const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
                    const url = `${baseUrl}/api/me?t=${Date.now()}`;
                    
                    const res = await fetch(url, {
                        headers: { 
                            'Authorization': `Bearer ${storedToken}`,
                            'bypass-tunnel-reminders': 'true',
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    });
                    if (res.ok) {
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

        const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
        const url = `${baseUrl}/api/me?t=${Date.now()}`;

        try {
            const res = await fetch(url, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'bypass-tunnel-reminders': 'true',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            if (res.ok) {
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