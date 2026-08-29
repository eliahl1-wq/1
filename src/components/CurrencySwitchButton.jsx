import React from 'react';

export default function CurrencySwitchButton({ value = 'USD', onChange, className = '' }) {
    const currency = value === 'SOL' ? 'SOL' : 'USD';
    return (
        <div
            className={`currency-switch-button${className ? ` ${className}` : ''}`}
            role="group"
            aria-label="Balance display currency"
        >
            <button
                type="button"
                className={`currency-switch-button__option${currency === 'SOL' ? ' is-active' : ''}`}
                onClick={() => onChange?.('SOL')}
                aria-pressed={currency === 'SOL'}
                title="Show balances in SOL"
            >
                <img className="currency-switch-button__sol-logo" src="/solana-sol-logo.png" alt="" />
                <span>SOL</span>
            </button>
            <button
                type="button"
                className={`currency-switch-button__option${currency === 'USD' ? ' is-active' : ''}`}
                onClick={() => onChange?.('USD')}
                aria-pressed={currency === 'USD'}
                title="Show balances in USD"
            >
                <span className="currency-switch-button__dollar">$</span>
                <span>USD</span>
            </button>
        </div>
    );
}
