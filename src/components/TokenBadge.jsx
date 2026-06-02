import React from 'react';
import '../styles/ui.css';

export default function TokenBadge({ logo = '/solana-sol-logo.png', label = 'SOL', size = 18 }) {
    return (
        <div className="token-badge">
            <img src={logo} alt={label} style={{ width: size, height: size }} />
            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{label}</div>
        </div>
    );
}
