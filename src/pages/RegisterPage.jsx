import React, { useState, useEffect } from 'react';
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
import { identifyMixpanelUser, trackMixpanelEvent } from '../utils/mixpanel';
import { setPageSeo, SEO } from '../utils/seo';
import '../styles/ui.css';
import { API_URL } from '../utils/apiBase';
import {
    clearStoredReferral,
    getReferralDeviceId,
    getStoredReferral,
    normalizeReferralCode,
} from '../utils/referral';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const storedReferral = getStoredReferral();
    const [referralCode, setReferralCode] = useState(storedReferral?.code || '');
    const [referralStatus, setReferralStatus] = useState(storedReferral ? 'Referral link captured' : '');
    const referralLocked = !!storedReferral;
    const navigate = useNavigate();

    useEffect(() => { setPageSeo(SEO.register); }, []);

    const handleRegister = async (event) => {
        event.preventDefault();
        setMessage('');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminders': 'true' },
                body: JSON.stringify({
                    email,
                    username,
                    password,
                    referralCode: normalizeReferralCode(referralCode) || '',
                    referralClickId: storedReferral?.clickId || null,
                    referralDeviceId: getReferralDeviceId(),
                    referralSource: storedReferral ? 'link' : 'manual',
                }),
            });
            const data = await response.json();
            if (response.ok) {
                if (data.userId) {
                    identifyMixpanelUser(data.userId, { username: data.username });
                    trackMixpanelEvent('sign_up_completed', { sign_up_method: 'email', platform: 'web' });
                }
                clearStoredReferral();
                setIsSuccess(true);
                setMessage('Account created. Redirecting to login…');
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
        const referral = getStoredReferral();
        const params = new URLSearchParams();
        const code = normalizeReferralCode(referral?.code || referralCode);
        if (code) params.set('ref', code);
        if (referral?.clickId) params.set('clickId', referral.clickId);
        params.set('deviceId', getReferralDeviceId());
        window.location.href = `${API_URL}/api/auth/google?${params}`;
    };

    const validateReferral = async () => {
        const code = normalizeReferralCode(referralCode);
        if (!referralCode) {
            setReferralStatus('');
            return;
        }
        if (!code) {
            setReferralStatus('Invalid referral code format');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/api/referrals/resolve?code=${encodeURIComponent(code)}`);
            const data = await response.json().catch(() => ({}));
            setReferralStatus(response.ok ? `Referral code ${data.referralCode} is valid` : 'Referral code not found');
        } catch {
            setReferralStatus('Referral validation unavailable');
        }
    };

    const referralError = referralStatus.includes('not') || referralStatus.includes('Invalid');

    return (
        <div className="auth-page auth-page--register">
            <Background />
            <main className="auth-card">
                <AuthBrand subtitle="Create your account." />
                <AuthPanel>
                    <AuthAlert tone={isSuccess ? 'success' : 'error'}>{message}</AuthAlert>
                    <AuthForm onSubmit={handleRegister}>
                        <AuthField label="Email address">
                            <input
                                type="email"
                                placeholder="Enter email"
                                value={email}
                                onChange={event => setEmail(event.target.value)}
                                className="input"
                                required
                                autoComplete="email"
                            />
                        </AuthField>
                        <AuthField label="Username">
                            <input
                                type="text"
                                placeholder="Choose username"
                                value={username}
                                onChange={event => setUsername(event.target.value)}
                                className="input"
                                required
                                autoComplete="username"
                            />
                        </AuthField>
                        <AuthField
                            label="Referral code"
                            optional
                            hint={referralStatus ? <small className={`auth-field__hint ${referralError ? 'is-error' : 'is-success'}`}>{referralStatus}</small> : null}
                        >
                            <input
                                type="text"
                                placeholder="Enter referral code"
                                value={referralCode}
                                onChange={event => !referralLocked && setReferralCode(event.target.value)}
                                onBlur={validateReferral}
                                className="input"
                                readOnly={referralLocked}
                                autoComplete="off"
                            />
                        </AuthField>
                        <AuthField label="Password">
                            <PasswordControl visible={showPw} onToggle={() => setShowPw(value => !value)}>
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="Create password"
                                    value={password}
                                    onChange={event => setPassword(event.target.value)}
                                    className="input"
                                    required
                                    autoComplete="new-password"
                                />
                            </PasswordControl>
                        </AuthField>
                        <button type="submit" disabled={isLoading} className="btn btn-primary auth-submit">
                            {isLoading ? <><span className="spinner" /> Creating account…</> : 'Create account'}
                        </button>
                        <AuthDivider />
                        <GoogleAuthButton onClick={handleGoogleLogin} />
                    </AuthForm>
                </AuthPanel>
                <AuthFooter prompt="Already have an account?" to="/login" action="Log in" />
            </main>
        </div>
    );
}
