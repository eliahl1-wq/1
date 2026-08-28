export function getStoredBalanceCurrency() {
    try {
        return localStorage.getItem('balance_currency') === 'SOL' ? 'SOL' : 'USD';
    } catch {
        return 'USD';
    }
}

export function formatWalletBalanceAmount(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return '0';
    if (amount >= 10000) return Math.round(amount).toString();
    if (amount >= 1000) return amount.toFixed(1);
    if (amount >= 1) return amount.toFixed(2);
    if (amount > 0) return amount.toFixed(4);
    return '0';
}

export function formatGameSolAmount(value) {
    const amount = Number(value) || 0;
    const absolute = Math.abs(amount);
    if (absolute === 0) return '0.00';

    let decimals = 2;
    if (absolute < 0.1) {
        const leadingZeroes = Math.max(0, Math.floor(-Math.log10(absolute)) - 1);
        decimals = Math.min(6, leadingZeroes + 3);
    }

    const fixed = amount.toFixed(decimals);
    const [whole, fraction = ''] = fixed.split('.');
    const trimmedFraction = fraction.replace(/0+$/, '');
    const keptFraction = trimmedFraction.padEnd(Math.min(2, decimals), '0');
    return keptFraction ? `${whole}.${keptFraction}` : whole;
}

export function getBalanceDisplayParts(amountUsd, solPrice, currency = getStoredBalanceCurrency()) {
    const usd = Number(amountUsd) || 0;
    const price = Number(solPrice) || 0;
    if (currency === 'SOL' && price > 0) {
        return {
            amount: formatGameSolAmount(usd / price),
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
