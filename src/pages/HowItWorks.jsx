import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import '../styles/ui.css';
import { setPageSeo, SEO } from '../utils/seo';
import { ENTRY_TIERS } from '../constants/economy';

const STEPS = [
    {
        num: '01',
        title: 'Create your account',
        desc: 'Sign up in seconds with email or Google. Your wallet is generated automatically — no seed phrase needed.',
        icon: '👤',
    },
    {
        num: '02',
        title: 'Deposit Solana',
        desc: 'Send SOL to your personal deposit address by copying it or scanning the QR code. Funds appear after Solana confirmation.',
        icon: '◎',
    },
    {
        num: '03',
        title: 'Pick a mode & stake',
        desc: `Choose a game mode, then select free play or an available entry tier ($${ENTRY_TIERS.join(' / $')} for supported normal arenas).`,
        icon: '⚔',
    },
    {
        num: '04',
        title: 'Grow & dominate',
        desc: 'Collect resources, outplay opponents and grow your arena balance. Some modes also use server-controlled bots to keep matches active.',
        icon: '🎯',
    },
    {
        num: '05',
        title: 'Cash out anytime',
        desc: 'In supported modes, hold the cash-out button when you\'re ready. After server confirmation and the displayed fee, the balance is credited to your Arenifi account for withdrawal.',
        icon: '💰',
    },
];

const MODES = [
    {
        name: 'Agar Normal',
        desc: 'Classic blob arena. Grow by eating pellets and other players. Golden blobs are worth extra.',
        stakes: `$${ENTRY_TIERS.join(' / $')}`,
    },
    {
        name: 'Slither Normal',
        desc: 'High-stakes snake battles. Trap opponents, grow longer, and cash out your dollar balance.',
        stakes: `$${ENTRY_TIERS.join(' / $')}`,
    },
    {
        name: 'Slither Arena',
        desc: 'Competitive mode with shrinking zones and separate stake pools.',
        stakes: '$2 / $5',
    },
];

export default function HowItWorks() {
    const navigate = useNavigate();

    useEffect(() => {
        setPageSeo(SEO.howItWorks);
    }, []);

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />
            <AppTopbar />

            <div className="page-content info-page">
                <div className="info-hero">
                    <p className="label">Guide</p>
                    <h1 className="info-hero-title">How Arenifi works</h1>
                    <p className="info-hero-sub">
                        Free-play and eligible SOL-staked browser arenas. Five steps from signup to cashout.
                    </p>
                </div>

                <div className="info-steps">
                    {STEPS.map((step) => (
                        <div key={step.num} className="info-step-card">
                            <div className="info-step-icon" aria-hidden="true">{step.icon}</div>
                            <div className="info-step-body">
                                <span className="info-step-num">{step.num}</span>
                                <h3 className="info-step-title">{step.title}</h3>
                                <p className="info-step-desc">{step.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <section className="info-section">
                    <h2 className="info-section-title">Game modes</h2>
                    <div className="info-modes-grid">
                        {MODES.map((mode) => (
                            <div key={mode.name} className="info-mode-card">
                                <h3>{mode.name}</h3>
                                <p>{mode.desc}</p>
                                <span className="info-mode-stake mono">{mode.stakes} entry</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="info-section info-cta-block">
                    <h2 className="info-section-title">Ready to play?</h2>
                    <p className="info-hero-sub" style={{ marginBottom: '20px' }}>
                        Choose a game mode and review the current entry option before you play.
                    </p>
                    <div className="info-cta-row">
                        <button type="button" className="btn btn-primary" onClick={() => navigate('/register')}>
                            Create account
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
                            Go to lobby
                        </button>
                    </div>
                </section>
            </div>

            <AppFooter />
        </div>
    );
}
