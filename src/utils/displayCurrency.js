export function getStoredBalanceCurrency() {
    try {
        return localStorage.getItem('balance_currency') === 'SOL' ? 'SOL' : 'USD';
    } catch {
        return 'USD';
    }
}

export function getBalanceDisplayParts(amountUsd, solPrice, currency = getStoredBalanceCurrency()) {
    const usd = Number(amountUsd) || 0;
    const price = Number(solPrice) || 0;
    if (currency === 'SOL' && price > 0) {
        return {
            amount: (usd / price).toFixed(2),
            unit: 'SOL',
            unitPosition: 'suffix',
        };
    }
    return {
        amount: usd.toFixed(2),
        unit: '$',
        unitPosition: 'prefix',
    };
}

export function formatBalanceAmount(amountUsd, solPrice, currency = getStoredBalanceCurrency()) {
    const parts = getBalanceDisplayParts(amountUsd, solPrice, currency);
    return parts.unitPosition === 'prefix'
        ? `${parts.unit}${parts.amount}`
        : `${parts.amount} ${parts.unit}`;
}
