import React from 'react';
import '../styles/ui.css';

export default function TokenBadge({ logo = '/solana-sol-logo.png', label = 'SOL', size = 14 }) {
    return (
        <div className="token-badge" style={{padding:'4px 8px'}}>
            <img src={logo} alt={label} style={{ width: size, height: size }} />
            <div style={{ fontWeight: 800, fontSize: '0.75rem' }}>Solana</div>
        </div>
    );
}
