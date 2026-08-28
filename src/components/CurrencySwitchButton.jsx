import React from 'react';

export default function CurrencySwitchButton({ value = 'USD', onChange, className = '' }) {
    const currency = value === 'SOL' ? 'SOL' : 'USD';
    const nextCurrency = currency === 'SOL' ? 'USD' : 'SOL';
    return (
        <button
            type="button"
            className={`currency-switch-button${className ? ` ${className}` : ''}`}
            data-currency={currency}
            onClick={() => onChange?.(nextCurrency)}
            aria-label={`Show balances in ${nextCurrency}`}
            aria-checked={currency === 'SOL'}
            role="switch"
            title={`Switch to ${nextCurrency}`}
        >
            <span className="currency-switch-button__thumb" aria-hidden="true" />
            <span className={`currency-switch-button__option${currency === 'SOL' ? ' is-active' : ''}`} aria-hidden="true">
                <img className="currency-switch-button__sol-logo" src="/solana-sol-logo.png" alt="" />
                <span>SOL</span>
            </span>
            <span className={`currency-switch-button__option${currency === 'USD' ? ' is-active' : ''}`} aria-hidden="true">
                <span className="currency-switch-button__dollar">$</span>
                <span>USD</span>
            </span>
        </button>
    );
}
