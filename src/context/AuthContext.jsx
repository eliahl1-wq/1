import React, { createContext, useState, useContext, useEffect } from 'react';

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
                    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/me`, {
                        headers: { 'Authorization': `Bearer ${storedToken}` }
                    });
                    if (res.ok) {
                        const userData = await res.json();
                        setUser(userData);
                        console.log('AuthContext: Användardata från /api/me:', userData);
                    } else {
                        console.log('AuthContext: /api/me misslyckades, tar bort token.');
                        localStorage.removeItem('token'); // Token ogiltig, ta bort den
                        setToken(null);
                    }
                } catch (err) {
                    console.error("AuthContext: Validering av token misslyckades:", err);
                    localStorage.removeItem('token'); // Ta bort token vid nätverksfel eller andra fel
                    setToken(null);
                }
            }
            setLoading(false);
        };
        checkLoggedIn();
    }, []);

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
        <AuthContext.Provider value={{ user, token, login, logout, loading, isAuthenticated: !!user }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);