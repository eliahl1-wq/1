const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://arenifi.fun').replace(/\/$/, '');

export const BASE_KEYWORDS = [
    'arenifi', 'competitive browser games', 'multiplayer io games',
    'agar with money', 'agar.io with money', 'play agar for money', 'real money agar', 'real money agario',
    'slither with money', 'slither.io with money', 'play slither for money', 'real money slither', 'real money slitherio',
    'io games with money', 'real money io games', 'free play io games', 'crypto browser games',
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
 * Social tags are updated alongside the visible route metadata.
 */
export function setPageSeo({ tabTitle, description, keywords, path = '' }) {
    if (tabTitle) document.title = tabTitle;

    if (description) {
        upsertMeta('meta[name="description"]', { name: 'description', content: description });
        upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
        upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    }

    if (tabTitle) {
        upsertMeta('meta[property="og:title"]', { property: 'og:title', content: tabTitle });
        upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: tabTitle });
    }

    if (keywords) {
        upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords });
    }

    const canonical = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    upsertLink('canonical', canonical);
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
}

export const SEO = {
    home: {
        tabTitle: 'Arenifi | Competitive Browser Games with SOL Stakes',
        description: 'Play competitive Agar, Slither and Surviv-style browser games on Arenifi. Choose free play or enter SOL-staked matches and compete live.',
        keywords: BASE_KEYWORDS,
        path: '/',
    },
    agar: {
        tabTitle: 'Play Agar Online | Arenifi',
        description: 'Enter the high-stakes Agar arena. Wager SOL against real players, grow your mass, dominate the map, and cash out your crypto instantly.',
        keywords: `${BASE_KEYWORDS}, agar.io real money, wager agar`,
        path: '/agar',
    },
    slither: {
        tabTitle: 'Play Slither Online | Arenifi',
        description: 'Join the ultimate competitive Slither arena. Stake SOL, outmaneuver opponents, claim the leaderboard, and cash out immediately.',
        keywords: `${BASE_KEYWORDS}, slither.io real money, wager slither`,
        path: '/slither',
    },
    gamemodesAgar: {
        tabTitle: 'Agar Game Modes | Arenifi',
        description: 'Choose your Agar mode: high-stakes Normal or winner-takes-all Battle Royale. Secure your entry and compete for the Solana prize pool.',
        keywords: `${BASE_KEYWORDS}, agar.io real money, wager agar`,
        path: '/gamemodes',
    },
    gamemodesSlither: {
        tabTitle: 'Slither Game Modes | Arenifi',
        description: 'Choose your Slither mode: high-stakes Normal or winner-takes-all Battle Royale. Secure your entry and compete for the Solana prize pool.',
        keywords: `${BASE_KEYWORDS}, slither.io real money, wager slither`,
        path: '/gamemodes',
    },
    preGameAgar: {
        tabTitle: 'Join an Agar Match | Arenifi',
        description: 'Select your entry tier and jump straight into the Agar action. High stakes, real opponents, instant crypto cashouts.',
        keywords: `${BASE_KEYWORDS}, agar.io cash out`,
        path: '/pre-game',
    },
    gamemodesSurviv: {
        tabTitle: 'Surviv Arena | Arenifi',
        description: 'Surviv Normal — $5 entry top-down battle royale. Loot, fight, and cash out your balance anytime.',
        keywords: `${BASE_KEYWORDS}, surviv.io real money, battle royale shooter`,
        path: '/gamemodes',
    },
    preGameSlither: {
        tabTitle: 'Join a Slither Match | Arenifi',
        description: 'Select your entry tier and jump straight into the Slither action. High stakes, real opponents, instant crypto cashouts.',
        keywords: `${BASE_KEYWORDS}, slither.io cash out`,
        path: '/pre-game',
    },
    lobby: {
        tabTitle: 'Wallet & Lobby | Arenifi',
        description: 'Manage your funds and deposit Solana (SOL) using your personal address or QR code to enter the arenas.',
        keywords: `${BASE_KEYWORDS}, deposit solana, crypto game lobby`,
        path: '/lobby',
    },
    login: {
        tabTitle: 'Log In | Arenifi',
        description: 'Log in securely to your Arenifi account.',
        keywords: `${BASE_KEYWORDS}, arenifi login`,
        path: '/login',
    },
    register: {
        tabTitle: 'Create an Account | Arenifi',
        description: 'Create an Arenifi account to join multiplayer arenas, track performance and manage your balance.',
        keywords: `${BASE_KEYWORDS}, arenifi register, sign up`,
        path: '/register',
    },
    profile: {
        tabTitle: 'Profile & Performance | Arenifi',
        description: 'Review your Arenifi profile, game performance and account settings.',
        keywords: `${BASE_KEYWORDS}, arenifi profile, stats`,
        path: '/profile',
    },
    transactions: {
        tabTitle: 'Transaction History | Arenifi',
        description: 'Review deposits, withdrawals and account transactions on Arenifi.',
        keywords: `${BASE_KEYWORDS}, arenifi transactions, withdrawals`,
        path: '/transactions',
    },
    howItWorks: {
        tabTitle: 'How Arenifi Works',
        description: 'Learn the mechanics of our high-stakes Web3 arenas. Master the economy, understand cashouts, and start winning Solana.',
        keywords: `${BASE_KEYWORDS}, how to play, cash out`,
        path: '/how-it-works',
    },
    faq: {
        tabTitle: 'Help & FAQ | Arenifi',
        description: 'Find answers about Arenifi accounts, gameplay, deposits, withdrawals and game rules.',
        keywords: `${BASE_KEYWORDS}, faq, help, support`,
        path: '/faq',
    },
};
