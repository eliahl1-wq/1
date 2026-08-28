import React from 'react';

export default function CurrencySwitchButton({ value = 'USD', onChange, className = '' }) {
    const currency = value === 'SOL' ? 'SOL' : 'USD';
    const nextCurrency = currency === 'SOL' ? 'USD' : 'SOL';
    return (
        <button
            type="button"
            className={`currency-switch-button${className ? ` ${className}` : ''}`}
            onClick={() => onChange?.(nextCurrency)}
            aria-label={`Show balances in ${nextCurrency}`}
            title={`Switch to ${nextCurrency}`}
        >
            <span className="currency-switch-button__mark" aria-hidden="true">
                {currency === 'SOL'
                    ? <img src="/solana-sol-logo.png" alt="" />
                    : <span>$</span>}
            </span>
            <span className="currency-switch-button__label">{currency}</span>
            <svg className="currency-switch-button__swap" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 5h8.5M9.5 3l2 2-2 2M13 11H4.5M6.5 9l-2 2 2 2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </button>
    );
}
