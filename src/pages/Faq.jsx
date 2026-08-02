import React, { useEffect, useState } from 'react';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import '../styles/ui.css';
import { setPageSeo, SEO } from '../utils/seo';

const FAQ_ITEMS = [
    {
        q: 'Is AgarStake real money?',
        a: 'Yes. You deposit real Solana (SOL) and compete against other players for real stakes. Your arena balance reflects actual USD value, and cashouts are sent as SOL to your wallet.',
    },
    {
        q: 'How do I deposit?',
        a: 'After creating an account, go to the lobby and send SOL to your personal deposit address by copying the address or scanning its QR code.',
    },
    {
        q: 'How does cashing out work?',
        a: 'While in a game, hold the cash-out button for a few seconds. Your current arena balance (minus a small fee) is credited to your AgarStake wallet instantly. You can then withdraw to any Solana address.',
    },
    {
        q: 'What happens if I die?',
        a: 'Your arena balance drops on the map as loot for other players to collect. You can re-enter with a new stake, but your previous balance is gone unless someone doesn\'t pick it up before the round resets.',
    },
    {
        q: 'What are the entry tiers?',
        a: 'Agar and Slither Normal support $5, $10, and $20 entry tiers — each tier has its own player pool. Slither Arena uses $2 and $5 tiers with separate matchmaking.',
    },
    {
        q: 'Are there bots?',
        a: 'No. AgarStake matches you with real players only. Each stake tier runs in its own pool so you compete against players at your level.',
    },
    {
        q: 'Is my deposit safe?',
        a: 'Deposits are held in a custodial wallet system secured on Solana. Withdrawals are processed on-chain. Never share your password or deposit address with anyone claiming to be support.',
    },
    {
        q: 'Which wallets can I deposit from?',
        a: 'You can send SOL from any Solana wallet to your personal deposit address. No wallet connection is required.',
    },
    {
        q: 'Can I play on mobile?',
        a: 'Yes. AgarStake works in mobile browsers with touch controls for movement and actions. For the best experience, use landscape mode on larger phones.',
    },
    {
        q: 'How do I contact support?',
        a: 'Email us at support@agararena.space with your username and a description of the issue. We typically respond within 24 hours.',
    },
];

export default function Faq() {
    const [openIndex, setOpenIndex] = useState(0);

    useEffect(() => {
        setPageSeo(SEO.faq);
    }, []);

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />
            <AppTopbar />

            <div className="page-content info-page" style={{ maxWidth: '720px' }}>
                <div className="info-hero">
                    <p className="label">Help</p>
                    <h1 className="info-hero-title">FAQ</h1>
                    <p className="info-hero-sub">
                        Everything you need to know about playing, depositing, and cashing out.
                    </p>
                </div>

                <div className="faq-list">
                    {FAQ_ITEMS.map((item, i) => {
                        const isOpen = openIndex === i;
                        return (
                            <div key={item.q} className={`faq-item${isOpen ? ' faq-item--open' : ''}`}>
                                <button
                                    type="button"
                                    className="faq-question"
                                    onClick={() => setOpenIndex(isOpen ? -1 : i)}
                                    aria-expanded={isOpen}
                                >
                                    <span>{item.q}</span>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                                        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: '0.2s', flexShrink: 0 }}>
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                </button>
                                <div className="faq-answer">
                                    <p>{item.a}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="info-cta-block" style={{ marginTop: '32px' }}>
                    <p className="info-hero-sub">
                        Still have questions?{' '}
                        <a href="mailto:support@agararena.space" className="text-accent" style={{ textDecoration: 'none', fontWeight: 600 }}>
                            Contact support
                        </a>
                    </p>
                </div>
            </div>

            <AppFooter showStatus={false} />
        </div>
    );
}
