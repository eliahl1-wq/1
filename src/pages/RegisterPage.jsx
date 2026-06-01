import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setMessage(''); // Clear previous messages
        setIsLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/register`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'bypass-tunnel-reminders': 'true'
                },
                body: JSON.stringify({ email, username, password })
            });
            const data = await res.json();

            if (res.ok) {
                console.log("Registrering lyckades!");
                setMessage("✅ Konto skapat! Skickar dig till inloggning...");
                setTimeout(() => navigate('/login'), 2000); // Vänta 2 sek så användaren hinner se meddelandet
            } else {
                console.log("Registrering misslyckades:", data.message);
                setMessage("❌ " + (data.message || 'Registrering misslyckades'));
            }
        } catch (err) {
            // Fånga nätverksfel eller andra oväntade fel
            console.error('RegisterPage: Fel vid registrering:', err);
            setMessage("Kunde inte ansluta till servern. Kontrollera att backend körs.");
        }
        setIsLoading(false);
    };

    const handleGoogleLogin = () => {
        window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '50px', borderRadius: '32px', border: '0.5px solid rgba(255, 255, 255, 0.1)', width: '100%', maxWidth: '380px', textAlign: 'center', backdropFilter: 'blur(40px)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
                <h1 style={{ marginBottom: '10px', fontSize: '2.8rem', fontWeight: '800', letterSpacing: '-1px' }}>Register</h1>
                <p style={{ marginBottom: '35px', color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }}>Create your gladiator</p>
                
                {message && (
                    <div style={{ 
                        background: (message.includes('failed') || message.includes('error')) ? 'rgba(255,59,48,0.1)' : 'rgba(0,122,255,0.1)', 
                        color: (message.includes('failed') || message.includes('error')) ? '#FF3B30' : '#007AFF', 
                        padding: '12px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.9rem', 
                        border: (message.includes('failed') || message.includes('error')) ? '0.5px solid rgba(255,59,48,0.2)' : '0.5px solid rgba(0,122,255,0.2)' 
                    }}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input 
                        type="email" 
                        placeholder="Email Address" 
                        value={email}
                        onChange={e => setEmail(e.target.value)} 
                        style={{ padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
                        required
                    />
                    <input 
                        type="text" 
                        placeholder="Username" 
                        value={username}
                        onChange={e => setUsername(e.target.value)} 
                        style={{ padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
                        required
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        value={password}
                        onChange={e => setPassword(e.target.value)} 
                        style={{ padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
                        required
                    />
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        style={{ padding: '16px', borderRadius: '16px', border: 'none', background: '#007AFF', color: 'white', fontSize: '1.1rem', cursor: 'pointer', fontWeight: '600', marginTop: '10px', boxShadow: '0 10px 20px rgba(0,122,255,0.3)' }}
                    >
                        {isLoading ? 'Creating account...' : 'REGISTER'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '15px 0', opacity: 0.2 }}>
                        <div style={{ flex: 1, height: '1px', background: 'white' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'white' }} />
                    </div>

                    <button 
                        type="button"
                        onClick={handleGoogleLogin}
                        style={{ 
                            padding: '16px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.1)', 
                            background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '1rem', 
                            cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', 
                            justifyContent: 'center', gap: '10px' 
                        }}
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
                        Continue with Google
                    </button>
                </form>
                <p style={{ marginTop: '25px', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                    Already have an account? <Link to="/login" style={{ color: '#007AFF', textDecoration: 'none', fontWeight: '600' }}>Login here</Link>
                </p>
            </div>
        </div>
    );
}