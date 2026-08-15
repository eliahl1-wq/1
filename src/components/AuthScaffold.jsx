import React from 'react';
import { Link } from 'react-router-dom';

export function AuthBrand({ subtitle }) {
    return (
        <header className="auth-brand">
            <div className="auth-brand__logo" aria-label="AgarStake">
                <span className="auth-brand__dot" aria-hidden="true" />
                <span>AGAR<span>STAKE</span></span>
            </div>
            <p>{subtitle}</p>
        </header>
    );
}

export function AuthPanel({ children }) {
    return <section className="auth-panel">{children}</section>;
}

export function AuthAlert({ tone = 'error', children }) {
    if (!children) return null;
    return <div className={`auth-alert auth-alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function AuthForm({ onSubmit, children }) {
    return <form className="auth-form" onSubmit={onSubmit}>{children}</form>;
}

export function AuthField({ label, optional = false, hint, children }) {
    return (
        <div className="auth-field">
            <label className="label">
                {label}
                {optional && <span className="auth-field__optional">Optional</span>}
            </label>
            {children}
            {hint}
        </div>
    );
}

export function PasswordControl({ visible, onToggle, children }) {
    return (
        <div className="auth-password">
            {children}
            <button
                type="button"
                className="auth-password__toggle"
                onClick={onToggle}
                aria-label={visible ? 'Hide password' : 'Show password'}
                aria-pressed={visible}
            >
                {visible ? 'Hide' : 'Show'}
            </button>
        </div>
    );
}

export function AuthDivider() {
    return <div className="auth-divider"><span>or</span></div>;
}

export function GoogleAuthButton({ onClick }) {
    return (
        <button type="button" onClick={onClick} className="btn btn-ghost auth-google-btn">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" aria-hidden="true" />
            Continue with Google
        </button>
    );
}

export function AuthFooter({ prompt, to, action }) {
    return (
        <footer className="auth-footer">
            <p>{prompt} <Link to={to}>{action}</Link></p>
            <Link to="/pre-game" className="auth-back-link">
                <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                    <path d="M9.75 3.75 5.5 8l4.25 4.25M6 8h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Back to lobby</span>
            </Link>
        </footer>
    );
}
