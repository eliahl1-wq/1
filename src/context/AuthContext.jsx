import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Kontrollera om det finns en sparad inloggning när sidan startar
    useEffect(() => {
        const checkLoggedIn = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                console.log('AuthContext: Token hittades i localStorage, försöker validera.');
                try {
                    const res = await fetch('http://localhost:5000/api/me', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const userData = await res.json();
                        setUser(userData);
                        console.log('AuthContext: Användardata från /api/me:', userData);
                    } else {
                        console.log('AuthContext: /api/me misslyckades, tar bort token.');
                        localStorage.removeItem('token'); // Token ogiltig, ta bort den
                    }
                } catch (err) {
                    console.error("AuthContext: Validering av token misslyckades:", err);
                    localStorage.removeItem('token'); // Ta bort token vid nätverksfel eller andra fel
                }
            }
            setLoading(false);
        };
        checkLoggedIn();
    }, []);

    const login = (userData, token) => {
        localStorage.setItem('token', token);
        setUser(userData);
        console.log('AuthContext: Användare inloggad, token sparad, user-state uppdaterad:', userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        console.log('AuthContext: Användare utloggad, token borttagen, user-state rensad.');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);