import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function GuestWelcomeBanner() {
    const navigate = useNavigate();

    return (
        <div className="guest-banner">
            <div className="guest-banner-content">
                <p className="guest-banner-tag">Real-money PvP</p>
                <h2 className="guest-banner-title">
                    Stake SOL. Dominate the arena. Cash out instantly.
                </h2>
                <p className="guest-banner-sub">
                    Agar &amp; Slither with real stakes — compete against live players, not bots.
                </p>
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
