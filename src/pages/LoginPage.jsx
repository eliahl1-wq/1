import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Background from '../components/Background';
import {
    AuthAlert,
    AuthBrand,
    AuthDivider,
    AuthField,
    AuthFooter,
    AuthForm,
    AuthPanel,
    GoogleAuthButton,
    PasswordControl,
} from '../components/AuthScaffold';
import { setPageSeo, SEO } from '../utils/seo';
import '../styles/ui.css';
import { API_URL } from '../utils/apiBase';
import { getReferralDeviceId, getStoredReferral } from '../utils/referral';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const { login, isAuthenticated, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => { setPageSeo(SEO.login); }, []);

    useEffect(() => {
        if (isAuthenticated) {
            navigate((user?.balance || 0) >= 10 ? '/pre-game' : '/lobby', { replace: true });
        }
    }, [isAuthenticated, user, navigate]);

    const handleLogin = async (event) => {
        event.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminders': 'true' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                login(data.user, data.token);
                navigate((data.user.balance || 0) >= 10 ? '/pre-game' : '/lobby', { replace: true });
            } else {
                setError(data.message || 'Invalid credentials.');
            }
        } catch {
            setError('Could not connect to server.');
        }
        setIsLoading(false);
    };

    const handleGoogleLogin = () => {
        const referral = getStoredReferral();
        const params = new URLSearchParams();
        if (referral?.code) params.set('ref', referral.code);
        if (referral?.clickId) params.set('clickId', referral.clickId);
        params.set('deviceId', getReferralDeviceId());
        window.location.href = `${API_URL}/api/auth/google?${params}`;
    };

    return (
        <div className="auth-page">
            <Background />
            <main className="auth-card">
                <AuthBrand subtitle="Welcome back." />
                <AuthPanel>
                    <AuthAlert>{error}</AuthAlert>
                    <AuthForm onSubmit={handleLogin}>
                        <AuthField label="Username or email">
                            <input
                                type="text"
                                placeholder="Enter username"
                                value={username}
                                onChange={event => setUsername(event.target.value)}
                                className="input"
                                required
                                autoComplete="username"
                            />
                        </AuthField>
                        <AuthField label="Password">
                            <PasswordControl visible={showPw} onToggle={() => setShowPw(value => !value)}>
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="Enter password"
                                    value={password}
                                    onChange={event => setPassword(event.target.value)}
                                    className="input"
                                    required
                                    autoComplete="current-password"
                                />
                            </PasswordControl>
                        </AuthField>
                        <button type="submit" disabled={isLoading} className="btn btn-primary auth-submit">
                            {isLoading ? <><span className="spinner" /> Signing in…</> : 'Login'}
                        </button>
                        <AuthDivider />
                        <GoogleAuthButton onClick={handleGoogleLogin} />
                    </AuthForm>
                </AuthPanel>
                <AuthFooter prompt="No account?" to="/register" action="Create one" />
            </main>
        </div>
    );
}
