import React, { useEffect, useState } from 'react';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import '../styles/ui.css';
import { setPageSeo, SEO, SITE_URL } from '../utils/seo';

const FAQ_ITEMS = [
    {
        q: 'Does Arenifi support real-money matches?',
        a: 'Yes, where staked play is available. You deposit Solana (SOL), choose an eligible entry option and play for an arena balance. Successful cashouts credit your Arenifi account balance, which can then be withdrawn as SOL.',
    },
    {
        q: 'How do I deposit?',
        a: 'After creating an account, go to the lobby and send SOL to your personal deposit address by copying the address or scanning its QR code.',
    },
    {
        q: 'How does cashing out work?',
        a: 'While in a supported game, hold the cash-out button for a few seconds. After the server confirms it, your arena balance minus the displayed fee is credited to your Arenifi account. You can then request a withdrawal to a Solana address.',
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
        q: 'Do games use bots?',
        a: 'Some Arenifi modes use server-controlled bots to keep the arena active. Live player counts are shown separately in the mode selector when available.',
    },
    {
        q: 'How are deposits held?',
        a: 'Arenifi uses custodial deposit wallets and processes withdrawals on Solana. Crypto and custodial services involve risk. Never share your password or wallet secret with anyone claiming to be support.',
    },
    {
        q: 'Which wallets can I deposit from?',
        a: 'You can send SOL from any Solana wallet to your personal deposit address. No wallet connection is required.',
    },
    {
        q: 'Can I play on mobile?',
        a: 'Yes. Arenifi works in mobile browsers with touch controls for movement and actions. For the best experience, use landscape mode on larger phones.',
    },
    {
        q: 'How do I contact support?',
        a: 'Email support@arenifi.fun with your username and a description of the issue, or use the Report bug button for technical problems.',
    },
];

export default function Faq() {
    const [openIndex, setOpenIndex] = useState(0);

    useEffect(() => {
        setPageSeo({
            ...SEO.faq,
            structuredData: {
                '@context': 'https://schema.org',
                '@graph': [
                    {
                        '@type': 'FAQPage',
                        mainEntity: FAQ_ITEMS.map(item => ({
                            '@type': 'Question',
                            name: item.q,
                            acceptedAnswer: {
                                '@type': 'Answer',
                                text: item.a,
                            },
                        })),
                    },
                    {
                        '@type': 'BreadcrumbList',
                        itemListElement: [
                            { '@type': 'ListItem', position: 1, name: 'Arenifi', item: `${SITE_URL}/` },
                            { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${SITE_URL}/faq` },
                        ],
                    },
                ],
            },
        });
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
                        <a href="mailto:support@arenifi.fun" className="text-accent" style={{ textDecoration: 'none', fontWeight: 600 }}>
                            Contact support
                        </a>
                    </p>
                </div>
            </div>

            <AppFooter showStatus={false} />
        </div>
    );
}
