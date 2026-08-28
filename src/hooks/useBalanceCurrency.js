import { useCallback, useEffect, useState } from 'react';
import { getStoredBalanceCurrency } from '../utils/displayCurrency.js';

export const BALANCE_CURRENCY_EVENT = 'agarstake:balance-currency-change';

function normalizeCurrency(value) {
    return value === 'SOL' ? 'SOL' : 'USD';
}

export function setStoredBalanceCurrency(value) {
    const currency = normalizeCurrency(value);
    localStorage.setItem('balance_currency', currency);
    window.dispatchEvent(new CustomEvent(BALANCE_CURRENCY_EVENT, { detail: currency }));
    return currency;
}

export default function useBalanceCurrency() {
    const [currency, setCurrencyState] = useState(getStoredBalanceCurrency);

    useEffect(() => {
        const syncCurrency = (event) => {
            const next = event?.detail || getStoredBalanceCurrency();
            setCurrencyState(normalizeCurrency(next));
        };
        window.addEventListener(BALANCE_CURRENCY_EVENT, syncCurrency);
        window.addEventListener('storage', syncCurrency);
        return () => {
            window.removeEventListener(BALANCE_CURRENCY_EVENT, syncCurrency);
            window.removeEventListener('storage', syncCurrency);
        };
    }, []);

    const setCurrency = useCallback((next) => {
        const previous = getStoredBalanceCurrency();
        const resolved = normalizeCurrency(typeof next === 'function' ? next(previous) : next);
        setStoredBalanceCurrency(resolved);
        setCurrencyState(resolved);
    }, []);

    return [currency, setCurrency];
}
