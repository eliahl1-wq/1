import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function GuestWelcomeBanner({
    title = 'Play Agar, Slither and Surviv arenas on Arenifi',
    subtitle = 'Choose free play or an available SOL-staked match, then compete in real time from your browser.',
}) {
    const navigate = useNavigate();

    return (
        <div className="guest-banner">
            <div className="guest-banner-content">
                <p className="guest-banner-tag">Free play &amp; SOL arenas</p>
                <h1 className="guest-banner-title">{title}</h1>
                <p className="guest-banner-sub">
                    {subtitle}
                </p>
                <nav className="guest-banner-links" aria-label="Explore Arenifi">
                    <Link to="/agar">Agar</Link>
                    <Link to="/slither">Slither</Link>
                    <Link to="/surviv">Surviv</Link>
                    <Link to="/tournaments">Tournaments</Link>
                    <Link to="/how-it-works">How it works</Link>
                </nav>
            </div>
            <div className="guest-banner-steps">
                <div className="guest-step">
                    <span className="guest-step-num">1</span>
                    <span>Create account</span>
                </div>
                <div className="guest-step">
                    <span className="guest-step-num">2</span>
                    <span>Deposit SOL</span>
                </div>
                <div className="guest-step">
                    <span className="guest-step-num">3</span>
                    <span>Play &amp; cash out</span>
                </div>
            </div>
            <button type="button" className="btn btn-primary guest-banner-cta" onClick={() => navigate('/register')}>
                Get started — it&apos;s free
            </button>
        </div>
    );
}
