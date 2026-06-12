const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.agararena.space').replace(/\/$/, '');

export const BASE_KEYWORDS = [
    'agarstake', 'agar stake', 'agararena', 'agar arena',
    'agar with money', 'agar.io with money', 'play agar for money', 'real money agar', 'real money agario',
    'slither with money', 'slither.io with money', 'play slither for money', 'real money slither', 'real money slitherio',
    'io games with money', 'real money io games', 'crypto io games', 'web3 browser games',
    'solana wager game', 'solana io game', 'earn crypto playing games', 'cash out crypto games',
].join(', ');

function upsertMeta(selector, attrs) {
    let el = document.head.querySelector(selector);
    if (!el) {
        el = document.createElement('meta');
        document.head.appendChild(el);
    }
    for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, value);
    }
}

function upsertLink(rel, href) {
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

/**
 * tabTitle     → browser tab only (short)
 * description  → Google meta description (not Discord/OG)
 * keywords     → meta keywords
 * OG/twitter tags stay static in index.html for clean link previews.
 */
export function setPageSeo({ tabTitle, description, keywords, path = '' }) {
    if (tabTitle) document.title = tabTitle;

    if (description) {
        upsertMeta('meta[name="description"]', { name: 'description', content: description });
    }

    if (keywords) {
        upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords });
    }

    const canonical = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    upsertLink('canonical', canonical);
}

export const SEO = {
    gamemodesAgar: {
        tabTitle: 'AgarStake | Agar',
        description: 'AgarStake: play Agar.io with real money. Deposit SOL, grow your blob, eat rivals, and cash out crypto instantly. The real-money Agar arena at agararena.space.',
        keywords: `${BASE_KEYWORDS}, agar.io real money, wager agar`,
        path: '/gamemodes',
    },
    gamemodesSlither: {
        tabTitle: 'AgarStake | Slither',
        description: 'AgarStake: play Slither.io with real money. Deposit Solana, grow your snake, trap opponents, and cash out instantly. Slither with money — crypto Slither.io arena.',
        keywords: `${BASE_KEYWORDS}, slither.io real money, wager slither`,
        path: '/gamemodes',
    },
    preGameAgar: {
        tabTitle: 'AgarStake | Arena',
        description: 'AgarStake arena: play Agar with real money. Stake SOL, dominate the blob battle, and withdraw when you cash out. Agar.io with money — join the arena now.',
        keywords: `${BASE_KEYWORDS}, agar arena, agar.io cash out`,
        path: '/pre-game',
    },
    preGameSlither: {
        tabTitle: 'AgarStake | Slither',
        description: 'AgarStake Slither arena: play Slither with real money. Stake SOL, outgrow rival snakes, and cash out crypto instantly. Slither.io with money — join now.',
        keywords: `${BASE_KEYWORDS}, slither arena, slither.io cash out`,
        path: '/pre-game',
    },
    lobby: {
        tabTitle: 'AgarStake | Lobby',
        description: 'Fund your AgarStake wallet with Solana. Play Agar.io and Slither.io with real money — deposit SOL, pick your arena, and earn crypto in browser .io games.',
        keywords: `${BASE_KEYWORDS}, deposit solana, crypto game lobby`,
        path: '/lobby',
    },
};
