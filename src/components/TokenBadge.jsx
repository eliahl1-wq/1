import React from 'react';

/**
 * TokenBadge — compact SOL/token badge matching axiom style
 */
export default function TokenBadge({ logo = '/solana-sol-logo.png', label = 'SOL', size = 11 }) {
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            borderRadius: 'var(--r-sm, 6px)',
            background: 'rgba(153, 69, 255, 0.1)',
            border: '1px solid rgba(153, 69, 255, 0.2)',
            color: 'var(--accent, #9945FF)',
            fontWeight: 700,
            fontSize: '0.65rem',
            lineHeight: 1,
            letterSpacing: '0.02em',
        }}>
            <img src={logo} alt={label} style={{ width: size, height: size, objectFit: 'contain' }} />
            {label}
        </span>
    );
}
