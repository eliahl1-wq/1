export const ENTRY_TIERS = [5, 10, 20];
export const BR_ENTRY_TIERS = [5, 10];
export const DEFAULT_ENTRY_FEE = 10;
export const MIN_ENTRY_FEE = 5;
export const DEFAULT_BR_ENTRY_FEE = 5;

export function normalizeEntryFee(fee) {
    const n = Number(fee);
    return ENTRY_TIERS.includes(n) ? n : DEFAULT_ENTRY_FEE;
}

export function normalizeBREntryFee(fee) {
    const n = Number(fee);
    return BR_ENTRY_TIERS.includes(n) ? n : DEFAULT_BR_ENTRY_FEE;
}

/** Scaled economy values for a given entry tier (baseline = $10). */
export function tierEconomy(entryFeeUsd) {
    const entry = normalizeEntryFee(entryFeeUsd);
    const s = entry / DEFAULT_ENTRY_FEE;
    return {
        entryFee: entry,
        startBalance: 1.0 * s,
        rankBonus1st: 20.0 * s,
        rankBonus2nd3rd: 10.0 * s,
    };
}

export function formatUsd(n) {
    return `$${Number(n).toFixed(2)}`;
}
