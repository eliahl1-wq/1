export const ENTRY_TIERS = [5, 10, 20];
export const BR_ENTRY_TIERS = [5, 10];
export const COMPETITIVE_ENTRY_TIERS = [2, 5];
export const DEFAULT_ENTRY_FEE = 10;
export const MIN_ENTRY_FEE = 5;
export const DEFAULT_BR_ENTRY_FEE = 5;
export const DEFAULT_COMPETITIVE_ENTRY_FEE = 5;

export function normalizeEntryFee(fee) {
    const n = Number(fee);
    return ENTRY_TIERS.includes(n) ? n : DEFAULT_ENTRY_FEE;
}

export function normalizeCompetitiveEntryFee(fee) {
    const n = Number(fee);
    return COMPETITIVE_ENTRY_TIERS.includes(n) ? n : DEFAULT_COMPETITIVE_ENTRY_FEE;
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
        snakeStartMass: 1.0,
        goldenBlobValue: entry * 0.10,
    };
}

/** Slither Arena economy for $2 / $5 tiers (separate pools). */
export function competitiveTierEconomy(entryFeeUsd) {
    const entry = normalizeCompetitiveEntryFee(entryFeeUsd);
    const cashoutFeePct = entry === 2 ? 0.05 : 0.035;
    return {
        entryFee: entry,
        dollarStart: entry,
        snakeStartMass: 1.0,
        cashoutFeePct,
        cashoutPlayerPct: 1 - cashoutFeePct,
    };
}

export function formatUsd(n) {
    return `$${Number(n).toFixed(2)}`;
}
