export function formatAgarAmount(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '0';

    const absolute = Math.abs(amount);
    const units = [[1e12, 't'], [1e9, 'b'], [1e6, 'm'], [1e3, 'k']];
    for (const [threshold, suffix] of units) {
        if (absolute >= threshold) {
            const compact = amount / threshold;
            return `${compact.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: Math.abs(compact) < 10 ? 2 : Math.abs(compact) < 100 ? 1 : 0,
            })}${suffix}`;
        }
    }

    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: absolute < 1 ? 4 : 2,
    });
}