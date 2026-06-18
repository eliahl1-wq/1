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
    home: {
        tabTitle: 'AgarStake | Competitive PvP Games with Real Cash & Crypto Wagers',
        description: 'Earn money playing Agar and Slither on AgarStake. Deposit Solana, compete against real players, dominate the map, and cash out crypto instantly.',
        keywords: BASE_KEYWORDS,
        path: '/',
    },
    agar: {
        tabTitle: 'AgarStake | Play Agar with Real Money',
        description: 'Play Agar.io for real money on AgarStake. Stake Solana, grow your blob, dominate rivals, and cash out crypto instantly.',
        keywords: `${BASE_KEYWORDS}, agar.io real money, wager agar`,
        path: '/agar',
    },
    slither: {
        tabTitle: 'AgarStake | Play Slither with Real Money',
        description: 'Play Slither.io for real money on AgarStake. Stake Solana, grow your snake, trap opponents, and cash out instantly.',
        keywords: `${BASE_KEYWORDS}, slither.io real money, wager slither`,
        path: '/slither',
    },
    gamemodesAgar: {
        tabTitle: 'AgarStake | Agar',
        description: 'Choose your Agar mode on AgarStake — Normal or Battle Royale. Stake SOL, compete, and cash out crypto.',
        keywords: `${BASE_KEYWORDS}, agar.io real money, wager agar`,
        path: '/gamemodes',
    },
    gamemodesSlither: {
        tabTitle: 'AgarStake | Slither',
        description: 'Choose your Slither mode on AgarStake — Normal or Battle Royale. Stake SOL, compete, and cash out crypto.',
        keywords: `${BASE_KEYWORDS}, slither.io real money, wager slither`,
        path: '/gamemodes',
    },
    preGameAgar: {
        tabTitle: 'AgarStake | Agar',
        description: 'Join the Agar lobby on AgarStake. Pick your stake tier, enter the game, and cash out when you dominate.',
        keywords: `${BASE_KEYWORDS}, agar.io cash out`,
        path: '/pre-game',
    },
    preGameSlither: {
        tabTitle: 'AgarStake | Slither',
        description: 'Join the Slither lobby on AgarStake. Pick your stake tier, enter the game, and cash out when you dominate.',
        keywords: `${BASE_KEYWORDS}, slither.io cash out`,
        path: '/pre-game',
    },
    lobby: {
        tabTitle: 'AgarStake | Lobby',
        description: 'Fund your AgarStake wallet with Solana. Deposit SOL to play Agar and Slither, then join a match.',
        keywords: `${BASE_KEYWORDS}, deposit solana, crypto game lobby`,
        path: '/lobby',
    },
    login: {
        tabTitle: 'AgarStake | Login',
        description: 'Log in to your AgarStake account to play Agar.io and Slither.io with Solana stakes.',
        keywords: `${BASE_KEYWORDS}, agarstake login`,
        path: '/login',
    },
    register: {
        tabTitle: 'AgarStake | Register',
        description: 'Create your AgarStake account and start playing Agar.io and Slither.io with Solana stakes.',
        keywords: `${BASE_KEYWORDS}, agarstake register, sign up`,
        path: '/register',
    },
    profile: {
        tabTitle: 'AgarStake | Profile',
        description: 'View your AgarStake profile, balance, and game history.',
        keywords: `${BASE_KEYWORDS}, agarstake profile`,
        path: '/profile',
    },
    transactions: {
        tabTitle: 'AgarStake | History',
        description: 'View your AgarStake deposit and withdrawal history.',
        keywords: `${BASE_KEYWORDS}, agarstake transactions`,
        path: '/transactions',
    },
    howItWorks: {
        tabTitle: 'AgarStake | How it Works',
        description: 'Learn how to play Agar and Slither for real money on AgarStake. Deposit SOL, compete, and cash out instantly.',
        keywords: `${BASE_KEYWORDS}, how to play, cash out`,
        path: '/how-it-works',
    },
    faq: {
        tabTitle: 'AgarStake | FAQ',
        description: 'Frequently asked questions about AgarStake — deposits, cashouts, game modes, and Solana wagering.',
        keywords: `${BASE_KEYWORDS}, faq, help`,
        path: '/faq',
    },
};
