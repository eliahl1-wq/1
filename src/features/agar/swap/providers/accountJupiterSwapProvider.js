import { API_URL } from '../../../../utils/apiBase';

function resolveEndpoint(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Uses the custodial Solana address attached to the AgarStake account.
 * The browser never receives or signs with the account deposit secret.
 */
export const accountJupiterSwapProvider = Object.freeze({
    async execute({
        side,
        amount,
        accountAddress,
        authToken,
        config,
    }) {
        const response = await fetch(resolveEndpoint(config.swap.endpoint), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                side,
                amount,
                accountAddress,
            }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.message || payload.error || 'AGAR account swap failed.');
        }
        return payload;
    },
});
