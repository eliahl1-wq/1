import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Background from '../components/Background';
import { identifyMixpanelUser, trackMixpanelEvent } from '../utils/mixpanel';

export default function RegisterPage() {
    const [email, setEmail]       = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw]     = useState(false);
    const [message, setMessage]   = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => { document.title = 'AgarStake | Register'; }, []);

    const handleRegister = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminders': 'true' },
                body: JSON.stringify({ email, username, password }),
            });
            const data = await res.json();
            if (res.ok) {
                if (data.userId) {
                    identifyMixpanelUser(data.userId, { username: data.username });
                    trackMixpanelEvent('sign_up_completed', { sign_up_method: 'email', platform: 'web' });
                }
                setIsSuccess(true);
                setMessage('Account created! Redirecting to login…');
                setTimeout(() => navigate('/login'), 2000);
            } else {
                setIsSuccess(false);
                setMessage(data.message || 'Registration failed.');
            }
        } catch {
            setIsSuccess(false);
            setMessage('Could not connect to server.');
        }
        setIsLoading(false);
    };

    const handleGoogleLogin = () => {
        window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`;
    };

    return (
        <div className="auth-page">
            <Background />

            <div className="auth-card">
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%', boxShadow: '0 0 10px var(--accent)' }} />
                        <span style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-1px', color: 'var(--text-h)' }}>
                            AGAR<span style={{ color: 'var(--accent)' }}>STAKE</span>
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 500 }}>
                        Create your gladiator account.
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-2xl)',
                    padding: '28px 24px',
                    boxShadow: 'var(--shadow-xl), inset 0 1px 0 rgba(255,255,255,0.03)',
                }}>
                    {message && (
                        <div style={{
                            background: isSuccess ? 'var(--green-dim)' : 'var(--red-dim)',
                            border: `1px solid ${isSuccess ? 'var(--green-border)' : 'rgba(255,59,48,0.2)'}`,
                            color: isSuccess ? 'var(--green)' : 'var(--red)',
                            padding: '10px 12px',
                            borderRadius: 'var(--r-md)',
                            marginBottom: '16px',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                        }}>
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Email */}
                        <div>
                            <label className="label" style={{ display: 'block', marginBottom: '5px' }}>Email Address</label>
                            <input
                                type="email"
                                placeholder="Enter email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="input"
                                required
                                autoComplete="email"
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Username */}
                        <div>
                            <label className="label" style={{ display: 'block', marginBottom: '5px' }}>Username</label>
                            <input
                                type="text"
                                placeholder="Choose username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="input"
                                required
                                autoComplete="username"
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="label" style={{ display: 'block', marginBottom: '5px' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="Create password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="input"
                                    required
                                    autoComplete="new-password"
                                    style={{ width: '100%', boxSizing: 'border-box', paddingRight: '40px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(v => !v)}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '0.7rem', fontWeight: 700, padding: 0 }}
                                >
                                    {showPw ? 'HIDE' : 'SHOW'}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '12px', fontSize: '0.85rem', marginTop: '6px', borderRadius: 'var(--r-lg)' }}
                        >
                            {isLoading ? (
                                <><span className="spinner" /> Creating account…</>
                            ) : 'Create Account'}
                        </button>

                        {/* Divider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.2 }}>
                            <div style={{ flex: 1, height: 1, background: 'white' }} />
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em' }}>OR</span>
                            <div style={{ flex: 1, height: 1, background: 'white' }} />
                        </div>

                        {/* Google */}
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="btn btn-ghost"
                            style={{ width: '100%', padding: '11px', fontSize: '0.8rem', borderRadius: 'var(--r-lg)', gap: '8px' }}
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: 15, height: 15 }} />
                            Continue with Google
                        </button>
                    </form>
                </div>

                {/* Footer link */}
                <p style={{ marginTop: '18px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-2)' }}>
                    Already have an account?{' '}
                    <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>
                        Login here
                    </Link>
                </p>
            </div>
        </div>
    );
}