import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import '../styles/ui.css';
import '../styles/affiliate.css';

const terms = [
    'No self-referrals, fake engagement, commission farming, spam, or impersonation.',
    'Do not make misleading claims or promise guaranteed profit.',
    'Do not advertise to restricted jurisdictions or on prohibited channels.',
    'No commission is earned from fraudulent, promotional, test, bot, admin, or free-ticket activity.',
    'AgarArena may hold or reverse invalid commission after review.',
    'Affiliates are responsible for required disclosures such as “ad” or “affiliate link”.',
];

export default function AffiliateProgram() {
    const { user } = useAuth();
    useEffect(() => {
        document.title = 'AgarArena | Refer & Earn';
    }, []);

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll affiliate-page">
            <Background />
            <AppTopbar />
            <main className="page-content affiliate-public">
                <section className="affiliate-hero">
                    <span className="affiliate-kicker">AgarArena Affiliate Program</span>
                    <h1>Refer players. Earn from real gameplay.</h1>
                    <p>
                        Earn 30% of AgarArena&apos;s 5% in-game cashout fee from every eligible player you refer.
                        That equals up to 1.5% of eligible referred cashout volume.
                    </p>
                    <div className="affiliate-hero-actions">
                        <Link className="btn btn-primary" to={user ? '/affiliate' : '/register'}>
                            {user ? 'Open affiliate dashboard' : 'Create an account'}
                        </Link>
                        {!user && <Link className="btn btn-ghost" to="/login">Login</Link>}
                    </div>
                    <small>Participation and earnings are not guaranteed. Eligibility and anti-abuse review apply.</small>
                </section>

                <section className="affiliate-explainer-grid">
                    <article className="affiliate-panel">
                        <span>01</span>
                        <h2>Share your link</h2>
                        <p>Every eligible account receives an immutable referral code and a first-touch referral link.</p>
                    </article>
                    <article className="affiliate-panel">
                        <span>02</span>
                        <h2>Players cash out</h2>
                        <p>Commission applies only after an eligible referred player completes a real in-game cashout.</p>
                    </article>
                    <article className="affiliate-panel">
                        <span>03</span>
                        <h2>Withdraw earnings</h2>
                        <p>Commission becomes available after seven days. The minimum payout is $25 to your saved wallet.</p>
                    </article>
                </section>

                <section className="affiliate-math-card">
                    <div>
                        <span className="affiliate-kicker">Transparent calculation</span>
                        <h2>$100 eligible cashout</h2>
                    </div>
                    <div className="affiliate-math-flow">
                        <strong>$5.00</strong><span>platform fee</span>
                        <i>×</i>
                        <strong>30%</strong><span>standard share</span>
                        <i>=</i>
                        <strong className="affiliate-green">$1.50</strong><span>affiliate commission</span>
                    </div>
                </section>

                <section className="affiliate-terms">
                    <span className="affiliate-kicker">Affiliate terms</span>
                    <h2>Promote responsibly</h2>
                    <ul>
                        {terms.map(term => <li key={term}>{term}</li>)}
                    </ul>
                </section>
            </main>
            <AppFooter />
        </div>
    );
}
