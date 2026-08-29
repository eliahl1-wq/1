function buildSwapUrl(template, mint) {
    return template.replaceAll('{mint}', encodeURIComponent(mint));
}

/**
 * Launch-safe Jupiter handoff. It keeps quote/signing outside Arenifi until
 * the embedded Jupiter adapter is reviewed and enabled.
 */
export const jupiterLinkSwapProvider = Object.freeze({
    async execute({ side, mint, config }) {
        const template = side === 'SELL'
            ? config.swap.sellUrl
            : config.swap.buyUrl;
        if (!template) throw new Error('Jupiter swap URL is not configured.');

        const popup = window.open(
            buildSwapUrl(template, mint),
            '_blank',
            'noopener,noreferrer',
        );
        if (!popup) throw new Error('Allow pop-ups to open Jupiter Swap.');

        // TODO: Replace the external handoff with embedded Jupiter quote,
        // transaction creation, wallet signing, and confirmation.
        return { opened: true };
    },
});
