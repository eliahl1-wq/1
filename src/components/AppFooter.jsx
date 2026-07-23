import React from 'react';
import { Link } from 'react-router-dom';

export default function AppFooter({ showStatus = true }) {
    return (
        <footer className="app-footer">
            <nav className="footer-links" aria-label="Site links">
                <Link to="/how-it-works">How it Works</Link>
                <Link to="/faq">FAQ</Link>
                <Link to="/affiliate-program">Affiliate</Link>
                <a href="mailto:support@agararena.space">Support</a>
                {showStatus && (
                    <span className="footer-status">
                        <span className="live-dot" aria-hidden="true" />
                        EU-West · Online
                    </span>
                )}
            </nav>
        </footer>
    );
}
