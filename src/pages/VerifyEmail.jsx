import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Background from '../components/Background';
import { AuthAlert, AuthBrand, AuthField, AuthForm, AuthPanel } from '../components/AuthScaffold';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';
import '../styles/ui.css';

export default function VerifyEmail() {
    const { user, token, refreshUser } = useAuth();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const verificationToken = searchParams.get('token') || '';
    const [email, setEmail] = useState(user?.email || location.state?.email || '');
    const [status, setStatus] = useState(location.state?.emailSent ? 'sent' : 'idle');
    const [message, setMessage] = useState(location.state?.emailSent
        ? 'Verification email sent. Check your inbox and spam folder.'
        : '');
    const [busy, setBusy] = useState(false);

    const verified = status === 'verified' || user?.emailVerified === true;
    const needsEmail = user?.emailVerificationStatus === 'missing' || !user?.email;
    const returnTo = useMemo(() => location.state?.returnTo || '/pre-game', [location.state]);

    useEffect(() => {
        if (user?.email) setEmail(user.email);
    }, [user?.email]);

    useEffect(() => {
        if (!verificationToken) return;
        let active = true;
        setBusy(true);
        setStatus('confirming');
        fetch(`${API_URL}/api/email-verification/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: verificationToken }),
        })
            .then(async response => ({ response, data: await response.json().catch(() => ({})) }))
            .then(async ({ response, data }) => {
                if (!active) return;
                if (!response.ok) throw new Error(data.message || 'Verification link is invalid or expired.');
                setStatus('verified');
                setMessage('Your email is verified. Username changes and withdrawals are now unlocked.');
                if (token) await refreshUser();
            })
            .catch(error => {
                if (!active) return;
                setStatus('error');
                setMessage(error.message);
            })
            .finally(() => { if (active) setBusy(false); });
        return () => { active = false; };
    }, [verificationToken, token, refreshUser]);

    const sendVerification = async event => {
        event.preventDefault();
        if (!token) {
            navigate('/login');
            return;
        }
        setBusy(true);
        setMessage('');
        try {
            const response = await fetch(`${API_URL}/api/email-verification/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Could not send verification email.');
            if (data.alreadyVerified) {
                setStatus('verified');
                setMessage('Your email is already verified.');
                await refreshUser();
            } else {
                setStatus('sent');
                setMessage(`Verification email sent to ${data.emailMasked || email.trim()}.`);
                await refreshUser();
            }
        } catch (error) {
            setStatus('error');
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    };

    const tone = status === 'verified' || status === 'sent' ? 'success' : 'error';

    return (
        <div className="auth-page">
            <Background />
            <main className="auth-card">
                <AuthBrand subtitle="Secure your Arenifi account." />
                <AuthPanel>
                    <AuthAlert tone={tone}>{message}</AuthAlert>
                    {verificationToken && status === 'confirming' ? (
                        <div className="auth-email-state"><span className="spinner" /> Verifying your email…</div>
                    ) : verified ? (
                        <div className="auth-email-state">
                            <div className="auth-email-state__icon is-success">✓</div>
                            <h2>Email verified</h2>
                            <p>You only need to do this once.</p>
                            <Link className="btn btn-primary auth-submit" to={token ? returnTo : '/login'}>
                                {token ? 'Continue' : 'Log in'}
                            </Link>
                        </div>
                    ) : token ? (
                        <AuthForm onSubmit={sendVerification}>
                            <p className="auth-email-copy">
                                {needsEmail
                                    ? 'Add an email address and verify it before changing your username or withdrawing.'
                                    : 'Verify your existing email once before changing your username or withdrawing.'}
                            </p>
                            <AuthField label="Email address">
                                <input
                                    type="email"
                                    className="input"
                                    value={email}
                                    onChange={event => setEmail(event.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    autoComplete="email"
                                />
                            </AuthField>
                            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
                                {busy ? <><span className="spinner" /> Sending…</> : status === 'sent' ? 'Send again' : 'Send verification email'}
                            </button>
                            <Link className="auth-back-link auth-email-cancel" to={returnTo}>Cancel</Link>
                        </AuthForm>
                    ) : (
                        <div className="auth-email-state">
                            <h2>Check your inbox</h2>
                            <p>{message || 'Open the verification link we emailed you. You can also log in to resend it.'}</p>
                            <Link className="btn btn-primary auth-submit" to="/login">Log in</Link>
                        </div>
                    )}
                </AuthPanel>
            </main>
        </div>
    );
}
