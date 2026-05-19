import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(''); // Rensa tidigare felmeddelanden
        setIsLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            console.log('Login Response Status:', res.status);
            const data = await res.json();
            console.log('Login Response Data:', data);

            if (res.ok) {
                console.log('LoginPage: Loggar in användare i Context...');
                login(data.user, data.token);
                console.log('LoginPage: Navigerar till /lobby');
                navigate('/lobby', { replace: true });
            } else {
                // Visa felmeddelande från servern, annars ett generellt fel
                setError(data.message || 'Inloggning misslyckades. Försök igen.');
            }
        } catch (err) {
            setError("Kunde inte ansluta till servern");
        }
        setIsLoading(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white', fontFamily: 'system-ui' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '55px', borderRadius: '36px', border: '0.5px solid rgba(255, 255, 255, 0.15)', width: '100%', maxWidth: '390px', textAlign: 'center', backdropFilter: 'blur(50px)', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
                <h1 style={{ marginBottom: '5px', fontSize: '3rem', fontWeight: '800', letterSpacing: '-2px' }}>AgarArena</h1>
                <p style={{ marginBottom: '35px', color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }}>Welcome back, gladiator.</p>
                
                {error && (
                    <div style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30', padding: '12px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.9rem', border: '0.5px solid rgba(255,59,48,0.2)' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input 
                        type="text" 
                        placeholder="Username" 
                        value={username}
                        onChange={e => setUsername(e.target.value)} 
                        style={{ padding: '16px', borderRadius: '14px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '1.1rem', marginBottom: '10px', outline: 'none' }}
                        required
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        value={password}
                        onChange={e => setPassword(e.target.value)} 
                        style={{ padding: '16px', borderRadius: '14px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '1.1rem', outline: 'none' }}
                        required
                    />
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        style={{ padding: '18px', borderRadius: '18px', border: 'none', background: '#007AFF', color: 'white', fontSize: '1.2rem', cursor: 'pointer', fontWeight: '600', marginTop: '15px', boxShadow: '0 10px 25px rgba(0,122,255,0.4)' }}
                    >
                        {isLoading ? 'Logging in...' : 'LOGIN'}
                    </button>
                </form>
                <p style={{ marginTop: '25px', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                    No account? <Link to="/register" style={{ color: '#007AFF', textDecoration: 'none', fontWeight: '600' }}>Register here</Link>
                </p>
            </div>
        </div>
    );
}